import Foundation
import CoreLocation

#if canImport(FirebaseAuth)
import FirebaseAuth
#endif

public enum RoutingClientError: LocalizedError {
    case unauthenticated
    case invalidResponse(statusCode: Int, message: String)
    case networkFailure(Error)
    case decodingError(Error)

    public var errorDescription: String? {
        switch self {
        case .unauthenticated:
            return "User is not authenticated with Firebase. Sign in required."
        case .invalidResponse(let statusCode, let message):
            return "Routing server returned HTTP \(statusCode): \(message)"
        case .networkFailure(let err):
            return "Network connection failed: \(err.localizedDescription)"
        case .decodingError(let err):
            return "Failed to parse route response: \(err.localizedDescription)"
        }
    }
}

public class RoutingClient: ObservableObject {
    public static let shared = RoutingClient()

    #if DEBUG
    public var baseURL = URL(string: "http://localhost:8080")!
    #else
    public var baseURL = URL(string: "https://truckwithease.com")!
    #endif

    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    /// Fetches the Firebase Auth ID Token for authenticated API calls
    private func getIdToken() async throws -> String? {
        #if canImport(FirebaseAuth)
        guard let user = Auth.auth().currentUser else {
            return nil
        }
        return try await user.getIDToken()
        #else
        return nil
        #endif
    }

    /// Requests a legal commercial truck route from backend Trimble PC*MILER (with TomTom fallback)
    public func calculateRoute(
        origin: RouteCoordinate,
        destination: RouteCoordinate,
        waypoints: [RouteCoordinate] = [],
        profile: TruckProfile,
        avoidTolls: Bool = false
    ) async throws -> NormalizedRoute {
        let endpoint = baseURL.appendingPathComponent("v1/routing/calculate")
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = try await getIdToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let payload: [String: Any] = [
            "origin": [
                "coords": ["lat": origin.lat, "lon": origin.lon],
                "label": "Origin",
            ],
            "destination": [
                "coords": ["lat": destination.lat, "lon": destination.lon],
                "label": "Destination",
            ],
            "waypoints": waypoints.map { wp in
                ["coords": ["lat": wp.lat, "lon": wp.lon]]
            },
            "vehicleProfile": [
                "heightFt": profile.heightFt,
                "weightLbs": profile.weightLbs,
                "lengthFt": profile.lengthFt,
                "widthFt": profile.widthFt,
                "axles": profile.axles,
                "hazmatClass": profile.hazmatClass as Any,
                "avoidTolls": avoidTolls || profile.avoidTolls,
            ],
            "options": [
                "optimizeWaypoints": true,
                "includeBridgeAlerts": true,
            ],
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw RoutingClientError.invalidResponse(statusCode: 0, message: "Non-HTTP response")
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMsg = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String ?? "Unknown error"
            throw RoutingClientError.invalidResponse(statusCode: httpResponse.statusCode, message: errorMsg)
        }

        do {
            let decoder = JSONDecoder()
            return try decoder.decode(NormalizedRoute.self, from: data)
        } catch {
            throw RoutingClientError.decodingError(error)
        }
    }

    /// Autocompletes places / freight terminals using Google Places via backend proxy
    public func searchPlaces(query: String, bias: RouteCoordinate? = nil) async throws -> [PlaceSuggestion] {
        var components = URLComponents(url: baseURL.appendingPathComponent("v1/routing/places/autocomplete"), resolvingAgainstBaseURL: true)!
        var queryItems = [URLQueryItem(name: "input", value: query)]
        if let bias = bias {
            queryItems.append(URLQueryItem(name: "lat", value: "\(bias.lat)"))
            queryItems.append(URLQueryItem(name: "lon", value: "\(bias.lon)"))
        }
        components.queryItems = queryItems

        var request = URLRequest(url: components.url!)
        request.httpMethod = "GET"

        if let token = try await getIdToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            return []
        }

        return (try? JSONDecoder().decode([PlaceSuggestion].self, from: data)) ?? []
    }
}
