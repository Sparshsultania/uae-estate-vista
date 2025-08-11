import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, MapPin, Camera, Satellite, Building2, ExternalLink } from 'lucide-react';
import { BuildingImageData } from '@/services/imageService';

interface BuildingImageGalleryProps {
  images: BuildingImageData | null;
  isLoading: boolean;
  buildingName?: string;
  address?: string;
  className?: string;
}

export function BuildingImageGallery({
  images,
  isLoading,
  buildingName,
  address,
  className = ''
}: BuildingImageGalleryProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className={`space-y-3 ${className}`}>
        <Skeleton className="w-full h-48 rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="w-20 h-16 rounded" />
          <Skeleton className="w-20 h-16 rounded" />
          <Skeleton className="w-20 h-16 rounded" />
        </div>
      </div>
    );
  }

  if (!images) {
    return (
      <div className={`flex items-center justify-center h-48 bg-muted rounded-lg ${className}`}>
        <div className="text-center text-muted-foreground">
          <Camera className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">No images available</p>
        </div>
      </div>
    );
  }

  // Collect all available images with metadata
  const allImages: Array<{ url: string; type: string; icon: React.ReactNode; label: string }> = [];

  if (images.placesPhotos?.length) {
    images.placesPhotos.forEach((url, index) => 
      allImages.push({ 
        url, 
        type: 'places', 
        icon: <Building2 className="h-3 w-3" />, 
        label: `Interior ${index + 1}` 
      })
    );
  }

  if (images.streetViewUrl) {
    allImages.push({ 
      url: images.streetViewUrl, 
      type: 'streetview', 
      icon: <Camera className="h-3 w-3" />, 
      label: 'Street View' 
    });
  }

  if (images.satelliteUrl) {
    allImages.push({ 
      url: images.satelliteUrl, 
      type: 'satellite', 
      icon: <Satellite className="h-3 w-3" />, 
      label: 'Satellite' 
    });
  }

  if (images.stockPhotos?.length) {
    images.stockPhotos.forEach((url, index) => 
      allImages.push({ 
        url, 
        type: 'stock', 
        icon: <Building2 className="h-3 w-3" />, 
        label: `Reference ${index + 1}` 
      })
    );
  }

  if (images.fallbackImage && allImages.length === 0) {
    allImages.push({ 
      url: images.fallbackImage, 
      type: 'fallback', 
      icon: <Building2 className="h-3 w-3" />, 
      label: 'Dubai Property' 
    });
  }

  if (allImages.length === 0) {
    return (
      <div className={`flex items-center justify-center h-48 bg-muted rounded-lg ${className}`}>
        <div className="text-center text-muted-foreground">
          <Camera className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">No images available</p>
        </div>
      </div>
    );
  }

  const currentImage = allImages[selectedImageIndex];

  const nextImage = () => {
    setSelectedImageIndex((prev) => (prev + 1) % allImages.length);
  };

  const prevImage = () => {
    setSelectedImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Main Image Display */}
      <Card className="relative overflow-hidden">
        <CardContent className="p-0">
          <div className="relative group">
            <img
              src={currentImage.url}
              alt={buildingName || 'Building'}
              className="w-full h-48 object-cover transition-transform duration-200 group-hover:scale-105"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                
                // If it's a Google API image that failed, show a helpful message
                if (currentImage.url.includes('/api/images/')) {
                  console.log(`Google ${currentImage.type} API not available - showing fallback`);
                }
                
                // Fallback to next image if current fails to load
                if (selectedImageIndex < allImages.length - 1) {
                  setSelectedImageIndex(prev => prev + 1);
                } else {
                  target.src = 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=640&h=480&fit=crop';
                }
              }}
            />
            
            {/* Image Type Badge */}
            <Badge 
              variant="secondary" 
              className="absolute top-2 left-2 text-xs"
            >
              {currentImage.icon}
              <span className="ml-1">{currentImage.label}</span>
            </Badge>

            {/* Navigation Arrows */}
            {allImages.length > 1 && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white"
                  onClick={prevImage}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white"
                  onClick={nextImage}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}

            {/* Expand Button */}
            <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-2 right-2 bg-black/20 hover:bg-black/40 text-white"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {currentImage.icon}
                    {currentImage.label} - {buildingName || address || 'Property'}
                  </DialogTitle>
                </DialogHeader>
                <img
                  src={currentImage.url}
                  alt={buildingName || 'Building'}
                  className="w-full max-h-[70vh] object-contain rounded-lg"
                />
              </DialogContent>
            </Dialog>

            {/* Image Counter */}
            {allImages.length > 1 && (
              <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                {selectedImageIndex + 1} / {allImages.length}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Thumbnail Strip */}
      {allImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {allImages.map((image, index) => (
            <button
              key={index}
              onClick={() => setSelectedImageIndex(index)}
              className={`flex-shrink-0 relative rounded overflow-hidden border-2 transition-all duration-200 ${
                selectedImageIndex === index 
                  ? 'border-primary scale-105' 
                  : 'border-transparent hover:border-muted-foreground'
              }`}
            >
              <img
                src={image.url}
                alt={image.label}
                className="w-20 h-16 object-cover"
              />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                {image.icon}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Location Info */}
      {(buildingName || address) && (
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            {buildingName && <div className="font-medium text-foreground">{buildingName}</div>}
            {address && <div>{address}</div>}
          </div>
        </div>
      )}
    </div>
  );
}