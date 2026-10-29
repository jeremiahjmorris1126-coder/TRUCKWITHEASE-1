import SwiftUI
import CoreLocation

/// Cockpit HUD for heavy commercial drivers adhering strictly to TruckWithEase visual identity
public struct NavigationHUDView: View {
    @ObservedObject var navManager = TomTomNavigationManager.shared
    @State private var searchQuery: String = ""
    @State private var suggestions: [PlaceSuggestion] = []
    @State private var isSearching: Bool = false
    @State private var selectedProfile = TruckProfile(heightFt: 13.5, weightLbs: 80000.0)

    // Design Tokens from GEMINI.md
    private let obsidianColor = Color(red: 5/255, green: 8/255, blue: 14/255) // #05080E
    private let obsidianCard = Color(red: 10/255, green: 15/255, blue: 20/255) // #0A0F14
    private let tacticalYellow = Color(red: 255/255, green: 229/255, blue: 0/255) // #FFE500
    private let emeraldGreen = Color(red: 16/255, green: 185/255, blue: 129/255) // #10B981
    private let hazardRed = Color(red: 239/255, green: 68/255, blue: 68/255) // #EF4444

    public init() {}

    public var body: some View {
        ZStack {
            obsidianColor.ignoresSafeArea()

            VStack(spacing: 0) {
                // Top Tactical Navigation Bar
                topHeaderView

                // Main Cockpit Center Display
                ScrollView {
                    VStack(spacing: 16) {
                        // Critical Clearance Alert Banner (when bridge is within radar range)
                        if let bridge = navManager.activeBridgeWarning {
                            criticalClearanceAlertBanner(bridge: bridge)
                        }

                        // Active Navigation Status or Search Box
                        switch navManager.navigationState {
                        case .idle:
                            idleSearchCard
                        case .calculating:
                            calculatingCard
                        case .navigating(let miles, let mins, let maneuver):
                            activeNavigationCard(miles: miles, minutes: mins, maneuver: maneuver)
                        case .rerouting(let reason):
                            reroutingCard(reason: reason)
                        case .arrived:
                            arrivedCard
                        }

                        // Dispatch Zero ($/Hr Yield) Metric Module
                        dispatchZeroYieldCard

                        // Vehicle Profile Dimensions Ribbon
                        vehicleProfileRibbon
                    }
                    .padding(16)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Subviews

    private var topHeaderView: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("TRUCKWITHEASE")
                    .font(.system(size: 18, weight: .black, design: .monospaced))
                    .foregroundColor(tacticalYellow)
                HStack(spacing: 6) {
                    Circle()
                        .fill(emeraldGreen)
                        .frame(width: 8, height: 8)
                    Text("THE MASTER MECHANIC ACTIVE")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.gray)
                }
            }
            Spacer()

            // Current Speed Gauge
            VStack(alignment: .trailing, spacing: 0) {
                Text("\(Int(navManager.currentSpeedMph))")
                    .font(.system(size: 26, weight: .heavy, design: .rounded))
                    .foregroundColor(.white)
                Text("MPH")
                    .font(.system(size: 10, weight: .black))
                    .foregroundColor(.gray)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(obsidianCard)
        .overlay(Rectangle().frame(height: 1).foregroundColor(Color.white.opacity(0.1)), alignment: .bottom)
    }

    private func criticalClearanceAlertBanner(bridge: BridgeClearanceWarning) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(hazardRed)
                    .font(.system(size: 20))
                Text("COLLISION RISK: CRITICAL")
                    .font(.system(size: 14, weight: .black, design: .monospaced))
                    .foregroundColor(hazardRed)
                Spacer()
                Text("BRIDGE AHEAD")
                    .font(.system(size: 11, weight: .black))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.yellow.opacity(0.2))
                    .foregroundColor(.yellow)
                    .cornerRadius(4)
            }

