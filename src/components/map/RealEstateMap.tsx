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

const RealEstateMap: React.FC<RealEstateMapProps> = ({ token, selected, onSelect, showPriceHeat, showYieldHeat, searchArea }) => {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const hoveredBuildingId = useRef<number | string | null>(null);

  const propertiesFC = useMemo(() => toFeatureCollection(properties), []);
  const zonesFC = useMemo(() => buildZonesFeatureCollection(), []);

  useEffect(() => {
    const accessToken = token || localStorage.getItem("MAPBOX_PUBLIC_TOKEN") || "";
    if (!container.current || !accessToken) return;

    mapboxgl.accessToken = accessToken;

    const map = new mapboxgl.Map({
      container: container.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: UAE_CENTER,
      zoom: 6,
      pitch: 55,
      bearing: -20,
      projection: 'globe',
      antialias: true,
    });

    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.scrollZoom.disable();

    map.on('style.load', () => {
      // Atmosphere
      map.setFog({
        color: 'rgb(255,255,255)',
        'high-color': 'rgb(210, 230, 255)',
        'horizon-blend': 0.2,
      });

      // 3D buildings
      const layers = map.getStyle().layers || [];
      const labelLayerId = layers.find((l) => l.type === 'symbol' && (l.layout as any)?.['text-field'])?.id;

      map.addLayer(
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
      map.addSource('properties', { type: 'geojson', data: propertiesFC });

      map.addLayer({
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
            'hsl(182,65%,45%)', // <= 1400 teal
            1400, 'hsl(152,53%,41%)', // <= 2400 emerald
            2400, 'hsl(43,95%,55%)' // > 2400 gold
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'white',
          'circle-opacity': 0.9,
        }
      });

      // Heatmaps
      map.addLayer({
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

      map.addLayer({
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
      map.addSource('zones', { type: 'geojson', data: zonesFC });
      map.addLayer({
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

      map.addLayer({
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
      map.on('mousemove', '3d-buildings', (e) => {
        if (!e.features?.length) return;
        const f = e.features[0];
        const id = f.id as number | string | undefined;
        if (id == null) return;
        if (hoveredBuildingId.current !== null && hoveredBuildingId.current !== id) {
          map.setFeatureState({ source: 'composite', sourceLayer: 'building', id: hoveredBuildingId.current }, { hover: false });
        }
        hoveredBuildingId.current = id;
        map.setFeatureState({ source: 'composite', sourceLayer: 'building', id }, { hover: true });
      });
      map.on('mouseleave', '3d-buildings', () => {
        if (hoveredBuildingId.current !== null) {
          map.setFeatureState({ source: 'composite', sourceLayer: 'building', id: hoveredBuildingId.current }, { hover: false });
        }
        hoveredBuildingId.current = null;
      });

      map.on('mouseenter', 'property-points', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'property-points', () => { map.getCanvas().style.cursor = ''; });

      map.on('click', 'property-points', (e) => {
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
          new mapboxgl.Popup({ closeButton: false })
            .setLngLat(coords)
            .setHTML(`<div style="font-weight:600">${name}</div><div>Price/sqft: AED ${price}</div><div>Yield: ${yieldPct}%</div>`)
            .addTo(map);
        }
      });

      // Initial overlays visibility
      map.setLayoutProperty('heatmap-price', 'visibility', showPriceHeat ? 'visible' : 'none');
      map.setLayoutProperty('heatmap-yield', 'visibility', showYieldHeat ? 'visible' : 'none');
    });

    return () => {
      map.remove();
    };
  }, [propertiesFC, zonesFC, token]);

  // Update overlays visibility
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (map.getLayer('heatmap-price')) map.setLayoutProperty('heatmap-price', 'visibility', showPriceHeat ? 'visible' : 'none');
    if (map.getLayer('heatmap-yield')) map.setLayoutProperty('heatmap-yield', 'visibility', showYieldHeat ? 'visible' : 'none');
  }, [showPriceHeat, showYieldHeat]);

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

  // Fly to selected
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (selected) {
      map.easeTo({ center: selected.coords, zoom: 14, duration: 1200 });
    }
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
