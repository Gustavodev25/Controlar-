import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'dark';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
  // Sobrescrevemos o onClick para permitir retorno de Promise explicitamente
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<void> | Promise<any>;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-[#d97757] hover:bg-[#c56a4d] text-white border border-transparent shadow-lg shadow-[#d97757]/20',
  secondary: 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700',
  danger: 'bg-[#d97757] hover:bg-[#c56a4d] text-white border border-transparent shadow-lg shadow-[#d97757]/20',
  success: 'bg-[#d97757] hover:bg-[#c56a4d] text-white border border-transparent shadow-lg shadow-[#d97757]/20',
  ghost: 'bg-transparent hover:bg-white/5 text-white hover:text-gray-200',
  dark: 'bg-gray-900 hover:bg-gray-800 text-white border border-gray-800',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  children,
  disabled,
  onClick,
  className = '',
  ...props
}) => {
  // Estado interno para gerenciar o loading automático quando a função é async
  const [isInternalLoading, setIsInternalLoading] = useState(false);

  const isBusy = isLoading || isInternalLoading;
  const isDisabled = disabled || isBusy;

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!onClick || isDisabled) return;

    const result = onClick(e);

    // Verifica se o resultado é uma Promise (função async)
    if (result && result instanceof Promise) {
      setIsInternalLoading(true);
      try {
        await result;
      } catch (error) {
        console.error("Button action failed:", error);
      } finally {
        setIsInternalLoading(false);
      }
    }
  };

  return (
    <button
      disabled={isDisabled}
      onClick={handleClick}
      className={`
        relative
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        inline-flex items-center justify-center gap-2
        rounded-lg font-medium transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#d97757]/50
        active:scale-[0.98]
        disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100
        ${className}
      `}
      {...props}
    >
      {/* O conteúdo fica invisível durante o loading para manter a largura do botão fixa */}
      <div className={`flex items-center gap-2 ${isBusy ? 'opacity-0' : 'opacity-100'}`}>
        {children}
      </div>

      {/* Loader posicionado no centro absoluto */}
      {isBusy && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={size === 'lg' ? 20 : 16} className="animate-spin" />
        </div>
      )}
    </button>
  );
};