# PRD — BENNOURI Pièces Auto

## Original Problem Statement
Build a French-language auto parts e-commerce platform "BENNOURI Pièces Auto" for the Tunisian market. Navigation: account & cart (panier). Users must register to order. Inspired by piecesautos.tn but using **VIN number** instead of license plate.

- **Screen 1**: User enters VIN, clicks "Valider"
- **Screen 2**: Vehicle data shown as breadcrumb (marque / modèle / carburant / VIN) + 3 cards (Mécanique, Électrique, Carrosserie) — data parsed from PartSouq-style source
- **Screen 3**: Parts subcategories for the chosen section with realistic icons
- Footer with shop address, phone, email, Visa/Mastercard icons
- Admin tab visible only to admin (users + orders)
- Logo provided (navy + steel BENNOURI logo)

## Architecture
- **Backend**: FastAPI + Motor (MongoDB async) + JWT (bcrypt + httpOnly cookie + Bearer fallback)
- **Frontend**: React 19 + React Router 7 + Tailwind + shadcn/ui + Sonner toasts
- **VIN decoding**: NHTSA public API + curated fallback dictionary
- **Catalog**: In-memory Python dict (3 sections × 5-6 categories × 4-6 parts each)
- **Payments**: Cash on Delivery (Visa/Mastercard logos in footer for trust)

## User Personas
- **Particulier**: car owner needing replacement parts identified by VIN
- **Garagiste**: mechanic ordering specific OEM parts for clients
- **Admin BENNOURI**: shop owner monitoring registered users + orders

## Core Requirements (static)
1. French UI throughout
2. VIN-based vehicle identification (no license plate)
3. 3-screen browsing flow (VIN → vehicle → categories)
4. Mandatory registration for ordering
5. Admin dashboard restricted by role
6. Tunisia-localized footer (TND currency, Tunis address)

## What's Been Implemented (2026-05-19)
### Backend
- `POST /api/auth/register|login|logout`, `GET /api/auth/me` — JWT + bcrypt
- `POST /api/vin/decode` — NHTSA + fallback + PartSouq async background scrape
- `GET /api/vin/partsouq-status/{vin}` — polling endpoint for background scrape
- `POST /api/partsouq/subgroup` — **NEW (2026-05-24)** lazy fetch all OEM parts for a subgroup (2 ScrapingBee calls, MongoDB cached by vin+cid)
- `GET /api/partsouq/subgroup/{vin}/{cid}` — read-only cache lookup
- `GET /api/catalog/sections|/{section}|/{section}/{category}`
- `POST /api/orders`, `GET /api/orders/mine`
- `GET /api/admin/{users,orders,stats}`, `PATCH /api/admin/orders/{id}`
- `POST /api/contact`, `GET /api/admin/messages`
- Admin seeded on startup: `admin@bennouri.com / Admin@123`
- MongoDB indexes on users.email (unique), users.id, orders.user_id, orders.id, partsouq_cache.vin (unique), partsouq_subgroups(vin+cid) (unique)

### Frontend
- LandingPage, VinSearch, VehicleDetail, PartsCategory, PartsList, Cart, Login, Register, Account, AdminDashboard, Contact, Impressum
- **NEW (2026-05-24)** `PartsouqCatalog.jsx` — full OEM tree browser (collapse/expand groups, search filter, click subgroup → modal with parts table)
- Footer with address, phone, email, Visa/Mastercard SVG icons

### PartSouq Lazy On-Demand Scraping (2026-05-24)
- **Stage 1** (VIN decode): single ScrapingBee call extracts the FULL catalog tree (groups + subgroups + cid links) and caches by VIN
- **Stage 2** (Click subgroup): 2 ScrapingBee calls extract parts table with columns `Numéro · Nom · Code · Remplacement · Remarque`, cached by `{vin, cid}`
- Verified for Renault Clio IV VIN `VF15R0K0H48649991` → 67 groups, 189 subgroups, 9 OEM parts in "Water pump" (matching user-provided sample exactly)

### Designation Filter on OEM Catalog (2026-06-21)
- Added local "Filtrer par désignation" input on `PartsouqCatalog.jsx` to narrow down multi-keyword OEM search results (e.g. type "boitier", "distribution", "support" to filter aggregated items in-memory)
- Filters across `designation`, `oem_name`, `reference`, `oem_ref`, `categorie`, `fournisseur` (case-insensitive substring match)
- Includes count badge (`X sur Y articles`), clear (`X`) button, empty state with "Réinitialiser le filtre" CTA
- Auto-resets when a new TecDoc search is fired
- Verified end-to-end with admin@bennouri.com on VIN `WVWZZZ1KZ8W123456`, query `filtre` (2 items): "boitier"→1, "support"→1, "huile"→0


