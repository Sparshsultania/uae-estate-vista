import React, { useEffect, useRef, useImperativeHandle } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { PropertyPoint } from "@/data/mockProperties";

export type RealEstateMapHandle = { 
  startDrawPolygon: () => void; 
  clearDraw: () => void; 
  routeTo: (dest: [number, number], profile?: 'driving'|'walking'|'cycling') => void; 
};

export type RealEstateMapProps = {
  token?: string;
  selected?: PropertyPoint | null;
  onSelect?: (p: PropertyPoint) => void;
  showPriceHeat?: boolean;
  showYieldHeat?: boolean;
  searchArea?: GeoJSON.Feature<GeoJSON.Polygon> | null;
  onAreaChange?: (area: GeoJSON.Feature<GeoJSON.Polygon> | null) => void;
  mapStyle?: string;
  flyTo?: { center: [number, number]; zoom?: number };
  isochrone?: any;
  directionsEnabled?: boolean;
  amenities?: any[];
  onPOISelect?: (coordinates: [number, number]) => void;
};

const UAE_CENTER: [number, number] = [55.2744, 25.1972];

const SafeRealEstateMap = React.forwardRef<RealEstateMapHandle, RealEstateMapProps>(({ 
  token, 
  onPOISelect,
  mapStyle = "mapbox://styles/mapbox/streets-v12"
}, ref) => {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const selectedBuildingIds = useRef<Set<number | string>>(new Set());

  useImperativeHandle(ref, () => ({
    startDrawPolygon: () => {},
    clearDraw: () => {},
    routeTo: () => {},
  }), []);

  useEffect(() => {
    const accessToken = token || localStorage.getItem("MAPBOX_PUBLIC_TOKEN") || "";
    if (!container.current || !accessToken) return;

    let map: mapboxgl.Map | null = null;
    try {
      mapboxgl.accessToken = accessToken;

      map = new mapboxgl.Map({
        container: container.current,
        style: mapStyle,
        center: UAE_CENTER,
        zoom: 15,
        pitch: 60,
        bearing: -20,
        antialias: false,
      });

      mapRef.current = map;

      // Error handling
      map.on('error', (e) => {
        console.warn('[MapboxGL] error handled:', e);
      });

      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');

      map.on('load', () => {
        try {
          // Add 3D buildings with simple error handling
          if (map && map.isStyleLoaded() && !map.getLayer('3d-buildings')) {
            const layers = map.getStyle().layers || [];
            const labelLayerId = layers.find((l) => l.type === 'symbol')?.id;
            
            map.addLayer({
              id: '3d-buildings',
              source: 'composite',
              'source-layer': 'building',
              filter: ['==', ['geometry-type'], 'Polygon'],
              type: 'fill-extrusion',
              minzoom: 12,
              paint: {
                'fill-extrusion-color': [
                  'case',
                  ['boolean', ['feature-state', 'selected'], false], 'hsl(43,95%,55%)',
                  ['boolean', ['feature-state', 'hover'], false], 'hsl(182, 65%, 55%)',
                  'hsl(210, 10%, 80%)'
                ],
                'fill-extrusion-height': [
                  'interpolate', ['linear'], ['zoom'],
                  12, 0,
                  16, ['coalesce', ['get', 'height'], 20]
                ],
                'fill-extrusion-opacity': 0.85
              }
            }, labelLayerId);
          }

          // Cursor changes
          map.on('mouseenter', '3d-buildings', () => {
            if (map) map.getCanvas().style.cursor = 'pointer';
          });
          
          map.on('mouseleave', '3d-buildings', () => {
            if (map) map.getCanvas().style.cursor = '';
          });

          // Building click handler
          map.on('click', '3d-buildings', (e) => {
            if (!map || !map.isStyleLoaded()) return;
            
            try {
              // Clear previous selections
              selectedBuildingIds.current.forEach((pid) => {
                try {
                  map.setFeatureState({ source: 'composite', sourceLayer: 'building', id: pid }, { selected: false });
                } catch {}
              });
              selectedBuildingIds.current.clear();

              // Get clicked building (first one only)
              const feats = map.queryRenderedFeatures(e.point, { layers: ['3d-buildings'] });
              if (feats.length > 0) {
                const primaryBuilding = feats[0];
                const fid = primaryBuilding.id as number | string | undefined;
                
                if (fid != null) {
                  selectedBuildingIds.current.add(fid);
                  try {
                    map.setFeatureState({ source: 'composite', sourceLayer: 'building', id: fid }, { selected: true });
                  } catch {}
                }
              }

              // Clear existing popups and markers
              document.querySelectorAll('.mapboxgl-popup').forEach(popup => popup.remove());
              document.querySelectorAll('.poi-marker').forEach(marker => marker.remove());

              // Add marker
              const clickCoords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
              
              const markerEl = document.createElement('div');
              markerEl.className = 'poi-marker';
              markerEl.style.cssText = `
                width: 40px;
                height: 40px;
                background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 18px;
                cursor: pointer;
                animation: markerPulse 2s infinite;
              `;
              markerEl.innerHTML = '📍';

              new mapboxgl.Marker(markerEl)
                .setLngLat(clickCoords)
                .addTo(map);

              // Trigger POI selection
              onPOISelect?.(clickCoords);
              
            } catch (error) {
              console.warn('Building click handler error:', error);
            }
          });

        } catch (error) {
          console.warn('Map load error:', error);
        }
      });

    } catch (error) {
      console.error('Map initialization error:', error);
    }

    return () => {
      try {
        map?.remove?.();
      } catch (error) {
        console.warn('Map cleanup error:', error);
      }
    };
  }, [token, mapStyle, onPOISelect]);

  return (
    <div 
      ref={container} 
      className="w-full h-full relative"
      style={{ minHeight: '400px' }}
    />
  );
});

SafeRealEstateMap.displayName = 'SafeRealEstateMap';

export default SafeRealEstateMap;