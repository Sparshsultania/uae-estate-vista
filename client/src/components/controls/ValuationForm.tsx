import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ValuationFormValues = {
  building: string;
  unitNumber: string;
  beds?: string;
  size: string;
  sizeUnit: 'sqft' | 'sqm';
};

type Props = {
  token?: string;
  onPlaceSelect?: (p: { center: [number, number]; bbox?: [number, number, number, number]; name: string; timestamp?: number }) => void;
  onCalculate?: (values: ValuationFormValues) => void;
};


const ValuationForm: React.FC<Props> = ({ token, onPlaceSelect, onCalculate }) => {
  const [building, setBuilding] = React.useState("");
  const [unitNumber, setUnitNumber] = React.useState<string>("");
  const [beds, setBeds] = React.useState<string | undefined>(undefined);
  const [size, setSize] = React.useState<string>("");
  const [sizeUnit, setSizeUnit] = React.useState<'sqft' | 'sqm'>("sqft");

  // Smart geocoding: flies to location when you finish typing (with better debouncing)
  React.useEffect(() => {
    const q = building.trim();
    const tk = token || localStorage.getItem('MAPBOX_PUBLIC_TOKEN') || '';
    if (!q || q.length < 4 || !tk) return; // Require at least 4 characters
    
    const t = setTimeout(async () => {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${tk}&autocomplete=true&limit=1&country=AE&types=place,locality,neighborhood,address,poi`;
        const res = await fetch(url);
        const data = await res.json();
        const f = Array.isArray(data?.features) && data.features[0];
        if (f && onPlaceSelect) {
          // Add timestamp to prevent re-triggering
          onPlaceSelect({ 
            center: f.center as [number, number], 
            bbox: f.bbox as any, 
            name: f.place_name as string,
            timestamp: Date.now()
          });
        }
      } catch (e) {
        console.warn('Geocoding failed', e);
      }
    }, 1500); // Longer delay - only trigger when user stops typing
    return () => clearTimeout(t);
  }, [building, token, onPlaceSelect]);

  const handleCalc = (e: React.FormEvent) => {
    e.preventDefault();
    onCalculate?.({ building, unitNumber, beds, size, sizeUnit });
  };

  return (
    <section className="w-full">
      <form onSubmit={handleCalc} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3">
        {/* Building / community */}
        <div className="md:col-span-4">
          <Input
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
            placeholder="Building or community name"
            aria-label="Building or community name"
          />
        </div>
        {/* Unit/Villa Number */}
        <div className="md:col-span-3">
          <Input
            value={unitNumber}
            onChange={(e) => setUnitNumber(e.target.value)}
            placeholder="Unit/Villa Number"
            aria-label="Unit or Villa Number"
          />
        </div>
        {/* Beds */}
        <div className="md:col-span-2">
          <Select value={beds} onValueChange={setBeds}>
            <SelectTrigger aria-label="Bedrooms">
              <SelectValue placeholder="Bedrooms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="studio">Studio</SelectItem>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="4">4</SelectItem>
              <SelectItem value="5+">5+</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Size + unit */}
        <div className="md:col-span-3 flex gap-2">
          <Input
            type="number"
            inputMode="decimal"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="Size"
            aria-label="Size"
          />
          <Select value={sizeUnit} onValueChange={(v) => setSizeUnit(v as any)}>
            <SelectTrigger className="w-[110px]" aria-label="Size unit">
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sqft">sqft</SelectItem>
              <SelectItem value="sqm">sqm</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Action */}
        <div className="md:col-span-12 md:flex md:justify-end">
          <Button type="submit" size="lg" className="w-full md:w-auto">Calculate</Button>
        </div>
      </form>
    </section>
  );
};

export default ValuationForm;
