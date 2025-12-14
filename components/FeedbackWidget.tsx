import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Send, Check, AlertCircle, Lightbulb, ThumbsUp, Bug } from './Icons';

interface FeedbackWidgetProps {
    userEmail?: string;
    userName?: string;
}

type FeedbackType = 'suggestion' | 'problem' | 'praise' | 'other';

const feedbackTypes: { value: FeedbackType; label: string; icon: React.ReactNode; color: string }[] = [
    { value: 'suggestion', label: 'Sugestão', icon: <Lightbulb size={16} />, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
    { value: 'problem', label: 'Problema', icon: <Bug size={16} />, color: 'text-red-500 bg-red-500/10 border-red-500/20' },
    { value: 'praise', label: 'Elogio', icon: <ThumbsUp size={16} />, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
    { value: 'other', label: 'Outro', icon: <MessageSquare size={16} />, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
];

export const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({ userEmail, userName }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const [feedbackType, setFeedbackType] = useState<FeedbackType>('suggestion');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [error, setError] = useState('');

    // Check if dismissed in localStorage (to not show again in this session)
    useEffect(() => {
        const dismissed = sessionStorage.getItem('feedback_dismissed');
        if (dismissed === 'true') {
            setIsDismissed(true);
        }
    }, []);

    // Reset state when expanding
    useEffect(() => {
        if (isExpanded) {
            setIsSent(false);
            setError('');
        }
    }, [isExpanded]);

    const handleDismiss = () => {
        setIsDismissed(true);
        sessionStorage.setItem('feedback_dismissed', 'true');
    };

    const handleSubmit = async () => {
        if (!message.trim()) {
            setError('Por favor, escreva sua mensagem.');
            return;
        }

        setIsSending(true);
        setError('');

        try {
            const selectedType = feedbackTypes.find(t => t.value === feedbackType);
            const subject = encodeURIComponent(`[Controlar+] ${selectedType?.label}: Feedback de ${userName || 'Usuário'}`);
            const body = encodeURIComponent(
                `Tipo: ${selectedType?.label}\n` +
                `De: ${userName || 'Anônimo'} (${userEmail || 'Sem email'})\n` +
                `Data: ${new Date().toLocaleString('pt-BR')}\n\n` +
                `Mensagem:\n${message}`
            );

            window.open(`mailto:suporte@controlar.app?subject=${subject}&body=${body}`, '_blank');

            setIsSent(true);
            setTimeout(() => {
                setIsDismissed(true);
                sessionStorage.setItem('feedback_dismissed', 'true');
            }, 2000);
        } catch (err) {
            setError('Erro ao enviar. Tente novamente.');
        } finally {
            setIsSending(false);
        }
    };

    if (isDismissed) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.9 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300, delay: 1 }}
                className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-48px)]"
            >
                <div className="bg-[#1a1a19] border border-[#373734] rounded-2xl shadow-2xl overflow-hidden">
                    {/* Decorative Gradient */}
                    <div className="absolute top-0 right-0 w-40 h-40 bg-[#d97757] rounded-full blur-3xl -mr-16 -mt-16 opacity-10 pointer-events-none" />

                    {/* Header with Close */}
                    <div className="relative px-5 pt-4 pb-3 border-b border-[#373734] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-[#d97757]/10 rounded-xl text-[#d97757]">
                                <MessageSquare size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white">Nos ajude a melhorar!</h3>
                                <p className="text-[11px] text-gray-500">Sua opinião é muito importante</p>
                            </div>
                        </div>
                        <button
                            onClick={handleDismiss}
                            className="text-gray-600 hover:text-gray-400 p-1.5 hover:bg-gray-800/50 rounded-lg transition-colors"
                            title="Fechar"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-4 relative">
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
                                <p className="text-xs text-gray-400">Seu feedback foi enviado com sucesso.</p>
                            </motion.div>
                        ) : !isExpanded ? (
                            /* Collapsed State - Prompt */
                            <div className="text-center py-2">
                                <p className="text-sm text-gray-300 mb-4">
                                    Encontrou um problema? Tem uma sugestão? <br />
                                    <span className="text-gray-500">Queremos ouvir você!</span>
                                </p>
                                <button
                                    onClick={() => setIsExpanded(true)}
                                    className="w-full py-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/20 flex items-center justify-center gap-2 text-sm"
                                >
                                    <Send size={16} />
                                    Enviar Feedback
                                </button>
                            </div>
                        ) : (
                            /* Expanded State - Form */
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="space-y-4"
                            >
                                {/* Feedback Type Selector */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                                        Tipo de Feedback
                                    </label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {feedbackTypes.map((type) => (
                                            <button
                                                key={type.value}
                                                onClick={() => setFeedbackType(type.value)}
                                                className={`
                          flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all text-xs font-medium
                          ${feedbackType === type.value
                                                        ? type.color
                                                        : 'text-gray-500 bg-gray-900/50 border-gray-800 hover:border-gray-700 hover:text-gray-300'
                                                    }
                        `}
                                            >
                                                {type.icon}
                                                <span className="text-[9px]">{type.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Message */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                                        Sua Mensagem
                                    </label>
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Conte-nos o que você pensa..."
                                        rows={3}
                                        className="w-full bg-gray-900/50 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#d97757] focus:ring-2 focus:ring-[#d97757]/20 outline-none transition-all resize-none"
                                        autoFocus
                                    />
                                </div>

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

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setIsExpanded(false)}
                                        className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-all text-sm"
                                    >
                                        Voltar
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={isSending}
                                        className="flex-[2] py-2.5 bg-[#d97757] hover:bg-[#c56a4d] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/20 flex items-center justify-center gap-2 text-sm"
                                    >
                                        {isSending ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Enviando...
                                            </>
                                        ) : (
                                            <>
                                                <Send size={14} />
                                                Enviar
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
