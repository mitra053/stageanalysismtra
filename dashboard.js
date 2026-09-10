const scannerSymbols = ['NVDA', 'MSFT', 'AAPL', 'AMD', 'META', 'AMZN', 'PLTR', 'AVGO', 'CRM', 'NFLX', 'TSLA', 'SPY', 'QQQ', 'XOM'];
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

const fallbackStocks = [
  { ticker: 'NVDA', stage: 2, stageLabel: 'Stage 2', rs: 18.4, base: 26.8, volume: 1.8, sector: 'Technology', marketRegime: 'Bullish', setup: 'Technology breakout', action: 'Buy', breakoutConfirmed: true, entryPrice: 122.4, stopLoss: 116.8, targetPrice: 136.7 },
  { ticker: 'MSFT', stage: 2, stageLabel: 'Stage 2', rs: 12.8, base: 21.5, volume: 1.3, sector: 'Technology', marketRegime: 'Bullish', setup: 'Technology trend continuation', action: 'Buy', breakoutConfirmed: true, entryPrice: 420.2, stopLoss: 404.1, targetPrice: 447.8 },
  { ticker: 'AAPL', stage: 1, stageLabel: 'Stage 1', rs: 6.1, base: 18.2, volume: 1.1, sector: 'Technology', marketRegime: 'Bullish', setup: 'Technology base building', action: 'Watch', breakoutConfirmed: false, entryPrice: 216.5, stopLoss: 208.9, targetPrice: 232.8 },
  { ticker: 'AMD', stage: 2, stageLabel: 'Stage 2', rs: 15.2, base: 23.9, volume: 1.7, sector: 'Technology', marketRegime: 'Bullish', setup: 'Technology breakout', action: 'Buy', breakoutConfirmed: true, entryPrice: 168.5, stopLoss: 158.1, targetPrice: 181.7 },
  { ticker: 'TSLA', stage: 4, stageLabel: 'Stage 4', rs: -9.4, base: 32.8, volume: 2.4, sector: 'ConsumerDiscretionary', marketRegime: 'Bullish', setup: 'ConsumerDiscretionary weak trend', action: 'Avoid', breakoutConfirmed: false, entryPrice: 207.3, stopLoss: 192.6, targetPrice: 214.9 }
];

const watchlistBody = document.getElementById('watchlistTableBody');
const scanChecklistContainer = document.getElementById('scanChecklist');
const stageFilter = document.getElementById('stageFilter');
const marketFilter = document.getElementById('marketFilter');
const sectorFilter = document.getElementById('sectorFilter');
const rsFilter = document.getElementById('rsFilter');
const volumeFilter = document.getElementById('volumeFilter');
const tickerSearch = document.getElementById('tickerSearch');
const scanNowBtn = document.getElementById('scanNowBtn');
const saveScanBtn = document.getElementById('saveScanBtn');
const saveWatchlistBtn = document.getElementById('saveWatchlistBtn');
const loadScanPresetBtn = document.getElementById('loadScanPresetBtn');
const savedScanPresetSelect = document.getElementById('savedScanPresetSelect');
const savedScanSummary = document.getElementById('savedScanSummary');
const savedWatchlistList = document.getElementById('savedWatchlistList');

const STORAGE_KEYS = {
  scanningPresets: 'stage-analysis-scanning-presets',
  watchlist: 'stage-analysis-saved-watchlist'
};

const state = {
  stocks: [...fallbackStocks],
  marketContext: {
    regime: 'Bullish',
    benchmarkReturn: 3.4,
    sectorLeader: { label: 'Technology', returnPct: 8.6 }
  },
  backtest: {
    winRate: 0,
    avgR: 0,
    expectancy: 0,
    bestSector: 'Technology'
  },
  selectedTicker: 'NVDA'
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
  const priceAbove30 = latest > ma30;

  if (latest > ma30 && ma30 > ma50 && rs > 0) return 2;
  if (latest < ma30 && ma30 < ma50) return 4;
  if (latest > ma30 && Math.abs(ma30 - ma50) / Math.max(ma50, 1) < 0.05) return 3;
  return 1;
}

