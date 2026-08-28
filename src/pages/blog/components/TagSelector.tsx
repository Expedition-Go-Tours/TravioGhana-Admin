import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface TagSelectorProps {
  tags: { id: string; name: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function TagSelector({ tags, selectedIds, onChange }: TagSelectorProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => tags.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())),
    [tags, search]
  );

  const toggle = (id: string) =>
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((t) => t !== id)
        : [...selectedIds, id]
    );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tags..."
          className="pl-8 h-8 text-xs"
        />
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">
            {search ? "No matching tags" : "No tags available"}
          </p>
        ) : (
          filtered.map((tag) => (
            <Badge
              key={tag.id}
              variant={selectedIds.includes(tag.id) ? "default" : "outline"}
              className="cursor-pointer select-none transition-all hover:opacity-80"
              onClick={() => toggle(tag.id)}
            >
              {tag.name}
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}
