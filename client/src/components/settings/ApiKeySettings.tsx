import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Settings, Key, Camera, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { useImageApiKeys } from '@/hooks/useBuildingImages';

export function ApiKeySettings() {
  const { googleApiKey, hasGoogleApiKey, updateGoogleApiKey, clearGoogleApiKey } = useImageApiKeys();
  const [isOpen, setIsOpen] = useState(false);
  const [tempKey, setTempKey] = useState('');

  const handleSave = () => {
    if (tempKey.trim()) {
      updateGoogleApiKey(tempKey.trim());
      setTempKey('');
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    clearGoogleApiKey();
    setTempKey('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Image APIs
          {hasGoogleApiKey && <Badge variant="secondary" className="ml-2">Configured</Badge>}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Building Image APIs Configuration
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Current Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Current Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Google Maps API</span>
                </div>
                {hasGoogleApiKey ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Configured
                    </Badge>
                    <Button variant="outline" size="sm" onClick={handleClear}>
                      Clear
                    </Button>
                  </div>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    Not configured
                  </Badge>
                )}
              </div>
              
              {hasGoogleApiKey && (
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  Key: ••••••••{googleApiKey?.slice(-4)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Google Maps API Configuration */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Google Maps API Key</CardTitle>
              <p className="text-xs text-muted-foreground">
                Enables Street View, satellite images, and places photos for buildings
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="google-api-key">API Key</Label>
                <Input
                  id="google-api-key"
                  type="password"
                  placeholder="Enter your Google Maps API key"
                  value={tempKey}
                  onChange={(e) => setTempKey(e.target.value)}
                />
                <div className="text-xs text-muted-foreground">
                  Required APIs: Maps Static API, Places API, Street View Static API
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={!tempKey.trim()}>
                  Save Key
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.open('https://console.cloud.google.com/apis/credentials', '_blank')}
                  className="gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Get API Key
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Features Overview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Available Image Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-green-600" />
                  <span>Google Street View</span>
                  <Badge variant={hasGoogleApiKey ? "default" : "secondary"} className="text-xs">
                    {hasGoogleApiKey ? "Active" : "Needs key"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-blue-600" />
                  <span>Satellite Images</span>
                  <Badge variant={hasGoogleApiKey ? "default" : "secondary"} className="text-xs">
                    {hasGoogleApiKey ? "Active" : "Needs key"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-purple-600" />
                  <span>Places Photos</span>
                  <Badge variant={hasGoogleApiKey ? "default" : "secondary"} className="text-xs">
                    {hasGoogleApiKey ? "Active" : "Needs key"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-orange-600" />
                  <span>Stock Photos</span>
                  <Badge variant="default" className="text-xs">Always Active</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Instructions:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Go to Google Cloud Console and create a new project</li>
              <li>Enable: Maps Static API, Places API, Street View Static API</li>
              <li>Create credentials (API key) and copy it here</li>
              <li>Click buildings on the map to see real photos!</li>
            </ol>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}