import React, { useCallback, useEffect, useRef, useState } from "react";
import { SyncProgressToast } from "./SyncProgressToast";
import {
  SyncProgress,
  SYNC_PROGRESS_CLEAR_EVENT,
  SYNC_PROGRESS_EVENT,
  SYNC_STORAGE_KEY,
  clearSyncProgress,
  isRecentSyncProgress,
  readSyncProgress,
  saveSyncProgress,
} from "../utils/syncProgress";

const AUTO_DISMISS_MS = 5000;
const INTERRUPT_AFTER_MS = 90000;
const normalizeProgressError = (progress: SyncProgress | null) => {
  if (progress?.error === 'Sync was interrupted') {
    return { ...progress, error: 'Sincronizacao interrompida. Tente novamente.' };
  }
  return progress;
};

export const GlobalSyncToast: React.FC = () => {
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const dismissTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only resets local React state. Does NOT dispatch global clear event.
  const resetLocalState = useCallback(() => {
    if (dismissTimeout.current) {
      clearTimeout(dismissTimeout.current);
      dismissTimeout.current = null;
    }
    setProgress(null);
  }, []);

  // Resets local state AND dispatches global clear event (clears storage).
  // Use this for user actions (click X) or auto-dismiss timers.
  const handleDismiss = useCallback(() => {
    resetLocalState();
    clearSyncProgress();
  }, [resetLocalState]);

  const handleProgress = useCallback(
    (incoming: SyncProgress | null) => {
      const normalized = normalizeProgressError(incoming);
      
      // If null/invalid, ensure we are clean locally. 
      // We avoid handleDismiss() here to prevent potential loops if this was triggered by a clear event.
      if (!normalized) {
        resetLocalState();
        return;
      }

      const isRecent = isRecentSyncProgress(normalized);
      if (!isRecent) {
        // If it's stale data from storage, we should probably clean it up globally once.
        // But to be safe against loops, let's just reset locally. 
        // The storage event loop is protected by browser not firing storage event on same window,
        // but let's stick to resetLocalState to be safe.
        resetLocalState();
        return;
      }

      setProgress(normalized);
      if (normalized !== incoming) {
        saveSyncProgress(normalized);
      }
    },
    [resetLocalState]
  );

  useEffect(() => {
    const initial = readSyncProgress();
    if (initial) {
      if (isRecentSyncProgress(initial)) {
        setProgress(initial);
      } else {
        clearSyncProgress(); // Clean up stale initial data
      }
    }

    const onProgress = (event: Event) => {
      handleProgress((event as CustomEvent<SyncProgress>).detail || null);
    };

    // When global clear happens, we only need to update local state.
    // DO NOT call handleDismiss() here, or it will loop.
    const onClear = () => resetLocalState();

    const onStorage = (event: StorageEvent) => {
      if (event.key === SYNC_STORAGE_KEY) {
        const stored = readSyncProgress();
        handleProgress(stored);
      }
    };

    window.addEventListener(SYNC_PROGRESS_EVENT, onProgress as EventListener);
    window.addEventListener(SYNC_PROGRESS_CLEAR_EVENT, onClear);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(SYNC_PROGRESS_EVENT, onProgress as EventListener);
      window.removeEventListener(SYNC_PROGRESS_CLEAR_EVENT, onClear);
      window.removeEventListener("storage", onStorage);
    };
  }, [resetLocalState, handleProgress]);

  useEffect(() => {
    if (!progress || (!progress.isComplete && !progress.error)) return;

    if (dismissTimeout.current) clearTimeout(dismissTimeout.current);
    dismissTimeout.current = setTimeout(() => handleDismiss(), AUTO_DISMISS_MS);

    return () => {
      if (dismissTimeout.current) clearTimeout(dismissTimeout.current);
    };
  }, [progress, handleDismiss]);

  useEffect(() => {
    if (!progress || progress.isComplete || progress.error) return;

    const timer = setTimeout(() => {
      const interrupted: SyncProgress = {
        ...progress,
        error: 'Sincronizacao interrompida. Tente novamente.',
        timestamp: Date.now(),
      };
      setProgress(interrupted);
      saveSyncProgress(interrupted);
    }, INTERRUPT_AFTER_MS);

    return () => clearTimeout(timer);
  }, [progress]);

  if (!progress || (!progress.step && !progress.error)) return null;

  return <SyncProgressToast progress={progress} onDismiss={handleDismiss} />;
};
