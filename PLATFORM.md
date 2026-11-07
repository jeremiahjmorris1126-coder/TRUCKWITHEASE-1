# TruckWithEase Platform & Governance Rules

These platform rules are standing invariants and apply to all work in this repository:

1. **Cloud & Database Architecture (Google Cloud / Firebase Only)**
   - The application runs and deploys **ONLY** on Google Cloud / Firebase:
     - **Backend**: Google Cloud Run (`project-f0634118-be01-44f7-b36`, region `us-central1`)
     - **Database**: Cloud Firestore (`app-builder-38a26d99`) — Firestore is the **only** database. Do not provision or use Cloud SQL, PostgreSQL, Firebase Data Connect, or any other database service.
     - **Authentication**: Firebase Authentication
     - **Static / Web Hosting**: Cloud Run or Firebase Hosting if needed

2. **Cloudflare Usage (Domains & DNS Only)**
   - Cloudflare is used **ONLY** for domains and DNS:
     - `morrishive.com`
     - `truckwithease.com`
     - `truckwithease.dev`
   - **No application code runs on Cloudflare** (no Cloudflare Workers, no Cloudflare Pages) unless explicitly requested by the owner.

3. **Source Control & Repository**
   - GitHub is used **ONLY** for source code, in **ONE** repository:
     - `jeremiahjmorris1126-coder/TRUCKWITHEASE-1` (`https://github.com/jeremiahjmorris1126-coder/TRUCKWITHEASE-1.git`)
   - Never push to any other repository or remote (never push to the old `truck-with-ease---enterprise--integrations` repository and never push to GitLab).
   - Never push to GitHub without explicit owner approval.

4. **Deployment & Cloud Resource Deletion Gates**
   - **No deploys** without explicit `APPROVED DEPLOY` from the owner.
   - **No deletes** in Google Cloud or Cloudflare without explicit `APPROVED DELETE` from the owner.

5. **ELD & Regulatory Boundary**
   - **TruckWithEase is NOT an ELD.**
   - The driver's registered ELD provider is the official record of duty status. TruckWithEase stores only a read-only copy when connected.
   - TruckWithEase must **never** create, edit, delete, or "correct" duty status records, calculate legal HOS clocks, create or send ELD output files, or submit anything to FMCSA eRODS. Drivers send logs to inspectors directly from their own registered ELD.

6. **Detention & Evidence Integrity**
   - Detention packets and invoices must be built **only** from events actually recorded for that load and stop (recorded phone GPS or telematics pings and recorded detention arrive/depart events inside the facility geofence, with each event's source and server receipt timestamp).
   - Never fabricate, simulate, or default dwell time, GPS coordinates, door sensor events, appointment times, or carrier USDOT/MC numbers.
