
"use client";
import React, { useState } from 'react';
import { Check, Sparkles, CheckCircle, ShieldCheck, RotateCcw } from 'lucide-react';
import { BlurTextEffect } from '../BlurTextEffect';
import { motion, AnimatePresence } from 'framer-motion';
import NumberFlow from '@number-flow/react';

// Import images
import quebraCabecaImg from '../../assets/quebra-cabeca.png';
import fogueteImg from '../../assets/foguete.png';

import { AnimatedGridPattern } from '../AnimatedGridPattern';
import { CountdownTimer } from './CountdownTimer';

interface SubscribeData {
    planId: 'pro';
    billingCycle: 'monthly' | 'annual';
    couponCode?: string;
}

interface PricingSectionProps {
    onLogin: (view?: 'login' | 'signup') => void;
    onSubscribe?: (data: SubscribeData) => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({ onLogin, onSubscribe }) => {
    const billingCycle = 'monthly';

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
            buttonText: 'Assinar Agora',
            popular: true
        }
    ];

    return (
        // ... (I will include only the function head and then use another replace for the button usage to be safer or maybe I can be smart)
        // I will split this into two calls or use one targeted call for interface and one for button if possible, but replace_file_content does block.
        // Let's just update the interface first.
        <section id="pricing" className="w-full bg-[#1a0f0a] py-24 relative overflow-hidden">
            <AnimatedGridPattern
                // ...
                // Actually, I can just replace the interface definition and the button usage in separate calls or one call if confident.
                // I'll do two calls to be safe.
                width={60}
                // ...

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


                </div>


                <div className="flex flex-col items-center mb-8">
                    <span className="text-[#D97757] text-[10px] sm:text-xs uppercase tracking-[0.4em] font-bold mb-4">A oferta de lançamento termina em:</span>
                    <CountdownTimer />
                </div>

                <div className="flex justify-center w-full max-w-sm mx-auto">
                    {plans.map((plan) => {
                        const originalPrice = plan.price;
                        const price = originalPrice * 0.5; // 50% OFF
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


                                    <div className="flex flex-col items-center justify-center gap-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-gray-500 line-through text-lg font-medium">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(originalPrice)}
                                            </span>
                                            <span className="bg-[#00A96E]/20 text-[#00A96E] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#00A96E]/30">
                                                50% OFF
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-5xl font-bold text-white tracking-tight">
                                                <NumberFlow
                                                    value={price}
                                                    format={{ style: 'currency', currency: 'BRL' }}
                                                    locales="pt-BR"
                                                />
                                            </span>
                                            <span className="text-gray-500 font-medium">/mês</span>
                                        </div>
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
                                        if (onSubscribe) onSubscribe({
                                            planId: 'pro',
                                            billingCycle: billingCycle,
                                            couponCode: 'PROMO50'
                                        });
                                    }}
                                    className={`
                                        w-full py-4 rounded-xl font-bold text-sm transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group
                                        ${isPro
                                            ? 'bg-[#d97757] hover:bg-[#c56a4d] text-white shadow-lg shadow-[#d97757]/25'
                                            : 'bg-transparent border border-gray-700 text-white hover:bg-gray-800 hover:border-gray-600'}
                                    `}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                    Assinar Agora com 50% OFF
                                </button>

                                {/* Garantia Incondicional */}
                                <div className="mt-6 pt-6 border-t border-gray-800/50 flex flex-col items-center gap-2">
                                    <div className="flex items-center gap-2 text-white/90">
                                        <ShieldCheck size={18} className="text-[#d97757]" />
                                        <span className="text-sm font-bold tracking-tight">7 Dias de Garantia</span>
                                    </div>
                                    <p className="text-[11px] text-gray-500 text-center leading-relaxed">
                                        Satisfação garantida ou seu dinheiro de volta. <br />
                                        Risco zero para sua assinatura.
                                    </p>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Banner de Garantia Grande */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mt-16 max-w-2xl mx-auto p-6 md:p-8 rounded-3xl bg-gradient-to-b from-[#262624] to-[#1a0f0a] border border-gray-800 flex flex-col md:flex-row items-center gap-6 text-center md:text-left relative overflow-hidden group shadow-2xl"
                >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#d97757]/50 to-transparent"></div>
                    
                    <div className="w-16 h-16 rounded-2xl bg-[#d97757]/10 flex items-center justify-center shrink-0 border border-[#d97757]/20 group-hover:scale-110 transition-transform duration-500">
                        <RotateCcw size={32} className="text-[#d97757]" />
                    </div>

                    <div>
                        <h4 className="text-xl font-bold text-white mb-2 line-clamp-1">Sua satisfação ou seu dinheiro de volta</h4>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Acreditamos tanto no valor do Controlar que oferecemos uma garantia incondicional de 7 dias. Se você não se adaptar, devolvemos 100% do seu investimento. Sem perguntas, sem letras miúdas.
                        </p>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};
