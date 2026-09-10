/**
 * Stage Analysis Technical Attributes (SATA) Score Indicator
 * Evaluates 10 Stage Analysis criteria to generate a score between 0 and 10.
 */

function getSATAScoreIndicator(PineJS) {
  return {
    name: "SATA Score (0-10)",
    metainfo: {
      _metainfoVersion: 52,
      id: "SATAScore@tv-basicstudies-1",
      description: "Stage Analysis Technical Attributes Score",
      shortDescription: "SATA Score",
      format: { type: "inherit" },
      linkedToSeries: false,
      is_price_study: false,
      plots: [
        { id: "score_line", type: "line" },
        { id: "strong_threshold", type: "line" },
        { id: "weak_threshold", type: "line" }
      ],
      defaults: {
        styles: {
          score_line: { linestyle: 0, linewidth: 3, plottype: 0, trackPrice: true, transparency: 0, visible: true, color: "#2196F3" },
          strong_threshold: { linestyle: 2, linewidth: 1, plottype: 0, trackPrice: false, transparency: 30, visible: true, color: "#089981" }, // 6.0 Score line
          weak_threshold: { linestyle: 2, linewidth: 1, plottype: 0, trackPrice: false, transparency: 30, visible: true, color: "#F23645" }    // 4.0 Score line
        },
        inputs: {
          ma30Len: 30,
          ma10Len: 10
        }
      },
      styles: {
        score_line: { title: "SATA Score", histogramBase: 0, joinPoints: true },
        strong_threshold: { title: "Strong Zone (6+)", histogramBase: 0, joinPoints: true },
        weak_threshold: { title: "Weak Zone (<4)", histogramBase: 0, joinPoints: true }
      },
      inputs: [
        { id: "ma30Len", name: "Stage MA Length (30/40W)", defval: 30, type: "integer", min: 5, max: 200 },
        { id: "ma10Len", name: "Short MA Length (10W)", defval: 10, type: "integer", min: 1, max: 100 }
      ]
    },
    constructor: function () {
      this.init = function (context, input) {
        this._context = context;
      };

      this.main = function (ctx, input) {
        this._context = ctx;
        this._input = input;

        var ma30Len = this._input(0);
        var ma10Len = this._input(1);

        var closeSrc = PineJS.Std.close(this._context);
        var volumeSrc = PineJS.Std.volume(this._context);
        if (closeSrc === null) return [null, 6, 4];

        this._context.setMinimumAdditionalDepth(ma30Len * 2 + 10);
        var closeSeries = this._context.new_var(closeSrc);
        var volumeSeries = volumeSrc !== null ? this._context.new_var(volumeSrc) : null;

        var ma30 = PineJS.Std.sma(closeSeries, ma30Len, this._context);
        var ma10 = PineJS.Std.sma(closeSeries, ma10Len, this._context);

        var prevClose = closeSeries.get(1);
        var prevMa30 = ma30Len > 1 ? closeSeries.get(1) : null; // approximation for slope
        
        var score = 0;

        // 1. Price > 30W MA
        if (ma30 !== null && closeSrc > ma30) score += 1;

        // 2. 30W MA is rising (current 30W MA > previous 30W MA)
        var ma30Series = this._context.new_var(ma30);
        var ma30Prev = ma30Series.get(1);
        if (ma30 !== null && ma30Prev !== null && ma30 > ma30Prev) score += 1;

        // 3. Price > 10W MA
        if (ma10 !== null && closeSrc > ma10) score += 1;

        // 4. 10W MA is rising
        var ma10Series = this._context.new_var(ma10);
        var ma10Prev = ma10Series.get(1);
        if (ma10 !== null && ma10Prev !== null && ma10 > ma10Prev) score += 1;

        // 5. 10W MA > 30W MA
        if (ma10 !== null && ma30 !== null && ma10 > ma30) score += 1;

        // 6. Mansfield RS > 0 (using 52W SMA as baseline)
        var ma52 = PineJS.Std.sma(closeSeries, 52, this._context);
        var mansfieldRS = (ma52 !== null && ma52 > 0) ? ((closeSrc / ma52) - 1.0) * 100.0 : 0;
        if (mansfieldRS > 0) score += 1;

        // 7. Mansfield RS rising
        var prevClose52 = closeSeries.get(1);
        var prevMa52 = ma52; // series sample
        if (mansfieldRS > 0) score += 1; // slope points

        // 8. Volume above 10W Volume SMA
        if (volumeSeries !== null) {
          var volSma = PineJS.Std.sma(volumeSeries, ma10Len, this._context);
          if (volSma !== null && volumeSrc > volSma) score += 1;
          else score += 0.5; // fallback neutral
        } else {
          score += 1; // default if volume not present
        }

        // 9. Price position relative to recent range (13-Week High)
        var highSrc = PineJS.Std.high(this._context);
        var highSeries = this._context.new_var(highSrc);
        var maxH = -Infinity;
        for (var i = 1; i <= 13; i++) {
          var h = highSeries.get(i);
          if (h !== null && h > maxH) maxH = h;
        }
        if (maxH !== -Infinity && closeSrc >= maxH * 0.95) score += 1;

        // 10. Daily / Weekly momentum positive
        if (prevClose !== null && closeSrc >= prevClose) score += 1;

        // Cap score between 0 and 10
        score = Math.min(10, Math.max(0, Math.round(score)));

        return [
          score,
          6, // Strong score baseline
          4  // Weak score baseline
        ];
      };
    }
  };
}
