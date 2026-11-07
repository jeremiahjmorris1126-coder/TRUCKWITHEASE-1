/**
 * TruckWithEase // Feature Flags
 *
 * Fuel/insurance partners and Twilio telephony stay flagged OFF.
 * All unrequested third-party integrations and unverified features are deleted.
 */

export interface FeatureFlags {
  // Fuel Discounts & Trucking Insurance Partners (flagged OFF)
  ENABLE_THIRD_PARTY_PARTNERS: boolean;

  // Telephony (flagged OFF)
  ENABLE_TWILIO_TELEPHONY: boolean;
}

export const FEATURE_FLAGS: FeatureFlags = {
  ENABLE_THIRD_PARTY_PARTNERS: false,
  ENABLE_TWILIO_TELEPHONY: false,
};

// Application flags
export const ENABLE_UNVERIFIED_HOS_CLOCKS: boolean = false;
export const ENABLE_ONE_TAP_DVIR: boolean = true;
export const ENABLE_TELEMETRY_10HZ: boolean = false;
export const ENABLE_BLUETOOTH_ELD: boolean = false;
export const ENABLE_HAPTICS_SCREEN: boolean = false;
export const ENABLE_MASTER_SYNC: boolean = false;
export const ENABLE_DEV_SAMPLE_DATA: boolean = false;
