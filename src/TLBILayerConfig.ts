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
      18.1, "#ffffd4",
      22.2, "#fee391",
      25.1, "#fec44f",
      28.1, "#fe9929",
      30.2, "#d95f0e",
      35.1, "#993404"
    ]
  },

  park_area_ratio: {
    field: "park_area_ratio",
    title: "Park Area Ratio",
    unit: "",
    colors: [
      0.05, "#ffffcc",
      3.3, "#d9f0a3",
      6.6, "#addd8e",
      11.9, "#78c679",
      15.2, "#31a354",
      20.9, "#006837"
    ]
  },

  food_density: {
    field: "food_density",
    title: "Number of Retail food Stores",
    unit: "per km²",
    colors: [
      0.15, "#f1eef6",
      0.88, "#d4b9da",
      1.59, "#c994c7",
      2.35, "#df65b0",
      3.17, "#dd1c77",
      3.95, "#980043"
    ]
  },

  avg_commute_time: {
    field: "avg_commute_time",
    title: "Average Travel Time to Work",
    unit: "minutes",
    colors: [
        32, "#e5f4ed",   // ≤ 32  
        38.9, "#7bc5ad", // 32–38.9 
        44.9, "#4fa5b2", // 39–44.9
        48.9, "#4169a6", // 45–48.9
        53.9, "#2f3c96", // 49–53.9
        60, "#000000"    // ≥ 54 
    ]
  },


    TLBI: {
    field: "TLBI",
    title: "Total Living Burden Index",
    unit: "",

    colors: [
        0.00, "#2166ac",  // green
        0.20, "#67a9cf",  // light green
        0.40, "#d1e5f0",  // yellow
        0.60, "#fddbc7",  // orange
        0.80, "#ef8a62",  // red
        1.00, "#b2182b"   // deep red (stronger for top range)
    ]
    }


};
