// Import PropertyData from the PropertyDetailsPanel where it's defined
export interface PropertyData {
  id: string;
  name: string;
  address: string;
  location: string;
  coordinates: [number, number];
  imageUrl?: string;
  value: number;
  pricePerSqFt: number;
  yield: number;
  score: number;
  marketTrend: string;
  propertyType?: string;
  bedrooms?: number;
  size?: number;
}

export interface BuildingImageData {
  streetViewUrl?: string;
  // Only authentic Google Street View images - no stock photos or fallbacks
}

export interface CommunityImageData {
  aerialView?: string;
  landmarkPhotos?: string[];
  streetPhotos?: string[];
  communityPhotos?: string[];
}

class ImageService {
  private googleMapsApiKey: string | null = null;

  constructor() {
    // Get API key from environment variables (Replit Secrets)
    this.googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || null;
    
    // For development, also check if it's available server-side
    if (!this.googleMapsApiKey && typeof window !== 'undefined') {
      // The API key will be passed from the server via props or context
      this.googleMapsApiKey = (window as any).GOOGLE_MAPS_API_KEY || null;
    }
  }

  /**
   * Get comprehensive building images using server-side API
   */
  async getBuildingImages(
    coordinates: [number, number], 
    buildingName: string = '', 
    address: string = ''
  ): Promise<BuildingImageData> {
    try {
      const response = await fetch('/api/images/building', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coordinates,
          buildingName,
          address
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch building images: ${response.statusText}`);
      }

      const images = await response.json();
      return images;

    } catch (error) {
      console.error('Error fetching building images:', error);
      return {
        // No fallback images - return empty result
      };
    }
  }

  /**
   * Get community/neighborhood images
   */
  async getCommunityImages(
    areaName: string, 
    coordinates?: [number, number]
  ): Promise<CommunityImageData> {
    const images: CommunityImageData = {};

    try {
      // 1. Aerial view if coordinates available
      if (coordinates && this.googleMapsApiKey) {
        const [lng, lat] = coordinates;
        images.aerialView = this.getGoogleSatelliteUrl(lat, lng, 15); // Zoomed for community view
      }

      // 2. Community-specific stock photos
      const communityPhotos = await this.getStockCommunityPhotos(areaName);
      if (communityPhotos.length > 0) {
        images.communityPhotos = communityPhotos;
      }

      // 3. Landmark photos from the area
      if (coordinates && this.googleMapsApiKey) {
        const landmarks = await this.getNearbyLandmarkPhotos(coordinates, areaName);
        if (landmarks.length > 0) {
          images.landmarkPhotos = landmarks;
        }
      }

    } catch (error) {
      console.error('Error fetching community images:', error);
    }

    return images;
  }

  /**
   * Google Street View Static API - Most reliable building exteriors
   */
  private getGoogleStreetViewUrl(lat: number, lng: number, heading: number = 0): string {
    if (!this.googleMapsApiKey) return '';
    
    const params = new URLSearchParams({
      size: '640x640',
      location: `${lat},${lng}`,
      heading: heading.toString(),
      pitch: '0',
      fov: '90',
      key: this.googleMapsApiKey
    });

    return `https://maps.googleapis.com/maps/api/streetview?${params}`;
  }

  /**
   * Google Static Maps API - Satellite/aerial view
   */
  private getGoogleSatelliteUrl(lat: number, lng: number, zoom: number = 18): string {
    if (!this.googleMapsApiKey) return '';
    
    const params = new URLSearchParams({
      center: `${lat},${lng}`,
      zoom: zoom.toString(),
      size: '640x640',
      maptype: 'satellite',
      key: this.googleMapsApiKey
    });

    return `https://maps.googleapis.com/maps/api/staticmap?${params}`;
  }

  /**
   * Google Places API - Interior and exterior photos from businesses
   */
  private async getGooglePlacesPhotos(lat: number, lng: number, query: string): Promise<string[]> {
    if (!this.googleMapsApiKey) return [];

    try {
      // First, search for the place
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=100&key=${this.googleMapsApiKey}`;
      
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();

      if (!searchData.results || searchData.results.length === 0) {
        return [];
      }

      const placeId = searchData.results[0].place_id;

      // Get place details with photos
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${this.googleMapsApiKey}`;
      
      const detailsResponse = await fetch(detailsUrl);
      const detailsData = await detailsResponse.json();

      if (!detailsData.result?.photos) {
        return [];
      }

      // Convert photo references to URLs
      return detailsData.result.photos.slice(0, 3).map((photo: any) => 
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=640&photoreference=${photo.photo_reference}&key=${this.googleMapsApiKey}`
      );

    } catch (error) {
      console.error('Google Places photos error:', error);
      return [];
    }
  }

  /**
   * Stock photos from Unsplash API (free tier)
   */
  private async getStockBuildingPhotos(buildingName?: string, address?: string): Promise<string[]> {
    try {
      // Use building name or default to Dubai architecture
      const query = buildingName 
        ? `${buildingName} Dubai building architecture`
        : `Dubai modern building architecture skyscraper`;

      // No external stock photo APIs - only authentic Google data
      return [];

      if (!response.ok) {
        // No fallback photos
        return [];
      }

      const data = await response.json();
      return data.results?.map((photo: any) => photo.urls.regular) || [];

    } catch (error) {
      console.log('Unsplash API not configured, no fallback');
      return [];
    }
  }

  /**
   * No stock photos - only authentic Google Street View images
   */
  private async getPexelsBuildingPhotos(buildingName?: string, address?: string): Promise<string[]> {
    // No stock photos returned
    return [];
  }

  /**
   * No community stock photos - only authentic Google data
   */
  private async getStockCommunityPhotos(areaName: string): Promise<string[]> {
    // No stock photos returned
    return [];
  }

  /**
   * Nearby landmarks using Google Places
   */
  private async getNearbyLandmarkPhotos(coordinates: [number, number], areaName: string): Promise<string[]> {
    if (!this.googleMapsApiKey) return [];

    const [lng, lat] = coordinates;
    
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=2000&type=tourist_attraction&key=${this.googleMapsApiKey}`
      );

      const data = await response.json();
      const landmarks = data.results?.slice(0, 2) || [];

      const landmarkPhotos: string[] = [];
      
      for (const landmark of landmarks) {
        if (landmark.photos && landmark.photos.length > 0) {
          const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=640&photoreference=${landmark.photos[0].photo_reference}&key=${this.googleMapsApiKey}`;
          landmarkPhotos.push(photoUrl);
        }
      }

      return landmarkPhotos;

    } catch (error) {
      console.error('Landmark photos error:', error);
      return [];
    }
  }

  /**
   * No fallback images - only authentic Google Street View
   */
  private getDubaiFallbackImage(): string {
    return '';
  }

  /**
   * Get the best available image from the building image data - only Street View
   */
  getBestBuildingImage(images: BuildingImageData): string {
    return images.streetViewUrl || '';
  }

  /**
   * Get the best available community image
   */
  getBestCommunityImage(images: CommunityImageData): string {
    return images.communityPhotos?.[0] || 
           images.landmarkPhotos?.[0] || 
           images.aerialView || 
           this.getDubaiFallbackImage();
  }
}

export const imageService = new ImageService();