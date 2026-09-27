# Organa: Testing Guide

This guide walks you through running Organa on your own computer and phone and checking that everything works. You do not need to be a programmer. Follow the steps in order, and copy the commands exactly.

**Time needed:** about 45 minutes the first time (mostly installing tools), then about 5 minutes each time after that.

---

## Contents

1. [What you need](#1-what-you-need)
2. [Terminal basics](#2-terminal-basics)
3. [One-time setup](#3-one-time-setup)
4. [Start Organa (every time)](#4-start-organa-every-time)
5. [Test scenarios](#5-test-scenarios)
6. [Reset the demo data](#6-reset-the-demo-data)
7. [If something goes wrong](#7-if-something-goes-wrong)
8. [How to report a problem](#8-how-to-report-a-problem)
9. [What is not real yet](#9-what-is-not-real-yet)
10. [Words used in the app](#10-words-used-in-the-app)

---

## 1. What you need

| Item | Notes |
| --- | --- |
| A Mac | These steps are written for macOS. |
| A phone (Android or iPhone) | Used to open the app. A second phone is optional but nice for the "live alert" test. |
| The same Wi-Fi network | The phone and the Mac **must** be on the same Wi-Fi. Office or guest Wi-Fi sometimes blocks devices from seeing each other; a home network or a phone hotspot works best. |
| The Organa project folder | The folder that contains this file. |

**Demo accounts (already created for you):**

| Who | How to log in |
| --- | --- |
| Owner (business "SteakWarung_JKT") | Email `demo@organa.id`, password `organa123`, OTP code `123456` |
| Marcell, head chef, Cabang 1 | PIN `123456` |
| Abdul, cashier, Cabang 1 | PIN `654321` |
| Sari, head chef, Cabang 2 | PIN `111111` |
| Budi, cashier, Cabang 2 | PIN `222222` |

The demo business has two outlets (Cabang 1 and Cabang 2) and 6 months of made-up history: sales, deliveries, expired stock and weekly stock counts.

---

## 2. Terminal basics

Organa is started with the **Terminal** app.

- **Open Terminal:** press `⌘ Cmd + Space`, type `Terminal`, press `Enter`.
- **Run a command:** copy it from this guide, paste it into Terminal (`⌘ Cmd + V`), press `Enter`.
- **Wait for it to finish:** most commands are done when you see the prompt again (a line ending in `%` or `$`).
- **Stop a program that keeps running:** click the Terminal window and press `Control + C`.
- **Open a second Terminal window:** `⌘ Cmd + N`.
- **Go to the project folder:** type `cd ` (with a space after it), then drag the Organa folder from Finder into the Terminal window, then press `Enter`.

> Tip: Every command in this guide must be run **inside the Organa folder**. If a command says "No such file" or "missing script", you are probably in the wrong folder. Run the `cd` step again.

---

## 3. One-time setup

You only do this section once.

### 3.1 Install Homebrew (a tool installer for Mac)

Check if you already have it:

```sh
brew --version
```

If you see a version number, skip to 3.2. If you see "command not found", go to [brew.sh](https://brew.sh), copy the install command shown on that page, paste it into Terminal and follow the instructions it prints. At the end it asks you to run two or three extra lines ("Next steps"); run those too. Then close Terminal and open it again.

### 3.2 Install Node.js, pnpm and PostgreSQL

Paste these one at a time:

```sh
brew install node@24
echo 'export PATH="/opt/homebrew/opt/node@24/bin:$PATH"' >> ~/.zshrc
brew install postgresql@17
brew services start postgresql@17
echo 'export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"' >> ~/.zshrc
```

Close Terminal and open it again, then install pnpm:

```sh
npm install -g pnpm@9
```

> On older Intel Macs, Homebrew lives in `/usr/local` instead of `/opt/homebrew`. If `brew --prefix` prints `/usr/local`, replace `/opt/homebrew` with `/usr/local` in the two `echo` lines above.

Close Terminal and open it again. Then check everything is installed:

```sh
node --version
pnpm --version
psql --version
```

You should see three version numbers: Node `v24…`, pnpm `9…`, psql `17…`.

> If `node --version` shows `v24` or higher, you are fine. If you already had PostgreSQL 14 or 16 installed and running, that works too; skip the two PostgreSQL lines.

### 3.3 Install the app on your phone

Install **Expo Go** from the Google Play Store (Android) or the App Store (iPhone). It is free. Organa opens inside Expo Go, so you do not need to install Organa itself.

### 3.4 Prepare the project

Go to the Organa folder in Terminal (see [Terminal basics](#2-terminal-basics)), then run:

```sh
createdb organa
createdb organa_test
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
```

If `createdb` says the database "already exists", that is fine.

### 3.5 Tell the app where the server is

Your phone needs your Mac's address on the Wi-Fi network. Find it:

```sh
ipconfig getifaddr en0
```

You will see something like `192.168.1.18`. Now open the app settings file:

```sh
open -e apps/mobile/.env
```

A TextEdit window opens. Change the last line so it uses your address, for example:

```
EXPO_PUBLIC_API_URL=http://192.168.1.18:3000
```

Save (`⌘ Cmd + S`) and close TextEdit.

> If `ipconfig getifaddr en0` prints nothing, try `ipconfig getifaddr en1`. Your address can change when you reconnect to Wi-Fi; if the app later says it cannot connect, repeat this step.

### 3.6 Install and build everything

```sh
pnpm run setup:local
```

This downloads the project's building blocks and prepares the database. It takes 1–3 minutes. It is finished when you see `Migrations applied`.

### 3.7 Load the demo data

```sh
pnpm run demo:reset
```

This creates the demo business with 6 months of history. It takes about 2 minutes. It is finished when you see:

```
Done in …s. Owner login: demo@organa.id / organa123 (OTP 123456 in demo mode)
```

Setup is complete.

---

## 4. Start Organa (every time)

You need **two Terminal windows**, both in the Organa folder. Keep both open while testing.

**Window 1: the server**

```sh
pnpm dev:api
```

Wait until you see `Nest application successfully started`. Leave this window alone.

**Window 2: the app**

```sh
pnpm dev:mobile
```

After a few seconds a **QR code** appears.

**On your phone:**

- **Android:** open Expo Go and tap **Scan QR code**, then point at the QR code.
- **iPhone:** open the normal **Camera** app, point it at the QR code, and tap the "Open in Expo Go" banner.

The first load takes up to a minute. You will see the Organa welcome screens.

> If your Mac asks "Do you want the application node to accept incoming network connections?", click **Allow**. Otherwise your phone cannot reach it.

**To stop Organa:** press `Control + C` in both Terminal windows.

---

## 5. Test scenarios

Work through these in order; later tests build on earlier ones. Tick each box when the result matches. If something does not match, see [How to report a problem](#8-how-to-report-a-problem).

The app is in Indonesian. Button names are written here exactly as they appear.

> Best results: run [Reset the demo data](#6-reset-the-demo-data) right before a full test round. Some numbers below (like "1.800 gr") are only true on fresh data.

### Test 1: First launch and owner login

1. Open the app. You see 3 intro screens. Tap **Lanjut** twice, then **Mulai**.
   - [ ] The intro only shows the first time you open the app.
2. On the green welcome screen, tap **Log in sebagai Pemilik**.
3. Enter email `demo@organa.id` and password `organa123`. Leave **Email** selected under "Kirim OTP via". Tap **LOGIN**.
4. Type `123456` in the 6 boxes.
   - [ ] You land on the **Dashboard** with "Halo, Elvin".
   - [ ] "Penjualan hari ini" shows today's sales and a bar chart for the last 7 days.
   - [ ] Tapping a bar shows that day's amount above the chart.

**Also try (should fail politely):**

- [ ] Wrong password shows "Email atau password salah".
- [ ] Wrong OTP (e.g. `111111`) shows "Kode OTP salah" and clears the boxes.

### Test 2: Menu and switching outlets

1. Tap the **☰** icon (top left) to open the menu.
   - [ ] You see the business name "SteakWarung_JKT", the "LITE" badge, "Cabang 1", and your name "Elvin Eka · Pemilik".
2. Tap **Cabang 1** and choose **Cabang 2**.
   - [ ] The Dashboard numbers change (Cabang 2 is a smaller outlet).
3. Switch back to **Cabang 1** before continuing.

### Test 3: Stock management

1. Menu → **Manajemen Stok**.
   - [ ] Orange card "Potensi Kedaluarsa" (stock that expires within 3 days) with an amount in Rp.
   - [ ] Dark card "Telah Kedaluarsa" (stock thrown away this month).
   - [ ] Red card "Critical Stock" with a number of items.
   - [ ] Category tiles (Sayuran, Daging, Seafood…) with small number badges.
2. Tap the orange card.
   - [ ] A list of batches grouped by expiry date, with the value of each.
3. Go back (←), tap the **Daging** tile.
   - [ ] A list of meat items with amount in grams, expiry date and "Stock Value".
4. Tap **Beef Sirloin Lokal**.
   - [ ] "Current Stock 1.800 gr" and "Critical Stock 1500 gr" (on fresh data).
   - [ ] A list of batches with who entered them.
5. Go back to **Manajemen Stok**, tap the green **+** button, choose **Sayuran**.
6. Fill in: Keterangan `Wortel` · Jumlah `2` · Unit `kg` · Harga `12000` · Satuan `per kg` · Critical Stock `500` · Penyimpanan **Chiller**. Tap **SIMPAN**.
   - [ ] Choosing a storage type fills in a suggested expiry date ("Dapat tahan hingga 5 hari").
   - [ ] You return to Manajemen Stok, and the Sayuran badge went up by one.
   - [ ] Sayuran now lists **Wortel, 2.000 gr, Rp 24.000**.

### Test 4: Products and recipe cost (HPP)

1. Menu → **Produk & HPP** → **Main Menu**.
   - [ ] Each product shows its price, its cost (HPP) and its margin %.
2. Tap the green edit button next to **Sirloin Steak**.
   - [ ] The recipe shows Beef Sirloin Lokal 200 gr, Bumbu Steak 20 gr, Kentang 150 gr, Mentega 10 gr, plus labour and overhead lines.
   - [ ] Each ingredient line shows a value in Rp, calculated automatically.
3. Scroll down. Change **HARGA JUAL** from `120.000` to `150.000`.
   - [ ] **MARGIN** and the margin % update immediately.
4. Change it back to `120.000` and tap **SIMPAN**.
5. Optional: go back and tap **INPUT PRODUK** to create a new product. Add at least one ingredient with **TAMBAH VARIABEL → Bahan Baku**.
   - [ ] The new product appears in its category and in the cashier screen.

### Test 5: Set up the phone for staff login

Staff log in with a PIN, but only on a phone the owner has approved.

1. Menu → **Karyawan**.
   - [ ] You see Abdul (Kasir) and Marcell (Kepala Dapur) with their work days.
2. Tap **DAFTARKAN PERANGKAT INI** (or **DAFTARKAN ULANG PERANGKAT INI**), then **OK**.
3. Menu → **Keluar** (log out).
   - [ ] You land on "Log in sebagai Karyawan" instead of the welcome screen.

### Test 6: Cashier sale (the main demo moment)

1. On "Log in sebagai Karyawan", tap **Pilih namamu**, choose **Abdul · Kasir**, type PIN `654321`.
   - [ ] You land on **Kasir** (the cashier screen).
   - [ ] The menu only shows cashier items: Kasir, Riwayat Transaksi, Laporan, Manajemen Meja, Target, Support.
2. Tap **+** on **Sirloin Steak** twice.
   - [ ] The button shows `2`, and a green bar at the bottom shows "2 Items · Total: Rp240.000".
3. Tap the green bar, check the list, tap **BAYAR**.
4. On **Cash**, tap **EXACT AMOUNT**, then **ENTER**.
   - [ ] "Transaksi Sukses!" with "Kembalian: Rp0".
   - [ ] A red box says **"Beef Sirloin Lokal mencapai stok kritis"** (sirloin dropped from 1.800 gr to 1.400 gr, below the 1.500 gr limit).
5. Tap **NEXT ORDER**, add **Es Teh Manis**, tap the bar, **BAYAR**, switch to **Non Cash**, choose **QRIS**, tap **ENTER**.
   - [ ] "Menunggu pembayaran QRIS" shows for 2 seconds, then success. (Non-cash payment is simulated.)
6. Try the calculator icon at the top of Kasir (**Input Manual**): type `15000`, tap **ENTER**.
   - [ ] "Item Manual" is added to the cart. It does not reduce any stock.

**Also try:**

- [ ] On **Cash**, type an amount lower than the total: **ENTER** stays disabled and it says "Kurang Rp…".
- [ ] Menu → **Riwayat Transaksi** lists today's sales, including yours.

### Test 7: Kitchen view

1. Menu → **Keluar**. Choose **Marcell · Kepala Dapur**, PIN `123456`.
   - [ ] You land on **Manajemen Stok**.
   - [ ] The menu shows kitchen items only (no Kasir, no Karyawan).
2. Tap the red **Critical Stock** card.
   - [ ] **Beef Sirloin Lokal** is listed as "Kritis" with 1.400 gr.

### Test 8: Stock count (stok opname)

The kitchen counts what is physically on the shelf; the app compares it with what the system expected.

1. Menu → **Stok Opname** → **Daging**.
   - [ ] Every meat item shows "Sistem: …" (what the system expects).
2. For **Paha Ayam Fillet**, type `3750` (the system expects 4.000 gr on fresh data). Tap **SIMPAN & BANDINGKAN**.
   - [ ] The **Perbandingan Stok** screen shows Expected 4.000 gr, Actual 3.750 gr, and a red **-250 gr** with its value in Rp (roughly −Rp 8.000 to −Rp 9.500).
   - [ ] It says "Belum disimpan" (not saved yet).
3. Tap **SIMPAN STOK AKTUAL**.
   - [ ] The label changes to "Disimpan · Marcell".
   - [ ] Paha Ayam Fillet now shows 3.750 gr in **Manajemen Stok → Daging**.
   - [ ] If a count is higher than expected, the difference shows in orange with a `+`.

### Test 9: Stock analysis and suggestions

1. Menu → **Analisis Stok**.
   - [ ] A line chart of monthly losses from expired or missing stock (tap a point to see its value).
   - [ ] "Total Kerugian" (total loss) for the year.
   - [ ] "Akumulasi Bahan Terbuang": Beef Tenderloin Lokal is the biggest waste at Cabang 1.
2. Tap **Kesimpulan & Saran**.
   - [ ] Three sections: **Unit Terbuang**, **Stock Out**, **Saran Strategis**.
   - [ ] The advice does not tell you to buy both less and more of the same item.
3. Tap **Analisis Tahunan** at the top and switch to **Analisis Bulanan**.
   - [ ] Month tabs appear and the numbers change per month.

### Test 10: Forecast

1. Menu → **Prediksi Stok**.
   - [ ] Tabs for the next 3 months.
   - [ ] The chart shows past months as a solid line and next month as a **dashed** line with a hollow dot.
   - [ ] "Kurangi pembelian" (buy less) and "Tambah pembelian" (buy more) lists, each with a reason.
2. Tap **Kesimpulan & Saran**.
   - [ ] Advice text for the forecast month.

### Test 11: Live alert between two phones (optional)

This is how the investor demo is meant to look. You need a second phone with Expo Go on the same Wi-Fi, and **fresh demo data** ([Reset the demo data](#6-reset-the-demo-data) first, because Test 6 already used up the sirloin).

1. Phone A (owner): log in as owner and stay on the **Dashboard**.
2. Phone B (cashier): scan the same QR code. Log in as owner, do Test 5 (register the device), then log in as cashier **Abdul**.
3. Phone B: sell **2 Sirloin Steak** (as in Test 6).
   - [ ] Within about 15 seconds, phone A shows a banner at the top: "Beef Sirloin Lokal mencapai stok kritis". Tapping it opens the critical stock list.
   - [ ] After pulling down to refresh, phone A's Dashboard shows the higher "Penjualan hari ini".

### Test 12: Security checks

- [ ] As cashier, the menu never shows Manajemen Stok, Produk & HPP or Karyawan.
- [ ] On employee login, a wrong PIN shows "Kode unik salah". After 5 wrong PINs, the next try shows "Terlalu banyak percobaan. Coba lagi dalam 5 menit." and that employee is locked for 5 minutes. **Do this last**, or use Marcell instead of Abdul.
- [ ] After **Keluar**, reopening the app does not show any business data until you log in again.

### Test 13: Tablet (optional)

Open the app on an Android tablet or iPad and turn it sideways.

- [ ] The cashier screen shows more products per row.
- [ ] Other screens stay readable.

---

## 6. Reset the demo data

Run this before a new test round or before showing the demo. Make sure the server window from step 4 is still running or stopped; either is fine.

```sh
pnpm run demo:reset
```

Wait for `Done in …s`. A reset rebuilds the whole demo business, so on each phone:

- Log in again as owner (old logins stop working; this is expected).
- If the phone will be used for staff PIN login, register it again (Test 5).

> The history always ends "now". Reset within an hour before a demo so "today" and "this month" look right.

---

## 7. If something goes wrong

| What you see | What to do |
| --- | --- |
| Phone: "Tidak dapat terhubung ke server" (cannot connect to server) | Check the server window (step 4, window 1) is running. Check phone and Mac are on the same Wi-Fi. Check the address in `apps/mobile/.env` (step 3.5) is still correct, then stop and restart `pnpm dev:mobile`. |
| Expo Go: "Could not connect to development server" | Phone and Mac on the same Wi-Fi? Try a phone hotspot. Make sure you clicked **Allow** on the Mac's network pop-up (System Settings → Network → Firewall, allow "node"). |
| Expo Go says the project needs a newer version | Update Expo Go from the app store. |
| `command not found: pnpm` / `node` / `createdb` | Close and reopen Terminal. If it persists, repeat step 3.2. |
| `missing script` or `No such file or directory` | You are not in the Organa folder. Run the `cd` step from [Terminal basics](#2-terminal-basics). |
| `pnpm dev:api` stops with "Invalid environment" | The file `apps/api/.env` is missing. Run `cp apps/api/.env.example apps/api/.env`. |
| `pnpm dev:api` says "connection refused" or "database does not exist" | PostgreSQL is not running: `brew services start postgresql@17`. Then run `createdb organa`, `pnpm run setup:local` and `pnpm run demo:reset`. |
| "port 3000 already in use" | The server is already running in another window. Use that one, or close it with `Control + C`. |
| App is stuck on a blank or splash screen | Shake the phone (or press the Expo Go menu), tap **Reload**. |
| Login works but everything is empty | Run `pnpm run demo:reset`, then log in again. |
| Test 6 shows no red "stok kritis" box | Sirloin was already below its limit (from an earlier test round). Reset the demo data and repeat. |
| Employee login says "Perangkat ini belum terdaftar" | Do Test 5 (register the device) as owner first. |

---

## 8. How to report a problem

Please send one message per problem with:

1. **Test and step number**, e.g. "Test 6, step 4".
2. **What you did**, in order.
3. **What you expected** (copy the checkbox text).
4. **What happened instead.**
5. **A screenshot or screen recording** of the phone.
6. **Phone model** and whether it was Android or iPhone.

Example:

> Test 8, step 2. I typed 3750 for Paha Ayam Fillet and tapped SIMPAN & BANDINGKAN. I expected −250 gr in red. It showed 0 gr in green. Screenshot attached. Samsung A54, Android.

If the Terminal window showed red text at that moment, copy it into your message too.

---

## 9. What is not real yet

This is a demo version. These parts are intentionally simulated or not built:

| Feature | Current behaviour |
| --- | --- |
| QRIS, e-wallet and card payments | Simulated: confirmed automatically after 2 seconds. No money moves. |
| Print receipt / send receipt by email | Shows a message that it is not connected yet. |
| OTP by WhatsApp or SMS | Not sent. In demo mode the code is always `123456`. |
| Bulk import, Absensi (attendance), Laporan, Manajemen Meja, Target, Upgrade to Premium, Support | "Segera hadir" (coming soon) screens. |
| Product photos | Upload works (in the product form), but the demo products have no photos yet. |
| AI-written advice | Without an AI key, the advice text is generated from a fixed template. With a key, the AI writes the wording; the numbers always come from the data. |
| Working offline | Not supported; the phone needs a connection. |
| Phone notifications | Shown as a banner inside the app. System notifications need an installed build, not Expo Go. |

---

## 10. Words used in the app

| Word | Meaning |
| --- | --- |
| **HPP** (Harga Pokok Penjualan) | Cost to make one portion: ingredients + labour + overhead. |
| **Margin** | Selling price minus HPP. |
| **Stok Opname** | Physically counting what is on the shelf. |
| **Stok Pintar vs Stok Nyata** / **Perbandingan Stok** | "Smart stock" (what the system expects after sales) vs "real stock" (what was counted). |
| **Selisih** | Difference. Red with `−` = missing stock; orange with `+` = more than expected. |
| **Critical Stock** / **Stok kritis** | Stock at or below the minimum you set; time to reorder. |
| **Potensi Kedaluarsa** | Stock that will expire within 3 days. |
| **Telah Kedaluarsa** | Stock that already expired and was written off this month. |
| **Batch** | One delivery of an ingredient, with its own price and expiry date. The app uses the batch that expires first. |
| **Cabang** | Outlet / branch. |
| **Kepala Dapur** / **Kasir** / **Pemilik** | Head chef / cashier / owner. |

---

*For developers:* automated tests run with `pnpm --filter @organa/shared test` and `pnpm --filter @organa/api test` (the second needs the `organa_test` database). See [README.md](README.md) for the technical overview.
