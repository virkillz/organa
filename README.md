# Organa

Kitchen and inventory management for Indonesian F&B businesses: recipe costing (HPP), stock with expiry, POS, stock counts, and waste analysis with forecasts. This repo holds the investor-demo MVP described in the [MVP spec](https://claude.ai/code/artifact/d7f9e5ae-801f-438d-9686-b9f6672a8b6a).

> **Not a developer?** Follow [TESTING.md](TESTING.md): a step-by-step guide to install, run and test Organa on your phone.

## Layout

| Path | What |
| --- | --- |
| `apps/api` | NestJS 12 API on PostgreSQL (Drizzle ORM), versioned under `/v1` |
| `apps/mobile` | Expo SDK 57 app (Expo Router, TanStack Query, Zustand) for phone and tablet |
| `packages/shared` | Zod schemas, roles/permissions, units, money helpers used by both |
| `UI Design /` | Original mockups (reference only) |

## Run locally

Requires Node 24, pnpm 9 and a local PostgreSQL.

```sh
createdb organa && createdb organa_test
cp apps/api/.env.example apps/api/.env      # set JWT_SECRET (32+ chars); ANTHROPIC_API_KEY is optional
cp apps/mobile/.env.example apps/mobile/.env # EXPO_PUBLIC_API_URL
pnpm run setup:local                         # install, build shared + API, run migrations
pnpm run demo:reset                          # ~2 min: 180 days of history for 2 outlets
pnpm dev:api                                 # http://localhost:3000/v1/health
pnpm dev:mobile                              # then press a (Android) or i (iOS), or scan the QR in Expo Go
```

Use `pnpm run setup:local`, not `pnpm setup`: the latter is a built-in pnpm command that edits your shell profile.

On an Android emulator, run `adb reverse tcp:3000 tcp:3000` so the app can reach `localhost:3000`. On a physical device, set `EXPO_PUBLIC_API_URL` to your machine's LAN IP. Expo Go is enough for the demo; `eas build --profile demo` makes an installable APK (set the staging API URL in `eas.json` first).

## Demo data

`pnpm run demo:reset` deletes and rebuilds the demo tenant. It replays 180 days of stock-ins, sales, weekly counts and expiries through the same services the app uses, so every screen agrees. History ends at the moment you run it, so run it within an hour of a demo.

| Login | Credentials |
| --- | --- |
| Owner (SteakWarung_JKT) | `demo@organa.id` / `organa123`, OTP `123456` |
| Cabang 1 employees | Marcell (Kepala Dapur) PIN `123456`, Abdul (Kasir) PIN `654321` |
| Cabang 2 employees | Sari (Kepala Dapur) PIN `111111`, Budi (Kasir) PIN `222222` |

Employee PIN login only works on a device the owner has registered: log in as owner, open **Karyawan → Daftarkan perangkat ini**, then log out.

Stories built into the data: Cabang 1 over-buys Beef Tenderloin (top waste) and runs short of Beef Sirloin; Cabang 2 wastes Salmon Fillet and has a chicken-breast count variance. Demo prep leaves Cabang 1 with 1.800 gr sirloin (critical line 1.500 gr), so selling 2 Sirloin Steak raises a live "stok kritis" alert, and 4.000 gr chicken thigh for the stock-count step.

## Tests

```sh
pnpm --filter @organa/shared test
pnpm --filter @organa/api test      # unit + e2e; e2e needs the organa_test database
```

## How it works

- **Auth.** Owners use email + password, then a 6-digit OTP. With `DEMO_MODE=true` the OTP is always `123456` and codes are only logged; no WhatsApp/SMS provider is wired up yet. Employees pick their name and enter a PIN on a registered device; 5 wrong PINs lock them for 5 minutes. Access tokens last 15 minutes; refresh tokens rotate on every use and are stored hashed. One role → feature map (`packages/shared/src/roles.ts`) drives both the drawer and the API guards.
- **Stock** is a ledger: every stock-in creates a batch plus an `IN` movement; sales, waste, expiry and count adjustments are negative movements. On-hand = sum of movements. Sales take from the batch that expires first (FEFO) and never block on low stock. Batches past their expiry date are written off as `EXPIRED` (hourly, and on every stock read).
- **HPP** = ingredient lines costed at the outlet's average cost of remaining batches + manual labour/overhead/other lines.
- **Stock count** snapshots expected stock, the kitchen enters physical counts, and "Simpan stok aktual" posts the signed differences as `ADJUST` movements.
- **Analysis and forecast.** Waste = expiry write-offs + manual waste + count shortages, valued at cost. The forecast is a 3-month weighted moving average (50/30/20) per ingredient. Insight text is written by Claude (`claude-opus-5`) from pre-computed facts when `ANTHROPIC_API_KEY` is set; any number the model uses that is not in the facts makes the API fall back to the built-in template.
- **Alerts** (critical, stock-out, expired) are stored server-side; the app polls every 15 s and shows a banner (plus a system notification in development builds; Expo Go on Android has no notifications).

## Simulated or not built yet

| Area | Status |
| --- | --- |
| QRIS / e-wallet / card payment | Simulated: method is recorded, confirmation is automatic after 2 s |
| Receipt print / email | Buttons explain it is not connected yet |
| OTP delivery (WhatsApp/SMS) | Logged by the API only |
| Bulk import, attendance, reports, tables, targets, billing | "Segera hadir" placeholders |
| Product photos | Upload works (stored on the API's local disk); the demo data has none |
| Offline POS | Not built; the demo assumes a connection |
