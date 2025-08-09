import React, { useMemo, useState } from "react";
import RealEstateMap from "@/components/map/RealEstateMap";
import SearchBar from "@/components/controls/SearchBar";
import StatsPanel from "@/components/panels/StatsPanel";
import { properties, PropertyPoint } from "@/data/mockProperties";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Map, Sparkles, Settings2 } from "lucide-react";

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

  const handleSelect = (p: PropertyPoint) => {
    setSelected(p);
    setSearchArea(circlePolygon(p.coords, 1200));
  };

  const saveToken = () => {
    localStorage.setItem('MAPBOX_PUBLIC_TOKEN', token);
    setShowTokenPanel(false);
  };

  const hasToken = useMemo(() => !!(token || localStorage.getItem('MAPBOX_PUBLIC_TOKEN')), [token]);

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-20 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container py-4 flex flex-col gap-3">
          <h1 className="sr-only">UAE Real Estate AI Map — Undervalued Areas & Insights</h1>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-foreground">
              <div className="h-8 w-8 rounded-md" style={{ background: 'linear-gradient(135deg, hsl(182,65%,45%), hsl(152,53%,41%))' }} />
              <div>
                <div className="font-semibold leading-tight">UAE Property Intel</div>
                <div className="text-xs text-muted-foreground">3D AI map for prices, yields & opportunities</div>
              </div>
            </div>
            <div className="hidden md:block">
              <SearchBar items={properties} onSelect={handleSelect} />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowTokenPanel((s) => !s)}>
                <Settings2 className="h-4 w-4 mr-2" /> Token
              </Button>
            </div>
          </div>
          <div className="md:hidden">
            <SearchBar items={properties} onSelect={handleSelect} />
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
            <div className="flex items-center gap-2 ml-4">
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
          </div>
        </div>
      </header>

      <section className="container py-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        <article className="lg:col-span-8 xl:col-span-9 rounded-xl overflow-hidden border">
          <div className="relative h-[70vh] lg:h-[calc(100vh-180px)]">
            <RealEstateMap token={token} selected={selected} onSelect={handleSelect} showPriceHeat={showPriceHeat} showYieldHeat={showYieldHeat} searchArea={searchArea} />
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
        <aside className="lg:col-span-4 xl:col-span-3">
          <StatsPanel selected={selected} />
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
