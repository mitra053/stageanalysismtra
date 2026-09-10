const sectorLookup = {
  NVDA: 'Technology',
  MSFT: 'Technology',
  AAPL: 'Technology',
  AMD: 'Technology',
  META: 'CommunicationServices',
  AMZN: 'ConsumerDiscretionary',
  PLTR: 'Technology',
  AVGO: 'Technology',
  CRM: 'Technology',
  NFLX: 'CommunicationServices',
  TSLA: 'ConsumerDiscretionary',
  SPY: 'BroadMarket',
  QQQ: 'Growth',
  XOM: 'Energy'
};

function calculateSMA(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  const slice = values.slice(-period);
  const total = slice.reduce((sum, value) => sum + Number(value || 0), 0);
  return total / slice.length;
}

function percentChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

function getStageLabel(stage) {
  if (stage === 1) return 'Stage 1';
  if (stage === 2) return 'Stage 2';
  if (stage === 3) return 'Stage 3';
  return 'Stage 4';
}

function determineStageFromCloses(closes, indexReturn = 0) {
  if (!Array.isArray(closes) || closes.length < 50) return 1;

  const latest = closes[closes.length - 1];
  const ma30 = calculateSMA(closes, 30) || latest;
  const ma50 = calculateSMA(closes, 50) || latest;
  const symbolReturn = percentChange(latest, closes[closes.length - 30] || closes[closes.length - 2] || latest);
  const rs = (symbolReturn - indexReturn) * 100;

  if (latest > ma30 && ma30 > ma50 && rs > 0) return 2;
  if (latest < ma30 && ma30 < ma50) return 4;
  if (latest > ma30 && Math.abs(ma30 - ma50) / Math.max(ma50, 1) < 0.05) return 3;
  return 1;
}

async function fetchPriceSeries(symbol, range = '1y', interval = '1d') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}`;
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Request failed for ${symbol}: ${response.status}`);
  }

  const payload = await response.json();
  const chart = payload?.chart?.result?.[0];
  const quote = chart?.indicators?.quote?.[0];

  if (!chart || !quote) {
    throw new Error(`No data for ${symbol}`);
  }

  const closes = (quote.close || []).filter((value) => Number.isFinite(value));
  const highs = (quote.high || []).filter((value) => Number.isFinite(value));
  const lows = (quote.low || []).filter((value) => Number.isFinite(value));
  const volumes = (quote.volume || []).filter((value) => Number.isFinite(value));

  if (closes.length < 50 || highs.length < 50 || lows.length < 50 || volumes.length < 50) {
    throw new Error(`Not enough price history for ${symbol}`);
  }

  return { closes, highs, lows, volumes };
}

