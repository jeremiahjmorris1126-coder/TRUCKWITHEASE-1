# TruckWithEase Workspace Directives & Core Rules

## 1. Visual Identity & Color Palette Guidelines

- **Base Background**: Deep Obsidian (`#05080E` / `#0A0F14`). Never use washed-out generic grays or plain bright whites for cockpit/map surfaces.
- **Primary Action Buttons**: High-visibility safety yellow (`#FFE500` / `#FFDF00`).
  - Font styling: Solid black text (`text-black font-black uppercase tracking-wider`).
  - Luminous glow shadow: `shadow-[0_0_20px_rgba(255,229,0,0.45)]`.
  - Utility class: `.btn-tactical-yellow` or `.btn-primary-tactical`.
- **Map Vector Route Corridors**:
  - Multi-colored glowing neon gradient transitioning from safe emerald (`#10B981`) to cautionary amber (`#F59E0B`) to hazard red (`#EF4444`).
  - Overpass warning callouts: Dark pill badges with amber borders (`#EAB308`) and bold text `BRIDGE AHEAD`.
- **Critical Clearance Alert Container**:
  - Chamfered / hexagonal glowing border (`#EF4444` / `#F97316`) on ruby background with `13' 6" CLEARANCE // 0" BUFFER DELTA` and `COLLISION RISK: CRITICAL`.
- **Verified Badges**: Emerald green pill (`#10B981`).

## 2. The Master Mechanic Protocol

- "The G.O.A.T." is permanently removed and replaced by **THE MASTER MECHANIC**.
- The Master Mechanic module encompasses:
  1. J1939 CAN-Bus live diagnostics and SPN/FMI DTC fault code scanner.
  2. Component failure radar (engine oil, coolant, turbo boost, brake linings, automated clutch, alternator voltage).
  3. Kingpin hitch articulation angle sentinel with jackknife danger threshold warnings.
  4. Roadside certified repair facility dispatch and 49 CFR § 396.11 Electronic DVIR attestations.

## 3. Dispatch Zero ($/Hr Yield)

- All load board views and profitability ranking must follow the **Dispatch Zero** architecture:
  - Ranked by remaining legal duty hours.
  - Large yield rate display (e.g., `$232.10/Hr`) in `#FFE500` yellow with clear origin and destination tags.
  - One-click dispatch action via full-width `#FFE500` yellow CTA.

## 4. Cloud Run, Firestore & Cloudflare Infrastructure Invariants

- **IAM & Permissions**:
  - The Cloud Run service account must hold Firestore User permissions (`roles/datastore.user`) to perform document reads and writes.
  - Public Ingress: The service must allow unauthenticated invocations (`--allow-unauthenticated` / `roles/run.invoker` granted to `allUsers`).
- **Database Topology**:
  - Firestore must be in **Native mode** and located within the active project (`project-f0634118-be01-44f7-b36`).
  - Database ID reference: Default or designated database (`app-builder-38a26d99`).
- **Port & Process Startup**:
  - The container must bind dynamically to `process.env.PORT` (defaults to `8080` on Cloud Run, `3000` locally). Hardcoded ports are strictly forbidden.
- **Base Image Security & Container Runtime**:
  - Use `node:22-alpine` for both builder and runner stages (minimal attack surface); run `apk upgrade --no-cache` and strip unused package managers in the runner.
  - Run as non-root `USER node`.
- **CORS & Edge Addressing**:
  - Backend must allow origins `https://truckwithease.com`, `https://www.truckwithease.com`, `https://morrishive.com`, `https://www.morrishive.com`, and localhost ports (`3000`, `5173`).
  - Frontend API clients must dynamically point to the production host or custom domain, never `localhost`.
- **Cloudflare Edge Proxy**:
  - SSL/TLS encryption mode must be set to **Full (strict)**.
  - Page rules, Cloudflare Workers, or cache rules must never intercept or return static assets for `/api/*` or `/v1/*` routes.
