import SwiftUI

#if canImport(FirebaseCore)
import FirebaseCore
#endif

@main
public struct TruckWithEaseApp: App {
    public init() {
        #if canImport(FirebaseCore)
        FirebaseApp.configure()
        #endif
        // Request navigation and background location permissions on launch
        TomTomNavigationManager.shared.requestPermissions()
    }

    public var body: some Scene {
        WindowGroup {
            NavigationHUDView()
        }
    }
}
