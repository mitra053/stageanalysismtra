// c:\Users\acer\OneDrive\Desktop\custom rs\liquidity_zones.js
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
          name: "Liquidity Zones",
          metainfo: {
            _metainfoVersion: 52,
            id: "LiquidityZones@tv-basicstudies-1",
            description: "Liquidity Zones",
            shortDescription: "Liquidity Zones",
            format: { type: "inherit" },
            linkedToSeries: true,
            is_price_study: true,
            plots: [
              { id: "plot_0", type: "line" }, // swingHighTop
              { id: "plot_1", type: "line" }, // swingHighBottom
              { id: "plot_2", type: "line" }, // swingHighLevel
              { id: "plot_3", type: "line" }, // swingLowTop
              { id: "plot_4", type: "line" }, // swingLowBottom
              { id: "plot_5", type: "line" }  // swingLowLevel
            ],
            filledAreas: [
              {
                id: "fill_high",
                objAId: "plot_0",
                objBId: "plot_1",
                type: "plot_plot",
                title: "Swing High Area"
              },
              {
                id: "fill_low",
                objAId: "plot_3",
                objBId: "plot_4",
                type: "plot_plot",
                title: "Swing Low Area"
              }
            ],
            defaults: {
              styles: {
                plot_0: { visible: false },
                plot_1: { visible: false },
                plot_2: { linestyle: 1, linewidth: 2, plottype: 0, trackPrice: false, transparency: 20, visible: true, color: "#F67171" }, // Dashed High Level
                plot_3: { visible: false },
                plot_4: { visible: false },
                plot_5: { linestyle: 1, linewidth: 2, plottype: 0, trackPrice: false, transparency: 20, visible: true, color: "#40D98F" }  // Dashed Low Level
              },
              filledAreasStyle: {
                fill_high: { color: "#F67171", transparency: 80, visible: true },
                fill_low: { color: "#40D98F", transparency: 80, visible: true }
              },
              inputs: {
                pivotLookback: 15,
                swingAreaMode: 0,
                filterMode: 0,
                minFilterValue: 0.0,
                showSwingHighZones: true,
                showSwingLowZones: true
              },
            },
            styles: {
              plot_0: { title: "High Top", histogramBase: 0, joinPoints: false },
              plot_1: { title: "High Bottom", histogramBase: 0, joinPoints: false },
              plot_2: { title: "High Level", histogramBase: 0, joinPoints: false },
              plot_3: { title: "Low Top", histogramBase: 0, joinPoints: false },
              plot_4: { title: "Low Bottom", histogramBase: 0, joinPoints: false },
              plot_5: { title: "Low Level", histogramBase: 0, joinPoints: false }
            },
            inputs: [
              { id: "pivotLookback", name: "Pivot Lookback", defval: 15, type: "integer", min: 1, max: 100 },
              { id: "swingAreaMode", name: "Swing Area (0=Wick, 1=Full Range)", defval: 0, type: "integer", min: 0, max: 1 },
              { id: "filterMode", name: "Filter Areas By (0=Count, 1=Vol)", defval: 0, type: "integer", min: 0, max: 1 },
              { id: "minFilterValue", name: "Min Filter Value", defval: 0.0, type: "float", min: 0.0 },
              { id: "showSwingHighZones", name: "Show Swing High Zones", defval: true, type: "bool" },
              { id: "showSwingLowZones", name: "Show Swing Low Zones", defval: true, type: "bool" }
            ],
          },
          constructor: function () {
            this.init = function (context, input) {
              this._context = context;
              // State for Swing High
              this._highZoneTop = null;
              this._highZoneBottom = null;
              this._isHighZoneCrossed = true;
              this._highHitCount = 0;
              this._highHitVolume = 0;

              // State for Swing Low
              this._lowZoneTop = null;
              this._lowZoneBottom = null;
              this._isLowZoneCrossed = true;
              this._lowHitCount = 0;
              this._lowHitVolume = 0;
            };

            this.main = function (ctx, input) {
              this._context = ctx;
              this._input = input;

              var pivotLookback = this._input(0);
              var swingAreaMode = this._input(1);
              var filterMode = this._input(2);
              var minFilterValue = this._input(3);
              var showSwingHighZones = this._input(4);
              var showSwingLowZones = this._input(5);

              var pLen = pivotLookback;
              this._context.setMinimumAdditionalDepth(pLen * 2 + 5);

              var highSeries = this._context.new_var(PineJS.Std.high(this._context));
              var lowSeries = this._context.new_var(PineJS.Std.low(this._context));
              var closeSeries = this._context.new_var(PineJS.Std.close(this._context));
              var openSeries = this._context.new_var(PineJS.Std.open(this._context));
              var volumeSeries = this._context.new_var(PineJS.Std.volume(this._context));

              // Validate historical data availability
              if (highSeries.get(pLen * 2) === null) {
                return [null, null, null, null, null, null];
              }

              // ==========================================
              // Swing High Logic
              // ==========================================
              var isHighPivotDetected = true;
              var highPivotPrice = highSeries.get(pLen);
              for (var i = 0; i <= pLen * 2; i++) {
                if (i !== pLen && highSeries.get(i) >= highPivotPrice) {
                  isHighPivotDetected = false;
                  break;
                }
              }

              if (isHighPivotDetected) {
                this._highZoneTop = highSeries.get(pLen);
                if (swingAreaMode === 0) { // Wick Extremity
                  this._highZoneBottom = Math.max(closeSeries.get(pLen), openSeries.get(pLen));
                } else { // Full Range
                  this._highZoneBottom = lowSeries.get(pLen);
                }
                this._isHighZoneCrossed = false;
                this._highHitCount = 0;
                this._highHitVolume = 0;

                // Retroactively evaluate accumulation since pivot
                for (var i = pLen - 1; i >= 0; i--) {
                  var l = lowSeries.get(i);
                  var h = highSeries.get(i);
                  if (l < this._highZoneTop && h > this._highZoneBottom) {
                    this._highHitCount++;
                    var v = volumeSeries.get(i);
                    this._highHitVolume += (v !== null ? v : 0);
                  }
                }
              } else {
                if (!this._isHighZoneCrossed && this._highZoneTop !== null) {
                  var currentClose = closeSeries.get(0);
                  if (currentClose > this._highZoneTop) {
                    this._isHighZoneCrossed = true;
                  } else {
                    var l = lowSeries.get(0);
                    var h = highSeries.get(0);
                    if (l < this._highZoneTop && h > this._highZoneBottom) {
                      this._highHitCount++;
                      var v = volumeSeries.get(0);
                      this._highHitVolume += (v !== null ? v : 0);
                    }
                  }
                }
              }

              // ==========================================
              // Swing Low Logic
              // ==========================================
              var isLowPivotDetected = true;
              var lowPivotPrice = lowSeries.get(pLen);
              for (var i = 0; i <= pLen * 2; i++) {
                if (i !== pLen && lowSeries.get(i) <= lowPivotPrice) {
                  isLowPivotDetected = false;
                  break;
                }
              }

              if (isLowPivotDetected) {
                this._lowZoneBottom = lowSeries.get(pLen);
                if (swingAreaMode === 0) { // Wick Extremity
                  this._lowZoneTop = Math.min(closeSeries.get(pLen), openSeries.get(pLen));
                } else { // Full Range
                  this._lowZoneTop = highSeries.get(pLen);
                }
                this._isLowZoneCrossed = false;
                this._lowHitCount = 0;
                this._lowHitVolume = 0;

                // Retroactively evaluate accumulation since pivot
                for (var i = pLen - 1; i >= 0; i--) {
                  var l = lowSeries.get(i);
                  var h = highSeries.get(i);
                  if (l < this._lowZoneTop && h > this._lowZoneBottom) {
                    this._lowHitCount++;
                    var v = volumeSeries.get(i);
                    this._lowHitVolume += (v !== null ? v : 0);
                  }
                }
              } else {
                if (!this._isLowZoneCrossed && this._lowZoneBottom !== null) {
                  var currentClose = closeSeries.get(0);
                  if (currentClose < this._lowZoneBottom) {
                    this._isLowZoneCrossed = true;
                  } else {
                    var l = lowSeries.get(0);
                    var h = highSeries.get(0);
                    if (l < this._lowZoneTop && h > this._lowZoneBottom) {
                      this._lowHitCount++;
                      var v = volumeSeries.get(0);
                      this._lowHitVolume += (v !== null ? v : 0);
                    }
                  }
                }
              }

              // ==========================================
              // Prepare Outputs
              // ==========================================
              var hTopOut = null;
              var hBotOut = null;
              var hLevOut = null;

              if (showSwingHighZones && this._highZoneTop !== null) {
                var metricHigh = (filterMode === 0) ? this._highHitCount : this._highHitVolume;
                if (metricHigh >= minFilterValue) {
                  if (!this._isHighZoneCrossed) {
                    hTopOut = this._highZoneTop;
                    hBotOut = this._highZoneBottom;
                    hLevOut = this._highZoneTop;
                  }
                }
              }

              var lTopOut = null;
              var lBotOut = null;
              var lLevOut = null;

              if (showSwingLowZones && this._lowZoneBottom !== null) {
                var metricLow = (filterMode === 0) ? this._lowHitCount : this._lowHitVolume;
                if (metricLow >= minFilterValue) {
                  if (!this._isLowZoneCrossed) {
                    lTopOut = this._lowZoneTop;
                    lBotOut = this._lowZoneBottom;
                    lLevOut = this._lowZoneBottom;
                  }
                }
              }

              return [
                { value: hTopOut, offset: -pLen },
                { value: hBotOut, offset: -pLen },
                { value: hLevOut, offset: -pLen },
                { value: lTopOut, offset: -pLen },
                { value: lBotOut, offset: -pLen },
                { value: lLevOut, offset: -pLen }
              ];
            };
          },
        },
      ]);
    },
  });

  widget.onChartReady(() => {
    widget.chart().createStudy('Liquidity Zones', false, false);
  });
}

window.addEventListener("DOMContentLoaded", initOnReady, false);