function renderSparkline(closes, ma20, ma50) {
  const svg = document.getElementById('priceChart');
  if (!svg) return;

  const recent = closes.slice(-90);
  const values = [...recent, ...ma20.slice(-90), ...ma50.slice(-90)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const xStep = recent.length > 1 ? 860 / (recent.length - 1) : 860;
  const top = 14;
  const bottom = 220;

  const toY = (value) => bottom - ((value - min) / (max - min || 1)) * (bottom - top);

  const pricePath = recent.map((value, index) => `${index === 0 ? 'M' : 'L'} ${index * xStep} ${toY(value)}`).join(' ');
  const ma20Path = ma20.slice(-recent.length).map((value, index) => `${index === 0 ? 'M' : 'L'} ${index * xStep} ${toY(value)}`).join(' ');
  const ma50Path = ma50.slice(-recent.length).map((value, index) => `${index === 0 ? 'M' : 'L'} ${index * xStep} ${toY(value)}`).join(' ');

  svg.innerHTML = `
    <defs>
      <linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.35" />
        <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.02" />
      </linearGradient>
    </defs>
    <path d="${pricePath} L 860 220 L 0 220 Z" fill="url(#areaFill)" opacity="0.9"></path>
    <path d="${ma50Path}" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"></path>
    <path d="${ma20Path}" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"></path>
    <path d="${pricePath}" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
  `;
}

async function loadSymbolData() {
  const params = new URLSearchParams(window.location.search);
  const symbol = (params.get('symbol') || 'NVDA').toUpperCase();
  const titleEl = document.getElementById('symbolTitle');
  if (titleEl) titleEl.textContent = symbol;

  try {
    const [daily, weekly, monthly, benchmark] = await Promise.all([
      fetchPriceSeries(symbol, '1y', '1d'),
      fetchPriceSeries(symbol, '5y', '1wk'),
      fetchPriceSeries(symbol, '10y', '1mo'),
      fetchPriceSeries('SPY', '1y', '1d')
    ]);

    const closes = daily.closes;
    const volumes = daily.volumes;
    const latest = closes[closes.length - 1];
    const previous = closes[closes.length - 2] || latest;
    const ma20 = calculateSMA(closes, 20) || latest;
    const ma50 = calculateSMA(closes, 50) || latest;
    const recentHigh = Math.max(...closes.slice(-30));
    const recentLow = Math.min(...closes.slice(-30));
    const baseRange = ((recentHigh - recentLow) / recentLow) * 100;
    const volAverage = volumes.slice(-20).reduce((sum, value) => sum + value, 0) / Math.max(volumes.slice(-20).length, 1);
    const volumeRatio = (volumes[volumes.length - 1] || 1) / Math.max(volAverage, 1);
    const benchmarkCloses = benchmark.closes;
    const benchmarkReturn = percentChange(
      benchmarkCloses[benchmarkCloses.length - 1],
      benchmarkCloses[benchmarkCloses.length - 30] || benchmarkCloses[benchmarkCloses.length - 2]
    );
    const symbolReturn = percentChange(latest, closes[closes.length - 30] || previous);
    const rs = (symbolReturn - benchmarkReturn) * 100;
    const sector = sectorLookup[symbol] || 'Technology';
    const rawStage = determineStageFromCloses(closes, benchmarkReturn);
    const stage = rawStage;
    const stageLabel = getStageLabel(stage);
    const tfAlignment = `${stage}/${determineStageFromCloses(weekly.closes, benchmarkReturn)}/${determineStageFromCloses(monthly.closes, benchmarkReturn)}`;
    const entryPrice = Number(latest.toFixed(2));
    const stopLoss = Number(Math.min(recentLow * 0.98, ma50 * 0.985).toFixed(2));
    const targetPrice = Number((entryPrice + (entryPrice - stopLoss) * 2.5).toFixed(2));
    const riskPercent = Number((((entryPrice - stopLoss) / entryPrice) * 100).toFixed(2));
    const action = stage === 2 && latest > ma20 && rs > 5 && volumeRatio > 1.1 ? 'Buy' : stage === 1 ? 'Watch' : stage === 4 ? 'Avoid' : 'Hold';

    const setupText = `${sector} ${stage === 2 ? 'breakout continuation' : stage === 1 ? 'base building' : stage === 4 ? 'weak trend' : 'trend structure'} • TF ${tfAlignment}`;

    document.getElementById('priceValue').textContent = `$${latest.toFixed(2)}`;
    document.getElementById('stageValue').textContent = stageLabel;
    document.getElementById('rsValue').textContent = `${rs >= 0 ? '+' : ''}${rs.toFixed(1)}%`;
    document.getElementById('baseValue').textContent = `${baseRange.toFixed(1)}%`;
    document.getElementById('volumeValue').textContent = `${volumeRatio.toFixed(2)}x`;
    document.getElementById('sectorValue').textContent = sector;
    document.getElementById('entryValue').textContent = `$${entryPrice.toFixed(2)}`;
    document.getElementById('stopValue').textContent = `$${stopLoss.toFixed(2)}`;
    document.getElementById('targetValue').textContent = `$${targetPrice.toFixed(2)}`;
    document.getElementById('riskValue').textContent = `${riskPercent.toFixed(2)}%`;
    document.getElementById('alignmentValue').textContent = tfAlignment;
    document.getElementById('stockActionBadge').textContent = action;
    document.getElementById('stockActionBadge').className = action === 'Buy'
      ? 'rounded-full bg-emerald-100 text-emerald-700 px-3 py-1.5 text-xs font-bold'
      : action === 'Watch'
      ? 'rounded-full bg-amber-100 text-amber-700 px-3 py-1.5 text-xs font-bold'
      : action === 'Avoid'
      ? 'rounded-full bg-red-100 text-red-700 px-3 py-1.5 text-xs font-bold'
      : 'rounded-full bg-slate-200 text-slate-700 px-3 py-1.5 text-xs font-bold';

    const setupSummary = document.getElementById('setupSummary');
    setupSummary.innerHTML = `
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div class="flex justify-between"><span class="text-slate-500">Setup</span><strong>${setupText}</strong></div>
      </div>
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div class="flex justify-between"><span class="text-slate-500">Trend above 30W MA</span><strong>${latest > ma50 ? 'Yes' : 'No'}</strong></div>
      </div>
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div class="flex justify-between"><span class="text-slate-500">Relative strength vs SPY</span><strong>${rs.toFixed(1)}%</strong></div>
      </div>
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div class="flex justify-between"><span class="text-slate-500">Volume confirmation</span><strong>${volumeRatio.toFixed(2)}x average</strong></div>
      </div>
    `;

    renderSparkline(closes, calculateSMA(closes, 20) ? closes.map((_, index) => {
      const window = closes.slice(Math.max(0, index - 19), index + 1);
      return window.reduce((sum, value) => sum + value, 0) / window.length;
    }) : closes, calculateSMA(closes, 50) ? closes.map((_, index) => {
      const window = closes.slice(Math.max(0, index - 49), index + 1);
      return window.reduce((sum, value) => sum + value, 0) / window.length;
    }) : closes);

    document.getElementById('rsValue').className = rs >= 0
      ? 'mt-2 text-2xl font-bold text-emerald-700'
      : 'mt-2 text-2xl font-bold text-red-700';
  } catch (error) {
    console.error('Failed to load symbol detail', error);
    document.getElementById('symbolTitle').textContent = (new URLSearchParams(window.location.search)).get('symbol') || 'NVDA';
    document.getElementById('setupSummary').innerHTML = '<p class="text-red-600">Unable to load live price data for this symbol.</p>';
  }
}

loadSymbolData();
