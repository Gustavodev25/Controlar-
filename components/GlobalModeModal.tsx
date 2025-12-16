import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, Check, Settings, Trash2, History, RefreshCw, Wallet, ShieldCheck, Info, Zap } from './Icons';

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
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${isAnimating ? 'backdrop-blur-md bg-black/60' : 'backdrop-blur-none bg-black/0'}`}>
      <div className={`bg-gray-950 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-800 flex flex-col max-h-[90vh] relative transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}`}>

        {/* Background Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 opacity-20 bg-[#d97757]" />

        {/* Header */}
        <div className="p-5 border-b border-gray-800/50 flex justify-between items-center relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#d97757]/10 rounded-xl border border-[#d97757]/20">
              <Settings size={20} className="text-[#d97757]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Modo Global</h3>
              <p className="text-xs text-gray-500">
                {targetMode === 'MANUAL' ? 'Mudar para Manual' : 'Ativar Automático'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800/50 rounded-lg transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden relative z-10 p-5 overflow-y-auto custom-scrollbar">

          {/* FLOW: TO MANUAL - Step 1: Info */}
          {targetMode === 'MANUAL' && step === 'select' && (
            <div className="flex flex-col gap-6 animate-fade-in">
              {/* O que acontece */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle size={18} className="text-amber-500" />
                  <h4 className="text-sm font-bold text-white">O que acontece</h4>
                </div>
                <ul className="text-xs text-gray-400 space-y-2 ml-6">
                  <li>A sincronização automática será desativada</li>
                  <li>Novas transações não serão importadas</li>
                  <li>Você precisará lançar manualmente</li>
                </ul>
              </div>

              <div className="border-t border-gray-800/50" />

              {/* Seus dados */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-500" />
                  <h4 className="text-sm font-bold text-white">Seus dados</h4>
                </div>
                <p className="text-xs text-gray-400 ml-6 leading-relaxed">
                  Você pode escolher manter todo o histórico importado ou começar do zero.
                </p>
              </div>

              <button
                onClick={() => setStep('manual_config')}
                className="w-full mt-2 px-6 py-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl transition-colors text-sm font-bold shadow-lg shadow-[#d97757]/20"
              >
                Continuar
              </button>
            </div>
          )}

          {/* FLOW: TO MANUAL - Step 2: Config */}
          {targetMode === 'MANUAL' && step === 'manual_config' && (
            <div className="flex flex-col gap-5 animate-fade-in">
              <p className="text-sm text-gray-400">Como deseja tratar suas transações importadas?</p>

              {/* Option A: Keep History */}
              <button
                onClick={() => setManualOption('keep')}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${manualOption === 'keep' ? 'bg-[#d97757]/5 border-[#d97757]/50' : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'}`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${manualOption === 'keep' ? 'bg-[#d97757]/20' : 'bg-gray-800'}`}>
                  <History size={22} className={manualOption === 'keep' ? 'text-[#d97757]' : 'text-gray-500'} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white text-sm mb-0.5">Manter Histórico</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Transações importadas permanecem. Apenas desconecta a sincronização.
                  </p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${manualOption === 'keep' ? 'border-[#d97757] bg-[#d97757]' : 'border-gray-600'}`}>
                  {manualOption === 'keep' && <Check size={12} className="text-white" />}
                </div>
              </button>

              {/* Option B: Reset */}
              <button
                onClick={() => setManualOption('reset')}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${manualOption === 'reset' ? 'bg-red-500/5 border-red-500/50' : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'}`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${manualOption === 'reset' ? 'bg-red-500/20' : 'bg-gray-800'}`}>
                  <Trash2 size={22} className={manualOption === 'reset' ? 'text-red-500' : 'text-gray-500'} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white text-sm mb-0.5">Começar do Zero</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Remove todas as transações importadas. Conta opera 100% manualmente.
                  </p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${manualOption === 'reset' ? 'border-red-500 bg-red-500' : 'border-gray-600'}`}>
                  {manualOption === 'reset' && <Check size={12} className="text-white" />}
                </div>
              </button>

              <div className="flex gap-3 mt-2">
                <button onClick={() => setStep('select')} className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-xl font-bold text-sm hover:bg-gray-700 border border-gray-700">
                  Voltar
                </button>
                <button
                  onClick={handleConfirmManualAction}
                  disabled={isProcessing}
                  className="flex-1 py-3 bg-[#d97757] text-white rounded-xl font-bold text-sm hover:bg-[#c56a4d] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#d97757]/20"
                >
                  {isProcessing ? 'Processando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}

          {/* FLOW: TO AUTO */}
          {targetMode === 'AUTO' && step === 'select' && (
            <div className="flex flex-col gap-6 animate-fade-in">
              {/* O que acontece */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <RefreshCw size={18} className="text-emerald-500" />
                  <h4 className="text-sm font-bold text-white">O que acontece</h4>
                </div>
                <ul className="text-xs text-gray-400 space-y-2 ml-6">
                  <li>A sincronização Open Finance será reativada</li>
                  <li>Transações serão importadas automaticamente</li>
                  <li>O saldo será ajustado para o valor real do banco</li>
                </ul>
              </div>

              <div className="border-t border-gray-800/50" />

              {/* Atenção */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle size={18} className="text-red-400" />
                  <h4 className="text-sm font-bold text-white">Atenção</h4>
                </div>
                <p className="text-xs text-gray-400 ml-6 leading-relaxed">
                  Lançamentos manuais serão removidos para evitar duplicidade.
                </p>
              </div>

              <div className="border-t border-gray-800/50" />

              {/* Segurança */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-blue-400" />
                  <h4 className="text-sm font-bold text-white">Segurança</h4>
                </div>
                <p className="text-xs text-gray-400 ml-6 leading-relaxed">
                  Conexão regulamentada pelo Banco Central. Seus dados permanecem protegidos.
                </p>
              </div>

              <button
                onClick={handleConfirmAutoAction}
                disabled={isProcessing}
                className="w-full mt-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors text-sm font-bold shadow-lg shadow-emerald-900/20"
              >
                {isProcessing ? 'Sincronizando...' : 'Confirmar e Reativar'}
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800/50 relative z-10">
          <p className="text-[11px] text-gray-500 text-center">
            Você pode alterar o modo a qualquer momento nas configurações.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
};