
"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ArrowUpRight } from 'lucide-react';
import { BlurTextEffect } from '../BlurTextEffect';

const faqs = [
    {
        question: "Como o Controlar+ garante a segurança dos meus dados?",
        answer: "Utilizamos criptografia de ponta a ponta e padrões de segurança bancária para proteger suas informações. Seus dados são somente seus e nunca são compartilhados com terceiros."
    },
    {
        question: "Posso conectar contas de qualquer banco?",
        answer: "Atualmente suportamos a maioria dos grandes bancos nacionais e diversas instituições financeiras através do Open Finance. A lista é atualizada constantemente."
    },
    {
        question: "O que acontece se eu cancelar minha assinatura?",
        answer: "Seus dados permanecem salvos por um período caso queira retornar. Você perderá acesso às funcionalidades Pro, mas poderá continuar usando o plano gratuito."
    },
    {
        question: "Como funciona a Inteligência Artificial no app?",
        answer: "Nossa IA (Coinzinha) analisa seus padrões de gastos para oferecer insights personalizados, categorizar transações automaticamente e responder dúvidas sobre sua vida financeira."
    }
];

import { AnimatedGridPattern } from '../AnimatedGridPattern';

export const FAQSection: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    return (
        <section id="faq" className="w-full bg-[#1a0f0a] py-24 relative overflow-hidden">
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
                <div className="flex flex-col lg:flex-row gap-12 lg:gap-24">

                    {/* Left Column: Title & CTA */}
                    <div className="lg:w-1/3 flex flex-col justify-between">
                        <div>
                            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#faf9f5] leading-tight mb-8">
                                <BlurTextEffect>Perguntas</BlurTextEffect> <br />
                                <span className="text-[#d97757]">Frequentes?</span>
                            </h2>
                            <p className="text-neutral-400 text-lg leading-relaxed mb-8">
                                Tire suas dúvidas sobre como o Controlar+ pode transformar sua gestão financeira.
                            </p>
                        </div>

                        <div className="hidden lg:block">
                            <button onClick={onLogin} className="group px-8 py-4 bg-[#D97757] hover:bg-[#c66a4e] text-white rounded-full font-bold transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(217,119,87,0.3)] hover:shadow-[0_0_30px_rgba(217,119,87,0.5)]">
                                Começar Agora
                                <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                            </button>
                        </div>
                    </div>

                    {/* Right Column: Accordion */}
                    <div className="lg:w-2/3 flex flex-col gap-4">
                        {faqs.map((faq, index) => {
                            const isOpen = openIndex === index;

                            return (
                                <motion.div
                                    key={index}
                                    initial={false}
                                    animate={{ backgroundColor: isOpen ? "#262624" : "transparent" }}
                                    className={`rounded-3xl border border-neutral-700/50 overflow-hidden cursor-pointer transition-colors duration-300 ${!isOpen && 'hover:bg-white/5'}`}
                                    onClick={() => setOpenIndex(isOpen ? null : index)}
                                >
                                    <div className="p-6 md:p-8 flex items-center justify-between gap-4">
                                        <h3 className={`text-lg md:text-xl font-bold transition-colors ${isOpen ? 'text-white' : 'text-neutral-300'}`}>
                                            {faq.question}
                                        </h3>
                                        <motion.div
                                            animate={{ rotate: isOpen ? 180 : 0 }}
                                            transition={{ duration: 0.3 }}
                                            className={`flex-shrink-0 ${isOpen ? 'text-[#d97757]' : 'text-neutral-500'}`}
                                        >
                                            <ChevronDown size={24} />
                                        </motion.div>
                                    </div>

                                    <AnimatePresence initial={false}>
                                        {isOpen && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                            >
                                                <div className="px-6 md:px-8 pb-8 pt-0">
                                                    <p className="text-neutral-400 leading-relaxed text-base md:text-lg">
                                                        {faq.answer}
                                                    </p>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}

                        {/* Mobile CTA */}
                        <div className="lg:hidden mt-8">
                            <button onClick={onLogin} className="group px-8 py-4 bg-[#D97757] hover:bg-[#c66a4e] text-white rounded-full font-bold transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(217,119,87,0.3)] hover:shadow-[0_0_30px_rgba(217,119,87,0.5)]">
                                Começar Agora
                                <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
