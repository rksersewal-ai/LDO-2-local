import { useCallback, useMemo, useState } from "react";

/**
 * useSelection — shared multi-select state management for tables.
 * Eliminates duplicated selection logic across WorkLedger, DocumentHub, etc.
 *
 * @example
 * const { selected, toggle, toggleAll, clear, isSelected, isAllSelected, count } = useSelection(items);
 */
export function useSelection<T extends { id: string }>(items: T[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const select = useCallback((id: string) => {
    setSelected((prev) => new Set(prev).add(id));
  }, []);

  const deselect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(items.map((i) => i.id)));
  }, [items]);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === items.length && items.length > 0) {
        return new Set();
      }
      return new Set(items.map((i) => i.id));
    });
  }, [items]);

  const clear = useCallback(() => {
    setSelected(new Set());
  }, []);

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const isAllSelected = useMemo(
    () => items.length > 0 && selected.size === items.length,
    [items.length, selected.size],
  );

  const isPartiallySelected = useMemo(
    () => selected.size > 0 && selected.size < items.length,
    [items.length, selected.size],
  );

  const selectedItems = useMemo(() => items.filter((i) => selected.has(i.id)), [items, selected]);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  return {
    selected,
    selectedIds,
    selectedItems,
    count: selected.size,
    toggle,
    select,
    deselect,
    selectAll,
    toggleAll,
    clear,
    isSelected,
    isAllSelected,
    isPartiallySelected,
  };
}
