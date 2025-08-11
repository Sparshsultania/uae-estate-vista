import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { imageService, BuildingImageData, CommunityImageData } from '@/services/imageService';

export interface UseBuildingImagesProps {
  coordinates?: [number, number];
  buildingName?: string;
  address?: string;
  enabled?: boolean;
}

export interface UseCommunityImagesProps {
  areaName?: string;
  coordinates?: [number, number];
  enabled?: boolean;
}

/**
 * Hook for fetching building-specific images
 */
export function useBuildingImages({
  coordinates,
  buildingName,
  address,
  enabled = true
}: UseBuildingImagesProps) {
  const {
    data: images,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['building-images', coordinates, buildingName, address],
    queryFn: async () => {
      if (!coordinates) return null;
      return await imageService.getBuildingImages(coordinates, buildingName, address);
    },
    enabled: enabled && !!coordinates,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    retry: 2
  });

  const bestImage = images ? imageService.getBestBuildingImage(images) : null;

  return {
    images: images || null,
    bestImage,
    isLoading,
    error,
    refetch,
    hasImages: !!images && (
      !!images.streetViewUrl || 
      !!images.placesPhotos?.length || 
      !!images.stockPhotos?.length
    )
  };
}

/**
 * Hook for fetching community/area images
 */
export function useCommunityImages({
  areaName,
  coordinates,
  enabled = true
}: UseCommunityImagesProps) {
  const {
    data: images,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['community-images', areaName, coordinates],
    queryFn: async () => {
      if (!areaName) return null;
      return await imageService.getCommunityImages(areaName, coordinates);
    },
    enabled: enabled && !!areaName,
    staleTime: 1000 * 60 * 60 * 2, // Cache for 2 hours (community images change less frequently)
    retry: 1
  });

  const bestImage = images ? imageService.getBestCommunityImage(images) : null;

  return {
    images: images || null,
    bestImage,
    isLoading,
    error,
    refetch,
    hasImages: !!images && (
      !!images.communityPhotos?.length || 
      !!images.landmarkPhotos?.length || 
      !!images.aerialView
    )
  };
}

/**
 * Hook for managing Google API key
 */
export function useImageApiKeys() {
  const [googleApiKey, setGoogleApiKey] = useState<string | null>(
    () => localStorage.getItem('GOOGLE_MAPS_API_KEY')
  );

  const updateGoogleApiKey = (key: string) => {
    localStorage.setItem('GOOGLE_MAPS_API_KEY', key);
    setGoogleApiKey(key);
  };

  const clearGoogleApiKey = () => {
    localStorage.removeItem('GOOGLE_MAPS_API_KEY');
    setGoogleApiKey(null);
  };

  return {
    googleApiKey,
    hasGoogleApiKey: !!googleApiKey,
    updateGoogleApiKey,
    clearGoogleApiKey
  };
}