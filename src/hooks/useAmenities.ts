import { useEffect, useMemo, useState } from "react";

export type AmenityCategory = "supermarket" | "school" | "metro";
export type TravelMode = "walking" | "driving";

export type Amenity = {
  id: string;
  name: string;
  center: [number, number];
  address?: string;
  category: AmenityCategory;
  distanceMeters: number;
};

function haversineMeters([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const CATEGORY_QUERIES: Record<AmenityCategory, string> = {
  supermarket: "supermarket",
  school: "school",
  metro: "metro station",
};

export function useAmenities(center: [number, number] | null, token?: string, limitPerCategory = 5) {
  const [data, setData] = useState<Record<AmenityCategory, Amenity[]>>({ supermarket: [], school: [], metro: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accessToken = useMemo(() => token || localStorage.getItem("MAPBOX_PUBLIC_TOKEN") || "", [token]);

  useEffect(() => {
    if (!center || !accessToken) return;
    let aborted = false;
    const abortCtl = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const entries = (Object.keys(CATEGORY_QUERIES) as AmenityCategory[]).map(async (cat) => {
          const q = CATEGORY_QUERIES[cat];
          const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`);
          url.searchParams.set("access_token", accessToken);
          url.searchParams.set("types", "poi");
          url.searchParams.set("proximity", `${center[0]},${center[1]}`);
          url.searchParams.set("limit", String(limitPerCategory));
          url.searchParams.set("country", "AE");
          const res = await fetch(url.toString(), { signal: abortCtl.signal });
          const json = await res.json();
          const feats = (json?.features || []) as Array<any>;
          const items: Amenity[] = feats.map((f: any) => {
            const p = f?.properties || {};
            const coords = (f?.center || f?.geometry?.coordinates) as [number, number];
            const dist = haversineMeters(center, coords);
            return {
              id: f.id,
              name: f.text || f.place_name || p?.name || "Unknown",
              center: coords,
              address: f.place_name,
              category: cat,
              distanceMeters: dist,
            } as Amenity;
          });
          // sort by distance
          items.sort((a, b) => a.distanceMeters - b.distanceMeters);
          return [cat, items] as const;
        });
        const all = await Promise.all(entries);
        if (aborted) return;
        const map: Record<AmenityCategory, Amenity[]> = { supermarket: [], school: [], metro: [] };
        all.forEach(([cat, items]) => { map[cat] = items; });
        setData(map);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setError("Failed to load amenities");
        console.warn("Amenities fetch failed", e);
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => { aborted = true; abortCtl.abort(); };
  }, [center?.[0], center?.[1], accessToken, limitPerCategory]);

  return { data, loading, error } as const;
}

export function estimateDurationSec(distanceMeters: number, mode: "walking" | "driving") {
  // Simple heuristic speeds
  const speeds = { walking: 1.4, driving: 11.11 }; // m/s (~5 km/h, ~40 km/h)
  return distanceMeters / speeds[mode];
}
