// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "TruckWithEase",
    defaultLocalization: "en",
    platforms: [
        .iOS(.v16)
    ],
    products: [
        .library(
            name: "TruckWithEaseCore",
            targets: ["TruckWithEaseCore"]
        ),
    ],
    dependencies: [
        // TomTom Navigation SDK for iOS (SPM)
        .package(
            url: "https://github.com/tomtom-international/tomtom-sdk-spm-navigation",
            from: "0.73.0"
        ),
        // Firebase iOS SDK for Authentication & Telemetry
        .package(
            url: "https://github.com/firebase/firebase-ios-sdk",
            from: "10.20.0"
        ),
    ],
    targets: [
        .target(
            name: "TruckWithEaseCore",
            dependencies: [
                .product(name: "TomTomSDKNavigation", package: "tomtom-sdk-spm-navigation"),
                .product(name: "TomTomSDKMapDisplay", package: "tomtom-sdk-spm-navigation"),
                .product(name: "TomTomSDKRoute", package: "tomtom-sdk-spm-navigation"),
                .product(name: "TomTomSDKLocationProvider", package: "tomtom-sdk-spm-navigation"),
                .product(name: "FirebaseAuth", package: "firebase-ios-sdk"),
                .product(name: "FirebaseFirestore", package: "firebase-ios-sdk"),
            ],
            path: "TruckWithEase"
        ),
        .testTarget(
            name: "TruckWithEaseTests",
            dependencies: ["TruckWithEaseCore"],
            path: "TruckWithEaseTests"
        ),
    ]
)
