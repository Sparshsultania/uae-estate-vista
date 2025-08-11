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
  satelliteUrl?: string;
  placesPhotos?: string[];
  stockPhotos?: string[];
  fallbackImage?: string;
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
        stockPhotos: [
          'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=640',
          'https://images.unsplash.com/photo-1582672060674-bc2bd808a8b5?w=640',
          'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=640'
        ],
        fallbackImage: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=640&h=640&fit=crop'
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

      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3&client_id=YOUR_UNSPLASH_ACCESS_KEY`
      );

      if (!response.ok) {
        // Fallback to Pexels if Unsplash fails
        return this.getPexelsBuildingPhotos(buildingName || '', address || '');
      }

      const data = await response.json();
      return data.results?.map((photo: any) => photo.urls.regular) || [];

    } catch (error) {
      console.log('Unsplash API not configured, using fallback');
      return this.getPexelsBuildingPhotos(buildingName || '', address || '');
    }
  }

  /**
   * Pexels API fallback for stock photos
   */
  private async getPexelsBuildingPhotos(buildingName?: string, address?: string): Promise<string[]> {
    // For now, return curated Dubai building URLs as static fallback
    // In production, implement Pexels API integration
    return [
      'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=640', // Dubai Marina
      'https://images.unsplash.com/photo-1582672060674-bc2bd808a8b5?w=640', // Dubai skyline
      'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=640'  // Modern Dubai building
    ];
  }

  /**
   * Community/neighborhood stock photos
   */
  private async getStockCommunityPhotos(areaName: string): Promise<string[]> {
    // Map common Dubai areas to curated stock photos
    const areaPhotos: { [key: string]: string[] } = {
      'Dubai Marina': [
        'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=640',
        'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?w=640'
      ],
      'Downtown Dubai': [
        'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=640',
        'https://images.unsplash.com/photo-1590668991969-32ad5c896b8b?w=640'
      ],
      'Palm Jumeirah': [
        'https://images.unsplash.com/photo-1582672060674-bc2bd808a8b5?w=640',
        'https://images.unsplash.com/photo-1529260830199-42c24126f198?w=640'
      ],
      'Business Bay': [
        'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=640',
        'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=640'
      ]
    };

    // Try exact match first, then partial match
    let photos = areaPhotos[areaName];
    if (!photos) {
      for (const [area, urls] of Object.entries(areaPhotos)) {
        if (areaName.toLowerCase().includes(area.toLowerCase()) || 
            area.toLowerCase().includes(areaName.toLowerCase())) {
          photos = urls;
          break;
        }
      }
    }

    return photos || [
      'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=640' // Default Dubai
    ];
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
   * Generic Dubai fallback image
   */
  private getDubaiFallbackImage(): string {
    return 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=640&h=640&fit=crop';
  }

  /**
   * Get the best available image from the building image data
   */
  getBestBuildingImage(images: BuildingImageData): string {
    return images.placesPhotos?.[0] || 
           images.streetViewUrl || 
           images.stockPhotos?.[0] || 
           images.fallbackImage || 
           this.getDubaiFallbackImage();
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