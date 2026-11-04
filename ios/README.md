# TruckWithEase iOS Native Navigation

Native iOS commercial truck navigation application built in Swift and SwiftUI, integrating:

- **Backend Routing**: Cloud Run `/v1/routing/calculate` using Trimble Maps PC*MILER (with TomTom server fallback).
- **On-Device Navigation**: TomTom Navigation SDK for iOS (`TomTomSDKNavigation`, `TomTomSDKMapDisplay`, `TomTomSDKRoute`).
- **Search & POI Autocomplete**: Google Places Platform (address lookup only; zero truck routing).
- **Design System**: Deep Obsidian (`#05080E`) and Tactical Safety Yellow (`#FFE500`).

---

## 1. Prerequisites & Installation

- **macOS Sonoma / Sequoia** with **Xcode 15.0+** or **Xcode 16.0+**.
- **Minimum Deployment Target**: iOS 16.0+.
- **Bundle Identifier**: `com.truckwithease.app`.

### Swift Package Manager (SPM) Setup

1. Open Xcode and select **File > Open**, navigating to the `ios/` folder or open `Package.swift`.
2. Xcode will automatically resolve the SPM dependencies:
   - `https://github.com/tomtom-international/tomtom-sdk-spm-navigation` (`0.73.0+`)
   - `https://github.com/firebase/firebase-ios-sdk` (`10.20.0+`)

---

## 2. API Key Boundary & Security Architecture

| Provider | Purpose | Where Key Lives | Key Restriction Mechanism |
| :--- | :--- | :--- | :--- |
| **Trimble Maps** | Primary legal truck routing & bridge radar | **Backend Only** (Secret Manager) | Never bundled in client; Cloud Run IP restriction. |
| **Google Maps Platform** | Address & place autocomplete | **Backend Only** (Secret Manager) | Never bundled in client; Cloud Run service restriction. |
| **TomTom** | On-device map rendering & turn-by-turn | **Bundled in Client** (`TomTomConfiguration.plist`) | **Restricted by iOS Bundle ID** (`com.truckwithease.app`) in TomTom Developer Portal. |
| **Firebase** | Driver Auth & Firestore Sync | **Bundled in Client** (`GoogleService-Info.plist`) | Restricted by App Store Team ID & Bundle ID. |

### Adding TomTom Key to iOS Project

Create `TomTomConfiguration.plist` under `ios/TruckWithEase/` with:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>TomTomAPIKey</key>
    <string>YOUR_TOMTOM_KEY_RESTRICTED_TO_BUNDLE_ID</string>
</dict>
</plist>
```

---

## 3. Rerouting Architecture

The iOS client utilizes a **Dual-Tier Reroute Strategy**:

1. **Immediate Tactical Return (On-Device TomTom)**: Fires via `NavigationDelegate.didDetectDeviation` within 200ms using local vector tiles to prevent driver confusion or dead-reckoning lag.
2. **Strategic Corridor Validation (Backend Trimble PC*MILER)**: Simultaneously invokes `/v1/routing/calculate` to verify the new corridor is cleared for Class 8 commercial vehicles (height, gross weight, hazmat, bridges).

---

## 4. App Store Review Guidelines & Disclosures

### Required Entitlements

- **Background Modes (`UIBackgroundModes`)**:
  - `location`: For continuous commercial vehicle turn-by-turn guidance and low bridge proximity radar while the driver screen is locked or running ELD logging.
  - `audio`: For audible maneuver and critical collision alert prompts over Bluetooth and cab speakers.

### App Store Reviewer Note Template

```text
TruckWithEase is an enterprise navigation app specifically designed for heavy commercial motor vehicles (Class 7/8 tractor-trailers). 
It requires continuous background location access to provide voice-guided turn-by-turn instructions and critical low-clearance bridge radar warnings to avoid catastrophic overhead collisions while the device screen is dimmed or during mandatory Hours of Service (HOS) ELD logging.
A test account with pre-configured Trimble commercial corridors is available under Demo Driver (demo@truckwithease.com).
```
