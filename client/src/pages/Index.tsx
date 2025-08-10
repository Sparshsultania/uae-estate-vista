import React, { useMemo, useState, useRef, useEffect } from "react";
import RealEstateMap, { type RealEstateMapHandle } from "@/components/map/RealEstateMap";
import SearchBar from "@/components/controls/SearchBar";
import ValuationForm from "@/components/controls/ValuationForm";
import StatsPanel from "@/components/panels/StatsPanel";
import { properties, PropertyPoint } from "@/data/mockProperties";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Map, Sparkles, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AmenityFilters, { type AmenityCategory, ALL_AMENITY_CATEGORIES } from "@/components/controls/AmenityFilters";
import { useSearchBoxAmenities } from "@/hooks/useSearchBoxAmenities";
import POIDetailsPanel, { type POIDetails } from "@/components/panels/POIDetailsPanel";
import usePOIData from "@/hooks/usePOIData";

function circlePolygon(center: [number, number], radiusMeters: number, points = 64): GeoJSON.Feature<GeoJSON.Polygon> {
  const [lng, lat] = center;
  const coords: [number, number][] = [];
  const R = 6378137; // Earth radius in meters
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = (radiusMeters * Math.cos(angle)) / (R * Math.cos((lat * Math.PI) / 180));
    const dy = radiusMeters * Math.sin(angle) / R;
    const newLng = lng + (dx * 180) / Math.PI;
    const newLat = lat + (dy * 180) / Math.PI;
    coords.push([newLng, newLat]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
}

const Index: React.FC = () => {
  const [selected, setSelected] = useState<PropertyPoint | null>(null);
  const [showPriceHeat, setShowPriceHeat] = useState(true);
  const [showYieldHeat, setShowYieldHeat] = useState(false);
  const [searchArea, setSearchArea] = useState<GeoJSON.Feature<GeoJSON.Polygon> | null>(null);
  const [token, setToken] = useState<string>(() => localStorage.getItem('MAPBOX_PUBLIC_TOKEN') || "");
  const [showTokenPanel, setShowTokenPanel] = useState<boolean>(() => !localStorage.getItem('MAPBOX_PUBLIC_TOKEN'));
  const [dataSource, setDataSource] = useState<'all' | 'title-deed' | 'oqoo' | 'dewa'>('all');
  const [mapStyle, setMapStyle] = useState<string>('mapbox://styles/mapbox/streets-v12');
  const [flyTo, setFlyTo] = useState<{ center: [number, number]; zoom?: number } | null>(null);
  const { toast } = useToast();

  const mapRef = useRef<RealEstateMapHandle | null>(null);
  const [isoEnabled, setIsoEnabled] = useState(false);
  const [isoProfile, setIsoProfile] = useState<'driving'|'walking'|'cycling'>('driving');
  const [isoPreset, setIsoPreset] = useState<'10-20-30'|'5-10-15'|'15-30-45'>('10-20-30');
  const isoMinutes = useMemo(() => {
    switch (isoPreset) {
      case '5-10-15': return [5,10,15];
      case '15-30-45': return [15,30,45];
      default: return [10,20,30];
    }
  }, [isoPreset]);
  const [directionsEnabled, setDirectionsEnabled] = useState(false);
  // Amenity search state
  const [amenityCats, setAmenityCats] = useState<AmenityCategory[]>(ALL_AMENITY_CATEGORIES);
  const [amenityRadius, setAmenityRadius] = useState<number>(1000);
  const selectedCenter = selected?.coords as [number, number] | undefined;
  const amenitiesSB = useSearchBoxAmenities({ token, center: selectedCenter ?? null, route: null, categories: amenityCats, radiusMeters: amenityRadius, limitPerCategory: 12 });

  // POI state
  const [selectedPOI, setSelectedPOI] = useState<POIDetails | null>(null);
  const { fetchPOIDetails, isLoading: poiLoading } = usePOIData(token || localStorage.getItem('MAPBOX_PUBLIC_TOKEN') || '');

  const handleSelect = (p: PropertyPoint) => {
    setSelected(p);
    setSearchArea(circlePolygon(p.coords, 1200));
    setFlyTo({ center: p.coords, zoom: 16 });
  };


  const handlePlaceSelect = (pl: { center: [number, number]; bbox?: [number, number, number, number]; name: string }) => {
    setSelected(null);
    setSearchArea(circlePolygon(pl.center, 1500));
    setFlyTo({ center: pl.center, zoom: 13 });
  };

  const handleRouteTo = (dest: [number, number], profile: 'driving'|'walking'|'cycling' = 'driving') => {
    if (!directionsEnabled) {
      setDirectionsEnabled(true);
      setTimeout(() => mapRef.current?.routeTo(dest, profile), 600);
    } else {
      mapRef.current?.routeTo(dest, profile);
    }
  };

  const handlePOISelect = async (coordinates: [number, number]) => {
    try {
      const poiDetails = await fetchPOIDetails(coordinates);
      if (poiDetails) {
        setSelectedPOI(poiDetails);
      }
    } catch (error) {
      console.error('Error fetching POI details:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch location details. Please try again.',
        variant: 'destructive'
      } as any);
    }
  };

  const handlePOIClose = () => {
    setSelectedPOI(null);
  };

  const handleGetDirections = (coordinates: [number, number]) => {
    handleRouteTo(coordinates);
    setSelectedPOI(null); // Close POI panel when getting directions
  };

  const saveToken = () => {
    const t = token.trim();
    if (!t || (!t.startsWith('pk.') && !t.startsWith('pk_'))) {
      toast({
        title: 'Invalid token',
        description: 'Please paste a Mapbox public token (starts with pk.)',
        variant: 'destructive'
      } as any);
      return;
    }
    localStorage.setItem('MAPBOX_PUBLIC_TOKEN', t);
    setShowTokenPanel(false);
  };

  const hasToken = useMemo(() => !!(token || localStorage.getItem('MAPBOX_PUBLIC_TOKEN')), [token]);

  // TEMP: preload provided Mapbox public token into localStorage for testing
  useEffect(() => {
    const existing = localStorage.getItem('MAPBOX_PUBLIC_TOKEN');
    const testToken = 'pk.eyJ1IjoidGFoYWFsd2FyZCIsImEiOiJjbWUzdmdwZWwwOXNtMmpzOGl1eXo0dnBvIn0.IcI376nuRKs0ufijqg1LEQ';
    if (!existing) {
      localStorage.setItem('MAPBOX_PUBLIC_TOKEN', testToken);
      setToken(testToken);
      setShowTokenPanel(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'Property Valuation Analyser';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'Property Valuation Analyser: input details and instantly center the map to your building or community.');
  }, []);

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-20 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container py-4 flex flex-col gap-3">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Property Valuation Analyser</h1>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-foreground">
              <div className="h-8 w-8 rounded-md" style={{ background: 'linear-gradient(135deg, hsl(182,65%,45%), hsl(152,53%,41%))' }} />
              <div>
                <div className="font-semibold leading-tight">UAE Property Intel</div>
                <div className="text-xs text-muted-foreground">3D AI map for prices, yields & opportunities</div>
              </div>
            </div>
            <div className="hidden md:block">
              <SearchBar items={properties} onSelect={handleSelect} token={token} onPlaceSelect={handlePlaceSelect} />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowTokenPanel((s) => !s)}>
                <Settings2 className="h-4 w-4 mr-2" /> Token
              </Button>
            </div>
          </div>
          <div className="md:hidden">
            <SearchBar items={properties} onSelect={handleSelect} token={token} onPlaceSelect={handlePlaceSelect} />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch id="toggle-price" checked={showPriceHeat} onCheckedChange={setShowPriceHeat} />
              <label htmlFor="toggle-price" className="text-sm">Price heatmap</label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="toggle-yield" checked={showYieldHeat} onCheckedChange={setShowYieldHeat} />
              <label htmlFor="toggle-yield" className="text-sm">Yield heatmap</label>
            </div>
            <div className="hidden md:flex items-center gap-2 ml-4">
              <label className="text-sm font-medium">Data Source:</label>
              <select 
                value={dataSource} 
                onChange={(e) => setDataSource(e.target.value as any)}
                className="px-3 py-1 text-sm border rounded-md bg-background"
              >
                <option value="all">All Sources</option>
                <option value="title-deed">Title Deed</option>
                <option value="oqoo">OQOO</option>
                <option value="dewa">DEWA</option>
              </select>
            </div>
            <div className="hidden md:flex items-center gap-2 ml-4">
              <label className="text-sm font-medium">Map style:</label>
              <select
                value={mapStyle}
                onChange={(e) => setMapStyle(e.target.value)}
                className="px-3 py-1 text-sm border rounded-md bg-background"
              >
                <option value="mapbox://styles/mapbox/streets-v12">Streets</option>
                <option value="mapbox://styles/mapbox/outdoors-v12">Outdoors</option>
                <option value="mapbox://styles/mapbox/light-v11">Light</option>
                <option value="mapbox://styles/mapbox/dark-v11">Dark</option>
                <option value="mapbox://styles/mapbox/satellite-streets-v12">Satellite</option>
              </select>
            </div>
              <div className="flex items-center gap-2 ml-auto">
                <Button size="sm" onClick={() => mapRef.current?.startDrawPolygon()}>Draw area</Button>
                <Button size="sm" variant="secondary" onClick={() => mapRef.current?.clearDraw()}>Clear</Button>
                <Separator orientation="vertical" className="h-6 hidden md:block" />
                <div className="hidden md:flex items-center gap-2">
                  <Switch id="toggle-iso" checked={isoEnabled} onCheckedChange={setIsoEnabled} />
                  <label htmlFor="toggle-iso" className="text-sm">Isochrones</label>
                  <select
                    value={isoProfile}
                    onChange={(e) => setIsoProfile(e.target.value as any)}
                    className="px-2 py-1 text-xs border rounded-md bg-background"
                    disabled={!isoEnabled}
                  >
                    <option value="driving">Driving</option>
                    <option value="walking">Walking</option>
                    <option value="cycling">Cycling</option>
                  </select>
                  <select
                    value={isoPreset}
                    onChange={(e) => setIsoPreset(e.target.value as any)}
                    className="px-2 py-1 text-xs border rounded-md bg-background"
                    disabled={!isoEnabled}
                  >
                    <option value="5-10-15">5 / 10 / 15 min</option>
                    <option value="10-20-30">10 / 20 / 30 min</option>
                    <option value="15-30-45">15 / 30 / 45 min</option>
                  </select>
                </div>
                <Separator orientation="vertical" className="h-6 hidden md:block" />
                 <div className="hidden md:flex items-center gap-2">
                  <Switch id="toggle-dir" checked={directionsEnabled} onCheckedChange={setDirectionsEnabled} />
                  <label htmlFor="toggle-dir" className="text-sm">Directions</label>
                </div>
              </div>
          </div>
          <div className="pt-2">
            <ValuationForm
              token={token}
              onPlaceSelect={handlePlaceSelect}
              onCalculate={(vals) => {
                toast({
                  title: 'Calculating…',
                  description: `${vals.beds || 'Bedrooms'} • ${vals.size || '—'} ${vals.sizeUnit} • ${vals.unitNumber?.trim() ? vals.unitNumber : 'Unit'} in ${vals.building || 'selected area'}`,
                });
              }}
            />
          </div>
        </div>
      </header>

      <section className="container py-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        <article className="lg:col-span-8 xl:col-span-9 rounded-xl overflow-hidden border">
          <div className="relative h-[70vh] lg:h-[calc(100vh-180px)]">
            <RealEstateMap
              ref={mapRef}
              token={token}
              selected={selected}
              onSelect={handleSelect}
              showPriceHeat={showPriceHeat}
              showYieldHeat={showYieldHeat}
              searchArea={searchArea}
              onAreaChange={setSearchArea}
              mapStyle={mapStyle}
              flyTo={flyTo || undefined}
              isochrone={{ enabled: isoEnabled, profile: isoProfile, minutes: isoMinutes }}
              directionsEnabled={directionsEnabled}
              amenities={amenitiesSB.results}
              onPOISelect={handlePOISelect}
            />
            
            {/* POI Details Panel Overlay */}
            <POIDetailsPanel 
              poi={selectedPOI}
              onClose={handlePOIClose}
              onGetDirections={handleGetDirections}
            />
            {!hasToken && showTokenPanel && (
              <div className="absolute left-4 top-4 z-20 max-w-md">
                <Card className="p-4 glass-panel animate-enter">
                  <div className="font-medium mb-2 flex items-center gap-2"><Map className="h-4 w-4" /> Mapbox Public Token</div>
                  <p className="text-xs text-muted-foreground mb-3">Enter your Mapbox public token to enable the 3D map. You can find it in your Mapbox dashboard (Tokens).</p>
                  <input
                    className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                    placeholder="pk.ey..."
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <Button size="sm" onClick={saveToken}>Save</Button>
                    <Button size="sm" variant="secondary" onClick={() => setShowTokenPanel(false)}>Later</Button>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </article>
        <aside className="lg:col-span-4 xl:col-span-3 space-y-3">
          <AmenityFilters inline selected={amenityCats} onChange={setAmenityCats} radius={amenityRadius} onRadius={setAmenityRadius} />
          {amenitiesSB.searchBoxSupported === false && (
            <div className="rounded-md border p-3 text-xs bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
              Live amenities are using a fallback (Geocoding API). For richer, faster results, enable “Search Box API” scope on your Mapbox public token and add your site origin in the Mapbox dashboard.
            </div>
          )}
          <StatsPanel selected={selected} onRouteTo={handleRouteTo} amenitiesOverride={amenitiesSB.results} amenitiesLoadingOverride={amenitiesSB.loading} />
        </aside>
      </section>

      <footer className="border-t">
        <div className="container py-6 text-xs text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" />
          Smart insights highlighting undervalued zones with emerald glow. Smooth zoom & hover-rise interactions.
        </div>
      </footer>
    </main>
  );
};

export default Index;
