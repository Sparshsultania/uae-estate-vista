import React, { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { properties, toFeatureCollection, zones as zoneList, PropertyPoint } from "@/data/mockProperties";

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

const RealEstateMap: React.FC<RealEstateMapProps> = ({ token, selected, onSelect, showPriceHeat, showYieldHeat, searchArea, mapStyle, flyTo }) => {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const hoveredBuildingId = useRef<number | string | null>(null);
  const hoverRaf = useRef<number | null>(null);

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

      map.on('style.load', () => {
        // Atmosphere
        map!.setFog({
          color: 'rgb(255,255,255)',
          'high-color': 'rgb(210, 230, 255)',
          'horizon-blend': 0.2,
        });

        // 3D buildings
        const layers = map!.getStyle().layers || [];
        const labelLayerId = layers.find((l) => l.type === 'symbol' && (l.layout as any)?.['text-field'])?.id;

        map!.addLayer(
          {
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', 'extrude', 'true'],
            type: 'fill-extrusion',
            minzoom: 14,
            paint: {
              'fill-extrusion-color': [
                'case',
                ['boolean', ['feature-state', 'hover'], false], 'hsl(182, 65%, 55%)',
                'hsl(210, 10%, 80%)'
              ],
              'fill-extrusion-height': [
                'case',
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
    const map = mapRef.current; if (!map) return;
    if (map.getLayer('heatmap-price')) map.setLayoutProperty('heatmap-price', 'visibility', showPriceHeat ? 'visible' : 'none');
    if (map.getLayer('heatmap-yield')) map.setLayoutProperty('heatmap-yield', 'visibility', showYieldHeat ? 'visible' : 'none');
  }, [showPriceHeat, showYieldHeat]);

  // Update base style when mapStyle changes
  useEffect(() => {
    const map = mapRef.current; if (!map || !mapStyle) return;
    try { map.setStyle(mapStyle); } catch (e) { console.error('Failed to set style', e); }
  }, [mapStyle]);

  // Search area highlight source
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
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
};

export default RealEstateMap;
