import React, { useState } from 'react';
import { Check, ChevronLeft, Sparkles, CheckCircle } from 'lucide-react';
import { User } from '../types';
import { CheckoutForm } from './CheckoutForm';
import { useToasts } from './Toast';
import quebraCabecaImg from '../assets/quebra-cabeca.png';
import fogueteImg from '../assets/foguete.png';
import familiaImg from '../assets/familia.png';
import { toLocalISODate } from '../utils/dateUtils';

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
        'Lançamentos Manuais',
        'Dashboards Básicos',
        '1 Usuário',
        'Sem contas conectadas'
      ],
      popular: false
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 34.90,
      annualPrice: 399.00,
      image: fogueteImg,
      description: 'Todos os recursos avançados.',
      features: [
        'IA Integrada ilimitada',
        'Lançamentos por Texto',
        'Consultor Financeiro IA',
        'Metas e Lembretes',
        'Contas Bancárias Ilimitadas'
      ],
      popular: true
    },
    {
      id: 'family',
      name: 'Family',
      price: 69.90,
      annualPrice: 749.00,
      image: familiaImg,
      description: 'Gestão completa para toda a casa.',
      features: [
        'Tudo incluso no plano gratuito',
        'Até 3 Membros',
        'Metas Compartilhadas',
        'Relatórios Unificados'
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
          // Mock Checkout
          await new Promise(resolve => setTimeout(resolve, 2000));

          const newSubscription = {
            plan: planToBuy,
            status: 'active' as const,
            billingCycle: cycleToBuy,
            nextBillingDate: toLocalISODate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
            paymentMethod: 'CREDIT_CARD'
          };

          const updatedUser = {
             ...user,
             subscription: newSubscription as any,
             ...(cardData?.number ? {
                 paymentMethodDetails: {
                     last4: cardData.number.replace(/\s/g, '').slice(-4),
                     holder: cardData.holder || user.name,
                     expiry: cardData.expiry || '',
                     brand: 'mastercard'
                 }
             } : {})
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
                                    -5%
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
                                ? "bg-gray-900 border border-[#d97757] rounded-3xl p-6 lg:p-8 flex flex-col relative shadow-2xl shadow-[#d97757]/10 lg:transform lg:-translate-y-4"
                                : "bg-gray-900 border border-gray-800 rounded-3xl p-8 flex flex-col relative hover:border-gray-600 transition-colors";

                            return (
                                <motion.div
                                    key={plan.id}
                                    className={containerClasses}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: plans.indexOf(plan) * 0.1 }}
                                >
                                    {isPro && (
                                        <div className="absolute top-0 right-0 bg-[#d97757] text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl">
                                            MAIS POPULAR
                                        </div>
                                    )}

                                    {isCurrent && !isPro && (
                                        <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl">
                                            ATUAL
                                        </div>
                                    )}

                                    {isCurrent && isPro && (
                                        <div className="absolute top-0 left-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-br-xl rounded-tl-2xl">
                                            PLANO ATUAL
                                        </div>
                                    )}

                                    <div className="flex justify-center mb-4">
                                        <img src={plan.image} alt={plan.name} className="w-16 h-16 object-contain" />
                                    </div>

                                    <h3 className={`text-xl font-bold text-white mb-2 flex items-center gap-2 ${!isPro ? 'justify-center' : ''}`}>
                                        {plan.name} {isPro && <Sparkles size={16} className="text-[#d97757]" />}
                                    </h3>

                                    <p className={`text-gray-400 text-sm mb-6 ${!isPro ? 'text-center' : ''} min-h-[40px]`}>
                                        {plan.description}
                                    </p>

                                    <div className="mb-6 text-center">
                                        <span className="text-4xl font-bold text-white">
                                            <NumberFlow
                                                value={price}
                                                format={{ style: 'currency', currency: 'BRL' }}
                                                locales="pt-BR"
                                            />
                                        </span>
                                        <span className="text-gray-500">/mês</span>
                                        {billingCycle === 'annual' && plan.annualPrice && (
                                            <span className="text-xs text-gray-500 block mt-1">
                                                cobrado R$ {plan.annualPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /ano
                                            </span>
                                        )}
                                    </div>

                                    <ul className="space-y-4 mb-8 flex-1">
                                        {plan.features.map((feature, idx) => (
                                            <li key={idx} className={`flex items-center gap-3 text-sm ${isPro ? 'text-white' : 'text-gray-300'}`}>
                                                {isPro ? (
                                                    <CheckCircle size={16} className="text-[#d97757]" />
                                                ) : (
                                                    <Check size={16} className={plan.id === 'family' ? "text-[#d97757]" : "text-gray-500"} />
                                                )}
                                                <span className={isPro && idx === 0 ? 'font-bold' : ''}>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <button
                                        onClick={() => handleSelectClick(plan.id as any, plan.name, billingCycle === 'monthly' ? plan.price : (plan.annualPrice || 0))}
                                        disabled={isCurrent}
                                        className={`
                                            w-full py-3 rounded-xl font-bold transition-colors
                                            ${isCurrent
                                                ? 'bg-gray-800 text-gray-500 cursor-default border border-gray-700'
                                                : isPro
                                                    ? 'bg-[#d97757] hover:bg-[#c56a4d] text-white shadow-lg shadow-[#d97757]/25'
                                                    : 'border border-gray-700 text-white hover:bg-gray-800'
                                            }
                                        `}
                                    >
                                        {isCurrent ? 'Plano Atual' : (plan.price === 0 ? 'Começar Grátis' : (billingCycle === 'annual' ? `Assinar Anual` : 'Assinar Agora'))}
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
