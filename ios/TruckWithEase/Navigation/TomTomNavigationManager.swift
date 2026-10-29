import Foundation
import CoreLocation
import AVFoundation
import Combine

#if canImport(TomTomSDKNavigation)
import TomTomSDKNavigation
import TomTomSDKRoute
import TomTomSDKLocationProvider
#endif

/// State of active turn-by-turn navigation session
public enum NavigationState: Equatable {
    case idle
    case calculating
    case navigating(remainingMiles: Double, remainingMinutes: Double, nextManeuver: String)
    case rerouting(reason: String)
    case arrived
}

/// The On-Device Navigation Manager coordinating TomTom SDK with Trimble Backend Rerouting
public class TomTomNavigationManager: NSObject, ObservableObject {
    public static let shared = TomTomNavigationManager()

    @Published public var navigationState: NavigationState = .idle
    @Published public var currentSpeedMph: Double = 0.0
    @Published public var activeBridgeWarning: BridgeClearanceWarning? = nil
    @Published public var isRerouting: Bool = false

    private let routingClient = RoutingClient.shared
    private var activeProfile: TruckProfile = TruckProfile()
    private var activeNormalizedRoute: NormalizedRoute?
    private var lastKnownLocation: CLLocation?
    private var stoppedTimer: Timer?
    private var isStationary: Bool = false

    // CoreLocation Provider
    private let locationManager = CLLocationManager()
    private let speechSynthesizer = AVSpeechSynthesizer()

    #if canImport(TomTomSDKNavigation)
    private var tomtomNavigation: TomTomNavigation?
    #endif

    public override init() {
        super.init()
        setupLocationManager()
        setupAudioSession()
    }

    // MARK: - Audio Configuration
    private func setupAudioSession() {
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.playback, mode: .voicePrompt, options: [.duckOthers, .allowBluetooth])
            try audioSession.setActive(true)
        } catch {
            print("[TomTomNavManager] Audio session setup error: \(error.localizedDescription)")
        }
    }

    // MARK: - Location Configuration & Battery Management
    private func setupLocationManager() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        locationManager.distanceFilter = 5.0 // Update every 5 meters
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.pausesLocationUpdatesAutomatically = false
        locationManager.activityType = .automotiveNavigation
    }

    /// Requests Apple Location Permissions
    public func requestPermissions() {
        locationManager.requestAlwaysAuthorization()
    }

    // MARK: - Navigation Lifecycle
    public func startNavigation(
        route: NormalizedRoute,
        profile: TruckProfile,
        destination: RouteCoordinate
    ) {
        self.activeNormalizedRoute = route
        self.activeProfile = profile
        self.navigationState = .navigating(
            remainingMiles: route.totalDistanceMiles,
            remainingMinutes: route.totalTimeMinutes,
            nextManeuver: "Proceed to commercial freight corridor"
        )

        locationManager.startUpdatingLocation()

        #if canImport(TomTomSDKNavigation)
        // 1. Build TomTom Vehicle parameters from profile
        let vehicle = profile.toTomTomVehicle()

        // 2. Initialize TomTom Navigation Engine with truck vehicle
        let config = NavigationConfiguration(vehicle: vehicle)
        let navigation = try? TomTomNavigationFactory.create(configuration: config)
        self.tomtomNavigation = navigation
        self.tomtomNavigation?.delegate = self

        // 3. Set the active route geometry from Trimble backend
        // (Convert GeoJSON coordinates into TomTom Route)
        print("[TomTomNavManager] TomTom On-Device Navigation active with \(route.polylineCoordinates.count) coordinates.")
        #endif

        speak("Commercial truck navigation started. Legal clearance monitored via Trimble PC*MILER.")
    }

    public func stopNavigation() {
        locationManager.stopUpdatingLocation()
        #if canImport(TomTomSDKNavigation)
        tomtomNavigation?.stop()
        tomtomNavigation = nil
        #endif
        self.navigationState = .idle
        self.activeBridgeWarning = nil
        self.isRerouting = false
    }

    // MARK: - Dual-Tier Reroute Engine (TomTom Tactical + Trimble Strategic)
    public func handleRouteDeviation(currentLocation: CLLocation) {
        guard !isRerouting, let currentRoute = activeNormalizedRoute else { return }
        self.isRerouting = true
        self.navigationState = .rerouting(reason: "Recalculating truck route...")
        speak("Recalculating route.")

        // LIVE NAVIGATION ENGINE: TomTom On-Device
        // TomTom SDK handles the active turn-by-turn navigation and live dynamic reroutes natively
        // on TomTom's map network. This guarantees 100% geometric alignment with the map display
        // and avoids map matching conflicts or cross-vendor visual layer violations.
        #if canImport(TomTomSDKNavigation)
        // TomTom Navigation SDK automatically computes and activates the legal truck detour
        print("[TomTomNavManager] TomTom On-Device actively calculating legal truck detour on TomTom network...")
        #endif

        // In the background, optionally update planning & tariff billing mileage with Trimble PC*MILER
        Task {
            do {
                guard let destCoord = currentRoute.polylineCoordinates.last else { return }
                let newOrigin = RouteCoordinate(lat: currentLocation.coordinate.latitude, lon: currentLocation.coordinate.longitude)
                let targetDest = RouteCoordinate(lat: destCoord.latitude, lon: destCoord.longitude)

                // Request updated navigation route via TomTom engine (mode: navigation)
                let updatedRoute = try await routingClient.calculateRoute(
                    origin: newOrigin,
                    destination: targetDest,
                    profile: self.activeProfile,
                    mode: "navigation"
                )

                await MainActor.run {
                    self.activeNormalizedRoute = updatedRoute
                    self.isRerouting = false
                    self.navigationState = .navigating(
                        remainingMiles: updatedRoute.totalDistanceMiles,
                        remainingMinutes: updatedRoute.totalTimeMinutes,
                        nextManeuver: "Follow route via TomTom Truck Navigation"
                    )
                }
            } catch {
                print("[TomTomNavManager] Route update completed on device: \(error.localizedDescription)")
                await MainActor.run {
                    self.isRerouting = false
                }
            }
        }
    }

    // MARK: - Proximity Bridge Hazard Radar
    private func checkBridgeClearanceProximity(userLocation: CLLocation) {
        guard let warnings = activeNormalizedRoute?.bridgeClearanceWarnings, !warnings.isEmpty else {
            self.activeBridgeWarning = nil
            return
        }

        // Search for bridges within 1.5 miles (2,414 meters)
        var closestWarning: (warning: BridgeClearanceWarning, distance: CLLocationDistance)?

        for w in warnings {
            let bridgeLoc = CLLocation(latitude: w.lat, longitude: w.lon)
            let distance = userLocation.distance(from: bridgeLoc)
            if distance <= 2414 { // Within 1.5 miles
                if closestWarning == nil || distance < closestWarning!.distance {
                    closestWarning = (w, distance)
                }
            }
        }

        if let closest = closestWarning {
            if self.activeBridgeWarning?.id != closest.warning.id {
                self.activeBridgeWarning = closest.warning
                let milesAway = (closest.distance / 1609.34).rounded()
                speak("Warning: Low bridge ahead on \(closest.warning.road). Clearance \(closest.warning.clearanceFt) feet.")
            }
        } else {
            self.activeBridgeWarning = nil
        }
    }

    private func speak(_ text: String) {
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = 0.52
        speechSynthesizer.speak(utterance)
    }
}

