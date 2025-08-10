import React, { useEffect, useMemo, useRef, useImperativeHandle } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
// Keep CSS only; Draw JS will be loaded dynamically to avoid global polyfill issues
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions.css";
import { properties, toFeatureCollection, zones as zoneList, PropertyPoint } from "@/data/mockProperties";
import type { AmenityResult } from "@/hooks/useSearchBoxAmenities";
import type { POIDetails } from "@/components/panels/POIDetailsPanel";
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
  amenities?: AmenityResult[];
  onPOISelect?: (coordinates: [number, number]) => void;
};

const UAE_CENTER: [number, number] = [55.2744, 25.1972];

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

const RealEstateMap = React.forwardRef<RealEstateMapHandle, RealEstateMapProps>(({ token, selected, onSelect, showPriceHeat, showYieldHeat, searchArea, onAreaChange, mapStyle, flyTo, isochrone, directionsEnabled, amenities, onPOISelect }, ref) => {
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
  const amenityMarkersRef = useRef<mapboxgl.Marker[]>([]);

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
            // Keep 3D buildings visible during routing - user preference
            if (map.getLayer('3d-buildings')) map.setLayoutProperty('3d-buildings', 'visibility', 'visible');
            if (map.getLayer('3d-landmarks')) map.setLayoutProperty('3d-landmarks', 'visibility', 'visible');
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
        zoom: 15,
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
      // Force and ensure 3D perspective right after the map fully loads
      map.on('load', () => {
        try {
          if (map.getZoom() < 15) map.setZoom(15);
          map.setPitch(60);
          map.setBearing(45);
          // Add 3D buildings layer if it's not present yet
          if (!map.getLayer('3d-buildings')) {
            const layers = map.getStyle().layers || [];
            const labelLayerId = layers.find((l) => l.type === 'symbol' && (l.layout as any)?.['text-field'])?.id;
            map.addLayer(
              {
                id: '3d-buildings',
                source: 'composite',
                'source-layer': 'building',
                filter: ['==', ['geometry-type'], 'Polygon'],
                type: 'fill-extrusion',
                minzoom: 12,
                paint: {
                  'fill-extrusion-color': [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false], '#8B5CF6', // Purple color like in reference image
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
          }
          map.setLayoutProperty('3d-buildings', 'visibility', 'visible');
        } catch {}
      });

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

        // Add landmark buildings first (famous Dubai landmarks with enhanced styling)
        map!.addLayer(
          {
            id: '3d-landmarks',
            source: 'composite',
            'source-layer': 'building',
            filter: [
              'all',
              ['==', ['geometry-type'], 'Polygon'],
              ['in', ['get', 'name'], ['literal', [
                'Burj Khalifa',
                'Emirates Towers', 'Emirates Tower One', 'Emirates Tower Two',
                'Burj Al Arab', 'Burj Al Arab Jumeirah',
                'Dubai Frame',
                'Atlantis The Palm',
                'Jumeirah Beach Hotel',
                'Rose Tower', 'Rose Rayhaan by Rotana',
                'Four Points by Sheraton Sheikh Zayed Road',
                'JW Marriott Marquis Dubai',
                'Address Downtown',
                'The Address Dubai Mall',
                'Gevora Hotel',
                'Cayan Tower',
                'Marina 101',
                'Princess Tower',
                '23 Marina',
                'Elite Residence'
              ]]]
            ],
            type: 'fill-extrusion',
            minzoom: 8,
            paint: {
              'fill-extrusion-color': [
                'case',
                // Burj Khalifa - Gold
                ['==', ['get', 'name'], 'Burj Khalifa'], 'hsl(45,100%,65%)',
                // Emirates Towers - Blue
                ['in', ['get', 'name'], ['literal', ['Emirates Towers', 'Emirates Tower One', 'Emirates Tower Two']]], 'hsl(200,80%,60%)',
                // Burj Al Arab - Red/Pink
                ['in', ['get', 'name'], ['literal', ['Burj Al Arab', 'Burj Al Arab Jumeirah']]], 'hsl(350,90%,70%)',
                // Dubai Frame - Bronze
                ['==', ['get', 'name'], 'Dubai Frame'], 'hsl(30,85%,60%)',
                // Other landmarks - Special colors
                ['boolean', ['feature-state', 'selected'], false], '#8B5CF6',
                ['boolean', ['feature-state', 'hover'], false], 'hsl(280, 65%, 65%)',
                'hsl(280, 40%, 70%)'
              ],
              'fill-extrusion-height': [
                'case',
                // Famous landmarks with actual heights
                ['==', ['get', 'name'], 'Burj Khalifa'], 828,
                ['in', ['get', 'name'], ['literal', ['Emirates Towers', 'Emirates Tower One']]], 355,
                ['==', ['get', 'name'], 'Emirates Tower Two'], 309,
                ['in', ['get', 'name'], ['literal', ['Burj Al Arab', 'Burj Al Arab Jumeirah']]], 321,
                ['==', ['get', 'name'], 'Dubai Frame'], 150,
                ['==', ['get', 'name'], 'Gevora Hotel'], 356,
                ['==', ['get', 'name'], 'JW Marriott Marquis Dubai'], 355,
                ['==', ['get', 'name'], 'Rose Tower'], 333,
                ['==', ['get', 'name'], 'Princess Tower'], 414,
                ['==', ['get', 'name'], 'Marina 101'], 427,
                ['==', ['get', 'name'], 'Cayan Tower'], 306,
                ['==', ['get', 'name'], '23 Marina'], 392,
                ['==', ['get', 'name'], 'Elite Residence'], 380,
                // Selected/hover states
                ['boolean', ['feature-state', 'selected'], false],
                ['*', ['coalesce', ['get', 'height'], 50], 1.3],
                ['boolean', ['feature-state', 'hover'], false],
                ['*', ['coalesce', ['get', 'height'], 50], 1.15],
                ['coalesce', ['get', 'height'], 50]
              ],
              'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
              'fill-extrusion-opacity': 0.95,
            }
          },
          labelLayerId ? labelLayerId : undefined
        );

        // Regular 3D buildings (non-landmarks)
        map!.addLayer(
          {
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: [
              'all',
              ['==', ['geometry-type'], 'Polygon'],
              ['!in', ['get', 'name'], ['literal', [
                'Burj Khalifa',
                'Emirates Towers', 'Emirates Tower One', 'Emirates Tower Two',
                'Burj Al Arab', 'Burj Al Arab Jumeirah',
                'Dubai Frame',
                'Atlantis The Palm',
                'Jumeirah Beach Hotel',
                'Rose Tower', 'Rose Rayhaan by Rotana',
                'Four Points by Sheraton Sheikh Zayed Road',
                'JW Marriott Marquis Dubai',
                'Address Downtown',
                'The Address Dubai Mall',
                'Gevora Hotel',
                'Cayan Tower',
                'Marina 101',
                'Princess Tower',
                '23 Marina',
                'Elite Residence'
              ]]]
            ],
            type: 'fill-extrusion',
            minzoom: 14,
            paint: {
              'fill-extrusion-color': [
                'case',
                ['boolean', ['feature-state', 'selected'], false], '#8B5CF6',
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
              'fill-extrusion-opacity': 0.75,
            }
          },
          labelLayerId ? labelLayerId : undefined
        );
        // Respect current toggles immediately
        if (isochrone?.enabled || directionsEnabled) {
          map!.setLayoutProperty('3d-buildings', 'visibility', 'none');
          map!.setLayoutProperty('3d-landmarks', 'visibility', 'none');
        } else {
          map!.setLayoutProperty('3d-buildings', 'visibility', 'visible');
          map!.setLayoutProperty('3d-landmarks', 'visibility', 'visible');
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

        // Interactions for landmarks
        map!.on('mousemove', '3d-landmarks', (e) => {
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
        map!.on('mouseleave', '3d-landmarks', () => {
          if (hoverRaf.current) cancelAnimationFrame(hoverRaf.current);
          if (hoveredBuildingId.current !== null) {
            map!.setFeatureState({ source: 'composite', sourceLayer: 'building', id: hoveredBuildingId.current }, { hover: false });
          }
          hoveredBuildingId.current = null;
          map!.getCanvas().style.cursor = '';
        });
        map!.on('mouseenter', '3d-landmarks', () => { map!.getCanvas().style.cursor = 'pointer'; });

        // Interactions for regular buildings
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
        map!.on('mouseenter', '3d-buildings', () => { map!.getCanvas().style.cursor = 'pointer'; });

        // Enhanced click handler for landmarks with POI integration
        map!.on('click', '3d-landmarks', (e) => {
          const feats = map!.queryRenderedFeatures(e.point, { layers: ['3d-landmarks', '3d-buildings'] });
          
          // Clear previous selection and marker
          selectedBuildingIds.current.forEach((pid) => {
            map!.setFeatureState({ source: 'composite', sourceLayer: 'building', id: pid }, { selected: false });
          });
          selectedBuildingIds.current.clear();
          
          // Remove previous building marker
          if (map!.getSource('building-marker')) {
            if (map!.getLayer('building-marker-icon')) map!.removeLayer('building-marker-icon');
            if (map!.getLayer('building-marker-inner')) map!.removeLayer('building-marker-inner');
            map!.removeSource('building-marker');
          }

          if (feats.length > 0) {
            const closestFeature = feats[0]; // Landmarks take priority
            const fid = closestFeature.id as number | string | undefined;
            if (fid != null) {
              selectedBuildingIds.current.add(fid);
              map!.setFeatureState({ source: 'composite', sourceLayer: 'building', id: fid }, { selected: true });
              console.log('Selected landmark building:', closestFeature.properties?.name || `Building ${fid}`);
              
              // Handle the same building selection logic...
              const buildingGeometry = closestFeature.geometry;
              if (buildingGeometry && (buildingGeometry.type === 'Polygon' || buildingGeometry.type === 'MultiPolygon')) {
                let coords: number[][];
                if (buildingGeometry.type === 'Polygon') {
                  coords = buildingGeometry.coordinates[0];
                } else {
                  coords = buildingGeometry.coordinates[0][0];
                }
                
                const centroid = coords.reduce((acc, coord) => [acc[0] + coord[0], acc[1] + coord[1]], [0, 0]);
                centroid[0] /= coords.length;
                centroid[1] /= coords.length;
                
                // Same property point creation and geocoding logic...
                if (onSelect) {
                  const tempPropertyPoint: PropertyPoint = {
                    id: fid.toString(),
                    coords: [centroid[0], centroid[1]],
                    name: `Loading...`,
                    community: "Dubai",
                    estimatedValueAED: Math.floor(Math.random() * 2000000) + 800000,
                    pricePerSqft: Math.floor(Math.random() * 800) + 600,
                    rentYield: Math.round((Math.random() * 4 + 5) * 10) / 10,
                    investmentScore: Math.floor(Math.random() * 30) + 70,
                    priceTrend: Array.from({ length: 12 }).map((_, i) => ({
                      month: new Date(2024, i, 1).toLocaleString('en', { month: 'short' }),
                      value: Math.floor(Math.random() * 1000) + 1500
                    }))
                  };
                  
                  onSelect(tempPropertyPoint);
                  
                  // Use the landmark name directly if available, otherwise geocode
                  const landmarkName = closestFeature.properties?.name;
                  if (landmarkName) {
                    const updatedPropertyPoint: PropertyPoint = {
                      ...tempPropertyPoint,
                      name: landmarkName,
                      community: "Dubai"
                    };
                    onSelect(updatedPropertyPoint);
                  } else {
                    // Fallback to geocoding for unnamed landmarks
                    fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${centroid[0]},${centroid[1]}.json?access_token=${token}&types=poi,address`)
                      .then(response => response.json())
                      .then(data => {
                        let buildingName = `Building ${fid}`;
                        let community = "Dubai";
                        
                        if (data.features && data.features.length > 0) {
                          const feature = data.features[0];
                          if (feature.place_type?.includes('poi')) {
                            buildingName = feature.text || feature.place_name || buildingName;
                          } else if (feature.place_type?.includes('address')) {
                            buildingName = feature.place_name || buildingName;
                          }
                          
                          if (feature.context) {
                            const neighborhood = feature.context.find((c: any) => c.id.startsWith('neighborhood'));
                            const locality = feature.context.find((c: any) => c.id.startsWith('locality'));
                            const district = feature.context.find((c: any) => c.id.startsWith('district'));
                            community = neighborhood?.text || locality?.text || district?.text || "Dubai";
                          }
                        }
                        
                        const updatedPropertyPoint: PropertyPoint = {
                          ...tempPropertyPoint,
                          name: buildingName,
                          community: community
                        };
                        onSelect(updatedPropertyPoint);
                      })
                      .catch(error => {
                        console.error('Failed to geocode building location:', error);
                        const fallbackPropertyPoint: PropertyPoint = {
                          ...tempPropertyPoint,
                          name: `Building ${fid}`,
                        };
                        onSelect(fallbackPropertyPoint);
                      });
                  }
                }

                // Add marker (same logic)
                if (map!.getSource('building-marker')) {
                  if (map!.getLayer('building-marker-icon')) map!.removeLayer('building-marker-icon');
                  if (map!.getLayer('building-marker-inner')) map!.removeLayer('building-marker-inner');
                  map!.removeSource('building-marker');
                }
                
                map!.addSource('building-marker', {
                  type: 'geojson',
                  data: {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: centroid },
                    properties: {}
                  }
                });
                
                map!.addLayer({
                  id: 'building-marker-icon',
                  type: 'circle',
                  source: 'building-marker',
                  paint: {
                    'circle-radius': 8,
                    'circle-color': '#8B5CF6',
                    'circle-stroke-color': '#FFFFFF',
                    'circle-stroke-width': 2,
                    'circle-opacity': 1
                  }
                });
                
                map!.addLayer({
                  id: 'building-marker-inner',
                  type: 'circle',
                  source: 'building-marker',
                  paint: {
                    'circle-radius': 4,
                    'circle-color': '#FFFFFF',
                    'circle-opacity': 1
                  }
                });
              }
            }
          }

          // Also handle POI selection for clicked location
          const clickCoords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
          onPOISelect?.(clickCoords);
        });

        // Enhanced click handler for regular buildings with POI integration - single building selection
        map!.on('click', '3d-buildings', (e) => {
          const feats = map!.queryRenderedFeatures(e.point, { layers: ['3d-buildings'] });
          
          // Clear previous selection and marker
          selectedBuildingIds.current.forEach((pid) => {
            map!.setFeatureState({ source: 'composite', sourceLayer: 'building', id: pid }, { selected: false });
          });
          selectedBuildingIds.current.clear();
          
          // Remove previous building marker
          if (map!.getSource('building-marker')) {
            if (map!.getLayer('building-marker-icon')) map!.removeLayer('building-marker-icon');
            if (map!.getLayer('building-marker-inner')) map!.removeLayer('building-marker-inner');
            map!.removeSource('building-marker');
          }

          if (feats.length > 0) {
            // Find the closest building to click point (same logic as before but for single selection)
            let closestFeature = feats[0];
            let minDistance = Infinity;
            
            for (const feat of feats) {
              if (feat.geometry?.type === 'Polygon' || feat.geometry?.type === 'MultiPolygon') {
                // Calculate distance from click point to feature
                const clickLngLat = e.lngLat;
                // For simplicity, use the first feature's centroid or just the first one
                const distance = Math.abs(feat.properties?.height || 0) + Math.random() * 0.001; // Small randomization as tiebreaker
                
                if (distance < minDistance || minDistance === Infinity) {
                  minDistance = distance;
                  closestFeature = feat;
                }
              }
            }
            
            // Select only the closest building
            const fid = closestFeature.id as number | string | undefined;
            if (fid != null) {
              selectedBuildingIds.current.add(fid);
              map!.setFeatureState({ source: 'composite', sourceLayer: 'building', id: fid }, { selected: true });
              console.log('Selected single building:', closestFeature.properties?.name || `Building ${fid}`);
              
              // Add a small purple pin marker above the selected building
              const buildingGeometry = closestFeature.geometry;
              if (buildingGeometry && (buildingGeometry.type === 'Polygon' || buildingGeometry.type === 'MultiPolygon')) {
                // Calculate the centroid of the building for marker placement
                let coords: number[][];
                if (buildingGeometry.type === 'Polygon') {
                  coords = buildingGeometry.coordinates[0];
                } else {
                  coords = buildingGeometry.coordinates[0][0]; // First polygon of multipolygon
                }
                
                const centroid = coords.reduce((acc, coord) => [acc[0] + coord[0], acc[1] + coord[1]], [0, 0]);
                centroid[0] /= coords.length;
                centroid[1] /= coords.length;
                
                // Use Mapbox Geocoding API to get the actual building name
                if (onSelect) {
                  // First, create a temporary property point with the building ID
                  const tempPropertyPoint: PropertyPoint = {
                    id: fid.toString(),
                    coords: [centroid[0], centroid[1]],
                    name: `Loading...`,
                    community: "Dubai",
                    estimatedValueAED: Math.floor(Math.random() * 2000000) + 800000,
                    pricePerSqft: Math.floor(Math.random() * 800) + 600,
                    rentYield: Math.round((Math.random() * 4 + 5) * 10) / 10,
                    investmentScore: Math.floor(Math.random() * 30) + 70,
                    priceTrend: Array.from({ length: 12 }).map((_, i) => ({
                      month: new Date(2024, i, 1).toLocaleString('en', { month: 'short' }),
                      value: Math.floor(Math.random() * 1000) + 1500
                    }))
                  };
                  
                  // Show loading state first
                  onSelect(tempPropertyPoint);
                  
                  // Then fetch the real building name using reverse geocoding
                  fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${centroid[0]},${centroid[1]}.json?access_token=${token}&types=poi,address`)
                    .then(response => response.json())
                    .then(data => {
                      let buildingName = `Building ${fid}`;
                      let community = "Dubai";
                      
                      if (data.features && data.features.length > 0) {
                        const feature = data.features[0];
                        
                        // Try to get a proper building/POI name
                        if (feature.place_type?.includes('poi')) {
                          buildingName = feature.text || feature.place_name || buildingName;
                        } else if (feature.place_type?.includes('address')) {
                          buildingName = feature.place_name || buildingName;
                        }
                        
                        // Extract community/neighborhood from context
                        if (feature.context) {
                          const neighborhood = feature.context.find((c: any) => c.id.startsWith('neighborhood'));
                          const locality = feature.context.find((c: any) => c.id.startsWith('locality'));
                          const district = feature.context.find((c: any) => c.id.startsWith('district'));
                          
                          community = neighborhood?.text || locality?.text || district?.text || "Dubai";
                        }
                      }
                      
                      // Update with the real building name
                      const updatedPropertyPoint: PropertyPoint = {
                        ...tempPropertyPoint,
                        name: buildingName,
                        community: community
                      };
                      
                      onSelect(updatedPropertyPoint);
                    })
                    .catch(error => {
                      console.error('Failed to geocode building location:', error);
                      // Fallback to the temporary property point
                      const fallbackPropertyPoint: PropertyPoint = {
                        ...tempPropertyPoint,
                        name: closestFeature.properties?.name || `Building ${fid}`,
                      };
                      onSelect(fallbackPropertyPoint);
                    });
                }
                
                // Remove previous building marker if exists
                if (map!.getSource('building-marker')) {
                  if (map!.getLayer('building-marker-icon')) map!.removeLayer('building-marker-icon');
                  if (map!.getLayer('building-marker-inner')) map!.removeLayer('building-marker-inner');
                  map!.removeSource('building-marker');
                }
                
                // Add the purple pin marker
                map!.addSource('building-marker', {
                  type: 'geojson',
                  data: {
                    type: 'Feature',
                    geometry: {
                      type: 'Point',
                      coordinates: centroid
                    },
                    properties: {}
                  }
                });
                
                // Add a circle marker (easier than relying on built-in icons)
                map!.addLayer({
                  id: 'building-marker-icon',
                  type: 'circle',
                  source: 'building-marker',
                  paint: {
                    'circle-radius': 8,
                    'circle-color': '#8B5CF6', // Purple color to match building
                    'circle-stroke-color': '#FFFFFF',
                    'circle-stroke-width': 2,
                    'circle-opacity': 1
                  }
                });
                
                // Add a smaller inner circle for pin effect
                map!.addLayer({
                  id: 'building-marker-inner',
                  type: 'circle',
                  source: 'building-marker',
                  paint: {
                    'circle-radius': 4,
                    'circle-color': '#FFFFFF',
                    'circle-opacity': 1
                  }
                });
              }
            }
          }

          // Close any existing popups first
          const popups = document.getElementsByClassName('mapboxgl-popup');
          for (let i = 0; i < popups.length; i++) {
            popups[i].remove();
          }

          // Trigger POI data fetch for the clicked location
          const clickCoords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
          onPOISelect?.(clickCoords);

          // Also select the nearest property within ~300m for property stats
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

  // Keep 3D buildings visible at all times - user wants them to stay on
  useEffect(() => {
    const map = mapRef.current; if (!map || !map.isStyleLoaded()) return;
    if (map.getLayer('3d-buildings')) {
      map.setLayoutProperty('3d-buildings', 'visibility', 'visible');
    }
    if (map.getLayer('3d-landmarks')) {
      map.setLayoutProperty('3d-landmarks', 'visibility', 'visible');
    }
  }, [isochrone?.enabled, directionsEnabled]);

  // Isochrone rendering
  useEffect(() => {
    const map = mapRef.current; 
    if (!map) return;
    
    const cfg = isochrone || {};
    
    // Clean up existing isochrone layers
    const cleanupIsochrones = () => {
      try {
        if (map.getLayer('isochrone-fill')) map.removeLayer('isochrone-fill');
        if (map.getLayer('isochrone-outline')) map.removeLayer('isochrone-outline');
        if (map.getSource('isochrones')) map.removeSource('isochrones');
      } catch (e) {
        console.warn('Failed to cleanup isochrones:', e);
      }
    };
    
    if (!cfg.enabled) {
      cleanupIsochrones();
      // Clean up all category-specific amenity layers
      const categories = [
        'restaurant', 'cafe', 'school', 'hospital', 'pharmacy', 
        'bank', 'gas_station', 'shopping_mall', 'gym', 'park',
        'metro_station', 'bus_station', 'atm', 'grocery'
      ];
      categories.forEach(category => {
        if (map.getLayer(`amenities-${category}`)) map.removeLayer(`amenities-${category}`);
        if (map.getLayer(`amenities-${category}-labels`)) map.removeLayer(`amenities-${category}-labels`);
        if (map.getSource(`amenities-${category}`)) map.removeSource(`amenities-${category}`);
      });
      // Always keep 3D buildings visible - user preference
      if (map.getLayer('3d-buildings')) {
        map.setLayoutProperty('3d-buildings', 'visibility', 'visible');
      }
      if (map.getLayer('3d-landmarks')) {
        map.setLayoutProperty('3d-landmarks', 'visibility', 'visible');
      }
      return;
    }
    
    // Wait for style to load before adding isochrones
    const addIsochrones = () => {
      if (!map.isStyleLoaded()) {
        map.once('style.load', addIsochrones);
        return;
      }
      
      // Keep 3D buildings visible even with isochrones - user preference
      if (map.getLayer('3d-buildings')) {
        map.setLayoutProperty('3d-buildings', 'visibility', 'visible');
      }
      if (map.getLayer('3d-landmarks')) {
        map.setLayoutProperty('3d-landmarks', 'visibility', 'visible');
      }
      
      const origin: [number, number] = selected?.coords || (map.getCenter().toArray() as [number, number]);
      const mins = (cfg.minutes && cfg.minutes.length ? cfg.minutes : [10, 20, 30]);
      const contours = mins.join(',');
      const profile = cfg.profile || 'driving';
      const accessToken = token || localStorage.getItem('MAPBOX_PUBLIC_TOKEN') || '';
      
      if (!accessToken) {
        console.warn('No access token available for isochrone');
        return;
      }
      
      const url = `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${origin[0]},${origin[1]}?contours_minutes=${contours}&polygons=true&denoise=1&generalize=75&access_token=${accessToken}`;
      
      console.log('Fetching isochrone from:', url);
      console.log('Origin coordinates:', origin);
      console.log('Profile:', profile, 'Contours:', contours);
      
      fetch(url)
        .then((r) => {
          console.log('Isochrone response status:', r.status);
          return r.json();
        })
        .then((geo) => {
          console.log('Isochrone data received:', geo);
          if (!geo || !geo.features) {
            console.warn('No isochrone features received');
            return;
          }
          if (!map.isStyleLoaded()) {
            console.warn('Map style not loaded, skipping isochrone rendering');
            return;
          }
          
          // Clean up existing first
          cleanupIsochrones();
          
          // Add new isochrone data
          map.addSource('isochrones', { type: 'geojson', data: geo });
          
          map.addLayer({
            id: 'isochrone-fill',
            type: 'fill',
            source: 'isochrones',
            paint: {
              'fill-color': [
                'match',
                ['to-number', ['get', 'contour']],
                mins[0], 'rgba(34, 197, 94, 0.25)', // Green for shortest time
                mins[1] ?? -1, 'rgba(59, 130, 246, 0.20)', // Blue for medium time  
                mins[2] ?? -1, 'rgba(168, 85, 247, 0.15)', // Purple for longest time
                'rgba(107, 114, 128, 0.1)' // Default gray
              ],
              'fill-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10, 0.6,
                15, 0.3
              ]
            }
          });
          
          map.addLayer({
            id: 'isochrone-outline',
            type: 'line',
            source: 'isochrones',
            paint: {
              'line-color': [
                'match',
                ['to-number', ['get', 'contour']],
                mins[0], 'rgb(34, 197, 94)',
                mins[1] ?? -1, 'rgb(59, 130, 246)',
                mins[2] ?? -1, 'rgb(168, 85, 247)',
                'rgb(107, 114, 128)'
              ],
              'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10, 1.5,
                15, 2.5
              ],
              'line-opacity': 0.8
            }
          });
          
          console.log('Isochrone layers added successfully');
          
          // Debug: Log isochrone data structure  
          console.log('Isochrone geo data:', geo);
          console.log('Features count:', geo?.features?.length);
          
          // Automatically fetch amenities within isochrone zones
          fetchAmenitiesInIsochrone(geo);
        })
        .catch((e) => {
          console.error('Isochrone fetch failed:', e);
          console.error('URL that failed:', url);
        });
      
      // Function to fetch amenities within isochrone zones
      const fetchAmenitiesInIsochrone = async (isochroneData: any) => {
        console.log('fetchAmenitiesInIsochrone called with:', isochroneData);
        
        if (!isochroneData?.features?.length) {
          console.warn('No isochrone features found:', isochroneData);
          return;
        }
        
        const categories = [
          'restaurant', 'cafe', 'school', 'hospital', 'pharmacy', 
          'bank', 'gas_station', 'shopping_mall', 'gym', 'park',
          'metro_station', 'bus_station', 'atm', 'grocery'
        ];
        
        try {
          // Get bounding box of the largest isochrone (last feature)
          const largestFeature = isochroneData.features[isochroneData.features.length - 1];
          console.log('Using largest feature for bbox:', largestFeature);
          
          if (!largestFeature?.geometry) {
            console.error('No geometry found in largest feature');
            return;
          }
          
          const bbox = getBoundingBox(largestFeature.geometry);
          console.log('Calculated bbox:', bbox);
          
          if (!accessToken) {
            console.error('No access token available for amenity fetch');
            return;
          }
          
          // Search for specific well-known places in Dubai using POI types
          const centerLng = (bbox[0] + bbox[2]) / 2;
          const centerLat = (bbox[1] + bbox[3]) / 2;
          
          console.log('Searching for real amenities using POI types...');
          
          const amenityPromises = [
            // Search for POIs with different types
            fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/poi.json?proximity=${centerLng},${centerLat}&bbox=${bbox.join(',')}&limit=20&types=poi&access_token=${accessToken}`)
              .then(res => res.json())
              .then(data => {
                console.log('POI search results:', data.features?.length || 0);
                return data.features?.map((feature: any) => {
                  // Determine category based on place name content
                  const name = (feature.text || feature.place_name || '').toLowerCase();
                  let category = 'other';
                  
                  if (name.includes('restaurant') || name.includes('dining') || name.includes('food') || name.includes('kitchen') || name.includes('grill')) {
                    category = 'restaurant';
                  } else if (name.includes('coffee') || name.includes('cafe') || name.includes('starbucks') || name.includes('costa')) {
                    category = 'cafe';
                  } else if (name.includes('school') || name.includes('university') || name.includes('college') || name.includes('academy')) {
                    category = 'school';
                  } else if (name.includes('hospital') || name.includes('clinic') || name.includes('medical') || name.includes('health')) {
                    category = 'hospital';
                  } else if (name.includes('bank') || name.includes('atm') || name.includes('finance') || name.includes('emirates nbd') || name.includes('adcb')) {
                    category = 'bank';
                  } else if (name.includes('mall') || name.includes('shopping') || name.includes('retail') || name.includes('store') || name.includes('market')) {
                    category = 'shopping_mall';
                  }
                  
                  return {
                    geometry: feature.geometry,
                    properties: {
                      category,
                      name: feature.text || feature.place_name,
                      address: feature.place_name,
                      mapbox_id: feature.id
                    }
                  };
                }).filter((amenity: any) => amenity.properties.category !== 'other') || [];
              })
              .catch(error => {
                console.error('POI search failed:', error);
                return [];
              }),
              
            // Also try searching for addresses to find more results
            fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/dubai.json?proximity=${centerLng},${centerLat}&bbox=${bbox.join(',')}&limit=15&types=address,poi,place&access_token=${accessToken}`)
              .then(res => res.json())
              .then(data => {
                console.log('Dubai area search results:', data.features?.length || 0);
                return data.features?.filter((feature: any) => {
                  const name = (feature.text || feature.place_name || '').toLowerCase();
                  return (feature.properties?.category || 
                          name.includes('restaurant') || name.includes('cafe') || 
                          name.includes('school') || name.includes('hospital') ||
                          name.includes('bank') || name.includes('mall'));
                }).map((feature: any) => {
                  const name = (feature.text || feature.place_name || '').toLowerCase();
                  let category = 'restaurant'; // Default
                  
                  if (name.includes('coffee') || name.includes('cafe')) category = 'cafe';
                  else if (name.includes('school') || name.includes('university')) category = 'school';
                  else if (name.includes('hospital') || name.includes('clinic')) category = 'hospital';
                  else if (name.includes('bank') || name.includes('atm')) category = 'bank';
                  else if (name.includes('mall') || name.includes('shopping')) category = 'shopping_mall';
                  
                  return {
                    geometry: feature.geometry,
                    properties: {
                      category,
                      name: feature.text || feature.place_name,
                      address: feature.place_name,
                      mapbox_id: feature.id
                    }
                  };
                }) || [];
              })
              .catch(error => {
                console.error('Dubai area search failed:', error);
                return [];
              })
          ];
          
          const allAmenities = (await Promise.all(amenityPromises)).flat();
          console.log('Total authentic amenities found:', allAmenities.length);
          
          if (allAmenities.length > 0) {
            // Remove duplicates based on coordinates
            const uniqueAmenities = allAmenities.filter((amenity, index, arr) => {
              const coords = amenity.geometry.coordinates;
              return index === arr.findIndex(a => 
                Math.abs(a.geometry.coordinates[0] - coords[0]) < 0.001 &&
                Math.abs(a.geometry.coordinates[1] - coords[1]) < 0.001
              );
            });
            
            console.log('Unique authentic amenities:', uniqueAmenities.length);
            console.log('Sample real amenities:', uniqueAmenities.slice(0, 3).map(a => ({ 
              name: a.properties.name, 
              category: a.properties.category 
            })));
            
            displayAmenitiesOnMap(uniqueAmenities);
          } else {
            console.warn('No authentic amenities found in this travel zone');
            
            // Show user-friendly notification
            const notification = document.createElement('div');
            notification.style.cssText = `
              position: fixed; top: 80px; right: 20px; z-index: 1000;
              background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px;
              border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              max-width: 320px; font-size: 14px; color: #92400e; font-weight: 500;
            `;
            notification.innerHTML = '⚠️ No amenities found in this specific travel zone. Try selecting a larger travel time or different location.';
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 5000);
          }
        } catch (error) {
          console.error('Failed to fetch amenities in isochrone:', error);
          console.error('Error stack:', error.stack);
        }
      };
      
      // Helper to get bounding box from geometry
      const getBoundingBox = (geometry: any) => {
        console.log('getBoundingBox input geometry:', geometry);
        
        if (!geometry?.coordinates?.length) {
          console.error('Invalid geometry for bbox calculation');
          return [55.1, 25.0, 55.4, 25.3]; // Fallback Dubai bbox
        }
        
        const coords = geometry.coordinates[0];
        console.log('First 3 coordinates:', coords.slice(0, 3));
        
        let minLng = coords[0][0], maxLng = coords[0][0];
        let minLat = coords[0][1], maxLat = coords[0][1];
        
        coords.forEach(([lng, lat]: [number, number]) => {
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
        });
        
        const bbox = [minLng, minLat, maxLng, maxLat];
        console.log('Calculated bbox:', bbox);
        return bbox;
      };
      
      // Function to display amenities on map with category clustering
      const displayAmenitiesOnMap = (amenities: any[]) => {
        // Group amenities by category
        const categoryGroups = amenities.reduce((groups, amenity) => {
          const category = amenity.properties.category;
          if (!groups[category]) groups[category] = [];
          groups[category].push(amenity);
          return groups;
        }, {} as { [key: string]: any[] });
        
        // Remove existing amenity layers first
        const allCategories = [
          'restaurant', 'cafe', 'school', 'hospital', 'pharmacy', 
          'bank', 'gas_station', 'shopping_mall', 'gym', 'park',
          'metro_station', 'bus_station', 'atm', 'grocery'
        ];
        allCategories.forEach(category => {
          try {
            if (map.getLayer(`amenities-${category}`)) map.removeLayer(`amenities-${category}`);
            if (map.getLayer(`amenities-${category}-labels`)) map.removeLayer(`amenities-${category}-labels`);
            if (map.getSource(`amenities-${category}`)) map.removeSource(`amenities-${category}`);
          } catch (e) {
            console.warn(`Failed to remove amenity layer ${category}:`, e);
          }
        });
        
        // Create separate layer for each category with distinct styling
        Object.entries(categoryGroups).forEach(([category, categoryAmenities]) => {
          console.log(`Creating layer for ${category} with ${categoryAmenities.length} amenities`);
          
          const categoryGeoJSON = {
            type: 'FeatureCollection',
            features: categoryAmenities.map((amenity: any) => ({
              type: 'Feature',
              geometry: amenity.geometry,
              properties: {
                category: amenity.properties.category,
                name: amenity.properties.name,
                address: amenity.properties.address,
                icon: getCategoryIcon(amenity.properties.category)
              }
            }))
          };
          
          // Add category-specific source
          map.addSource(`amenities-${category}`, {
            type: 'geojson',
            data: categoryGeoJSON as any
          });
          
          // Add category-specific layer with unique colors
          const categoryColor = getCategoryColor(category);
          
          map.addLayer({
            id: `amenities-${category}`,
            type: 'circle',
            source: `amenities-${category}`,
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10, 8,
                16, 12
              ],
              'circle-color': categoryColor,
              'circle-opacity': 0.85,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
              'circle-stroke-opacity': 1.0
            }
          });
          
          console.log(`Added layer amenities-${category} with color ${categoryColor}`);
          
          // Debug: Check if layer was actually added
          setTimeout(() => {
            const layerExists = map.getLayer(`amenities-${category}`);
            const sourceExists = map.getSource(`amenities-${category}`);
            console.log(`Layer ${category} exists:`, !!layerExists, 'Source exists:', !!sourceExists);
            if (sourceExists) {
              console.log(`Source ${category} data:`, (map.getSource(`amenities-${category}`) as any)?._data);
            }
          }, 100);
          
          // Add labels for amenities
          map.addLayer({
            id: `amenities-${category}-labels`,
            type: 'symbol',
            source: `amenities-${category}`,
            layout: {
              'text-field': ['get', 'name'],
              'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
              'text-size': 10,
              'text-offset': [0, 2],
              'text-anchor': 'top',
              'text-max-width': 10
            },
            paint: {
              'text-color': categoryColor,
              'text-halo-color': 'white',
              'text-halo-width': 1.5
            }
          });
        });
      };
      
      // Helper to get category icon
      const getCategoryIcon = (category: string) => {
        const iconMap: { [key: string]: string } = {
          restaurant: 'restaurant-15',
          cafe: 'cafe-15',
          school: 'school-15',
          hospital: 'hospital-15',
          pharmacy: 'pharmacy-15',
          bank: 'bank-15',
          gas_station: 'fuel-15',
          shopping_mall: 'shopping-15',
          gym: 'fitness-centre-15',
          park: 'park-15',
          metro_station: 'rail-metro-15',
          bus_station: 'bus-15',
          atm: 'bank-15',
          grocery: 'grocery-15'
        };
        return iconMap[category] || 'marker-15';
      };
      
      // Helper to get category-specific colors
      const getCategoryColor = (category: string) => {
        const colorMap: { [key: string]: string } = {
          restaurant: '#ef4444', // Red
          cafe: '#f97316', // Orange  
          school: '#3b82f6', // Blue
          hospital: '#dc2626', // Dark red
          pharmacy: '#059669', // Green
          bank: '#7c3aed', // Purple
          gas_station: '#eab308', // Yellow
          shopping_mall: '#ec4899', // Pink
          gym: '#06b6d4', // Cyan
          park: '#22c55e', // Light green
          metro_station: '#6366f1', // Indigo
          bus_station: '#8b5cf6', // Violet
          atm: '#7c3aed', // Purple
          grocery: '#f59e0b' // Amber
        };
        return colorMap[category] || '#64748b';
      };
    };
    
    addIsochrones();
    
    return () => {
      cleanupIsochrones();
    };
  }, [isochrone?.enabled, isochrone?.profile, JSON.stringify(isochrone?.minutes), selected, token, directionsEnabled]);

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
        // Keep 3D buildings visible even during routing - user preference
        if (map.getLayer('3d-buildings')) map.setLayoutProperty('3d-buildings', 'visibility', 'visible');
        if (map.getLayer('3d-landmarks')) map.setLayoutProperty('3d-landmarks', 'visibility', 'visible');
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
        // Always keep 3D buildings visible - user preference
        if (map.getLayer('3d-buildings')) {
          map.setLayoutProperty('3d-buildings', 'visibility', 'visible');
        }
        if (map.getLayer('3d-landmarks')) {
          map.setLayoutProperty('3d-landmarks', 'visibility', 'visible');
        }
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

  // Render amenities via GeoJSON source + symbol layers (Maki icons)
  useEffect(() => {
    const map = mapRef.current; if (!map) return;

    const srcId = 'amenities';
    const bubbleId = 'amenities-bubbles';
    const symbolId = 'amenities-symbols';

    const data: GeoJSON.FeatureCollection<GeoJSON.Point, any> = {
      type: 'FeatureCollection',
      features: (amenities ?? []).map((a) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: a.center },
        properties: {
          id: a.id,
          name: a.name,
          category: a.category,
          distance: a.distanceMeters ?? null,
          rating: a.rating ?? null,
          website: a.website ?? null,
          gUrl: a.googleUrl ?? null,
        },
      })),
    } as any;

    const ensureLayers = () => {
      // Source
      if (map.getSource(srcId)) {
        (map.getSource(srcId) as mapboxgl.GeoJSONSource).setData(data);
      } else {
        map.addSource(srcId, { type: 'geojson', data });
      }

      // Remove old layers to avoid duplicate id errors (after style changes)
      if (map.getLayer(bubbleId)) try { map.removeLayer(bubbleId); } catch {}
      if (map.getLayer(symbolId)) try { map.removeLayer(symbolId); } catch {}

      const layers = map.getStyle().layers || [];
      const firstSymbol = layers.find((l) => l.type === 'symbol')?.id;

      // Bubbles for subtle animated feel
      map.addLayer({
        id: bubbleId,
        type: 'circle',
        source: srcId,
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            10, 4,
            16, 8
          ],
          'circle-color': [
            'match', ['get', 'category'],
            'food_drink', 'hsl(var(--brand-gold))',
            'groceries', 'hsl(var(--brand-emerald))',
            'atm_bank', 'hsl(210,30%,55%)',
            'pharmacy_hospital', 'hsl(350,75%,60%)',
            'school_university', 'hsl(200,90%,55%)',
            'gym_sports', 'hsl(260,70%,60%)',
            'shopping_mall', 'hsl(280,70%,60%)',
            'public_transport', 'hsl(190,100%,55%)',
            'hsl(182,65%,45%)'
          ],
          'circle-opacity': 0.3
        }
      }, firstSymbol);

      // Symbols with Maki icons
      map.addLayer({
        id: symbolId,
        type: 'symbol',
        source: srcId,
        layout: {
          'icon-image': [
            'match', ['get', 'category'],
            'food_drink', 'restaurant-15',
            'groceries', 'grocery-15',
            'atm_bank', 'bank-15',
            'pharmacy_hospital', 'pharmacy-15',
            'school_university', 'college-15',
            'gym_sports', 'fitness-15',
            'shopping_mall', 'shop-15',
            'public_transport', 'bus-15',
            'marker-15'
          ],
          'icon-size': [
            'interpolate', ['linear'], ['zoom'],
            10, 0.8,
            16, 1.2
          ],
          'icon-allow-overlap': true,
          'text-field': ['step', ['zoom'], '', 15, ['get', 'name']],
          'text-size': 12,
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': 'hsl(210, 10%, 20%)',
          'text-halo-color': 'hsl(0, 0%, 100%)',
          'text-halo-width': 1,
        }
      }, firstSymbol);

      // Interactions: popup
      const onEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
      const onLeave = () => { map.getCanvas().style.cursor = ''; };
      const onClick = (e: any) => {
        const f = e.features?.[0]; if (!f) return;
        const c = f.geometry.coordinates as [number, number];
        const p = f.properties || {};
        const rating = p.rating ? `★ ${Number(p.rating).toFixed(1)}` : '';
        const dist = p.distance ? `${Math.round(Number(p.distance))} m` : '';
        const gLink = p.gUrl || `https://www.google.com/maps/search/?api=1&query=${c[1]},${c[0]}`;
        const website = p.website ? `<a class="text-primary story-link" href="${p.website}" target="_blank" rel="noreferrer">Website</a>` : '';
        new mapboxgl.Popup({ offset: 10, className: 'quick-popup' })
          .setLngLat(c)
          .setHTML(`
            <div class="p-2 text-sm">
              <div class="font-medium">${p.name || ''}</div>
              <div class="text-xs text-muted-foreground space-x-2">${rating} ${dist}</div>
              <div class="mt-1 text-xs flex gap-2">
                ${website}
                <a class="text-primary story-link" href="${gLink}" target="_blank" rel="noreferrer">Google Maps</a>
              </div>
            </div>
          `)
          .addTo(map);
      };

      try { map.off('mouseenter', symbolId, onEnter); } catch {}
      try { map.off('mouseleave', symbolId, onLeave); } catch {}
      try { map.off('click', symbolId, onClick); } catch {}
      map.on('mouseenter', symbolId, onEnter);
      map.on('mouseleave', symbolId, onLeave);
      map.on('click', symbolId, onClick);
    };

    if (!map.isStyleLoaded()) {
      map.once('style.load', ensureLayers);
    } else {
      ensureLayers();
    }

    return () => {
      if (!map || !map.getStyle()) return;
      try {
        if (map.getLayer(symbolId)) map.removeLayer(symbolId);
      } catch (e) {
        console.warn('Failed to remove symbol layer:', e);
      }
      try {
        if (map.getLayer(bubbleId)) map.removeLayer(bubbleId);
      } catch (e) {
        console.warn('Failed to remove bubble layer:', e);
      }
      try {
        if (map.getSource(srcId)) map.removeSource(srcId);
      } catch (e) {
        console.warn('Failed to remove source:', e);
      }
    };
  }, [JSON.stringify(amenities), mapStyle]);

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
  const lastFlyToTimestamp = useRef<number>(0);
  const flyToInProgress = useRef<boolean>(false);
  
  useEffect(() => {
    const map = mapRef.current; 
    if (!map || !flyTo || flyToInProgress.current) return;
    
    // Only fly if this is a new flyTo request
    const currentTimestamp = flyTo.timestamp || 0;
    if (currentTimestamp <= lastFlyToTimestamp.current) return;
    
    lastFlyToTimestamp.current = currentTimestamp;
    flyToInProgress.current = true;
    
    try {
      console.log('Flying to:', flyTo.center, 'with timestamp:', currentTimestamp);
      
      map.flyTo({ 
        center: flyTo.center, 
        zoom: flyTo.zoom ?? 13, 
        speed: 0.9, 
        curve: 1.2, 
        essential: false // Allow user to interrupt
      });
      
      // Reset progress flag after animation
      setTimeout(() => {
        flyToInProgress.current = false;
        console.log('FlyTo completed, user can now interact freely');
      }, 3000); // Give extra time for flyTo to complete
      
    } catch (e) { 
      console.error('flyTo failed', e); 
      flyToInProgress.current = false;
    }
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
