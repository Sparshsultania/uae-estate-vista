import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type IdentifierPayload = {
  type: 'unit' | 'dewa' | 'oqoo' | 'title-deed';
  value: string;
};

type Props = {
  onSubmit: (payload: IdentifierPayload) => void;
};

const IdentifierBar: React.FC<Props> = ({ onSubmit }) => {
  const [type, setType] = useState<IdentifierPayload['type']>('unit');
  const [value, setValue] = useState("");

  const placeholder = useMemo(() => {
    switch (type) {
      case 'unit': return 'Enter Unit No. (e.g., 1503, A-1701)';
      case 'dewa': return 'Enter DEWA No.';
      case 'oqoo': return 'Enter OQOO/OQOOD No.';
      case 'title-deed': return 'Enter Title Deed No.';
      default: return 'Enter identifier...';
    }
  }, [type]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!value.trim()) return;
    onSubmit({ type, value: value.trim() });
  };

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as IdentifierPayload['type'])}
          className="px-3 py-2 text-sm rounded-md border bg-background"
          aria-label="Identifier type"
        >
          <option value="unit">Unit No</option>
          <option value="dewa">DEWA</option>
          <option value="oqoo">OQOO</option>
          <option value="title-deed">Title Deed</option>
        </select>
        <div className="flex-1 min-w-[220px]">
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
        </div>
        <Button type="submit" variant="default">Check</Button>
      </div>
    </form>
  );
};

export default IdentifierBar;
