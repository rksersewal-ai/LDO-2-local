import { Bookmark, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type SavedFilter,
  SavedFiltersService,
} from "../../services/SavedFiltersService";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Button } from "./Shared";

interface SavedFiltersDropdownProps {
  currentFilters: SavedFilter["filters"];
  onApply: (filters: SavedFilter["filters"]) => void;
}

/**
 * SavedFiltersDropdown - A dropdown button showing saved filter presets.
 * Has a "Save current" option at top and lists existing saved filters with delete buttons.
 */
export function SavedFiltersDropdown({ currentFilters, onApply }: SavedFiltersDropdownProps) {
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);

  useEffect(() => {
    setSavedFilters(SavedFiltersService.getAll());
  }, []);

  const handleSaveCurrent = () => {
    const name = `Filter ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    SavedFiltersService.save(name, currentFilters);
    setSavedFilters(SavedFiltersService.getAll());
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    SavedFiltersService.delete(id);
    setSavedFilters(SavedFiltersService.getAll());
  };

  const handleApply = (id: string) => {
    const filters = SavedFiltersService.apply(id);
    if (filters) {
      onApply(filters);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm">
          <Bookmark className="w-3.5 h-3.5" /> Saved Filters
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleSaveCurrent}>
          <Plus className="w-3.5 h-3.5 mr-2" />
          Save current filters
        </DropdownMenuItem>
        {savedFilters.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px]">Saved Presets</DropdownMenuLabel>
            {savedFilters.map((filter) => (
              <DropdownMenuItem
                key={filter.id}
                onClick={() => handleApply(filter.id)}
                className="flex items-center justify-between"
              >
                <span className="truncate text-xs">{filter.name}</span>
                <button
                  type="button"
                  onClick={(e) => handleDelete(filter.id, e)}
                  className="ml-2 text-muted-foreground hover:text-rose-400 transition-colors shrink-0"
                  aria-label={`Delete filter "${filter.name}"`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </DropdownMenuItem>
            ))}
          </>
        )}
        {savedFilters.length === 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-3 text-center">
              <p className="text-[10px] text-muted-foreground">No saved filters yet</p>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
