import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import NumberFlow from '@number-flow/react';
import { ShiningText } from '../ShiningText';
import { AnimatedGridPattern } from '../AnimatedGridPattern';
import { InfiniteSlider } from '../InfiniteSlider';
import { BlurTextEffect } from '../BlurTextEffect';
import { Sparkles, CheckCircle, ShieldCheck, LogIn, TrendingDown, SearchX, AlertTriangle } from 'lucide-react';
import dashboardImg from '../../assets/dashboard.png';
import fogueteImg from '../../assets/foguete.png';
import celularImg from '../../assets/celular.png';
import celular2Img from '../../assets/celular 2.png';
import celular3Img from '../../assets/celular3.png';
import demoVideo from '../../assets/video.MOV';

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
            // Lançamento em 14 dias a partir de hoje às 00:00
            const launchDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14, 0, 0, 0);
            const difference = launchDate.getTime() - now.getTime();

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

// --- COMPONENTE: Video Player com Controle de Som e Volume ---
const VideoPlayer: React.FC<{ videoSrc: string }> = ({ videoSrc }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(true);
    const [volume, setVolume] = useState(0.7);
    const [showVolumeSlider, setShowVolumeSlider] = useState(false);

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
            setIsMuted(videoRef.current.muted);
            // Se estava mutado e agora ativou, aplicar volume atual
            if (!videoRef.current.muted) {
                videoRef.current.volume = volume;
            }
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (videoRef.current) {
            videoRef.current.volume = newVolume;
            // Se volume for 0, mutar. Se maior, desmutar
            if (newVolume === 0) {
                videoRef.current.muted = true;
                setIsMuted(true);
            } else if (videoRef.current.muted) {
                videoRef.current.muted = false;
                setIsMuted(false);
            }
        }
    };

    const handleVideoClick = () => {
        // Ao clicar no vídeo, ativar o som se estiver mutado
        if (videoRef.current && isMuted) {
            videoRef.current.muted = false;
            videoRef.current.volume = volume;
            setIsMuted(false);
        }
    };

    // Ícone de volume baseado no estado
    const VolumeIcon = () => {
        if (isMuted || volume === 0) {
            return (
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
            );
        } else if (volume < 0.5) {
            return (
                <svg className="w-5 h-5 text-[#D97757]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
            );
        } else {
            return (
                <svg className="w-5 h-5 text-[#D97757]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
            );
        }
    };

    return (
        <div
            className="relative rounded-2xl overflow-hidden border border-[#D97757]/30 bg-[#262624] shadow-2xl shadow-[#D97757]/10 cursor-pointer group"
            onClick={handleVideoClick}
        >
            {/* Gradient border effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#D97757]/50 via-transparent to-[#D97757]/50 opacity-30 pointer-events-none" />

            <video
                ref={videoRef}
                src={videoSrc}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-auto rounded-2xl"
                style={{ aspectRatio: '16/9', objectFit: 'cover' }}
            />

            {/* Sound Control Panel */}
            <div
                className="absolute bottom-4 right-4 flex items-center gap-2 cursor-default"
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
            >
                {/* Volume Slider - appears on hover when not muted */}
                <div className={`
                    flex items-center gap-2 
                    px-3 py-2 
                    rounded-full 
                    bg-black/60 backdrop-blur-md 
                    border border-white/10
                    transition-all duration-300 origin-right
                    ${showVolumeSlider && !isMuted ? 'opacity-100 scale-100 w-32' : 'opacity-0 scale-95 w-0 overflow-hidden'}
                `}>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={volume}
                        onChange={handleVolumeChange}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                            bg-white/20
                            [&::-webkit-slider-thumb]:appearance-none
                            [&::-webkit-slider-thumb]:w-3
                            [&::-webkit-slider-thumb]:h-3
                            [&::-webkit-slider-thumb]:rounded-full
                            [&::-webkit-slider-thumb]:bg-[#D97757]
                            [&::-webkit-slider-thumb]:cursor-pointer
                            [&::-webkit-slider-thumb]:shadow-lg
                            [&::-webkit-slider-thumb]:shadow-[#D97757]/50
                            [&::-webkit-slider-thumb]:transition-transform
                            [&::-webkit-slider-thumb]:hover:scale-125
                            [&::-moz-range-thumb]:w-3
                            [&::-moz-range-thumb]:h-3
                            [&::-moz-range-thumb]:rounded-full
                            [&::-moz-range-thumb]:bg-[#D97757]
                            [&::-moz-range-thumb]:cursor-pointer
                            [&::-moz-range-thumb]:border-0
                        "
                        style={{
                            background: `linear-gradient(to right, #D97757 0%, #D97757 ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%, rgba(255,255,255,0.2) 100%)`
                        }}
                    />
                    <span className="text-xs text-white/70 font-mono min-w-[2rem] text-right">
                        {Math.round(volume * 100)}%
                    </span>
                </div>

                {/* Main Sound Button */}
                <div
                    className={`
                        flex items-center gap-2 
                        px-3 py-2 
                        rounded-full 
                        bg-black/60 backdrop-blur-md 
                        border border-white/10
                        transition-all duration-300
                        cursor-pointer
                        hover:bg-black/70
                        ${isMuted ? '' : 'hover:border-[#D97757]/30'}
                    `}
                    onClick={toggleMute}
                >
                    {isMuted ? (
                        <>
                            {/* Muted Icon with pulse animation */}
                            <div className="relative">
                                <VolumeIcon />
                                {/* Pulse animation ring */}
                                <span className="absolute -inset-1 rounded-full bg-[#D97757]/50 animate-ping opacity-75" />
                            </div>
                            <span className="text-xs text-white font-medium hidden sm:inline">
                                Clique para ativar
                            </span>
                        </>
                    ) : (
                        <>
                            <VolumeIcon />
                            <span className="text-xs text-[#D97757] font-medium hidden sm:inline">
                                {showVolumeSlider ? 'Volume' : 'Som ativado'}
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Click anywhere hint on hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300 pointer-events-none flex items-center justify-center">
                <div className={`
                    transform transition-all duration-300 
                    ${isMuted ? 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100' : 'opacity-0'}
                `}>
                    <div className="bg-black/70 backdrop-blur-md rounded-full p-4 border border-white/10">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
};

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

                        <motion.div variants={itemVariants} className="flex flex-col items-center gap-4 mb-4">
                            <span className="text-[#D97757] text-[10px] sm:text-xs uppercase tracking-[0.4em] font-bold">O App Controlar+ chega em:</span>
                            <CountdownTimer />
                        </motion.div>

                        <motion.h1 variants={itemVariants} className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-tight">
                            Desbloqueie o potencial <br />
                            das suas <ShiningText text="Finanças." />
                        </motion.h1>
                        <motion.p variants={itemVariants} className="text-xl text-gray-400 max-w-2xl mx-auto mt-4">
                            Controlar+ é a plataforma financeira mais produtiva já feita.
                            Obtenha clareza total sobre seu dinheiro em segundos.
                        </motion.p>

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
                            <button onClick={() => {
                                if (onSubscribe) onSubscribe({ planId: 'pro', billingCycle: 'monthly', couponCode: 'PROMO50' });
                            }} className="px-12 py-4 min-w-[200px] bg-[#D97757] hover:bg-[#c66a4e] text-white rounded-full font-medium transition-all flex items-center justify-center gap-2 group shadow-lg shadow-[#D97757]/20 hover:shadow-[#D97757]/40 relative overflow-hidden mx-auto">
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                Começar Agora
                                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </button>

                            {/* App Download Badges - Launching soon */}
                            <div className="flex flex-col items-center gap-3">
                                <span className="text-gray-500 text-[9px] uppercase tracking-[0.15em] font-bold opacity-70">Disponível em breve para</span>
                                <div className="flex items-center gap-3 relative group/badges">
                                    <div className="h-9 opacity-40 grayscale pointer-events-none cursor-not-allowed">
                                        <img
                                            src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg"
                                            alt="Download on App Store"
                                            className="h-full w-auto"
                                        />
                                    </div>
                                    <div className="h-9 opacity-40 grayscale pointer-events-none cursor-not-allowed">
                                        <img
                                            src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
                                            alt="Get it on Google Play"
                                            className="h-full w-auto"
                                        />
                                    </div>
                                    {/* Tooltip or Label */}
                                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/80 text-white text-[10px] px-2 py-0.5 rounded border border-white/10 opacity-0 group-hover/badges:opacity-100 transition-opacity">
                                        Aguarde o lançamento
                                    </div>
                                </div>
                            </div>
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

            {/* Mobile First Section */}
            <section className="relative w-full py-20 bg-[#1a0f0a]">
                <div className="container mx-auto px-4">
                    <div className="relative overflow-hidden p-8 sm:p-16 flex flex-col md:flex-row items-center gap-12">

                        <div className="flex-1 space-y-6 relative z-10 text-center md:text-left">
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D97757]/10 border border-[#D97757]/20 text-[#D97757] text-xs font-bold uppercase tracking-widest">
                                Mobile Experience
                            </span>
                            <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">
                                <BlurTextEffect>Suas finanças na palma da mão.</BlurTextEffect>
                            </h2>
                            <p className="text-gray-400 text-lg max-w-xl">
                                Registre gastos, consulte saldos e receba alertas importantes onde quer que você esteja. Nossos apps para <span className="text-white font-medium">iOS</span> e <span className="text-white font-medium">Android</span> oferecem a experiência mais fluida do mercado.
                            </p>

                            <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-4 relative group/badges">
                                <div className="h-12 opacity-40 grayscale pointer-events-none">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg" alt="App Store" className="h-full" />
                                </div>
                                <div className="h-12 opacity-40 grayscale pointer-events-none">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Google Play" className="h-full" />
                                </div>
                                <div className="absolute -bottom-8 left-1/2 md:left-24 -translate-x-1/2 whitespace-nowrap bg-[#D97757]/20 text-[#D97757] text-xs font-bold px-3 py-1 rounded-full border border-[#D97757]/30 backdrop-blur-sm">
                                    Vem aí em 14 dias
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 relative flex justify-center items-center">

                            <motion.div
                                initial={{ y: 40, opacity: 0 }}
                                whileInView={{ y: 0, opacity: 1 }}
                                transition={{ duration: 0.8 }}
                                viewport={{ once: true }}
                                className="relative w-full max-w-[280px]"
                            >
                                <img src={celularImg} alt="App Preview" className="w-full h-auto drop-shadow-[0_35px_60px_-15px_rgba(0,0,0,0.6)]" />
                            </motion.div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Video Demo Section */}
            < section className="relative w-full py-20 bg-[#1a0f0a]" >

                <div className="container mx-auto px-8">
                    <AnimatedSection direction="up" delay={0} className="text-center mb-12">
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#D97757]/10 border border-[#D97757]/20 text-[#D97757] text-sm font-medium mb-6">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Veja em ação
                        </span>
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            <BlurTextEffect>Descubra como o Controlar+</BlurTextEffect>
                            <br />
                            <span className="text-[#D97757]"><BlurTextEffect>transforma suas finanças</BlurTextEffect></span>
                        </h2>
                        <p className="text-gray-400 max-w-2xl mx-auto">
                            Assista a uma demonstração rápida e veja como é fácil ter controle total sobre seu dinheiro.
                        </p>
                    </AnimatedSection>

                    <AnimatedSection direction="up" delay={200} className="relative max-w-5xl mx-auto">
                        {/* Glow effect behind video */}
                        <div className="absolute -inset-4 bg-gradient-to-r from-[#D97757]/20 via-[#D97757]/10 to-[#D97757]/20 rounded-3xl blur-2xl opacity-50" />

                        {/* Video container with premium border */}
                        <VideoPlayer videoSrc={demoVideo} />

                        {/* Decorative elements */}
                        <div className="absolute -top-6 -right-6 w-12 h-12 bg-[#D97757]/20 rounded-full blur-xl" />
                        <div className="absolute -bottom-6 -left-6 w-16 h-16 bg-[#D97757]/20 rounded-full blur-xl" />
                    </AnimatedSection>
                </div>
            </section >

        </div >
    );
}