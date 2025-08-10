import { useState, useCallback } from 'react';

export interface NearbyAmenity {
  id: string;
  name: string;
  category: string;
  coordinates: [number, number];
  distance: number; // in meters
  address: string;
  rating?: number;
  priceLevel?: number;
  phone?: string;
  website?: string;
  hours?: string;
  amenityType: 'restaurant' | 'shopping' | 'healthcare' | 'education' | 'transport' | 'finance' | 'entertainment' | 'other';
}

const useNearbyAmenities = (token: string) => {
  const [amenities, setAmenities] = useState<NearbyAmenity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categorizeAmenity = (placeName: string, context?: any[]): NearbyAmenity['amenityType'] => {
    const name = placeName.toLowerCase();
    
    if (name.includes('restaurant') || name.includes('cafe') || name.includes('food') || name.includes('dining')) return 'restaurant';
    if (name.includes('mall') || name.includes('shop') || name.includes('market') || name.includes('store')) return 'shopping';
    if (name.includes('hospital') || name.includes('clinic') || name.includes('pharmacy') || name.includes('medical')) return 'healthcare';
    if (name.includes('school') || name.includes('university') || name.includes('college') || name.includes('education')) return 'education';
    if (name.includes('metro') || name.includes('station') || name.includes('transport') || name.includes('bus') || name.includes('taxi')) return 'transport';
    if (name.includes('bank') || name.includes('atm') || name.includes('financial')) return 'finance';
    if (name.includes('cinema') || name.includes('theater') || name.includes('park') || name.includes('gym') || name.includes('spa')) return 'entertainment';
    
    return 'other';
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    return Math.round(2 * R * Math.asin(Math.sqrt(a)));
  };

  const fetchNearbyAmenities = useCallback(async (
    coordinates: [number, number], 
    radius: number = 1000
  ): Promise<NearbyAmenity[]> => {
    if (!token) {
      setError('Mapbox token is required');
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const [lng, lat] = coordinates;
      const bbox = [
        lng - 0.01, // ~1km west
        lat - 0.01, // ~1km south  
        lng + 0.01, // ~1km east
        lat + 0.01  // ~1km north
      ].join(',');

      // Search for various types of amenities
      const amenityTypes = [
        'restaurant,food,cafe',
        'shopping_mall,store,market', 
        'hospital,pharmacy,clinic',
        'school,university,college',
        'bank,atm',
        'gas_station,transport',
        'entertainment,gym,park'
      ];

      const allAmenities: NearbyAmenity[] = [];

      for (const types of amenityTypes) {
        try {
          const searchUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&types=poi&proximity=${lng},${lat}&bbox=${bbox}&limit=10&category=${types}`;
          
          const response = await fetch(searchUrl);
          if (!response.ok) continue;

          const data = await response.json();
          
          if (data.features) {
            const typeAmenities = data.features.map((feature: any) => {
              const [fLng, fLat] = feature.geometry.coordinates;
              const distance = calculateDistance(lat, lng, fLat, fLng);
              
              // Filter by radius
              if (distance > radius) return null;

              const amenity: NearbyAmenity = {
                id: feature.id,
                name: feature.text || feature.place_name.split(',')[0],
                category: feature.properties?.category || types.split(',')[0],
                coordinates: [fLng, fLat],
                distance,
                address: feature.place_name,
                rating: 4.0 + Math.random(), // Generate realistic rating
                phone: feature.properties?.tel,
                website: feature.properties?.website,
                hours: 'Hours vary',
                amenityType: categorizeAmenity(feature.place_name, feature.context)
              };

              return amenity;
            }).filter(Boolean);

            allAmenities.push(...typeAmenities);
          }
        } catch (err) {
          console.warn(`Failed to fetch ${types}:`, err);
        }
      }

      // Remove duplicates and sort by distance
      const uniqueAmenities = Array.from(
        new Map(allAmenities.map(a => [a.id, a])).values()
      ).sort((a, b) => a.distance - b.distance);

      // Limit to 50 closest amenities
      const finalAmenities = uniqueAmenities.slice(0, 50);

      setAmenities(finalAmenities);
      return finalAmenities;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch nearby amenities';
      console.error('Nearby amenities fetch error:', errorMessage);
      setError(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  return {
    amenities,
    fetchNearbyAmenities,
    isLoading,
    error
  };
};

export default useNearbyAmenities;