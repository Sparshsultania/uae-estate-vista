import { useQuery } from '@tanstack/react-query';

interface GooglePlace {
  name: string;
  address: string;
  coordinates: [number, number];
  types: string[];
  placeId: string;
  rating?: number;
}

interface UseGooglePlacesProps {
  coordinates?: [number, number];
  radius?: number;
  enabled?: boolean;
}

/**
 * Hook for fetching nearby places from Google Places API
 */
export function useGooglePlaces({
  coordinates,
  radius = 50,
  enabled = true
}: UseGooglePlacesProps) {
  const [lng, lat] = coordinates || [0, 0];
  
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['google-places', lat, lng, radius],
    queryFn: async (): Promise<{ buildings: GooglePlace[] }> => {
      const response = await fetch(
        `/api/places/nearby?lat=${lat}&lng=${lng}&radius=${radius}`
      );
      
      if (!response.ok) {
        throw new Error(`Places search failed: ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: enabled && !!coordinates && lat !== 0 && lng !== 0,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 2
  });

  const nearestBuilding = data?.buildings?.[0] || null;

  return {
    buildings: data?.buildings || [],
    nearestBuilding,
    isLoading,
    error,
    refetch,
    hasBuildings: (data?.buildings?.length || 0) > 0
  };
}