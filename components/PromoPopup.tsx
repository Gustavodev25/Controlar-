import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink } from './Icons';

export interface PromoPopupData {
    id: string;
    title: string;
    message: string;
    imageUrl?: string;
    buttonText?: string;
    buttonLink?: string;
    type?: 'info' | 'promo' | 'update';
    dismissible?: boolean;
    expiresAt?: string;
}

interface PromoPopupProps {
    popup: PromoPopupData | null;
    onDismiss: (id: string) => void;
}

export const PromoPopup: React.FC<PromoPopupProps> = ({ popup, onDismiss }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (popup) {
            const timer = setTimeout(() => setIsVisible(true), 100);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [popup]);

    const handleDismiss = () => {
        setIsVisible(false);
        if (popup) {
            setTimeout(() => onDismiss(popup.id), 300);
        }
    };

    const handleButtonClick = () => {
        if (popup?.buttonLink) {
            window.open(popup.buttonLink, '_blank');
        }
        handleDismiss();
    };

    if (!popup) return null;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{
                        type: 'spring',
                        stiffness: 300,
                        damping: 25,
                        duration: 0.4
                    }}
                    className="fixed bottom-6 right-6 z-[9999] w-[340px] max-w-[calc(100vw-48px)]"
                >
                    <div className="relative overflow-hidden rounded-2xl bg-[#30302E] border border-[#373734] shadow-2xl shadow-black/40 flex flex-col">
                        {/* Close Button */}
                        {popup.dismissible !== false && (
                            <button
                                onClick={handleDismiss}
                                className="absolute top-3 right-3 z-20 p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        )}

                        {/* Image - only show if exists */}
                        {popup.imageUrl && (
                            <div className="w-full h-40 relative shrink-0">
                                <img
                                    src={popup.imageUrl}
                                    alt={popup.title}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        )}

                        {/* Content */}
                        <div className="p-6 flex-1 flex flex-col justify-center">
                            {/* Title */}
                            <h3 className="text-white font-bold text-lg mb-2 leading-tight pr-6">
                                {popup.title}
                            </h3>

                            {/* Message */}
                            <p className="text-gray-400 text-sm leading-relaxed mb-4">
                                {popup.message}
                            </p>

                            {/* Button */}
                            {popup.buttonText && (
                                <button
                                    onClick={handleButtonClick}
                                    className="self-start py-2 px-5 rounded-lg border border-white/20 text-white font-bold text-sm hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                                >
                                    {popup.buttonText}
                                    {popup.buttonLink && <ExternalLink size={14} />}
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default PromoPopup;
