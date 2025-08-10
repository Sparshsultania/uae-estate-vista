import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, Star, Phone, Globe, Clock, Navigation, Building2, Car, ShoppingBag, Hospital, GraduationCap, CreditCard, Bus, Dumbbell, Coffee } from 'lucide-react';
import { NearbyAmenity } from '@/hooks/useNearbyAmenities';

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
}

interface POIDetailsPanelProps {
  poi: POIDetails | null;
  nearbyAmenities: NearbyAmenity[];
  amenitiesLoading: boolean;
  onClose: () => void;
  onGetDirections?: (coordinates: [number, number]) => void;
}

const POIDetailsPanel: React.FC<POIDetailsPanelProps> = ({ poi, nearbyAmenities, amenitiesLoading, onClose, onGetDirections }) => {
  if (!poi) return null;

  const getAmenityIcon = (type: NearbyAmenity['amenityType']) => {
    switch (type) {
      case 'restaurant': return <Coffee className="w-4 h-4" />;
      case 'shopping': return <ShoppingBag className="w-4 h-4" />;
      case 'healthcare': return <Hospital className="w-4 h-4" />;
      case 'education': return <GraduationCap className="w-4 h-4" />;
      case 'finance': return <CreditCard className="w-4 h-4" />;
      case 'transport': return <Bus className="w-4 h-4" />;
      case 'entertainment': return <Dumbbell className="w-4 h-4" />;
      default: return <MapPin className="w-4 h-4" />;
    }
  };

  const formatDistance = (distance: number) => {
    if (distance < 1000) return `${distance}m`;
    return `${(distance / 1000).toFixed(1)}km`;
  };

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
    <Card className="absolute top-4 left-4 w-96 max-h-[calc(100vh-2rem)] overflow-y-auto z-50 shadow-xl">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-bold mb-1">{poi.name}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>{poi.address}</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="ml-2">
            ×
          </Button>
        </div>
        
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="secondary">{poi.category}</Badge>
          {poi.rating && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium">{poi.rating.toFixed(1)}</span>
            </div>
          )}
          {renderPriceLevel(poi.priceLevel)}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {poi.imageUrl && (
          <div className="rounded-lg overflow-hidden">
            <img 
              src={poi.imageUrl} 
              alt={poi.name}
              className="w-full h-48 object-cover"
              onError={(e) => {
                // Fallback to a default image if the POI image fails to load
                (e.target as HTMLImageElement).src = `https://via.placeholder.com/400x200/e2e8f0/64748b?text=${encodeURIComponent(poi.name)}`;
              }}
            />
          </div>
        )}

        {poi.description && (
          <p className="text-sm text-muted-foreground">{poi.description}</p>
        )}

        <div className="space-y-2">
          {poi.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <a href={`tel:${poi.phone}`} className="text-sm hover:text-primary">
                {poi.phone}
              </a>
            </div>
          )}

          {poi.website && (
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <a 
                href={poi.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm hover:text-primary"
              >
                Visit Website
              </a>
            </div>
          )}

          {poi.hours && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{poi.hours}</span>
            </div>
          )}
        </div>

        {poi.amenities && poi.amenities.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Amenities</h4>
            <div className="flex flex-wrap gap-1">
              {poi.amenities.map((amenity, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {amenity}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Nearby Amenities Section */}
        <div>
          <Separator className="my-3" />
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Nearby Amenities
          </h4>
          
          {amenitiesLoading ? (
            <div className="text-xs text-muted-foreground">Loading nearby amenities...</div>
          ) : nearbyAmenities.length > 0 ? (
            <ScrollArea className="h-32">
              <div className="space-y-2">
                {nearbyAmenities.slice(0, 10).map((amenity) => (
                  <div key={amenity.id} className="flex items-center justify-between p-2 rounded-md border bg-card">
                    <div className="flex items-center gap-2">
                      {getAmenityIcon(amenity.amenityType)}
                      <div>
                        <div className="text-xs font-medium">{amenity.name}</div>
                        <div className="text-xs text-muted-foreground">{amenity.category}</div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistance(amenity.distance)}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-xs text-muted-foreground">No nearby amenities found</div>
          )}
        </div>

        {poi.reviews && poi.reviews.length > 0 && (
          <div>
            <Separator className="my-3" />
            <h4 className="text-sm font-medium mb-2">Recent Reviews</h4>
            <div className="space-y-3">
              {poi.reviews.slice(0, 2).map((review, index) => (
                <div key={index} className="text-xs">
                  <div className="flex items-center gap-1 mb-1">
                    <div className="flex">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star 
                          key={i} 
                          className={`w-3 h-3 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
                        />
                      ))}
                    </div>
                    <span className="font-medium">{review.author}</span>
                  </div>
                  <p className="text-muted-foreground">{review.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator className="my-3" />
        
        <div className="flex gap-2">
          <Button 
            onClick={handleDirections} 
            className="flex-1" 
            size="sm"
          >
            <Navigation className="w-4 h-4 mr-2" />
            Get Directions
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${poi.coordinates[1]},${poi.coordinates[0]}`, '_blank')}
          >
            View on Google Maps
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default POIDetailsPanel;