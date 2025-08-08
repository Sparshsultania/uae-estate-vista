import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import type { PropertyPoint } from "@/data/mockProperties";

type Props = {
  items: PropertyPoint[];
  onSelect: (p: PropertyPoint) => void;
};

const SearchBar: React.FC<Props> = ({ items, onSelect }) => {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => {
    if (!q.trim()) return [] as PropertyPoint[];
    const qq = q.toLowerCase();
    return items.filter((i) =>
      i.name.toLowerCase().includes(qq) || i.community.toLowerCase().includes(qq)
    ).slice(0, 6);
  }, [q, items]);

  const select = (p: PropertyPoint) => {
    onSelect(p);
    setQ(p.name);
    setFocused(false);
  };

  return (
    <div className="relative w-full max-w-xl">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search property or location (e.g., Marina, JVC, Downtown)..."
            className="pl-9"
          />
        </div>
        <Button variant="default" onClick={() => results[0] && select(results[0])}>
          Explore
        </Button>
      </div>

      {focused && results.length > 0 && (
        <div className="absolute z-20 mt-2 w-full rounded-lg border bg-card p-2 shadow-xl animate-scale-in">
          {results.map((r) => (
            <button
              key={r.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(r)}
              className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground hover-rise"
            >
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: r.pricePerSqft <= 1400 ? 'hsl(182,65%,45%)' : r.pricePerSqft <= 2400 ? 'hsl(152,53%,41%)' : 'hsl(43,95%,55%)' }} />
              <div className="flex-1">
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.community} • AED {r.pricePerSqft}/sqft • {r.rentYield}% yield</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
