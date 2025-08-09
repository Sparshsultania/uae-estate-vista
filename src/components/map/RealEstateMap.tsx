import React, { useEffect, useMemo, useRef, useImperativeHandle } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
// Keep CSS only; Draw JS will be loaded dynamically to avoid global polyfill issues
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions.css";
import { properties, toFeatureCollection, zones as zoneList, PropertyPoint } from "@/data/mockProperties";

export type IsochroneSettings = {
  enabled?: boolean;
  profile?: 'driving' | 'walking' | 'cycling';
  minutes?: number[];
};

export type RealEstateMapProps = {
  token?: string;
  selected?: PropertyPoint | null;
  onSelect?: (p: PropertyPoint) => void;
  showPriceHeat?: boolean;
  showYieldHeat?: boolean;
  searchArea?: GeoJSON.Feature<GeoJSON.Polygon> | null;
  onAreaChange?: (area: GeoJSON.Feature<GeoJSON.Polygon> | null) => void;
  mapStyle?: string; // e.g. mapbox://styles/mapbox/streets-v12
  flyTo?: { center: [number, number]; zoom?: number };
  isochrone?: IsochroneSettings;
  directionsEnabled?: boolean;
};

const UAE_CENTER: [number, number] = [54.5, 24.2];

function buildZonesFeatureCollection() {
  return {
    type: 'FeatureCollection' as const,
    features: zoneList.map((z) => ({
      type: 'Feature' as const,
      properties: { id: z.id, name: z.name, undervalued: z.undervalued, avgPricePerSqft: z.avgPricePerSqft, avgYield: z.avgYield },
      geometry: z.polygon.geometry,
    })),
  } satisfies GeoJSON.FeatureCollection<GeoJSON.Polygon>;
}

export type RealEstateMapHandle = { startDrawPolygon: () => void; clearDraw: () => void; routeTo: (dest: [number, number], profile?: 'driving'|'walking'|'cycling') => void; };

const RealEstateMap = React.forwardRef<RealEstateMapHandle, RealEstateMapProps>(({ token, selected, onSelect, showPriceHeat, showYieldHeat, searchArea, onAreaChange, mapStyle, flyTo, isochrone, directionsEnabled }, ref) => {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const hoveredBuildingId = useRef<number | string | null>(null);
  const selectedBuildingIds = useRef<Set<number | string>>(new Set());
  const hoverRaf = useRef<number | null>(null);
  const drawRef = useRef<any | null>(null);
  const directionsCtlRef = useRef<any | null>(null);
  // Fallback routing refs
  const routeClickHandlerRef = useRef<((e: mapboxgl.MapMouseEvent) => void) | null>(null);
  const routeActiveRef = useRef<boolean>(false);

  useImperativeHandle(ref, () => ({
    startDrawPolygon: () => {
      const map = mapRef.current;
      if (!map) return;
      try { drawRef.current?.changeMode?.('draw_polygon'); } catch (e) { console.error('startDrawPolygon failed', e); }
    },
    clearDraw: () => {
      try { drawRef.current?.deleteAll?.(); } catch (e) { console.error('clearDraw failed', e); }
      onAreaChange?.(null);
    },
    routeTo: (dest: [number, number], profile: 'driving'|'walking'|'cycling' = 'driving') => {
      const map = mapRef.current; if (!map) return;
      try {
        // Try built-in directions control first
        const ctl: any = directionsCtlRef.current;
        if (ctl && typeof ctl.setDestination === 'function') {
          try { if (selected?.coords) ctl.setOrigin(selected.coords); } catch {}
          try { if (typeof ctl.setProfile === 'function') ctl.setProfile(`mapbox/${profile}`); } catch {}
          ctl.setDestination(dest);
          map.flyTo({ center: dest, zoom: Math.max(map.getZoom(), 14), speed: 1.1, curve: 1.2 });
          if (map.getLayer('3d-buildings')) map.setLayoutProperty('3d-buildings', 'visibility', 'none');
          return;
        }
        // Fallback: draw a route line using Directions API
        if (!map.isStyleLoaded()) { map.once('style.load', () => { (ref as any)?.current?.routeTo?.(dest, profile); }); return; }
        const accessToken = (token || localStorage.getItem('MAPBOX_PUBLIC_TOKEN') || '') as string;
        const ensureSource = () => {
          if (!map.getSource('route')) {
            map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as any });
            map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': 'hsl(182,65%,45%)', 'line-width': 4, 'line-opacity': 0.85 } });
          }
        };
        const origin: [number,number] = selected?.coords ?? (map.getCenter().toArray() as [number,number]);
        const prof = profile || 'driving';
        const url = `https://api.mapbox.com/directions/v5/mapbox/${prof}/${origin[0]},${origin[1]};${dest[0]},${dest[1]}?geometries=geojson&overview=full&access_token=${accessToken}`;
        fetch(url)
          .then((r) => r.json())
          .then((json) => {
            const geom = json?.routes?.[0]?.geometry;
            if (!geom) return;
            ensureSource();
            (map.getSource('route') as mapboxgl.GeoJSONSource).setData({ type: 'Feature', geometry: geom, properties: {} } as any);
            map.flyTo({ center: dest, zoom: Math.max(map.getZoom(), 14), speed: 1.1, curve: 1.2 });
            if (map.getLayer('3d-buildings')) map.setLayoutProperty('3d-buildings', 'visibility', 'none');
          })
          .catch((e) => console.warn('routeTo fetch failed', e));
      } catch (e) {
        console.error('routeTo failed', e);
      }
    },
  }), [onAreaChange, selected, token]);

  const propertiesFC = useMemo(() => toFeatureCollection(properties), []);
  const zonesFC = useMemo(() => buildZonesFeatureCollection(), []);