            Text("\(bridge.clearanceFt, specifier: "%.1f")' CLEARANCE // \(bridge.deltaInches ?? 0)\" BUFFER DELTA")
                .font(.system(size: 18, weight: .heavy, design: .monospaced))
                .foregroundColor(.white)

            Text("\(bridge.road) - \(bridge.description)")
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.white.opacity(0.8))
        }
        .padding(16)
        .background(Color.red.opacity(0.18))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(hazardRed, lineWidth: 2)
        )
        .cornerRadius(8)
    }

    private var idleSearchCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("DISPATCH DESTINATION")
                .font(.system(size: 12, weight: .black, design: .monospaced))
                .foregroundColor(.gray)

            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.gray)
                TextField("Search freight terminal, rail yard, or Love's...", text: $searchQuery)
                    .foregroundColor(.white)
                    .autocapitalization(.none)
                    .onChange(of: searchQuery) { val in
                        performPlaceAutocomplete(query: val)
                    }
            }
            .padding(12)
            .background(Color.white.opacity(0.06))
            .cornerRadius(8)

            // Autocomplete Results List
            if !suggestions.isEmpty {
                VStack(spacing: 8) {
                    ForEach(suggestions) { s in
                        Button(action: { selectDestination(s) }) {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(s.name)
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(.white)
                                    Text(s.formattedAddress)
                                        .font(.system(size: 12))
                                        .foregroundColor(.gray)
                                }
                                Spacer()
                                Image(systemName: "arrow.right.circle.fill")
                                    .foregroundColor(tacticalYellow)
                            }
                            .padding(10)
                            .background(Color.white.opacity(0.04))
                            .cornerRadius(6)
                        }
                    }
                }
            }

            // Quick Dispatch Launch Button
            Button(action: startDemoCorridor) {
                Text("DISPATCH LEGAL ROUTE (TRIMBLE PC*MILER)")
                    .font(.system(size: 13, weight: .black))
                    .foregroundColor(.black)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(tacticalYellow)
                    .cornerRadius(8)
                    .shadow(color: tacticalYellow.opacity(0.45), radius: 10, x: 0, y: 0)
            }
        }
        .padding(16)
        .background(obsidianCard)
        .cornerRadius(12)
    }

    private func activeNavigationCard(miles: Double, minutes: Double, maneuver: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("NEXT MANEUVER")
                    .font(.system(size: 11, weight: .black, design: .monospaced))
                    .foregroundColor(tacticalYellow)
                Spacer()
                Text("TOMTOM ON-DEVICE")
                    .font(.system(size: 10, weight: .bold))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(emeraldGreen.opacity(0.2))
                    .foregroundColor(emeraldGreen)
                    .cornerRadius(4)
            }

            Text(maneuver)
                .font(.system(size: 18, weight: .black))
                .foregroundColor(.white)

            HStack(spacing: 24) {
                VStack(alignment: .leading) {
                    Text("\(miles, specifier: "%.1f") MI")
                        .font(.system(size: 22, weight: .heavy, design: .monospaced))
                        .foregroundColor(tacticalYellow)
                    Text("DISTANCE")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.gray)
                }

                VStack(alignment: .leading) {
                    let hrs = Int(minutes / 60)
                    let mins = Int(minutes.truncatingRemainder(dividingBy: 60))
                    Text("\(hrs)H \(mins)M")
                        .font(.system(size: 22, weight: .heavy, design: .monospaced))
                        .foregroundColor(.white)
                    Text("TIME REMAINING")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.gray)
                }
            }

            Button(action: { navManager.stopNavigation() }) {
                Text("END ACTIVE GUIDANCE")
                    .font(.system(size: 12, weight: .black))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color.white.opacity(0.1))
                    .cornerRadius(6)
            }
        }
        .padding(16)
        .background(obsidianCard)
        .cornerRadius(12)
    }

    private var calculatingCard: some View {
        HStack {
            ProgressView()
                .tint(tacticalYellow)
            Text("Calculating legal clearance route with Trimble PC*MILER...")
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(.white)
        }
        .frame(maxWidth: .infinity)
        .padding(16)
        .background(obsidianCard)
        .cornerRadius(12)
    }

    private func reroutingCard(reason: String) -> some View {
        HStack {
            Image(systemName: "arrow.triangle.2.circlepath")
                .foregroundColor(tacticalYellow)
            Text(reason)
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(.white)
        }
        .frame(maxWidth: .infinity)
        .padding(16)
        .background(obsidianCard)
        .cornerRadius(12)
    }

    private var arrivedCard: some View {
        VStack(spacing: 10) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(emeraldGreen)
                .font(.system(size: 36))
            Text("ARRIVED AT DESTINATION")
                .font(.system(size: 16, weight: .black))
                .foregroundColor(.white)
            Button(action: { navManager.stopNavigation() }) {
                Text("CLOSE & ATTEST DVIR")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(.black)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 10)
                    .background(tacticalYellow)
                    .cornerRadius(6)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(16)
        .background(obsidianCard)
        .cornerRadius(12)
    }

    private var dispatchZeroYieldCard: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("DISPATCH ZERO YIELD")
                    .font(.system(size: 10, weight: .black, design: .monospaced))
                    .foregroundColor(.gray)
                Text("$232.10/HR")
                    .font(.system(size: 22, weight: .heavy, design: .monospaced))
                    .foregroundColor(tacticalYellow)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("LEGAL DUTY REMAINING")
                    .font(.system(size: 10, weight: .black, design: .monospaced))
                    .foregroundColor(.gray)
                Text("7H 45M")
                    .font(.system(size: 16, weight: .heavy))
                    .foregroundColor(emeraldGreen)
            }
        }
        .padding(16)
        .background(obsidianCard)
        .cornerRadius(12)
    }

    private var vehicleProfileRibbon: some View {
        HStack(spacing: 12) {
            ribbonItem(label: "HEIGHT", value: "\(selectedProfile.heightFt)'")
            ribbonItem(label: "WEIGHT", value: "\(Int(selectedProfile.weightLbs / 1000))k lbs")
            ribbonItem(label: "AXLES", value: "\(selectedProfile.axles)")
            ribbonItem(label: "UNIT", value: selectedProfile.unitNumber)
        }
        .padding(12)
        .background(obsidianCard)
        .cornerRadius(8)
    }

    private func ribbonItem(label: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.system(size: 9, weight: .bold))
                .foregroundColor(.gray)
            Text(value)
                .font(.system(size: 13, weight: .heavy, design: .monospaced))
                .foregroundColor(.white)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Actions
    private func performPlaceAutocomplete(query: String) {
        guard query.count >= 2 else {
            self.suggestions = []
            return
        }
        Task {
            let results = (try? await RoutingClient.shared.searchPlaces(query: query)) ?? []
            await MainActor.run {
                self.suggestions = results
            }
        }
    }

    private func selectDestination(_ place: PlaceSuggestion) {
        self.searchQuery = place.name
        self.suggestions = []
        startRouteCalculation(destinationCoords: place.coords ?? RouteCoordinate(lat: 39.768, lon: -86.158))
    }

    private func startDemoCorridor() {
        startRouteCalculation(destinationCoords: RouteCoordinate(lat: 39.7684, lon: -86.1581))
    }

    private func startRouteCalculation(destinationCoords: RouteCoordinate) {
        navManager.navigationState = .calculating
        Task {
            do {
                let origin = RouteCoordinate(lat: 38.6270, lon: -90.1994) // St. Louis
                let route = try await RoutingClient.shared.calculateRoute(
                    origin: origin,
                    destination: destinationCoords,
                    profile: selectedProfile
                )
                await MainActor.run {
                    navManager.startNavigation(route: route, profile: selectedProfile, destination: destinationCoords)
                }
            } catch {
                print("Failed to dispatch route: \(error.localizedDescription)")
                await MainActor.run {
                    navManager.navigationState = .idle
                }
            }
        }
    }
}
