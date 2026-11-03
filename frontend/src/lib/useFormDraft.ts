"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface FormDraftOptions<T> {
  key: string;
  data: T;
  onRestore: (draftData: T, savedAt: Date) => void;
  isDirty?: boolean;
  enabled?: boolean;
  debounceMs?: number;
}

export function useFormDraft<T>({
  key,
  data,
  onRestore,
  isDirty = false,
  enabled = true,
  debounceMs = 600,
}: FormDraftOptions<T>) {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const initialCheckDone = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Check for existing draft on mount
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || initialCheckDone.current) return;
    initialCheckDone.current = true;

    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.data) {
          const savedAt = parsed.savedAt ? new Date(parsed.savedAt) : new Date();
          setHasDraft(true);
          setDraftSavedAt(savedAt);
          onRestore(parsed.data, savedAt);
          setDraftRestored(true);
        }
      }
    } catch (e) {
      console.warn("Failed to read draft from localStorage:", e);
    }
  }, [key, enabled, onRestore]);

  // 2. Auto-save to localStorage when data changes and is dirty
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!isDirty) return;

    timeoutRef.current = setTimeout(() => {
      try {
        // Strip out large binary blobs if any to protect localStorage quota
        const cleanPayload = JSON.stringify({
          data,
          savedAt: new Date().toISOString(),
        });
        localStorage.setItem(key, cleanPayload);
        setHasDraft(true);
        setDraftSavedAt(new Date());
      } catch (err) {
        console.warn("Failed to save draft to localStorage:", err);
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [key, data, isDirty, enabled, debounceMs]);

  // 3. Browser beforeunload listener when form is dirty
  useEffect(() => {
    if (!enabled || !isDirty || typeof window === "undefined") return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enabled, isDirty]);

  // 4. Clear draft (used after successful form submission or manual discard)
  const clearDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(key);
      setHasDraft(false);
      setDraftSavedAt(null);
      setDraftRestored(false);
    } catch {}
  }, [key]);

  return {
    hasDraft,
    draftSavedAt,
    draftRestored,
    dismissDraftBanner: () => setDraftRestored(false),
    clearDraft,
  };
}

