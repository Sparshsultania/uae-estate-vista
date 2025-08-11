import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { X, MapPin, TrendingUp, BarChart3, Building2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { BuildingImageGallery } from '@/components/images/BuildingImageGallery';
import { useBuildingImages } from '@/hooks/useBuildingImages';
import { useGooglePlaces } from '@/hooks/useGooglePlaces';

export interface PropertyData {
  id: string;
  name: string;
  address: string;
  location: string;
  coordinates: [number, number];
  imageUrl?: string;
  
  // Financial data
  value: number;
  pricePerSqFt: number;
  yield: number;
  
  // Performance metrics
  score: number;
  marketTrend: string;
  
  // Property details
  propertyType?: string;
  bedrooms?: number;
  size?: number;
  
  // Price history for chart
  priceHistory?: Array<{
    month: string;
    value: number;
  }>;
}

interface PropertyDetailsPanelProps {
  property: PropertyData | null;
  onClose: () => void;
}

// Generate sample price trend data
const generatePriceHistory = (currentValue: number) => {
  const months = ['Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Sep', 'Oct', 'Dec'];
  const baseValue = currentValue * 0.85; // Start 15% lower
  
  return months.map((month, index) => ({
    month,
    value: Math.round(baseValue + (currentValue - baseValue) * (index / (months.length - 1)))
  }));
};

const PropertyDetailsPanel: React.FC<PropertyDetailsPanelProps> = ({ property, onClose }) => {
  if (!property) return null;

  const priceHistory = property.priceHistory || generatePriceHistory(property.value);
  const currentPrice = priceHistory[priceHistory.length - 1]?.value || property.value;
  const previousPrice = priceHistory[priceHistory.length - 2]?.value || property.value;
  const priceChange = ((currentPrice - previousPrice) / previousPrice * 100).toFixed(1);
  const isPositive = Number(priceChange) > 0;

  const coordinates: [number, number] = [property.coordinates[0], property.coordinates[1]];
  
  // Get real building name from Google Places API
  const { nearestBuilding, isLoading: placesLoading } = useGooglePlaces({
    coordinates,
    radius: 50
  });
  
  // Use Google Places name if available, fallback to Mapbox name
  const displayName = nearestBuilding?.name || property.name;
  const displayAddress = nearestBuilding?.address || property.location;
  
  // Fetch building images using the new image service
  const { images, isLoading: imagesLoading } = useBuildingImages({
    coordinates,
    buildingName: displayName,
    address: displayAddress,
    enabled: true
  });

  return (
    <div className="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 overflow-y-auto border-l border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 mb-1">{displayName}</h2>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <MapPin className="w-4 h-4" />
              <span>{displayAddress}</span>
            </div>
            {nearestBuilding && (
              <div className="text-xs text-green-600 mt-1">
                ✓ Google Places verified
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Building Images Gallery */}
      <div className="p-4 space-y-3">
        <BuildingImageGallery
          images={images}
          isLoading={imagesLoading}
          buildingName={displayName}
          address={displayAddress}
        />
      </div>

      <div className="p-4 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="text-sm font-medium text-gray-600">Estimated Market Value</div>
            <div className="text-2xl font-bold text-gray-900">AED</div>
            <div className="text-2xl font-bold text-gray-900">{property.value.toLocaleString()}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm font-medium text-gray-600">Rent Yield</div>
            <div className="text-3xl font-bold text-green-600">{property.yield}%</div>
          </Card>
        </div>

        {/* Property Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium text-gray-600">Value</div>
            <div className="text-lg font-bold">AED {property.value.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-600">Per Sq.Ft</div>
            <div className="text-lg font-bold">AED {property.pricePerSqFt}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-600">Yield</div>
            <div className="text-lg font-bold text-green-600">{property.yield}%</div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-600">Score</div>
            <div className="text-lg font-bold text-orange-600">{property.score}/100</div>
          </div>
        </div>

        {/* Price Trends Chart */}
        <Card className="p-4">
          <CardHeader className="p-0 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Price Trends (12 months)</CardTitle>
              <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                <TrendingUp className="w-4 h-4" />
                {isPositive ? '+' : ''}{priceChange}%
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#666' }}
                  />
                  <YAxis hide />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#3b82f6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Investment Score Gauge */}
        <Card className="p-4">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Investment Score
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative w-32 h-32 mx-auto">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                />
                {/* Progress circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(property.score / 100) * 283} 283`}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{property.score}</div>
                  <div className="text-xs text-gray-600">out of 100</div>
                </div>
              </div>
            </div>
            <div className="text-center mt-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {property.score >= 80 ? 'Excellent' : property.score >= 60 ? 'Good' : 'Fair'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Property Details */}
        <Card className="p-4">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Property Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Property Type</span>
              <span className="text-sm font-medium">{property.propertyType || 'Apartment'}</span>
            </div>
            {property.bedrooms && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Bedrooms</span>
                <span className="text-sm font-medium">{property.bedrooms}</span>
              </div>
            )}
            {property.size && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Size</span>
                <span className="text-sm font-medium">{property.size} sq ft</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Market Trend</span>
              <span className="text-sm font-medium">{property.marketTrend || 'Stable'}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PropertyDetailsPanel;