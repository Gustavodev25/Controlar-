import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Triangle warning icon
 */
const TriangleWarning = ({
    className = "",
    ...props
}: React.SVGProps<SVGSVGElement>) => (
    <svg
        className={`w-[18px] h-[18px] shrink-0 ${className}`}
        viewBox="0 0 18 18"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
    >
        <g fill="currentColor">
            <path
                d="M7.63796 3.48996L2.21295 12.89C1.60795 13.9399 2.36395 15.25 3.57495 15.25H14.425C15.636 15.25 16.392 13.9399 15.787 12.89L10.362 3.48996C9.75696 2.44996 8.24296 2.44996 7.63796 3.48996Z"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
            />
            <path
                d="M9 6.75V9.75"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
            />
            <path
                d="M9 13.5C8.448 13.5 8 13.05 8 12.5C8 11.95 8.448 11.5 9 11.5C9.552 11.5 10 11.9501 10 12.5C10 13.0499 9.552 13.5 9 13.5Z"
                fill="currentColor"
                stroke="none"
            />
        </g>
    </svg>
);

/**
 * Gradient spinner loader
 */
const Loader2Icon = ({ className = "", ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg
        className={`w-[18px] h-[18px] shrink-0 animate-spin ${className}`}
        viewBox="0 0 18 18"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
    >
        <g fill="currentColor">
            <path
                d="M9 16.25C13.0041 16.25 16.25 13.0041 16.25 9C16.25 4.99594 13.0041 1.75 9 1.75"
                fill="none"
                stroke="url(#nc-loader-2-outline-gradient-1)"
                strokeWidth="1.5"
            />
            <path
                d="M9 16.25C4.99594 16.25 1.75 13.0041 1.75 9C1.75 4.99594 4.99594 1.75 9 1.75"
                fill="none"
                stroke="url(#nc-loader-2-outline-gradient-2)"
                strokeWidth="1.5"
            />
            <circle cx="9" cy="16.25" fill="currentColor" r="0.75" stroke="none" />
            <defs>
                <linearGradient
                    id="nc-loader-2-outline-gradient-1"
                    gradientUnits="userSpaceOnUse"
                    x1="9"
                    x2="9"
                    y1="2.5"
                    y2="16.25"
                >
                    <stop stopColor="currentColor" stopOpacity="0.5" />
                    <stop offset="1" stopColor="currentColor" />
                </linearGradient>
                <linearGradient
                    id="nc-loader-2-outline-gradient-2"
                    gradientUnits="userSpaceOnUse"
                    x1="9"
                    x2="9"
                    y1="2.5"
                    y2="16.25"
                >
                    <stop stopColor="currentColor" stopOpacity="0.5" />
                    <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
            </defs>
        </g>
    </svg>
);

/**
 * Circle check icon for success state
 */
const CircleCheck = ({
    className = "",
    ...props
}: React.SVGProps<SVGSVGElement>) => (
    <svg
        className={`w-[18px] h-[18px] shrink-0 ${className}`}
        viewBox="0 0 12 12"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
    >
        <g fill="currentColor">
            <path
                d="m6,0C2.691,0,0,2.691,0,6s2.691,6,6,6,6-2.691,6-6S9.309,0,6,0Zm2.853,4.45l-3.003,4c-.13.174-.329.282-.546.298-.019.001-.036.002-.054.002-.198,0-.389-.078-.53-.219l-1.503-1.5c-.293-.292-.293-.768,0-1.061s.768-.294,1.062,0l.892.89,2.484-3.31c.248-.331.718-.4,1.05-.149.331.249.398.719.149,1.05Z"
                fill="currentColor"
                strokeWidth="0"
            />
        </g>
    </svg>
);

/**
 * Circle warning icon for error state
 */
const CircleWarning = ({
    className = "",
    ...props
}: React.SVGProps<SVGSVGElement>) => (
    <svg
        className={`w-[18px] h-[18px] shrink-0 ${className}`}
        viewBox="0 0 12 12"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
    >
        <g fill="currentColor">
            <path
                d="m6,0C2.691,0,0,2.691,0,6s2.691,6,6,6,6-2.691,6-6S9.309,0,6,0Zm-.75,3.5c0-.414.336-.75.75-.75s.75.336.75.75v3c0,.414-.336.75-.75.75s-.75-.336-.75-.75v-3Zm.75,6.25c-.482,0-.875-.393-.875-.875s.393-.875.875-.875.875.393.875.875-.393.875-.875.875Z"
                fill="currentColor"
                strokeWidth="0"
            />
        </g>
    </svg>
);

export interface ConfirmationBarProps {
    /** Additional CSS class */
    className?: string;
    /** Show/hide the component */
    isOpen?: boolean;
    /** Saving in progress state */
    isSaving?: boolean;
    /** Save success state */
    success?: boolean;
    /** Error state */
    error?: boolean;
    /** Default label */
    label?: string;
    /** Label while saving */
    savingLabel?: string;
    /** Label after successful save */
    successLabel?: string;
    /** Label on error */
    errorLabel?: string;
    /** Reset/Cancel button text */
    cancelText?: string;
    /** Save/Confirm button text */
    confirmText?: string;
    /** Reset/Cancel callback */
    onCancel?: () => void;
    /** Save/Confirm callback */
    onConfirm?: () => void;
    /** Disable all buttons */
    disabled?: boolean;
    /** Disable only Cancel button */
    cancelDisabled?: boolean;
    /** Disable only Confirm button */
    confirmDisabled?: boolean;
    /** Custom icon */
    icon?: React.ReactNode;
    /** Hide Cancel button */
    hideCancel?: boolean;
    /** Is destructive action (changes confirm button style) */
    isDestructive?: boolean;
    /** Position: 'top' or 'bottom' */
    position?: 'top' | 'bottom';
    /** Size variant */
    size?: 'sm' | 'default' | 'lg';
}

/**
 * ConfirmationBar Component
 *
 * Animated floating bar for confirmations with saving states.
 * Exactly matches the UnsavedChanges component animations.
 */
export const ConfirmationBar: React.FC<ConfirmationBarProps> = ({
    className = "",
    isOpen = false,
    isSaving = false,
    success = false,
    error = false,
    label = "Confirmar ação?",
    savingLabel = "Salvando…",
    successLabel = "Concluído!",
    errorLabel = "Ocorreu um erro",
    cancelText = "Cancelar",
    confirmText = "Confirmar",
    onCancel,
    onConfirm,
    disabled = false,
    cancelDisabled = false,
    confirmDisabled = false,
    icon,
    hideCancel = false,
    isDestructive = false,
    position = 'bottom',
    size = 'default',
}) => {
    const sizeClasses = {
        sm: 'h-10',
        default: 'h-11',
        lg: 'h-12',
    };

    const positionClasses = {
        bottom: 'bottom-6',
        top: 'top-6',
    };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    layout
                    style={{ borderRadius: 24 }}
                    initial={{ opacity: 0, y: position === 'bottom' ? 20 : -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: position === 'bottom' ? 20 : -20, scale: 0.95 }}
                    transition={{
                        type: "spring",
                        duration: 0.3,
                        bounce: 0.15,
                    }}
                    className={`
            fixed inset-x-0 z-[9999] mx-auto w-fit flex items-center gap-2 rounded-full p-2 pl-3
            text-sm font-medium shadow-lg shadow-black/20 border border-[#373734] bg-[#272725] overflow-hidden
            ${positionClasses[position]} ${sizeClasses[size]} ${className}
          `}
                    role="alert"
                    aria-live="polite"
                >
                    {/* Label with icon */}
                    <motion.div
                        layout="position"
                        className="flex items-center gap-2 text-white"
                    >
                        <AnimatePresence mode="wait" initial={false}>
                            {error ? (
                                <motion.div
                                    key="error"
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.5 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <CircleWarning className="text-red-500" />
                                </motion.div>
                            ) : success ? (
                                <motion.div
                                    key="success"
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.5 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <CircleCheck className="text-emerald-500" />
                                </motion.div>
                            ) : isSaving ? (
                                <motion.div
                                    key="saving"
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.5 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <Loader2Icon className="text-gray-400" />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="default"
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.5 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {icon ?? <TriangleWarning className={isDestructive ? "text-red-500" : "text-gray-400"} />}
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <motion.span layout="position" className="whitespace-nowrap mr-2">
                            {error
                                ? errorLabel
                                : success
                                    ? successLabel
                                    : isSaving
                                        ? savingLabel
                                        : label}
                        </motion.span>
                    </motion.div>

                    {/* Actions - animate out when saving/success/error */}
                    <AnimatePresence mode="popLayout">
                        {!isSaving && !success && !error && (
                            <motion.div
                                initial={{ opacity: 0, scale: 1, width: "auto", marginLeft: "1rem" }}
                                animate={{ opacity: 1, scale: 1, width: "auto", marginLeft: "1rem" }}
                                exit={{ opacity: 0, scale: 0.8, width: 0, marginLeft: 0 }}
                                transition={{
                                    opacity: { duration: 0.2 },
                                    scale: { duration: 0.2 },
                                    width: { duration: 0.2, ease: "easeOut" },
                                    marginLeft: { duration: 0.2, ease: "easeOut" },
                                }}
                                className="relative flex items-center gap-2 overflow-hidden pl-2"
                            >
                                {/* Gradient mask */}
                                <div
                                    className="absolute inset-y-0 left-0 w-2 z-20 pointer-events-none"
                                    style={{ background: 'linear-gradient(to right, transparent, #272725)' }}
                                />

                                {/* Buttons container with background */}
                                <div className="flex items-center gap-2 bg-[#272725] z-10">
                                    {!hideCancel && (
                                        <button
                                            onClick={onCancel}
                                            disabled={disabled || cancelDisabled}
                                            className="h-7 px-3 rounded-full bg-[#373734] hover:bg-[#4a4a47] text-gray-300 hover:text-white text-sm font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {cancelText}
                                        </button>
                                    )}
                                    <button
                                        onClick={onConfirm}
                                        disabled={disabled || confirmDisabled}
                                        className={`h-7 px-3 rounded-full text-white text-sm font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${isDestructive
                                            ? 'bg-red-500 hover:bg-red-600'
                                            : 'bg-[#d97757] hover:bg-[#c56a4d]'
                                            }`}
                                    >
                                        {confirmText}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default ConfirmationBar;
