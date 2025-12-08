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
        className={`bg-gray-950 border rounded-2xl shadow-2xl min-w-[320px] overflow-hidden transition-all ${
          isComplete ? 'border-emerald-500/50' : hasError ? 'border-red-500/50' : 'border-gray-800'
        }`}
      >
        {/* Progress bar at top */}
        <div className="h-1 bg-gray-900">
          <div
            className={`h-full transition-all duration-500 ${
              isComplete ? 'bg-emerald-500' : hasError ? 'bg-red-500' : 'bg-[#d97757]'
            }`}
            style={{ width: `${isComplete ? 100 : percentage}%` }}
          />
        </div>

        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div
              className={`p-2 rounded-xl ${
                isComplete ? 'bg-emerald-500/10' : hasError ? 'bg-red-500/10' : 'bg-[#d97757]/10'
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
                  {isComplete ? 'Sincronizacao Concluida!' : hasError ? 'Erro na Sincronizacao' : 'Sincronizando...'}
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
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {hasError ? progress.error : progress.step}
              </p>
              {!isComplete && !hasError && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs font-mono text-gray-500">
                    {progress.current}/{progress.total}
                  </span>
                  <span className="text-xs font-bold text-[#d97757]">{percentage}%</span>
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