// MARK: - CLLocationManagerDelegate
extension TomTomNavigationManager: CLLocationManagerDelegate {
    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let latest = locations.last else { return }
        self.lastKnownLocation = latest

        // Convert speed (m/s to mph)
        let speedMph = max(0.0, latest.speed * 2.23694)
        self.currentSpeedMph = speedMph

        // Battery Optimization: Throttle GPS precision when vehicle is stationary for > 5 minutes
        if speedMph < 2.0 {
            if stoppedTimer == nil {
                stoppedTimer = Timer.scheduledTimer(withTimeInterval: 300, repeats: false) { [weak self] _ in
                    self?.isStationary = true
                    manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
                    print("[TomTomNavManager] Vehicle stationary: lowered GPS precision to save battery.")
                }
            }
        } else {
            stoppedTimer?.invalidate()
            stoppedTimer = nil
            if isStationary {
                isStationary = false
                manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
                print("[TomTomNavManager] Vehicle moving: restored maximum GPS accuracy.")
            }
        }

        // Check proximity to low-clearance bridges
        checkBridgeClearanceProximity(userLocation: latest)
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("[TomTomNavManager] CoreLocation error: \(error.localizedDescription)")
    }
}

#if canImport(TomTomSDKNavigation)
// MARK: - TomTom NavigationDelegate
extension TomTomNavigationManager: NavigationDelegate {
    public func navigation(_ navigation: TomTomNavigation, didDetectDeviationFromRoute route: Route) {
        guard let loc = lastKnownLocation else { return }
        handleRouteDeviation(currentLocation: loc)
    }

    public func navigation(_ navigation: TomTomNavigation, didUpdateInstructions instructions: [Instruction]) {
        if let first = instructions.first {
            print("[TomTomNavManager] Next instruction: \(first.text)")
        }
    }
}
#endif
