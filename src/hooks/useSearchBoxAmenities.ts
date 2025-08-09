import { useEffect, useMemo, useRef, useState } from "react";

export type AmenityCategory =
  | "food_drink"
  | "groceries"
  | "atm_bank"
  | "pharmacy_hospital"
  | "school_university"
  | "gym_sports"
  | "shopping_mall"
  | "public_transport";

export type AmenityResult = {
  id: string;
  name: string;
  center: [number, number];
  address?: string;
  category: AmenityCategory;
  distanceMeters?: number;
  rating?: number;
  website?: string;
  googleUrl?: string;
};

export type UseAmenitiesOptions = {
  token?: string;
  center?: [number, number] | null;
  route?: GeoJSON.LineString | null;
  categories: AmenityCategory[];
  radiusMeters?: number; // default 1000
  limitPerCategory?: number; // default 12
};

const CATEGORY_QUERY: Record<AmenityCategory, string> = {
  food_drink: "restaurant,cafe,coffee shop,food court",
  groceries: "supermarket,grocery store,hypermarket",
  atm_bank: "atm,bank",
  pharmacy_hospital: "pharmacy,hospital,clinic",
  school_university: "school,university,college",
  gym_sports: "gym,fitness center,sports complex",
  shopping_mall: "shopping mall,mall",
  public_transport: "bus stop,metro station,train station,tram stop",
};

function haversine([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function sampleLine(line: GeoJSON.LineString, stepMeters = 1000): [number, number][] {
  const coords = line.coordinates as [number, number][];
  if (coords.length < 2) return coords;
  const pts: [number, number][] = [];
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const segLen = haversine(a, b);
    if (i === 1) pts.push(a);
    acc += segLen;
    if (acc >= stepMeters) {
      pts.push(b);
      acc = 0;
    }
  }
  pts.push(coords[coords.length - 1]);
  return pts;
}

async function trySearchBox(token: string): Promise<boolean> {
  try {
    const url = new URL("https://api.mapbox.com/search/searchbox/v1/forward");
    url.searchParams.set("q", "coffee");
    url.searchParams.set("proximity", "55.27,25.20");
    url.searchParams.set("limit", "1");
    url.searchParams.set("access_token", token);
    const res = await fetch(url.toString());
    return res.ok;
  } catch {
    return false;
  }
}

type FetchCtx = { abort: AbortController };

export function useSearchBoxSupport(token?: string) {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    const t = token || localStorage.getItem("MAPBOX_PUBLIC_TOKEN") || "";
    if (!t) { setSupported(null); return; }
    let mounted = true;
    trySearchBox(t).then((ok) => { if (mounted) setSupported(ok); });
    return () => { mounted = false; };
  }, [token]);
  return supported; // null = unknown, true/false known
}

export function useSearchBoxAmenities(opts: UseAmenitiesOptions) {
  const { token, center, route, categories, radiusMeters = 1000, limitPerCategory = 12 } = opts;
  const [results, setResults] = useState<AmenityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const support = useSearchBoxSupport(token);
  const ctxRef = useRef<FetchCtx | null>(null);

  const accessToken = useMemo(() => token || localStorage.getItem("MAPBOX_PUBLIC_TOKEN") || "", [token]);

  useEffect(() => {
    if (!accessToken) return;
    const abort = new AbortController();
    ctxRef.current?.abort.abort();
    ctxRef.current = { abort };

    const run = async () => {
      try {
        setLoading(true); setError(null);
        const all: AmenityResult[] = [];

        const centers: [number, number][] = route ? sampleLine(route, Math.max(400, Math.min(1500, radiusMeters))) : (center ? [center] : []);
        if (!centers.length) { setResults([]); setLoading(false); return; }

        const doFetch = async (q: string, cat: AmenityCategory, c: [number, number]) => {
          if (support === true) {
            const url = new URL("https://api.mapbox.com/search/searchbox/v1/forward");
            url.searchParams.set("q", q);
            url.searchParams.set("proximity", `${c[0]},${c[1]}`);
            url.searchParams.set("types", "poi");
            url.searchParams.set("limit", String(Math.max(3, Math.floor(limitPerCategory / centers.length))));
            url.searchParams.set("access_token", accessToken);
            const res = await fetch(url.toString(), { signal: abort.signal });
            const json = await res.json();
            const feats = (json?.features || []) as any[];
            return feats.map((f) => {
              const coords = (f?.geometry?.coordinates || f?.center) as [number, number];
              return {
                id: f.id || f.mapbox_id || `${coords.join(',')}-${cat}`,
                name: f?.name || f?.properties?.name || f?.properties?.place_name || f?.place_name || "Unknown",
                center: coords,
                address: f?.place_formatted || f?.properties?.full_address || f?.properties?.address,
                category: cat,
                distanceMeters: center ? haversine(center, coords) : undefined,
                rating: f?.properties?.rating || f?.properties?.score || undefined,
                website: f?.properties?.website || undefined,
                googleUrl: f?.properties?.poi?.website || undefined,
              } as AmenityResult;
            });
          } else {
            // Fallback to geocoding v5
            const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`);
            url.searchParams.set("access_token", accessToken);
            url.searchParams.set("types", "poi");
            url.searchParams.set("proximity", `${c[0]},${c[1]}`);
            url.searchParams.set("limit", String(Math.max(3, Math.floor(limitPerCategory / centers.length))));
            url.searchParams.set("country", "AE");
            const res = await fetch(url.toString(), { signal: abort.signal });
            const json = await res.json();
            const feats = (json?.features || []) as any[];
            return feats.map((f) => {
              const coords = (f?.center || f?.geometry?.coordinates) as [number, number];
              return {
                id: f.id,
                name: f.text || f.place_name || f?.properties?.name || "Unknown",
                center: coords,
                address: f.place_name,
                category: cat,
                distanceMeters: center ? haversine(center, coords) : undefined,
              } as AmenityResult;
            });
          }
        };

        const proms: Promise<AmenityResult[]>[] = [];
        for (const cat of categories) {
          const q = CATEGORY_QUERY[cat];
          for (const c of centers) proms.push(doFetch(q, cat, c));
        }
        const chunks = await Promise.all(proms);
        const raw = chunks.flat();

        // Deduplicate by id or close coordinates
        const seen = new Map<string, AmenityResult>();
        for (const r of raw) {
          const key = r.id || `${r.center[0].toFixed(5)},${r.center[1].toFixed(5)}`;
          if (!seen.has(key)) seen.set(key, r);
        }
        const list = Array.from(seen.values());
        // Sort by distance if available
        list.sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
        setResults(list);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setError("Failed to load amenities");
        console.warn("SearchBox amenities failed", e);
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => abort.abort();
  }, [accessToken, JSON.stringify(center), JSON.stringify(route), JSON.stringify(categories), radiusMeters, support]);

  return { results, loading, error, searchBoxSupported: support } as const;
}
