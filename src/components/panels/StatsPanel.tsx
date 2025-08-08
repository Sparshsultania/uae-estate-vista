import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import type { PropertyPoint } from "@/data/mockProperties";

type Props = {
  selected: PropertyPoint | null;
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

const StatsPanel: React.FC<Props> = ({ selected }) => {
  return (
    <div className="space-y-4">
      <Card className="hover-rise">
        <CardHeader>
          <CardTitle className="text-lg">{selected ? selected.name : 'Select a property or zone'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {selected ? (
            <>
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
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            <li>Metro/Transport proximity (simulated)</li>
            <li>Schools & Hospitals (simulated)</li>
            <li>Retail & Waterfront access (simulated)</li>
          </ul>
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
