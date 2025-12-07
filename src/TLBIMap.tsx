/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import type { MetricKey } from "./TLBILayerConfig";
import { MetricConfig } from "./TLBILayerConfig";
import * as ss from "simple-statistics";


mapboxgl.accessToken = "pk.eyJ1IjoibGV4aXhpYSIsImEiOiJjbDhwaGJqdXowN243M3BvMDNxYXl1bjNuIn0.ilolMGy181XT-Bnt0hMaYg";

export default function TLBIMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const [metric, setMetric] = useState<MetricKey>("TLBI");

  // weight sliders
  const [wE, setWE] = useState(0.4);
  const [wA, setWA] = useState(0.2);
  const [wI, setWI] = useState(0.2);
  const [wC, setWC] = useState(0.2);

  const [rawGeo, setRawGeo] = useState<any>(null);
  const [selectedFeature, setSelectedFeature] = useState<any>(null);
  const [tlbiBreaks, setTlbiBreaks] = useState<number[]>([]);


  // ---------------------------------------------------------
  // jenks natural breaks
  // ---------------------------------------------------------
  function jenksBreaks(values: number[], k = 6) {
    const clean = values.filter(v => typeof v === "number" && !isNaN(v));
    if (clean.length === 0) return [];

    clean.sort((a,b)=>a-b);

    const breaks = ss.jenks(clean, k);
    return breaks;
  }

  // ---------------------------------------------------------
  // Quantile scaling
  // ---------------------------------------------------------
  function quantileScale(sortedValues: number[], v: number) {
    if (isNaN(v)) return null;
    let idx = sortedValues.findIndex((x) => v <= x);
    if (idx === -1) idx = sortedValues.length - 1;
    return idx / (sortedValues.length - 1);
  }

  // ---------------------------------------------------------
  // Compute TLBI
  // ---------------------------------------------------------
  function computeTLBI(geo: any) {
    // -------- Auto Normalize Weights --------
    const sum = wE + wA + wI + wC || 1;
    const nE = wE / sum;
    const nA = wA / sum;
    const nI = wI / sum;
    const nC = wC / sum;

    const valuesE = geo.features.map((f: any) => f.properties.rent_income_ratio ?? NaN);
    const valuesA = geo.features.map((f: any) => f.properties.park_area_ratio ?? NaN);
    const valuesI = geo.features.map((f: any) => f.properties.food_density ?? NaN);
    const valuesC = geo.features.map((f: any) => f.properties.avg_commute_time ?? NaN);

    const sortedE = [...valuesE].sort((a, b) => a - b);
    const sortedA = [...valuesA].sort((a, b) => a - b);
    const sortedI = [...valuesI].sort((a, b) => a - b);
    const sortedC = [...valuesC].sort((a, b) => a - b);

    const newGeo = JSON.parse(JSON.stringify(geo));

    newGeo.features = newGeo.features.map((f: any) => {
      const e = f.properties.rent_income_ratio;
      if (e == null || isNaN(e)) {
        f.properties.TLBI = null;
        return f;
      }

      const a = f.properties.park_area_ratio ?? NaN;
      const i = f.properties.food_density ?? NaN;
      const c = f.properties.avg_commute_time ?? NaN;

      const qE = quantileScale(sortedE, e);
      const qA = quantileScale(sortedA, a);
      const qI = quantileScale(sortedI, i);
      const qC = quantileScale(sortedC, c);

      // -------- Use normalized weights --------
      f.properties.TLBI =
        (qE ?? 0) * nE +
        (qA ?? 0) * nA +
        (qI ?? 0) * nI +
        (qC ?? 0) * nC;

      return f;
    });

    return newGeo;
  }


  // ---------------------------------------------------------
  // Map initialization
  // ---------------------------------------------------------
  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/lexixia/cmivgp3oj006n01qngumgf82n",
      center: [-73.94, 40.72],
      zoom: 9.8,
    });

    mapRef.current = map;

    map.on("load", async () => {
      const res = await fetch(import.meta.env.BASE_URL + 'cd_final_cleaned.geojson')
      const geo = await res.json();
      setRawGeo(geo);

      const initialized = computeTLBI(geo);

      map.addSource("cd", {
        type: "geojson",
        data: initialized,
      });

      map.addLayer({
        id: "cd-fill",
        type: "fill",
        source: "cd",
        paint: {
          "fill-color": getPaint(metric) as any,
          "fill-opacity": 0.95,
        },
      });

      map.addLayer({
        id: "cd-outline",
        type: "line",
        source: "cd",
        paint: {
          "line-color": "#444",
          "line-width": 0.45,
        },
      });

      map.on("click", "cd-fill", (e) => {
        const p = e.features?.[0]?.properties;
        if (p) {
          console.log("Clicked TLBI:", p.TLBI, p);
          setSelectedFeature(p);
        } else {
          console.log("Clicked TLBI: no feature");
          setSelectedFeature(null);
        }
      });

      map.on("click", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["cd-fill"] });
        if (features.length === 0) {
          setSelectedFeature(null);
        }
      });
    });

    return () => map.remove();
  }, []);

  // ---------------------------------------------------------
  // Update TLBI when weights change
  // ---------------------------------------------------------
  useEffect(() => {
    if (!rawGeo) return;
    setSelectedFeature(null);

    const updated = computeTLBI(rawGeo);

    // ---- ⭐ Compute Jenks breaks for TLBI ----
    const values = updated.features.map((f:any) => f.properties.TLBI);
    const bks = jenksBreaks(values, 6);
    console.log("Jenks breaks:", bks);
    setTlbiBreaks(bks);

    // ---- Update GeoJSON ----
    const map = mapRef.current;
    const src = map?.getSource("cd") as mapboxgl.GeoJSONSource;
    if (src) src.setData(updated);

    // ---- Update fill color ----
    if (map?.getLayer("cd-fill")) {
      if (metric === "TLBI") {
        map.setPaintProperty("cd-fill", "fill-color", buildJenksExpression("TLBI", bks) as any);
      }
    }
  }, [wE, wA, wI, wC]);

  // ---------------------------------------------------------
  // Initial Jenks calculation when rawGeo loads
  // ---------------------------------------------------------
  useEffect(() => {
    if (!rawGeo) return;

    // 重新计算 TLBI
    const updated = computeTLBI(rawGeo);

    // 计算 Jenks breaks
    const values = updated.features.map((f: any) => f.properties.TLBI);
    const bks = jenksBreaks(values, 6);
    console.log("Initial Jenks breaks:", bks);

    setTlbiBreaks(bks);

    // 更新 GeoJSON
    const map = mapRef.current;
    const src = map?.getSource("cd") as mapboxgl.GeoJSONSource;
    if (src) src.setData(updated);

    // 更新颜色
    if (map?.getLayer("cd-fill")) {
      map.setPaintProperty("cd-fill", "fill-color", buildJenksExpression("TLBI", bks) as any);
    }
  }, [rawGeo]);  

  // ---------------------------------------------------------
  // Update fill color when metric changes
  // ---------------------------------------------------------
  function buildJenksExpression(field: string, breaks: number[]) {
    if (!breaks || breaks.length < 2) return "#ccc";

    const colors = ["#2166ac", "#67a9cf", "#d1e5f0", "#fddbc7", "#ef8a62", "#b2182b"];

    // step syntax: ["step", input, base_color, threshold1, color1, threshold2, color2, ...]
    const exp: any[] = ["step", ["get", field], colors[0]];

    // skip breaks[0] (min) and breaks[last] (max)
    for (let i = 1; i < breaks.length - 1; i++) {
      exp.push(breaks[i]);
      exp.push(colors[i]);
    }

    return exp;
  }



  function getPaint(metricKey: MetricKey): mapboxgl.ExpressionSpecification | string {
    if (metricKey === "TLBI") {
      return buildJenksExpression("TLBI", tlbiBreaks) as mapboxgl.ExpressionSpecification | string;
    }

    // 非 TLBI 继续用你的原始颜色配置
    const cfg = MetricConfig[metricKey];
    return ["interpolate", ["linear"], ["coalesce", ["get", cfg.field], 0], ...cfg.colors] as unknown as mapboxgl.ExpressionSpecification;
  }


  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer("cd-fill")) {
      map.setPaintProperty("cd-fill", "fill-color", getPaint(metric) as any);
    }
  }, [metric]);
  

  // ---------------------------------------------------------
  // Control Panel with SLIDERS
  // ---------------------------------------------------------
  function ClickTooltip({ text }: { text: string }) {
    const [open, setOpen] = useState(false);

    return (
      <div style={{ display: "inline-block", position: "relative" }}>
        <div
          onClick={() => setOpen(!open)}
          style={{
            marginLeft:6,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#007acc",
            color: "white",
            fontSize: 11,
            textAlign: "center",
            lineHeight: "16px",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          i
        </div>

        {open && (
          <div
            style={{
              position: "absolute",
              top: 22,
              left: -10,
              width: 180,
              padding: "8px 10px",
              fontSize: 12,
              background: "rgba(0,0,0,0.85)",
              color: "white",
              borderRadius: 6,
              boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
              zIndex: 999,
            }}
          >
            {text}
          </div>
        )}
      </div>
    );
  }


  function ControlPanel() {
    return (
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          width: 280,
          background: "rgba(255,255,255,0.95)",
          padding: 16,
          borderRadius: 8,
          fontSize: 13,
          lineHeight: 1.45,
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        }}
      >
        <b style={{ fontSize: 15 }}>Indicator</b>
        <select
          style={{
            width: "100%",
            marginTop: 6,
            padding: "5px 6px",
            borderRadius: 4,
            border: "1px solid #ccc",
          }}
          value={metric}
          onChange={(e) => setMetric(e.target.value as MetricKey)}
        >
          <option value="rent_income_ratio">Economic Burden</option>
          <option value="park_area_ratio">Park Access</option>
          <option value="food_density">Food Access</option>
          <option value="avg_commute_time">Commute Burden</option>
          <option value="TLBI">TLBI Index</option>
        </select>

        {/* Weights --------------------------------------------------- */}
        <div style={{ marginTop: 18, fontWeight: 600, display: "flex", alignItems: "center" }}>
          Weights (TLBI only)
          <ClickTooltip text="Weights automatically normalize to sum to 1. Adjusting a slider redistributes remaining weight proportionally." />
        </div>


        {[
          { label: "Economic Burden", value: wE, setter: setWE },
          { label: "Park Access", value: wA, setter: setWA },
          { label: "Food Access", value: wI, setter: setWI },
          { label: "Commute Burden", value: wC, setter: setWC },
        ].map((row, i) => (
          <div key={i} style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{row.label}</span>
              <span>{row.value.toFixed(2)}</span>
            </div>

            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={row.value}
              onChange={(e) => row.setter(+e.target.value)}
              style={{ width: "100%", marginTop: 4, cursor: "pointer" }}
            />
          </div>
        ))}

        {/* Selected feature info --------------------------------------- */}
        {selectedFeature && (
          <div style={{ marginTop: 18 }}>
            <b>{selectedFeature.Location_x}</b>
            <p>Econ Burden: {selectedFeature.rent_income_ratio?.toFixed(3)}</p>
            <p>Park Access: {selectedFeature.park_area_ratio?.toFixed(3)}</p>
            <p>Food Density: {selectedFeature.food_density?.toFixed(3)}</p>
            <p>Commute Time: {selectedFeature.avg_commute_time?.toFixed(3)} min</p>
            <p>
              <b>TLBI:</b> {selectedFeature.TLBI?.toFixed(3)}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------
  // Legend Box
  // ---------------------------------------------------------
  function LegendBox() {
    const cfg = MetricConfig[metric];
    const items = [];

    if (metric !== "TLBI") {
      // 非 TLBI 继续用你的原始颜色配置
      for (let i = 0; i < cfg.colors.length; i += 2) {
        items.push({
          value: cfg.colors[i],
          color: cfg.colors[i + 1],
        });
      }

      return (
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: 20,
            background: "rgba(255,255,255,0.95)",
            padding: 12,
            borderRadius: 6,
            boxShadow: "0 0 6px rgba(0,0,0,0.15)",
            fontSize: 12,
            width: 180,
          }}
        >
          <b style={{ fontSize: 13 }}>{cfg.title}</b>

          {cfg.unit && (
            <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
              Unit: {cfg.unit}
            </div>
          )}

          <div style={{ marginTop: 6 }}>
            {items.map((it, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginTop: 4,
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 12,
                    background: it.color,
                    border: "1px solid #aaa",
                    marginRight: 6,
                  }}
                />
                {it.value} {cfg.unit}
              </div>
            ))}
          </div>
        </div>
      );
    }

      // ---- ⭐ TLBI Jenks legend ----
    if (metric === "TLBI") {
      if (!tlbiBreaks.length) return null;

      const colors = ["#2166ac", "#67a9cf", "#d1e5f0", "#fddbc7", "#ef8a62", "#b2182b"];

      const tlbiItems: any[] = [];
      for (let i = 0; i < tlbiBreaks.length - 1; i++) {
        tlbiItems.push({
          color: colors[i],
          label: `${tlbiBreaks[i].toFixed(2)} – ${tlbiBreaks[i + 1].toFixed(2)}`
        });
      }

      return (
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: 20,
            background: "white",
            padding: 12,
            borderRadius: 6,
            boxShadow: "0 0 6px rgba(0,0,0,0.15)",
            fontSize: 12,
            width: 200
          }}
        >
          <b>Total Living Burden Index</b>

          {tlbiItems.map((it, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", marginTop: 4 }}
            >
              <div
                style={{
                  width: 18,
                  height: 12,
                  background: it.color,
                  border: "1px solid #aaa",
                  marginRight: 6
                }}
              />
              {it.label}
            </div>
          ))}
        </div>
      );
    }


  }


  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------
  return (
    <div style={{ position: "relative", height: "100vh" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
      <ControlPanel />
      <LegendBox />
    </div>
  );
}
