import Foundation

#if canImport(TomTomSDKRoute)
import TomTomSDKRoute
#endif

/// Commercial vehicle physical profile adhering to FHWA & FMCSA standards
public struct TruckProfile: Codable, Equatable {
    public var heightFt: Double
    public var weightLbs: Double
    public var lengthFt: Double
    public var widthFt: Double
    public var axles: Int
    public var hazmatClass: String?
    public var avoidTolls: Bool
    public var unitNumber: String

    public init(
        heightFt: Double = 13.5,
        weightLbs: Double = 80000.0,
        lengthFt: Double = 70.0,
        widthFt: Double = 8.5,
        axles: Int = 5,
        hazmatClass: String? = nil,
        avoidTolls: Bool = false,
        unitNumber: String = "TRACTOR-01"
    ) {
        self.heightFt = heightFt
        self.weightLbs = weightLbs
        self.lengthFt = lengthFt
        self.widthFt = widthFt
        self.axles = axles
        self.hazmatClass = hazmatClass
        self.avoidTolls = avoidTolls
        self.unitNumber = unitNumber
    }

    // MARK: - Metric Conversions for TomTom Navigation SDK
    public var heightMeters: Double { heightFt * 0.3048 }
    public var weightKilograms: Double { weightLbs * 0.453592 }
    public var lengthMeters: Double { lengthFt * 0.3048 }
    public var widthMeters: Double { widthFt * 0.3048 }

    #if canImport(TomTomSDKRoute)
    /// Converts the profile into a native TomTom SDK Truck Vehicle object
    public func toTomTomVehicle() -> Vehicle {
        let dimensions = VehicleDimensions(
            length: Measurement(value: lengthMeters, unit: .meters),
            width: Measurement(value: widthMeters, unit: .meters),
            height: Measurement(value: heightMeters, unit: .meters),
            weight: Measurement(value: weightKilograms, unit: .kilograms),
            numberOfAxles: axles,
            weightPerAxle: Measurement(value: weightKilograms / Double(max(1, axles)), unit: .kilograms)
        )

        var hazmatTypes: [HazardousMaterial] = []
        if let haz = hazmatClass?.lowercased() {
            if haz.contains("explosive") || haz.contains("class 1") {
                hazmatTypes.append(.explosive)
            } else if haz.contains("gas") || haz.contains("class 2") {
                hazmatTypes.append(.gas)
            } else if haz.contains("flammable") || haz.contains("class 3") {
                hazmatTypes.append(.flammableLiquid)
            } else if haz.contains("corrosive") || haz.contains("class 8") {
                hazmatTypes.append(.corrosive)
            } else if haz.contains("radioactive") || haz.contains("class 7") {
                hazmatTypes.append(.radioactive)
            } else {
                hazmatTypes.append(.general)
            }
        }

        return Vehicle.truck(
            dimensions: dimensions,
            hazardousMaterials: hazmatTypes,
            commercial: true
        )
    }
    #endif
}
