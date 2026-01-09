import React, { useState, useEffect } from 'react';
import { UniversalModal } from './UniversalModal';
import { AlertTriangle, Bot, CheckCircle } from 'lucide-react';

interface CancellationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    isLoading: boolean;
}

export const CancellationModal: React.FC<CancellationModalProps> = ({ isOpen, onClose, onConfirm, isLoading }) => {
    const [step, setStep] = useState<'info' | 'confirm'>('info');
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (isOpen) {
            setStep('info');
            setReason('');
        }
    }, [isOpen]);

    const handleClose = () => {
        onClose();
        // Reset step after animation
        setTimeout(() => {
            setStep('info');
            setReason('');
        }, 300);
    };

    return (
        <UniversalModal
            isOpen={isOpen}
            onClose={handleClose}
            title={step === 'info' ? "Cancelar Assinatura" : "Confirmar Solicitação"}
            subtitle={step === 'info' ? "Você tem certeza?" : "Ação irreversível"}
            icon={step === 'info' ? <AlertTriangle size={20} /> : <Bot size={20} />}
            themeColor="#ef4444" // Red
            zIndex="z-[9999]" // Ensure it's above everything
            footer={
                <div className="flex gap-3 justify-end">
                    {step === 'info' ? (
                        <>
                            <button
                                onClick={handleClose}
                                className="px-4 py-2 rounded-xl text-gray-300 hover:bg-gray-800 transition-colors text-sm font-medium"
                            >
                                Voltar
                            </button>
                            <button
                                onClick={() => setStep('confirm')}
                                disabled={!reason.trim()}
                                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all shadow-lg shadow-red-900/20 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Continuar
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setStep('info')}
                                disabled={isLoading}
                                className="px-4 py-2 rounded-xl text-gray-300 hover:bg-gray-800 transition-colors text-sm font-medium disabled:opacity-50"
                            >
                                Voltar
                            </button>
                            <button
                                onClick={() => onConfirm(reason)}
                                disabled={isLoading}
                                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all shadow-lg shadow-red-900/20 disabled:opacity-50 flex items-center gap-2 text-sm"
                            >
                                {isLoading ? "Processando..." : (
                                    <>
                                        <CheckCircle size={16} /> Confirmar
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            }
        >
            {step === 'info' ? (
                <div className="space-y-4">
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-gray-300 text-sm leading-relaxed">
                        <p className="mb-2">
                            Lamentamos ver você partir! O cancelamento da assinatura é processado pela nossa equipe de suporte.
                        </p>
                        <p>
                            Ao confirmar, um chamado será aberto e nossa equipe entrará em contato para finalizar o cancelamento e verificar se podemos ajudar em algo mais.
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">
                            Motivo do Cancelamento
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all placeholder:text-gray-600 text-sm h-24 resize-none"
                            placeholder="Por favor, nos conte o motivo..."
                        />
                    </div>
                </div>
            ) : (
                <div className="text-center py-4">
                    <p className="text-sm text-gray-400">
                        Deseja abrir um chamado de cancelamento agora?
                    </p>
                    {reason && (
                        <div className="mt-4 p-3 bg-gray-800 rounded-lg text-left">
                            <p className="text-xs text-gray-500 uppercase font-bold mb-1">Motivo:</p>
                            <p className="text-sm text-gray-300 italic">"{reason}"</p>
                        </div>
                    )}
                </div>
            )}
        </UniversalModal>
    );
};
