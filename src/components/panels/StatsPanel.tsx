import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import type { PropertyPoint } from "@/data/mockProperties";
import { useAmenities, estimateDurationSec } from "@/hooks/useAmenities";
import type { AmenityResult } from "@/hooks/useSearchBoxAmenities";

type Props = {
  selected: PropertyPoint | null;
  onRouteTo?: (dest: [number, number], profile?: 'driving'|'walking'|'cycling') => void;
  amenitiesOverride?: AmenityResult[];
  amenitiesLoadingOverride?: boolean;
};

const ScoreGauge: React.FC<{ score: number }> = ({ score }) => {
  const data = [
    { name: 'score', value: Math.max(0, Math.min(100, score)), fill: 'hsl(152,53%,41%)' },
  ];
  return (
    <ResponsiveContainer width="100%" height={180}>
      <RadialBarChart cx="50%" cy="55%" innerRadius="60%" outerRadius="100%" barSize={14} data={data} startAngle={90} endAngle={-270}>
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar background dataKey="value" cornerRadius={8} />
        <text x="50%" y="55%" textAnchor="middle" dominantBaseline="middle" className="text-3xl font-semibold fill-current">
          {score}
        </text>
        <text x="50%" y="75%" textAnchor="middle" dominantBaseline="middle" className="fill-current opacity-60">
          Investment Score
        </text>
      </RadialBarChart>
    </ResponsiveContainer>
  );
};

const StatsPanel: React.FC<Props> = ({ selected, onRouteTo, amenitiesOverride, amenitiesLoadingOverride }) => {
  const center = selected ? (selected.coords as [number, number]) : null;
  const fallback = useAmenities(center);
  const amenitiesLoading = amenitiesLoadingOverride ?? fallback.loading;
  const amenitiesLegacy = fallback.data;
  const amenitiesList: AmenityResult[] | null = amenitiesOverride ?? null;
  const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m/1000).toFixed(2)} km`);
  const fmtMins = (sec: number) => `${Math.max(1, Math.round(sec/60))} min`;

  return (
    <div className="space-y-4">
      <Card className="hover-rise">
        <CardHeader>
          <CardTitle className="text-lg">{selected ? selected.name : 'Select a property or zone'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {selected ? (
            <>
              {/* Building photo */}
              <div className="rounded-lg overflow-hidden border">
                <div className="relative">
                  <img
                    src={selected.imageUrl || '/images/buildings/downtown.jpg'}
                    alt={`${selected.name} building photo in ${selected.community}`}
                    className="w-full h-40 object-cover"
                    loading="lazy"
                  />
                  <div className="absolute bottom-2 left-2 text-xs px-2 py-1 rounded-md bg-background/70 backdrop-blur border">
                    {selected.community}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Estimated Market Value</div>
                  <div className="text-xl font-semibold">AED {selected.estimatedValueAED.toLocaleString()}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Rent Yield</div>
                  <div className="text-xl font-semibold">{selected.rentYield}%</div>
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground mb-2">Price Trends (12 months)</div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={selected.priceTrend} margin={{ left: 0, right: 0, top: 5, bottom: 0 }}>
                      <defs>
                        <linearGradient id="trend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(182,65%,45%)" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="hsl(182,65%,45%)" stopOpacity={0.05}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis hide domain={["dataMin-100", "dataMax+100"]} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                      <Area type="monotone" dataKey="value" stroke="hsl(182,65%,45%)" fill="url(#trend)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <ScoreGauge score={selected.investmentScore} />
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Tip: Use the search above or click points on the map to see insights. Undervalued zones glow in emerald.</div>
          )}
        </CardContent>
      </Card>

      <Card className="hover-rise">
        <CardHeader>
          <CardTitle className="text-lg">Nearby Amenities</CardTitle>
        </CardHeader>
        <CardContent>
          {!selected ? (
            <div className="text-sm text-muted-foreground">Select a property to see nearby amenities.</div>
          ) : amenitiesLoading ? (
            <div className="text-sm text-muted-foreground">Loading amenities...</div>
          ) : (
            <>
              {amenitiesList ? (
                (() => {
                  const label: Record<string, string> = {
                    food_drink: 'Food & Cafes',
                    groceries: 'Groceries',
                    atm_bank: 'ATMs & Banks',
                    pharmacy_hospital: 'Pharmacy & Hospital',
                    school_university: 'Schools & Universities',
                    gym_sports: 'Gyms & Sports',
                    shopping_mall: 'Shopping Malls',
                    public_transport: 'Public Transport',
                  };
                  const cats = Array.from(new Set(amenitiesList.map(a => a.category)));
                  return (
                    <Tabs defaultValue={cats[0] as string} className="w-full">
                      <TabsList className="grid grid-cols-2 md:grid-cols-4">
                        {cats.map((c) => (
                          <TabsTrigger key={c} value={c as string}>{label[c as string] || c}</TabsTrigger>
                        ))}
                      </TabsList>
                      {cats.map((c) => (
                        <TabsContent key={c} value={c as string} className="mt-3">
                          {amenitiesList.filter(a => a.category === c).length ? (
                            <ul className="space-y-2">
                              {amenitiesList.filter(a => a.category === c).map((a) => (
                                <li key={a.id} className="flex items-center justify-between gap-3 rounded-md border p-2">
                                  <div>
                                    <div className="text-sm font-medium">{a.name}</div>
                                    {typeof a.distanceMeters === 'number' && (
                                      <div className="text-xs text-muted-foreground">
                                        {fmtDist(a.distanceMeters)} • {fmtMins(estimateDurationSec(a.distanceMeters, 'walking'))} walk • {fmtMins(estimateDurationSec(a.distanceMeters, 'driving'))} drive
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="secondary" onClick={() => onRouteTo?.(a.center, 'walking')}>Walk</Button>
                                    <Button size="sm" onClick={() => onRouteTo?.(a.center, 'driving')}>Drive</Button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="text-xs text-muted-foreground">No results found nearby.</div>
                          )}
                        </TabsContent>
                      ))}
                    </Tabs>
                  );
                })()
              ) : (
                <Tabs defaultValue="supermarket" className="w-full">
                  <TabsList className="grid grid-cols-3">
                    <TabsTrigger value="supermarket">Supermarkets</TabsTrigger>
                    <TabsTrigger value="school">Schools</TabsTrigger>
                    <TabsTrigger value="metro">Metro</TabsTrigger>
                  </TabsList>
                  {(["supermarket","school","metro"] as const).map((cat) => (
                    <TabsContent key={cat} value={cat} className="mt-3">
                      {amenitiesLegacy[cat]?.length ? (
                        <ul className="space-y-2">
                          {amenitiesLegacy[cat].map((a) => (
                            <li key={a.id} className="flex items-center justify-between gap-3 rounded-md border p-2">
                              <div>
                                <div className="text-sm font-medium">{a.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {fmtDist(a.distanceMeters)} • {fmtMins(estimateDurationSec(a.distanceMeters, 'walking'))} walk • {fmtMins(estimateDurationSec(a.distanceMeters, 'driving'))} drive
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="secondary" onClick={() => onRouteTo?.(a.center, 'walking')}>Walk</Button>
                                <Button size="sm" onClick={() => onRouteTo?.(a.center, 'driving')}>Drive</Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-xs text-muted-foreground">No results found nearby.</div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="hover-rise">
        <CardHeader>
          <CardTitle className="text-lg">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Sample recent transactions will appear here.</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatsPanel;
