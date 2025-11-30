import React, { useState } from 'react';
import { Check, ChevronLeft, Sparkles, CheckCircle } from 'lucide-react';
import { User } from '../types';
import { CheckoutForm } from './CheckoutForm';
import { createCheckoutSession } from '../services/subscriptionService';
import { useToasts } from './Toast';
import quebraCabecaImg from '../assets/quebra-cabeca.png';
import fogueteImg from '../assets/foguete.png';
import familiaImg from '../assets/familia.png';

import NumberFlow from '@number-flow/react';
import { motion } from 'framer-motion';

interface SubscriptionPageProps {
  user: User;
  onBack: () => void;
  onUpdateUser: (user: User) => Promise<void>;
}

export const SubscriptionPage: React.FC<SubscriptionPageProps> = ({ user, onBack, onUpdateUser }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [view, setView] = useState<'plans' | 'checkout'>('plans');
  const [selectedPlan, setSelectedPlan] = useState<{id: 'starter' | 'pro' | 'family', name: string, price: number} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToasts();

  const currentPlan = user.subscription?.plan || 'starter';

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: 0,
      image: quebraCabecaImg,
      description: 'Para quem está começando a se organizar.',
      features: [
        'Controle de Despesas e Receitas',
        'Dashboard Básico',
        '1 Carteira de Investimentos',
        'Sem contas conectadas'
      ],
      popular: false
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 19.90,
      annualPrice: 199.90,
      image: fogueteImg,
      description: 'Recursos avançados para quem quer ir além.',
      features: [
        'Tudo do Starter',
        'Contas Bancárias Ilimitadas',
        'Assistente IA Ilimitado',
        'Planejamento de Metas Avançado',
        'Simulador FIRE Completo'
      ],
      popular: true
    },
    {
      id: 'family',
      name: 'Family',
      price: 59.90,
      annualPrice: 599.90,
      image: familiaImg,
      description: 'Gestão financeira completa para toda a família.',
      features: [
        'Tudo do Pro',
        'Até 5 membros da família',
        'Visão unificada de gastos',
        'Metas compartilhadas',
        'Controle de permissões'
      ],
      popular: false
    }
  ];

  const handleSelectClick = async (planId: 'starter' | 'pro' | 'family', name: string, price: number) => {
      if (planId === 'starter') {
          handleCheckoutSubmit({}, {}, planId, 'monthly'); 
          return;
      }
      setSelectedPlan({ id: planId, name, price });
      setView('checkout');
  };

  const handleCheckoutSubmit = async (cardData: any, holderInfo: any, planIdOverride?: 'starter' | 'pro' | 'family', cycleOverride?: 'monthly' | 'annual') => {
      const planToBuy = planIdOverride || selectedPlan?.id;
      const cycleToBuy = cycleOverride || billingCycle;
      
      if (!planToBuy) return;

      setIsLoading(true);
      try {
          await createCheckoutSession(
              user.email, 
              planToBuy, 
              cycleToBuy, 
              undefined, 
              user.name, 
              cardData, 
              holderInfo
          );

          const newSubscription = {
            plan: planToBuy,
            status: 'active' as const,
            billingCycle: cycleToBuy,
            nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            paymentMethod: 'CREDIT_CARD'
          };

          const updatedUser = {
             ...user,
             subscription: newSubscription as any
          };

          // Sanitize to remove undefined values which Firestore rejects
          await onUpdateUser(JSON.parse(JSON.stringify(updatedUser)));

          toast.success(`Plano ${planToBuy.charAt(0).toUpperCase() + planToBuy.slice(1)} ativado com sucesso!`);
          onBack();

      } catch (err: any) {
          console.error(err);
          toast.error(err.message || "Erro ao processar assinatura.");
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="min-h-full bg-gray-950 animate-fade-in flex flex-col">
        {/* Header */}
        <div className="p-4 lg:p-6 flex items-center gap-3 sticky top-0 z-10 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/50">
            <button 
                onClick={onBack}
                className="p-1.5 hover:bg-gray-800 rounded-xl text-gray-400 hover:text-white transition-colors"
            >
                <ChevronLeft size={20} />
            </button>
            <div>
                <h1 className="text-xl font-bold text-white">
                    {view === 'checkout' ? 'Finalizar Assinatura' : 'Planos e Preços'}
                </h1>
                <p className="text-xs text-gray-400">
                    {view === 'checkout' ? 'Dados de pagamento seguros' : 'Escolha o melhor para sua vida financeira'}
                </p>
            </div>
        </div>

        <div className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
            {view === 'plans' ? (
                <div className="space-y-12">
                    {/* Billing Toggle */}
                    <div className="flex justify-center">
                        <div className="bg-[#363735] p-1.5 rounded-full border border-white/5 flex items-center relative backdrop-blur-sm">
                            <button
                                onClick={() => setBillingCycle('monthly')}
                                className={`relative z-10 px-8 py-2.5 rounded-full text-sm font-bold transition-colors duration-300 ${billingCycle === 'monthly' ? 'text-white' : 'text-gray-400 hover:text-gray-200'}`}
                            >
                                {billingCycle === 'monthly' && (
                                    <motion.div
                                        layoutId="billing-pill"
                                        className="absolute inset-0 bg-[#d97757] rounded-full shadow-lg shadow-[#d97757]/20"
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}
                                <span className="relative z-10">Mensal</span>
                            </button>
                            <button
                                onClick={() => setBillingCycle('annual')}
                                className={`relative z-10 px-8 py-2.5 rounded-full text-sm font-bold transition-colors duration-300 flex items-center gap-2 ${billingCycle === 'annual' ? 'text-white' : 'text-gray-400 hover:text-gray-200'}`}
                            >
                                {billingCycle === 'annual' && (
                                    <motion.div
                                        layoutId="billing-pill"
                                        className="absolute inset-0 bg-[#d97757] rounded-full shadow-lg shadow-[#d97757]/20"
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}
                                <span className="relative z-10">Anual</span>
                                <span className={`relative z-10 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${billingCycle === 'annual' ? 'bg-white text-[#d97757]' : 'bg-[#d97757]/10 text-[#d97757] border border-[#d97757]/20'}`}>
                                    -16%
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Cards Grid */}
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
                        {plans.map((plan) => {
                            const isCurrent = currentPlan === plan.id;
                            const price = billingCycle === 'monthly' ? plan.price : (plan.annualPrice ? plan.annualPrice / 12 : 0);
                            const isPro = plan.popular;

                            const containerClasses = isPro
                                ? "bg-gradient-to-br from-[#3d3835] to-[#363735] border-2 border-[#d97757] rounded-3xl p-6 lg:p-8 flex flex-col relative shadow-2xl shadow-[#d97757]/20 lg:transform lg:scale-105 hover:shadow-[#d97757]/30 transition-all duration-300"
                                : "bg-gradient-to-br from-[#3A3B39] to-[#363735] border border-[#3A3B39] rounded-3xl p-8 flex flex-col relative hover:border-[#d97757]/40 hover:shadow-xl hover:shadow-[#d97757]/10 transition-all duration-300";

                            const checkIcon = <div className={`${(isPro || plan.id === 'family') ? 'bg-[#d97757]/10 border border-[#d97757]/30' : 'bg-gray-800/50 border border-gray-700/50'} rounded-full p-1`}>
                                <Check size={14} className={`${(isPro || plan.id === 'family') ? 'text-[#d97757]' : 'text-gray-500'}`}/>
                            </div>;

                            const textColor = "text-gray-300";

                            return (
                                <motion.div
                                    key={plan.id}
                                    className={containerClasses}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: plans.indexOf(plan) * 0.1 }}
                                    whileHover={{ y: -8 }}
                                >
                                    {isPro && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#d97757] to-[#e88864] text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg shadow-[#d97757]/30 flex items-center gap-1.5">
                                            <Sparkles size={12} />
                                            MAIS POPULAR
                                        </div>
                                    )}

                                    {isCurrent && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg shadow-green-500/30 flex items-center gap-1.5">
                                            <CheckCircle size={12} />
                                            PLANO ATIVO
                                        </div>
                                    )}

                                    <div className={`flex justify-center mb-6 ${isPro ? 'mt-4' : ''} ${isCurrent ? 'mt-4' : ''}`}>
                                        <div className={`${isPro ? 'bg-[#d97757]/10 border-2 border-[#d97757]/20' : 'bg-gray-800/30 border border-gray-700/30'} rounded-2xl p-4 backdrop-blur-sm`}>
                                            <img src={plan.image} alt={plan.name} className="w-16 h-16 object-contain" />
                                        </div>
                                    </div>

                                    <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2 justify-center">
                                        {plan.name}
                                    </h3>

                                    <p className="text-sm mb-6 text-center text-gray-400 min-h-[40px]">
                                        {plan.description}
                                    </p>

                                    <div className="mb-8 text-center">
                                        <div className={`${isPro ? 'bg-[#d97757]/5 border border-[#d97757]/10' : 'bg-gray-800/30 border border-gray-700/30'} rounded-2xl py-4 px-6 inline-block`}>
                                            <span className={`text-5xl font-bold ${isPro ? 'bg-gradient-to-r from-[#d97757] to-[#e88864] bg-clip-text text-transparent' : 'text-white'}`}>
                                              <NumberFlow
                                                value={price}
                                                format={{ style: 'currency', currency: 'BRL' }}
                                                locales="pt-BR"
                                              />
                                            </span>
                                            <span className="text-gray-500 text-sm block mt-1">/mês</span>
                                            {billingCycle === 'annual' && plan.annualPrice && (
                                                <span className="text-xs text-gray-600 block mt-2">
                                                    ou R$ {plan.annualPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /ano
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className={`${isPro ? 'bg-[#d97757]/5 border border-[#d97757]/10' : 'bg-gray-800/20 border border-gray-700/20'} rounded-2xl p-4 mb-6 flex-1`}>
                                        <ul className="space-y-3">
                                            {plan.features.map((feature, idx) => (
                                                <li key={idx} className={`flex items-start gap-3 text-sm ${textColor}`}>
                                                    {checkIcon}
                                                    <span className="flex-1 leading-relaxed">{feature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <button
                                        onClick={() => handleSelectClick(plan.id as any, plan.name, billingCycle === 'monthly' ? plan.price : (plan.annualPrice || 0))}
                                        disabled={isCurrent}
                                        className={`
                                            w-full py-4 rounded-xl font-bold transition-all duration-300 relative overflow-hidden group
                                            ${isCurrent
                                                ? 'bg-gray-800/50 text-gray-500 cursor-default border border-gray-700/50'
                                                : isPro
                                                    ? 'bg-gradient-to-r from-[#d97757] to-[#e88864] hover:from-[#c56a4d] hover:to-[#d97757] text-white shadow-lg shadow-[#d97757]/25 hover:shadow-[#d97757]/40 hover:scale-[1.02]'
                                                    : 'border-2 border-[#d97757]/30 text-white hover:bg-[#d97757]/10 hover:border-[#d97757]/50 hover:scale-[1.02]'}
                                        `}
                                    >
                                        <span className="relative z-10">
                                            {isCurrent ? 'Plano Atual' : (plan.price === 0 ? 'Começar Grátis' : (billingCycle === 'annual' ? `Assinar por R$ ${plan.annualPrice?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Assinar Agora'))}
                                        </span>
                                        {!isCurrent && isPro && (
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                                        )}
                                    </button>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <CheckoutForm
                    planName={selectedPlan?.name || ''}
                    price={selectedPlan?.price || 0}
                    onSubmit={handleCheckoutSubmit}
                    onBack={() => setView('plans')}
                    isLoading={isLoading}
                />
            )}
        </div>
    </div>
  );
};
