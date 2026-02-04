import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from './Icons';

interface UniversalModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: React.ReactNode;
    subtitle?: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    themeColor?: string; // Default: #d97757 (The orange/brand color)
    width?: string; // Default: max-w-lg
    zIndex?: string; // Default: z-[100]
    banner?: React.ReactNode;
}

export const UniversalModal: React.FC<UniversalModalProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    icon,
    children,
    footer,
    themeColor = '#d97757',
    width = 'max-w-lg',
    zIndex = 'z-[100]',
    banner
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        if (isOpen) {
            setIsVisible(true);
            // Small delay to ensure render before animation starts
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsAnimating(true);
                });
            });
        } else {
            setIsAnimating(false);
            timeoutId = setTimeout(() => {
                setIsVisible(false);
            }, 300);
        }
        return () => clearTimeout(timeoutId);
    }, [isOpen]);

    if (!isVisible) return null;

    return createPortal(
        <div
            className={`fixed inset-0 ${zIndex} flex items-center justify-center p-4 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${isAnimating ? 'backdrop-blur-md bg-black/60' : 'backdrop-blur-none bg-black/0'}`}
            style={isAnimating ? { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } : undefined}
        >
            <div
                className={`bg-gray-950 rounded-3xl shadow-2xl w-full ${width} overflow-hidden border border-gray-800 flex flex-col max-h-[90vh] relative transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}`}
            >

                {/* Background Glow */}
                <div
                    className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 opacity-20"
                    style={{ backgroundColor: themeColor }}
                />

                {/* Header */}
                <div className="p-5 border-b border-gray-800/50 flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-3">
                        {icon && (
                            <div
                                className="p-2.5 rounded-xl border flex items-center justify-center"
                                style={{
                                    backgroundColor: `${themeColor}1A`, // 10% opacity (hex alpha)
                                    borderColor: `${themeColor}33` // 20% opacity (hex alpha)
                                }}
                            >
                                <div style={{ color: themeColor }}>
                                    {icon}
                                </div>
                            </div>
                        )}
                        <div>
                            {typeof title === 'string' ? (
                                <h3 className="text-base font-semibold text-white">{title}</h3>
                            ) : (
                                title
                            )}
                            {subtitle && (
                                <p className="text-xs text-gray-500">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800/50 rounded-lg transition-all">
                        <X size={18} />
                    </button>
                </div>

                {/* Banner (Optional) */}
                {banner}

                {/* Content */}
                <div className="flex-1 relative z-10 p-5 overflow-y-auto custom-scrollbar">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="px-5 py-4 border-t border-gray-800/50 relative z-10">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

// Sub-components for standardized layout
interface ModalSectionProps {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
    iconClassName?: string; // e.g. text-amber-500
}

export const ModalSection: React.FC<ModalSectionProps> = ({ icon, title, children, iconClassName }) => (
    <div className="space-y-3">
        <div className="flex items-center gap-2">
            <div className={iconClassName}>{icon}</div>
            <h4 className="text-sm font-bold text-white">{title}</h4>
        </div>
        <div>
            {children}
        </div>
    </div>
);

export const ModalDivider = () => (
    <div className="border-t border-gray-800/50 my-6" />
);
