# Cloudflare Enterprise Deployment Guide
**Target Domains:** `truckwithease.com` & `Morrishive.com`  
**Hosting Provider:** Cloudflare Pages (Global Edge Network)  
**Source Repository:** `jeremiahjmorris1126-coder/TRUCKWITHEASE-1`

---

## 1. Cloudflare Pages Architecture

The application is deployed to Cloudflare Pages utilizing:
- **Edge Static Asset Hosting**: Fast, distributed delivery across Cloudflare's 330+ city Anycast network.
- **SPA Rewrite Protocol**: `public/_redirects` routes all single-page application paths (`/`, `/hud`, `/dispatch`, `/expenses`, etc.) to `/index.html` with HTTP 200.
- **Edge Security Headers**: `public/_headers` provisions `X-Frame-Options`, `X-Content-Type-Options`, and immutable caching for Vite chunks under `/assets/*`.
- **Dual Domain Multi-Tenancy**: Both `truckwithease.com` and `Morrishive.com` point to the identical high-performance Cloudflare edge deployment.

---

## 2. Setting Up Cloudflare Pages (Git Integration)

1. Log into your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the left navigation, go to **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3. Select your GitHub repository:
   - **Repository:** `jeremiahjmorris1126-coder/TRUCKWITHEASE-1`
   - **Production Branch:** `main`
4. Set the **Build Settings**:
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build` (or `bun run build`)
   - **Build output directory:** `dist`
   - **Root directory:** `/` (default)
5. Under **Environment variables (production)**, add (optional):
   - `NODE_VERSION`: `20`
   - `GEMINI_API_KEY`: *(Your Google Gemini API key if utilizing serverless weather/AI functions)*
6. Click **Save and Deploy**. Cloudflare Pages will build the project and provision your `*.pages.dev` endpoint (e.g., `truckwithease.pages.dev`).

---

## 3. Custom Domain Configuration (Morrishive.com & truckwithease.com)

In your Cloudflare Pages project, go to **Custom domains** tab > **Set up a custom domain**.

### Domain 1: `truckwithease.com`
1. Enter `truckwithease.com` and click **Continue**.
2. If your DNS is managed in Cloudflare, Cloudflare will automatically provision the apex CNAME flattening / A-record proxy.
3. Also add `www.truckwithease.com` and configure canonical redirect or dual binding.

### Domain 2: `Morrishive.com`
1. Click **Set up a custom domain** again.
2. Enter `morrishive.com` and click **Continue**.
3. Also add `www.morrishive.com`.
4. Cloudflare provisions Edge SSL certificates automatically for both domains within seconds.

### Recommended SSL/TLS & Edge Settings in Cloudflare
- **SSL/TLS encryption mode:** `Full (strict)`
- **Always Use HTTPS:** `ON`
- **Automatic HTTPS Rewrites:** `ON`
- **Minimum TLS Version:** `TLS 1.2`
- **Brotli Compression:** `ON`
- **Early Hints:** `ON`

---

## 4. 1-Click In-App Deployment & CLI Deploy

### Option A: In-App 1-Click Deployment (Recommended)
Use the cockpit's built-in **Cloudflare Production Center** modal:
1. Open the Cloudflare Production Center from the top bar or Live Dispatch Hub.
2. Enter your commit message and optional GitHub Personal Access Token.
3. Click **PUSH LATEST UPDATE TO CLOUDFLARE & GITHUB NOW**.
4. GitHub receives the push, and Cloudflare Pages automatically triggers an atomic edge build and deploys to both `truckwithease.com` and `Morrishive.com`.

### Option B: Direct CLI Deployment via Wrangler
To deploy directly from a local build without committing to Git:
```bash
# 1. Build production bundles
bun run build

# 2. Deploy directly to Cloudflare Pages
npx wrangler pages deploy dist --project-name=truckwithease
```

---

## 5. Verification Checklist

- [x] `vercel.json` permanently removed.
- [x] `public/_redirects` active for SPA deep linking.
- [x] `public/_headers` active for security and asset cache policies.
- [x] `wrangler.toml` configured for `truckwithease`.
- [x] `truckwithease.com` mapped to Cloudflare Pages edge.
- [x] `Morrishive.com` mapped to Cloudflare Pages edge.
- [x] Zero build warnings or TypeScript compile errors.
