/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import type { MetricKey } from "./TLBILayerConfig";
import { MetricConfig } from "./TLBILayerConfig";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

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
      style: "mapbox://styles/mapbox/light-v11",
      center: [-73.94, 40.72],
      zoom: 9.8,
    });

    mapRef.current = map;

    map.on("load", async () => {
      const res = await fetch("/cd_final_cleaned.geojson");
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
          "fill-color": getPaint(metric),
          "fill-opacity": 0.75,
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
        setSelectedFeature(e.features?.[0]?.properties ?? null);
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
    const updated = computeTLBI(rawGeo);

    const map = mapRef.current;
    const src = map?.getSource("cd") as mapboxgl.GeoJSONSource;
    if (src) src.setData(updated);
  }, [wE, wA, wI, wC]);

  // ---------------------------------------------------------
  // Update fill color when metric changes
  // ---------------------------------------------------------
  function getPaint(metricKey: MetricKey): mapboxgl.ExpressionSpecification {
    const cfg = MetricConfig[metricKey];
    // Build the Mapbox expression and cast to the ExpressionSpecification type
    return (["interpolate", ["linear"], ["coalesce", ["get", cfg.field], 0], ...cfg.colors] as unknown) as mapboxgl.ExpressionSpecification;
  }

  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer("cd-fill")) {
      map.setPaintProperty("cd-fill", "fill-color", getPaint(metric));
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
