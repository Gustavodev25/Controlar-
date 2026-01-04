import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, X, Check } from './Icons';

interface WalkthroughStep {
    target: string; // The data-tour-id or ID of the element to highlight
    title: string;
    content: string;
    placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface WalkthroughProps {
    steps: WalkthroughStep[];
    isActive: boolean;
    onComplete: () => void;
    onSkip: () => void;
}

export const Walkthrough: React.FC<WalkthroughProps> = ({ steps, isActive, onComplete, onSkip }) => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [stepData, setStepData] = useState<WalkthroughStep | null>(null);

    // Reset when activated
    useEffect(() => {
        if (isActive) {
            setCurrentStepIndex(0);
            document.body.style.overflow = 'hidden'; // Prevent scrolling
        } else {
            document.body.style.overflow = 'auto'; // Restore scrolling
        }
        return () => { document.body.style.overflow = 'auto'; };
    }, [isActive]);

    // Update target on step change
    useEffect(() => {
        if (!isActive) return;

        const currentStep = steps[currentStepIndex];
        if (!currentStep) return;

        // Small delay to allow for UI updates (like modals opening or tabs changing)
        const timer = setTimeout(() => {
            const element = document.querySelector(`[data-tour="${currentStep.target}"]`) || document.getElementById(currentStep.target);

            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Recalculate after scroll
                setTimeout(() => {
                    const rect = element.getBoundingClientRect();
                    setTargetRect(rect);
                    setStepData(currentStep);
                }, 500);
            } else {
                // If element not found, maybe skip or log?
                console.warn('Tour element not found:', currentStep.target);
                // Fallback to center logic if allowed or just show error?
                // Let's just center the modal if target missing
                setTargetRect(null);
                setStepData({ ...currentStep, placement: 'center' });
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [currentStepIndex, isActive, steps]);


    const handleNext = () => {
        if (currentStepIndex < steps.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
        } else {
            onComplete();
        }
    };

    if (!isActive) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] pointer-events-none">
            {/* Overlay with "Hole" */}
            {/* Since we can't easily do a true path hole without complicated SVG, 
           we'll use 4 divs to construct the mask around the targetRect or a full overlay for center. */}

            {targetRect ? (
                <>
                    {/* Top Mask */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="absolute top-0 left-0 right-0 bg-black/70 pointer-events-auto transition-all duration-300"
                        style={{ height: targetRect.top - 10 }}
                    />
                    {/* Bottom Mask */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="absolute left-0 right-0 bottom-0 bg-black/70 pointer-events-auto transition-all duration-300"
                        style={{ top: targetRect.bottom + 10 }}
                    />
                    {/* Left Mask */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="absolute left-0 bg-black/70 pointer-events-auto transition-all duration-300"
                        style={{ top: targetRect.top - 10, height: targetRect.height + 20, width: targetRect.left - 10 }}
                    />
                    {/* Right Mask */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="absolute right-0 bg-black/70 pointer-events-auto transition-all duration-300"
                        style={{ top: targetRect.top - 10, height: targetRect.height + 20, left: targetRect.right + 10 }}
                    />

                    {/* Spotlight Border (Optional) */}
                    <motion.div
                        layoutId="spotlight"
                        className="absolute rounded-lg border-2 border-[#d97757] shadow-[0_0_30px_rgba(217,119,87,0.3)] transition-all duration-300"
                        style={{
                            top: targetRect.top - 10,
                            left: targetRect.left - 10,
                            width: targetRect.width + 20,
                            height: targetRect.height + 20,
                        }}
                    />
                </>
            ) : (
                /* Full Overlay for Center or Missing Target */
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-black/70 pointer-events-auto"
                />
            )}

            {/* Popover Card */}
            <AnimatePresence mode="wait">
                {stepData && (
                    <motion.div
                        key={currentStepIndex}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute pointer-events-auto bg-[#1a1a19] border border-[#373734] rounded-xl shadow-2xl p-6 w-80 md:w-96 flex flex-col gap-4"
                        style={getPopoverStyle(targetRect, stepData.placement)}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-xs font-bold text-[#d97757] uppercase tracking-wider mb-1 block">
                                    Passo {currentStepIndex + 1} de {steps.length}
                                </span>
                                <h3 className="text-lg font-bold text-white leading-tight">
                                    {stepData.title}
                                </h3>
                            </div>
                            <button onClick={onSkip} className="text-gray-500 hover:text-white transition-colors">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="text-sm text-gray-300 leading-relaxed">
                            {stepData.content}
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <div className="flex gap-1.5">
                                {steps.map((_, i) => (
                                    <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentStepIndex ? 'w-6 bg-[#d97757]' : 'w-1.5 bg-gray-700'}`} />
                                ))}
                            </div>
                            <button
                                onClick={handleNext}
                                className="px-4 py-2 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-lg text-sm font-bold shadow-lg shadow-[#d97757]/20 flex items-center gap-2 transition-all"
                            >
                                {currentStepIndex === steps.length - 1 ? 'Concluir' : 'Próximo'}
                                {currentStepIndex < steps.length - 1 && <ChevronRight size={16} />}
                                {currentStepIndex === steps.length - 1 && <Check size={16} />}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>,
        document.body
    );
};

// Helper: Calculate Popover Position
function getPopoverStyle(targetRect: DOMRect | null, placement: string = 'center'): React.CSSProperties {
    if (!targetRect || placement === 'center') {
        return {
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
        };
    }

    const gap = 20;

    // Keep it simple for now: Basic positioning logic
    // Ideally would check viewport boundaries but keeping it lightweight.

    if (placement === 'bottom') {
        return {
            top: targetRect.bottom + gap,
            left: targetRect.left + (targetRect.width / 2),
            transform: 'translateX(-50%)' // Center horizontally relative to target
        };
    }
    if (placement === 'top') {
        return {
            top: targetRect.top - gap,
            left: targetRect.left + (targetRect.width / 2),
            transform: 'translate(-50%, -100%)'
        };
    }
    if (placement === 'right') {
        return {
            top: targetRect.top + (targetRect.height / 2),
            left: targetRect.right + gap,
            transform: 'translateY(-50%)'
        };
    }
    if (placement === 'left') {
        return {
            top: targetRect.top + (targetRect.height / 2),
            left: targetRect.left - gap,
            transform: 'translate(-100%, -50%)'
        };
    }

    return {}; // Fallback
}
