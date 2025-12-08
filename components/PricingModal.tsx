import React, { useState } from 'react';
import { X, Check, Puzzle, Rocket, Users } from 'lucide-react';
import { User } from '../types';
import { CheckoutForm } from './CheckoutForm';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan?: User['subscription']['plan'];
  onSelectPlan: (plan: 'starter' | 'pro' | 'family', cycle: 'monthly' | 'annual', cardData?: any, holderInfo?: any) => Promise<void>;
}

export const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose, currentPlan = 'starter', onSelectPlan }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [view, setView] = useState<'plans' | 'checkout'>('plans');
  const [selectedPlan, setSelectedPlan] = useState<{id: 'starter' | 'pro' | 'family', name: string, price: number} | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  // Dados atualizados conforme a imagem enviada
  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: 0,
      annualPrice: 0,
      description: 'Para quem está começando a se organizar.',
      features: [
        'Dashboard completo',
        'Lançamentos manuais',
        'Orçamentos básicos',
        'Aurora IA (limitada)',
        '1 conta bancária'
      ],
      icon: Puzzle,
      buttonText: 'Começar Grátis',
      popular: false
    },
    {
      id: 'pro',
      name: 'Plus',
      price: 34.90,
      annualPrice: 399.00,
      description: 'Todos os recursos avançados agora acessíveis.',
      features: [
        'Tudo do Gratuito',
        'Open Finance ilimitado',
        'Aurora IA ilimitada',
        'Consultor IA completo',
        'Módulo FIRE',
        'Relatórios avançados'
      ],
      icon: Rocket,
      buttonText: 'Assinar Plus',
      popular: true
    },
    {
      id: 'family',
      name: 'Family',
      price: 69.90,
      annualPrice: 749.00,
      description: 'Gestão completa para toda a casa.',
      features: [
        'Tudo do Plus',
        'Até 3 perfis familiares',
        'Visão consolidada',
        'Metas compartilhadas',
        'Suporte prioritário'
      ],
      icon: Users,
      buttonText: 'Assinar Family',
      popular: false
    }
  ];

  const handleSelectClick = async (planId: 'starter' | 'pro' | 'family', name: string, price: number) => {
      // Se o preço for 0, processa direto sem checkout (simulação) ou abre checkout se necessário
      if (price === 0) {
          await onSelectPlan(planId, billingCycle);
          return;
      }
      setSelectedPlan({ id: planId, name, price });
      setView('checkout');
  };

  const handleCheckoutSubmit = async (cardData: any, holderInfo: any) => {
      if (!selectedPlan) return;
      setIsLoading(true);
      try {
          await onSelectPlan(selectedPlan.id, billingCycle, cardData, holderInfo);
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in font-sans">
      {view === 'plans' ? (
        <div className="relative w-full max-w-6xl mx-auto">
          {/* Botão de Fechar */}
          <button 
            onClick={onClose} 
            className="absolute -top-12 right-0 p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>

          {/* Grid de Planos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const Icon = plan.icon;
              
              return (
                <div
                  key={plan.id}
                  className={`
                    relative flex flex-col p-8 rounded-3xl border transition-all duration-300
                    ${plan.popular
                      ? 'bg-[#1e1e1e] border-[#d97757] shadow-xl shadow-orange-900/10 transform md:-translate-y-2'
                      : 'bg-[#111111] border-gray-800 hover:border-gray-700'}
                  `}
                >
                  {/* Etiqueta Mais Popular (Estilo aba no topo direito) */}
                  {plan.popular && (
                    <div className="absolute -top-4 right-4 bg-[#d97757] text-white text-[10px] font-bold px-3 py-1 rounded-md uppercase tracking-wide shadow-lg">
                      Mais Popular
                    </div>
                  )}

                  {/* Ícone Centralizado */}
                  <div className="flex justify-center mb-6">
                    <div className={`
                      text-4xl 
                      ${plan.id === 'starter' ? 'text-[#8B5CF6] drop-shadow-lg' : ''} 
                      ${plan.id === 'pro' ? 'text-[#d97757] drop-shadow-lg' : ''} 
                      ${plan.id === 'family' ? 'text-[#D4B996] drop-shadow-lg' : ''}
                    `}>
                        {/* Renderizando o ícone com cor específica de estilo "cobre/ouro" para Family/Starter se quiser, ou usando classes de cor */}
                        <Icon 
                            size={48} 
                            weight="fill"
                            className={`
                                ${plan.id === 'starter' ? 'fill-stone-600 text-stone-400' : ''}
                                ${plan.id === 'pro' ? 'fill-[#d97757]/20 text-[#d97757]' : ''}
                                ${plan.id === 'family' ? 'fill-stone-600 text-stone-400' : ''}
                            `}
                        />
                    </div>
                  </div>

                  {/* Conteúdo alinhado à esquerda */}
                  <div className="text-left mb-8">
                    <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                    <p className="text-gray-500 text-sm h-10 leading-snug">{plan.description}</p>
                  </div>

                  <div className="text-left mb-8">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-white">R$ {plan.price}</span>
                      <span className="text-gray-500 text-sm font-normal">/mês</span>
                    </div>
                  </div>

                  {/* Lista de Features */}
                  <div className="flex-1 space-y-4 mb-8">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-sm text-gray-300">
                        {/* Ícone de Check simples sem fundo circular, igual a imagem */}
                        <Check size={16} className={`min-w-[16px] ${plan.popular ? 'text-[#d97757]' : 'text-gray-500'}`} />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Botão */}
                  <button
                    onClick={() => handleSelectClick(plan.id as any, plan.name, plan.price)}
                    className={`
                      w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-300
                      ${plan.popular
                        ? 'bg-[#d97757] hover:bg-[#c56a4d] text-white shadow-lg shadow-[#d97757]/20'
                        : 'bg-transparent border border-gray-700 text-white hover:border-gray-500 hover:bg-gray-800/50'}
                    `}
                  >
                    {plan.buttonText}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-gray-950 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl relative border border-gray-800">
          <div className="sticky top-0 bg-gray-950/95 backdrop-blur z-10 p-6 border-b border-gray-800 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white">Finalizar Assinatura</h2>
              <p className="text-gray-400 text-sm">Complete os dados para prosseguir</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>

          <CheckoutForm
            planName={selectedPlan?.name || ''}
            price={selectedPlan?.price || 0}
            onSubmit={handleCheckoutSubmit}
            onBack={() => setView('plans')}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  );
};