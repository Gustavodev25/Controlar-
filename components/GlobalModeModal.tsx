import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, Check, Settings, Trash2, History, RefreshCw, Wallet } from './Icons';
import NumberFlow from '@number-flow/react';

interface GlobalModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmManual: (keepHistory: boolean) => Promise<void>;
  onConfirmAuto: () => Promise<void>;
  targetMode: 'AUTO' | 'MANUAL';
}

export const GlobalModeModal: React.FC<GlobalModeModalProps> = ({
  isOpen,
  onClose,
  onConfirmManual,
  onConfirmAuto,
  targetMode
}) => {
  const [step, setStep] = useState<'select' | 'manual_config' | 'auto_confirm'>('select');
  const [manualOption, setManualOption] = useState<'keep' | 'reset'>('keep');
  const [isProcessing, setIsProcessing] = useState(false);

  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Animation Logic
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (isOpen) {
      setIsVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
      // Reset state on open
      setStep('select');
      setManualOption('keep');
      setIsProcessing(false);
    } else {
      setIsAnimating(false);
      timeoutId = setTimeout(() => {
        setIsVisible(false);
      }, 300);
    }
    return () => clearTimeout(timeoutId);
  }, [isOpen]);

  if (!isVisible) return null;

  const handleConfirmManualAction = async () => {
    setIsProcessing(true);
    try {
      await onConfirmManual(manualOption === 'keep');
      onClose();
    } catch (error) {
      console.error("Erro ao mudar para manual:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAutoAction = async () => {
    setIsProcessing(true);
    try {
      await onConfirmAuto();
      onClose();
    } catch (error) {
      console.error("Erro ao mudar para auto:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return createPortal(
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ease-in-out ${isAnimating ? 'bg-black/90 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-0'}`}>
      <div className={`bg-gray-950 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-800 flex flex-col relative transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}`}>

        {/* Background Effects */}
        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#d97757]/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gray-700/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
        </div>

        {/* Header */}
        <div className="p-5 border-b border-gray-800/50 flex justify-between items-center relative z-10">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings size={24} className="text-[#d97757]" />
            Modo Global
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 relative z-10">
          {/* Current Status Context */}
          <div className="mb-6 bg-gray-900/50 p-4 rounded-xl border border-gray-800/50 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${targetMode === 'MANUAL' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
              {targetMode === 'MANUAL' ? <Wallet size={20} /> : <RefreshCw size={20} />}
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold">Ação Solicitada</p>
              <p className={`font-medium ${targetMode === 'MANUAL' ? 'text-amber-500' : 'text-emerald-500'}`}>
                {targetMode === 'MANUAL' ? 'Entrar em Modo Manual' : 'Ativar Modo Automático'}
              </p>
            </div>
          </div>

          {/* FLOW: TO MANUAL */}
          {targetMode === 'MANUAL' && step === 'select' && (
            <div className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
                <h4 className="text-amber-500 font-bold text-sm flex items-center gap-2 mb-2">
                  <AlertCircle size={16} />
                  Configuração de Transição
                </h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Você está desativando o piloto automático. Como deseja tratar suas contas conectadas?
                </p>
              </div>
              <button
                onClick={() => setStep('manual_config')}
                className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition-all border border-gray-700"
              >
                Configurar Contas
              </button>
            </div>
          )}

          {/* FLOW: TO MANUAL (CONFIG) */}
          {targetMode === 'MANUAL' && step === 'manual_config' && (
            <div className="space-y-5 animate-fade-in">
              <p className="text-sm text-white font-medium mb-2">Opções de Dados</p>

              {/* Option A: Keep History */}
              <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${manualOption === 'keep' ? 'bg-gray-800 border-[#d97757] shadow-lg shadow-[#d97757]/10' : 'bg-gray-900 border-gray-800 hover:bg-gray-800/50'}`}>
                <div className="mt-0.5">
                  <input
                    type="radio"
                    name="manualOption"
                    checked={manualOption === 'keep'}
                    onChange={() => setManualOption('keep')}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${manualOption === 'keep' ? 'border-[#d97757] bg-[#d97757]' : 'border-gray-600'}`}>
                    {manualOption === 'keep' && <Check size={12} className="text-white" />}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <History size={16} className="text-blue-400" />
                    <span className="font-bold text-sm text-white">Manter Histórico</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Todas as transações importadas permanecem. Sincronização é desconectada. Apenas transações manuais a partir de agora.
                  </p>
                </div>
              </label>

              {/* Option B: Reset */}
              <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${manualOption === 'reset' ? 'bg-gray-800 border-red-500 shadow-lg shadow-red-500/10' : 'bg-gray-900 border-gray-800 hover:bg-gray-800/50'}`}>
                <div className="mt-0.5">
                  <input
                    type="radio"
                    name="manualOption"
                    checked={manualOption === 'reset'}
                    onChange={() => setManualOption('reset')}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${manualOption === 'reset' ? 'border-red-500 bg-red-500' : 'border-gray-600'}`}>
                    {manualOption === 'reset' && <Check size={12} className="text-white" />}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Trash2 size={16} className="text-red-400" />
                    <span className="font-bold text-sm text-white">Começar do Zero</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Todas as transações importadas são apagadas. Receitas e despesas do Open Finance zeram. Conta opera 100% manualmente.
                  </p>
                </div>
              </label>

              <div className="flex gap-3 mt-4">
                <button onClick={() => setStep('select')} className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-xl font-bold text-xs hover:bg-gray-700">Voltar</button>
                <button
                  onClick={handleConfirmManualAction}
                  disabled={isProcessing}
                  className="flex-1 py-3 bg-[#d97757] text-white rounded-xl font-bold text-xs hover:bg-[#c56a4d] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? 'Processando...' : 'Confirmar Mudança'}
                </button>
              </div>
            </div>
          )}

          {/* FLOW: TO AUTO */}
          {targetMode === 'AUTO' && step === 'select' && (
            <div className="space-y-4">
              <div className="bg-emerald-900/20 border border-emerald-500/30 p-4 rounded-xl">
                <h4 className="text-emerald-500 font-bold text-sm flex items-center gap-2 mb-2">
                  <RefreshCw size={16} />
                  Reativar Automático
                </h4>
                <p className="text-xs text-gray-400 leading-relaxed mb-2">
                  A sincronização Open Finance será reativada para todas as contas conectadas.
                </p>
                <div className="bg-red-500/10 border border-red-500/20 p-2 rounded-lg flex gap-2 items-start">
                  <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-300">
                    <strong>Atenção:</strong> Lançamentos manuais serão removidos para evitar duplicidade. O saldo será ajustado para o valor real do banco.
                  </p>
                </div>
              </div>
              <button
                onClick={handleConfirmAutoAction}
                disabled={isProcessing}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
              >
                {isProcessing ? 'Sincronizando...' : 'Confirmar e Reativar'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
};