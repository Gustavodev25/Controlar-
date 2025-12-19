import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, CheckCircle, ChevronRight, X, Sparkles } from 'lucide-react';
import coinzinhaImg from '../assets/coinzinha.png';
import { createPortal } from 'react-dom';

interface ProOnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
    // These props are less relevant for the pure walkthrough but keeping for compatibility if needed
    userName: string;
    onConnectBank: () => void;
    onComplete: () => void;
    toggles: {
        includeChecking: boolean;
        setIncludeChecking: (val: boolean) => void;
        includeCredit: boolean;
        setIncludeCredit: (val: boolean) => void;
    };
    onNavigateTo?: (tab: string) => void;
}

// Spotlight Component
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



export const ProOnboardingModal: React.FC<ProOnboardingModalProps> = ({
    isOpen,
    onClose,
    userName,
    onComplete,
    onNavigateTo
}) => {
    // Check for mobile - Moved to top to avoid hook errors
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
            title: "Bem-vindo ao Modo Pro!",
            content: `Olá, ${userName.split(' ')[0]}! Eu sou o Coinzinha, seu novo copiloto financeiro. Vou te mostrar onde ficam seus superpoderes.`,
            position: 'center'
        },
        {
            title: "Conexões Bancárias",
            content: "Aqui você conecta seus bancos e cartões. O sistema puxa tudo automaticamente via Open Finance seguro.",
            position: 'right-start'
        },
        {
            targetId: 'open-finance-connect-btn',
            title: "Conectar Nova Conta",
            content: "É só clicar aqui para adicionar uma nova instituição. Simples e rápido!",
            position: 'bottom' // Tooltip below button
        },
        {
            targetId: 'sidebar-nav-overview',
            title: "Visão Geral",
            content: "Aqui você tem o resumo de todas as suas contas. Eu monitoro tudo para você não perder nada de vista!",
            position: 'right-start'
        },
        {
            targetId: 'salary-auto-mode-toggle',
            title: "Ative o Modo Auto",
            content: "Chegou a hora! Mude essa chave para 'Auto' e deixe que eu organize suas finanças automaticamente com Inteligência Artificial. Se preferir fazer tudo na mão, é só voltar para o 'Manual'.",
            position: 'bottom-end' // Assuming toggle is at top right
        },
        {
            targetId: null,
            title: "Está tudo pronto!",
            content: "O segredo da liberdade financeira não é ganhar mais, mas sim gerenciar melhor. Aproveite o Modo Pro!",
            position: 'center'
        }
    ];

    const currentStep = steps[step];

    // Navigation Effect
    useEffect(() => {
        if (!isOpen) return;

        if (currentStep.targetId === 'open-finance-connect-btn') {
            onNavigateTo?.('connections');
        } else if (currentStep.targetId === 'sidebar-nav-overview' || currentStep.targetId === 'salary-auto-mode-toggle') {
            onNavigateTo?.('dashboard');
        }
    }, [step, isOpen, onNavigateTo, currentStep?.targetId]);

    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    // Poll for rect updates to ensure accurate positioning even after navigation/animations
    useEffect(() => {
        if (!currentStep.targetId || !isOpen) {
            setTargetRect(null);
            return;
        }

        const updateRect = () => {
            const el = document.getElementById(currentStep.targetId!);
            if (el) {
                const rect = el.getBoundingClientRect();
                // Basic check to see if rect has changed significantly or is non-zero
                if (rect.width > 0 && rect.height > 0) {
                    setTargetRect(rect);
                }
            }
        };

        // Immediate check
        updateRect();

        // Fast poll for a short while (for animations/mounting) then slower
        const interval = setInterval(updateRect, 100);

        // Also listen to resize
        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect, true); // Capture scroll too

        return () => {
            clearInterval(interval);
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect, true);
        };
    }, [currentStep.targetId, isOpen]);

    const isCentered = !currentStep.targetId;

    // Calculate tooltip position relative to spotlight
    // For simplicity in this version, if centered, we center. 
    // If targeted, we check direct DOM rect of target to float nearby.
    // React Portal to body ensures we are on top of everything.

    // Position Calculation Logic
    let tooltipCords: any = {};
    let connectButtonTailStyle: any = {};

    if (!isCentered && !isMobile && targetRect) {
        if (currentStep.targetId === 'open-finance-connect-btn') {
            const tooltipWidth = 350;
            const viewportWidth = window.innerWidth;
            const margin = 20;

            // Target Center
            const btnCenter = targetRect.left + (targetRect.width / 2);

            // Ideal Left (Centered)
            let left = btnCenter - (tooltipWidth / 2);

            // Clamp to Viewport
            if (left + tooltipWidth > viewportWidth - margin) {
                left = viewportWidth - tooltipWidth - margin;
            }
            if (left < margin) {
                left = margin;
            }

            tooltipCords = {
                top: targetRect.bottom + 20,
                left: left,
                width: tooltipWidth,
                maxWidth: tooltipWidth
            };

            // Calculate Dynamic Arrow Position
            // Arrow should be at (btnCenter - left) inside the relative tooltip
            connectButtonTailStyle = {
                left: btnCenter - left,
                marginLeft: '-8px' // Center the 16px arrow
            };

        } else if (currentStep.targetId === 'salary-auto-mode-toggle') {
            tooltipCords = {
                top: targetRect.bottom + 15,
                left: targetRect.left - 280,
                transform: 'translateX(0)',
                maxWidth: '350px'
            };
        } else {
            // Default (Sidebar items)
            tooltipCords = {
                top: targetRect.top - 20,
                left: targetRect.right + 30,
                maxWidth: '350px'
            };
        }
    }

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] overflow-hidden">
            {/* Backdrop if no spotlight (spotlight handles its own backdrop) */}
            {(isCentered || isMobile) && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />
            )}

            {/* Spotlight Overlay - Hide on mobile if simpler, or keep it but separate from card pos */}
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
                            : currentStep.targetId === 'open-finance-connect-btn'
                                ? '-top-12 -left-20' // More to the left and slightly lower for the top-right button
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
                            {/* Balloon Tail */}
                            {!isCentered && !isMobile && currentStep.targetId !== 'salary-auto-mode-toggle' && currentStep.targetId !== 'open-finance-connect-btn' && (
                                <div
                                    className="absolute top-8 -left-2 w-4 h-4 bg-[#30302E] border-l border-b border-gray-700 transform rotate-45"
                                />
                            )}
                            {/* Special Tail for Toggle (Top Right) */}
                            {!isMobile && currentStep.targetId === 'salary-auto-mode-toggle' && (
                                <div
                                    className="absolute -top-2 right-10 w-4 h-4 bg-[#30302E] border-t border-l border-gray-700 transform rotate-45"
                                />
                            )}

                            {/* Special Tail for Connect Button (Top Center) */}
                            {/* Special Tail for Connect Button (Top Center relative to button which is on right side of modal) */}
                            {!isMobile && currentStep.targetId === 'open-finance-connect-btn' && (
                                <div
                                    className="absolute -top-2 w-4 h-4 bg-[#30302E] border-t border-l border-gray-700 transform rotate-45"
                                    style={connectButtonTailStyle}
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
                                                else onComplete();
                                            }}
                                            className="bg-[#d97757] hover:bg-[#b56044] text-white px-5 py-2 rounded-lg font-bold text-xs shadow-lg transition-all flex items-center gap-2"
                                        >
                                            {step === steps.length - 1 ? 'Vamos lá!' : 'Próximo'}
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
