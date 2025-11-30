import React, { ReactNode } from 'react';
import { Plus } from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  image?: string;
  className?: string;
  /** Altura mínima para garantir presença na tela. Default: min-h-[350px] */
  minHeight?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  image = '/assets/empty.png', // Sempre usa empty.png por padrão
  className = '',
  minHeight = 'min-h-[350px]'
}) => {
  // Define qual visual mostrar: Sempre prioriza a imagem (empty.png), a menos que seja explicitamente passado um ícone
  const imageSrc = icon ? undefined : image;

  return (
    <div 
      className={`
        relative w-full bg-gray-950 border border-gray-800 rounded-2xl 
        p-8 lg:p-12 flex flex-col items-center justify-center text-center 
        overflow-hidden group transition-all duration-300 hover:border-gray-700
        ${minHeight} ${className}
      `}
    >
      {/* Definição da Animação de Flutuação (Injetada via style tag para funcionar imediatamente) */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
      `}</style>

      {/* Glow de Fundo (Efeito de luz laranja suave que aparece no hover) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[#d97757]/5 rounded-full blur-[80px] pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity duration-700" />

      {/* Conteúdo Centralizado */}
      <div className="relative z-10 flex flex-col items-center max-w-sm">
        
        {/* Container Visual (Imagem ou Ícone) - Sem círculo, sem borda */}
        <div className="mb-6 relative group/visual">
          
          {/* Aura suave atrás da imagem (apenas luz, sem forma definida) */}
          <div className="absolute inset-0 bg-[#d97757]/10 blur-2xl opacity-0 group-hover/visual:opacity-100 transition-opacity duration-500 rounded-full" />
          
          {/* Wrapper que controla o Zoom no Hover */}
          <div className="relative z-10 transition-transform duration-500 ease-out group-hover:scale-105">
            {imageSrc ? (
              <img 
                src={imageSrc} 
                alt={title} 
                // AQUI: Apliquei a animação de flutuação diretamente no estilo
                style={{ animation: 'float 6s ease-in-out infinite' }}
                className="w-40 h-40 object-contain opacity-70 grayscale-[20%] group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
                onError={(e) => {
                    e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div 
                // Apliquei a flutuação no ícone também, caso não tenha imagem
                style={{ animation: 'float 6s ease-in-out infinite' }}
                className="text-[#d97757] opacity-80 group-hover:opacity-100 transition-opacity scale-150 p-4"
              >
                {icon}
              </div>
            )}
          </div>
        </div>

        {/* Textos */}
        <h4 className="text-white font-bold text-xl mb-2 tracking-tight group-hover:text-gray-100 transition-colors">
          {title}
        </h4>
        <p className="text-gray-400 text-sm leading-relaxed mb-8 font-light">
          {description}
        </p>

        {/* Botão de Ação */}
        {action && (
          <button
            onClick={action.onClick}
            className="group/btn relative px-6 py-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-[#d97757]/20 hover:shadow-[#d97757]/40 hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 overflow-hidden"
          >
            <Plus size={16} className="group-hover/btn:rotate-90 transition-transform duration-300" />
            <span className="relative z-10">{action.label}</span>
          </button>
        )}
      </div>
    </div>
  );
};