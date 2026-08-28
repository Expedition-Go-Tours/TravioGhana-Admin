import { useEffect, useMemo, useRef, useState } from "react";
import { Map as MapLibreMap, LngLatBounds as MapLibreLngLatBounds, NavigationControl as MapLibreNavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { AlertTriangle, MapPin } from "lucide-react";

const TILE_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const ZONE_FILL = "hsl(var(--green-500) / 0.18)";
const ZONE_LINE = "hsl(var(--green-600))";
const EXCL_FILL = "rgba(225, 29, 72, 0.18)";
const EXCL_LINE = "#e11d48";

type LatLngTuple = [number, number];

interface PickupAreaShape {
  name?: string;
  address?: string;
  time?: string;
  polygon?: LatLngTuple[];
  exclusions?: LatLngTuple[][];
}

function polygonFeature(coords: LatLngTuple[]) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [coords.map(([lat, lng]) => [lng, lat])] },
  };
}

function toFeatureCollection(list: LatLngTuple[][]) {
  return { type: "FeatureCollection" as const, features: list.map((c) => polygonFeature(c)) };
}

/**
 * Read-only rendered pickup geoshapes for admin/moderation views: drawn
 * service zones (green) plus no-pickup exclusions (rose). Production-safe:
 * WebGL failure and tile/style outages degrade to a textual fallback
 * instead of a blank box or a crashed page.
 */
export function PickupZoneMap({ areas = [], height = 240, showLegend = true }: { areas?: PickupAreaShape[]; height?: number; showLegend?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const initializedRef = useRef(false);
  const failedRef = useRef(false);
  const mapReadyRef = useRef(false);
  const failTimerRef = useRef<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const zones = useMemo(
    () => areas.filter((a) => Array.isArray(a?.polygon) && (a?.polygon?.length ?? 0) >= 3),
    [areas],
  );
  const exclusions = useMemo(
    () => zones.flatMap((a) => (Array.isArray(a.exclusions) ? a.exclusions : [])).filter((e) => Array.isArray(e) && e.length >= 3),
    [zones],
  );
  const totalAreas = zones.length > 0 ? zones.length : areas.length;

  useEffect(() => {
    if (!containerRef.current || initializedRef.current || zones.length === 0 || failedRef.current) return;
    initializedRef.current = true;

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: TILE_STYLE,
        center: [zones[0]?.polygon?.[0]?.[1] ?? -0.187, zones[0]?.polygon?.[0]?.[0] ?? 5.6037],
        zoom: 5,
      });
    } catch {
      failedRef.current = true;
      window.setTimeout(() => setFailed(true), 0);
      return;
    }

    map.addControl(new MapLibreNavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      if (!mapRef.current) return;
      if (failTimerRef.current != null) {
        window.clearTimeout(failTimerRef.current);
        failTimerRef.current = null;
      }

      map.addSource("az-zones", { type: "geojson", data: toFeatureCollection(zones.map((z) => z.polygon as LatLngTuple[])) });
      map.addLayer({ id: "az-zones-fill", type: "fill", source: "az-zones", paint: { "fill-color": ZONE_FILL } });
      map.addLayer({ id: "az-zones-line", type: "line", source: "az-zones", paint: { "line-color": ZONE_LINE, "line-width": 2 } });

      if (exclusions.length > 0) {
        map.addSource("az-excl", { type: "geojson", data: toFeatureCollection(exclusions) });
        map.addLayer({ id: "az-excl-fill", type: "fill", source: "az-excl", paint: { "fill-color": EXCL_FILL } });
        map.addLayer({ id: "az-excl-line", type: "line", source: "az-excl", paint: { "line-color": EXCL_LINE, "line-width": 2, "line-dasharray": [2, 1] } });
      }

      const bounds = new MapLibreLngLatBounds();
      for (const z of zones) for (const [lat, lng] of z.polygon as LatLngTuple[]) bounds.extend([lng, lat]);
      for (const e of exclusions) for (const [lat, lng] of e) bounds.extend([lng, lat]);
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 0 });
      }

      setMapReady(true);
      mapReadyRef.current = true;
    });

    // Transient tile 404s are tolerated (overlays still render over the
    // blank base); a failing style/server degrades after a grace period.
    map.on("error", () => {
      if (!mapReadyRef.current && failTimerRef.current == null) {
        failTimerRef.current = window.setTimeout(() => {
          failedRef.current = true;
          setFailed(true);
        }, 8000);
      }
    });

    mapRef.current = map;
    return () => {
      if (failTimerRef.current != null) {
        window.clearTimeout(failTimerRef.current);
        failTimerRef.current = null;
      }
      map.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (zones.length === 0) return null;

  return (
    <div>
      <div className="relative overflow-hidden rounded-lg border border-border">
        <div ref={containerRef} style={{ height }} className="w-full" />
        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-base/95 px-4 text-center">
            <AlertTriangle size={18} className="text-status-rejected" />
            <p className="text-xs text-text-secondary">
              Map unavailable — {totalAreas} pickup zone{totalAreas === 1 ? "" : "s"}
              {exclusions.length > 0 ? `, ${exclusions.length} no-pickup zone${exclusions.length === 1 ? "" : "s"}` : ""} configured.
            </p>
          </div>
        )}
        {mapReady && showLegend && (
          <div className="absolute left-2 top-2 z-10 flex flex-col gap-1.5 rounded-lg bg-surface-base/90 px-2.5 py-2 text-[10px] font-medium text-text-primary shadow-soft backdrop-blur-sm">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: ZONE_LINE }} /> Pickup zone
            </span>
            {exclusions.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: EXCL_LINE }} /> No pickup
              </span>
            )}
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-medium text-green-700">
          <MapPin size={11} /> {zones.length} pickup zone{zones.length === 1 ? "" : "s"}
        </span>
        {exclusions.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-600">
            <MapPin size={11} /> {exclusions.length} no-pickup zone{exclusions.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}