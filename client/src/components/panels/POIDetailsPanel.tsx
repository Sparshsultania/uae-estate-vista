import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MapPin, Star, Phone, Globe, Clock, Navigation } from 'lucide-react';

export interface POIDetails {
  id: string;
  name: string;
  address: string;
  category: string;
  coordinates: [number, number];
  description?: string;
  imageUrl?: string;
  rating?: number;
  phone?: string;
  website?: string;
  hours?: string;
  priceLevel?: number;
  amenities?: string[];
  reviews?: {
    text: string;
    rating: number;
    author: string;
  }[];
  // Property-specific fields to match JVC Skyline format
  value?: number;
  pricePerSqFt?: number;
  yield?: number;
  score?: number;
  propertyType?: string;
  originalName?: string;
}

interface POIDetailsPanelProps {
  poi: POIDetails | null;
  onClose: () => void;
  onGetDirections?: (coordinates: [number, number]) => void;
}

const POIDetailsPanel: React.FC<POIDetailsPanelProps> = ({ poi, onClose, onGetDirections }) => {
  if (!poi) return null;

  const renderPriceLevel = (level?: number) => {
    if (!level) return null;
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className={i < level ? 'text-green-600' : 'text-gray-300'}>
            $
          </span>
        ))}
      </div>
    );
  };

  const handleDirections = () => {
    if (onGetDirections) {
      onGetDirections(poi.coordinates);
    }
  };

  return (
    <Card className="absolute top-4 right-4 w-80 max-h-[calc(100vh-2rem)] overflow-y-auto z-50 shadow-xl bg-white">
      {/* Header with property image */}
      {poi.imageUrl && (
        <div className="relative h-48 overflow-hidden rounded-t-lg">
          <img src={poi.imageUrl} alt={poi.name} className="w-full h-full object-cover" />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose} 
            className="absolute top-2 right-2 bg-white/80 hover:bg-white text-black"
          >
            ×
          </Button>
        </div>
      )}
      
      <CardHeader className="pb-2">
        {!poi.imageUrl && (
          <div className="flex justify-end mb-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          </div>
        )}
        <CardTitle className="text-xl font-bold mb-1">{poi.name}</CardTitle>
        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
          <MapPin className="w-4 h-4" />
          <span>{poi.address}</span>
          {poi.originalName && (
            <span className="text-xs italic">• {poi.originalName}</span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Property Stats Grid - Match JVC Skyline format */}
        {(poi.value || poi.pricePerSqFt || poi.yield || poi.score) && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            {poi.value && (
              <div>
                <div className="text-sm font-medium text-gray-600">Value</div>
                <div className="text-lg font-bold">AED {poi.value.toLocaleString()}</div>
              </div>
            )}
            {poi.pricePerSqFt && (
              <div>
                <div className="text-sm font-medium text-gray-600">Per Sq.Ft</div>
                <div className="text-lg font-bold">AED {poi.pricePerSqFt}</div>
              </div>
            )}
            {poi.yield && (
              <div>
                <div className="text-sm font-medium text-gray-600">Yield</div>
                <div className="text-lg font-bold text-green-600">{poi.yield}%</div>
              </div>
            )}
            {poi.score && (
              <div>
                <div className="text-sm font-medium text-gray-600">Score</div>
                <div className="text-lg font-bold text-orange-600">{poi.score}/100</div>
              </div>
            )}
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{poi.category}</Badge>
          {poi.rating && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium">{poi.rating.toFixed(1)}</span>
            </div>
          )}
          {renderPriceLevel(poi.priceLevel)}
        </div>

        {poi.description && (
          <p className="text-sm text-gray-600">{poi.description}</p>
        )}

        <div className="space-y-3">
          {poi.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-gray-500" />
              <span>{poi.phone}</span>
            </div>
          )}
          
          {poi.website && (
            <div className="flex items-center gap-2 text-sm">
              <Globe className="w-4 h-4 text-gray-500" />
              <a href={poi.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                Visit Website
              </a>
            </div>
          )}

          {poi.hours && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-gray-500" />
              <span>{poi.hours}</span>
            </div>
          )}
        </div>

        {poi.amenities && poi.amenities.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Amenities</h4>
            <div className="flex flex-wrap gap-1">
              {poi.amenities.map((amenity, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {amenity}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {poi.reviews && poi.reviews.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Reviews</h4>
            <div className="space-y-2">
              {poi.reviews.slice(0, 2).map((review, index) => (
                <div key={index} className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex items-center">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'fill-current text-yellow-500' : 'text-gray-300'}`} />
                      ))}
                    </div>
                    <span className="text-xs font-medium">{review.author}</span>
                  </div>
                  <p className="text-xs text-gray-700">{review.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        <Button onClick={handleDirections} className="w-full">
          <Navigation className="w-4 h-4 mr-2" />
          Get Directions
        </Button>
      </CardContent>
    </Card>
  );
};

export default POIDetailsPanel;