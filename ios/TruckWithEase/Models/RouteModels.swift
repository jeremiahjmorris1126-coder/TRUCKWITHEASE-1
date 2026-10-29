import Foundation
import CoreLocation

public struct RouteCoordinate: Codable, Equatable {
    public let lat: Double
    public let lon: Double

    public init(lat: Double, lon: Double) {
        self.lat = lat
        self.lon = lon
    }

    public var clLocationCoordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }
}

public struct BridgeClearanceWarning: Codable, Identifiable, Equatable {
    public var id: String { "\(lat)_\(lon)_\(clearanceInches)" }
    public let lat: Double
    public let lon: Double
    public let clearanceFt: Double
    public let clearanceInches: Int
    public let road: String
    public let description: String
    public let deltaInches: Int?
    public let severity: String // "CRITICAL", "WARNING", "CAUTION"
}

public struct NormalizedRoute: Codable, Equatable {
    public let totalDistanceMiles: Double
    public let totalTimeMinutes: Double
    public let provider: String // "trimble" | "tomtom" | "mock"
    public let fallbackTriggered: Bool
    public let tollDistanceMiles: Double?
    public let estimatedTollCostUsd: Double?
    public let bridgeClearanceWarnings: [BridgeClearanceWarning]
    public let geometry: RouteGeometry?
    public let cached: Bool

    public struct RouteGeometry: Codable, Equatable {
        public let type: String
        public let coordinates: [[Double]] // [lon, lat] pairs per GeoJSON
    }

    public var polylineCoordinates: [CLLocationCoordinate2D] {
        guard let coords = geometry?.coordinates else { return [] }
        return coords.compactMap { pair in
            guard pair.count >= 2 else { return nil }
            return CLLocationCoordinate2D(latitude: pair[1], longitude: pair[0])
        }
    }
}

public struct PlaceSuggestion: Codable, Identifiable, Equatable {
    public let id: String
    public let name: String
    public let formattedAddress: String
    public let coords: RouteCoordinate?

    enum CodingKeys: String, CodingKey {
        case id = "placeId"
        case name
        case formattedAddress
        case coords
    }
}