### Intelligent vehicle_id picker via vin-decoder-mega (2026-06-30)
- Fix in `/app/backend/rapidapi_client.py` `vin_mega_decode`: response from `vin-decoder-mega.p.rapidapi.com/vin.php` is `{data: {sra_commercial, ...}, ...}`. Previously the outer dict was returned, so `.get("sra_commercial")` was always None and the server fell back to `vehicles[0]` (wrong variant).
- After fix: VIN `VR7EF9HNAKJ575626` → `sra_commercial="1.6 HDI 75 (MF9HW, GJ9HWC, GF9HWC, GN9HWC)"` → token-matches `1.6 BlueHDi 75` (BlueHDi→HDi normalization) → picks `vehicle_id=133257` on TecDoc model 39023.
- Verified by testing agent (iteration_2): 5/5 pytest assertions pass, `/api/oem-stock-search` returns 200 with backend log `VIN VR7EF9HNAKJ575626: matched vehicle_id=133257 via sra=...`.
- New regression test: `/app/backend/tests/test_vin_vehicle_picker.py`.
## Prioritized Backlog
### P1

### OEM Partner-Search Variant Fallback (2026-06-30)
- New module-level helper `server.oem_search_variants(ref)` enumerates ordered partner-search fallbacks: original → suffix-stripped (KIT/_S/_F/_XS) → first-8 digits → first-6 digits → leading-zero stripped → leading-zero added.
- `cached_supplier_search` now iterates variants per OEM ref against FadPro/Copia/PartsPro, breaks on the first non-empty supplier response, and stores the picked code as `matched_variant` in `supplier_lookup_cache`. Per-variant timeout: 5 s.
- Verified live (iteration_3): 14 production cache rows where `matched_variant ≠ ref`, e.g. `1610577780KIT → 1610577780 (4 items)`, `1623095180 → 162309 (13 items)`, `1628925880 → 162892 (2 items)`. Direct FadPro probe confirms `1610577780KIT` alone returns 404 while `1610577780` returns 4 items.
- New regression test: `/app/backend/tests/test_oem_search_variants.py` (8 variant cases + Mongo cache assertion).

### Known external constraint
- RapidAPI `vin-decoder-mega.p.rapidapi.com` BASIC plan monthly quota currently exhausted (HTTP 429). The intelligent vehicle_id picker handles this gracefully (falls back to `vehicles[0]`); upgrade or wait for the monthly reset.
- Real payment integration (Stripe — Visa/Mastercard) — keys ready in environment
- Connect OEM part numbers to internal inventory / cart flow (so user can add scraped OEM ref directly to Bennouri cart)
- Email notifications on order confirmation (Resend / SendGrid)
- Real parts database (currently in-memory dict)

### P2
- Multi-language toggle (FR / AR)

### OEM Search Performance Fix (2026-06-30, post-Cloudflare 524)
- iteration_3 regression: the new 4-variant fadpro fallback was ALSO running on Copia & PartsPro, which hold a per-instance asyncio.Lock that serialises every concurrent call. With ~25 parallel candidates × 4 variants × supplier lock = wall-time > 100 s → Cloudflare 524 ("origin returned invalid or incomplete response").
- Fix:
  1. `oem_search_variants` hard-capped to 3 entries (dropped the 8-char prefix middle variant).
  2. New module constant `VARIANT_SOURCES = {"fadpro"}` — only FadPro runs the variant loop; Copia/PartsPro do a single canonical-ref call.
  3. Per-variant timeout reduced from 5 s → 3 s for FadPro; Copia/PartsPro remain at 5 s single-shot.
  4. Global endpoint `asyncio.wait_for` reduced from 60 s → 45 s for safety margin.
- Verified live (iteration_4): cold-cache `GET /api/oem-stock-search?q=chaine,distribution&split=true&...` now completes in **5.12 s** (was >100 s). 14/14 tests pass; cache invariant holds (zero copia/partspro variant mismatches, 4 fresh fadpro fallback picks).
- New regression test: `/app/backend/tests/test_oem_walltime_iteration4.py`.
- Wishlist / save vehicles
- Image gallery per part (multiple angles)
- PDF invoice export
- SMS notifications via Twilio for delivery updates
- Brute-force lockout on login
- Password strength validation
- Replace CORS `*` with explicit frontend origin (when production-ready)
