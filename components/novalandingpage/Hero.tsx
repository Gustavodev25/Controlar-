import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import NumberFlow from '@number-flow/react';
import { ShiningText } from '../ShiningText';
import { AnimatedGridPattern } from '../AnimatedGridPattern';
import { InfiniteSlider } from '../InfiniteSlider';
import { BlurTextEffect } from '../BlurTextEffect';
import { Sparkles, CheckCircle } from 'lucide-react';
import dashboardImg from '../../assets/dashboard.png';
import fogueteImg from '../../assets/foguete.png';

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
        const calculateTimeLeft = () => {
            const now = new Date();
            const target = new Date(now);
            target.setHours(24, 0, 0, 0); // Set to next midnight (00:00:00 of tomorrow)

            const difference = target.getTime() - now.getTime();

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
    onLogin: () => void;
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
                    className="container mx-auto flex flex-col lg:flex-row items-center justify-between gap-12 z-10 px-4 lg:px-12 h-full"
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
                >
                    {/* Left Side: Original Hero Text */}
                    <motion.div className="flex-1 space-y-8 text-center lg:text-left flex flex-col items-center lg:items-start">

                        {/* New Premium Scarcity Badge */}
                        <motion.div
                            variants={itemVariants}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#D97757]/10 border border-[#D97757]/20 backdrop-blur-md mb-2 cursor-default transition-colors hover:bg-[#D97757]/15"
                        >
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D97757] opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D97757]"></span>
                            </span>
                            <span className="text-xs font-bold text-[#D97757] tracking-wide uppercase">
                                Restam apenas 23 vagas promocionais
                            </span>
                            <div className="w-16 h-1.5 bg-[#D97757]/20 rounded-full overflow-hidden ml-1">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: "23%" }}
                                    transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                                    className="h-full bg-[#D97757]"
                                />
                            </div>
                        </motion.div>

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
                            <button onClick={() => {
                                // Ir direto para checkout se onSubscribe disponível
                                if (onSubscribe) {
                                    onSubscribe({
                                        planId: 'pro',
                                        billingCycle: 'monthly',
                                        couponCode: 'FELIZ2026'
                                    });
                                } else {
                                    // Fallback: salvar pending_checkout e ir para login
                                    const pendingCheckout = {
                                        planId: 'pro',
                                        billingCycle: 'monthly',
                                        couponCode: 'FELIZ2026'
                                    };
                                    localStorage.setItem('pending_checkout', JSON.stringify(pendingCheckout));
                                    onLogin();
                                }
                            }} className="px-12 py-4 min-w-[200px] bg-[#D97757] hover:bg-[#c66a4e] text-white rounded-full font-medium transition-all flex items-center justify-center gap-2 group shadow-lg shadow-[#D97757]/20 hover:shadow-[#D97757]/40">
                                Assinar Pro
                                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </button>

                            {/* Trust & Social Proof */}
                            <div className="flex flex-col items-center lg:items-start gap-4 mt-2">
                                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-2 text-xs font-medium text-gray-400">
                                    <span className="flex items-center gap-1.5">
                                        <CheckCircle size={13} className="text-emerald-500" /> Pronto em 5 minutos
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <CheckCircle size={13} className="text-emerald-500" /> 100% seguro
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <CheckCircle size={13} className="text-emerald-500" /> Automatizado com IA
                                    </span>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="flex -space-x-3">
                                        {[
                                            "https://randomuser.me/api/portraits/women/44.jpg",
                                            "https://randomuser.me/api/portraits/men/32.jpg",
                                            "https://randomuser.me/api/portraits/women/65.jpg",
                                            "https://randomuser.me/api/portraits/men/86.jpg"
                                        ].map((src, i) => (
                                            <div key={i} className="w-8 h-8 rounded-full border-2 border-[#1a0f0a] flex items-center justify-center overflow-hidden bg-gray-800">
                                                <img
                                                    src={src}
                                                    alt="User"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ))}
                                        <div className="w-8 h-8 rounded-full border-2 border-[#1a0f0a] bg-[#D97757] flex items-center justify-center text-[10px] font-bold text-white relative z-10">
                                            +1k
                                        </div>
                                    </div>
                                    <span className="text-sm text-gray-400">
                                        <span className="text-white font-bold">+ de 1.000</span> usuários ativos
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>

                    {/* Right Side: Promotion Card (Clean Style) */}
                    <motion.div variants={itemVariants} className="w-full max-w-sm lg:max-w-md relative mt-12 lg:mt-0 flex flex-col items-center gap-6">

                        {/* Countdown Timer Above Card */}
                        <div className="flex flex-col items-center gap-3">
                            <p className="text-sm uppercase tracking-widest text-[#D97757] font-bold">Oferta de Ano Novo acaba em:</p>
                            <CountdownTimer />
                        </div>

                        <motion.div
                            animate={{
                                rotate: [0, -1, 1, -1, 1, 0],
                                scale: [1, 1.02, 1],
                                boxShadow: [
                                    "0 25px 50px -12px rgba(217, 119, 87, 0.1)",
                                    "0 0 40px 10px rgba(217, 119, 87, 0.4)",
                                    "0 25px 50px -12px rgba(217, 119, 87, 0.1)"
                                ]
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                repeatDelay: 4.5,
                                ease: "easeInOut"
                            }}
                            className="relative bg-[#262624] border border-[#d97757] rounded-3xl p-6 flex flex-col shadow-2xl shadow-[#d97757]/10 w-full max-w-[320px]"
                        >

                            {/* Badge */}
                            <div className="absolute top-0 right-0 bg-[#d97757] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-bl-lg rounded-tr-2xl">
                                MAIS POPULAR
                            </div>

                            {/* Image */}
                            <div className="flex justify-center mb-2">
                                <img src={fogueteImg} alt="Pro" className="w-12 h-12 object-contain" />
                            </div>

                            {/* Title */}
                            <h3 className="text-lg font-bold text-white mb-1 flex items-center justify-center gap-2">
                                Pro <Sparkles size={14} className="text-[#d97757]" />
                            </h3>

                            {/* Description */}
                            <p className="text-gray-400 text-xs mb-4 text-center">
                                Todos os recursos avançados.
                            </p>

                            {/* Price */}
                            <div className="mb-4 text-center flex flex-col items-center">
                                <span className="text-gray-500 line-through text-xl opacity-60 mb-0.5">
                                    R$ 35,90
                                </span>
                                <div className="flex items-center gap-1">
                                    <span className="text-4xl font-bold text-white">
                                        <NumberFlow
                                            value={9.90}
                                            format={{ style: 'currency', currency: 'BRL' }}
                                            locales="pt-BR"
                                        />
                                    </span>
                                    <span className="text-gray-500 text-sm">/mês</span>
                                </div>
                                <div className="mt-4 w-full px-2">
                                    <div
                                        onClick={() => {
                                            navigator.clipboard.writeText("FELIZ2026");
                                            // Optional: You might want to add a toast or state change here to indicate copy
                                            const el = document.getElementById('coupon-text');
                                            if (el) {
                                                const original = el.innerText;
                                                el.innerText = "COPIADO!";
                                                setTimeout(() => el.innerText = original, 2000);
                                            }
                                        }}
                                        className="relative flex items-center justify-center bg-[#D97757]/10 border border-dashed border-[#D97757]/40 rounded-xl py-2 px-4 transition-all hover:bg-[#D97757]/20 hover:scale-105 active:scale-95 cursor-pointer group"
                                    >
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] uppercase font-bold text-[#D97757]/70 leading-none mb-1">Promoção de Ano Novo</span>
                                            <span id="coupon-text" className="text-lg font-extrabold text-[#D97757] tracking-widest leading-none">FELIZ2026</span>
                                        </div>
                                        <div className="absolute right-3 opacity-0 group-hover:opacity-100 transition-opacity text-[#D97757]">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-2 text-center cursor-pointer hover:text-gray-300 transition-colors" onClick={() => navigator.clipboard.writeText("FELIZ2026")}>
                                        Clique para copiar o cupom
                                    </p>
                                </div>
                            </div>

                            {/* Features */}
                            <ul className="space-y-2.5 mb-6 flex-1">
                                <li className="flex items-center gap-2.5 text-xs text-white">
                                    <CheckCircle size={14} className="text-[#d97757]" />
                                    <span className="font-bold">IA Integrada ilimitada</span>
                                </li>
                                <li className="flex items-center gap-2.5 text-xs text-white">
                                    <CheckCircle size={14} className="text-[#d97757]" />
                                    <span>Lançamentos por Texto</span>
                                </li>
                                <li className="flex items-center gap-2.5 text-xs text-white">
                                    <CheckCircle size={14} className="text-[#d97757]" />
                                    <span>Consultor Financeiro IA</span>
                                </li>
                                <li className="flex items-center gap-2.5 text-xs text-white">
                                    <CheckCircle size={14} className="text-[#d97757]" />
                                    <span>Metas e Lembretes</span>
                                </li>
                                <li className="flex items-center gap-2.5 text-xs text-white">
                                    <CheckCircle size={14} className="text-[#d97757]" />
                                    <span>Contas Bancárias Ilimitadas</span>
                                </li>
                            </ul>

                            {/* CTA */}
                            <button
                                onClick={() => {
                                    // Ir direto para checkout se onSubscribe disponível
                                    if (onSubscribe) {
                                        onSubscribe({
                                            planId: 'pro',
                                            billingCycle: 'monthly',
                                            couponCode: 'FELIZ2026'
                                        });
                                    } else {
                                        // Fallback: salvar pending_checkout e ir para login
                                        const pendingCheckout = {
                                            planId: 'pro',
                                            billingCycle: 'monthly',
                                            couponCode: 'FELIZ2026'
                                        };
                                        localStorage.setItem('pending_checkout', JSON.stringify(pendingCheckout));
                                        onLogin();
                                    }
                                }}
                                className="w-full py-3 rounded-xl font-bold transition-colors bg-[#d97757] hover:bg-[#c56a4d] text-white shadow-lg shadow-[#d97757]/25"
                            >
                                Assinar Pro
                            </button>

                        </motion.div>
                    </motion.div>
                </motion.div>
            </section>

            {/* Infinite Slider - Bancos Parceiros */}
            <section className="relative w-full py-8 bg-[#1a0f0a] border-y border-white/5">
                <div className="flex items-center">
                    {/* Quadrado com texto */}
                    <div className="flex-shrink-0 px-8 py-4 border-r border-white/10">
                        <p className="text-sm text-gray-400 uppercase tracking-widest whitespace-nowrap">Conecte com seus bancos favoritos</p>
                    </div>

                    {/* Slider */}
                    <div className="relative flex-1 overflow-hidden">
                        {/* Fade nas laterais */}
                        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#1a0f0a] to-transparent z-10 pointer-events-none" />
                        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#1a0f0a] to-transparent z-10 pointer-events-none" />

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
            <section className="relative w-full py-12 bg-[#1a0f0a]">
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