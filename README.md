# Stage Analysis Web App

This project is a static stock-analysis workspace built around Stan Weinstein's four-stage methodology, extended into a complete market dashboard workflow. It combines a TradingView chart, a live technical side panel, a scanner dashboard, and a stock detail page for quick decision-making across symbols.

---

## Documentation index

- [USER_GUIDE.md](USER_GUIDE.md) — how to use the chart, scanner, watchlist, and stage logic
- [ADMIN_GUIDE.md](ADMIN_GUIDE.md) — deployment, hosting, static serving, and operational setup
- [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) — code architecture, data flow, and extension points

---

## What is included

### Chart workspace
- TradingView-based interactive chart
- symbol search and quick ticker buttons
- interval switching for weekly, daily, and monthly views
- chart study toggles for stage overlay, Mansfield RS, and SATA score
- live side panel tied to the active ticker

### Dashboard scanner
- market regime summary
- sector strength view
- stage mix summary
- filters for stage, market regime, sector, RS, and volume
- saved scan presets and saved watchlists
- trade-plan summary with entry, stop, target, and risk

### Symbol detail screen
- per-symbol price summary
- live setup and trend context
- RS and volume calculations
- risk plan and time-frame alignment
- sparkline view for quick chart review

### Technical logic
- 30W moving average and trend analysis
- stage classification using trend and relative strength
- volume confirmation checks
- breakout and risk heuristics
- live Yahoo Finance data fallback plus local derived fallback logic

---

## Project structure

```text
E:/Stage Analysis/
├── index.html                 # main chart page
├── dashboard.html             # scanner dashboard page
├── symbol_detail.html         # symbol detail page
├── dashboard.js               # dashboard scanner and watchlist logic
├── stage_analysis_app.js      # chart lifecycle and symbol sync logic
├── sidepanel.js               # live stage summary and trade plan panel
├── symbol_detail.js           # detail page data and sparkline rendering
├── mansfield_rs.js            # custom Mansfield RS indicator logic
├── stage_classifier.js        # stage classification logic
├── sata_score.js              # SATA score evaluation logic
├── README.md                 # project overview and quick start
├── USER_GUIDE.md             # end-user manual
├── DEVELOPER_GUIDE.md        # engineering reference
├── ADMIN_GUIDE.md            # hosting and deployment notes
├── charting_library/         # TradingView charting library assets
├── datafeeds/                # UDF datafeed bundle
├── custom-dialogs/           # chart customization assets
├── data.json                 # local project data (if used by your environment)
└── *.js                      # supporting market-analysis scripts
```

---

## Quick start

From the project root, serve it locally:

```bash
cd "E:\Stage Analysis"
python -m http.server 8080
```

Then open:

- http://localhost:8080/index.html
- http://localhost:8080/dashboard.html
- http://localhost:8080/symbol_detail.html?symbol=NVDA

You can also use any static server such as Node, VS Code Live Server, or a deployment host.

---

## Notes

- This is a front-end stock-analysis app; it does not require a database.
- Live market data is pulled through Yahoo Finance-compatible endpoints and the app includes fallback logic when a symbol is unavailable.
- The scanner and dashboard are designed as a decision-support tool, not an automated brokerage system.

---

## Version history

- v3.0.0: Added dashboard scanner, saved scans, dynamic watchlist, symbol detail page, live quote summaries, and full end-to-end app flow.
- v2.0.0: Added live stage analysis side panel and improved chart interactions.
- v1.0.0: Initial TradingView-based stage analysis charting app.
