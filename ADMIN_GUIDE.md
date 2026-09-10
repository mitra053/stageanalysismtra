# Admin guide

This app is a static frontend and does not require a database or a server-side API. It is designed to run as any regular HTML site served over HTTP or HTTPS.

---

## 1. Hosting model

The application can be hosted on:

- a simple local Python server
- VS Code Live Server
- Nginx or Apache
- any static hosting service
- internal intranet hosting

No backend runtime is required for the core workflow.

---

## 2. Local run example

```bash
cd "E:\Stage Analysis"
python -m http.server 8080
```

Then browse:

- http://localhost:8080/index.html
- http://localhost:8080/dashboard.html
- http://localhost:8080/symbol_detail.html?symbol=NVDA

---

## 3. Recommended server config

### Nginx example

```nginx
server {
    listen 80;
    server_name stage-analysis.local;
    root /path/to/Stage Analysis;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|svg|woff2)$ {
        expires 7d;
        add_header Cache-Control "public, no-transform";
    }
}
```

### Apache example

```apache
Alias /stage /path/to/Stage Analysis
<Directory "/path/to/Stage Analysis">
    Options Indexes FollowSymLinks
    AllowOverride All
    Require all granted
</Directory>
```

---

## 4. Data source notes

The app uses live market data from Yahoo Finance endpoints for quote and price series requests, plus TradingView chart assets. Some requests can fail for symbols or markets with limited data, which is why the app includes graceful fallback logic.

### Important note

If external endpoints are blocked, the app will still render fallback derived values rather than fail entirely. This keeps the UI usable while warning in the console.

---

## 5. Deployment checklist

Before production deployment, verify:

- all app pages load over the same origin or allowed CORS policy
- local JS assets are served correctly
- charting library path resolves to the correct folder
- HTTPS is enabled if your environment requires secure external requests
- browser console shows no blocking script errors

---

## 6. Troubleshooting

### Chart does not render

Check:

- the TradingView library is present under charting_library/
- the page is served from the correct root directory
- no module path mismatch or browser caching issue exists

### Dashboard shows no data

Check:

- internet access for Yahoo Finance calls
- browser console for fetch errors
- the app is not being blocked by strict cross-origin security policies

### Side panel not updating

Ensure:

- the symbol is valid
- the JS files are loaded in the correct order
- the chart page and panel controller are initialized after DOMContentLoaded

---

## 7. Operational guidance

This project is intentionally lightweight and easy to host. The main operational concern is external market-data availability, not server logic. Keep the repository organized, preserve asset paths, and test key pages after any update to the charting library or JS modules.
