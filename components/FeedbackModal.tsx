import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Bug, Lightbulb, Send, Check, AlertCircle } from './Icons';
import { TooltipIcon } from './UIComponents';
import { addFeedback } from '../services/database';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    userEmail?: string;
    userName?: string;
    userId?: string;
}

type FeedbackType = 'bug' | 'suggestion';

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, userEmail, userName, userId }) => {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isModalAnimating, setIsModalAnimating] = useState(false);
    const [feedbackType, setFeedbackType] = useState<FeedbackType>('suggestion');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [error, setError] = useState('');

    // Modal animation control
    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        if (isOpen) {
            setIsModalVisible(true);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsModalAnimating(true);
                });
            });
        } else {
            setIsModalAnimating(false);
            timeoutId = setTimeout(() => {
                setIsModalVisible(false);
                setIsSent(false);
                setError('');
                setMessage('');
            }, 300);
        }
        return () => clearTimeout(timeoutId);
    }, [isOpen]);

    const handleSubmit = async () => {
        if (!message.trim()) {
            setError('Por favor, escreva sua mensagem.');
            return;
        }

        setIsSending(true);
        setError('');

        try {
            await addFeedback({
                type: feedbackType,
                message: message.trim(),
                userId: userId,
                userEmail: userEmail,
                userName: userName,
                status: 'pending',
                createdAt: new Date().toISOString(),
            });

            setIsSent(true);
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err) {
            console.error('Error saving feedback:', err);
            setError('Erro ao enviar. Tente novamente.');
        } finally {
            setIsSending(false);
        }
    };

    if (!isModalVisible) return null;

    return createPortal(
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ease-in-out ${isModalAnimating ? 'bg-black/80 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-0'}`}
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className={`bg-gray-950 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-800 flex flex-col relative transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isModalAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}`}
            >
                {/* Background Glow */}
                <div className={`absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 opacity-20 ${feedbackType === 'bug' ? 'bg-red-500' : 'bg-amber-500'}`} />

                {/* Header */}
                <div className="p-5 border-b border-gray-800/50 relative z-10 flex justify-between items-center">
                    <h3 className="font-bold text-white text-lg flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${feedbackType === 'bug' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                            {feedbackType === 'bug' ? <Bug size={18} /> : <Lightbulb size={18} />}
                        </div>
                        Enviar Feedback
                    </h3>
                    <TooltipIcon content="Fechar">
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-xl transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </TooltipIcon>
                </div>

                {/* Content */}
                <div className="p-5 relative z-10">
                    {isSent ? (
                        <div className="py-6 flex flex-col items-center justify-center text-center animate-fade-in">
                            <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mb-3 border border-emerald-500/20">
                                <Check size={28} className="text-emerald-500" />
                            </div>
                            <h4 className="text-base font-bold text-white mb-1">Obrigado!</h4>
                            <p className="text-sm text-gray-400">Seu feedback foi enviado com sucesso.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Type Selector */}
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFeedbackType('bug')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all text-sm border ${feedbackType === 'bug'
                                        ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                        : 'bg-gray-900/50 text-gray-500 border-gray-800 hover:border-gray-700 hover:text-gray-300'
                                        }`}
                                >
                                    <Bug size={16} />
                                    Reportar Erro
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFeedbackType('suggestion')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all text-sm border ${feedbackType === 'suggestion'
                                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                        : 'bg-gray-900/50 text-gray-500 border-gray-800 hover:border-gray-700 hover:text-gray-300'
                                        }`}
                                >
                                    <Lightbulb size={16} />
                                    Sugestão
                                </button>
                            </div>

                            {/* Message Input */}
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder={feedbackType === 'bug'
                                    ? "Descreva o problema que você encontrou..."
                                    : "Descreva sua sugestão de melhoria..."
                                }
                                rows={4}
                                className="w-full p-4 bg-gray-900/50 border border-gray-800 rounded-xl focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757] text-white transition-all placeholder-gray-600 resize-none text-sm"
                                autoFocus
                            />

                            {/* Error */}
                            {error && (
                                <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20 animate-fade-in">
                                    <AlertCircle size={14} />
                                    {error}
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isSending}
                                className={`w-full py-3.5 text-white rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${feedbackType === 'bug'
                                    ? 'bg-red-500 hover:bg-red-400 shadow-red-500/20'
                                    : 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/20'
                                    }`}
                            >
                                {isSending ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        <Send size={16} />
                                        Enviar Feedback
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
