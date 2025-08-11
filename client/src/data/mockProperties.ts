export type PropertyPoint = {
  id: string;
  name: string;
  community: string;
  coords: [number, number]; // [lng, lat]
  estimatedValueAED: number;
  pricePerSqft: number;
  rentYield: number; // %
  investmentScore: number; // 0-100
  priceTrend: { month: string; value: number }[];
  imageUrl?: string; // new optional field for building photo
};

export const properties: PropertyPoint[] = [
  {
    id: "dubai-marina-01",
    name: "Marina Heights",
    community: "Dubai Marina",
    coords: [55.1405, 25.0835],
    estimatedValueAED: 2200000,
    pricePerSqft: 2100,
    rentYield: 6.8,
    investmentScore: 82,
    // No stock images - only authentic Google Street View images
    priceTrend: Array.from({ length: 12 }).map((_, i) => ({
      month: new Date(2024, i, 1).toLocaleString('en', { month: 'short' }),
      value: 1800 + i * 30 + (i % 3 === 0 ? 40 : 0)
    })),
  },
  {
    id: "downtown-01",
    name: "Burj Park Residences",
    community: "Downtown Dubai",
    coords: [55.2750, 25.1965],
    estimatedValueAED: 3800000,
    pricePerSqft: 3200,
    rentYield: 5.2,
    investmentScore: 74,

    priceTrend: Array.from({ length: 12 }).map((_, i) => ({
      month: new Date(2024, i, 1).toLocaleString('en', { month: 'short' }),
      value: 2900 + i * 25 + (i % 4 === 0 ? 60 : 0)
    })),
  },
  {
    id: "jvc-01",
    name: "JVC Skyline",
    community: "Jumeirah Village Circle",
    coords: [55.205, 25.060],
    estimatedValueAED: 1100000,
    pricePerSqft: 1100,
    rentYield: 7.6,
    investmentScore: 88,

    priceTrend: Array.from({ length: 12 }).map((_, i) => ({
      month: new Date(2024, i, 1).toLocaleString('en', { month: 'short' }),
      value: 950 + i * 15 + (i % 5 === 0 ? 30 : 0)
    })),
  },
  {
    id: "abudhabi-01",
    name: "Corniche Pearl",
    community: "Abu Dhabi Corniche",
    coords: [54.354, 24.494],
    estimatedValueAED: 2600000,
    pricePerSqft: 1700,
    rentYield: 6.1,
    investmentScore: 79,

    priceTrend: Array.from({ length: 12 }).map((_, i) => ({
      month: new Date(2024, i, 1).toLocaleString('en', { month: 'short' }),
      value: 1500 + i * 18 + (i % 3 === 0 ? 25 : 0)
    })),
  },
];

export type Zone = {
  id: string;
  name: string;
  undervalued: boolean;
  polygon: GeoJSON.Feature<GeoJSON.Polygon>;
  avgPricePerSqft: number;
  avgYield: number;
};

function rectPolygon([lng, lat]: [number, number], dx = 0.01, dy = 0.01) {
  const coords: [number, number][]= [
    [lng - dx, lat - dy],
    [lng + dx, lat - dy],
    [lng + dx, lat + dy],
    [lng - dx, lat + dy],
    [lng - dx, lat - dy],
  ];
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [coords] },
  };
}

export const zones: Zone[] = [
  {
    id: 'zone-dm',
    name: 'Dubai Marina',
    undervalued: false,
    polygon: rectPolygon([55.1405, 25.0835], 0.012, 0.008),
    avgPricePerSqft: 2100,
    avgYield: 6.5,
  },
  {
    id: 'zone-downtown',
    name: 'Downtown Dubai',
    undervalued: false,
    polygon: rectPolygon([55.2750, 25.1965], 0.012, 0.009),
    avgPricePerSqft: 3200,
    avgYield: 5.1,
  },
  {
    id: 'zone-jvc',
    name: 'JVC',
    undervalued: true,
    polygon: rectPolygon([55.205, 25.060], 0.018, 0.014),
    avgPricePerSqft: 1100,
    avgYield: 7.4,
  },
  {
    id: 'zone-corniche',
    name: 'Abu Dhabi Corniche',
    undervalued: true,
    polygon: rectPolygon([54.354, 24.494], 0.02, 0.012),
    avgPricePerSqft: 1700,
    avgYield: 6.0,
  },
];

export function toFeatureCollection(points: PropertyPoint[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature' as const,
      properties: {
        id: p.id,
        name: p.name,
        community: p.community,
        estimatedValueAED: p.estimatedValueAED,
        pricePerSqft: p.pricePerSqft,
        rentYield: p.rentYield,
        investmentScore: p.investmentScore,
      },
      geometry: { type: 'Point' as const, coordinates: p.coords },
    })),
  };
}