function determineSetup(stage, rs, volumeRatio, priceAbove30, sectorName, marketRegime, tfAlignment = '2/1/1') {
  const sectorLabel = sectorName || 'Market';
  if (stage === 2 && priceAbove30 && rs > 5 && volumeRatio > 1.1) return `${sectorLabel} breakout continuation • ${tfAlignment}`;
  if (stage === 2 && rs > 0) return `${sectorLabel} trend continuation • ${tfAlignment}`;
  if (stage === 1) return `${sectorLabel} base building • ${tfAlignment}`;
  if (stage === 3) return `${marketRegime === 'Bullish' ? 'Late-stage strength' : 'Late-stage weakness'} • ${tfAlignment}`;
  if (stage === 4) return `${sectorLabel} weak trend • ${tfAlignment}`;
  return `Watch • ${tfAlignment}`;
}

function determineAction(stage, rs, volumeRatio, priceAbove30, sectorStrength, marketRegime, multiTimeframeConfirmed) {
  const breakoutConfirmed = stage === 2 && priceAbove30 && rs > 5 && volumeRatio > 1.1 && sectorStrength >= 0;
  const regimeAligned = marketRegime === 'Bullish' ? sectorStrength >= -2 : true;
  if (breakoutConfirmed && regimeAligned && multiTimeframeConfirmed) return 'Buy';
  if (stage === 1 && rs > 0) return 'Watch';
  if (stage === 4) return 'Avoid';
  if (stage === 3) return 'Watch';
  return 'Hold';
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

async function fetchMarketContext() {
  const benchmark = await fetchPriceSeries('SPY');
  const benchmarkCloses = benchmark.closes;
  const benchmarkReturn = percentChange(
    benchmarkCloses[benchmarkCloses.length - 1],
    benchmarkCloses[benchmarkCloses.length - 30] || benchmarkCloses[benchmarkCloses.length - 2]
  );

  const sectorSymbols = ['XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLC', 'XLRE'];
  const sectorMetrics = [];

  for (const symbol of sectorSymbols) {
    try {
      const series = await fetchPriceSeries(symbol);
      const closes = series.closes;
      const latest = closes[closes.length - 1];
      const ma30 = calculateSMA(closes, 30) || latest;
      const sectorReturn = percentChange(latest, closes[closes.length - 30] || closes[closes.length - 2]);
      const sectorName = {
        XLK: 'Technology',
        XLF: 'Financials',
        XLE: 'Energy',
        XLV: 'HealthCare',
        XLI: 'Industrials',
        XLY: 'ConsumerDiscretionary',
        XLP: 'ConsumerStaples',
        XLU: 'Utilities',
        XLC: 'CommunicationServices',
        XLRE: 'RealEstate'
      }[symbol] || symbol;

      sectorMetrics.push({
        label: sectorName,
        symbol,
        returnPct: sectorReturn * 100,
        trend: latest > ma30 ? 1 : -1
      });
    } catch (error) {
      console.warn(`Sector lookup failed for ${symbol}:`, error);
    }
  }

  sectorMetrics.sort((a, b) => b.returnPct - a.returnPct);
  const regime = benchmarkReturn > 4 ? 'Bullish' : benchmarkReturn < -4 ? 'Bearish' : 'Neutral';

  return {
    benchmarkReturn,
    regime,
    sectorLeader: sectorMetrics[0] || { label: 'Technology', returnPct: 0 },
    sectors: sectorMetrics
  };
}

function buildStockRecord(symbol, series, indexReturn, marketContext, timeframes = {}) {
  const closes = series.closes;
  const volumes = series.volumes;
  const latest = closes[closes.length - 1];
  const previous = closes[closes.length - 2] || latest;
  const ma30 = calculateSMA(closes, 30) || latest;
  const ma50 = calculateSMA(closes, 50) || latest;
  const recentHigh = Math.max(...closes.slice(-30));
  const recentLow = Math.min(...closes.slice(-30));
  const baseRange = ((recentHigh - recentLow) / recentLow) * 100;
  const volAverage = volumes.slice(-20).reduce((sum, value) => sum + value, 0) / Math.max(volumes.slice(-20).length, 1);
  const volumeRatio = (volumes[volumes.length - 1] || 1) / Math.max(volAverage, 1);
  const symbolReturn = percentChange(latest, closes[closes.length - 30] || previous);
  const rs = (symbolReturn - indexReturn) * 100;
  const priceAbove30 = latest > ma30;
  const sectorName = sectorLookup[symbol] || 'Technology';
  const sectorMetric = (marketContext?.sectors || []).find((item) => item.label === sectorName) || {
    label: sectorName,
    returnPct: 0,
    trend: 1
  };
  const sectorStrength = sectorMetric.returnPct - (marketContext?.benchmarkReturn || 0) * 100;

  let stage = 1;
  if (latest > ma30 && ma30 > ma50 && rs > 0) {
    stage = 2;
  } else if (latest < ma30 && ma30 < ma50) {
    stage = 4;
  } else if (latest > ma30 && Math.abs(ma30 - ma50) / Math.max(ma50, 1) < 0.05) {
    stage = 3;
  }

  const dailyStage = stage;
  const weeklyStage = determineStageFromCloses(timeframes.weekly?.closes || closes, marketContext?.benchmarkReturn || 0);
  const monthlyStage = determineStageFromCloses(timeframes.monthly?.closes || closes, marketContext?.benchmarkReturn || 0);
  const tfAlignment = `${dailyStage}/${weeklyStage}/${monthlyStage}`;
  const multiTimeframeConfirmed = [dailyStage, weeklyStage, monthlyStage].filter((value) => value === 2).length >= 2;
  const stageLabel = getStageLabel(stage);
  const breakoutConfirmed = stage === 2 && priceAbove30 && rs > 5 && volumeRatio > 1.1 && sectorStrength >= -2;
  const baseLow = recentLow * 0.98;
  const entryPrice = Number(latest.toFixed(2));
  const stopLoss = Number(Math.min(baseLow, ma30 * 0.985).toFixed(2));
  const targetPrice = Number((entryPrice + (entryPrice - stopLoss) * 2.5).toFixed(2));
  const riskPercent = Number((((entryPrice - stopLoss) / entryPrice) * 100).toFixed(2));

  return {
    ticker: symbol,
    stage,
    stageLabel,
    sector: sectorName,
    marketRegime: marketContext?.regime || 'Bullish',
    rs: Number(rs.toFixed(1)),
    base: Number(baseRange.toFixed(1)),
    volume: Number(volumeRatio.toFixed(2)),
    breakoutConfirmed,
    multiTimeframeConfirmed,
    tfAlignment,
    entryPrice,
    stopLoss,
    targetPrice,
    riskPercent,
    setup: determineSetup(stage, rs, volumeRatio, priceAbove30, sectorName, marketContext?.regime || 'Bullish', tfAlignment),
    action: determineAction(stage, rs, volumeRatio, priceAbove30, sectorStrength, marketContext?.regime || 'Bullish', multiTimeframeConfirmed),
    latestPrice: latest,
    lastPrice: latest
  };
}

async function refreshScanner() {
  try {
    const marketContext = await fetchMarketContext();
    state.marketContext = marketContext;

    const liveStocks = [];

    for (const symbol of scannerSymbols) {
      try {
        const [dailySeries, weeklySeries, monthlySeries] = await Promise.all([
          fetchPriceSeries(symbol, '1y', '1d'),
          fetchPriceSeries(symbol, '5y', '1wk'),
          fetchPriceSeries(symbol, '10y', '1mo')
        ]);

        const record = buildStockRecord(symbol, dailySeries, marketContext.benchmarkReturn, marketContext, {
          weekly: weeklySeries,
          monthly: monthlySeries
        });

        liveStocks.push(record);
      } catch (error) {
        console.warn(`Skipping ${symbol}:`, error);
      }
    }

    state.stocks = liveStocks.length ? liveStocks.sort((a, b) => b.rs - a.rs || b.volume - a.volume) : [...fallbackStocks];
    updateMarketSummary();
    renderWatchlist();
    renderScanChecklist();
  } catch (error) {
    console.warn('Scanner fell back to defaults:', error);
    state.marketContext = {
      regime: 'Bullish',
      benchmarkReturn: 3.4,
      sectorLeader: { label: 'Technology', returnPct: 8.6 }
    };
    state.stocks = [...fallbackStocks];
    updateMarketSummary();
    renderWatchlist();
    renderScanChecklist();
  }
}

function getFilteredStocks() {
  const selectedStage = stageFilter.value;
  const selectedMarket = marketFilter.value;
  const selectedSector = sectorFilter.value;
  const minRS = Number(rsFilter.value || 0);
  const minVolume = Number(volumeFilter.value || 0.8);
  const searchValue = (tickerSearch.value || '').trim().toUpperCase();

  return state.stocks.filter((stock) => {
    const stageMatch = selectedStage === 'all' || String(stock.stage) === selectedStage;
    const marketMatch = selectedMarket === 'all' || (stock.marketRegime || state.marketContext?.regime || 'Bullish') === selectedMarket;
    const sectorMatch = selectedSector === 'all' || (stock.sector || 'Technology') === selectedSector;
    const rsMatch = stock.rs >= minRS;
    const volumeMatch = stock.volume >= minVolume;
    const searchMatch = !searchValue || stock.ticker.includes(searchValue);
    return stageMatch && marketMatch && sectorMatch && rsMatch && volumeMatch && searchMatch;
  });
}

function updateMarketSummary() {
  const marketRegimeValue = document.getElementById('marketRegimeValue');
  const marketRegimeNote = document.getElementById('marketRegimeNote');
  const sectorLeaderValue = document.getElementById('sectorLeaderValue');
  const sectorLeaderNote = document.getElementById('sectorLeaderNote');
  const stageMixValue = document.getElementById('stageMixValue');
  const stageMixNote = document.getElementById('stageMixNote');
  const riskModeValue = document.getElementById('riskModeValue');
  const riskModeNote = document.getElementById('riskModeNote');

  const marketRegime = state.marketContext?.regime || 'Bullish';
  const sectorLeader = state.marketContext?.sectorLeader?.label || 'Technology';
  const stageCounts = {
    1: state.stocks.filter((stock) => stock.stage === 1).length,
    2: state.stocks.filter((stock) => stock.stage === 2).length,
    3: state.stocks.filter((stock) => stock.stage === 3).length,
    4: state.stocks.filter((stock) => stock.stage === 4).length
  };
  const riskMode = state.stocks.some((stock) => stock.action === 'Buy') ? 'Moderate' : 'Defensive';

  if (marketRegimeValue) marketRegimeValue.textContent = marketRegime;
  if (marketRegimeNote) marketRegimeNote.textContent = marketRegime === 'Bullish' ? 'Trend remains constructive with strong sector leadership' : marketRegime === 'Bearish' ? 'Market is weak and defensive positioning is preferred' : 'Trend is mixed and risk should stay controlled';
  if (sectorLeaderValue) sectorLeaderValue.textContent = sectorLeader;
  if (sectorLeaderNote) sectorLeaderNote.textContent = `Leading sector strength is ${state.marketContext?.sectorLeader?.returnPct?.toFixed(1) || '0.0'}% versus the benchmark`;
  if (stageMixValue) stageMixValue.textContent = `${stageCounts[2]} / ${stageCounts[1]} / ${stageCounts[4]}`;
  if (stageMixNote) stageMixNote.textContent = `Stage 2 leaders: ${stageCounts[2]}, Stage 1 bases: ${stageCounts[1]}, Stage 4 weak: ${stageCounts[4]}`;
  if (riskModeValue) riskModeValue.textContent = riskMode;
  if (riskModeNote) riskModeNote.textContent = riskMode === 'Moderate' ? 'Breakout entries remain valid but keep stops tight near support' : 'Prioritize patience and avoid weak setups until trend improves';
}

function openSymbolDetail(symbol) {
  if (!symbol) return;
  window.location.href = `symbol_detail.html?symbol=${encodeURIComponent(symbol)}`;
}

function renderWatchlist() {
  const filteredStocks = getFilteredStocks();

  if (!filteredStocks.length) {
    watchlistBody.innerHTML = `
      <tr>
        <td colspan="7" class="px-4 py-10 text-center text-slate-500">
          No stocks match the current scanner filters.
        </td>
      </tr>
    `;
    return;
  }

  if (!filteredStocks.some((stock) => stock.ticker === state.selectedTicker)) {
    state.selectedTicker = filteredStocks[0].ticker;
  }

  watchlistBody.innerHTML = filteredStocks.map((stock) => {
    const stageClass =
      stock.stage === 2
        ? 'bg-emerald-100 text-emerald-700'
        : stock.stage === 1
        ? 'bg-amber-100 text-amber-700'
        : stock.stage === 3
        ? 'bg-sky-100 text-sky-700'
        : 'bg-red-100 text-red-700';

    const actionClass =
      stock.action === 'Buy'
        ? 'bg-emerald-100 text-emerald-700'
        : stock.action === 'Watch'
        ? 'bg-amber-100 text-amber-700'
        : stock.action === 'Avoid'
        ? 'bg-red-100 text-red-700'
        : 'bg-slate-200 text-slate-700';

    const riskDisplay = Number(stock.riskPercent || 1.5).toFixed(2);
    const tfStatus = stock.tfAlignment ? `TF ${stock.tfAlignment}` : 'TF 2/1/1';
    const isSelected = stock.ticker === state.selectedTicker;

    return `
      <tr class="border-b border-slate-200 hover:bg-slate-50 cursor-pointer ${isSelected ? 'bg-indigo-50' : ''}" data-ticker="${stock.ticker}">
        <td class="px-4 py-3 font-semibold text-slate-900">${stock.ticker}</td>
        <td class="px-4 py-3"><span class="px-2 py-1 rounded-full text-xs font-semibold ${stageClass}">${stock.stageLabel}</span></td>
        <td class="px-4 py-3 ${stock.rs >= 0 ? 'text-emerald-700' : 'text-red-700'} font-semibold">${stock.rs >= 0 ? '+' : ''}${stock.rs.toFixed(1)}%</td>
        <td class="px-4 py-3">${stock.base.toFixed(1)}%</td>
        <td class="px-4 py-3">${stock.volume.toFixed(2)}x</td>
        <td class="px-4 py-3 text-slate-600">${stock.setup}<br><span class="text-[10px] text-slate-500">${tfStatus} • ${stock.sector || 'Market'}</span></td>
        <td class="px-4 py-3">
          <div class="flex flex-col gap-1">
            <span class="px-2 py-1 rounded-full text-xs font-semibold ${actionClass}">${stock.action}</span>
            <span class="text-[10px] text-slate-500">Risk ${riskDisplay}%</span>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  watchlistBody.querySelectorAll('tr[data-ticker]').forEach((row) => {
    row.addEventListener('click', (event) => {
      const ticker = row.getAttribute('data-ticker');
      if (!ticker) return;

      if (event.target && event.target.closest('button')) {
        return;
      }

      state.selectedTicker = ticker;
      renderStockDetail();
      renderWatchlist();
      openSymbolDetail(ticker);
    });
  });

  renderStockDetail();
}

function renderScanChecklist() {
  const selectedStage = stageFilter.value;
  const selectedMarket = marketFilter.value;
  const selectedSector = sectorFilter.value;
  const minRS = Number(rsFilter.value || 0);
  const minVolume = Number(volumeFilter.value || 0.8);
  const marketRegime = state.marketContext?.regime || 'Bullish';
  const breakoutCount = state.stocks.filter((stock) => stock.breakoutConfirmed).length;
  const tfCount = state.stocks.filter((stock) => stock.multiTimeframeConfirmed).length;
  const riskCount = state.stocks.filter((stock) => Number(stock.riskPercent || 0) <= 2).length;

  const checklist = [
    { label: `Stage filter: ${selectedStage === 'all' ? 'All' : `Stage ${selectedStage}`}`, ok: true },
    { label: `Market regime: ${selectedMarket === 'all' ? marketRegime : selectedMarket}`, ok: selectedMarket === 'all' || selectedMarket === marketRegime },
    { label: `Sector focus: ${selectedSector === 'all' ? (state.marketContext?.sectorLeader?.label || 'Technology') : selectedSector}`, ok: selectedSector === 'all' || selectedSector === (state.marketContext?.sectorLeader?.label || 'Technology') || selectedSector === 'all' },
    { label: `RS >= ${minRS}%`, ok: true },
    { label: `Volume >= ${minVolume.toFixed(1)}x`, ok: true },
    { label: `Multi-timeframe trend: ${tfCount} names`, ok: tfCount > 0 },
    { label: `Breakout confirmed: ${breakoutCount} names`, ok: breakoutCount > 0 },
    { label: `Risk within 1-2%: ${riskCount} names`, ok: riskCount > 0 }
  ];

  scanChecklistContainer.innerHTML = checklist.map((item) => `
    <div class="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <span class="text-slate-700 font-medium">${item.label}</span>
      <span class="text-xs font-bold ${item.ok ? 'text-emerald-600' : 'text-amber-600'}">
        ${item.ok ? 'PASS' : 'WAIT'}
      </span>
    </div>
  `).join('');
}

function getSavedScanPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.scanningPresets);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function saveScanPreset() {
  const preset = {
    name: `${stageFilter.value === 'all' ? 'All' : `Stage ${stageFilter.value}`} | ${marketFilter.value} | ${sectorFilter.value === 'all' ? 'All sectors' : sectorFilter.value}`,
    stage: stageFilter.value,
    market: marketFilter.value,
    sector: sectorFilter.value,
    rs: rsFilter.value,
    volume: volumeFilter.value,
    ticker: tickerSearch.value || ''
  };

  const presets = getSavedScanPresets();
  const next = [...presets, preset].slice(-8);
  localStorage.setItem(STORAGE_KEYS.scanningPresets, JSON.stringify(next));
  renderSavedScanPresets();
  if (savedScanSummary) {
    savedScanSummary.textContent = `Saved preset: ${preset.name}`;
  }
}

function renderSavedScanPresets() {
  if (!savedScanPresetSelect) return;

  const presets = getSavedScanPresets();
  if (!presets.length) {
    savedScanPresetSelect.innerHTML = '<option value="">No saved scans yet</option>';
    return;
  }

  savedScanPresetSelect.innerHTML = '<option value="">Select a saved scan</option>' + presets.map((preset, index) => `
    <option value="${index}">${preset.name}</option>
  `).join('');
}

function loadSavedScanPreset() {
  if (!savedScanPresetSelect || !savedScanPresetSelect.value) return;
  const presets = getSavedScanPresets();
  const preset = presets[Number(savedScanPresetSelect.value)];
  if (!preset) return;

  stageFilter.value = preset.stage || 'all';
  marketFilter.value = preset.market || 'all';
  sectorFilter.value = preset.sector || 'all';
  rsFilter.value = preset.rs || '0';
  volumeFilter.value = preset.volume || '0.8';
  tickerSearch.value = preset.ticker || '';
  renderWatchlist();
  renderScanChecklist();

  if (savedScanSummary) {
    savedScanSummary.textContent = `Loaded preset: ${preset.name}`;
  }
}

function getSavedWatchlist() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.watchlist);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function saveCurrentWatchlist() {
  const watchlist = getFilteredStocks().map((stock) => stock.ticker);
  localStorage.setItem(STORAGE_KEYS.watchlist, JSON.stringify(watchlist));
  renderSavedWatchlist();
}

function renderSavedWatchlist() {
  if (!savedWatchlistList) return;

  const list = getSavedWatchlist();
  if (!list.length) {
    savedWatchlistList.innerHTML = '<li class="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-slate-500">No saved names yet.</li>';
    return;
  }

  savedWatchlistList.innerHTML = list.map((ticker) => `
    <li class="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <span class="font-semibold text-slate-800">${ticker}</span>
      <button class="text-xs text-indigo-600 font-semibold" data-watchlist-ticker="${ticker}">Scan</button>
    </li>
  `).join('');

  savedWatchlistList.querySelectorAll('[data-watchlist-ticker]').forEach((button) => {
    button.addEventListener('click', () => {
      const ticker = button.getAttribute('data-watchlist-ticker');
      if (!ticker) return;
      tickerSearch.value = ticker;
      renderWatchlist();
      renderScanChecklist();
      openSymbolDetail(ticker);
    });
  });
}

function calculateBacktestSummary(stocks) {
  const buyCandidates = stocks.filter((stock) => stock.action === 'Buy' || stock.action === 'Watch');
  if (!buyCandidates.length) {
    return {
      winRate: 0,
      avgR: 0,
      expectancy: 0,
      bestSector: 'Technology'
    };
  }

  const records = buyCandidates.map((stock) => {
    const rewardRisk = stock.entryPrice && stock.stopLoss ? ((stock.targetPrice - stock.entryPrice) / Math.max(stock.entryPrice - stock.stopLoss, 0.01)) : 1.5;
    const winChance = stock.rs >= 0 && stock.breakoutConfirmed ? 0.63 : stock.rs >= 0 ? 0.52 : 0.38;
    return {
      winChance,
      rMultiple: Number(rewardRisk.toFixed(2)),
      sector: stock.sector || 'Technology',
      rs: Number(stock.rs || 0)
    };
  });

  const avgR = records.reduce((sum, record) => sum + record.rMultiple, 0) / records.length;
  const expectancy = records.reduce((sum, record) => sum + (record.winChance * record.rMultiple - (1 - record.winChance) * 1), 0) / records.length;
  const winRate = Math.round((records.filter((record) => record.winChance >= 0.5).length / records.length) * 100);
  const sectorMap = {};
  records.forEach((record) => {
    sectorMap[record.sector] = (sectorMap[record.sector] || 0) + record.winChance;
  });
  const bestSector = Object.entries(sectorMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Technology';

  return {
    winRate,
    avgR: Number(avgR.toFixed(2)),
    expectancy: Number(expectancy.toFixed(2)),
    bestSector
  };
}

function renderBacktestSummary() {
  const summary = calculateBacktestSummary(state.stocks);
  state.backtest = summary;

  const winRateEl = document.getElementById('backtestWinRate');
  const avgREl = document.getElementById('backtestAvgR');
  const expectancyEl = document.getElementById('backtestExpectancy');
  const bestSectorEl = document.getElementById('backtestBestSector');

  if (winRateEl) winRateEl.textContent = `${summary.winRate}%`;
  if (avgREl) avgREl.textContent = `${summary.avgR.toFixed(1)}`;
  if (expectancyEl) expectancyEl.textContent = `${summary.expectancy.toFixed(1)}%`;
  if (bestSectorEl) bestSectorEl.textContent = summary.bestSector;
}

function renderStockDetail() {
  const detailCard = document.getElementById('tickerDetailCard');
  if (!detailCard) return;

  const selectedStock = state.stocks.find((stock) => stock.ticker === state.selectedTicker) || state.stocks[0];
  if (!selectedStock) {
    detailCard.innerHTML = '<p class="text-slate-500">No stock selected.</p>';
    return;
  }

  detailCard.innerHTML = `
    <div class="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
      <div>
        <p class="text-xs uppercase font-semibold tracking-wide text-slate-500">Selected stock</p>
        <h3 class="mt-1 text-3xl font-bold text-slate-900">${selectedStock.ticker}</h3>
      </div>
      <span class="rounded-full bg-emerald-100 text-emerald-700 px-2 py-1 text-xs font-semibold">${selectedStock.action}</span>
    </div>

    <div class="mt-4 grid grid-cols-2 gap-3">
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p class="text-[10px] uppercase tracking-wide text-slate-500">Price</p>
        <p class="mt-1 text-lg font-bold text-slate-900">$${Number(selectedStock.latestPrice || selectedStock.lastPrice || 0).toFixed(2)}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p class="text-[10px] uppercase tracking-wide text-slate-500">Stage</p>
        <p class="mt-1 text-lg font-bold text-slate-900">${selectedStock.stageLabel}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p class="text-[10px] uppercase tracking-wide text-slate-500">RS</p>
        <p class="mt-1 text-lg font-bold ${selectedStock.rs >= 0 ? 'text-emerald-700' : 'text-red-700'}">${selectedStock.rs >= 0 ? '+' : ''}${selectedStock.rs.toFixed(1)}%</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p class="text-[10px] uppercase tracking-wide text-slate-500">Volume</p>
        <p class="mt-1 text-lg font-bold text-slate-900">${selectedStock.volume.toFixed(2)}x</p>
      </div>
    </div>

    <div class="mt-4 space-y-3 text-sm text-slate-700">
      <div class="flex justify-between"><span>Sector</span><strong>${selectedStock.sector}</strong></div>
      <div class="flex justify-between"><span>Regime</span><strong>${selectedStock.marketRegime}</strong></div>
      <div class="flex justify-between"><span>Setup</span><strong>${selectedStock.setup}</strong></div>
      <div class="flex justify-between"><span>TF</span><strong>${selectedStock.tfAlignment || '2/1/1'}</strong></div>
      <div class="flex justify-between"><span>Entry</span><strong>$${selectedStock.entryPrice?.toFixed(2) || '0.00'}</strong></div>
      <div class="flex justify-between"><span>Stop</span><strong>$${selectedStock.stopLoss?.toFixed(2) || '0.00'}</strong></div>
      <div class="flex justify-between"><span>Target</span><strong>$${selectedStock.targetPrice?.toFixed(2) || '0.00'}</strong></div>
      <div class="flex justify-between"><span>Risk</span><strong>${selectedStock.riskPercent?.toFixed(2) || '0.00'}%</strong></div>
    </div>
  `;
}

function bindScannerControls() {
  [stageFilter, marketFilter, sectorFilter, rsFilter, volumeFilter, tickerSearch].forEach((control) => {
    control.addEventListener('input', () => {
      renderWatchlist();
      renderScanChecklist();
    });

    control.addEventListener('change', () => {
      renderWatchlist();
      renderScanChecklist();
    });
  });

  scanNowBtn.addEventListener('click', () => {
    refreshScanner();
  });

  saveScanBtn?.addEventListener('click', saveScanPreset);
  loadScanPresetBtn?.addEventListener('click', loadSavedScanPreset);
  saveWatchlistBtn?.addEventListener('click', saveCurrentWatchlist);
}

bindScannerControls();
renderSavedScanPresets();
renderSavedWatchlist();
renderBacktestSummary();
refreshScanner();
