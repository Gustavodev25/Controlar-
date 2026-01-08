import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, ChevronRight, X, Sparkles, HelpCircle } from 'lucide-react';
import coinzinhaImg from '../assets/coinzinha.png';
import { createPortal } from 'react-dom';

interface InvoiceTutorialModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Spotlight Component (Reused from ProOnboardingModal)
const Spotlight = ({ targetId, padding = 10 }: { targetId: string | null, padding?: number }) => {
    const [rect, setRect] = useState<DOMRect | null>(null);

    useEffect(() => {
        if (!targetId) {
            setRect(null);
            return;
        }

        const updateRect = () => {
            const el = document.getElementById(targetId);
            if (el) {
                setRect(el.getBoundingClientRect());
            }
        };

        updateRect();
        window.addEventListener('resize', updateRect);

        // Polling for dynamic elements
        const interval = setInterval(updateRect, 500);

        return () => {
            window.removeEventListener('resize', updateRect);
            clearInterval(interval);
        };
    }, [targetId]);

    if (!rect) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed z-[100] border-2 border-[#d97757] rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.85)] pointer-events-none transition-all duration-500 ease-in-out box-content"
            style={{
                top: rect.top - padding,
                left: rect.left - padding,
                width: rect.width + (padding * 2),
                height: rect.height + (padding * 2),
            }}
        />
    );
};

