import { useState, useCallback } from 'react';
import type { POIDetails } from '@/components/panels/POIDetailsPanel';
import { smartTranslate, enhanceWithTranslation } from '../utils/arabicTranslation';

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
    setIsLoading(true);
    setError(null);

    try {
      // Use Google Places API instead of Mapbox geocoding to get place details
      const [lng, lat] = coordinates;
      
      const googleResponse = await fetch(`/api/places/nearby?lat=${lat}&lng=${lng}&radius=50`);
      
      if (!googleResponse.ok) {
        throw new Error(`Google Places API error: ${googleResponse.status}`);
      }

      const googleData = await googleResponse.json();

      if (!googleData.buildings || googleData.buildings.length === 0) {
        // If no POI found, create a basic location entry using Google data
        return {
          id: `location_${Date.now()}`,
          name: 'Location',
          address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          category: 'Location',
          coordinates: [lng, lat],
          description: 'Selected location on the map'
        };
      }

      const poi = googleData.buildings[0]; // Use Google Places data
      
      // Extract category from Google Places data
      const getCategory = (poi: any): string => {
        if (poi.types && poi.types.length > 0) {
          const primaryType = poi.types[0];
          switch (primaryType) {
            case 'restaurant': case 'food': case 'meal_takeaway': return 'Restaurant';
            case 'lodging': case 'hotel': return 'Hotel';
            case 'shopping_mall': case 'store': return 'Shopping';
            case 'hospital': case 'clinic': case 'pharmacy': return 'Healthcare';
            case 'school': case 'university': return 'Education';
            case 'bank': case 'atm': return 'Bank';
            case 'gas_station': return 'Gas Station';
            case 'mosque': case 'church': case 'place_of_worship': return 'Religious';
            case 'park': return 'Park';
            case 'establishment': case 'point_of_interest': return 'Building';
            default: return 'Point of Interest';
          }
        }
        
        // Parse category from name as fallback
        const placeName = (poi.name || '').toLowerCase();
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
      const generateBuildingImage = (poi: any): string => {
        const category = getCategory(poi).toLowerCase();
        const placeName = (poi.name || '').toLowerCase();
        
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
      
      // Extract and translate the name and address using Google Places data
      const rawName = poi.name || 'Building';
      const translatedName = smartTranslate(rawName);
      const translatedAddress = smartTranslate(poi.address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      
      const poiDetails: POIDetails = {
        id: poi.place_id || `google_${Date.now()}`,
        name: translatedName,
        address: translatedAddress,
        category,
        coordinates: [lng, lat],
        originalName: rawName !== translatedName ? rawName : undefined,
        description: `${category} located in Dubai`,
        imageUrl: generateBuildingImage(poi),
        rating: poi.rating || (4.0 + Math.random()), // Use Google rating or generate realistic rating between 4-5
        phone: poi.formatted_phone_number,
        website: poi.website,
        hours: 'Hours vary - Contact for details',
        priceLevel: category.includes('Restaurant') ? Math.floor(Math.random() * 3) + 1 : undefined,
        amenities: category === 'Building' ? ['Parking', 'Security', 'Elevator'] : 
                  category === 'Restaurant' ? ['WiFi', 'Air Conditioning', 'Outdoor Seating'] : 
                  ['WiFi', 'Air Conditioning'],
        reviews: generateSampleReviews(category),
        // Generate property-specific data like JVC Skyline format
        value: category === 'Building' ? Math.floor(Math.random() * 2000000) + 800000 : undefined, // 800k - 2.8M AED
        pricePerSqFt: category === 'Building' ? Math.floor(Math.random() * 800) + 600 : undefined, // 600-1400 AED/sqft
        yield: category === 'Building' ? Math.round((Math.random() * 4 + 5) * 10) / 10 : undefined, // 5-9% yield
        score: category === 'Building' ? Math.floor(Math.random() * 30) + 70 : undefined, // 70-100 score
        propertyType: category === 'Building' ? (Math.random() > 0.5 ? 'Apartment' : 'Villa') : undefined
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