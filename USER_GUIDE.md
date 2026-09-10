# User guide

This guide covers how to use the Stage Analysis app in practice: chart analysis, dashboard screening, and stock drill-down views.

---

## 1. Understand the workflow

The app is designed around three steps:

1. Scan the market on the dashboard
2. Inspect a symbol on the chart page
3. Drill into a stock for deeper setup and risk details

The dashboard and chart page stay aligned around the active symbol, so you can move from scanner to chart to trade plan without losing context.

---

## 2. Stage analysis basics

The core model is Stan Weinstein's four-stage trend framework:

- Stage 1: Basing and consolidation
- Stage 2: Advancing and accumulation
- Stage 3: Topping and distribution
- Stage 4: Declining and markdown

In the app, these stages are derived from price position relative to moving averages and the relative strength trend.

### Typical interpretation

- Stage 2: strongest trend continuation setup
- Stage 1: watchlist or base-building setup
- Stage 3: caution, protect gains
- Stage 4: avoid long-side bias

---

## 3. Chart page

Open the main chart at [index.html](index.html). From there you can:

- search a symbol with the stock search modal
- switch between weekly, daily, and monthly intervals
- toggle the stage overlay, Mansfield RS, and SATA score studies
- open or collapse the side panel
- switch between quick watchlist symbols

### Main chart controls

- Active ticker header: the symbol currently loaded in chart
- Interval selector: controls time-frame context for the chart
- Study toggles: shows or hides technical overlays
- Side panel toggle: opens the live stage breakdown

The side panel is designed to update with the current chart symbol and keep the technical summary in sync.

---

## 4. Dashboard scanner

Open [dashboard.html](dashboard.html) for the screen-focused market view.

### Dashboard sections

- Market regime card
- sector leader card
- stage mix snapshot
- risk mode summary
- watchlist table of filtered names
- scan checklist panel

### Filters

Use the filters to narrow the watchlist by:

- stage
- market regime
- sector
- minimum relative strength
- minimum volume ratio

### Saved scan logic

The dashboard supports:

- saved scan presets
- saved watchlist items
- quick reloading of prior scan settings

This lets you create repeatable setups for bullish, neutral, or defensive market conditions.

---

## 5. Symbol detail page

When you click a stock from the dashboard or active watchlist, the app opens the detail page at [symbol_detail.html](symbol_detail.html).

The detail page includes:

- symbol title and action badge
- 1-year price trend sparkline
- stage, RS, base range, and volume
- sector and trade-plan data
- entry, stop, target, and risk numbers
- time-frame alignment summary

This page is your decision hub for a single ticker after you find a candidate on the scanner.

---

## 6. How to use it for analysis

A practical workflow:

1. Check the dashboard and filter for stage 2 leaders with decent RS and volume.
2. Open the chart page for one of those symbols.
3. Confirm the side panel is painting a healthy trend and not a weak breakdown.
4. Validate the trade plan (entry, stop, target).
5. Move to the symbol detail page for a final quick review before acting.

---

## 7. Risk reminders

This app is a technical decision-support tool. It does not place trades or manage execution. Always confirm:

- broader market regime
- sector leadership
- volume confirmation
- stop placement
- risk tolerance

Use the output as a research aid, not as financial advice.
