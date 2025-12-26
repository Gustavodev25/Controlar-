import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Clock, CheckCircle, AlertCircle, Loader2, Ban } from './Icons';

interface ItemStatus {
  id: string;
  connectorName: string;
  connectorImageUrl: string | null;
  status: string;
  lastUpdatedAt: string | null;
}

interface SyncStatus {
  state: 'idle' | 'pending' | 'in_progress' | 'success' | 'error';
  message: string;
  details?: string;
  lastUpdated: string;
  lastSyncedAt?: string;
}

interface SyncStatusPanelProps {
  userId: string | null;
  onSyncComplete?: () => void;
  compact?: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const AUTO_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MANUAL_SYNC_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

const formatTimeRemaining = (ms: number): string => {
  if (ms <= 0) return '0min';

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  if (minutes > 0) {
    return `${minutes}min ${seconds}s`;
  }
  return `${seconds}s`;
};

export const SyncStatusPanel: React.FC<SyncStatusPanelProps> = ({
  userId,
  onSyncComplete,
  compact = false
}) => {
  const [items, setItems] = useState<ItemStatus[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Timer states
  const [nextAutoSyncMs, setNextAutoSyncMs] = useState<number>(0);
  const [manualCooldownMs, setManualCooldownMs] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Calculate time remaining based on lastUpdatedAt
  const calculateTimers = useCallback((itemsList: ItemStatus[], dbSyncStatus: SyncStatus | null) => {
    // Find the most recent lastUpdatedAt from all items
    let mostRecentUpdate: Date | null = null;

    itemsList.forEach(item => {
      if (item.lastUpdatedAt) {
        const itemDate = new Date(item.lastUpdatedAt);
        if (!mostRecentUpdate || itemDate > mostRecentUpdate) {
          mostRecentUpdate = itemDate;
        }
      }
    });

    // Also check dbSyncStatus.lastSyncedAt
    if (dbSyncStatus?.lastSyncedAt) {
      const dbDate = new Date(dbSyncStatus.lastSyncedAt);
      if (!mostRecentUpdate || dbDate > mostRecentUpdate) {
        mostRecentUpdate = dbDate;
      }
    }

    const now = Date.now();

    if (mostRecentUpdate) {
      const lastUpdateTime = mostRecentUpdate.getTime();

      // Calculate next auto sync (24h from last update)
      const nextAutoSync = lastUpdateTime + AUTO_SYNC_INTERVAL_MS;
      setNextAutoSyncMs(Math.max(0, nextAutoSync - now));

      // Calculate manual sync cooldown (30 min from last update)
      const manualUnlock = lastUpdateTime + MANUAL_SYNC_COOLDOWN_MS;
      setManualCooldownMs(Math.max(0, manualUnlock - now));
    } else {
      // No previous sync - allow immediate sync
      setNextAutoSyncMs(AUTO_SYNC_INTERVAL_MS);
      setManualCooldownMs(0);
    }
  }, []);

  // Fetch sync status from backend
  const fetchSyncStatus = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await fetch(`${API_BASE}/pluggy/items-status?userId=${userId}`);
      const data = await response.json();

      if (data.success) {
        setItems(data.items || []);
        setSyncStatus(data.syncStatus);
        calculateTimers(data.items || [], data.syncStatus);
        setError(null);
      } else {
        setError(data.error || 'Erro ao buscar status');
      }
    } catch (e) {
      setError('Erro de conexão');
    } finally {
      setIsLoading(false);
    }
  }, [userId, calculateTimers]);

  // Trigger manual sync
  const triggerManualSync = async () => {
    if (!userId || isSyncing || manualCooldownMs > 0 || items.length === 0) return;

    setIsSyncing(true);
    setError(null);

    try {
      // Trigger sync for each item
      for (const item of items) {
        const response = await fetch(`${API_BASE}/pluggy/trigger-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id, userId })
        });

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Falha ao iniciar sincronização');
        }
      }

      // Update local state to show pending
      setSyncStatus(prev => prev ? {
        ...prev,
        state: 'pending',
        message: 'Sincronização iniciada. Avisaremos quando terminar.'
      } : {
        state: 'pending',
        message: 'Sincronização iniciada. Avisaremos quando terminar.',
        lastUpdated: new Date().toISOString()
      });

    } catch (e: any) {
      setError(e.message || 'Erro ao sincronizar');
      setSyncStatus(prev => prev ? {
        ...prev,
        state: 'error',
        message: e.message || 'Erro ao sincronizar'
      } : null);
    } finally {
      setIsSyncing(false);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    fetchSyncStatus();

    // Poll every 30 seconds to check for webhook updates
    const pollInterval = setInterval(fetchSyncStatus, 30000);

    return () => clearInterval(pollInterval);
  }, [fetchSyncStatus]);

  // Timer countdown effect
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setNextAutoSyncMs(prev => Math.max(0, prev - 1000));
      setManualCooldownMs(prev => Math.max(0, prev - 1000));
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Notify parent when sync completes
  useEffect(() => {
    if (syncStatus?.state === 'success' && onSyncComplete) {
      onSyncComplete();
    }
  }, [syncStatus?.state, onSyncComplete]);

  // Don't render if no user or no items
  if (!userId) return null;

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'} text-gray-400`}>
        <Loader2 size={compact ? 14 : 16} className="animate-spin" />
        <span>Carregando...</span>
      </div>
    );
  }

  if (items.length === 0) {
    return null; // No connected accounts
  }

  const isButtonDisabled = isSyncing || manualCooldownMs > 0 || syncStatus?.state === 'pending' || syncStatus?.state === 'in_progress';
  const showCooldown = manualCooldownMs > 0 && !isSyncing && syncStatus?.state !== 'pending' && syncStatus?.state !== 'in_progress';

  // Compact version for header
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {/* Status indicator */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Clock size={12} />
          <span>{formatTimeRemaining(nextAutoSyncMs)}</span>
        </div>

        {/* Sync button */}
        <button
          onClick={triggerManualSync}
          disabled={isButtonDisabled}
          className={`
            p-2 rounded-lg transition-all duration-200 flex items-center justify-center
            ${isButtonDisabled
              ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
              : 'bg-[#d97757]/10 text-[#d97757] hover:bg-[#d97757]/20 border border-[#d97757]/30'
            }
          `}
          title={showCooldown ? `Aguarde ${formatTimeRemaining(manualCooldownMs)}` : 'Sincronizar agora'}
        >
          {(isSyncing || syncStatus?.state === 'pending' || syncStatus?.state === 'in_progress') ? (
            <Loader2 size={14} className="animate-spin" />
          ) : showCooldown ? (
            <Ban size={14} />
          ) : (
            <RefreshCw size={14} />
          )}
        </button>
      </div>
    );
  }

  // Full version for dashboard/connections page
  return (
    <div className="bg-[#363735] border border-[#4a4a48] rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <RefreshCw size={16} className="text-[#d97757]" />
          Sincronização Automática
        </h3>

        {/* Status badge */}
        {syncStatus && (
          <div className={`
            flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
            ${syncStatus.state === 'success' ? 'bg-green-500/10 text-green-400' :
              syncStatus.state === 'error' ? 'bg-red-500/10 text-red-400' :
                syncStatus.state === 'pending' || syncStatus.state === 'in_progress' ? 'bg-yellow-500/10 text-yellow-400' :
                  'bg-gray-700 text-gray-400'
            }
          `}>
            {syncStatus.state === 'success' && <CheckCircle size={12} />}
            {syncStatus.state === 'error' && <AlertCircle size={12} />}
            {(syncStatus.state === 'pending' || syncStatus.state === 'in_progress') && <Loader2 size={12} className="animate-spin" />}
            {syncStatus.state === 'success' ? 'Atualizado' :
              syncStatus.state === 'error' ? 'Erro' :
                syncStatus.state === 'pending' ? 'Pendente' :
                  syncStatus.state === 'in_progress' ? 'Sincronizando' : 'Aguardando'}
          </div>
        )}
      </div>

      {/* Timer display */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400 flex items-center gap-2">
            <Clock size={14} />
            Próxima atualização automática:
          </span>
          <span className="text-white font-medium">
            {nextAutoSyncMs > 0 ? formatTimeRemaining(nextAutoSyncMs) : 'Em breve'}
          </span>
        </div>

        {/* Connected banks indicator */}
        <div className="flex items-center gap-2">
          {items.slice(0, 3).map((item, i) => (
            <div
              key={item.id}
              className="flex items-center gap-1.5 px-2 py-1 bg-gray-800 rounded-lg text-xs text-gray-300"
            >
              {item.connectorImageUrl ? (
                <img src={item.connectorImageUrl} alt="" className="w-4 h-4 rounded" />
              ) : (
                <div className="w-4 h-4 bg-gray-700 rounded flex items-center justify-center text-[10px]">
                  {item.connectorName.charAt(0)}
                </div>
              )}
              <span className="truncate max-w-[80px]">{item.connectorName}</span>
            </div>
          ))}
          {items.length > 3 && (
            <span className="text-xs text-gray-500">+{items.length - 3}</span>
          )}
        </div>
      </div>

      {/* Manual sync button */}
      <button
        onClick={triggerManualSync}
        disabled={isButtonDisabled}
        className={`
          w-full py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200
          flex items-center justify-center gap-2
          ${isButtonDisabled
            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
            : 'bg-[#d97757] text-white hover:bg-[#c56646] shadow-lg shadow-[#d97757]/20'
          }
        `}
      >
        {(isSyncing || syncStatus?.state === 'pending' || syncStatus?.state === 'in_progress') ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>Sincronizando...</span>
          </>
        ) : showCooldown ? (
          <>
            <Ban size={16} />
            <span>Aguarde {formatTimeRemaining(manualCooldownMs)}</span>
          </>
        ) : (
          <>
            <RefreshCw size={16} />
            <span>Sincronizar Agora</span>
          </>
        )}
      </button>

      {/* Status message */}
      {syncStatus?.message && (syncStatus.state === 'pending' || syncStatus.state === 'in_progress') && (
        <p className="mt-3 text-xs text-yellow-400/80 text-center">
          {syncStatus.message}
        </p>
      )}

      {error && (
        <p className="mt-3 text-xs text-red-400 text-center">
          {error}
        </p>
      )}
    </div>
  );
};
