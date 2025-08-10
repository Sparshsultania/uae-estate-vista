import React from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

export type AmenityCategory =
  | "food_drink"
  | "groceries"
  | "atm_bank"
  | "pharmacy_hospital"
  | "school_university"
  | "gym_sports"
  | "shopping_mall"
  | "public_transport";

const CATEGORY_LABEL: Record<AmenityCategory, string> = {
  food_drink: "Food & Cafes",
  groceries: "Groceries",
  atm_bank: "ATMs & Banks",
  pharmacy_hospital: "Pharmacy & Hospital",
  school_university: "Schools & Universities",
  gym_sports: "Gyms & Sports",
  shopping_mall: "Shopping Malls",
  public_transport: "Public Transport",
};

export const ALL_AMENITY_CATEGORIES = Object.keys(CATEGORY_LABEL) as AmenityCategory[];

type Props = {
  selected: AmenityCategory[];
  onChange: (next: AmenityCategory[]) => void;
  radius: number;
  onRadius: (r: number) => void;
  alongRoute?: boolean; // optional; when undefined, hide control
  onAlongRoute?: (v: boolean) => void;
  inline?: boolean; // when true, render as panel (not absolute overlay)
};

const AmenityFilters: React.FC<Props> = ({ selected, onChange, radius, onRadius, alongRoute, onAlongRoute, inline }) => {
  const toggle = (c: AmenityCategory) => {
    const set = new Set(selected);
    if (set.has(c)) set.delete(c); else set.add(c);
    onChange(Array.from(set));
  };
  const selectAll = () => onChange(ALL_AMENITY_CATEGORIES);
  const clearAll = () => onChange([]);

  const containerClass = inline
    ? "rounded-lg border p-3 mb-4 animate-enter"
    : "absolute left-4 top-4 z-30 w-[320px] max-w-[92vw] glass-panel rounded-lg p-3 animate-enter";

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Amenities</div>
        <div className="flex gap-1">
          <Button size="sm" variant="secondary" onClick={selectAll}>All</Button>
          <Button size="sm" variant="ghost" onClick={clearAll}>Clear</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {ALL_AMENITY_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => toggle(c)}
            className={`text-left rounded-md border px-2 py-1.5 text-xs hover-scale ${selected.includes(c) ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
            aria-pressed={selected.includes(c)}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1 text-xs text-muted-foreground">
          <span>Radius</span>
          <span><Badge variant="secondary">{Math.round(radius)} m</Badge></span>
        </div>
        <Slider value={[radius]} onValueChange={(v) => onRadius(v[0])} min={200} max={5000} step={100} />
      </div>
      {typeof alongRoute === 'boolean' && onAlongRoute && (
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">Search along route</div>
          <Button size="sm" variant={alongRoute ? 'default' : 'secondary'} onClick={() => onAlongRoute(!alongRoute)}>
            {alongRoute ? 'On' : 'Off'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default AmenityFilters;
