import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X, MessageSquare, Bug, Lightbulb, Send, Check, AlertCircle } from './Icons';
import { TooltipIcon } from './UIComponents';

interface FeedbackBannerProps {
    userEmail?: string;
    userName?: string;
    userId?: string;
}

type FeedbackType = 'bug' | 'suggestion';

export const FeedbackBanner: React.FC<FeedbackBannerProps> = ({ userEmail, userName, userId }) => {
    const [isDismissed, setIsDismissed] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isModalAnimating, setIsModalAnimating] = useState(false);
    const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [error, setError] = useState('');

    // Check if dismissed in localStorage
    useEffect(() => {
        const dismissed = localStorage.getItem('feedback_banner_dismissed');
        const dismissedAt = localStorage.getItem('feedback_banner_dismissed_at');

        if (dismissed === 'true' && dismissedAt) {
            const daysSinceDismissed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
            if (daysSinceDismissed < 7) {
                setIsDismissed(true);
            } else {
                localStorage.removeItem('feedback_banner_dismissed');
                localStorage.removeItem('feedback_banner_dismissed_at');
            }
        }
    }, []);

    // Modal animation control
    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        if (isModalOpen) {
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
    }, [isModalOpen]);

    const handleDismiss = () => {
        setIsDismissed(true);
        localStorage.setItem('feedback_banner_dismissed', 'true');
        localStorage.setItem('feedback_banner_dismissed_at', Date.now().toString());
    };

    const openModal = (type: FeedbackType) => {
        setFeedbackType(type);
        setIsModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!message.trim()) {
            setError('Por favor, escreva sua mensagem.');
            return;
        }

        setIsSending(true);
        setError('');

        try {
            // Importar dinamicamente para evitar dependência circular
            const dbService = await import('../services/database');

            await dbService.addFeedback({
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
                setIsModalOpen(false);
            }, 2000);
        } catch (err) {
            console.error('Error saving feedback:', err);
            setError('Erro ao enviar. Tente novamente.');
        } finally {
            setIsSending(false);
        }
    };

    if (isDismissed) return null;

    return (
        <>
            {/* Banner */}
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="w-full bg-gradient-to-r from-[#d97757]/10 via-[#d97757]/5 to-transparent border-b border-[#d97757]/20"
                >
                    <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
                        {/* Left - Message */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="p-1.5 bg-[#d97757]/10 rounded-lg text-[#d97757] flex-shrink-0">
                                <MessageSquare size={16} />
                            </div>
                            <p className="text-sm text-gray-300 truncate">
                                <span className="font-medium text-white">Nos ajude a melhorar!</span>
                                <span className="hidden sm:inline text-gray-400"> — Encontrou um erro ou tem uma sugestão?</span>
                            </p>
                        </div>

                        {/* Center - Action Buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                onClick={() => openModal('bug')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-all text-xs font-medium border border-red-500/20 hover:border-red-500/30"
                            >
                                <Bug size={14} />
                                <span className="hidden sm:inline">Reportar Erro</span>
                                <span className="sm:hidden">Erro</span>
                            </button>
                            <button
                                onClick={() => openModal('suggestion')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 rounded-lg transition-all text-xs font-medium border border-amber-500/20 hover:border-amber-500/30"
                            >
                                <Lightbulb size={14} />
                                <span className="hidden sm:inline">Sugestão</span>
                                <span className="sm:hidden">Ideia</span>
                            </button>
                        </div>

                        {/* Right - Close */}
                        <button
                            onClick={handleDismiss}
                            className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 rounded-lg transition-all flex-shrink-0"
                            title="Dispensar"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Modal */}
            {isModalVisible && createPortal(
                <div
                    className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ease-in-out ${isModalAnimating ? 'bg-black/80 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-0'}`}
                    onClick={() => setIsModalOpen(false)}
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
                                {feedbackType === 'bug' ? 'Reportar Erro' : 'Enviar Sugestão'}
                            </h3>
                            <TooltipIcon content="Fechar">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-xl transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </TooltipIcon>
                        </div>

                        {/* Content */}
                        <div className="p-5 relative z-10">
                            {isSent ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="py-6 flex flex-col items-center justify-center text-center"
                                >
                                    <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mb-3 border border-emerald-500/20">
                                        <Check size={28} className="text-emerald-500" />
                                    </div>
                                    <h4 className="text-base font-bold text-white mb-1">Obrigado!</h4>
                                    <p className="text-sm text-gray-400">Seu feedback foi preparado para envio.</p>
                                </motion.div>
                            ) : (
                                <div className="space-y-4">
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
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20"
                                        >
                                            <AlertCircle size={14} />
                                            {error}
                                        </motion.div>
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
                                                Preparando...
                                            </>
                                        ) : (
                                            <>
                                                <Send size={16} />
                                                Enviar
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};
