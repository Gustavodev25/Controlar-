export interface SyncProgress {
  step: string;
  current: number;
  total: number;
  startedAt?: number;
  isComplete?: boolean;
  error?: string;
  timestamp?: number;
}

export const SYNC_STORAGE_KEY = 'bank_sync_progress';
export const SYNC_PROGRESS_EVENT = 'bank-sync-progress';
export const SYNC_PROGRESS_CLEAR_EVENT = 'bank-sync-progress-clear';

// Returns true when the stored progress is still recent enough to show in the UI
export const isRecentSyncProgress = (progress: SyncProgress | null, maxAgeMs = 3 * 60 * 1000) => {
  // If no timestamp, assume it's stale (safer than assuming recent)
  if (!progress?.timestamp) return false;
  return Date.now() - progress.timestamp < maxAgeMs;
};

export const saveSyncProgress = (progress: SyncProgress) => {
  const payload: SyncProgress = {
    ...progress,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage errors (e.g., quota exceeded or unavailable)
  }

  window.dispatchEvent(new CustomEvent(SYNC_PROGRESS_EVENT, { detail: payload }));
  return payload;
};

export const clearSyncProgress = () => {
  try {
    localStorage.removeItem(SYNC_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
  window.dispatchEvent(new Event(SYNC_PROGRESS_CLEAR_EVENT));
};

export const readSyncProgress = (): SyncProgress | null => {
  try {
    const stored = localStorage.getItem(SYNC_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as SyncProgress;
  } catch {
    return null;
  }
};
