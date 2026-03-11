import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import NumberFlow from '@number-flow/react';
import { ShiningText } from '../ShiningText';
import { AnimatedGridPattern } from '../AnimatedGridPattern';
import { InfiniteSlider } from '../InfiniteSlider';
import { BlurTextEffect } from '../BlurTextEffect';
import { Sparkles, CheckCircle, ShieldCheck, LogIn, TrendingDown, SearchX, AlertTriangle, ArrowRight } from 'lucide-react';
import dashboardImg from '../../assets/dashboard.png';
import fogueteImg from '../../assets/foguete.png';
import celularImg from '../../assets/celular.png';
import celular2Img from '../../assets/celular 2.png';
import celular3Img from '../../assets/celular3.png';

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
const CountdownTimer: React.FC = () => {
    const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number }>({ d: 0, h: 0, m: 0, s: 0 });

    useEffect(() => {
        // Chave para identificar o timer no navegador do usuário
        const STORAGE_KEY = 'controlar_launch_target_date';
        
        const getOrSetTargetDate = () => {
            const storedDate = localStorage.getItem(STORAGE_KEY);
            if (storedDate) {
                return parseInt(storedDate, 10);
            }
            
            // Se não houver data, define para 14 dias a partir do primeiro acesso
            const now = new Date();
            // Define o alvo exatamente para 14 dias a partir de agora
            const targetDate = now.getTime() + (14 * 24 * 60 * 60 * 1000);
            localStorage.setItem(STORAGE_KEY, targetDate.toString());
            return targetDate;
        };

        const targetTimestamp = getOrSetTargetDate();

        const calculateTimeLeft = () => {
            const now = new Date().getTime();
            const difference = targetTimestamp - now;

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
    }, []);

    return (
        <div className="flex items-center gap-3 text-white">
            <div className="flex flex-col items-center">
                <span className="text-2xl font-bold bg-[#D97757]/10 border border-[#D97757]/20 rounded-lg px-2.5 py-1.5 text-[#D97757]">
                    <NumberFlow value={timeLeft.d} format={{ minimumIntegerDigits: 2 }} />
                </span>
                <span className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">Dias</span>
            </div>
            <span className="text-xl font-bold text-gray-600">:</span>
            <div className="flex flex-col items-center">
                <span className="text-2xl font-bold bg-[#D97757]/10 border border-[#D97757]/20 rounded-lg px-2.5 py-1.5 text-[#D97757]">
                    <NumberFlow value={timeLeft.h} format={{ minimumIntegerDigits: 2 }} />
                </span>
                <span className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">Horas</span>
            </div>
            <span className="text-xl font-bold text-gray-600">:</span>
            <div className="flex flex-col items-center">
                <span className="text-2xl font-bold bg-[#D97757]/10 border border-[#D97757]/20 rounded-lg px-2.5 py-1.5 text-[#D97757]">
                    <NumberFlow value={timeLeft.m} format={{ minimumIntegerDigits: 2 }} />
                </span>
                <span className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">Min</span>
            </div>
            <span className="text-xl font-bold text-gray-600">:</span>
            <div className="flex flex-col items-center">
                <span className="text-2xl font-bold bg-[#D97757]/10 border border-[#D97757]/20 rounded-lg px-2.5 py-1.5 text-[#D97757]">
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

interface SubscribeData {
    planId: 'pro';
    billingCycle: 'monthly' | 'annual';
    couponCode?: string;
}


interface HeroProps {
    onLogin: (view?: 'login' | 'signup') => void;
    onSubscribe?: (data: SubscribeData) => void;
}

export function Hero({ onLogin, onSubscribe }: HeroProps) {
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
                    className="container mx-auto flex flex-col items-center justify-center gap-12 z-10 px-4 h-full"
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
                >
                    {/* Left Side: Original Hero Text */}
                    <motion.div className="w-full max-w-4xl space-y-8 text-center flex flex-col items-center">


                        <motion.h1 variants={itemVariants} className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-tight">
                            O app para controlar suas <br />
                            <ShiningText text="finanças pessoais" />
                        </motion.h1>
                        <motion.p variants={itemVariants} className="text-xl text-gray-400 max-w-2xl mx-auto mt-4">
                            Economize tempo e esforço controlando seu dinheiro com a Controlar+
                        </motion.p>

                        <motion.div variants={itemVariants} className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                            <button
                                onClick={() => onSubscribe?.({ planId: 'pro', billingCycle: 'monthly' })}
                                className="group relative px-8 py-4 bg-[#D97757] text-white font-bold rounded-2xl shadow-lg shadow-[#D97757]/20 hover:bg-[#c56a4d] transition-all hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                <span className="relative z-10 flex items-center gap-2">
                                    Começar agora
                                    <ArrowRight size={18} />
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    const element = document.getElementById('features');
                                    if (element) element.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="px-8 py-4 bg-white/5 text-white font-medium rounded-2xl border border-white/10 hover:bg-white/10 transition-all"
                            >
                                Ver funcionalidades
                            </button>
                        </motion.div>

                        <motion.div variants={itemVariants} className="mt-12 relative max-w-[300px] md:max-w-[400px] mx-auto flex flex-col items-center">
                            {/* Feature Pills */}
                            <div className="flex flex-wrap justify-center gap-2 mb-8 relative z-20">
                                <span className="px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-gray-400 text-[11px] font-medium backdrop-blur-sm">
                                    Open finance
                                </span>
                                <span className="px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-gray-400 text-[11px] font-medium backdrop-blur-sm">
                                    Simples e intuitivo
                                </span>
                                <span className="px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-gray-400 text-[11px] font-medium backdrop-blur-sm">
                                    100% seguro
                                </span>
                            </div>

                            <div className="relative w-full">
                                <div className="absolute inset-0 bg-gradient-to-t from-[#D97757]/40 to-transparent blur-3xl rounded-full opacity-80"></div>
                                <img src={celularImg} alt="Controlar+ no Celular" className="relative z-10 w-full h-auto drop-shadow-2xl" />
                            </div>
                        </motion.div>

                        <motion.div variants={itemVariants} className="mt-10 flex flex-col items-center gap-6">
                            <span className="text-[#D97757] text-[10px] sm:text-xs uppercase tracking-[0.4em] font-bold">O App Controlar+ chega em:</span>
                            <CountdownTimer />
                        </motion.div>


                        {/* Pain Points Section */}
                        <motion.div variants={itemVariants} className="w-full max-w-md mx-auto mt-20 text-left px-2 pb-12">
                            <h3 className="text-[22px] sm:text-2xl text-[#d4d4d4] mb-6 font-normal tracking-wide">
                                Sua vida financeira <br />
                                transborda <span className="font-bold text-white">desorganização</span>?
                            </h3>

                            <div className="space-y-4">
                                <div className="flex items-center gap-4 bg-white/[0.03] p-4 rounded-2xl border border-white/[0.05]">
                                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-[#D97757]/10 border border-[#D97757]/20 shadow-inner shadow-[#D97757]/20">
                                        <TrendingDown className="w-5 h-5 text-[#D97757]" />
                                    </div>
                                    <span className="text-[#9ca3af] text-[15px] font-medium leading-snug">Não consegue manter o controle<br className="hidden sm:block" /> dos gastos</span>
                                </div>
                                <div className="flex items-center gap-4 bg-white/[0.03] p-4 rounded-2xl border border-white/[0.05]">
                                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-[#D97757]/10 border border-[#D97757]/20 shadow-inner shadow-[#D97757]/20">
                                        <SearchX className="w-5 h-5 text-[#D97757]" />
                                    </div>
                                    <span className="text-[#9ca3af] text-[15px] font-medium leading-snug">Dinheiro acaba e você nem sabe<br className="hidden sm:block" /> aonde foi parar</span>
                                </div>
                                <div className="flex items-center gap-4 bg-white/[0.03] p-4 rounded-2xl border border-white/[0.05]">
                                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-[#D97757]/10 border border-[#D97757]/20 shadow-inner shadow-[#D97757]/20">
                                        <AlertTriangle className="w-5 h-5 text-[#D97757]" />
                                    </div>
                                    <span className="text-[#9ca3af] text-[15px] font-medium leading-snug">Vive no aperto e perde<br className="hidden sm:block" /> oportunidades</span>
                                </div>
                            </div>
                        </motion.div>

                        {/* Funcionalidades Card 1 */}
                        <motion.div variants={itemVariants} className="w-full max-w-5xl mx-auto mt-4 text-left px-4">
                            <h3 className="text-[16px] font-medium text-gray-400 mb-6 tracking-wide pl-2">
                                Funcionalidades
                            </h3>

                            <div className="relative bg-[#D97757] rounded-[36px] overflow-hidden shadow-3xl group transition-all duration-300 cursor-default w-full h-[380px] sm:h-[440px] p-8 sm:p-12 flex flex-col md:flex-row items-center">

                                {/* Phone Mockup - Fixed on the left edge */}
                                <div className="absolute bottom-0 left-6 sm:left-12 w-full max-w-[160px] sm:max-w-[180px] lg:max-w-[220px] z-10 transition-transform duration-500 translate-y-[35%] group-hover:translate-y-[30%] order-2 md:order-1">
                                    <img
                                        src={celularImg}
                                        alt="Visão completa"
                                        className="w-full h-auto object-cover object-top drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                                    />
                                </div>

                                {/* Content Text - Adjusted to be closer to the left but not touching the phone */}
                                <div className="relative z-20 w-full md:pl-[240px] lg:pl-[300px] text-left order-1 md:order-2">
                                    <h4 className="text-[28px] sm:text-[36px] lg:text-[44px] font-bold text-white leading-[1.1] filter drop-shadow-sm max-w-[500px]">
                                        Tenha visão completa do seu dinheiro
                                    </h4>
                                </div>

                                {/* Next Button - Bottom Right */}
                                <div className="absolute bottom-6 right-6 sm:bottom-10 sm:right-10 w-[64px] h-[64px] sm:w-[76px] sm:h-[76px] bg-[#1d1d1b] rounded-full flex items-center justify-center shadow-[0_15px_35px_rgba(0,0,0,0.5)] hover:scale-110 transition-transform cursor-pointer z-30">
                                    <svg className="w-9 h-9 text-[#D97757] ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        </motion.div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl mx-auto mt-6 px-4 pb-12">
                            {/* Funcionalidades Card 2 - Faturas */}
                            <motion.div variants={itemVariants} className="w-full">
                                <div className="relative bg-[#1d1d1b] rounded-[36px] overflow-hidden shadow-3xl group transition-all duration-300 cursor-default w-full h-[350px] sm:h-[420px] p-8 sm:p-12 flex flex-col items-center text-center">
                                    {/* Content Text */}
                                    <div className="relative z-20 w-full mb-auto">
                                        <h4 className="text-[14px] sm:text-[16px] font-bold text-white leading-[1.3] filter drop-shadow-sm max-w-[240px] mx-auto">
                                            Controle suas faturas de todos os cartões em um só lugar
                                        </h4>
                                    </div>

                                    {/* Phone Mockup - Better masking and positioning */}
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[220px] sm:w-[260px] z-10 translate-y-[55%] group-hover:translate-y-[45%] transition-transform duration-500">
                                        <div className="relative">
                                            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#1d1d1b] to-transparent z-20"></div>
                                            <img
                                                src={celular3Img}
                                                alt="Controle de Faturas"
                                                className="w-full h-auto object-cover object-top drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Funcionalidades Card 3 - Automação Bancária */}
                            <motion.div variants={itemVariants} className="w-full">
                                <div className="relative bg-[#1d1d1b] rounded-[36px] overflow-hidden shadow-3xl group transition-all duration-300 cursor-default w-full h-[350px] sm:h-[420px] p-8 sm:p-12 flex flex-col items-center text-center">
                                    {/* Content Text */}
                                    <div className="relative z-20 w-full mb-auto">
                                        <h4 className="text-[14px] sm:text-[16px] font-bold text-white leading-[1.3] filter drop-shadow-sm max-w-[260px] mx-auto">
                                            Automatize o lançamento de gastos e receitas conectando seus bancos
                                        </h4>
                                    </div>

                                    {/* Phone Mockup - Better masking and positioning */}
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[220px] sm:w-[260px] z-10 translate-y-[55%] group-hover:translate-y-[45%] transition-transform duration-500">
                                        <div className="relative">
                                            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#1d1d1b] to-transparent z-20"></div>
                                            <img
                                                src={celular2Img}
                                                alt="Automação Bancária"
                                                className="w-full h-auto object-cover object-top drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                </motion.div >
            </section >





        </div >
    );
}