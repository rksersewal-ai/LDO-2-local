import { useCallback, useEffect, useRef, useState } from "react";

const AUTOSAVE_DELAY_MS = 2000;

interface UseFormDraftOptions<T> {
  /** localStorage key for persistence */
  storageKey: string;
  /** Initial form values */
  initialValues: T;
  /** Autosave interval — defaults to 2000ms. Set 0 to disable. */
  autosaveDelay?: number;
}

interface FormDraftState<T> {
  draft: T;
  isDirty: boolean;
  lastSaved: Date | null;
  isSaving: boolean;
}

/**
 * useFormDraft — manages draft vs. saved state with optional localStorage persistence.
 * Provides clear draft/saved boundary and auto-save capability.
 *
 * @example
 * const { draft, setField, resetDraft, commitDraft, isDirty } = useFormDraft({
 *   storageKey: 'edit-pl-draft',
 *   initialValues: { title: '', status: 'active' },
 * });
 */
export function useFormDraft<T extends Record<string, unknown>>({
  storageKey,
  initialValues,
  autosaveDelay = AUTOSAVE_DELAY_MS,
}: UseFormDraftOptions<T>) {
  const loadSaved = (): T => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return { ...initialValues, ...JSON.parse(raw) } as T;
    } catch {
      // ignore malformed storage
    }
    return initialValues;
  };

  const [state, setState] = useState<FormDraftState<T>>({
    draft: loadSaved(),
    isDirty: false,
    lastSaved: null,
    isSaving: false,
  });

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save to localStorage on draft change
  useEffect(() => {
    if (!state.isDirty || autosaveDelay === 0) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = setTimeout(() => {
      setState((s) => ({ ...s, isSaving: true }));
      try {
        localStorage.setItem(storageKey, JSON.stringify(state.draft));
        setState((s) => ({ ...s, isSaving: false, lastSaved: new Date() }));
      } catch {
        setState((s) => ({ ...s, isSaving: false }));
      }
    }, autosaveDelay);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [state.draft, state.isDirty, storageKey, autosaveDelay]);

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setState((s) => ({
      ...s,
      draft: { ...s.draft, [key]: value },
      isDirty: true,
    }));
  }, []);

  const setDraft = useCallback((values: Partial<T>) => {
    setState((s) => ({
      ...s,
      draft: { ...s.draft, ...values },
      isDirty: true,
    }));
  }, []);

  const resetDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    setState({
      draft: initialValues,
      isDirty: false,
      lastSaved: null,
      isSaving: false,
    });
  }, [storageKey, initialValues]);

  /** Call after successful submit to clear dirty state */
  const commitDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    setState((s) => ({ ...s, isDirty: false, lastSaved: new Date() }));
  }, [storageKey]);

  return {
    draft: state.draft,
    isDirty: state.isDirty,
    lastSaved: state.lastSaved,
    isSaving: state.isSaving,
    setField,
    setDraft,
    resetDraft,
    commitDraft,
  };
}
