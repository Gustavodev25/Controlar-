import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import NumberFlow from '@number-flow/react';
import { ShiningText } from '../ShiningText';
import { AnimatedGridPattern } from '../AnimatedGridPattern';
import { InfiniteSlider } from '../InfiniteSlider';
import { BlurTextEffect } from '../BlurTextEffect';
import dashboardImg from '../../assets/dashboard.png';

// Bank logos
import bancodobrasilLogo from '../../assets/bancos/bancodobrasil.png';
import bradescoLogo from '../../assets/bancos/bradesco.png';
import brbLogo from '../../assets/bancos/brb.png';
import c6Logo from '../../assets/bancos/c6.png';
import caixaLogo from '../../assets/bancos/caixa.png';
import interLogo from '../../assets/bancos/inter.png';
import nubankLogo from '../../assets/bancos/nubank.png';
import santanderLogo from '../../assets/bancos/santander.png';
import xpLogo from '../../assets/bancos/xp.png';

// --- HOOK: Scroll Animation ---
const useScrollAnimation = (threshold = 0.1) => {
    const ref = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                }
            },
            { threshold, rootMargin: '50px' }
        );

        const currentRef = ref.current;
        if (currentRef) {
            observer.observe(currentRef);
        }

        return () => {
            if (currentRef) {
                observer.unobserve(currentRef);
            }
        };
    }, [threshold]);

    return { ref, isVisible };
};

