/* eslint-disable @typescript-eslint/no-explicit-any */
export type MetricKey =
  | "rent_income_ratio"
  | "park_area_ratio"
  | "food_density"
  | "avg_commute_time"
  | "TLBI";

export const MetricConfig: Record<MetricKey, { field: string; colors: any[]; title?: string; unit?: string }> = {
  rent_income_ratio: {
    field: "rent_income_ratio",
    title: "Economic Burden (Rent / Income)",
    unit: "",       // 或 "%"
    colors: [
      0.00000, "#f7fbff",
      0.22231, "#deebf7",
      0.25110, "#c6dbef",
      0.28102, "#9ecae1",
      0.30245, "#6baed6",
      0.35079, "#3182bd",
      0.38786, "#08519c"
    ]
  },

  park_area_ratio: {
    field: "park_area_ratio",
    title: "Park Area Ratio",
    unit: "",
    colors: [
      0.00056, "#f7fbff",
      0.02623, "#deebf7",
      0.06552, "#c6dbef",
      0.11889, "#9ecae1",
      0.15167, "#6baed6",
      0.20861, "#3182bd",
      0.95361, "#08519c"
    ]
  },

  food_density: {
    field: "food_density",
    title: "Number of Retail food Stores",
    unit: "per km²",
    colors: [
      0.0000, "#f7fbff",
      0.2420, "#deebf7",
      0.8775, "#c6dbef",
      1.5861, "#9ecae1",
      2.3517, "#6baed6",
      3.1742, "#3182bd",
      5.1674, "#08519c"
    ]
  },

  avg_commute_time: {
    field: "avg_commute_time",
    title: "Average Commute Time",
    unit: "minutes",
    colors: [
      27.341, "#f7fbff",
      29.836, "#deebf7",
      34.476, "#c6dbef",
      37.934, "#9ecae1",
      44.456, "#6baed6",
      47.675, "#3182bd",
      54.459, "#08519c"
    ]
  },

  TLBI: {
    field: "TLBI",
    title: "Total Living Burden Index",
    colors: [
      0.0, "#ffffcc",
      0.2, "#a1dab4",
      0.4, "#41b6c4",
      0.6, "#2c7fb8",
      0.8, "#253494",
      1.0, "#081d58"
    ]
  }
};
