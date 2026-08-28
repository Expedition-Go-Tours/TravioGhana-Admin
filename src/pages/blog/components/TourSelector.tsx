import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface TourSelectorProps {
  tours: { id: string; title: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function TourSelector({ tours, selectedIds, onChange }: TourSelectorProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => tours.filter((t) => t.title.toLowerCase().includes(search.toLowerCase())),
    [tours, search]
  );

  const toggle = (id: string) =>
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((t) => t !== id)
        : [...selectedIds, id]
    );

  return (
    <div className="space-y-3">
      <Label className="text-xs font-medium text-muted-foreground">Related Tours</Label>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tours..."
          className="pl-8 h-8 text-xs"
        />
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">
            {search ? "No matching tours" : "No tours available"}
          </p>
        ) : (
          filtered.map((tour) => (
            <Badge
              key={tour.id}
              variant={selectedIds.includes(tour.id) ? "default" : "outline"}
              className="cursor-pointer select-none transition-all hover:opacity-80"
              onClick={() => toggle(tour.id)}
            >
              {tour.title}
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}
