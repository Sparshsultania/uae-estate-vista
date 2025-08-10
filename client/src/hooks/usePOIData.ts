import { useState, useCallback } from 'react';
import type { POIDetails } from '@/components/panels/POIDetailsPanel';

interface MapboxPOI {
  id: string;
  place_name: string;
  properties: {
    category?: string;
    tel?: string;
    website?: string;
    address?: string;
    landmark?: boolean;
    wikidata?: string;
  };
  geometry: {
    coordinates: [number, number];
  };
  context?: Array<{
    id: string;
    text: string;
  }>;
}

const usePOIData = (token: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPOIDetails = useCallback(async (coordinates: [number, number]): Promise<POIDetails | null> => {
    if (!token) {
      setError('Mapbox token is required');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use Mapbox Geocoding API to get place details at clicked coordinates
      const [lng, lat] = coordinates;
      const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&types=poi,address&limit=1`;
      
      const geocodeResponse = await fetch(geocodeUrl);
      
      if (!geocodeResponse.ok) {
        throw new Error(`Geocoding API error: ${geocodeResponse.status}`);
      }

      const geocodeData = await geocodeResponse.json();
      const features = geocodeData.features;

      if (!features || features.length === 0) {
        // If no POI found, create a basic location entry
        return {
          id: `location_${Date.now()}`,
          name: 'Location',
          address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          category: 'Location',
          coordinates: [lng, lat],
          description: 'Selected location on the map'
        };
      }

      const poi = features[0] as MapboxPOI;
      
      // Extract category from place name or properties
      const getCategory = (poi: MapboxPOI): string => {
        if (poi.properties?.category) return poi.properties.category;
        
        // Parse category from place_name
        const placeName = poi.place_name.toLowerCase();
        if (placeName.includes('restaurant') || placeName.includes('cafe') || placeName.includes('food')) return 'Restaurant';
        if (placeName.includes('hotel')) return 'Hotel';
        if (placeName.includes('shopping') || placeName.includes('mall')) return 'Shopping';
        if (placeName.includes('hospital') || placeName.includes('clinic')) return 'Healthcare';
        if (placeName.includes('school') || placeName.includes('university')) return 'Education';
        if (placeName.includes('bank')) return 'Bank';
        if (placeName.includes('gas station') || placeName.includes('fuel')) return 'Gas Station';
        if (placeName.includes('mosque') || placeName.includes('church') || placeName.includes('temple')) return 'Religious';
        if (placeName.includes('park')) return 'Park';
        if (placeName.includes('tower') || placeName.includes('building')) return 'Building';
        
        return 'Point of Interest';
      };

      // Generate realistic building image based on location and type
      const generateBuildingImage = (poi: MapboxPOI): string => {
        const category = getCategory(poi).toLowerCase();
        const placeName = poi.place_name.toLowerCase();
        
        // Use appropriate stock photos based on POI type
        if (category.includes('restaurant') || category.includes('food')) {
          return `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=200&fit=crop&q=80`;
        } else if (category.includes('hotel')) {
          return `https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=200&fit=crop&q=80`;
        } else if (category.includes('shopping') || category.includes('mall')) {
          return `https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=200&fit=crop&q=80`;
        } else if (category.includes('building') || placeName.includes('tower')) {
          // Use Dubai/UAE specific building images
          const buildingImages = [
            'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&h=200&fit=crop&q=80', // Dubai skyline
            'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=400&h=200&fit=crop&q=80', // Dubai marina
            'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=200&fit=crop&q=80', // Dubai architecture
          ];
          return buildingImages[Math.floor(Math.random() * buildingImages.length)];
        } else if (category.includes('healthcare') || category.includes('hospital')) {
          return `https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&h=200&fit=crop&q=80`;
        } else if (category.includes('park')) {
          return `https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=200&fit=crop&q=80`;
        }
        
        // Default Dubai/UAE building image
        return `https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&h=200&fit=crop&q=80`;
      };

      // Generate sample reviews for demonstration
      const generateSampleReviews = (category: string) => {
        const reviewTemplates = {
          'Restaurant': [
            { text: "Great food and excellent service. Highly recommended!", rating: 5, author: "Ahmed K." },
            { text: "Good location with authentic flavors. Will visit again.", rating: 4, author: "Sarah M." }
          ],
          'Hotel': [
            { text: "Comfortable stay with great amenities and location.", rating: 5, author: "John D." },
            { text: "Professional staff and clean rooms. Good value.", rating: 4, author: "Fatima A." }
          ],
          'Building': [
            { text: "Impressive architecture and prime location.", rating: 5, author: "Mohamed R." },
            { text: "Modern facilities and excellent accessibility.", rating: 4, author: "Lisa T." }
          ]
        };

        return reviewTemplates[category as keyof typeof reviewTemplates] || [
          { text: "Good location and service.", rating: 4, author: "Local Resident" }
        ];
      };

      const category = getCategory(poi);
      
      const poiDetails: POIDetails = {
        id: poi.id,
        name: poi.place_name.split(',')[0], // Take first part before comma
        address: poi.place_name,
        category,
        coordinates: poi.geometry.coordinates,
        description: `${category} located in ${poi.context?.find(c => c.id.includes('place'))?.text || 'Dubai'}`,
        imageUrl: generateBuildingImage(poi),
        rating: 4.0 + Math.random(), // Generate realistic rating between 4-5
        phone: poi.properties?.tel,
        website: poi.properties?.website,
        hours: 'Hours vary - Contact for details',
        priceLevel: category.includes('Restaurant') ? Math.floor(Math.random() * 3) + 1 : undefined,
        amenities: category === 'Building' ? ['Parking', 'Security', 'Elevator'] : 
                  category === 'Restaurant' ? ['WiFi', 'Air Conditioning', 'Outdoor Seating'] : 
                  ['WiFi', 'Air Conditioning'],
        reviews: generateSampleReviews(category)
      };

      return poiDetails;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch POI details';
      console.error('POI fetch error:', errorMessage);
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  return {
    fetchPOIDetails,
    isLoading,
    error
  };
};

export default usePOIData;