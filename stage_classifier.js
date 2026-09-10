/**
 * Stan Weinstein Stage Analysis Classifier & MA Overlay
 * Plots 30-Week/40-Week MA, 10-Week MA, and 13-Week Support/Resistance levels.
 */

function getStageClassifierIndicator(PineJS) {
  return {
    name: "Stan Weinstein Stage Overlay",
    metainfo: {
      _metainfoVersion: 52,
      id: "StageClassifier@tv-basicstudies-1",
      description: "Stan Weinstein Stage Overlay",
      shortDescription: "Weinstein Stages",
      format: { type: "inherit" },
      linkedToSeries: true,
      is_price_study: true,
      plots: [
        { id: "ma30", type: "line" },       // 30/40-Week Moving Average
        { id: "ma10", type: "line" },       // 10-Week Moving Average
        { id: "high13", type: "line" },     // 13-Week Resistance Breakout Level
        { id: "low13", type: "line" }       // 13-Week Support Breakdown Level
      ],
      defaults: {
        styles: {
          ma30: { linestyle: 0, linewidth: 3, plottype: 0, trackPrice: false, transparency: 0, visible: true, color: "#2196F3" }, // Blue 30W MA
          ma10: { linestyle: 0, linewidth: 2, plottype: 0, trackPrice: false, transparency: 20, visible: true, color: "#FF9800" }, // Orange 10W MA
          high13: { linestyle: 2, linewidth: 1, plottype: 0, trackPrice: false, transparency: 20, visible: true, color: "#089981" }, // Green 13W High
          low13: { linestyle: 2, linewidth: 1, plottype: 0, trackPrice: false, transparency: 20, visible: true, color: "#F23645" }   // Red 13W Low
        },
        inputs: {
          maLongLen: 30,
          maShortLen: 10,
          rangeLookback: 13
        }
      },
      styles: {
        ma30: { title: "Stage MA (30/40W)", histogramBase: 0, joinPoints: true },
        ma10: { title: "Short MA (10W)", histogramBase: 0, joinPoints: true },
        high13: { title: "13-Week High Level", histogramBase: 0, joinPoints: true },
        low13: { title: "13-Week Low Level", histogramBase: 0, joinPoints: true }
      },
      inputs: [
        { id: "maLongLen", name: "Stage MA Length (30/40)", defval: 30, type: "integer", min: 1, max: 200 },
        { id: "maShortLen", name: "Short MA Length (10)", defval: 10, type: "integer", min: 1, max: 100 },
        { id: "rangeLookback", name: "Breakout Lookback (Weeks)", defval: 13, type: "integer", min: 2, max: 52 }
      ]
    },
    constructor: function () {
      this.init = function (context, input) {
        this._context = context;
        this._prevMA30 = null;
      };

      this.main = function (ctx, input) {
        this._context = ctx;
        this._input = input;

        var maLongLen = this._input(0);
        var maShortLen = this._input(1);
        var lookback = this._input(2);

        var closeSrc = PineJS.Std.close(this._context);
        var highSrc = PineJS.Std.high(this._context);
        var lowSrc = PineJS.Std.low(this._context);

        if (closeSrc === null) return [null, null, null, null];

        var maxDepth = Math.max(maLongLen, lookback) * 2 + 10;
        this._context.setMinimumAdditionalDepth(maxDepth);

        var closeSeries = this._context.new_var(closeSrc);
        var highSeries = this._context.new_var(highSrc);
        var lowSeries = this._context.new_var(lowSrc);

        // 30W / 40W SMA
        var ma30 = PineJS.Std.sma(closeSeries, maLongLen, this._context);
        // 10W SMA
        var ma10 = PineJS.Std.sma(closeSeries, maShortLen, this._context);

        // 13-Week High and Low calculation
        var maxHigh = -Infinity;
        var minLow = Infinity;
        for (var i = 1; i <= lookback; i++) {
          var h = highSeries.get(i);
          var l = lowSeries.get(i);
          if (h !== null && h > maxHigh) maxHigh = h;
          if (l !== null && l < minLow) minLow = l;
        }

        var high13Val = (maxHigh !== -Infinity) ? maxHigh : null;
        var low13Val = (minLow !== Infinity) ? minLow : null;

        return [
          ma30,
          ma10,
          high13Val,
          low13Val
        ];
      };
    }
  };
}
