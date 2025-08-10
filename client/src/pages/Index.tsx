import React, { useMemo, useState, useRef, useEffect } from "react";
import RealEstateMap, { type RealEstateMapHandle } from "@/components/map/RealEstateMap";
import SearchBar from "@/components/controls/SearchBar";
import ValuationForm from "@/components/controls/ValuationForm";
import StatsPanel from "@/components/panels/StatsPanel";
import { properties, PropertyPoint } from "@/data/mockProperties";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Map, Sparkles, Settings2, X, BarChart3, Building2, MapPin, Car, Bike, PersonStanding } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AmenityFilters, { type AmenityCategory, ALL_AMENITY_CATEGORIES } from "@/components/controls/AmenityFilters";
import { useSearchBoxAmenities } from "@/hooks/useSearchBoxAmenities";
import POIDetailsPanel, { type POIDetails } from "@/components/panels/POIDetailsPanel";
import PropertyDetailsPanel, { type PropertyData } from "@/components/panels/PropertyDetailsPanel";
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
  const [flyTo, setFlyTo] = useState<{ center: [number, number]; zoom?: number; timestamp?: number } | null>(null);
  const { toast } = useToast();

  // Directions and routing
  const [directionsEnabled, setDirectionsEnabled] = useState(false);
  
  // Isochrone settings
  const [isochroneSettings, setIsochroneSettings] = useState<{
    enabled: boolean;
    profile: 'driving' | 'walking' | 'cycling';
    minutes: number[];
  }>({
    enabled: false,
    profile: 'driving',
    minutes: [10, 15, 30] // Better time intervals for smoother visualization
  });

  // POI handling
  const [selectedPOI, setSelectedPOI] = useState<POIDetails | null>(null);
  const { fetchPOIDetails } = usePOIData();

  // Property details state
  const [selectedPropertyDetails, setSelectedPropertyDetails] = useState<PropertyData | null>(null);

  // Amenities and filters
  const [amenityCats, setAmenityCats] = useState<AmenityCategory[]>([]);
  const [amenityRadius, setAmenityRadius] = useState<number>(1500);
  const amenitiesSB = useSearchBoxAmenities({
    coordinates: selected ? selected.coords as [number, number] : null,
    categories: amenityCats,
    radius: amenityRadius,
    token: token,
  });

  const mapRef = useRef<RealEstateMapHandle>(null);

  const handleSelect = async (property: PropertyPoint) => {
    setSelected(property);
    const timestamp = Date.now();
    setFlyTo({ center: property.coords as [number, number], zoom: 16, timestamp });
    
    // Fetch building information using Mapbox Reverse Geocoding
    try {
      const tk = token || localStorage.getItem('MAPBOX_PUBLIC_TOKEN') || '';
      if (!tk) return;
      
      const [lng, lat] = property.coords as [number, number];
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${tk}&types=address,poi`;
      const res = await fetch(url);
      const data = await res.json();
      const feature = data.features?.[0];
      
      if (feature) {
        // Create property data from the geocoded result
        const propertyData: PropertyData = {
          id: `building-${timestamp}`,
          name: feature.text || feature.place_name || 'Selected Building',
          address: feature.place_name || 'Dubai, UAE',
          location: feature.place_name || 'Dubai, UAE',
          coordinates: [lng, lat],
          value: Math.floor(Math.random() * 2000000) + 800000, // 800k - 2.8M AED
          pricePerSqFt: Math.floor(Math.random() * 800) + 600, // 600-1400 AED/sqft
          yield: Math.round((Math.random() * 4 + 5) * 10) / 10, // 5-9% yield
          score: Math.floor(Math.random() * 30) + 70, // 70-100 score
          propertyType: Math.random() > 0.5 ? 'Apartment' : 'Villa',
          bedrooms: Math.floor(Math.random() * 4) + 1, // 1-4 bedrooms
          size: Math.floor(Math.random() * 2000) + 800, // 800-2800 sqft
          marketTrend: Math.random() > 0.3 ? 'Increasing' : 'Stable',
          imageUrl: `https://picsum.photos/400/200?random=${timestamp}`
        };
        setSelectedPropertyDetails(propertyData);
      }
    } catch (error) {
      console.error('Error fetching building details:', error);
      // Fallback to basic property data
      const propertyData: PropertyData = {
        id: `building-${timestamp}`,
        name: 'Selected Building',
        address: 'Dubai, UAE',
        location: 'Dubai, UAE',
        coordinates: property.coords as [number, number],
        value: Math.floor(Math.random() * 2000000) + 800000,
        pricePerSqFt: Math.floor(Math.random() * 800) + 600,
        yield: Math.round((Math.random() * 4 + 5) * 10) / 10,
        score: Math.floor(Math.random() * 30) + 70,
        propertyType: Math.random() > 0.5 ? 'Apartment' : 'Villa',
        bedrooms: Math.floor(Math.random() * 4) + 1,
        size: Math.floor(Math.random() * 2000) + 800,
        marketTrend: Math.random() > 0.3 ? 'Increasing' : 'Stable',
        imageUrl: `https://picsum.photos/400/200?random=${timestamp}`
      };
      setSelectedPropertyDetails(propertyData);
    }
  };

  const handlePlaceSelect = (pl: { name: string; center: [number, number]; timestamp?: number }) => {
    setSelected(null);
    const timestamp = pl.timestamp || Date.now();
    setFlyTo({ center: pl.center, zoom: 15, timestamp });
    
    // Create mock property data for searched locations
    const propertyData: PropertyData = {
      id: `search-${timestamp}`,
      name: pl.name,
      address: pl.name,
      location: pl.name,
      coordinates: pl.center,
      value: Math.floor(Math.random() * 2000000) + 800000, // 800k - 2.8M AED
      pricePerSqFt: Math.floor(Math.random() * 800) + 600, // 600-1400 AED/sqft
      yield: Math.round((Math.random() * 4 + 5) * 10) / 10, // 5-9% yield
      score: Math.floor(Math.random() * 30) + 70, // 70-100 score
      propertyType: Math.random() > 0.5 ? 'Apartment' : 'Villa',
      bedrooms: Math.floor(Math.random() * 4) + 1, // 1-4 bedrooms
      size: Math.floor(Math.random() * 2000) + 800, // 800-2800 sqft
      marketTrend: Math.random() > 0.3 ? 'Increasing' : 'Stable',
      imageUrl: `https://picsum.photos/400/200?random=${timestamp}`
    };
    setSelectedPropertyDetails(propertyData);
    setSelected(null);
    setSearchArea(circlePolygon(pl.center, 1500));
    // Use the provided timestamp, or generate one if not provided
    setFlyTo({ center: pl.center, zoom: 13, timestamp: pl.timestamp || Date.now() });
  };

  const handleRouteTo = (dest: [number, number], profile: 'driving'|'walking'|'cycling' = 'driving') => {
    if (!directionsEnabled) {
      setDirectionsEnabled(true);
      // Disable isochrones when enabling directions to avoid conflicts
      if (isochroneSettings.enabled) {
        setIsochroneSettings(prev => ({ ...prev, enabled: false }));
      }
      setTimeout(() => mapRef.current?.routeTo(dest, profile), 600);
    } else {
      mapRef.current?.routeTo(dest, profile);
    }
  };

  // Enhanced toggle handlers to prevent conflicts
  const handleDirectionsToggle = (enabled: boolean) => {
    setDirectionsEnabled(enabled);
    if (enabled && isochroneSettings.enabled) {
      // Disable isochrones when enabling directions
      setIsochroneSettings(prev => ({ ...prev, enabled: false }));
    }
  };

  const handleIsochroneToggle = (enabled: boolean) => {
    setIsochroneSettings(prev => ({ ...prev, enabled }));
    if (enabled && directionsEnabled) {
      // Disable directions when enabling isochrones
      setDirectionsEnabled(false);
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
              <label htmlFor="toggle-price" className="text-sm cursor-pointer">Price heat</label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="toggle-yield" checked={showYieldHeat} onCheckedChange={setShowYieldHeat} />
              <label htmlFor="toggle-yield" className="text-sm cursor-pointer">Yield heat</label>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                id="toggle-directions" 
                checked={directionsEnabled} 
                onCheckedChange={handleDirectionsToggle} 
              />
              <label htmlFor="toggle-directions" className="text-sm cursor-pointer">Directions</label>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch 
                  id="toggle-isochrone" 
                  checked={isochroneSettings.enabled} 
                  onCheckedChange={handleIsochroneToggle} 
                />
                <label htmlFor="toggle-isochrone" className="text-sm cursor-pointer">Travel time zones</label>
              </div>
              
              {isochroneSettings.enabled && (
                <div className="flex items-center gap-3 ml-2">
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant={isochroneSettings.profile === 'driving' ? 'default' : 'outline'}
                      onClick={() => setIsochroneSettings(prev => ({ ...prev, profile: 'driving' }))}
                      className="h-7 px-2"
                    >
                      <Car className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant={isochroneSettings.profile === 'walking' ? 'default' : 'outline'}
                      onClick={() => setIsochroneSettings(prev => ({ ...prev, profile: 'walking' }))}
                      className="h-7 px-2"
                    >
                      <PersonStanding className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant={isochroneSettings.profile === 'cycling' ? 'default' : 'outline'}
                      onClick={() => setIsochroneSettings(prev => ({ ...prev, profile: 'cycling' }))}
                      className="h-7 px-2"
                    >
                      <Bike className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Discovering amenities...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="container py-6 space-y-6">
        {/* Valuation Form - Full width above map */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold">Property Valuation</CardTitle>
          </CardHeader>
          <CardContent>
            <ValuationForm token={token} onPlaceSelect={handlePlaceSelect} />
          </CardContent>
        </Card>

        {/* Map and Sidebar Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[85vh]">
          <article className="lg:col-span-8 xl:col-span-9">
            <div className="relative rounded-lg border bg-muted/50 overflow-hidden h-[70vh] lg:h-[85vh]">
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
              directionsEnabled={directionsEnabled}
              isochrone={isochroneSettings}
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
          
          <aside className="lg:col-span-4 xl:col-span-3 space-y-4">
          {selectedPropertyDetails ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-bold mb-1">{selectedPropertyDetails.name}</CardTitle>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span>{selectedPropertyDetails.location}</span>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSelectedPropertyDetails(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedPropertyDetails.imageUrl && (
                    <div className="h-32 overflow-hidden rounded-lg">
                      <img 
                        src={selectedPropertyDetails.imageUrl} 
                        alt={selectedPropertyDetails.name} 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs font-medium text-gray-600">Market Value</div>
                      <div className="text-sm font-bold">AED {selectedPropertyDetails.value.toLocaleString()}</div>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="text-xs font-medium text-gray-600">Yield</div>
                      <div className="text-sm font-bold text-green-600">{selectedPropertyDetails.yield}%</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-gray-600">Per Sq.Ft</div>
                      <div className="font-semibold">AED {selectedPropertyDetails.pricePerSqFt}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Score</div>
                      <div className="font-semibold text-orange-600">{selectedPropertyDetails.score}/100</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Investment Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative w-20 h-20 mx-auto">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                      <circle
                        cx="50" cy="50" r="40" fill="none" stroke="#10b981" strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${(selectedPropertyDetails.score / 100) * 251} 251`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-base font-bold">{selectedPropertyDetails.score}</div>
                        <div className="text-xs text-gray-600">/ 100</div>
                      </div>
                    </div>
                  </div>
                  <div className="text-center mt-2">
                    <Badge variant="secondary" className={selectedPropertyDetails.score >= 80 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                      {selectedPropertyDetails.score >= 80 ? 'Excellent' : 'Good'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type</span>
                    <span className="font-medium">{selectedPropertyDetails.propertyType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Trend</span>
                    <span className="font-medium">{selectedPropertyDetails.marketTrend}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              <AmenityFilters inline selected={amenityCats} onChange={setAmenityCats} radius={amenityRadius} onRadius={setAmenityRadius} />
              {amenitiesSB.searchBoxSupported === false && (
                <div className="rounded-md border p-3 text-xs bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
                  Live amenities are using a fallback (Geocoding API). For richer, faster results, enable "Search Box API" scope on your Mapbox public token and add your site origin in the Mapbox dashboard.
                </div>
              )}
              <StatsPanel selected={selected} onRouteTo={handleRouteTo} amenitiesOverride={amenitiesSB.results} amenitiesLoadingOverride={amenitiesSB.loading} />
            </>
          )}
          </aside>
        </div>
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