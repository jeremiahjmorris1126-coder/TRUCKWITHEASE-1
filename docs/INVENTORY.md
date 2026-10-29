# TruckWithEase System Inventory & Route Security Matrix

Generated on: 2026-10-26T22:26:49.142Z  
Repository: `jeremiahjmorris1126-coder/TRUCKWITHEASE-1`  
Environment: Google Cloud Run (`truckwithease-1`), Firestore Native (`app-builder-38a26d99`)

---

## 1. Public Routes (No Authentication)

The following routes execute without authentication. Every public route has a documented architectural reason:

| Method | Full Route Path | File & Line | Rate Limit | Purpose & Public Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/health` | [`server.ts:106`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L106) | None (Bypasses limiter) | **Google Cloud Run Liveness & Health Probe**: Required by GCP Cloud Run, Cloud Load Balancing, and container orchestration to verify instance health. Returns `{"ok":true}` with zero diagnostic leakage. |
| **GET** | `/healthz` | [`detention-proof/src/server.js:45`](file:///c:/Users/truck/TRUCKWITHEASE-1/detention-proof/src/server.js#L45) | None | **Detention Microservice Liveness Probe**: Container health probe for the isolated detention-proof Cloud Run service instance. |
| **GET** | `*` | [`server.ts:1236`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L1236) | None | **Single Page Application (SPA) Static Asset Fallback**: Serves compiled frontend assets (`dist/index.html`, `dist/assets/*`) to public web clients before user login. |

---

## 2. Complete Server Route Matrix (TESTED EMPIRICALLY)

*Security columns are populated exclusively with empirical test results against test fleets FLEET1 and FLEET2. Any route not directly executed in the test run is marked UNTESTED.*

| Method | Full Route Path | File & Line | Tested: No Token | Tested: Driver FLEET1 | Tested: Admin FLEET1 | Tested: Owner | Tested: Other Fleet (FLEET2) | Cross-Tenant Leak? |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **GET** | `/health` | [`server.ts:106`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L106) | 200 | 200 | 200 | 200 | 200 | Clean |
| **GET** | `/api/health` | [`server.ts:291`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L291) | 401 | 403 | 403 | 403 | 403 | Clean |
| **GET** | `/api/ready` | [`server.ts:333`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L333) | 401 | 200 | 200 | 200 | 200 | Clean |
| **GET** | `/v1/routing/status` | [`server.ts:346`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L346) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **GET** | `/api/routing/status` | [`server.ts:346`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L346) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **POST** | `/v1/routing/calculate` | [`server.ts:355`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L355) | 401 | 200 | 200 | 200 | 200 | Clean |
| **POST** | `/api/routing/calculate` | [`server.ts:355`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L355) | 401 | 200 | 200 | 200 | 200 | Clean |
| **POST** | `/v1/routing/mileage` | [`server.ts:401`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L401) | 401 | 200 | 200 | 200 | 200 | Clean |
| **POST** | `/api/routing/mileage` | [`server.ts:401`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L401) | 401 | 200 | 200 | 200 | 200 | Clean |
| **GET** | `/v1/routing/geocode` | [`server.ts:420`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L420) | 401 | 200 | 200 | 200 | 200 | Clean |
| **GET** | `/api/routing/geocode` | [`server.ts:420`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L420) | 401 | 200 | 200 | 200 | 200 | Clean |
| **GET** | `/v1/routing/vehicle-profile` | [`server.ts:435`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L435) | 401 | 200 | 200 | 200 | 200 | Clean |
| **GET** | `/api/routing/vehicle-profile` | [`server.ts:435`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L435) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **POST** | `/v1/routing/vehicle-profile` | [`server.ts:455`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L455) | 401 | 201 | 201 | 201 | 201 | Clean |
| **POST** | `/api/routing/vehicle-profile` | [`server.ts:455`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L455) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **GET** | `/api/telematics/vehicles` | [`server.ts:485`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L485) | 401 | 200 | 200 | 200 | 200 | Clean |
| **GET** | `/api/telematics/vehicles/:id` | [`server.ts:494`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L494) | 401 | 404 | 404 | 404 | 404 | Clean |
| **GET** | `/api/telematics/drivers` | [`server.ts:506`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L506) | 401 | 200 | 200 | 200 | 200 | Clean |
| **POST** | `/api/telematics/idle-alert` | [`server.ts:515`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L515) | 401 | 400 | 429 | 429 | 429 | Clean |
| **GET** | `/api/alerts/active` | [`server.ts:536`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L536) | 401 | 200 | 200 | 200 | 200 | **🚨 LEAK CONFIRMED!** |
| **GET** | `/api/alerts/all` | [`server.ts:545`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L545) | 401 | 200 | 200 | 200 | 200 | **🚨 LEAK CONFIRMED!** |
| **POST** | `/api/alerts/trigger` | [`server.ts:554`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L554) | 401 | 201 | 201 | 201 | 201 | Clean |
| **POST** | `/api/alerts/:id/resolve` | [`server.ts:578`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L578) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **GET** | `/api/loads` | [`server.ts:591`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L591) | 401 | 200 | 200 | 200 | 200 | **🚨 LEAK CONFIRMED!** |
| **POST** | `/api/loads` | [`server.ts:601`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L601) | 401 | 201 | 201 | 201 | 201 | Clean |
| **GET** | `/api/loads/matched` | [`server.ts:610`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L610) | 401 | 200 | 200 | 200 | 200 | Clean |
| **POST** | `/api/loads/:id/dispatch` | [`server.ts:620`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L620) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **GET** | `/api/driver/profile` | [`server.ts:635`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L635) | 401 | 200 | 200 | 200 | 200 | Clean |
| **PUT** | `/api/driver/profile` | [`server.ts:655`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L655) | 401 | 200 | 200 | 200 | 200 | Clean |
| **GET** | `/api/driver/documents` | [`server.ts:675`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L675) | 401 | 200 | 200 | 200 | 200 | Clean |
| **POST** | `/api/driver/documents` | [`server.ts:695`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L695) | 401 | 201 | 201 | 201 | 201 | Clean |
| **GET** | `/api/perks/fuel-discounts` | [`server.ts:714`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L714) | 401 | 200 | 200 | 200 | 200 | Clean |
| **GET** | `/api/insurance/quotes` | [`server.ts:718`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L718) | 401 | 200 | 200 | 200 | 200 | Clean |
| **GET** | `/v1/offers/fuel` | [`server.ts:724`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L724) | 401 | 400 | 400 | 400 | 400 | Clean |
| **GET** | `/api/v1/offers/fuel` | [`server.ts:724`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L724) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **POST** | `/v1/insurance/quotes` | [`server.ts:745`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L745) | 401 | 400 | 400 | 400 | 400 | Clean |
| **POST** | `/api/v1/insurance/quotes` | [`server.ts:745`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L745) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **POST** | `/v1/routing/calculate` | [`server.ts:782`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L782) | 401 | 200 | 200 | 200 | 200 | Clean |
| **POST** | `/api/routing/calculate` | [`server.ts:782`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L782) | 401 | 200 | 200 | 200 | 200 | Clean |
| **POST** | `/v1/routing/mileage` | [`server.ts:807`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L807) | 401 | 200 | 200 | 200 | 200 | Clean |
| **POST** | `/api/routing/mileage` | [`server.ts:807`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L807) | 401 | 200 | 200 | 200 | 200 | Clean |
| **GET** | `/v1/routing/geocode` | [`server.ts:832`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L832) | 401 | 200 | 200 | 200 | 200 | Clean |
| **GET** | `/api/routing/geocode` | [`server.ts:832`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L832) | 401 | 200 | 200 | 200 | 200 | Clean |
| **GET** | `/v1/routing/places/autocomplete` | [`server.ts:846`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L846) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **GET** | `/api/routing/places/autocomplete` | [`server.ts:846`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L846) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **GET** | `/v1/routing/vehicle-profile` | [`server.ts:864`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L864) | 401 | 200 | 200 | 200 | 200 | Clean |
| **GET** | `/api/routing/vehicle-profile` | [`server.ts:864`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L864) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **PUT** | `/v1/routing/vehicle-profile` | [`server.ts:878`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L878) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **PUT** | `/api/routing/vehicle-profile` | [`server.ts:878`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L878) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **GET** | `/api/health` | [`server.ts:893`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L893) | 401 | 403 | 403 | 403 | 403 | Clean |
| **GET** | `/health/diagnostic` | [`server.ts:893`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L893) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **GET** | `/api/telephony/status` | [`server.ts:911`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L911) | 401 | 200 | 200 | 200 | 200 | Clean |
| **POST** | `/api/telephony/call-session` | [`server.ts:915`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L915) | 401 | 201 | 201 | 201 | 201 | Clean |
| **POST** | `/api/telephony/provision-line` | [`server.ts:921`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L921) | 401 | 201 | 201 | 201 | 201 | Clean |
| **GET** | `/token` | [`server.ts:928`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L928) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **GET** | `/api/telephony/token` | [`server.ts:928`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L928) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **POST** | `/voice` | [`server.ts:935`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L935) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **POST** | `/api/telephony/voice` | [`server.ts:935`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L935) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **GET** | `/api/auth/roles` | [`server.ts:944`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L944) | 401 | 200 | 200 | 200 | 200 | Clean |
| **GET** | `/api/auth/users` | [`server.ts:948`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L948) | 401 | 200 | 200 | 200 | 200 | Clean |
| **GET** | `/api/auth/tenant` | [`server.ts:952`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L952) | 401 | 200 | 200 | 200 | 200 | Clean |
| **POST** | `/api/auth/login` | [`server.ts:960`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L960) | 401 | 200 | 200 | 200 | 200 | Clean |
| **GET** | `/api/admin/logs` | [`server.ts:970`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L970) | 401 | 200 | 200 | 200 | 200 | **🚨 LEAK CONFIRMED!** |
| **GET** | `/api/admin/integrations` | [`server.ts:974`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L974) | 401 | 200 | 200 | 200 | 200 | Clean |
| **POST** | `/api/memory/track` | [`server.ts:982`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L982) | 401 | 200 | 200 | 200 | 200 | Clean |
| **GET** | `/api/memory/stats` | [`server.ts:1026`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L1026) | 401 | 200 | 200 | 200 | 200 | Clean |
| **POST** | `/api/memory/apply-optimization` | [`server.ts:1054`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L1054) | 401 | 200 | 200 | 200 | 200 | Clean |
| **POST** | `/api/predictive/resolve-states` | [`server.ts:1067`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L1067) | 401 | 200 | 200 | 200 | 200 | Clean |
| **POST** | `/api/predictive/anneal` | [`server.ts:1083`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L1083) | 401 | 200 | 200 | 200 | 200 | Clean |
| **POST** | `/api/quantum/telemetry-physics` | [`server.ts:1097`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L1097) | 401 | 200 | 200 | 200 | 200 | Clean |
| **POST** | `/api/quantum/hos-optimizer` | [`server.ts:1113`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L1113) | 401 | 200 | 200 | 200 | 200 | Clean |
| **GET** | `/api/quantum/all-functions` | [`server.ts:1126`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L1126) | 401 | 200 | 200 | 200 | 200 | Clean |
| **GET** | `/api/weather/regional-hazards` | [`server.ts:1140`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L1140) | 401 | 200 | 200 | 200 | 200 | Clean |
| **POST** | `/api/weather/regional-hazards` | [`server.ts:1153`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L1153) | 401 | 200 | 200 | 200 | 200 | Clean |
| **POST** | `/api/messages` | [`server.ts:1164`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L1164) | 401 | 201 | 201 | 201 | 201 | Clean |
| **POST** | `/api/dispatch-messages` | [`server.ts:1173`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L1173) | 401 | 503 | 429 | 429 | 429 | Clean |
| **POST** | `/api/dispatch-loop/alert` | [`server.ts:1187`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L1187) | 401 | 503 | 429 | 429 | 429 | Clean |
| **GET** | `/api/export-cloudflare-github/status` | [`server.ts:1200`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L1200) | 401 | 200 | 200 | 200 | 200 | Clean |
| **GET** | `*` | [`server.ts:1236`](file:///c:/Users/truck/TRUCKWITHEASE-1/server.ts#L1236) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **GET** | `/healthz` | [`detention-proof/src/server.js:45`](file:///c:/Users/truck/TRUCKWITHEASE-1/detention-proof/src/server.js#L45) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **POST** | `/v1/stops` | [`detention-proof/src/server.js:53`](file:///c:/Users/truck/TRUCKWITHEASE-1/detention-proof/src/server.js#L53) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **POST** | `/v1/vehicles/:id/events` | [`detention-proof/src/server.js:67`](file:///c:/Users/truck/TRUCKWITHEASE-1/detention-proof/src/server.js#L67) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **GET** | `/v1/vehicles/:id/status` | [`detention-proof/src/server.js:74`](file:///c:/Users/truck/TRUCKWITHEASE-1/detention-proof/src/server.js#L74) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **POST** | `/v1/vehicles/:id/finalize` | [`detention-proof/src/server.js:78`](file:///c:/Users/truck/TRUCKWITHEASE-1/detention-proof/src/server.js#L78) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **GET** | `/v1/packets/:loadId/:stopId` | [`detention-proof/src/server.js:86`](file:///c:/Users/truck/TRUCKWITHEASE-1/detention-proof/src/server.js#L86) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| **POST** | `/v1/verify` | [`detention-proof/src/server.js:92`](file:///c:/Users/truck/TRUCKWITHEASE-1/detention-proof/src/server.js#L92) | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |

---

## 3. Firestore Collections Matrix

| Collection Name | Declared in `firestore.rules`? | Access Method(s) | Reading File(s) | Writing File(s) | Status & Fleet Isolation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `detentionActiveStops` | ❌ NO (Missing in rules) | `collection()` | [`detention-proof/src/store.js:31`](file:///c:/Users/truck/TRUCKWITHEASE-1/detention-proof/src/store.js#L31) | None | ⚠️ **DEFAULT DENY**: Missing rule block; client SDK reads/writes blocked! |
| `detentionEvents` | ❌ NO (Missing in rules) | `collection()` | [`detention-proof/src/store.js:32`](file:///c:/Users/truck/TRUCKWITHEASE-1/detention-proof/src/store.js#L32) | None | ⚠️ **DEFAULT DENY**: Missing rule block; client SDK reads/writes blocked! |
| `detentionCursors` | ❌ NO (Missing in rules) | `collection()` | [`detention-proof/src/store.js:33`](file:///c:/Users/truck/TRUCKWITHEASE-1/detention-proof/src/store.js#L33) | None | ⚠️ **DEFAULT DENY**: Missing rule block; client SDK reads/writes blocked! |
| `aux_alerts` | ✅ YES | `saveDocument(), listCollection()` | [`server/alerts/alertEngine.ts:78`](file:///c:/Users/truck/TRUCKWITHEASE-1/server/alerts/alertEngine.ts#L78) | [`server/alerts/alertEngine.ts:68`](file:///c:/Users/truck/TRUCKWITHEASE-1/server/alerts/alertEngine.ts#L68), [`server/alerts/alertEngine.ts:95`](file:///c:/Users/truck/TRUCKWITHEASE-1/server/alerts/alertEngine.ts#L95) | Active |
| `fleet_api_keys` | ✅ YES | `COLLECTION_NAME` | [`server/auth/apiKeyService.ts:15`](file:///c:/Users/truck/TRUCKWITHEASE-1/server/auth/apiKeyService.ts#L15) | [`server/auth/apiKeyService.ts:15`](file:///c:/Users/truck/TRUCKWITHEASE-1/server/auth/apiKeyService.ts#L15) | Active |
| `users` | ✅ YES | `collection()` | [`server/auth/firebaseAuthService.ts:127`](file:///c:/Users/truck/TRUCKWITHEASE-1/server/auth/firebaseAuthService.ts#L127) | [`server/auth/firebaseAuthService.ts:180`](file:///c:/Users/truck/TRUCKWITHEASE-1/server/auth/firebaseAuthService.ts#L180) | Active |
| `driver_profiles` | ❌ NO (Missing in rules) | `getDocument(), saveDocument()` | [`server/driver/driverProfileService.ts:74`](file:///c:/Users/truck/TRUCKWITHEASE-1/server/driver/driverProfileService.ts#L74) | [`server/driver/driverProfileService.ts:81`](file:///c:/Users/truck/TRUCKWITHEASE-1/server/driver/driverProfileService.ts#L81) | ⚠️ **DEFAULT DENY**: Missing rule block; client SDK reads/writes blocked! |
| `driver_documents` | ✅ YES | `saveDocument()` | None | [`server/driver/driverProfileService.ts:96`](file:///c:/Users/truck/TRUCKWITHEASE-1/server/driver/driverProfileService.ts#L96) | Active |
| `system_health_probes` | ❌ NO (Missing in rules) | `collection()` | [`server/firestore.ts:67`](file:///c:/Users/truck/TRUCKWITHEASE-1/server/firestore.ts#L67) | None | ⚠️ **DEFAULT DENY**: Missing rule block; client SDK reads/writes blocked! |
| `freight_loads` | ❌ NO (Missing in rules) | `listCollection(), saveDocument()` | [`server/loadMatching/loadService.ts:85`](file:///c:/Users/truck/TRUCKWITHEASE-1/server/loadMatching/loadService.ts#L85) | [`server/loadMatching/loadService.ts:109`](file:///c:/Users/truck/TRUCKWITHEASE-1/server/loadMatching/loadService.ts#L109), [`server/loadMatching/loadService.ts:130`](file:///c:/Users/truck/TRUCKWITHEASE-1/server/loadMatching/loadService.ts#L130) | ⚠️ **COLLISION**: Backend writes `freight_loads`, but `firestore.rules` declares `/loads/{loadId}`! |
| `partner_cache` | ❌ NO (Missing in rules) | `getDocument(), saveDocument()` | [`server/partners/cache.ts:16`](file:///c:/Users/truck/TRUCKWITHEASE-1/server/partners/cache.ts#L16) | [`server/partners/cache.ts:40`](file:///c:/Users/truck/TRUCKWITHEASE-1/server/partners/cache.ts#L40), [`tests/backend.test.js:203`](file:///c:/Users/truck/TRUCKWITHEASE-1/tests/backend.test.js#L203) | ⚠️ **DEFAULT DENY**: Missing rule block; client SDK reads/writes blocked! |
| `vehicle_profiles` | ❌ NO (Missing in rules) | `collection()` | [`server/routing/vehicleProfileService.ts:93`](file:///c:/Users/truck/TRUCKWITHEASE-1/server/routing/vehicleProfileService.ts#L93) | [`server/routing/vehicleProfileService.ts:54`](file:///c:/Users/truck/TRUCKWITHEASE-1/server/routing/vehicleProfileService.ts#L54) | ⚠️ **DEFAULT DENY**: Missing rule block; client SDK reads/writes blocked! |

---

## 4. Frontend Route Call Mapping (`src/` $\to$ Backend)

| Frontend Component / File | Invoked Backend Endpoint | Code Snippet |
| :--- | :--- | :--- |
| [`src/services/driverDispatchLoopService.ts:489`](file:///c:/Users/truck/TRUCKWITHEASE-1/src/services/driverDispatchLoopService.ts#L489) | `/api/dispatch-loop/alert` | `const response = await fetch('/api/dispatch-loop/alert', {` |
| [`src/services/driverDispatchLoopService.ts:524`](file:///c:/Users/truck/TRUCKWITHEASE-1/src/services/driverDispatchLoopService.ts#L524) | `/api/messages` | `const response = await fetch('/api/messages', {` |
| [`src/services/liveDispatchMonitorService.ts:386`](file:///c:/Users/truck/TRUCKWITHEASE-1/src/services/liveDispatchMonitorService.ts#L386) | `/api/dispatch-messages` | `const response = await fetch('/api/dispatch-messages', {` |
| [`src/services/memoryPerformanceService.ts:97`](file:///c:/Users/truck/TRUCKWITHEASE-1/src/services/memoryPerformanceService.ts#L97) | `/api/memory/track` | `const res = await fetch('/api/memory/track', {` |
| [`src/services/memoryPerformanceService.ts:122`](file:///c:/Users/truck/TRUCKWITHEASE-1/src/services/memoryPerformanceService.ts#L122) | `/api/memory/stats` | `const res = await fetch('/api/memory/stats');` |
| [`src/services/memoryPerformanceService.ts:134`](file:///c:/Users/truck/TRUCKWITHEASE-1/src/services/memoryPerformanceService.ts#L134) | `/api/memory/apply-optimization` | `const res = await fetch('/api/memory/apply-optimization', {` |
| [`src/services/memoryPerformanceService.ts:150`](file:///c:/Users/truck/TRUCKWITHEASE-1/src/services/memoryPerformanceService.ts#L150) | `/api/memory/quantum-predictive-report` | `const res = await fetch('/api/memory/quantum-predictive-report', {` |
| [`src/services/memoryPerformanceService.ts:166`](file:///c:/Users/truck/TRUCKWITHEASE-1/src/services/memoryPerformanceService.ts#L166) | `/api/memory/quantum-predictive-report` | `const res = await fetch('/api/memory/quantum-predictive-report');` |
| [`src/services/quantumPredictiveService.ts:47`](file:///c:/Users/truck/TRUCKWITHEASE-1/src/services/quantumPredictiveService.ts#L47) | `/api/predictive/resolve-states` | `const res = await fetch('/api/predictive/resolve-states', {` |
| [`src/services/quantumPredictiveService.ts:63`](file:///c:/Users/truck/TRUCKWITHEASE-1/src/services/quantumPredictiveService.ts#L63) | `/api/predictive/anneal` | `const res = await fetch('/api/predictive/anneal', {` |
| [`src/services/quantumPredictiveService.ts:79`](file:///c:/Users/truck/TRUCKWITHEASE-1/src/services/quantumPredictiveService.ts#L79) | `/api/quantum/telemetry-physics` | `const res = await fetch('/api/quantum/telemetry-physics', {` |
| [`src/services/quantumPredictiveService.ts:95`](file:///c:/Users/truck/TRUCKWITHEASE-1/src/services/quantumPredictiveService.ts#L95) | `/api/quantum/hos-optimizer` | `const res = await fetch('/api/quantum/hos-optimizer', {` |
| [`src/services/quantumPredictiveService.ts:111`](file:///c:/Users/truck/TRUCKWITHEASE-1/src/services/quantumPredictiveService.ts#L111) | `/api/quantum/all-functions` | `const res = await fetch('/api/quantum/all-functions');` |
| [`src/services/regionalWeatherHazardService.ts:247`](file:///c:/Users/truck/TRUCKWITHEASE-1/src/services/regionalWeatherHazardService.ts#L247) | `/api/weather/regional-hazards` | `const response = await fetch('/api/weather/regional-hazards', {` |
| [`src/services/tripPlannerService.ts:164`](file:///c:/Users/truck/TRUCKWITHEASE-1/src/services/tripPlannerService.ts#L164) | `/api/routing/calculate` | `const res = await authenticatedFetch('/api/routing/calculate', {` |
