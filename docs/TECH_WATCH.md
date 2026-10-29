# TruckWithEase Technical Watch & Deprecation Register

This document tracks official vendor deprecation notices, API sunsets, breaking SDK upgrades, and security advisories per TruckWithEase Standing Directives.

---

## Active Watch Items

| Date Recorded | Affected File / Dependency | Vendor / System | Advisory / Notice | Resolution Deadline |
| :--- | :--- | :--- | :--- | :--- |
| 2026-10-26 | `package.json` (`express` > `body-parser` < 1.20.9) | Express.js / Node | [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828) - Trailing bytes compression DoS. Resolved in `express@4.21.3+`. | Prior to Production Deploy |
| 2026-10-26 | `package.json` (`@grpc/grpc-js` < 1.13.6) | Google Cloud / gRPC | [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j) - `getAuthContext` certificate handling. | Transitive update via `@google-cloud/firestore` |
| 2026-10-26 | `server/telephony/telephonyService.ts` | Twilio Voice | Twilio Programmable Voice SDK legacy token formats deprecated in favor of official `AccessToken` with `VoiceGrant`. | Q4 2026 |
| 2026-10-26 | `server/routing/adapters/trimbleProvider.ts` | Trimble Maps | PC*MILER Windows native DLL (C/C++ PCMS* functions) sunset for cloud deployments. Mandatory migration to PC*MILER REST Web Services (`https://pcmiler.alk.com/apis/rest/v1.0`). | Complete (REST adapter implemented) |
| 2026-10-26 | `server/routing/adapters/googlePlacesProvider.ts` | Google Maps Platform | Google Places API (New) migration requirements. Ensure legacy place IDs transition to Places API (New) field masks. | Ongoing |
