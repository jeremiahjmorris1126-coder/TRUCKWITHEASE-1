# The Master Mechanic Domain & Architecture Guidelines

This rule governs the implementation and maintenance of the Master Mechanic module in TruckWithEase.

## Background & Replacement Context
- "The G.O.A.T." has been removed from TruckWithEase and replaced with **THE MASTER MECHANIC**.
- Never revert navigation, voice commands, or customizers back to "The G.O.A.T.".

## Core Capabilities of The Master Mechanic
1. **J1939 ECU & CAN-Bus DTC Scanner**:
   - Decodes Suspect Parameter Numbers (SPN) and Failure Mode Identifiers (FMI).
   - Provides clear remediation advice for aftertreatment (DPF/DEF), thermal cooling, air brake pressure, and turbochargers.
   - Provides one-click cryptographic fault clearing.
2. **Component Health Radar**:
   - Real-time gauges for oil pressure, coolant temp, boost pressure, brake pad lining depth, and battery voltage.
3. **Kingpin Articulation Sentinel**:
   - Monitored articulation angle between tractor fifth-wheel and trailer kingpin.
   - Triggers `DANGER: JACKKNIFE THRESHOLD` when absolute angle exceeds 48 degrees.
4. **Mobile Repair Dispatch**:
   - Integrated with 24/7 heavy duty repair shops and road service trucks.
   - Facilitates electronic DVIR certification under 49 CFR § 396.11.
