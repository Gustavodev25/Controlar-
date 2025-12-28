import React from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, X } from "./Icons";
import { SyncProgress } from "../utils/syncProgress";

interface SyncProgressToastProps {
  progress: SyncProgress;
  onDismiss: () => void;
}

export const SyncProgressToast: React.FC<SyncProgressToastProps> = ({ progress, onDismiss }) => {
  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const isComplete = !!progress.isComplete;
  const hasError = !!progress.error;

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[200] animate-slide-up">
      <div
        className={`bg-gray-950 border rounded-2xl shadow-2xl min-w-[320px] overflow-hidden transition-all ${isComplete ? 'border-emerald-500/50' : hasError ? 'border-red-500/50' : 'border-gray-800'
          }`}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div
              className={`p-2 rounded-xl ${isComplete ? 'bg-emerald-500/10' : hasError ? 'bg-red-500/10' : 'bg-[#d97757]/10'
                }`}
            >
              {isComplete ? (
                <Check size={20} className="text-emerald-500" />
              ) : hasError ? (
                <X size={20} className="text-red-500" />
              ) : (
                <Loader2 size={20} className="text-[#d97757] animate-spin" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-white">
                  {isComplete ? 'Sincronização Concluída!' : hasError ? 'Erro na Sincronização' : 'Sincronizando...'}
                </h4>
                {(isComplete || hasError) && (
                  <button
                    onClick={onDismiss}
                    className="text-gray-500 hover:text-white p-1 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                {hasError ? progress.error : progress.step}
              </p>

              {/* Progress Bar - Only show when syncing */}
              {!isComplete && !hasError && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Progresso</span>
                    <span className="text-[10px] text-[#d97757] font-bold">{percentage}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#d97757] rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
