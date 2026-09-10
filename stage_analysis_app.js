/**
 * Stage Analysis Application Controller
 * Manages TradingView Charting Library initialization, custom studies, and UI integration.
 */

(function () {
  'use strict';

  // State Management
  const state = {
    widget: null,
    symbol: 'AAPL',
    interval: '1W', // Default Weinstein Stage Analysis interval is Weekly ('1W')
    theme: 'light',
    sataScore: 7,
    activeStudies: {}
  };

  // Helper to parse URL query params
  function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
      results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
  }

  // Calculate and update SATA Score Header Badge
  function updateSATABadge(score) {
    state.sataScore = score;
    const scoreValEl = document.getElementById('sataScoreValue');
    const scoreStatusEl = document.getElementById('sataScoreStatus');
    const scoreBoxEl = document.getElementById('sataScoreBox');
    const scoreTextEl = document.getElementById('sataScoreDescription');

    if (!scoreValEl) return;

    scoreValEl.textContent = `${score} / 10`;

    let statusText = 'Neutral';
    let statusClass = 'bg-orange-500 text-white';
    let descText = `SATA score is ${score} out of 10. The asset is showing neutral technical attributes.`;

    if (score >= 8) {
      statusText = 'Very Strong';
      statusClass = 'bg-emerald-600 text-white';
      descText = `SATA score is ${score} out of 10. Strong Stage 2 Advancing phase with strong relative strength.`;
    } else if (score >= 6) {
      statusText = 'Strong';
      statusClass = 'bg-green-500 text-white';
      descText = `SATA score is ${score} out of 10. Technically healthy structure above key moving averages.`;
    } else if (score <= 3) {
      statusText = 'Weak';
      statusClass = 'bg-red-600 text-white';
      descText = `SATA score is ${score} out of 10. Stage 4 Markdown / Weak trend. Caution advised.`;
    }

    if (scoreStatusEl) {
      scoreStatusEl.textContent = statusText;
      scoreStatusEl.className = `px-3 py-1 text-xs font-bold rounded uppercase tracking-wider ${statusClass}`;
    }

    if (scoreTextEl) {
      scoreTextEl.textContent = descText;
    }
  }

  // Initialize TradingView Widget
  function refreshSymbolContext(symbol, interval) {
    const nextSymbol = (symbol || state.symbol || 'AAPL').toUpperCase();
    const nextInterval = interval || state.interval || '1W';
    state.symbol = nextSymbol;
    state.interval = nextInterval;

    const symbolDisplay = document.getElementById('currentSymbolDisplay');
    if (symbolDisplay) symbolDisplay.textContent = nextSymbol;

    const searchInput = document.getElementById('nav-stock-search-input');
    if (searchInput) searchInput.value = nextSymbol;

    document.querySelectorAll('[data-symbol]').forEach(function (btn) {
      const isActive = (btn.getAttribute('data-symbol') || '').toUpperCase() === nextSymbol;
      btn.classList.toggle('bg-indigo-600', isActive);
      btn.classList.toggle('text-white', isActive);
      btn.classList.toggle('ring-1', isActive);
      btn.classList.toggle('ring-indigo-400', isActive);
      btn.classList.toggle('bg-slate-800', !isActive);
      btn.classList.toggle('text-slate-200', !isActive);
    });

    const modal = document.getElementById('stockSearchModal');
    if (modal && modal.style.display !== 'none') {
      modal.style.display = 'none';
    }

    if (window.StageSidepanel) {
      window.StageSidepanel.update(nextSymbol, nextInterval);
    }
  }

  function syncChartState() {
    if (!state.widget || !state.widget.chart) return;

    try {
      const chart = state.widget.chart();
      if (!chart) return;

      const chartSymbol = chart.symbol && typeof chart.symbol === 'function' ? chart.symbol() : null;
      const chartInterval = chart.resolution && typeof chart.resolution === 'function' ? chart.resolution() : null;

      if (chartSymbol && String(chartSymbol).toUpperCase() !== state.symbol) {
        refreshSymbolContext(chartSymbol, chartInterval || state.interval);
      }

      if (chartInterval && String(chartInterval) !== state.interval) {
        state.interval = String(chartInterval);
        const intervalSelect = document.getElementById('chartIntervalSelect');
        if (intervalSelect) intervalSelect.value = state.interval;
        if (window.StageSidepanel) {
          window.StageSidepanel.update(state.symbol, state.interval);
        }
      }
    } catch (error) {
      console.warn('Chart state sync warning:', error);
    }
  }

  function initChart() {
    var datafeedUrl = getParameterByName('dataUrl') || "https://demo-feed-data.tradingview.com";
    if (datafeedUrl && !datafeedUrl.startsWith('http')) {
      datafeedUrl = 'https://' + datafeedUrl;
    }

    var symbolParam = getParameterByName('symbol') || 'AAPL';
    state.symbol = symbolParam.toUpperCase();

    var intervalParam = getParameterByName('interval') || '1W';
    state.interval = intervalParam;

    var widgetOptions = {
      fullscreen: false,
      autosize: true,
      symbol: state.symbol,
      interval: state.interval,
      container: "tv_chart_container",
      datafeed: new Datafeeds.UDFCompatibleDatafeed(datafeedUrl, undefined, {
        maxResponseLength: 1000,
        expectedOrder: 'latestFirst',
      }),
      library_path: "charting_library/",
      locale: getParameterByName('lang') || "en",
      theme: getParameterByName('theme') || "Dark",

      disabled_features: [],
      enabled_features: [
        "study_templates",
        "header_screenshot",
        "use_localstorage_for_settings",
        "header_symbol_search",
        "symbol_search_hotkey",
        "popup_hints",
        "allow_symbol_change",
        "pane_context_menu",
        "side_toolbar_in_fullscreen",
        "context_menus",
        "chart_events"
      ],

      // Custom Indicators Getter
      custom_indicators_getter: function (PineJS) {
        var indicators = [];

        if (typeof getMansfieldRSIndicator === 'function') {
          indicators.push(getMansfieldRSIndicator(PineJS));
        }

        if (typeof getStageClassifierIndicator === 'function') {
          indicators.push(getStageClassifierIndicator(PineJS));
        }

        if (typeof getSATAScoreIndicator === 'function') {
          indicators.push(getSATAScoreIndicator(PineJS));
        }

        return Promise.resolve(indicators);
      }
    };

    var widget = window.tvWidget = new TradingView.widget(widgetOptions);
    state.widget = widget;

    widget.onChartReady(function () {
      const chart = widget.chart();

      // Add Default Weinstein Stage Overlay and Mansfield RS Studies
      chart.createStudy('Stan Weinstein Stage Overlay', false, false);
      chart.createStudy('Mansfield Relative Strength', false, false);
      chart.createStudy('SATA Score (0-10)', false, false);

      updateSATABadge(7);
      refreshSymbolContext(state.symbol, state.interval);
    });
  }

  // Bind UI Toolbar Events
  function bindUIEvents() {
    // Interval Select
    var intervalSelect = document.getElementById('chartIntervalSelect');
    if (intervalSelect) {
      intervalSelect.addEventListener('change', function (e) {
        var newInterval = e.target.value;
        state.interval = newInterval;
        if (state.widget) {
          state.widget.chart().setResolution(newInterval, function () {});
        }
        if (window.StageSidepanel) {
          window.StageSidepanel.update(state.symbol, newInterval);
        }
      });
    }

    // Ticker Input Form
    var symbolInput = document.getElementById('nav-stock-search-input');
    var symbolForm = document.getElementById('nav-stock-search-form');
    if (symbolForm && symbolInput) {
      symbolForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var symbol = symbolInput.value.trim().toUpperCase();
        if (symbol) {
          state.symbol = symbol;
          if (state.widget) {
            state.widget.chart().setSymbol(symbol, function () {});
          }
          refreshSymbolContext(symbol, state.interval);

          // Close modal if open
          var modal = document.getElementById('stockSearchModal');
          if (modal) modal.style.display = 'none';
        }
      });
    }

    // Quick Symbol Buttons
    var symbolBtns = document.querySelectorAll('[data-symbol]');
    symbolBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var symbol = btn.getAttribute('data-symbol');
        if (symbol && state.widget) {
          state.symbol = symbol;
          state.widget.chart().setSymbol(symbol, function () {});
          refreshSymbolContext(symbol, state.interval);
        }
      });
    });

    // Checkbox Study Toggles
    var stageOverlayCb = document.getElementById('stageOverlayCheckbox');
    if (stageOverlayCb) {
      stageOverlayCb.addEventListener('change', function (e) {
        if (state.widget) {
          if (e.target.checked) {
            state.widget.chart().createStudy('Stan Weinstein Stage Overlay', false, false);
          }
        }
      });
    }

    var mansfieldRsCb = document.getElementById('mansfieldRsCheckbox');
    if (mansfieldRsCb) {
      mansfieldRsCb.addEventListener('change', function (e) {
        if (state.widget) {
          if (e.target.checked) {
            state.widget.chart().createStudy('Mansfield Relative Strength', false, false);
          }
        }
      });
    }

    var sataScoreCb = document.getElementById('sataScoreCheckbox');
    if (sataScoreCb) {
      sataScoreCb.addEventListener('change', function (e) {
        if (state.widget) {
          if (e.target.checked) {
            state.widget.chart().createStudy('SATA Score (0-10)', false, false);
          }
        }
      });
    }
  }

  // Initialize on DOM Ready
  window.addEventListener('DOMContentLoaded', function () {
    initChart();
    bindUIEvents();
    if (window.StageSidepanel) {
      window.StageSidepanel.init();
    }
    setInterval(syncChartState, 700);
  });

})();
