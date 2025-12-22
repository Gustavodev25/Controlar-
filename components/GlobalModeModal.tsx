import React, { useState, useEffect } from 'react';
import { Settings, AlertCircle, ShieldCheck, RefreshCw, History, Check, Trash2 } from './Icons';
import { UniversalModal, ModalSection, ModalDivider } from './UniversalModal';

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

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setManualOption('keep');
      setIsProcessing(false);
    }
  }, [isOpen]);

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

  const getFooter = () => (
    <p className="text-[11px] text-gray-500 text-center">
      Você pode alterar o modo a qualquer momento nas configurações.
    </p>
  );

  return (
    <UniversalModal
      isOpen={isOpen}
      onClose={onClose}
      title="Modo Global"
      subtitle={targetMode === 'MANUAL' ? 'Mudar para Manual' : 'Ativar Automático'}
      icon={<Settings size={20} />}
      footer={getFooter()}
      themeColor="#d97757"
    >
      {/* FLOW: TO MANUAL - Step 1: Info */}
      {targetMode === 'MANUAL' && step === 'select' && (
        <div className="flex flex-col animate-fade-in">
          <ModalSection
            icon={<AlertCircle size={18} />}
            title="O que acontece"
            iconClassName="text-amber-500"
          >
            <ul className="list-none space-y-2 text-xs text-gray-400">
              <li>A sincronização automática será desativada</li>
              <li>Novas transações não serão importadas</li>
              <li>Você precisará lançar manualmente</li>
            </ul>
          </ModalSection>

          <ModalDivider />

          <ModalSection
            icon={<ShieldCheck size={18} />}
            title="Seus dados"
            iconClassName="text-emerald-500"
          >
            <p className="text-xs text-gray-400 leading-relaxed">
              Você pode escolher manter todo o histórico importado ou começar do zero.
            </p>
          </ModalSection>

          <div className="mt-6">
            <button
              onClick={() => setStep('manual_config')}
              className="w-full px-6 py-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl transition-colors text-sm font-bold shadow-lg shadow-[#d97757]/20"
            >
              Continuar
            </button>
          </div>
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
        <div className="flex flex-col animate-fade-in">
          <ModalSection
            icon={<RefreshCw size={18} />}
            title="O que acontece"
            iconClassName="text-emerald-500"
          >
            <ul className="list-none space-y-2 text-xs text-gray-400">
              <li>A sincronização Open Finance será reativada</li>
              <li>Transações serão importadas automaticamente</li>
              <li>O saldo será ajustado para o valor real do banco</li>
            </ul>
          </ModalSection>

          <ModalDivider />

          <ModalSection
            icon={<AlertCircle size={18} />}
            title="Atenção"
            iconClassName="text-red-400"
          >
            <p className="text-xs text-gray-400 leading-relaxed">
              Lançamentos manuais serão removidos para evitar duplicidade.
            </p>
          </ModalSection>

          <ModalDivider />

          <ModalSection
            icon={<ShieldCheck size={18} />}
            title="Segurança"
            iconClassName="text-blue-400"
          >
            <p className="text-xs text-gray-400 leading-relaxed">
              Conexão regulamentada pelo Banco Central. Seus dados permanecem protegidos.
            </p>
          </ModalSection>

          <div className="mt-6">
            <button
              onClick={handleConfirmAutoAction}
              disabled={isProcessing}
              className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors text-sm font-bold shadow-lg shadow-emerald-900/20"
            >
              {isProcessing ? 'Sincronizando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}

    </UniversalModal>
  );
};