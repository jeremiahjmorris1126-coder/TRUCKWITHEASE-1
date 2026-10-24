# Google Cloud / Firebase Enterprise Deployment Guide
**Target Domains:** `truckwithease.com` & `Morrishive.com`  
**Hosting Provider:** Google Cloud / Firebase Hosting (Google Anycast Global Edge Network)  
**Project Config:** `firebase.json` & `.firebaserc`

---

## 1. Why Firebase / Google Cloud Hosting?

Deploying through Google Cloud / Firebase Hosting eliminates the redirect loops (`ERR_TOO_MANY_REDIRECTS`) and edge sync issues experienced with Cloudflare:
- **Global Google Edge CDN**: Assets and SPA routes are served from Google's worldwide Points of Presence (PoPs) on Google's private fiber backbone.
- **Automated Google SSL Provisioning**: Free, auto-provisioned, auto-renewed TLS certificates issued directly by Google Trust Services.
- **Native SPA Routing**: Clean rewrite rules in [`firebase.json`](file:///c:/Users/truck/TRUCKWITHEASE-1/firebase.json) rewrite all routes to `/index.html` without HTTP 301/302 redirects.
- **Multi-Domain Support**: Host both `truckwithease.com` and `Morrishive.com` on the same Firebase Hosting site with zero configuration conflicts.

---

## 2. Quick Deployment Runbook

### Step 1: Authenticate with Google
Run this command once in your terminal:
```powershell
bun run firebase login
```
*(A browser window will open — select your Google account and click Allow).*

### Step 2: Build & Deploy to Firebase
Run the automated deployment script:
```powershell
.\deploy_to_firebase.ps1
```
Or run directly via npm/bun:
```powershell
bun run deploy:firebase
```

Firebase will build the production bundle, upload the files to Google Cloud Storage, and deploy to your Firebase Hosting site.

---

## 3. Custom Domain Setup (Morrishive.com & truckwithease.com)

In the [Firebase Console](https://console.firebase.google.com/):
1. Select your project (e.g. `truckwithease`).
2. In the left navigation, click **Hosting** > **Add custom domain**.

### Adding Domain 1: `truckwithease.com`
1. Enter `truckwithease.com` and click **Continue**.
2. Check the box to also redirect `www.truckwithease.com` (or bind both).
3. Firebase will provide two **A Records** (e.g., `199.36.158.100`).

### Adding Domain 2: `Morrishive.com`
1. Click **Add custom domain** again.
2. Enter `morrishive.com` and click **Continue**.
3. Also add `www.morrishive.com`.
4. Firebase provides the identical Google A-records.

---

## 4. Crucial DNS Setting to Prevent Redirect Loops

If your DNS nameservers are currently pointing to Cloudflare:
1. In [Cloudflare Dashboard](https://dash.cloudflare.com/), go to **DNS** > **Records**.
2. Set the A records for `morrishive.com`, `www.morrishive.com`, `truckwithease.com`, and `www.truckwithease.com` to Firebase's IP addresses.
3. **IMPORTANT**: Toggle the Proxy status from Orange Cloud to **DNS Only (Gray Cloud)**!
   > **Why Gray Cloud?**  
   > Gray Cloud turns off Cloudflare's edge proxy so Cloudflare cannot inject broken Page Rules, SSL "Flexible" loops, or relative redirects. Google Cloud directly handles SSL negotiation, and your site loads with zero redirect errors!

---

## 5. Verification Checklist

- [x] `firebase-tools` installed locally in project dependencies.
- [x] [`firebase.json`](file:///c:/Users/truck/TRUCKWITHEASE-1/firebase.json) configured with SPA rewrites (`"source": "**", "destination": "/index.html"`).
- [x] [`deploy_to_firebase.ps1`](file:///c:/Users/truck/TRUCKWITHEASE-1/deploy_to_firebase.ps1) automation script ready.
- [x] Dual domain mappings ready for `truckwithease.com` and `Morrishive.com`.
