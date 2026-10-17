# Food Log

A small offline-first iPhone PWA for logging home-cooked meals in detail (weights, raw or cooked, oil, cooking method) and exporting a report for any date range. Plain HTML, CSS and JS, no build step, no backend. Everything is stored on the phone in IndexedDB.

## Enable GitHub Pages

1. Push this repo to GitHub (the `main` branch).
2. Open the repo on GitHub, then **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**, branch **main**, folder **/ (root)**, and save.
4. After a minute the app is live at `https://rafialaydrus.github.io/FoodLog/`.

## Add it to the iPhone home screen

1. Open the URL above in **Safari** (it must be Safari).
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Open Food Log from the home screen. It runs full screen and works offline.

Use the home-screen app for all your logging. Safari and the installed app keep separate storage, so data logged in a Safari tab does not appear in the installed app.

## Using it

- **Log**: dish, ingredients with grams and raw/cooked, and an optional collapsible *Cooking details* section. Tap **Save as dish** to keep a meal as a template, then tap its chip at the top of Log to reuse it.
- **History**: grouped by day with gram totals. Tap a meal to edit it, swipe left to delete.
- **Export**: pick a range, then **Copy as text** (paste into Claude), **Download CSV**, or **Share** (iOS share sheet).
- **Backup** (bottom of Export): download a JSON backup and restore it later. Do this now and then, especially before changing phones.

## Changing the accent color

Edit `--accent` at the top of `css/styles.css` (and `theme_color` in `manifest.webmanifest` if you want the status bar to match).

## Updating the app

Installed copies cache files for offline use. After changing any file, bump `CACHE` in `sw.js` (for example `foodlog-v3`) so phones pick up the new version.
