import { AlertTriangle, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ApiSetupNoticeProps {
  apiName: string;
  className?: string;
}

export function ApiSetupNotice({ apiName, className }: ApiSetupNoticeProps) {
  const handleSetupClick = () => {
    window.open('https://console.cloud.google.com/apis/library', '_blank');
  };

  return (
    <Alert className={`border-amber-200 bg-amber-50 ${className}`}>
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800">Google API Setup Required</AlertTitle>
      <AlertDescription className="text-amber-700 space-y-2">
        <p>To see real {apiName.toLowerCase()} images, please enable the <strong>{apiName}</strong> in your Google Cloud Console.</p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleSetupClick}
          className="mt-2 border-amber-300 text-amber-800 hover:bg-amber-100"
        >
          Open Google Cloud Console <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}