# Developer guide

This document describes how the app is structured and how the main pieces work together.

---

## 1. Architecture overview

The application is a lightweight front-end stack built around:

- TradingView charting library
- static HTML and JavaScript pages
- local UI state and localStorage for custom presets
- live Yahoo Finance-style chart requests for data enrichment
- fallback derived metrics when live data is unavailable

The main pages are:

- [index.html](index.html) — live chart and symbol navigation
- [dashboard.html](dashboard.html) — market scanner and watchlist overview
- [symbol_detail.html](symbol_detail.html) — per-symbol drill-down page

---

## 2. Key files

### [stage_analysis_app.js](stage_analysis_app.js)

This file owns the chart lifecycle and event wiring.

Responsibilities:

- initialize the TradingView widget
- load the symbol and interval
- respond to search, quick symbol buttons, and interval changes
- keep the chart state aligned with the visible symbol
- call the side panel update when ticker changes

Important functions:

- refreshSymbolContext(symbol, interval)
- syncChartState()
- initChart()
- bindUIEvents()

---

### [sidepanel.js](sidepanel.js)

This file renders the live stage analysis panel and computes the technical summary.

Responsibilities:

- fetch live quote and price-series data
- calculate stage, relative strength, and trend context
- generate a trade plan with entry, stop, and target
- render the side panel with market caps, sector, volume, and trade details

Important logic:

- calculateLiveStageMetrics()
- fetchQuoteData()
- fetchChartData()
- enrichProfileWithMarketData()
- render(profile)

---

### [dashboard.js](dashboard.js)

This file contains the scanner engine.

Responsibilities:

- fetch market context and screen symbol set
- compute stock records with stage, RS, volume, and action
- filter the scanner output
- save and load scan presets
- save and open watchlists
- render market summary cards and selected stock detail

Important concepts:

- buildStockRecord()
- refreshScanner()
- getFilteredStocks()
- renderWatchlist()
- renderScanChecklist()
- renderBacktestSummary()

---

### [symbol_detail.js](symbol_detail.js)

This file loads and renders the detail view for an individual stock.

Responsibilities:

- read the symbol from the URL
- fetch price history and benchmark context
- compute action, RS, volume, target/stop, and time-frame alignment
- render the sparkline and summary cards

---

## 3. Data flow

The app uses a simple chain of state updates:

1. User selects a symbol on the chart or dashboard
2. active symbol is stored in the page state
3. the side panel refreshes for that symbol
4. dashboard filter logic optionally changes the selected stock
5. detail page opens with the chosen symbol in the URL query string

This keeps the app responsive without a backend state server.

---

## 4. Key technical rules used

The code uses a mixture of practical heuristics and stage-analysis logic:

- price above or below the 30W moving average
- long-term trend slope direction
- relative strength against benchmark positioning
- volume ratio compared with recent average volume
- breakout and pullback confirmation checks
- risk and reward planning based on ATR-like range approximation

These are intentionally simple and transparent so they are easy to adjust in a static browser app.

---

## 5. Switching the chart datafeed to a local one

If a developer needs to replace the default TradingView demo feed with a local datafeed or a custom UDF-compatible backend, the process is straightforward.

### 5.1 Where the feed is configured

The feed URL is set in [stage_analysis_app.js](stage_analysis_app.js), inside the `initChart()` function.

The key logic is:

```javascript
var datafeedUrl = getParameterByName('dataUrl') || "https://demo-feed-data.tradingview.com";
if (datafeedUrl && !datafeedUrl.startsWith('http')) {
  datafeedUrl = 'https://' + datafeedUrl;
}
```

This means the app supports overriding the feed at runtime through a URL parameter named `dataUrl`.

### 5.2 Recommended developer workflow

1. Start the local datafeed or UDF server.
   - Examples: local Python/Node server, a custom UDF API, or a self-hosted market data endpoint.
   - The endpoint should expose the TradingView-compatible UDF responses expected by the charting library.

2. Confirm the local endpoint is reachable.
   - Example local route:
     - `http://localhost:8081`
     - `http://127.0.0.1:8081` 
   - Make sure CORS is enabled if the browser is fetching from a different origin.

3. Override the feed in the browser URL.
   - Example:

```text
http://localhost:8080/index.html?dataUrl=http://localhost:8081
```

4. If you want to hard-code the local endpoint instead of passing it in the query string, update the code in [stage_analysis_app.js](stage_analysis_app.js):

```javascript
var datafeedUrl = "http://localhost:8081";
```

5. Reload the chart page and verify the trading chart loads data from the local feed.
   - Check browser DevTools > Network tab.
   - Confirm the requests are going to your local endpoint instead of the default demo URL.

### 5.3 Important notes

- Do not change the TradingView library files unless you are intentionally upgrading the charting version.
- If the local endpoint is not UDF-compatible, the widget will not load market data properly.
- The code already supports a URL override via `dataUrl`, which is the safest way to test local feeds without editing source code repeatedly.
- If the local service is running on a different port or domain, update the `dataUrl` string or the query parameter accordingly.

### 5.4 Common troubleshooting

- If the chart shows no candles:
  - confirm the local server is running
  - confirm the endpoint responds with UDF-compatible JSON
  - check browser CORS errors
- If the page still loads the demo feed:
  - verify the query string is correctly spelled as `dataUrl`
  - make sure the `initChart()` function has not been overwritten elsewhere
- If the local endpoint is behind HTTPS:
  - use the correct http/https URL in `dataUrl`

---

## 6. Extension points

### Add a new dashboard filter

Modify the filter controls in [dashboard.html](dashboard.html) and update the logic in [dashboard.js](dashboard.js) in getFilteredStocks().

### Add a new symbol-detail metric

Add the value to the DOM in [symbol_detail.html](symbol_detail.html) and populate it in [symbol_detail.js](symbol_detail.js).

### Add a new chart study

Update the custom indicator registration in [stage_analysis_app.js](stage_analysis_app.js) and add the corresponding indicator logic in the relevant study file.

---

## 7. Good practices for this project

- do not hard-code symbol names in too many places
- keep dashboard filters and page state in sync
- when live data fails, keep the fallback logic visible and graceful
- prefer small, understandable heuristics over opaque model logic

---

## 8. Recommended future enhancements

Possible next steps:

- richer technical scorecards per sector
- saved dashboard layouts by user
- more advanced multi-factor screening
- export to CSV or notes
- deeper chart setup and study presets

These would fit naturally into the current architecture without changing the app model.