export const InvoiceTutorialModal: React.FC<InvoiceTutorialModalProps> = ({
    isOpen,
    onClose
}) => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const [step, setStep] = useState(0);

    const nextStep = () => setStep(prev => prev + 1);
    const prevStep = () => setStep(prev => Math.max(0, prev - 1));

    const steps = [
        {
            targetId: null, // Center
            title: "Guia da Fatura do Cartão",
            content: "Olá! Eu sou o Coinzinha e vou te ensinar a dominar o controle das suas faturas. Vamos lá?",
            position: 'center'
        },
        {
            targetId: 'card-settings-trigger', // Card Settings Button
            title: "Configuração de Datas",
            content: "O segredo para a fatura bater certinho está aqui! Verifique se o dia de fechamento e vencimento estão corretos. Você pode ajustar a data da 'Última' e da 'Atual' clicando nesta engrenagem.",
            position: 'bottom-end'
        },
        {
            targetId: 'select-all-checkbox', // Select All Checkbox
            title: "Seleção Múltipla",
            content: "Quer ganhar tempo? Clique aqui para selecionar várias transações de uma vez. Uma barra de ações aparecerá para você editar categorias em lote!",
            position: 'bottom-start'
        },
        {
            targetId: null, // Center (since category icon is generic)
            title: "Mudar Categoria",
            content: "Organização é tudo! Para mudar a categoria de um gasto, basta clicar no ícone ou nome da categoria na tabela. Se selecionar vários itens, você pode categorizar todos juntos como eu te mostrei antes.",
            position: 'center'
        },
        {
            targetId: null,
            title: "Pronto para organizar!",
            content: "Agora você já sabe como deixar suas faturas impecáveis. Qualquer dúvida, estou por aqui!",
            position: 'center'
        }
    ];

    const currentStep = steps[step];

    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    // Poll for rect updates
    useEffect(() => {
        if (!currentStep.targetId || !isOpen) {
            setTargetRect(null);
            return;
        }

        const updateRect = () => {
            const el = document.getElementById(currentStep.targetId!);
            if (el) {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    setTargetRect(rect);
                }
            }
        };

        updateRect();
        const interval = setInterval(updateRect, 100);
        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect, true);

        return () => {
            clearInterval(interval);
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect, true);
        };
    }, [currentStep.targetId, isOpen]);

    const isCentered = !currentStep.targetId;

    // Position Calculation Logic
    let tooltipCords: any = {};
    let arrowStyle: any = {};

    if (!isCentered && !isMobile && targetRect) {
        if (currentStep.targetId === 'card-settings-trigger') {
            tooltipCords = {
                top: targetRect.bottom + 15,
                left: targetRect.left - 300,
                width: 350
            };
            arrowStyle = {
                top: -8,
                right: 20,
                transform: 'rotate(45deg)'
            };
        } else if (currentStep.targetId === 'select-all-checkbox') {
            tooltipCords = {
                top: targetRect.bottom + 15,
                left: targetRect.left,
                width: 350
            };
            arrowStyle = {
                top: -8,
                left: 20,
                transform: 'rotate(45deg)'
            };
        }
    }

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] overflow-hidden">
            {/* Backdrop */}
            {(isCentered || isMobile) && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />
            )}

            {/* Spotlight Overlay */}
            {!isCentered && !isMobile && <Spotlight targetId={currentStep.targetId} />}

            {/* Content Container */}
            <div className={`fixed inset-0 flex pointer-events-none z-[110] ${isCentered || isMobile ? 'items-end justify-center sm:items-center' : ''}`}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ duration: 0.4, type: "spring" }}
                        className={`pointer-events-auto relative ${isCentered || isMobile ? 'w-full max-w-md mx-4 mb-6 sm:mb-0' : 'absolute'}`}
                        style={(!isCentered && !isMobile && targetRect) ? tooltipCords : {}}
                    >
                        {/* Coinzinha Character */}
                        <div className={`absolute ${isCentered || isMobile
                            ? '-top-16 left-1/2 -translate-x-1/2'
                            : '-top-16 -left-12'
                            }`}>
                            <motion.img
                                key={`img-${step}`}
                                initial={{ scale: 0, rotate: -10 }}
                                animate={{ scale: 1, rotate: 0 }}
                                src={coinzinhaImg}
                                className="w-32 h-32 object-contain drop-shadow-2xl z-20 relative"
                                alt="Coinzinha"
                            />
                        </div>

                        {/* Card Content - Dark Theme */}
                        <div className="bg-[#30302E] text-white rounded-2xl p-6 shadow-2xl border border-gray-700 relative overflow-visible mt-4">
                            {/* Arrow/Tail */}
                            {!isCentered && !isMobile && (
                                <div
                                    className="absolute w-4 h-4 bg-[#30302E] border-t border-l border-gray-700"
                                    style={arrowStyle}
                                />
                            )}

                            <div className="relative z-10">
                                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                                    {step === steps.length - 1 ? <CheckCircle size={18} className="text-green-500" /> : <Sparkles size={18} className="text-[#d97757]" />}
                                    {currentStep.title}
                                </h3>

                                <p className="text-gray-300 mb-6 text-sm leading-relaxed">
                                    {currentStep.content}
                                </p>

                                <div className="flex items-center justify-between border-t border-gray-700 pt-4">
                                    <div className="flex gap-1.5">
                                        {steps.map((_, i) => (
                                            <div
                                                key={i}
                                                className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-[#d97757]' : 'w-1.5 bg-gray-600'}`}
                                            />
                                        ))}
                                    </div>

                                    <div className="flex gap-2">
                                        {step > 0 && (
                                            <button
                                                onClick={prevStep}
                                                className="text-gray-400 hover:text-white px-3 py-2 rounded-lg font-bold text-xs transition-all"
                                            >
                                                Voltar
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                if (step < steps.length - 1) nextStep();
                                                else onClose();
                                            }}
                                            className="bg-[#d97757] hover:bg-[#b56044] text-white px-5 py-2 rounded-lg font-bold text-xs shadow-lg transition-all flex items-center gap-2"
                                        >
                                            {step === steps.length - 1 ? 'Entendi!' : 'Próximo'}
                                            <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Skip Button */}
            <button
                onClick={onClose}
                className="fixed top-24 right-6 text-white/50 hover:text-white pointer-events-auto z-[10000] flex items-center gap-2 text-sm font-medium transition-colors"
            >
                Pular Tutorial <X size={16} />
            </button>
        </div>,
        document.body
    );
};