// --- COMPONENTE: Animated Section Wrapper ---
const AnimatedSection: React.FC<{
    children: React.ReactNode;
    className?: string;
    delay?: number;
    direction?: 'up' | 'down' | 'left' | 'right' | 'fade';
}> = ({ children, className = '', delay = 0, direction = 'up' }) => {
    const { ref, isVisible } = useScrollAnimation(0.1);

    const animations = {
        up: 'translate-y-8 opacity-0',
        down: '-translate-y-8 opacity-0',
        left: 'translate-x-8 opacity-0',
        right: '-translate-x-8 opacity-0',
        fade: 'opacity-0'
    };

    const baseClasses = `transition-all duration-700 ease-out ${isVisible ? 'translate-y-0 translate-x-0 opacity-100' : animations[direction]}`;

    return (
        <div
            ref={ref}
            className={`${baseClasses} ${className}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
};

// --- COMPONENTE: Draw Line (SVG Draw Effect com Framer Motion) ---
const DrawLine: React.FC<{
    className?: string;
    delay?: number;
}> = ({ className = '', delay = 0.4 }) => {
    const { ref, isVisible } = useScrollAnimation(0.1);

    return (
        <div ref={ref} className={`mt-4 ${className}`}>
            <svg
                width="80"
                height="12"
                viewBox="0 0 80 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <motion.path
                    d="M2 6C2 6 10 2 20 6C30 10 40 2 50 6C60 10 70 2 78 6"
                    stroke="#D97757"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={isVisible ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                    transition={{
                        pathLength: { delay, duration: 1.2, ease: "easeInOut" },
                        opacity: { delay, duration: 0.3 }
                    }}
                />
            </svg>
        </div>
    );
};

// --- COMPONENTE: Animated Stat (NumberFlow com Scroll Trigger) ---
const AnimatedStat: React.FC<{
    value: number;
    displayValue: number;
    prefix?: string;
    suffix?: string;
    label: string;
    delay?: number;
}> = ({ value, displayValue: targetDisplay, prefix = '', suffix = '', label, delay = 0 }) => {
    const { ref, isVisible } = useScrollAnimation(0.1);
    const [currentValue, setCurrentValue] = useState(0);

    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(() => {
                setCurrentValue(targetDisplay);
            }, delay);
            return () => clearTimeout(timer);
        }
    }, [isVisible, targetDisplay, delay]);

    return (
        <div ref={ref} className="text-center min-w-[120px]">
            <p className="text-3xl md:text-4xl font-bold text-[#D97757] tabular-nums">
                {prefix}
                <NumberFlow
                    value={currentValue}
                    format={{ useGrouping: true }}
                    locales="pt-BR"
                    transformTiming={{ duration: 1000, easing: 'ease-out' }}
                />
                {suffix}
            </p>
            <p className="text-sm text-gray-400 mt-1">
                <BlurTextEffect>{label}</BlurTextEffect>
            </p>
        </div>
    );
};

// Helper Component Types
interface CountdownTimerProps {
    targetDate: string;
}

// Countdown Timer Component with NumberFlow
const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate }) => {
    const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number }>({ d: 0, h: 0, m: 0, s: 0 });

    useEffect(() => {
        const calculateTimeLeft = () => {
            const difference = +new Date(targetDate) - +new Date();
            if (difference > 0) {
                return {
                    d: Math.floor(difference / (1000 * 60 * 60 * 24)),
                    h: Math.floor((difference / (1000 * 60 * 60)) % 24),
                    m: Math.floor((difference / 1000 / 60) % 60),
                    s: Math.floor((difference / 1000) % 60),
                };
            }
            return { d: 0, h: 0, m: 0, s: 0 };
        };

        setTimeLeft(calculateTimeLeft());
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearInterval(timer);
    }, [targetDate]);

    return (
        <div className="flex items-center gap-4 text-white">
            <div className="flex flex-col items-center">
                <span className="text-3xl font-bold bg-[#D97757]/10 border border-[#D97757]/20 rounded-lg px-3 py-2 text-[#D97757]">
                    <NumberFlow value={timeLeft.d} format={{ minimumIntegerDigits: 2 }} />
                </span>
                <span className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">Dias</span>
            </div>
            <span className="text-2xl font-bold text-gray-600">:</span>
            <div className="flex flex-col items-center">
                <span className="text-3xl font-bold bg-[#D97757]/10 border border-[#D97757]/20 rounded-lg px-3 py-2 text-[#D97757]">
                    <NumberFlow value={timeLeft.h} format={{ minimumIntegerDigits: 2 }} />
                </span>
                <span className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">Horas</span>
            </div>
            <span className="text-2xl font-bold text-gray-600">:</span>
            <div className="flex flex-col items-center">
                <span className="text-3xl font-bold bg-[#D97757]/10 border border-[#D97757]/20 rounded-lg px-3 py-2 text-[#D97757]">
                    <NumberFlow value={timeLeft.m} format={{ minimumIntegerDigits: 2 }} />
                </span>
                <span className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">Min</span>
            </div>
            <span className="text-2xl font-bold text-gray-600">:</span>
            <div className="flex flex-col items-center">
                <span className="text-3xl font-bold bg-[#D97757]/10 border border-[#D97757]/20 rounded-lg px-3 py-2 text-[#D97757]">
                    <NumberFlow value={timeLeft.s} format={{ minimumIntegerDigits: 2 }} />
                </span>
                <span className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">Seg</span>
            </div>
        </div>
    );
};

// Benefits Item Component
const BenefitsItem = ({ text }: { text: string }) => (
    <div className="flex items-center gap-3 text-sm text-gray-300">
        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
        </div>
        {text}
    </div>
);

export function Hero({ onLogin }: { onLogin: () => void }) {
    const banks = [
        { name: 'Banco do Brasil', logo: bancodobrasilLogo },
        { name: 'Bradesco', logo: bradescoLogo },
        { name: 'BRB', logo: brbLogo },
        { name: 'C6 Bank', logo: c6Logo },
        { name: 'Caixa', logo: caixaLogo },
        { name: 'Inter', logo: interLogo },
        { name: 'Nubank', logo: nubankLogo },
        { name: 'Santander', logo: santanderLogo },
        { name: 'XP', logo: xpLogo },
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.15,
                delayChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0, filter: 'blur(10px)' },
        visible: {
            y: 0,
            opacity: 1,
            filter: 'blur(0px)',
            transition: {
                type: "spring" as const,
                damping: 20,
                stiffness: 100
            }
        }
    };

    return (
        <div id="hero" className="w-full bg-[#1a0f0a] flex flex-col">
            <section className="relative w-full min-h-screen bg-[radial-gradient(ellipse_60%_40%_at_50%_40%,_#3a1a10_0%,_#1a0f0a_100%)] overflow-hidden flex items-center justify-center pt-40 pb-0">

                {/* Grid Animado de Fundo - Sutil e Centralizado */}
                <AnimatedGridPattern
                    width={60}
                    height={60}
                    numSquares={20}
                    maxOpacity={0.08}
                    duration={4}
                    repeatDelay={2}
                    className="[mask-image:radial-gradient(ellipse_50%_50%_at_50%_40%,white_0%,transparent_70%)] fill-white/5 stroke-white/[0.03]"
                />

                <motion.div
                    className="container mx-auto flex flex-col lg:flex-row items-center justify-between gap-12 z-10 px-4 lg:px-12 h-full"
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
                >
                    {/* Left Side: Original Hero Text */}
                    <div className="flex-1 space-y-8 text-center lg:text-left">
                        <motion.h1 variants={itemVariants} className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-tight">
                            Desbloqueie o Potencial <br />
                            das suas <ShiningText text="Finanças." />
                        </motion.h1>
                        <motion.p variants={itemVariants} className="text-xl text-gray-400 max-w-xl mx-auto lg:mx-0">
                            Controlar+ é a plataforma financeira mais produtiva já feita.
                            Obtenha clareza total sobre seu dinheiro em segundos.
                        </motion.p>

                        {/* Countdown Timer Featured */}
                        {/* Countdown Timer & CTA */}
                        <motion.div variants={itemVariants} className="flex flex-col items-center lg:items-start gap-6 pt-4">
                            <div className="flex flex-col items-center lg:items-start gap-3">
                                <p className="text-sm uppercase tracking-widest text-[#D97757] font-bold">Oferta de Ano Novo acaba em:</p>
                                <CountdownTimer targetDate="2026-01-01T12:00:00" />
                            </div>

                            <button onClick={onLogin} className="px-12 py-4 min-w-[200px] bg-[#D97757] hover:bg-[#c66a4e] text-white rounded-full font-medium transition-all flex items-center justify-center gap-2 group shadow-lg shadow-[#D97757]/20 hover:shadow-[#D97757]/40">
                                Começar Agora
                                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </button>
                        </motion.div>
                    </div>

                    {/* Right Side: Promotion Card (Clean Style) */}
                    <motion.div variants={itemVariants} className="w-full max-w-sm lg:max-w-md relative mt-12 lg:mt-0">
                        <div className="relative bg-[#262624] border border-[#D97757] rounded-3xl p-8 shadow-2xl">

                            {/* Floating Badge */}
                            <div className="absolute -top-3 right-6">
                                <span className="bg-[#D97757] text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider shadow-lg">
                                    Oferta de Ano Novo
                                </span>
                            </div>

                            {/* Card Header */}
                            <div className="text-center mb-6 pt-2">
                                <h3 className="text-2xl font-bold text-white leading-tight">
                                    Pague R$ 5,00
                                    <span className="block text-lg font-normal text-gray-400 mt-1">no primeiro mês!</span>
                                </h3>
                            </div>

                            {/* Scarcity Badge */}
                            <div className="text-center mb-6">
                                <p className="text-[#ef4444] font-black text-xl tracking-widest uppercase filter drop-shadow-sm">APENAS 37/50 VAGAS</p>
                                <p className="text-[11px] text-gray-500 font-medium mt-1 uppercase tracking-wide">Fecha 01/01</p>
                            </div>

                            {/* Price Section */}
                            <div className="flex flex-col items-center justify-center mb-8">
                                <span className="text-gray-500 line-through text-sm mb-1">De R$ 35,90</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl text-white font-bold">R$</span>
                                    <span className="text-6xl font-bold text-white tracking-tighter">5,00</span>
                                    <span className="text-xl text-gray-400">/mês</span>
                                </div>
                                <div className="mt-3 bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-xs font-bold uppercase border border-emerald-500/20">
                                    Economize R$ 30,90
                                </div>

                                <div className="mt-4 flex flex-col items-center gap-2 animate-pulse">
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#D97757]/10 border border-dashed border-[#D97757]/40 rounded-lg">
                                        <span className="text-[10px] text-gray-400 uppercase tracking-wide">CUPOM:</span>
                                        <span className="text-[#D97757] font-bold tracking-widest text-sm">DESCONTO05</span>
                                        <span className="text-[10px] bg-[#D97757] text-white px-1.5 py-0.5 rounded font-bold ml-1">-5%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Benefits */}
                            <div className="space-y-4 mb-8">
                                <BenefitsItem text="Acesso completo ao Controlar+" />
                                <BenefitsItem text="Conexão Bancária Ilimitada" />
                                <BenefitsItem text="IA Financeira Avançada" />
                                <BenefitsItem text="Metas e Lembretes" />
                            </div>

                            {/* CTA */}
                            <button onClick={onLogin} className="w-full py-4 bg-[#D97757] hover:bg-[#c66a4e] text-white rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]">
                                Assinar Agora
                            </button>

                            {/* Progress bar */}
                            <div className="mt-6">
                                <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wider">
                                    <span>Vagas Preenchidas</span>
                                    <span>68%</span>
                                </div>
                                <div className="w-full h-2 bg-gray-700/30 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: "68%" }}
                                        transition={{ duration: 1.5, ease: "easeOut" }}
                                        className="h-full bg-[#D97757]"
                                    />
                                </div>
                                <p className="text-center text-[10px] text-gray-500 mt-3 uppercase tracking-widest">
                                    Oferta válida até 01/01
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </section>

            {/* Infinite Slider - Bancos Parceiros */}
            <section className="relative w-full py-8 bg-[#30302E] border-y border-white/5">
                <div className="flex items-center">
                    {/* Quadrado com texto */}
                    <div className="flex-shrink-0 px-8 py-4 border-r border-white/10">
                        <p className="text-sm text-gray-400 uppercase tracking-widest whitespace-nowrap">Conecte com seus bancos favoritos</p>
                    </div>

                    {/* Slider */}
                    <div className="relative flex-1 overflow-hidden">
                        {/* Fade nas laterais */}
                        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#30302E] to-transparent z-10 pointer-events-none" />
                        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#30302E] to-transparent z-10 pointer-events-none" />

                        <InfiniteSlider gap={48} duration={30}>
                            {banks.map((bank) => (
                                <div key={bank.name} className="flex items-center justify-center px-6 py-4">
                                    <img
                                        src={bank.logo}
                                        alt={bank.name}
                                        className="h-8 w-auto opacity-60 hover:opacity-100 transition-opacity"
                                    />
                                </div>
                            ))}
                        </InfiniteSlider>
                    </div>
                </div>
            </section>

            {/* Estatísticas do Sistema */}
            <section className="relative w-full py-12 bg-[#262624]">
                <div className="container mx-auto px-8">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                        {/* Texto Principal */}
                        <AnimatedSection direction="left" delay={0} className="flex-shrink-0">
                            <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                                <BlurTextEffect>Simplificando sua vida</BlurTextEffect> <br />
                                <BlurTextEffect>financeira todos os dias.</BlurTextEffect>
                            </h2>
                            <DrawLine delay={0.4} />
                        </AnimatedSection>

                        {/* Métricas */}
                        <div className="flex flex-wrap items-center justify-center lg:justify-end gap-12 lg:gap-16">
                            <AnimatedStat
                                value={50000}
                                displayValue={50}
                                prefix="+ "
                                suffix="K"
                                label="Transações processadas"
                                delay={100}
                            />
                            <AnimatedStat
                                value={1500}
                                displayValue={1500}
                                prefix="+ "
                                label="Usuários ativos"
                                delay={200}
                            />
                            <AnimatedStat
                                value={2000000}
                                displayValue={2}
                                prefix="R$ "
                                suffix="M+"
                                label="Economia gerada"
                                delay={300}
                            />
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}