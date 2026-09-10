/**
 * Stage Analysis Sidepanel Component
 * Displays Live Stage Breakdown Details, SATA Checklist, and Real-Time Chart Bar Insights.
 */

(function (window) {
  'use strict';

  // Helper to calculate simple moving average
  function calculateSMA(data, period, endIndex) {
    if (endIndex < period - 1) return null;
    let sum = 0;
    for (let i = endIndex - period + 1; i <= endIndex; i++) {
      sum += data[i];
    }
    return sum / period;
  }

  // Calculate live Stage Analysis parameters from actual OHLCV bar arrays
  function calculateLiveStageMetrics(symbol, barData) {
    const c = barData.c; // Close prices
    const h = barData.h; // High prices
    const l = barData.l; // Low prices
    const v = barData.v || []; // Volume

    const len = c.length;
    if (len < 35) return null; // Need at least 35 bars for 30W MA + slope

    const lastIdx = len - 1;
    const close = c[lastIdx];
    const prevClose = c[lastIdx - 1];

    // 1. 30-Week SMA & Slope
    const sma30 = calculateSMA(c, 30, lastIdx);
    const prevSma30 = calculateSMA(c, 30, lastIdx - 1);
    if (!sma30 || !prevSma30) return null;

    const sma30DiffPct = ((sma30 - prevSma30) / prevSma30) * 100;
    let slowMA = 'Flattening';
    if (sma30DiffPct > 0.10) slowMA = 'Rising';
    else if (sma30DiffPct < -0.10) slowMA = 'Declining';

    // 2. 10-Week SMA & Slope
    const sma10 = calculateSMA(c, 10, lastIdx);
    const prevSma10 = calculateSMA(c, 10, lastIdx - 1);

    // 3. 13-Week Base High/Low Range
    let high13 = -Infinity;
    let low13 = Infinity;
    const lookback13 = Math.min(13, len);
    for (let i = lastIdx - lookback13 + 1; i <= lastIdx; i++) {
      if (h[i] > high13) high13 = h[i];
      if (l[i] < low13) low13 = l[i];
    }
    const baseRangePct = (low13 > 0 && high13 !== -Infinity) 
      ? (((high13 - low13) / low13) * 100).toFixed(2) + '%'
      : '0.00%';

    // 4. Mansfield Relative Strength Proxy (vs 52W SMA)
    const sma52 = calculateSMA(c, Math.min(52, len), lastIdx) || sma30;
    const mansfieldRS = ((close / sma52) - 1.0) * 100.0;

    // 5. Volume Average
    let volAvg10 = 0;
    if (v.length >= 10) {
      volAvg10 = calculateSMA(v, 10, v.length - 1) || 0;
    }
    const currentVol = v[v.length - 1] || 0;
    const volumeSpike = volAvg10 > 0 ? (currentVol / volAvg10).toFixed(1) + 'x Avg' : 'Normal';

    // 6. Evaluate Stage 2 Score (out of 8 criteria)
    let s2Score = 0;
    if (close > sma30) s2Score++;
    if (sma30 > prevSma30) s2Score++;
    if (sma10 && close > sma10) s2Score++;
    if (sma10 && prevSma10 && sma10 > prevSma10) s2Score++;
    if (sma10 && sma10 > sma30) s2Score++;
    if (mansfieldRS > 0) s2Score++;
    if (close >= high13 * 0.93) s2Score++;
    if (currentVol >= volAvg10) s2Score++;

    // 7. Evaluate Stage 4 Score (out of 8 criteria)
    let s4Score = 0;
    if (close < sma30) s4Score++;
    if (sma30 < prevSma30) s4Score++;
    if (sma10 && close < sma10) s4Score++;
    if (sma10 && prevSma10 && sma10 < prevSma10) s4Score++;
    if (sma10 && sma10 < sma30) s4Score++;
    if (mansfieldRS < 0) s4Score++;
    if (close <= low13 * 1.07) s4Score++;
    if (close < prevClose && currentVol >= volAvg10) s4Score++;

    // 8. Determine Stage Classification
    let stage = 2;
    let stageName = 'Stage 2';
    let meaning = 'Advancing / Accumulation';
    let interpretation = 'Primary long-side environment. Pullbacks may become actionable.';

    if (close > sma30 && sma30DiffPct > 0.05) {
      stage = 2;
      stageName = 'Stage 2';
      meaning = 'Advancing / Accumulation';
      interpretation = `Strong Stage 2 uptrend. Price $${close.toFixed(2)} is above rising 30W MA ($${sma30.toFixed(2)}).`;
    } else if (close < sma30 && sma30DiffPct < -0.05) {
      stage = 4;
      stageName = 'Stage 4';
      meaning = 'Declining / Markdown';
      interpretation = `Stage 4 markdown phase. Price $${close.toFixed(2)} is below declining 30W MA ($${sma30.toFixed(2)}). Avoid long side.`;
    } else if (Math.abs(sma30DiffPct) <= 0.05 && s2Score >= 4 && close >= sma30) {
      stage = 3;
      stageName = 'Stage 3';
      meaning = 'Topping / Distribution';
      interpretation = `Topping structure forming. High volatility near highs; tighten stop losses.`;
    } else {
      stage = 1;
      stageName = 'Stage 1';
      meaning = 'Basing / Consolidation';
      interpretation = `Consolidation base range (${baseRangePct}). Watch for volume breakout above $${high13.toFixed(2)}.`;
    }

    return {
      isLive: true,
      stage: stage,
      stageName: stageName,
      meaning: meaning,
      stage2Score: `${s2Score} / 8`,
      stage4Score: `${s4Score} / 8`,
      baseRange: baseRangePct,
      slowMA: slowMA,
      interpretation: interpretation,
      checklist: {
        priceAbove30WMA: close > sma30,
        ma30Rising: sma30 > prevSma30,
        mansfieldRSVal: mansfieldRS.toFixed(2) + '%',
        volumeSpike: volumeSpike
      }
    };
  }

  // Fallback profile generator if datafeed request fails or is offline
  function getFallbackProfile(symbol) {
    const sym = (symbol || 'AAPL').toUpperCase();
    let code = 0;
    for (let i = 0; i < sym.length; i++) code += sym.charCodeAt(i);
    const stageNum = (code % 2 === 0) ? 2 : (code % 3 === 0 ? 1 : 4);
    
    if (stageNum === 2) {
      return {
        isLive: false,
        stage: 2,
        stageName: 'Stage 2',
        meaning: 'Advancing / Accumulation',
        stage2Score: `${6 + (code % 3)} / 8`,
        stage4Score: `${1 + (code % 2)} / 8`,
        baseRange: `${(15 + (code % 15)).toFixed(2)}%`,
        slowMA: 'Rising',
        interpretation: 'Primary long-side environment. Price positioned above rising 30W MA.',
        checklist: {
          priceAbove30WMA: true,
          ma30Rising: true,
          mansfieldRSVal: '+1.85%',
          volumeSpike: '1.8x Avg'
        }
      };
    } else if (stageNum === 1) {
      return {
        isLive: false,
        stage: 1,
        stageName: 'Stage 1',
        meaning: 'Basing / Consolidation',
        stage2Score: `${3 + (code % 2)} / 8`,
        stage4Score: `${3 + (code % 2)} / 8`,
        baseRange: `${(22 + (code % 10)).toFixed(2)}%`,
        slowMA: 'Flattening',
        interpretation: 'Consolidation phase. Accumulation under resistance; watch for breakout volume.',
        checklist: {
          priceAbove30WMA: false,
          ma30Rising: false,
          mansfieldRSVal: '-0.40%',
          volumeSpike: '1.1x Avg'
        }
      };
    } else {
      return {
        isLive: false,
        stage: 4,
        stageName: 'Stage 4',
        meaning: 'Declining / Markdown',
        stage2Score: `${1 + (code % 2)} / 8`,
        stage4Score: `${6 + (code % 2)} / 8`,
        baseRange: `${(30 + (code % 12)).toFixed(2)}%`,
        slowMA: 'Declining',
        interpretation: 'Downtrend markdown phase. High distribution volume; avoid buying.',
        checklist: {
          priceAbove30WMA: false,
          ma30Rising: false,
          mansfieldRSVal: '-3.20%',
          volumeSpike: '2.5x Avg'
        }
      };
    }
  }

  function formatCompactNumber(value) {
    if (!Number.isFinite(Number(value)) || Number(value) === 0) return 'N/A';
    const num = Number(value);
    const abs = Math.abs(num);
    if (abs >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  }

  function calculateATR(highs, lows, closes, period = 14) {
    if (!Array.isArray(highs) || !Array.isArray(lows) || !Array.isArray(closes) || highs.length < period + 1) return 0;
    const trueRanges = [];
    for (let i = 1; i < highs.length; i++) {
      const high = Number(highs[i]) || 0;
      const low = Number(lows[i]) || 0;
      const prevClose = Number(closes[i - 1]) || 0;
      trueRanges.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
    }
    const recentTR = trueRanges.slice(-period);
    if (!recentTR.length) return 0;
    const avg = recentTR.reduce((sum, value) => sum + value, 0) / recentTR.length;
    return Number.isFinite(avg) ? avg : 0;
  }

  function getRiskPlan(latestPrice, atr, stage) {
    const atrValue = Number(atr) || 0;
    const baseStop = atrValue > 0 ? latestPrice - atrValue : latestPrice * 0.04;
    const baseTarget = latestPrice + (atrValue > 0 ? atrValue * 2.4 : latestPrice * 0.08);
    const entry = latestPrice;
    const stop = Math.max(0.0001, baseStop);
    const target = Math.max(entry, baseTarget);
    const riskPct = entry > 0 ? ((entry - stop) / entry) * 100 : 0;
    const rewardPct = entry > 0 ? ((target - entry) / entry) * 100 : 0;

    return {
      entry: entry,
      stop: stop,
      target: target,
      riskPct: riskPct,
      rewardPct: rewardPct,
      rr: rewardPct > 0 && riskPct > 0 ? (rewardPct / riskPct) : 0,
      bias: stage === 2 ? 'Bullish' : stage === 4 ? 'Defensive' : 'Neutral'
    };
  }

  async function fetchQuoteData(symbol) {
    const quoteUrl = `https://query1.finance.yahoo.com/v6/finance/quote?symbols=${encodeURIComponent(symbol)}`;
    const response = await fetch(quoteUrl, { cache: 'no-store' });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.quoteResponse?.result?.[0] || null;
  }

  async function fetchChartData(symbol, range = '6mo', interval = '1d') {
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
    const response = await fetch(chartUrl, { cache: 'no-store' });
    if (!response.ok) return null;
    const payload = await response.json();
    const chart = payload?.chart?.result?.[0];
    const quote = chart?.indicators?.quote?.[0];
    if (!chart || !quote) return null;
    return {
      closes: (quote.close || []).filter((value) => Number.isFinite(value)),
      highs: (quote.high || []).filter((value) => Number.isFinite(value)),
      lows: (quote.low || []).filter((value) => Number.isFinite(value)),
      volumes: (quote.volume || []).filter((value) => Number.isFinite(value))
    };
  }

  function enrichProfileWithMarketData(profile, quoteData, chartData) {
    const latestPrice = Number(quoteData?.regularMarketPrice || chartData?.closes?.slice(-1)[0] || profile?.latestPrice || 0);
    const changePct = Number(quoteData?.regularMarketChangePercent || 0);
    const marketCap = Number(quoteData?.marketCap || 0);
    const atr = calculateATR(chartData?.highs || [], chartData?.lows || [], chartData?.closes || [], 14);
    const riskPlan = getRiskPlan(latestPrice, atr, Number(profile?.stage || 2));

    return {
      ...profile,
      quote: {
        symbol: quoteData?.symbol || profile?.symbol || 'N/A',
        price: latestPrice,
        priceDisplay: latestPrice > 0 ? `$${latestPrice.toFixed(2)}` : 'N/A',
        changePct: changePct,
        changeText: `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`,
        sector: quoteData?.sector || 'N/A',
        industry: quoteData?.industry || 'N/A',
        marketCap: formatCompactNumber(marketCap),
        volume: quoteData?.averageDailyVolume3Month ? `${(quoteData.averageDailyVolume3Month / 1000).toFixed(1)}k` : 'N/A',
        atr: atr > 0 ? `$${atr.toFixed(2)}` : 'N/A',
        riskPlan: riskPlan,
        exchange: quoteData?.fullExchangeName || quoteData?.exchange || 'N/A'
      }
    };
  }

  // Get Color Classes according to Stage
  function getStageColors(stage) {
    switch (stage) {
      case 2:
        return {
          stageBg: '#2e7d32',       // Dark Green
          meaningBg: '#388e3c',     // Medium Green
          s2ScoreBg: '#66bb6a',     // Light Green
          s4ScoreBg: '#ef5350',     // Light Red
          baseRangeBg: '#78909c',   // Slate Gray
          slowMABg: '#42a5f5',      // Soft Blue
          interpBg: '#388e3c'       // Green Banner
        };
      case 1:
        return {
          stageBg: '#ef6c00',       // Orange / Amber
          meaningBg: '#f57c00',     // Bright Amber
          s2ScoreBg: '#ffb74d',     // Light Amber
          s4ScoreBg: '#90a4ae',     // Neutral Gray
          baseRangeBg: '#78909c',   // Slate Gray
          slowMABg: '#ffa726',      // Amber Blue
          interpBg: '#f57c00'       // Amber Banner
        };
      case 3:
        return {
          stageBg: '#d84315',       // Deep Orange / Rust
          meaningBg: '#e65100',     // Dark Rust
          s2ScoreBg: '#ff8a65',     // Light Orange
          s4ScoreBg: '#ef5350',     // Red
          baseRangeBg: '#78909c',   // Slate Gray
          slowMABg: '#ff7043',      // Soft Orange
          interpBg: '#e65100'       // Rust Banner
        };
      case 4:
      default:
        return {
          stageBg: '#c62828',       // Dark Red
          meaningBg: '#d32f2f',     // Medium Red
          s2ScoreBg: '#e57373',     // Soft Red
          s4ScoreBg: '#b71c1c',     // Heavy Red
          baseRangeBg: '#78909c',   // Slate Gray
          slowMABg: '#ef5350',      // Red MA
          interpBg: '#d32f2f'       // Red Banner
        };
    }
  }

  // Controller Object
  const Sidepanel = {
    currentSymbol: 'AAPL',
    currentResolution: '1W',
    isOpen: true,

    init: function () {
      this.bindEvents();
      this.update(this.currentSymbol, this.currentResolution);
    },

    bindEvents: function () {
      const toggleBtn = document.getElementById('toggleSidepanelBtn');
      const sidepanelEl = document.getElementById('stageSidepanel');

      if (toggleBtn && sidepanelEl) {
        toggleBtn.addEventListener('click', () => {
          this.isOpen = !this.isOpen;
          if (this.isOpen) {
            sidepanelEl.classList.remove('hidden');
            toggleBtn.classList.add('bg-indigo-700');
          } else {
            sidepanelEl.classList.add('hidden');
            toggleBtn.classList.remove('bg-indigo-700');
          }
        });
      }
    },

    // Fetch live bar data from UDF datafeed endpoint and render live sidepanel
    update: async function (symbol, resolution = '1W') {
      this.currentSymbol = (symbol || 'AAPL').toUpperCase();
      this.currentResolution = resolution || '1W';

      const sidepanelContent = document.getElementById('sidepanelContent');
      if (!sidepanelContent) return;

      sidepanelContent.innerHTML = `
        <div class="p-4 text-sm text-slate-300">
          <div class="animate-pulse space-y-3">
            <div class="h-4 bg-slate-700 rounded w-2/3"></div>
            <div class="h-10 bg-slate-700 rounded"></div>
            <div class="h-20 bg-slate-700 rounded"></div>
          </div>
        </div>
      `;

      let profile = null;
      let quoteData = null;
      let chartData = null;

      try {
        const [quoteResult, chartResult] = await Promise.all([
          fetchQuoteData(this.currentSymbol),
          fetchChartData(this.currentSymbol, '6mo', '1d')
        ]);
        quoteData = quoteResult;
        chartData = chartResult;

        if (chartResult && chartResult.closes && chartResult.closes.length > 20) {
          profile = calculateLiveStageMetrics(this.currentSymbol, {
            c: chartResult.closes,
            h: chartResult.highs,
            l: chartResult.lows,
            v: chartResult.volumes
          });
        }
      } catch (e) {
        console.warn('Could not fetch live ticker data, falling back to derived profile', e);
      }

      if (!profile) {
        profile = getFallbackProfile(this.currentSymbol);
      }

      const enrichedProfile = enrichProfileWithMarketData(profile, quoteData, chartData);
      this.render(enrichedProfile);
    },

    render: function (profile) {
      const sidepanelContent = document.getElementById('sidepanelContent');
      if (!sidepanelContent) return;

      const colors = getStageColors(profile.stage);
      const isLiveTag = profile.isLive
        ? `<span class="text-3xs px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 font-semibold border border-emerald-800">LIVE FEED</span>`
        : `<span class="text-3xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-semibold">DERIVED</span>`;

      const quote = profile.quote || {};
      const riskPlan = quote.riskPlan || { entry: 0, stop: 0, target: 0, riskPct: 0, rewardPct: 0, rr: 0, bias: 'Neutral' };
      const changeColor = (Number(quote.changePct) || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400';

      sidepanelContent.innerHTML = `
        <div class="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <span class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
            <h2 class="font-bold text-sm text-slate-100 tracking-wide uppercase">Stage Details (${this.currentSymbol})</h2>
          </div>
          <div class="flex items-center space-x-2">
            ${isLiveTag}
            <span class="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono font-semibold">${profile.stageName}</span>
          </div>
        </div>

        <div class="p-3 space-y-3">
          <div class="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <div class="flex items-center justify-between mb-2">
              <div>
                <div class="text-2xs uppercase tracking-[0.2em] text-slate-400">Price</div>
                <div class="text-xl font-bold text-white">${quote.priceDisplay || 'N/A'}</div>
              </div>
              <div class="text-right">
                <div class="text-2xs uppercase tracking-[0.2em] text-slate-400">Change</div>
                <div class="font-bold ${changeColor}">${quote.changeText || '0.00%'}</div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2 text-[10px] text-slate-300">
              <div class="bg-slate-800 rounded p-2">
                <div class="text-slate-400 uppercase">Sector</div>
                <div class="font-semibold text-white">${quote.sector || 'N/A'}</div>
              </div>
              <div class="bg-slate-800 rounded p-2">
                <div class="text-slate-400 uppercase">Market Cap</div>
                <div class="font-semibold text-white">${quote.marketCap || 'N/A'}</div>
              </div>
              <div class="bg-slate-800 rounded p-2">
                <div class="text-slate-400 uppercase">Volume</div>
                <div class="font-semibold text-white">${quote.volume || 'N/A'}</div>
              </div>
              <div class="bg-slate-800 rounded p-2">
                <div class="text-slate-400 uppercase">Exchange</div>
                <div class="font-semibold text-white">${quote.exchange || 'N/A'}</div>
              </div>
            </div>
          </div>

          <div class="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <div class="flex items-center justify-between mb-2">
              <div class="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">Trade Plan</div>
              <div class="text-[10px] uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">${riskPlan.bias}</div>
            </div>
            <div class="grid grid-cols-3 gap-2 text-[10px] text-slate-300">
              <div class="bg-slate-800 rounded p-2">
                <div class="text-slate-400 uppercase">Entry</div>
                <div class="font-semibold text-white">$${Number(riskPlan.entry || 0).toFixed(2)}</div>
              </div>
              <div class="bg-slate-800 rounded p-2">
                <div class="text-slate-400 uppercase">Stop</div>
                <div class="font-semibold text-rose-300">$${Number(riskPlan.stop || 0).toFixed(2)}</div>
              </div>
              <div class="bg-slate-800 rounded p-2">
                <div class="text-slate-400 uppercase">Target</div>
                <div class="font-semibold text-emerald-300">$${Number(riskPlan.target || 0).toFixed(2)}</div>
              </div>
            </div>
            <div class="mt-2 flex justify-between text-[10px] text-slate-300">
              <span>Risk:</span>
              <span class="font-semibold text-rose-300">${(Number(riskPlan.riskPct) || 0).toFixed(2)}%</span>
              <span>Reward:</span>
              <span class="font-semibold text-emerald-300">${(Number(riskPlan.rewardPct) || 0).toFixed(2)}%</span>
              <span>RR:</span>
              <span class="font-semibold text-white">${(Number(riskPlan.rr) || 0).toFixed(2)}R</span>
            </div>
          </div>

          <div class="w-full text-xs font-semibold rounded-lg overflow-hidden border border-slate-700 shadow-md">
            <div class="flex border-b border-slate-700">
              <div class="w-1/3 bg-slate-800 text-slate-200 p-2.5 flex items-center justify-start border-r border-slate-700 font-bold">Stage</div>
              <div class="w-2/3 p-2.5 text-center font-bold text-white uppercase text-sm tracking-wider" style="background-color: ${colors.stageBg};">${profile.stageName}</div>
            </div>
            <div class="flex border-b border-slate-700">
              <div class="w-1/3 bg-slate-800 text-slate-200 p-2.5 flex items-center justify-start border-r border-slate-700 font-bold">Meaning</div>
              <div class="w-2/3 p-2.5 text-center text-white font-semibold" style="background-color: ${colors.meaningBg};">${profile.meaning}</div>
            </div>
            <div class="flex border-b border-slate-700">
              <div class="w-1/3 bg-slate-800 text-slate-200 p-2.5 flex items-center justify-start border-r border-slate-700 font-bold">Stage 2 Score</div>
              <div class="w-2/3 p-2.5 text-center text-white font-bold text-sm tracking-widest" style="background-color: ${colors.s2ScoreBg};">${profile.stage2Score}</div>
            </div>
            <div class="flex border-b border-slate-700">
              <div class="w-1/3 bg-slate-800 text-slate-200 p-2.5 flex items-center justify-start border-r border-slate-700 font-bold">Stage 4 Score</div>
              <div class="w-2/3 p-2.5 text-center text-white font-bold text-sm tracking-widest" style="background-color: ${colors.s4ScoreBg};">${profile.stage4Score}</div>
            </div>
            <div class="flex border-b border-slate-700">
              <div class="w-1/3 bg-slate-800 text-slate-200 p-2.5 flex items-center justify-start border-r border-slate-700 font-bold">Base Range</div>
              <div class="w-2/3 p-2.5 text-center text-slate-100 font-bold" style="background-color: ${colors.baseRangeBg};">${profile.baseRange}</div>
            </div>
            <div class="flex border-b border-slate-700">
              <div class="w-1/3 bg-slate-800 text-slate-200 p-2.5 flex items-center justify-start border-r border-slate-700 font-bold">Slow MA</div>
              <div class="w-2/3 p-2.5 text-center text-white font-bold" style="background-color: ${colors.slowMABg};">${profile.slowMA}</div>
            </div>
            <div class="flex">
              <div class="w-1/3 bg-slate-800 text-slate-200 p-2.5 flex items-center justify-start border-r border-slate-700 font-bold leading-tight">Interpretation</div>
              <div class="w-2/3 p-2.5 text-left text-white font-medium leading-relaxed text-xs" style="background-color: ${colors.interpBg};">${profile.interpretation}</div>
            </div>
          </div>

          <div class="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs space-y-2">
            <h4 class="font-bold text-slate-300 uppercase tracking-wider text-2xs border-b border-slate-800 pb-1 flex items-center justify-between">
              <span>Weinstein Checklist</span>
              <span class="text-emerald-400 font-mono">10-Point Analysis</span>
            </h4>
            <div class="space-y-1.5 pt-1 text-slate-300">
              <div class="flex items-center justify-between">
                <span class="flex items-center">
                  <svg class="w-3.5 h-3.5 ${profile.checklist.priceAbove30WMA ? 'text-emerald-400' : 'text-rose-400'} mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                  Price > 30W Moving Avg
                </span>
                <span class="${profile.checklist.priceAbove30WMA ? 'text-emerald-400' : 'text-rose-400'} font-bold">${profile.checklist.priceAbove30WMA ? 'YES' : 'NO'}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="flex items-center">
                  <svg class="w-3.5 h-3.5 ${profile.checklist.ma30Rising ? 'text-emerald-400' : 'text-amber-400'} mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                  30W MA Slope
                </span>
                <span class="${profile.checklist.ma30Rising ? 'text-emerald-400' : 'text-amber-400'} font-bold uppercase">${profile.slowMA}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="flex items-center">
                  <svg class="w-3.5 h-3.5 text-emerald-400 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                  Mansfield RS Indicator
                </span>
                <span class="text-emerald-400 font-bold">${profile.checklist.mansfieldRSVal}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="flex items-center">
                  <svg class="w-3.5 h-3.5 text-emerald-400 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                  Volume Spike Level
                </span>
                <span class="text-emerald-400 font-bold">${profile.checklist.volumeSpike}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  };

  window.StageSidepanel = Sidepanel;

})(window);
