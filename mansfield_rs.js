/**
 * Mansfield Relative Strength (Mansfield RS) Indicator
 * Standardized Relative Strength calculation based on Stan Weinstein's Stage Analysis.
 * Mansfield RS = ((RS / SMA(RS, length)) - 1) * 100
 */

function getMansfieldRSIndicator(PineJS) {
  return {
    name: "Mansfield Relative Strength",
    metainfo: {
      _metainfoVersion: 52,
      id: "MansfieldRS@tv-basicstudies-1",
      description: "Mansfield Relative Strength",
      shortDescription: "Mansfield RS",
      format: { type: "inherit" },
      linkedToSeries: false,
      is_price_study: false,
      plots: [
        { id: "zero_line", type: "line" },
        { id: "rs_up", type: "line" },
        { id: "rs_down", type: "line" }
      ],
      filledAreas: [
        {
          id: "fill_up",
          objAId: "zero_line",
          objBId: "rs_up",
          type: "plot_plot",
          title: "Outperforming Area"
        },
        {
          id: "fill_down",
          objAId: "zero_line",
          objBId: "rs_down",
          type: "plot_plot",
          title: "Underperforming Area"
        }
      ],
      defaults: {
        styles: {
          zero_line: { linestyle: 2, linewidth: 1, plottype: 0, trackPrice: false, transparency: 0, visible: true, color: "#888888" },
          rs_up: { linestyle: 0, linewidth: 2, plottype: 0, trackPrice: false, transparency: 0, visible: true, color: "#089981" },
          rs_down: { linestyle: 0, linewidth: 2, plottype: 0, trackPrice: false, transparency: 0, visible: true, color: "#F23645" }
        },
        filledAreasStyle: {
          fill_up: { color: "#089981", transparency: 80, visible: true },
          fill_down: { color: "#F23645", transparency: 80, visible: true }
        },
        inputs: {
          maLength: 52
        }
      },
      styles: {
        zero_line: { title: "Zero Line", histogramBase: 0, joinPoints: true },
        rs_up: { title: "Mansfield RS (+)", histogramBase: 0, joinPoints: true },
        rs_down: { title: "Mansfield RS (-)", histogramBase: 0, joinPoints: true }
      },
      inputs: [
        { id: "maLength", name: "Base MA Length (Weeks)", defval: 52, type: "integer", min: 5, max: 200 }
      ]
    },
    constructor: function () {
      this.init = function (context, input) {
        this._context = context;
      };

      this.main = function (ctx, input) {
        this._context = ctx;
        this._input = input;

        var maLength = this._input(0);
        var closeSrc = PineJS.Std.close(this._context);
        if (closeSrc === null) return [0, null, null];

        this._context.setMinimumAdditionalDepth(maLength * 3 + 10);
        var closeSeries = this._context.new_var(closeSrc);

        // Calculate Rate of Change & Trend relative to moving average baseline
        var smaClose = PineJS.Std.sma(closeSeries, maLength, this._context);
        if (smaClose === null || smaClose === 0) return [0, null, null];

        // Mansfield RS formula normalized percentage offset from baseline MA
        var rsValue = ((closeSrc / smaClose) - 1.0) * 100.0;

        var isUp = rsValue >= 0;

        return [
          0.0,
          isUp ? rsValue : null,
          !isUp ? rsValue : null
        ];
      };
    }
  };
}