useEffect(() => {
    const accessToken = token || localStorage.getItem("MAPBOX_PUBLIC_TOKEN") || "";
    if (!container.current || !accessToken) return;

    let map: mapboxgl.Map | null = null;
    try {
      mapboxgl.accessToken = accessToken;

      map = new mapboxgl.Map({
        container: container.current,
        style: mapStyle || "mapbox://styles/mapbox/streets-v12",
        center: UAE_CENTER,
        zoom: 6,
        pitch: 55,
        bearing: -20,
        projection: 'globe',
        antialias: false,
      });

      mapRef.current = map;

      // Log map errors instead of crashing the app
      map.on('error', (e) => {
        console.error('[MapboxGL] error', (e as any)?.error || e);
      });

      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
      map.scrollZoom.enable();
      map.touchZoomRotate.enable();
      map.keyboard.enable();
      map.boxZoom.enable();

      // Draw control for search-by-shape (dynamic import to avoid global issues)
      (async () => {
        try {
          if (typeof (globalThis as any).global === 'undefined') {
            (globalThis as any).global = globalThis;
          }
          const DrawMod: any = await import('@mapbox/mapbox-gl-draw');
          const DrawCtor = DrawMod?.default ?? DrawMod;
          const draw = new DrawCtor({ displayControlsDefault: false, controls: { polygon: true, trash: true } });
          map.addControl(draw, 'top-right');
          drawRef.current = draw;

          map.on('draw.create', (e: any) => {
            try {
              const feat = e.features?.[0];
              if (!feat) return;
              if (feat.geometry.type === 'Polygon') {
                onAreaChange?.(feat as GeoJSON.Feature<GeoJSON.Polygon>);
              }
            } catch (err) { console.error('draw.create error', err); }
          });
          map.on('draw.update', (e: any) => {
            try {
              const feat = e.features?.[0];
              if (!feat) return;
              if (feat.geometry.type === 'Polygon') onAreaChange?.(feat as GeoJSON.Feature<GeoJSON.Polygon>);
            } catch (err) { console.error('draw.update error', err); }
          });
          map.on('draw.delete', () => { onAreaChange?.(null as any); });
        } catch (e) { console.error('Failed to init MapboxDraw', e); }
      })();

      map.on('style.load', () => {
        // Atmosphere
        map!.setFog({
          color: 'rgb(255,255,255)',
          'high-color': 'rgb(210, 230, 255)',
          'horizon-blend': 0.2,
        });

        // Ensure Draw layers persist after style changes
        try { if (drawRef.current?.add) { drawRef.current.add(map!); } } catch (e) { console.warn('draw re-add failed', e); }

        // 3D buildings

        // 3D buildings
        const layers = map!.getStyle().layers || [];
        const labelLayerId = layers.find((l) => l.type === 'symbol' && (l.layout as any)?.['text-field'])?.id;

        // Recreate 3D buildings layer safely (avoid duplicate-id errors after style changes)
        if (map!.getLayer('3d-buildings')) {
          try { map!.removeLayer('3d-buildings'); } catch {}
        }

        map!.addLayer(
          {
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            // Render 3D for polygon footprints even without explicit height
            filter: ['==', ['geometry-type'], 'Polygon'],
            type: 'fill-extrusion',
            minzoom: 13,
            paint: {
              'fill-extrusion-color': [
                'case',
                ['boolean', ['feature-state', 'selected'], false], 'hsl(43,95%,55%)',
                ['boolean', ['feature-state', 'hover'], false], 'hsl(182, 65%, 55%)',
                'hsl(210, 10%, 80%)'
              ],
              'fill-extrusion-height': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                ['*', ['coalesce', ['get', 'height'], 20], 1.2],
                ['boolean', ['feature-state', 'hover'], false],
                ['*', ['coalesce', ['get', 'height'], 20], 1.08],
                ['coalesce', ['get', 'height'], 20]
              ],
              'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
              'fill-extrusion-opacity': 0.9,
            }
          },
          labelLayerId ? labelLayerId : undefined
        );
        // Respect current toggles immediately
        if (isochrone?.enabled || directionsEnabled) {
          map!.setLayoutProperty('3d-buildings', 'visibility', 'none');
        } else {
          map!.setLayoutProperty('3d-buildings', 'visibility', 'visible');
        }

        // Properties point source & layers
        map!.addSource('properties', { type: 'geojson', data: propertiesFC });

        map!.addLayer({
          id: 'property-points',
          type: 'circle',
          source: 'properties',
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              6, 5,
              12, 8,
              15, 10
            ],
            'circle-color': [
              'step', ['get', 'pricePerSqft'],
              'hsl(182,65%,45%)',
              1400, 'hsl(152,53%,41%)',
              2400, 'hsl(43,95%,55%)'
            ],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': 'white',
            'circle-opacity': 0.9,
          }
        });

        // Price labels (show at close zoom for clarity)
        if (!map!.getLayer('property-labels')) {
          map!.addLayer({
            id: 'property-labels',
            type: 'symbol',
            source: 'properties',
            minzoom: 14,
            layout: {
              'text-field': ['format', 'AED ', {}, ['get', 'pricePerSqft'], {}],
              'text-size': [
                'interpolate', ['linear'], ['zoom'],
                14, 10,
                18, 14
              ],
              'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
              'text-offset': [0, 1.2],
              'text-anchor': 'top'
            },
            paint: {
              'text-color': 'hsl(210, 10%, 20%)',
              'text-halo-color': 'hsl(0, 0%, 100%)',
              'text-halo-width': 1.2,
              'text-halo-blur': 0.5
            }
          });
        }

        // Heatmaps
        map!.addLayer({
          id: 'heatmap-price',
          type: 'heatmap',
          source: 'properties',
          maxzoom: 15,
          paint: {
            'heatmap-weight': [
              'interpolate', ['linear'], ['get', 'pricePerSqft'],
              800, 0.2,
              3500, 1
            ],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 13, 1.2],
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'hsla(182,65%,45%,0)',
              0.2, 'hsla(182,65%,45%,0.4)',
              0.5, 'hsla(152,53%,41%,0.6)',
              0.8, 'hsla(43,95%,55%,0.8)'
            ],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 6, 20, 15, 50],
            'heatmap-opacity': 0.8,
          }
        });

        map!.addLayer({
          id: 'heatmap-yield',
          type: 'heatmap',
          source: 'properties',
          maxzoom: 15,
          paint: {
            'heatmap-weight': [
              'interpolate', ['linear'], ['get', 'rentYield'],
              4, 0.2,
              9, 1
            ],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 13, 1.3],
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'hsla(152,53%,41%,0)',
              0.3, 'hsla(152,53%,41%,0.35)',
              0.6, 'hsla(182,65%,45%,0.6)',
              0.85, 'hsla(190,100%,50%,0.8)'
            ],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 6, 20, 15, 55],
            'heatmap-opacity': 0.8,
          }
        });

        // Zones
        map!.addSource('zones', { type: 'geojson', data: zonesFC });
        map!.addLayer({
          id: 'zones-fill',
          type: 'fill',
          source: 'zones',
          paint: {
            'fill-color': [
              'case', ['==', ['get', 'undervalued'], true], 'hsl(152,53%,41%)', 'hsl(210,30%,90%)'
            ],
            'fill-opacity': [
              'case', ['==', ['get', 'undervalued'], true], 0.12, 0.06
            ]
          }
        });

        map!.addLayer({
          id: 'zones-glow',
          type: 'line',
          source: 'zones',
          paint: {
            'line-color': [
              'case', ['==', ['get', 'undervalued'], true], 'hsl(152, 100%, 45%)', 'hsl(190, 100%, 50%)'
            ],
            'line-width': 3,
            'line-blur': 2,
            'line-opacity': 0.9,
          }
        });

        // Neighborhoods feature removed

        // Interactions
        map!.on('mousemove', '3d-buildings', (e) => {
          if (hoverRaf.current) cancelAnimationFrame(hoverRaf.current);
          hoverRaf.current = requestAnimationFrame(() => {
            if (!e.features?.length) return;
            const f = e.features[0];
            const id = f.id as number | string | undefined;
            if (id == null) return;
            if (hoveredBuildingId.current !== null && hoveredBuildingId.current !== id) {
              map!.setFeatureState({ source: 'composite', sourceLayer: 'building', id: hoveredBuildingId.current }, { hover: false });
            }
            hoveredBuildingId.current = id;
            map!.setFeatureState({ source: 'composite', sourceLayer: 'building', id }, { hover: true });
          });
        });
        map!.on('mouseleave', '3d-buildings', () => {
          if (hoverRaf.current) cancelAnimationFrame(hoverRaf.current);
          if (hoveredBuildingId.current !== null) {
            map!.setFeatureState({ source: 'composite', sourceLayer: 'building', id: hoveredBuildingId.current }, { hover: false });
          }
          hoveredBuildingId.current = null;
          map!.getCanvas().style.cursor = '';
        });

        // Pointer cursor when entering buildings
        map!.on('mouseenter', '3d-buildings', () => { map!.getCanvas().style.cursor = 'pointer'; });

        // Click to select building (multi-part selection within a radius)
        map!.on('click', '3d-buildings', (e) => {
          const pad = 35; // pixels around click
          const bbox: [[number, number], [number, number]] = [
            [e.point.x - pad, e.point.y - pad],
            [e.point.x + pad, e.point.y + pad],
          ];
          const feats = map!.queryRenderedFeatures(bbox, { layers: ['3d-buildings'] });
          // Clear previous selection
          selectedBuildingIds.current.forEach((pid) => {
            map!.setFeatureState({ source: 'composite', sourceLayer: 'building', id: pid }, { selected: false });
          });
          selectedBuildingIds.current.clear();

          feats.forEach((ff) => {
            const fid = ff.id as number | string | undefined;
            if (fid == null) return;
            selectedBuildingIds.current.add(fid);
            map!.setFeatureState({ source: 'composite', sourceLayer: 'building', id: fid }, { selected: true });
          });

          // Also select the nearest property within ~300m so we can show the photo + stats popup
          const distMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
            const R = 6371000;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            return 2 * R * Math.asin(Math.sqrt(a));
          };
          const clickLng = e.lngLat.lng; const clickLat = e.lngLat.lat;
          let nearest: typeof properties[number] | null = null; let min = Infinity;
          for (const p of properties) {
            const d = distMeters(clickLat, clickLng, p.coords[1], p.coords[0]);
            if (d < min) { min = d; nearest = p; }
          }
          if (nearest && min <= 300) {
            onSelect?.(nearest);
          }
        });

        map!.on('mouseenter', 'property-points', () => { map!.getCanvas().style.cursor = 'pointer'; });
        map!.on('mouseleave', 'property-points', () => { map!.getCanvas().style.cursor = ''; });

        map!.on('click', 'property-points', (e) => {
          const feat = e.features?.[0] as mapboxgl.MapboxGeoJSONFeature | undefined;
          if (!feat) return;
          const id = feat.properties?.id as string;
          const p = properties.find((pp) => pp.id === id);
          if (p && onSelect) onSelect(p);

          // Popup
          if (feat && feat.geometry.type === 'Point') {
            const coords = (feat.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
            const name = feat.properties?.name as string;
            const price = feat.properties?.pricePerSqft as number;
            const yieldPct = feat.properties?.rentYield as number;
          // Enhanced quick popup
          new mapboxgl.Popup({ 
            closeButton: false, 
            className: 'quick-popup',
            offset: 25 
          })
            .setLngLat(coords)
            .setHTML(`
              <div class="p-2 text-sm space-y-1">
                <div class="font-semibold text-primary">${name}</div>
                <div class="text-xs text-muted-foreground flex justify-between">
                  <span>AED ${price}/sqft</span>
                  <span class="text-emerald-600">${yieldPct}% yield</span>
                </div>
              </div>
            `)
            .addTo(map!);
          }
        });

        // Initial overlays visibility
        map!.setLayoutProperty('heatmap-price', 'visibility', showPriceHeat ? 'visible' : 'none');
        map!.setLayoutProperty('heatmap-yield', 'visibility', showYieldHeat ? 'visible' : 'none');
      });
    } catch (err) {
      console.error('Failed to initialize Mapbox map:', err);
    }

    return () => {
      if (map) map.remove();
    };
  }, [propertiesFC, zonesFC, token]);

  // Update overlays visibility
  useEffect(() => {
    const map = mapRef.current; if (!map || !map.isStyleLoaded()) return;
    if (map.getLayer('heatmap-price')) map.setLayoutProperty('heatmap-price', 'visibility', showPriceHeat ? 'visible' : 'none');
    if (map.getLayer('heatmap-yield')) map.setLayoutProperty('heatmap-yield', 'visibility', showYieldHeat ? 'visible' : 'none');
  }, [showPriceHeat, showYieldHeat]);

  // Ensure 3D buildings are visible unless isochrones or directions are enabled
  useEffect(() => {
    const map = mapRef.current; if (!map || !map.isStyleLoaded()) return;
    const show3d = !(isochrone?.enabled || directionsEnabled);
    if (map.getLayer('3d-buildings')) {
      map.setLayoutProperty('3d-buildings', 'visibility', show3d ? 'visible' : 'none');
    }
  }, [isochrone?.enabled, directionsEnabled]);

  // Isochrone rendering
  useEffect(() => {
    const map = mapRef.current; if (!map || !map.isStyleLoaded()) return;
    const cfg = isochrone || {};
    if (!cfg.enabled) {
      if (map.getLayer('isochrone-fill')) map.removeLayer('isochrone-fill');
      if (map.getLayer('isochrone-outline')) map.removeLayer('isochrone-outline');
      if (map.getSource('isochrones')) map.removeSource('isochrones');
      return;
    }
    const origin: [number, number] = selected?.coords || (map.getCenter().toArray() as [number, number]);
    const mins = (cfg.minutes && cfg.minutes.length ? cfg.minutes : [10, 20, 30]);
    const contours = mins.join(',');
    const profile = cfg.profile || 'driving';
    const accessToken = token || localStorage.getItem('MAPBOX_PUBLIC_TOKEN') || '';
    const url = `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${origin[0]},${origin[1]}?contours_minutes=${contours}&polygons=true&denoise=1&access_token=${accessToken}`;
    fetch(url)
      .then((r) => r.json())
      .then((geo) => {
        if (!geo || !geo.features) return;
        if (map.getSource('isochrones')) {
          (map.getSource('isochrones') as mapboxgl.GeoJSONSource).setData(geo);
        } else {
          map.addSource('isochrones', { type: 'geojson', data: geo });
          map.addLayer({
            id: 'isochrone-fill',
            type: 'fill',
            source: 'isochrones',
            paint: {
              'fill-color': [
                'match',
                ['to-number', ['get', 'contour']],
                mins[0], 'hsla(182,65%,45%,0.30)',
                mins[1] ?? -1, 'hsla(152,53%,41%,0.22)',
                mins[2] ?? -1, 'hsla(43,95%,55%,0.16)',
                'hsla(210,30%,60%,0.12)'
              ],
              'fill-opacity': 0.8
            }
          });
          map.addLayer({
            id: 'isochrone-outline',
            type: 'line',
            source: 'isochrones',
            paint: {
              'line-color': 'hsl(182,65%,45%)',
              'line-width': 2,
              'line-opacity': 0.8
            }
          });
        }
      })
      .catch((e) => console.warn('Isochrone fetch failed', e));
  }, [isochrone?.enabled, isochrone?.profile, JSON.stringify(isochrone?.minutes), selected, token]);

  // Directions control toggle with robust fallback
  useEffect(() => {
    const map = mapRef.current; if (!map) return;

    // Helper to remove fallback artifacts
    const removeFallback = () => {
      if (!map) return;
      // If style is gone (during setStyle or after map.remove), skip cleanup that touches style
      let hasStyle = false; try { hasStyle = map.isStyleLoaded(); } catch { hasStyle = false; }
      if (routeClickHandlerRef.current) {
        // @ts-ignore
        map.off('click', routeClickHandlerRef.current);
        routeClickHandlerRef.current = null;
      }
      if (hasStyle && map.getLayer('route-line')) map.removeLayer('route-line');
      if (hasStyle && map.getSource('route')) map.removeSource('route');
      routeActiveRef.current = false;
    };

    (async () => {
      if (directionsEnabled) {
        // Hide 3D while routing for clarity
        if (map.getLayer('3d-buildings')) map.setLayoutProperty('3d-buildings', 'visibility', 'none');
        try {
          // Some builds require global mapping
          ;(globalThis as any).mapboxgl = mapboxgl;
          const mod: any = await import('@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions');
          const Directions = mod.default || mod;
          const ctl = new Directions({ accessToken: mapboxgl.accessToken, unit: 'metric', profile: 'mapbox/driving' });
          map.addControl(ctl, 'top-left');
          directionsCtlRef.current = ctl;
          if (selected?.coords) ctl.setOrigin(selected.coords);
        } catch (e) {
          console.error('Directions control failed, using fallback routing', e);
          const accessToken = token || localStorage.getItem('MAPBOX_PUBLIC_TOKEN') || '';
          const ensureSource = () => {
            if (!map.getSource('route')) {
              map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as any });
              map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': 'hsl(182,65%,45%)', 'line-width': 4, 'line-opacity': 0.85 } });
            }
          };
          const fetchRoute = async (o: [number,number], d: [number,number]) => {
            const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${o[0]},${o[1]};${d[0]},${d[1]}?geometries=geojson&overview=full&access_token=${accessToken}`;
            const res = await fetch(url);
            const json = await res.json();
            const geom = json?.routes?.[0]?.geometry;
            if (!geom) return;
            ensureSource();
            (map.getSource('route') as mapboxgl.GeoJSONSource).setData({ type: 'Feature', geometry: geom, properties: {} } as any);
          };
          const handler = (e: any) => {
            const origin: [number,number] = selected?.coords ?? (map.getCenter().toArray() as [number,number]);
            const dest: [number,number] = [e.lngLat.lng, e.lngLat.lat];
            fetchRoute(origin, dest);
          };
          routeClickHandlerRef.current = handler;
          // @ts-ignore
          map.on('click', handler);
          routeActiveRef.current = true;
        }
      } else {
        // Turn off
        if (directionsCtlRef.current) {
          try { map.removeControl(directionsCtlRef.current); } catch {}
          directionsCtlRef.current = null;
        }
        removeFallback();
        // Re-show 3D if Isochrones isn't active
        if (map.getLayer('3d-buildings') && !(isochrone?.enabled)) map.setLayoutProperty('3d-buildings', 'visibility', 'visible');
      }
    })();

    return () => {
      // cleanup when dependencies change
      if (directionsCtlRef.current) {
        try { map.removeControl(directionsCtlRef.current); } catch {}
        directionsCtlRef.current = null;
      }
      removeFallback();
    };
  }, [directionsEnabled, selected, token, isochrone?.enabled]);

  // Keep directions origin in sync with selected property
  useEffect(() => {
    const ctl = directionsCtlRef.current;
    if (ctl && selected?.coords) {
      try { ctl.setOrigin(selected.coords); } catch {}
    }
  }, [selected]);

  // Update base style when mapStyle changes
  useEffect(() => {
    const map = mapRef.current; if (!map || !mapStyle) return;
    try { map.setStyle(mapStyle); } catch (e) { console.error('Failed to set style', e); }
  }, [mapStyle]);

  // Search area highlight source
  useEffect(() => {
    const map = mapRef.current; if (!map || !map.isStyleLoaded()) return;
    const sourceId = 'search-area';
    if (searchArea) {
      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(searchArea);
      } else {
        map.addSource(sourceId, { type: 'geojson', data: searchArea });
        map.addLayer({
          id: 'search-area-fill', type: 'fill', source: sourceId,
          paint: { 'fill-color': 'hsl(182,65%,45%)', 'fill-opacity': 0.12 }
        });
        map.addLayer({
          id: 'search-area-outline', type: 'line', source: sourceId,
          paint: { 'line-color': 'hsl(182,65%,45%)', 'line-width': 2, 'line-blur': 2, 'line-opacity': 0.9 }
        });
      }
    } else {
      if (map.getLayer('search-area-fill')) map.removeLayer('search-area-fill');
      if (map.getLayer('search-area-outline')) map.removeLayer('search-area-outline');
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }
  }, [searchArea]);

  // Fly when requested (e.g., geocode selection)
  useEffect(() => {
    const map = mapRef.current; if (!map || !flyTo) return;
    try {
      map.flyTo({ center: flyTo.center, zoom: flyTo.zoom ?? 13, speed: 0.9, curve: 1.2, essential: true });
    } catch (e) { console.error('flyTo failed', e); }
  }, [flyTo]);

  // Fly to selected property with enhanced 3D view
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (!selected) return;
    
    // Close any existing popups
    const popups = document.getElementsByClassName('mapboxgl-popup');
    for (let i = 0; i < popups.length; i++) {
      popups[i].remove();
    }
    
    map.flyTo({
      center: selected.coords,
      zoom: 18,
      pitch: 60,
      bearing: 45,
      duration: 2500,
      essential: true
    });
    
    // Enhanced popup after zoom
    setTimeout(() => {
      const popup = new mapboxgl.Popup({ 
        closeButton: true,
        className: 'custom-popup',
        maxWidth: '300px'
      })
        .setLngLat(selected.coords)
        .setHTML(`
          <div class="rounded-md overflow-hidden">
            <img src="${selected.imageUrl || '/images/buildings/downtown.jpg'}" alt="${selected.name} photo" class="w-full h-32 object-cover" loading="lazy" />
            <div class="p-4 space-y-3">
              <div class="font-bold text-lg text-primary">${selected.name}</div>
              <div class="text-sm text-muted-foreground">${selected.community}</div>
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div class="font-medium">Value</div>
                  <div class="text-primary">AED ${selected.estimatedValueAED.toLocaleString()}</div>
                </div>
                <div>
                  <div class="font-medium">Per Sq.Ft</div>
                  <div>AED ${selected.pricePerSqft}</div>
                </div>
                <div>
                  <div class="font-medium">Yield</div>
                  <div class="text-emerald-600">${selected.rentYield}%</div>
                </div>
                <div>
                  <div class="font-medium">Score</div>
                  <div class="text-amber-600">${selected.investmentScore}/100</div>
                </div>
              </div>
            </div>
          </div>
        `)
        .addTo(map);
    }, 1500);
  }, [selected]);

  const hasToken = !!(token || localStorage.getItem('MAPBOX_PUBLIC_TOKEN'));

  return (
    <div className="relative w-full h-full">
      {!hasToken && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="glass-panel rounded-lg p-6 shadow-xl max-w-md text-center animate-fade-in">
            <h2 className="text-xl font-semibold mb-2">Mapbox token required</h2>
            <p className="text-sm text-muted-foreground">Please provide a Mapbox public token to render the 3D UAE map.</p>
          </div>
        </div>
      )}
      <div ref={container} className="absolute inset-0 rounded-xl shadow-lg" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent to-background/10 rounded-xl" />
    </div>
  );
});

export default RealEstateMap;
