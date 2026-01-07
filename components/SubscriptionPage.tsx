import React, { useState } from 'react';
import { Check, ChevronLeft, Sparkles, CheckCircle } from 'lucide-react';
import { User } from '../types';
import { CheckoutForm } from './CheckoutForm';
import { useToasts } from './Toast';
import quebraCabecaImg from '../assets/quebra-cabeca.png';
import fogueteImg from '../assets/foguete.png';
import { toLocalISODate } from '../utils/dateUtils';
import { API_ENDPOINTS } from '../config/api';

import NumberFlow from '@number-flow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { WordPullUp } from './WordPullUp';
import { usePixelEvent } from '../hooks/usePixelEvent';

interface SubscriptionPageProps {
    user: User;
    onBack: () => void;
    onUpdateUser: (user: User) => Promise<void>;
    initialCouponCode?: string;
    initialPlanId?: 'starter' | 'pro' | 'family';
    hideBackButton?: boolean;
}

export const SubscriptionPage: React.FC<SubscriptionPageProps> = ({
    user,
    onBack,
    onUpdateUser,
    initialCouponCode,
    initialPlanId,
    hideBackButton
}) => {
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
    const [view, setView] = useState<'plans' | 'checkout'>(initialPlanId ? 'checkout' : 'plans');
    const [selectedPlan, setSelectedPlan] = useState<{ id: 'starter' | 'pro' | 'family', name: string, price: number } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const toast = useToasts();
    const { trackEvent } = usePixelEvent();

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
            price: 35.90,
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
        }
    ];

    // Initialize selected plan from prop if available
    React.useEffect(() => {
        if (initialPlanId) {
            const plan = plans.find(p => p.id === initialPlanId);
            if (plan) {
                // Determine price based on billing cycle (default monthly)
                // Note: billingCycle state might be 'monthly' initially
                const price = billingCycle === 'monthly' ? plan.price : (plan.annualPrice ? plan.annualPrice / 12 : 0);
                setSelectedPlan({ id: plan.id as any, name: plan.name, price });
            }
        }
    }, [initialPlanId]); // Only run once on mount (or if prop changes, though likely static)

    const handleSelectClick = async (planId: 'starter' | 'pro' | 'family', name: string, price: number) => {
        if (planId === 'starter') {
            // For free plan, activate directly
            setIsLoading(true);
            try {
                const newSubscription = {
                    plan: planId,
                    status: 'active' as const,
                    billingCycle: 'monthly' as const,
                    nextBillingDate: toLocalISODate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
                };
                const updatedUser = {
                    ...user,
                    subscription: newSubscription as any,
                };
                await onUpdateUser(JSON.parse(JSON.stringify(updatedUser)));
                toast.success('Plano Starter ativado com sucesso!');
                onBack();
            } catch (err: any) {
                toast.error(err.message || "Erro ao processar.");
            } finally {
                setIsLoading(false);
            }
            return;
        }
        setSelectedPlan({ id: planId, name, price });
        setView('checkout');
    };

    const handleCheckoutSubmit = async (cardData: any, holderInfo: any, installments?: number, couponId?: string, finalPrice?: number) => {
        const planToBuy = selectedPlan?.id;
        const cycleToBuy = billingCycle;

        if (!planToBuy) return;

        setIsLoading(true);
        try {
            // Get the correct price (use finalPrice from checkout form if provided, which includes coupon discount)
            const planConfig = plans.find(p => p.id === planToBuy);
            const originalPrice = cycleToBuy === 'annual'
                ? (planConfig?.annualPrice || selectedPlan?.price || 0)
                : (planConfig?.price || selectedPlan?.price || 0);

            // Use the discounted price from checkout if provided, otherwise use original
            const finalValue = finalPrice !== undefined ? finalPrice : originalPrice;

            console.log('>>> Price calculation:', { originalPrice, finalPrice, finalValue });

            // SPECIAL CASE: If final price is less than R$ 5 (Asaas minimum), activate plan directly
            // This handles 100% discount coupons or very high discounts
            if (finalValue < 5) {
                console.log('>>> Cupom 100% detectado! Ativando plano diretamente sem cobrança...');

                const nextBillingDate = new Date();
                if (cycleToBuy === 'annual') {
                    nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
                } else {
                    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
                }

                const newSubscription = {
                    plan: planToBuy,
                    status: 'active' as const,
                    billingCycle: cycleToBuy,
                    installments: 1,
                    nextBillingDate: toLocalISODate(nextBillingDate),
                    paymentMethod: 'COUPON_100',
                    couponUsed: couponId,
                    startDate: toLocalISODate(new Date()),
                };

                const updatedUser = {
                    ...user,
                    subscription: newSubscription as any,
                    paymentMethodDetails: {
                        last4: cardData.number.replace(/\s/g, '').slice(-4),
                        holder: cardData.holderName || user.name,
                        expiry: `${cardData.expiryMonth}/${cardData.expiryYear.slice(-2)}`,
                        brand: 'credit_card'
                    }
                };

                // Meta Pixel: Purchase (Free/Coupon)
                trackEvent('Purchase', {
                    value: 0,
                    currency: 'BRL',
                    content_name: 'Assinatura Controlar+ (Cupom 100%)',
                    content_type: 'subscription',
                });

                if (planToBuy === 'pro') {
                    localStorage.setItem('show_pro_tutorial', 'true');
                    // Clear session flag to ensure tutorial shows even if user was browsing before upgrade
                    sessionStorage.removeItem('pro_tutorial_session_seen');
                }

                await onUpdateUser(JSON.parse(JSON.stringify(updatedUser)));
                toast.success('🎉 Cupom aplicado! Plano ativado com sucesso sem cobrança.');
                onBack();
                return;
            }

            // NORMAL FLOW: Value >= R$ 5, proceed with Asaas payment
            // 1. Create or update customer in Asaas
            console.log('>>> Creating customer in Asaas...');
            const customerResponse = await fetch(API_ENDPOINTS.asaas.customer, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: holderInfo.name || cardData.holderName,
                    email: user.email,
                    cpfCnpj: holderInfo.cpfCnpj,
                    phone: holderInfo.phone,
                    postalCode: holderInfo.postalCode,
                    addressNumber: holderInfo.addressNumber,
                }),
            });

            const customerData = await customerResponse.json();

            if (!customerResponse.ok || !customerData.success) {
                // Combine main error with detailed description if available
                const detail = customerData.details || '';
                const mainError = customerData.error || 'Erro ao criar cliente no Asaas.';
                const combinedError = detail ? `${mainError} ${detail}` : mainError;
                throw new Error(combinedError);
            }

            console.log('>>> Customer created:', customerData.customer.id);

            // 2. Create subscription/payment in Asaas
            console.log('>>> Creating subscription in Asaas...');
            const subscriptionResponse = await fetch(API_ENDPOINTS.asaas.subscription, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId: customerData.customer.id,
                    planId: planToBuy,
                    billingCycle: cycleToBuy,
                    value: finalValue,
                    baseValue: originalPrice,
                    installmentCount: installments || 1,
                    creditCard: {
                        holderName: cardData.holderName,
                        number: cardData.number,
                        expiryMonth: cardData.expiryMonth,
                        expiryYear: cardData.expiryYear,
                        ccv: cardData.ccv,
                    },
                    creditCardHolderInfo: {
                        name: holderInfo.name || cardData.holderName,
                        email: user.email,
                        cpfCnpj: holderInfo.cpfCnpj,
                        postalCode: holderInfo.postalCode,
                        addressNumber: holderInfo.addressNumber,
                        phone: holderInfo.phone,
                    },
                    couponId,
                    userId: user.id, // [NEW] Send User ID for server-side activation
                }),
            });

            const subscriptionData = await subscriptionResponse.json();

            console.log('>>> Subscription response:', subscriptionData);

            if (!subscriptionResponse.ok || !subscriptionData.success) {
                throw new Error(subscriptionData.error || 'Erro ao processar pagamento.');
            }

            // 4. Check payment status - ONLY activate on confirmed payment
            if (subscriptionData.status === 'CONFIRMED' || subscriptionData.status === 'RECEIVED') {
                // Payment was successful - Activate plan
                const nextBillingDate = new Date();
                if (cycleToBuy === 'annual') {
                    nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
                } else {
                    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
                }

                const newSubscription = {
                    plan: planToBuy,
                    status: 'active' as const,
                    billingCycle: cycleToBuy,
                    installments: installments || 1,
                    nextBillingDate: toLocalISODate(nextBillingDate),
                    paymentMethod: 'CREDIT_CARD',
                    asaasCustomerId: customerData.customer.id,
                    asaasSubscriptionId: subscriptionData.subscription?.id || subscriptionData.payment?.id,
                    couponUsed: couponId,
                    startDate: toLocalISODate(new Date()),
                };

                const updatedUser = {
                    ...user,
                    subscription: newSubscription as any,
                    paymentMethodDetails: {
                        last4: cardData.number.replace(/\s/g, '').slice(-4),
                        holder: cardData.holderName || user.name,
                        expiry: `${cardData.expiryMonth}/${cardData.expiryYear.slice(-2)}`,
                        brand: 'credit_card'
                    }
                };

                // Meta Pixel: Purchase
                trackEvent('Purchase', {
                    value: finalValue,
                    currency: 'BRL',
                    content_name: 'Assinatura Controlar+',
                    content_type: 'subscription',
                    order_id: subscriptionData.subscription?.id || subscriptionData.payment?.id
                });

                if (planToBuy === 'pro') {
                    localStorage.setItem('show_pro_tutorial', 'true');
                    // Clear session flag to ensure tutorial shows even if user was browsing before upgrade
                    sessionStorage.removeItem('pro_tutorial_session_seen');
                }

                await onUpdateUser(JSON.parse(JSON.stringify(updatedUser)));
                toast.success('Pagamento confirmado! Plano ativado com sucesso.');
                onBack();
            } else {
                // Payment failed - DO NOT activate the plan
                // The backend already handles error messages with specific reasons
                throw new Error(subscriptionData.error || 'Pagamento não foi aprovado. Verifique os dados do cartão.');
            }

        } catch (err: any) {
            console.error('Checkout error:', err);
            toast.error(err.message || "Erro ao processar assinatura.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-full bg-gray-950 animate-fade-in flex flex-col">
            {/* Header - Tamanho Reduzido */}
            <div className={`py-3 px-4 lg:px-6 flex items-center gap-3 sticky top-0 z-10 bg-[#30302E] border-b border-gray-800/50 ${hideBackButton ? 'pl-6' : ''}`}>
                {!hideBackButton && (
                    <button
                        onClick={onBack}
                        className="p-1.5 hover:bg-gray-800 rounded-xl text-gray-400 hover:text-white transition-colors"
                    >
                        <ChevronLeft size={18} />
                    </button>
                )}
                <div>
                    <h1 className="text-lg font-bold text-white leading-tight">
                        {view === 'checkout' ? 'Finalizar Assinatura' : 'Planos e Preços'}
                    </h1>
                    {!hideBackButton && (
                        <p className="text-[11px] text-gray-400">
                            {view === 'checkout' ? 'Dados de pagamento seguros' : 'Escolha o melhor para sua vida financeira'}
                        </p>
                    )}
                </div>
            </div>

            <div className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
                {view === 'plans' ? (
                    <div className="space-y-12">
                        {/* Billing Toggle */}
                        <div className="flex justify-center">
                            <div className="bg-[#30302E] p-1.5 rounded-full border border-white/5 flex items-center relative backdrop-blur-sm">
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
                                        -7%
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Cards Grid */}
                        <div className="flex flex-col md:flex-row justify-center items-center md:items-stretch gap-6 lg:gap-8 max-w-4xl mx-auto pt-4">
                            {plans.map((plan) => {
                                const isCurrent = currentPlan === plan.id;
                                const price = billingCycle === 'monthly' ? plan.price : (plan.annualPrice ? plan.annualPrice / 12 : 0);
                                const isPro = plan.popular;

                                const containerClasses = isPro
                                    ? "bg-[#30302E] border border-[#d97757] rounded-3xl p-8 flex flex-col relative shadow-2xl shadow-[#d97757]/10 lg:transform lg:-translate-y-8 z-10 flex-1 basis-0"
                                    : "bg-[#30302E] border border-gray-800 rounded-3xl p-8 flex flex-col relative hover:border-gray-600 transition-colors flex-1 basis-0";

                                return (
                                    <motion.div
                                        key={`${plan.id}-${billingCycle}`}
                                        layout
                                        className={containerClasses}
                                        initial={{ opacity: 0, y: 20, scale: 0.95, filter: "blur(5px)" }}
                                        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                                        transition={{
                                            duration: 0.4,
                                            ease: "easeOut",
                                            type: "spring",
                                            stiffness: 200,
                                            damping: 20,
                                            delay: isPro ? 0.1 : 0
                                        }}
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

                                            <AnimatePresence>
                                                {billingCycle === 'annual' && plan.annualPrice && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0, scale: 0.9 }}
                                                        animate={{ opacity: 1, height: 'auto', scale: 1 }}
                                                        exit={{ opacity: 0, height: 0, scale: 0.9 }}
                                                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                                        className="flex flex-col items-center mt-1"
                                                    >
                                                        <span className="text-xs text-gray-500 block">
                                                            cobrado R$ {plan.annualPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /ano
                                                        </span>
                                                        <motion.span
                                                            initial={{ scale: 0.8, opacity: 0 }}
                                                            animate={{ scale: 1, opacity: 1 }}
                                                            transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 15 }}
                                                            className="text-xs text-[#d97757] font-bold mt-1 bg-[#d97757]/10 px-2 py-0.5 rounded-md"
                                                        >
                                                            12x sem juros
                                                        </motion.span>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>                                    </div>

                                        <ul className="space-y-4 mb-8 flex-1">
                                            {plan.features.map((feature, idx) => (
                                                <li key={idx} className={`flex items-center gap-3 text-sm ${isPro ? 'text-white' : 'text-gray-300'}`}>
                                                    {isPro ? (
                                                        <CheckCircle size={16} className="text-[#d97757]" />
                                                    ) : (
                                                        <Check size={16} className="text-gray-500" />
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
                        billingCycle={billingCycle}
                        onSubmit={handleCheckoutSubmit}
                        onBack={() => setView('plans')}
                        isLoading={isLoading}
                        initialCouponCode={initialCouponCode}
                    />
                )}
            </div>
        </div>
    );
};