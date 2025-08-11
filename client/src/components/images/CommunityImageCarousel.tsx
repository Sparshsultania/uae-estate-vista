import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Mountain, Camera } from 'lucide-react';
import { CommunityImageData } from '@/services/imageService';

interface CommunityImageCarouselProps {
  images: CommunityImageData | null;
  isLoading: boolean;
  areaName?: string;
  className?: string;
}

export function CommunityImageCarousel({
  images,
  isLoading,
  areaName,
  className = ''
}: CommunityImageCarouselProps) {
  if (isLoading) {
    return (
      <div className={`space-y-2 ${className}`}>
        <Skeleton className="w-full h-32 rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="w-16 h-12 rounded" />
          <Skeleton className="w-16 h-12 rounded" />
          <Skeleton className="w-16 h-12 rounded" />
        </div>
      </div>
    );
  }

  if (!images) {
    return (
      <div className={`flex items-center justify-center h-32 bg-muted rounded-lg ${className}`}>
        <div className="text-center text-muted-foreground">
          <Mountain className="h-6 w-6 mx-auto mb-1" />
          <p className="text-xs">No community images</p>
        </div>
      </div>
    );
  }

  // Collect all available community images
  const allImages: Array<{ url: string; type: string; label: string }> = [];

  if (images.communityPhotos?.length) {
    images.communityPhotos.forEach((url, index) => 
      allImages.push({ url, type: 'community', label: `Community ${index + 1}` })
    );
  }

  if (images.landmarkPhotos?.length) {
    images.landmarkPhotos.forEach((url, index) => 
      allImages.push({ url, type: 'landmark', label: `Landmark ${index + 1}` })
    );
  }

  if (images.aerialView) {
    allImages.push({ url: images.aerialView, type: 'aerial', label: 'Aerial View' });
  }

  if (allImages.length === 0) {
    return (
      <div className={`flex items-center justify-center h-32 bg-muted rounded-lg ${className}`}>
        <div className="text-center text-muted-foreground">
          <Camera className="h-6 w-6 mx-auto mb-1" />
          <p className="text-xs">No images available</p>
        </div>
      </div>
    );
  }

  // Show main image with thumbnails
  const mainImage = allImages[0];

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Main Community Image */}
      <Card className="relative overflow-hidden">
        <CardContent className="p-0">
          <div className="relative">
            <img
              src={mainImage.url}
              alt={areaName || 'Community'}
              className="w-full h-32 object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                // No fallback images - hide if image fails to load
                target.style.display = 'none';
              }}
            />
            
            {/* Area Name Overlay */}
            {areaName && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <div className="flex items-center gap-2 text-white">
                  <MapPin className="h-3 w-3" />
                  <span className="text-sm font-medium">{areaName}</span>
                </div>
              </div>
            )}

            {/* Image Type Badge */}
            <Badge 
              variant="secondary" 
              className="absolute top-2 left-2 text-xs"
            >
              {mainImage.type === 'aerial' ? <Mountain className="h-3 w-3" /> : <Camera className="h-3 w-3" />}
              <span className="ml-1 capitalize">{mainImage.type}</span>
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Additional Images Thumbnails */}
      {allImages.length > 1 && (
        <div className="flex gap-1 overflow-x-auto">
          {allImages.slice(1, 4).map((image, index) => (
            <div 
              key={index} 
              className="flex-shrink-0 relative rounded overflow-hidden border"
            >
              <img
                src={image.url}
                alt={image.label}
                className="w-16 h-12 object-cover"
              />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                {image.type === 'aerial' ? (
                  <Mountain className="h-3 w-3 text-white" />
                ) : (
                  <Camera className="h-3 w-3 text-white" />
                )}
              </div>
            </div>
          ))}
          
          {allImages.length > 4 && (
            <div className="flex-shrink-0 w-16 h-12 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">
              +{allImages.length - 4}
            </div>
          )}
        </div>
      )}
    </div>
  );
}