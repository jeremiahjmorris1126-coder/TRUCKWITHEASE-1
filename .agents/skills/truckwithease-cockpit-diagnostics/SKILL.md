---
name: truckwithease-cockpit-diagnostics
description: >-
  Provides procedures for testing, developing, and auditing TruckWithEase cockpit components,
  including FHWA Item 54B Low-Bridge Radar HUD, Dispatch Zero $/Hr yield calculations,
  J1939 ECU Master Mechanic diagnostics, and black-and-yellow UI design adherence.
---

# TruckWithEase Cockpit Diagnostics Runbook

Use this skill when modifying or auditing TruckWithEase cockpit displays, low-bridge radar feeds, J1939 ECU diagnostics, or Dispatch Zero yield cards.

## 1. Low-Bridge Radar HUD (FHWA Item 54B)
- When updating bridge clearance algorithms, verify that structures with vertical clearance under 174" trigger the critical clearance alert box (`13' 6" CLEARANCE // 0" BUFFER DELTA`).
- Ensure the dynamic diverter routing can execute alternate paths via secondary bypass corridors (e.g. Loop 820 North).
- Verify twin CTA buttons: `>> EXECUTE BYPASS DIVERTER` and `PRIORITY DISPATCH` both use `#FFE500` yellow with black bold text.

## 2. The Master Mechanic
- When working on powertrain diagnostics:
  - Verify J1939 CAN-Bus Baud Rate is configured at 250 kbps / 10Hz ECM.
  - Verify SPN / FMI fault decoders correctly flag severity levels (CRITICAL, ADVISORY, NOMINAL).
  - Ensure the Virtual Kingpin Hitch Articulation slider detects jackknife risks above 48 degrees.

## 3. Dispatch Zero ($/Hr Yield)
- Ensure all freight load cards display revenue per legal duty hour formatted as `$XXX.XX/Hr` in `#FFE500`.
- Verify the `✔ VERIFIED` emerald pill and `⚡ ONE-CLICK QUANTUM DISPATCH` CTA buttons.
