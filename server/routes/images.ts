import { Request, Response } from 'express';

interface BuildingImageRequest {
  coordinates: [number, number];
  buildingName?: string;
  address?: string;
}

interface ImageProxyRequest {
  url: string;
  type: 'streetview' | 'satellite' | 'places';
}

/**
 * Get Google Street View image for a location
 */
export async function getStreetViewImage(req: Request, res: Response) {
  try {
    const { lat, lng, heading = 0 } = req.query;
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!googleApiKey) {
      return res.status(400).json({ error: 'Google Maps API key not configured' });
    }

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?` +
      `size=640x640&location=${lat},${lng}&heading=${heading}&pitch=0&fov=90&key=${googleApiKey}`;

    // Fetch the image and pipe it to the response
    const response = await fetch(streetViewUrl);
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Street View image not available' });
    }

    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));

  } catch (error) {
    console.error('Street View image error:', error);
    res.status(500).json({ error: 'Failed to fetch Street View image' });
  }
}

/**
 * Get Google Satellite image for a location
 */
export async function getSatelliteImage(req: Request, res: Response) {
  try {
    const { lat, lng, zoom = 18 } = req.query;
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!googleApiKey) {
      return res.status(400).json({ error: 'Google Maps API key not configured' });
    }

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const satelliteUrl = `https://maps.googleapis.com/maps/api/staticmap?` +
      `center=${lat},${lng}&zoom=${zoom}&size=640x640&maptype=satellite&key=${googleApiKey}`;

    const response = await fetch(satelliteUrl);
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Satellite image not available' });
    }

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));

  } catch (error) {
    console.error('Satellite image error:', error);
    res.status(500).json({ error: 'Failed to fetch satellite image' });
  }
}

/**
 * Get Google Places photos for a location
 */
export async function getPlacesPhotos(req: Request, res: Response) {
  try {
    const { lat, lng, query } = req.query;
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!googleApiKey) {
      return res.status(400).json({ error: 'Google Maps API key not configured' });
    }

    if (!lat || !lng || !query) {
      return res.status(400).json({ error: 'Latitude, longitude, and search query are required' });
    }

    // First, search for the place
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?` +
      `query=${encodeURIComponent(query as string)}&location=${lat},${lng}&radius=100&key=${googleApiKey}`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (!searchData.results || searchData.results.length === 0) {
      return res.json({ photos: [] });
    }

    const placeId = searchData.results[0].place_id;

    // Get place details with photos
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?` +
      `place_id=${placeId}&fields=photos&key=${googleApiKey}`;
    
    const detailsResponse = await fetch(detailsUrl);
    const detailsData = await detailsResponse.json();

    if (!detailsData.result?.photos) {
      return res.json({ photos: [] });
    }

    // Convert photo references to URLs
    const photoUrls = detailsData.result.photos.slice(0, 3).map((photo: any) => 
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=640&photoreference=${photo.photo_reference}&key=${googleApiKey}`
    );

    res.json({ photos: photoUrls });

  } catch (error) {
    console.error('Places photos error:', error);
    res.status(500).json({ error: 'Failed to fetch Places photos' });
  }
}

/**
 * Comprehensive building images endpoint
 */
export async function getBuildingImages(req: Request, res: Response) {
  try {
    const { coordinates, buildingName, address } = req.body as BuildingImageRequest;
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!coordinates || coordinates.length !== 2) {
      return res.status(400).json({ error: 'Valid coordinates [lng, lat] are required' });
    }

    const [lng, lat] = coordinates;
    const images: any = {};

    if (googleApiKey) {
      // Generate image URLs that will be served through our proxy endpoints
      images.streetViewUrl = `/api/images/streetview?lat=${lat}&lng=${lng}`;
      images.satelliteUrl = `/api/images/satellite?lat=${lat}&lng=${lng}`;

      // Get Places photos if building name or address provided
      if (buildingName || address) {
        const query = buildingName || address;
        try {
          const placesResponse = await fetch(
            `http://localhost:5000/api/images/places-photos?lat=${lat}&lng=${lng}&query=${encodeURIComponent((query as string) || '')}`
          );
          const placesData = await placesResponse.json();
          if (placesData.photos && placesData.photos.length > 0) {
            images.placesPhotos = placesData.photos;
          }
        } catch (error) {
          console.log('Places photos not available:', error);
        }
      }
    }

    // No stock photos - only authentic Google Street View images

    res.json(images);

  } catch (error) {
    console.error('Building images error:', error);
    res.status(500).json({ error: 'Failed to fetch building images' });
  }
}