
"use client";
import React, { useState } from 'react';
import { Check, Sparkles, CheckCircle } from 'lucide-react';
import { BlurTextEffect } from '../BlurTextEffect';
import { motion, AnimatePresence } from 'framer-motion';
import NumberFlow from '@number-flow/react';

// Import images
import quebraCabecaImg from '../../assets/quebra-cabeca.png';
import fogueteImg from '../../assets/foguete.png';

import { AnimatedGridPattern } from '../AnimatedGridPattern';

export const PricingSection: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

    const plans = [
        {
            id: 'pro',
            name: 'Pro',
            price: 35.90,
            annualPrice: 399.00,
            description: 'Todos os recursos avançados.',
            features: [
                'IA Integrada ilimitada',
                'Lançamentos por Texto',
                'Consultor Financeiro IA',
                'Metas e Lembretes',
                'Contas Bancárias Ilimitadas'
            ],
            image: fogueteImg,
            buttonText: 'Assinar Pro',
            popular: true
        }
    ];

    return (
        <section id="pricing" className="w-full bg-[#1a0f0a] py-24 relative overflow-hidden">
            <AnimatedGridPattern
                width={60}
                height={60}
                numSquares={20}
                maxOpacity={0.08}
                duration={4}
                repeatDelay={2}
                className="[mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,white_0%,transparent_70%)] fill-white/5 stroke-white/[0.03] absolute inset-0 h-full w-full pointer-events-none"
            />
            <div className="container mx-auto px-8 relative z-10">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#faf9f5] mb-6">
                        <BlurTextEffect>Planos e Preços</BlurTextEffect>
                    </h2>
                    <p className="text-neutral-400 max-w-xl mx-auto text-lg mb-8">
                        Escolha o plano ideal para transformar sua vida financeira.
                    </p>

                    {/* Billing Toggle */}
                    <div className="flex justify-center">
                        <div className="bg-[#262624] p-1.5 rounded-full border border-white/5 flex items-center relative backdrop-blur-sm">
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
                </div>

                <div className="flex justify-center w-full max-w-sm mx-auto">
                    {plans.map((plan) => {
                        const price = billingCycle === 'monthly' ? plan.price : (plan.annualPrice ? plan.annualPrice / 12 : 0);
                        const isPro = plan.popular;

                        return (
                            <motion.div
                                key={plan.id}
                                layout
                                className={`
                                    relative flex flex-col w-full p-8 rounded-3xl border transition-all duration-300
                                    ${isPro
                                        ? 'bg-[#262624] border-[#d97757] shadow-2xl shadow-[#d97757]/10 z-10'
                                        : 'bg-[#262624] border-gray-800 hover:border-gray-700'}
                                `}
                            >
                                {/* Etiqueta Mais Popular */}
                                {isPro && (
                                    <div className="absolute top-0 right-0 bg-[#d97757] text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl shadow-lg uppercase tracking-wider">
                                        Mais Popular
                                    </div>
                                )}

                                {!isPro && (
                                    <div className="absolute top-0 right-0 bg-transparent text-transparent text-[10px] font-bold px-3 py-1 selection:rounded-bl-xl rounded-tr-2xl h-[24px]">
                                        &nbsp;
                                    </div>
                                )}


                                {/* Ícone / Imagem Centralizada */}
                                <div className="flex justify-center mb-6">
                                    <img src={plan.image} alt={plan.name} className="w-20 h-20 object-contain drop-shadow-2xl" />
                                </div>

                                {/* Nome do Plano */}
                                <div className="text-center mb-2">
                                    <h3 className={`text-2xl font-bold text-white flex items-center justify-center gap-2`}>
                                        {plan.name} {isPro && <Sparkles size={18} className="text-[#d97757]" />}
                                    </h3>
                                </div>

                                {/* Descrição */}
                                <p className="text-gray-400 text-sm text-center mb-8 px-4 min-h-[40px]">
                                    {plan.description}
                                </p>

                                {/* Preço */}
                                <div className="text-center mb-8">
                                    {isPro && billingCycle === 'monthly' ? (
                                        <motion.span
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="text-gray-500 line-through text-md mb-0.5 block"
                                        >
                                            De R$ 35,90
                                        </motion.span>
                                    ) : null}

                                    <div className="flex items-center justify-center gap-1">
                                        <span className="text-4xl font-bold text-white">
                                            <NumberFlow
                                                value={isPro && billingCycle === 'monthly' ? 9.90 : price}
                                                format={{ style: 'currency', currency: 'BRL' }}
                                                locales="pt-BR"
                                            />
                                        </span>
                                        <span className="text-gray-500 font-medium">/mês</span>
                                    </div>

                                    <AnimatePresence>
                                        {isPro && billingCycle === 'monthly' && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                                animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                                className="w-full px-2 overflow-hidden"
                                            >
                                                <div className="relative flex items-center justify-center bg-[#D97757]/10 border border-dashed border-[#D97757]/40 rounded-xl py-2 px-4 transition-all hover:bg-[#D97757]/20 hover:scale-105 cursor-pointer group">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[10px] uppercase font-bold text-[#D97757]/70 leading-none mb-1">Promoção de Ano Novo</span>
                                                        <span className="text-lg font-extrabold text-[#D97757] tracking-widest leading-none">FELIZ2026</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="h-6 mt-1">
                                        <AnimatePresence mode="wait">
                                            {billingCycle === 'annual' && plan.annualPrice > 0 && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 5 }}
                                                    className="flex flex-col items-center"
                                                >
                                                    <span className="text-xs text-[#d97757] font-bold bg-[#d97757]/10 px-2 py-0.5 rounded-md">
                                                        12x sem juros
                                                    </span>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>

                                {/* Lista de Features */}
                                <div className="flex-1 space-y-4 mb-8 pl-2">
                                    {plan.features.map((feature, idx) => (
                                        <div key={idx} className={`flex items-start gap-3 text-sm ${isPro ? 'text-gray-200' : 'text-gray-400'}`}>
                                            {isPro ? (
                                                <CheckCircle size={18} className="text-[#d97757] flex-shrink-0 mt-0.5" />
                                            ) : (
                                                <Check size={18} className="text-gray-500 flex-shrink-0 mt-0.5" />
                                            )}
                                            <span className={isPro && idx === 0 ? 'font-medium' : ''}>{feature}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Botão */}
                                <button
                                    onClick={() => {
                                        // Salvar informações do plano no localStorage para redirecionar após login
                                        if (isPro) {
                                            const pendingCheckout = {
                                                planId: 'pro',
                                                billingCycle: billingCycle,
                                                couponCode: billingCycle === 'monthly' ? 'FELIZ2026' : undefined
                                            };
                                            localStorage.setItem('pending_checkout', JSON.stringify(pendingCheckout));
                                        }
                                        onLogin();
                                    }}
                                    className={`
                                        w-full py-4 rounded-xl font-bold text-sm transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]
                                        ${isPro
                                            ? 'bg-[#d97757] hover:bg-[#c56a4d] text-white shadow-lg shadow-[#d97757]/25'
                                            : 'bg-transparent border border-gray-700 text-white hover:bg-gray-800 hover:border-gray-600'}
                                    `}
                                >
                                    {plan.buttonText}
                                </button>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};
