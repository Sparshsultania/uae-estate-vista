import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Building image routes using Google Maps APIs
  
  // Street View images
  app.get("/api/images/streetview", async (req, res) => {
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

      const response = await fetch(streetViewUrl);
      
      if (!response.ok) {
        return res.status(response.status).json({ error: 'Street View image not available' });
      }

      res.set('Content-Type', 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=86400');
      
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));

    } catch (error) {
      console.error('Street View image error:', error);
      res.status(500).json({ error: 'Failed to fetch Street View image' });
    }
  });

  // Satellite images  
  app.get("/api/images/satellite", async (req, res) => {
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
      res.set('Cache-Control', 'public, max-age=86400');
      
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));

    } catch (error) {
      console.error('Satellite image error:', error);
      res.status(500).json({ error: 'Failed to fetch satellite image' });
    }
  });

  // Comprehensive building images endpoint
  app.post("/api/images/building", async (req, res) => {
    try {
      const { coordinates, buildingName, address } = req.body;
      const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;

      if (!coordinates || coordinates.length !== 2) {
        return res.status(400).json({ error: 'Valid coordinates [lng, lat] are required' });
      }

      const [lng, lat] = coordinates;
      const images: any = {};

      if (googleApiKey) {
        images.streetViewUrl = `/api/images/streetview?lat=${lat}&lng=${lng}`;
        images.satelliteUrl = `/api/images/satellite?lat=${lat}&lng=${lng}`;
      }

      // Add curated Dubai stock photos as fallback
      images.stockPhotos = [
        'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=640',
        'https://images.unsplash.com/photo-1582672060674-bc2bd808a8b5?w=640', 
        'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=640'
      ];

      images.fallbackImage = 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=640&h=640&fit=crop';

      res.json(images);

    } catch (error) {
      console.error('Building images error:', error);
      res.status(500).json({ error: 'Failed to fetch building images' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
