function initOnReady() {
  var widget = (window.tvWidget = new TradingView.widget({
    library_path: "/charting_library/charting_library.standalone.js",
    fullscreen: true,
    symbol: "AAPL",
    interval: "1D",
    container: "tv_chart_container",
    datafeed: new Datafeeds.UDFCompatibleDatafeed(
      "https://demo-feed-data.tradingview.com"
    ),
    locale: "en",
    disabled_features: [],
    enabled_features: [],
    custom_indicators_getter: function (PineJS) {
      return Promise.resolve([
        {
          name: "Adaptive Harmonic Forecast [LuxAlgo]",
          metainfo: {
            _metainfoVersion: 52,
            id: "AdaptiveHarmonicForecast@tv-basicstudies-1",
            description: "Adaptive Harmonic Forecast [LuxAlgo]",
            shortDescription: "AHF [LuxAlgo]",
            format: { type: "inherit" },
            linkedToSeries: true,
            is_price_study: true,
            plots: [
              { id: "fit_up", type: "line" },
              { id: "fit_down", type: "line" },
              { id: "trend_plot", type: "line" },
              { id: "forecast_proj", type: "line" },
            ],
            defaults: {
              styles: {
                fit_up: {
                  linestyle: 0,
                  linewidth: 2,
                  plottype: 0,
                  trackPrice: false,
                  transparency: 0,
                  visible: true,
                  color: "#089981",
                },
                fit_down: {
                  linestyle: 0,
                  linewidth: 2,
                  plottype: 0,
                  trackPrice: false,
                  transparency: 0,
                  visible: true,
                  color: "#f23645",
                },
                trend_plot: {
                  linestyle: 2,
                  linewidth: 1,
                  plottype: 0,
                  trackPrice: false,
                  transparency: 0,
                  visible: true,
                  color: "#808080",
                },
                forecast_proj: {
                  linestyle: 2,
                  linewidth: 2,
                  plottype: 0,
                  trackPrice: false,
                  transparency: 0,
                  visible: true,
                  color: "#089981",
                },
              },
              inputs: {
                lenInput: 100,
                extrapInput: 50,
                numSinesInput: 5,
                minPInput: 10,
                showTrend: true,
              },
            },
            styles: {
              fit_up: { title: "Harmonic Fit (Up)", histogramBase: 0, joinPoints: true },
              fit_down: { title: "Harmonic Fit (Down)", histogramBase: 0, joinPoints: true },
              trend_plot: { title: "Trend Line", histogramBase: 0, joinPoints: true },
              forecast_proj: { title: "Projection", histogramBase: 0, joinPoints: true },
            },
            inputs: [
              { id: "lenInput", name: "Fit Lookback (N)", defval: 100, type: "integer", min: 5, max: 500 },
              { id: "extrapInput", name: "Forecast Offset", defval: 10, type: "integer", min: 1, max: 50 },
              { id: "numSinesInput", name: "Number of Sinusoids", defval: 5, type: "integer", min: 1, max: 10 },
              { id: "minPInput", name: "Min Period", defval: 10, type: "integer", min: 5, max: 100 },
              { id: "showTrend", name: "Show Trend Line", defval: true, type: "bool" },
            ],
          },
          constructor: function () {
            this.init = function (context, input) {
              this._context = context;
            };

            // Matrix Math Helpers
            this.transpose = function (m) {
              return m[0].map((x, i) => m.map(x => x[i]));
            };

            this.mult = function (a, b) {
              var aRows = a.length, aCols = a[0].length,
                bRows = b.length, bCols = b[0].length,
                m = new Array(aRows);
              for (var r = 0; r < aRows; ++r) {
                m[r] = new Array(bCols);
                for (var c = 0; c < bCols; ++c) {
                  m[r][c] = 0;
                  for (var i = 0; i < aCols; ++i) {
                    m[r][c] += a[r][i] * b[i][c];
                  }
                }
              }
              return m;
            };

            this.inverse = function (m) {
              var n = m.length;
              var id = [];
              for (var i = 0; i < n; i++) {
                id[i] = [];
                for (var j = 0; j < n; j++) id[i][j] = (i === j) ? 1 : 0;
              }
              for (var i = 0; i < n; i++) {
                var e = m[i][i];
                if (Math.abs(e) < 1e-12) return null;
                for (var j = 0; j < n; j++) {
                  m[i][j] /= e;
                  id[i][j] /= e;
                }
                for (var k = 0; k < n; k++) {
                  if (k !== i) {
                    var f = m[k][i];
                    for (var j = 0; j < n; j++) {
                      m[k][j] -= f * m[i][j];
                      id[k][j] -= f * id[i][j];
                    }
                  }
                }
              }
              return id;
            };

            this.main = function (ctx, input) {
              this._context = ctx;
              this._input = input;
              var len = this._input(0);
              var forecastOffset = this._input(1);
              var numSines = this._input(2);
              var minP = this._input(3);
              var showTrend = this._input(4);

              var source = PineJS.Std.close(this._context);
              this._context.setMinimumAdditionalDepth(len + 5);
              var series = this._context.new_var(source);

              // Track previous fit to determine color
              this._prevFit = this._prevFit || 0;

              var prices = [];
              for (var i = 0; i < len; i++) {
                var v = series.get(i);
                if (v === null) return [null, null, null, null];
                prices.push(v);
              }
              prices.reverse();

              // OLS Detrending
              var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
              for (var i = 0; i < len; i++) { sumX += i; sumY += prices[i]; sumXY += i * prices[i]; sumX2 += i * i; }
              var slope = (len * sumXY - sumX * sumY) / (len * sumX2 - sumX * sumX);
              var intercept = (sumY - slope * sumX) / len;

              // Periodogram
              var powers = [], periods = [];
              for (var p = minP; p <= len; p++) {
                var sumS = 0, sumC = 0, w = 2.0 * Math.PI / p;
                for (var i = 0; i < len; i++) {
                  var detrended = prices[i] - (slope * i + intercept);
                  sumS += detrended * Math.sin(w * i); sumC += detrended * Math.cos(w * i);
                }
                powers.push(sumS * sumS + sumC * sumC); periods.push(p);
              }

              var peaks = [];
              for (var i = 1; i < powers.length - 1; i++) {
                if (powers[i] > powers[i - 1] && powers[i] > powers[i + 1]) peaks.push({ p: periods[i], pwr: powers[i] });
              }
              peaks.sort((a, b) => b.pwr - a.pwr);
              var bestPeriods = peaks.slice(0, numSines).map(v => v.p);
              if (bestPeriods.length === 0) return [null, null, null, null];

              // Build OLS Matrix
              var numCols = bestPeriods.length * 2 + 2;
              var X = [], Y = [];
              for (var i = 0; i < len; i++) {
                var row = []; var t = i;
                for (var j = 0; j < bestPeriods.length; j++) {
                  var w = 2.0 * Math.PI / bestPeriods[j];
                  row.push(Math.sin(w * t)); row.push(Math.cos(w * t));
                }
                row.push(t); row.push(1.0);
                X.push(row); Y.push([prices[i]]);
              }

              var XT = this.transpose(X);
              var XTX = this.mult(XT, X);
              var XTXi = this.inverse(XTX);

              if (XTXi) {
                var Beta = this.mult(XTXi, this.mult(XT, Y));

                var getVal = function (t) {
                  var v = 0;
                  for (var j = 0; j < bestPeriods.length; j++) {
                    var w = 2.0 * Math.PI / bestPeriods[j];
                    v += Beta[j * 2][0] * Math.sin(w * t) + Beta[j * 2 + 1][0] * Math.cos(w * t);
                  }
                  return v + Beta[numCols - 2][0] * t + Beta[numCols - 1][0];
                };

                var y_curr = getVal(len - 1);
                var trend_val = showTrend ? (Beta[numCols - 2][0] * (len - 1) + Beta[numCols - 1][0]) : null;

                // Forecast logic: Return the value predicted for T + offset at that offset
                var proj_val = { value: getVal(len - 1 + forecastOffset), offset: forecastOffset };

                var isUp = y_curr >= this._prevFit;
                this._prevFit = y_curr;

                return [
                  isUp ? y_curr : null,
                  !isUp ? y_curr : null,
                  trend_val,
                  proj_val
                ];
              }
              return [null, null, null, null];
            };

          },
        },
      ]);
    },
  }));
  widget.onChartReady(() => {
    widget.chart().createStudy("Adaptive Harmonic Forecast [LuxAlgo]", false, false);
  });
}

window.addEventListener("DOMContentLoaded", initOnReady, false);
