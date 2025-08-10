import React, { useEffect, useRef, useImperativeHandle } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export type RealEstateMapHandle = { 
  startDrawPolygon: () => void; 
  clearDraw: () => void; 
  routeTo: (dest: [number, number], profile?: 'driving'|'walking'|'cycling') => void; 
};

export type RealEstateMapProps = {
  token?: string;
  onPOISelect?: (coordinates: [number, number]) => void;
  flyTo?: { center: [number, number]; zoom?: number };
  mapStyle?: string;
};

const UAE_CENTER: [number, number] = [55.2744, 25.1972];

const SafeMap = React.forwardRef<RealEstateMapHandle, RealEstateMapProps>(({ 
  token, 
  onPOISelect,
  flyTo,
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

      // Minimal error handling without complex layer operations
      map.on('error', (e) => {
        console.warn('[SafeMap] handled error:', e);
      });

      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');

      map.on('load', () => {
        try {
          // Simple 3D buildings without complex feature state management
          if (map && map.isStyleLoaded()) {
            const layers = map.getStyle().layers || [];
            const labelLayerId = layers.find((l) => l.type === 'symbol')?.id;
            
            // Only add if doesn't exist
            try {
              if (!map.getLayer('3d-buildings')) {
                map.addLayer({
                  id: '3d-buildings',
                  source: 'composite',
                  'source-layer': 'building',
                  filter: ['==', ['geometry-type'], 'Polygon'],
                  type: 'fill-extrusion',
                  minzoom: 12,
                  paint: {
                    'fill-extrusion-color': 'hsl(210, 10%, 80%)',
                    'fill-extrusion-height': [
                      'interpolate', ['linear'], ['zoom'],
                      12, 0,
                      16, ['coalesce', ['get', 'height'], 20]
                    ],
                    'fill-extrusion-opacity': 0.85
                  }
                }, labelLayerId);
              }
            } catch (layerError) {
              console.warn('Building layer add failed:', layerError);
            }
          }

          // Simple click handler without complex feature state
          map.on('click', (e) => {
            try {
              // Clear existing markers and popups
              document.querySelectorAll('.mapboxgl-popup').forEach(popup => popup.remove());
              document.querySelectorAll('.poi-marker').forEach(marker => marker.remove());

              // Add simple marker
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
              console.warn('Click handler error:', error);
            }
          });

        } catch (error) {
          console.warn('Map load setup error:', error);
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

  // Handle flyTo requests
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    
    try {
      // Wait for map to be ready
      if (!map.isStyleLoaded()) {
        map.once('styledata', () => {
          try {
            map.flyTo({ 
              center: flyTo.center, 
              zoom: flyTo.zoom ?? 13, 
              speed: 1.5,
              curve: 1.0,
              essential: false
            });
          } catch (e) {
            console.warn('Delayed flyTo failed:', e);
          }
        });
        return;
      }

      // Immediately ensure controls are active
      setTimeout(() => {
        try {
          map.scrollZoom.enable();
          map.dragPan.enable();
          map.dragRotate.enable();
          map.keyboard.enable();
          map.doubleClickZoom.enable();
          map.touchZoomRotate.enable();
        } catch (e) {
          console.warn('Control enable failed:', e);
        }
      }, 0);
      
      map.flyTo({ 
        center: flyTo.center, 
        zoom: flyTo.zoom ?? 13, 
        speed: 1.5,
        curve: 1.0,
        essential: false // Allow user to interrupt
      });
      
      // Re-enable after animation
      const timeout = setTimeout(() => {
        try {
          map.scrollZoom.enable();
          map.dragPan.enable();
          map.dragRotate.enable();
          map.keyboard.enable();
          map.doubleClickZoom.enable();
          map.touchZoomRotate.enable();
        } catch (e) {
          console.warn('Post-flyTo control enable failed:', e);
        }
      }, 2000); // Wait for fly animation to complete
      
      return () => clearTimeout(timeout);
      
    } catch (error) { 
      console.warn('FlyTo failed:', error); 
    }
  }, [flyTo]);

  return (
    <div 
      ref={container} 
      className="w-full h-full relative"
      style={{ minHeight: '400px' }}
    />
  );
});

SafeMap.displayName = 'SafeMap';

export default SafeMap;