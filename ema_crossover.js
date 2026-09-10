function getParameterByName(name) {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
    results = regex.exec(location.search);
  return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function initOnReady() {
  var datafeedUrl = "https://demo-feed-data.tradingview.com";
  var customDataUrl = getParameterByName('dataUrl');
  if (customDataUrl !== "") {
    datafeedUrl = customDataUrl.startsWith('https://') ? customDataUrl : `https://${customDataUrl}`;
  }

  var widget = window.tvWidget = new TradingView.widget({
    fullscreen: true,
    symbol: 'AAPL',
    interval: '1D',
    container: "tv_chart_container",
    datafeed: new Datafeeds.UDFCompatibleDatafeed(datafeedUrl, undefined, {
      maxResponseLength: 1000,
      expectedOrder: 'latestFirst',
    }),
    library_path: "charting_library/",
    locale: getParameterByName('lang') || "en",

    disabled_features: [
      "save_chart_properties_to_local_storage",
      "chart_crosshair_menu",
      "order_panel",
      "trading_account_manager",
      "right_toolbar"
    ],
    enabled_features: ["study_templates", "header_screenshot"],
    charts_storage_url: 'https://saveload.tradingview.com',
    charts_storage_api_version: "1.1",
    client_id: 'trading_platform_demo',
    user_id: 'public_user',
    theme: getParameterByName('theme'),
    
    custom_indicators_getter: function (PineJS) {
      return Promise.resolve([
        {
          name: "EMA Crossover Ribbon",
          metainfo: {
            _metainfoVersion: 52,
            id: "EMACrossoverRibbon@tv-basicstudies-1",
            description: "EMA Crossover Ribbon",
            shortDescription: "EMA Ribbon",
            format: { type: "inherit" },
            linkedToSeries: true,
            is_price_study: true,
            plots: [
              { id: "plot_0", type: "line" }, // Short EMA
              { id: "plot_1", type: "line" }, // Long EMA
              { id: "plot_2", type: "line" }, // Green Fill Bound 1
              { id: "plot_3", type: "line" }, // Green Fill Bound 2
              { id: "plot_4", type: "line" }, // Red Fill Bound 1
              { id: "plot_5", type: "line" }  // Red Fill Bound 2
            ],
            filledAreas: [
              {
                id: "fill_up",
                objAId: "plot_2",
                objBId: "plot_3",
                type: "plot_plot",
                title: "Up Fill"
              },
              {
                id: "fill_down",
                objAId: "plot_4",
                objBId: "plot_5",
                type: "plot_plot",
                title: "Down Fill"
              }
            ],
            defaults: {
              styles: {
                plot_0: { linestyle: 0, linewidth: 2, plottype: 0, trackPrice: false, transparency: 0, visible: false, color: "#2196F3" },
                plot_1: { linestyle: 0, linewidth: 2, plottype: 0, trackPrice: false, transparency: 0, visible: false, color: "#FF9800" },
                plot_2: { visible: false },
                plot_3: { visible: false },
                plot_4: { visible: false },
                plot_5: { visible: false }
              },
              filledAreasStyle: {
                fill_up: { color: "#4CAF50", transparency: 70, visible: true },
                fill_down: { color: "#F44336", transparency: 70, visible: true }
              },
              inputs: {
                shortLen: 5,
                longLen: 20
              },
            },
            styles: {
              plot_0: { title: "Short EMA", histogramBase: 0, joinPoints: true },
              plot_1: { title: "Long EMA", histogramBase: 0, joinPoints: true },
              plot_2: { title: "Green Bound 1", histogramBase: 0, joinPoints: false },
              plot_3: { title: "Green Bound 2", histogramBase: 0, joinPoints: false },
              plot_4: { title: "Red Bound 1", histogramBase: 0, joinPoints: false },
              plot_5: { title: "Red Bound 2", histogramBase: 0, joinPoints: false }
            },
            inputs: [
              { id: "shortLen", name: "Short EMA Length", defval: 5, type: "integer", min: 1, max: 1000 },
              { id: "longLen", name: "Long EMA Length", defval: 20, type: "integer", min: 1, max: 1000 }
            ],
          },
          constructor: function () {
            this.init = function (context, input) {
              this._context = context;
            };

            this.main = function (ctx, input) {
              this._context = ctx;
              this._input = input;

              var shortLen = this._input(0);
              var longLen = this._input(1);

              var source = PineJS.Std.close(this._context);
              if (source === null) return [null, null, null, null, null, null];

              this._context.setMinimumAdditionalDepth(Math.max(shortLen, longLen) * 5);

              var series = this._context.new_var(source);

              var shortEMA = PineJS.Std.ema(series, shortLen, this._context);
              var longEMA = PineJS.Std.ema(series, longLen, this._context);

              var isUp = shortEMA > longEMA;

              return [
                shortEMA,
                longEMA,
                isUp ? shortEMA : null,
                isUp ? longEMA : null,
                !isUp ? shortEMA : null,
                !isUp ? longEMA : null
              ];
            };
          },
        },
      ]);
    },
  });

  widget.onChartReady(() => {
    widget.chart().createStudy('EMA Crossover Ribbon', false, false);
  });
}

window.addEventListener("DOMContentLoaded", initOnReady, false);
