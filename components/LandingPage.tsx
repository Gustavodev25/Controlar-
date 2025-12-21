
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import NumberFlow from '@number-flow/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import {
  Sparkles,
  ArrowRight,
  Shield,
  Users,
  TrendingUp,
  CheckCircle,
  Calendar,
  Tag,
  DollarSign,
  Plus,
  Bell,
  BrainCircuit,
  Car,
  Send,
  Instagram,
  Check,
  MessageSquare,
  ChevronDown,
  X,
  Mail,
  User,
  AlertCircle,
  Phone,
  Link,
  Zap,
  FileText,
  Target,
  CreditCard,
  Smartphone,
  Menu,
  Building,
  RefreshCw,
  Trash2,
  Wallet,
  PieChart,
  Download,
  RotateCcw,
  HelpCircle,
  Briefcase,
  Lock,
  Percent,
  Flame,
  Lightbulb
} from './Icons';
import quebraCabecaImg from '../assets/quebra-cabeca.png';
import fogueteImg from '../assets/foguete.png';
import coinzinhaImg from '../assets/coinzinha.png';

import bannerImg from '../assets/banner.png';
import lpVideo from '../assets/lpvideo.mp4';
import { Logo } from './Logo';
import { CustomSelect } from './UIComponents';
import * as dbService from '../services/database';
import { useToasts } from './Toast';
import { TestimonialsColumn } from './TestimonialsColumn';
import { SparklesText } from './SparklesText';
import { FadeText } from './FadeText';
import { ContainerTextFlip } from './ContainerTextFlip';
import { usePixelEvent } from '../hooks/usePixelEvent';

interface LandingPageProps {
  onLogin: () => void;
  variant?: 'waitlist' | 'auth';
}

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

  const baseClasses = `transition-all duration-700 ease-out ${isVisible ? 'translate-y-0 translate-x-0 opacity-100' : animations[direction]
    }`;

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

// --- ANIMATED NUMBER COMPONENT (Using NumberFlow) ---
const AnimatedNumber = ({
  value,
  decimals = 2
}: {
  value: number;
  decimals?: number;
}) => {
  return (
    <NumberFlow
      value={value}
      format={{
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }}
      locales="pt-BR"
    />
  );
};

// --- TEXT EFFECTS (alinhado ao AIChatAssistant) ---
const BlurredStagger = ({ text, className = '' }: { text: string; className?: string }) => {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.005 }
    }
  };

  const letterAnimation = {
    hidden: { opacity: 0, filter: 'blur(10px)' },
    show: { opacity: 1, filter: 'blur(0)' }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className={`inline-block break-words max-w-full ${className}`}
    >
      {text.split('').map((char, index) => (
        <motion.span key={index} variants={letterAnimation} transition={{ duration: 0.2 }}>
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </motion.div>
  );
};

const TextShimmer = ({
  children,
  className = '',
  duration = 1.5,
  spread = 2
}: {
  children: string;
  className?: string;
  duration?: number;
  spread?: number;
}) => {
  const dynamicSpread = useMemo(() => children.length * spread, [children, spread]);

  return (
    <motion.p
      className={`
        relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent
        [--base-color:#a1a1aa] [--base-gradient-color:#000]
        [--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--base-gradient-color),#0000_calc(50%+var(--spread)))]
        [background-repeat:no-repeat,padding-box] ${className}
      `}
      initial={{ backgroundPosition: '100% center' }}
      animate={{ backgroundPosition: '0% center' }}
      transition={{ repeat: Infinity, duration, ease: 'linear' }}
      style={
        {
          '--spread': `${dynamicSpread}px`,
          backgroundImage: `var(--bg), linear-gradient(var(--base-color), var(--base-color))`
        } as React.CSSProperties
      }
    >
      {children}
    </motion.p>
  );
};

// --- COMPONENTE: DEMO INTERATIVA (HERO) ---
const AIInteractiveDemo = () => {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<'typing' | 'processing' | 'result' | 'reset'>('typing');
  const [exampleIndex, setExampleIndex] = useState(0);
  const messagesRef = useRef<HTMLDivElement>(null);

  const examples = [
    {
      text: "Jantar no Outback 240 reais ontem",
      result: {
        desc: "Jantar Outback",
        val: "- R$ 240,00",
        tag: "Alimentação",
        date: "Ontem",
        isExpense: true,
        icon: <Tag size={12} className="text-[#f17853]" />
      }
    },
    {
      text: "Recebi 4500 de salário hoje",
      result: {
        desc: "Salário Mensal",
        val: "+ R$ 4.500,00",
        tag: "Renda",
        date: "Hoje",
        isExpense: false,
        icon: <DollarSign size={12} className="text-green-500" />
      }
    },
    {
      text: "Gasolina 200 reais posto shell",
      result: {
        desc: "Posto Shell",
        val: "- R$ 200,00",
        tag: "Transporte",
        date: "Hoje",
        isExpense: true,
        icon: <Car size={12} className="text-blue-400" />
      }
    }
  ];

  const currentExample = examples[exampleIndex];

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    if (phase === 'typing') {
      if (text.length < currentExample.text.length) {
        timeout = setTimeout(() => {
          setText(currentExample.text.slice(0, text.length + 1));
        }, 40);
      } else {
        timeout = setTimeout(() => setPhase('processing'), 600);
      }
    } else if (phase === 'processing') {
      timeout = setTimeout(() => setPhase('result'), 1200);
    } else if (phase === 'result') {
      timeout = setTimeout(() => setPhase('reset'), 3500);
    } else if (phase === 'reset') {
      setText("");
      setPhase('typing');
      setExampleIndex((prev) => (prev + 1) % examples.length);
    }

    return () => clearTimeout(timeout);
  }, [text, phase, currentExample]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTo({
        top: messagesRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [text, phase, currentExample]);

  return (
    <div className="relative w-full max-w-[calc(100vw-2rem)] sm:max-w-lg lg:max-w-md mx-auto animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
      <div className="bg-[#30302E] border border-[#3a3a3a] rounded-2xl shadow-2xl overflow-hidden relative z-20 flex flex-col h-[420px] sm:h-[500px] lg:h-[540px] min-h-0">

        {/* Header - Matches AIChatAssistant */}
        <div className="h-14 bg-[#333432] border-b border-[#3a3a3a] flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center">
              <img src={coinzinhaImg} alt="Coinzinha" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-tight">Coinzinha</div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-[10px] text-gray-400 font-medium">Online</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="p-2 text-gray-400">
              <RefreshCw size={18} />
            </div>
            <div className="p-2 text-gray-400">
              <Plus size={18} />
            </div>
            <div className="w-px h-4 bg-gray-800 mx-1"></div>
            <div className="p-2 text-gray-400">
              <Menu size={18} />
            </div>
            <div className="p-2 text-gray-400">
              <X size={18} />
            </div>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={messagesRef}
          className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-4 space-y-3 bg-[#30302E] w-full flex flex-col items-center"
        >
          {/* AI Welcome Message */}
          <div className="flex justify-start w-full">
            <div className="max-w-[85%] p-3 rounded-2xl rounded-bl-sm bg-[#3a3a3a] border border-[#454545] text-gray-200 text-sm leading-relaxed shadow-sm">
              <div className="whitespace-pre-wrap break-words">
                Olá! Sou seu assistente financeiro. Posso ajudar a lançar gastos ou analisar suas finanças. Como posso ajudar hoje?
              </div>
              <p className="text-[10px] mt-1 text-right opacity-60 text-gray-400">16:33</p>
            </div>
          </div>

          {/* User Message (Typing) */}
          {(text || phase !== 'typing') && (
            <div className="flex justify-end w-full">
              <div className="max-w-[85%] p-3 rounded-2xl rounded-br-sm bg-[#d97757] text-white text-sm leading-relaxed shadow-sm">
                <div className="whitespace-pre-wrap break-words">
                  {text}
                  {phase === 'typing' && <span className="animate-pulse ml-1">|</span>}
                </div>
                <p className="text-[10px] mt-1 text-right opacity-60 text-white">16:33</p>
              </div>
            </div>
          )}

          {/* Processing State */}
          {phase === 'processing' && (
            <div className="flex justify-start w-full">
              <div className="bg-[#313131] border border-[#3a3a3a] rounded-2xl rounded-tl-sm p-4 flex items-center">
                <TextShimmer className='font-medium text-sm' duration={1.5}>
                  Pensando...
                </TextShimmer>
              </div>
            </div>
          )}

          {/* Result Card */}
          {phase === 'result' && (
            <div className="flex justify-start w-full animate-fade-in-up">
              <div className="w-full max-w-[280px] bg-[#252525] border border-[#404040] rounded-2xl overflow-hidden shadow-xl">
                {/* Top: Category Badge */}
                <div className="p-4 pb-0 flex justify-between items-start">
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#333] border border-[#444]">
                    {currentExample.result.icon}
                    <span className="text-[10px] font-medium text-gray-300 uppercase tracking-wide">{currentExample.result.tag}</span>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${currentExample.result.isExpense ? 'bg-[#d97757]' : 'bg-green-500'}`} />
                </div>

                {/* Center: Amount & Info */}
                <div className="px-5 py-6 text-center">
                  <p className="text-xs text-gray-500 font-medium mb-1">
                    {currentExample.result.date}
                  </p>
                  <div className="text-3xl font-bold text-white tracking-tight mb-2">
                    {currentExample.result.val.replace('- ', '').replace('+ ', '')}
                  </div>
                  <p className="text-sm text-gray-400 font-medium leading-relaxed">
                    {currentExample.result.desc}
                  </p>
                </div>

                {/* Bottom: Action */}
                <div className="p-3 pt-0">
                  <div className="w-full bg-[#d97757] text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-default">
                    <Check size={16} />
                    Confirmar
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-3 bg-[#333432] border-t border-[#3a3a3a] shrink-0 w-full flex flex-col items-center">
          <div className="w-full">
            {/* Quick Actions */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3 pb-1">
              <button className="flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] rounded-xl border border-[#3a3a3a] text-xs text-gray-300 whitespace-nowrap shrink-0">
                <div className="w-6 h-6 rounded-lg bg-[#d97757]/20 flex items-center justify-center">
                  <Plus size={12} className="text-[#d97757]" />
                </div>
                <span className="font-medium">Lançar</span>
              </button>
              <button className="flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] rounded-xl border border-[#3a3a3a] text-xs text-gray-300 whitespace-nowrap shrink-0">
                <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <TrendingUp size={12} className="text-blue-400" />
                </div>
                <span className="font-medium">Analisar</span>
              </button>
              <button className="flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] rounded-xl border border-[#3a3a3a] text-xs text-gray-300 whitespace-nowrap shrink-0">
                <div className="w-6 h-6 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                  <Lightbulb size={12} className="text-yellow-400" />
                </div>
                <span className="font-medium">Dica</span>
              </button>
            </div>

            {/* Input Field */}
            <div className="flex items-center gap-2 bg-[#2D2D2D] border border-[#3a3a3a] rounded-xl px-3 py-2.5">
              <input
                type="text"
                value={text}
                readOnly
                placeholder="Digite sua mensagem..."
                className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
              />
              <button className="p-2 bg-[#d97757] rounded-lg text-white shadow-lg shadow-[#d97757]/20">
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTE: FAQ (ACCORDIONS) ---
const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    { q: "Meus dados bancários estão seguros?", a: "Absolutamente. Utilizamos criptografia AES-256 de ponta a ponta. Seus dados são armazenados localmente no seu dispositivo quando possível e nunca vendemos suas informações para terceiros." },
    { q: "Como a IA categoriza meus gastos?", a: "Nossa IA analisa o texto natural que você digita (ex: 'Almoço R$ 40'). Ela identifica padrões, palavras-chave e contexto para atribuir a categoria correta (Alimentação), a data e o valor automaticamente." },
    { q: "Quais formas eu consigo lançar meus gastos e receitas?", a: "Você pode registrar tudo de forma manual, conectar suas contas pelo Open Finance para importação automática, enviar lançamentos pelo WhatsApp ou simplesmente falar com a Coinzinha, nossa IA que organiza tudo para você." }
  ];

  return (
    <div className="max-w-3xl mx-auto flex flex-col items-center">
      <div className="w-full relative z-10">
        {faqs.map((faq, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={i} className="mb-4 border border-gray-800 rounded-2xl bg-[#363735] overflow-hidden hover:border-gray-700 transition-colors">
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="w-full flex items-center justify-between p-6 text-left focus:outline-none hover:bg-gray-900/30 transition-colors group"
              >
                <span className={`font-bold text-base transition-colors ${isOpen ? 'text-[#f17853]' : 'text-gray-200 group-hover:text-white'}`}>
                  {faq.q}
                </span>
                <ChevronDown
                  size={20}
                  className={`text-gray-500 transition-all duration-300 flex-shrink-0 ml-4 ${isOpen ? 'rotate-180 text-[#f17853]' : 'group-hover:text-gray-400'}`}
                />
              </button>
              <div
                className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
              >
                <div className="overflow-hidden">
                  <div className="px-6 pb-6 pt-2 text-gray-400 leading-relaxed border-t border-gray-800/50">
                    {faq.a}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- COMPONENTE: PLANOS (PRICING) ---
const PricingSection = ({ onStart }: { onStart: () => void }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const getPrice = (monthly: number, annual: number) => {
    if (billingCycle === 'monthly') return monthly;
    return annual / 12;
  };

  return (
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
                layoutId="billing-pill-landing"
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
                layoutId="billing-pill-landing"
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

      <div className="flex flex-col md:flex-row justify-center items-center md:items-stretch gap-6 lg:gap-8 max-w-4xl mx-auto">
        {/* Free */}
        <div className="bg-[#363735] border border-gray-800 rounded-3xl p-8 flex flex-col relative hover:border-gray-600 transition-colors flex-1 basis-0 w-full">
          <div className="flex justify-center mb-4">
            <img src={quebraCabecaImg} alt="Starter" className="w-16 h-16 object-contain" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Starter</h3>
          <p className="text-gray-500 text-sm mb-6">Para quem está começando a se organizar.</p>
          <div className="mb-6">
            <span className="text-4xl font-bold text-white">R$ 0</span>
            <span className="text-gray-500">/mês</span>
          </div>
          <ul className="space-y-4 mb-8 flex-1">
            <li className="flex items-center gap-3 text-sm text-gray-300"><Check size={16} className="text-gray-500" /> Lançamentos Manuais</li>
            <li className="flex items-center gap-3 text-sm text-gray-300"><Check size={16} className="text-gray-500" /> Dashboards Básicos</li>
            <li className="flex items-center gap-3 text-sm text-gray-300"><Check size={16} className="text-gray-500" /> 1 Usuário</li>
          </ul>
          <button onClick={onStart} className="w-full py-3 rounded-xl border border-gray-700 text-white font-bold hover:bg-gray-800 transition-colors cursor-pointer">
            Começar
          </button>
        </div>

        {/* Pro */}
        <div className="bg-[#363735] border border-[#f17853] rounded-3xl p-8 flex flex-col relative shadow-2xl shadow-[#f17853]/10 flex-1 basis-0 w-full">
          <div className="absolute top-0 right-0 bg-[#f17853] text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-3xl">
            MAIS POPULAR
          </div>
          <div className="flex justify-center mb-4">
            <img src={fogueteImg} alt="Pro" className="w-16 h-16 object-contain" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            Pro <Sparkles size={16} className="text-[#f17853]" />
          </h3>
          <p className="text-gray-400 text-sm mb-6">Todos os recursos avançados.</p>
          <div className="mb-6">
            <div>
              <span className="text-4xl font-bold text-white">
                R$ <AnimatedNumber key={`pro-${billingCycle}`} value={getPrice(35.90, 399.00)} decimals={2} />
              </span>
              <span className="text-gray-500">/mês</span>
            </div>
            {billingCycle === 'annual' && (
              <span className="text-xs text-gray-500 block mt-1">
                cobrado R$ 399,00 /ano
              </span>
            )}
          </div>
          <ul className="space-y-4 mb-8 flex-1">
            <li className="flex items-center gap-3 text-sm text-white"><CheckCircle size={16} className="text-[#f17853]" /> <span className="font-bold">IA Integrada ilimitada</span></li>
            <li className="flex items-center gap-3 text-sm text-white"><CheckCircle size={16} className="text-[#f17853]" /> Conexão Open Finance</li>
            <li className="flex items-center gap-3 text-sm text-white"><CheckCircle size={16} className="text-[#f17853]" /> Consultor Financeiro IA</li>
            <li className="flex items-center gap-3 text-sm text-white"><CheckCircle size={16} className="text-[#f17853]" /> Metas e Lembretes</li>
          </ul>
          <button onClick={onStart} className="w-full py-3 rounded-xl bg-[#f17853] hover:bg-[#e06949] text-white font-bold transition-colors shadow-lg shadow-[#f17853]/25 cursor-pointer">
            Começar
          </button>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTE: WAITLIST MODAL ---
const WaitlistModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const toast = useToasts();
  const { trackEvent } = usePixelEvent();
  const [waitlistForm, setWaitlistForm] = useState({ name: '', email: '', phone: '', goal: '', goalOther: '', source: '' });
  const [isSubmittingWaitlist, setSubmittingWaitlist] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (isOpen) {
      setIsVisible(true);
      // Bloquear scroll do body
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      // Restaurar scroll do body
      document.body.style.overflow = '';
      timeoutId = setTimeout(() => {
        setIsVisible(false);
      }, 300);
    }
    return () => {
      clearTimeout(timeoutId);
      // Garantir que o scroll seja restaurado ao desmontar
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handler para fechar com ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!waitlistForm.email.trim()) {
      toast.error('Informe um email válido para entrar na lista.');
      return;
    }

    setSubmittingWaitlist(true);

    try {
      const goalValue = waitlistForm.goal === 'Outros' ? waitlistForm.goalOther : waitlistForm.goal;

      await dbService.addWaitlistEntry({
        name: waitlistForm.name.trim() || 'Visitante',
        email: waitlistForm.email.trim(),
        phone: waitlistForm.phone.trim(),
        goal: goalValue.trim(),
        source: waitlistForm.source.trim() || 'landing-waitlist',
        createdAt: new Date().toISOString()
      });

      // Meta Pixel: Lead
      trackEvent('Lead', {
        content_name: 'Lista de Espera',
        content_category: 'lead',
        currency: 'BRL'
      });

      toast.success('Pronto! Você entrou para a lista de espera.', 'Avisaremos assim que liberarmos o acesso.');
      setWaitlistForm({ name: '', email: '', phone: '', goal: '', goalOther: '', source: '' });
      onClose();
    } catch (error) {
      console.error('Erro ao cadastrar lista de espera:', error);
      toast.error('Não foi possível salvar agora. Tente novamente em instantes.');
    } finally {
      setSubmittingWaitlist(false);
    }
  };

  if (!isVisible) return null;

  return createPortal(
    <div
      className={`
        fixed inset-0 z-[120] flex items-center justify-center p-4
        transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
        ${isAnimating ? 'backdrop-blur-md bg-black/60' : 'backdrop-blur-none bg-black/0'}
      `}
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-modal-title"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true"></div>
      <div className={`
        bg-[#363735] rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-800
        flex flex-col max-h-[90vh] relative
        transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
        ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
      `}>

        {/* Banner Image */}
        <div className="relative w-full h-32 sm:h-40 overflow-hidden">
          <img
            src={bannerImg}
            alt="Lista de espera"
            className="w-full h-full object-cover rounded-t-3xl"
          />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 hover:bg-black/20 rounded-xl border border-transparent hover:border-white/20 transition-all backdrop-blur-sm bg-black/10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Modal */}
        <div className="p-6 overflow-y-auto custom-scrollbar relative z-10">
          <form className="space-y-5 animate-fade-in" onSubmit={handleWaitlistSubmit}>

            {/* Nome */}
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block ml-1">Nome</label>
              <div className="relative group">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#f17853] transition-colors" />
                <input
                  type="text"
                  value={waitlistForm.name}
                  onChange={(e) => setWaitlistForm({ ...waitlistForm, name: e.target.value })}
                  placeholder="Como devemos te chamar?"
                  className="w-full bg-gray-900/50 border border-gray-800 rounded-xl text-white pl-12 pr-4 py-3.5 text-sm focus:border-[#f17853] focus:ring-1 focus:ring-[#f17853]/50 outline-none transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block ml-1">Email</label>
              <div className="relative group">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#f17853] transition-colors" />
                <input
                  type="email"
                  value={waitlistForm.email}
                  onChange={(e) => setWaitlistForm({ ...waitlistForm, email: e.target.value })}
                  placeholder="seuemail@exemplo.com"
                  className="w-full bg-gray-900/50 border border-gray-800 rounded-xl text-white pl-12 pr-4 py-3.5 text-sm focus:border-[#f17853] focus:ring-1 focus:ring-[#f17853]/50 outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* Telefone */}
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block ml-1">Telefone</label>
              <div className="relative group">
                <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#f17853] transition-colors" />
                <input
                  type="tel"
                  value={waitlistForm.phone}
                  onChange={(e) => setWaitlistForm({ ...waitlistForm, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="w-full bg-gray-900/50 border border-gray-800 rounded-xl text-white pl-12 pr-4 py-3.5 text-sm focus:border-[#f17853] focus:ring-1 focus:ring-[#f17853]/50 outline-none transition-all"
                />
              </div>
            </div>

            {/* Objetivo */}
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block ml-1">O que você quer resolver?</label>
              <CustomSelect
                value={waitlistForm.goal}
                onChange={(value) => setWaitlistForm({ ...waitlistForm, goal: value, goalOther: '' })}
                options={[
                  { value: '', label: 'Selecione uma opção' },
                  { value: 'Controle total', label: 'Controle total' },
                  { value: 'Controle de assinaturas', label: 'Controle de assinaturas' },
                  { value: 'Organizar investimentos', label: 'Organizar investimentos' },
                  { value: 'Contas em dia', label: 'Contas em dia' },
                  { value: 'Outros', label: 'Outros' }
                ]}
                placeholder="Selecione uma opção"
              />
            </div>

            {/* Textarea condicional para "Outros" */}
            {waitlistForm.goal === 'Outros' && (
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block ml-1">Especifique</label>
                <textarea
                  value={waitlistForm.goalOther}
                  onChange={(e) => setWaitlistForm({ ...waitlistForm, goalOther: e.target.value })}
                  placeholder="Descreva o que você quer resolver..."
                  className="w-full bg-gray-900/50 border border-gray-800 rounded-xl text-white px-4 py-3.5 text-sm focus:border-[#f17853] focus:ring-1 focus:ring-[#f17853]/50 outline-none transition-all min-h-[90px] resize-none"
                />
              </div>
            )}

            {/* De onde nos conheceu */}
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block ml-1">De onde nos conheceu?</label>
              <CustomSelect
                value={waitlistForm.source}
                onChange={(value) => setWaitlistForm({ ...waitlistForm, source: value })}
                options={[
                  { value: '', label: 'Selecione uma opção' },
                  { value: 'Google', label: 'Google' },
                  { value: 'Facebook', label: 'Facebook' },
                  { value: 'Instagram', label: 'Instagram' },
                  { value: 'Amigos', label: 'Amigos' },
                  { value: 'Outros', label: 'Outros' }
                ]}
                placeholder="Selecione uma opção"
              />
            </div>

            {/* Discount Message */}
            <div className="bg-[#f17853]/10 border border-[#f17853]/30 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-[#f17853]/20 rounded-lg">
                  <Sparkles size={18} className="text-[#f17853]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white mb-1">Desconto exclusivo no lançamento!</p>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Quem entrar na lista de espera terá acesso antecipado e desconto especial na assinatura.
                  </p>
                </div>
              </div>
            </div>

            {/* Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmittingWaitlist}
                className="w-full py-3.5 bg-[#f17853] text-white hover:bg-[#e06949] rounded-xl font-bold transition-all flex items-center justify-center shadow-lg shadow-[#f17853]/20 border border-[#f17853]/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingWaitlist ? 'Enviando...' : 'Confirmar presença'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};

// --- PÁGINA PRINCIPAL ---
export const LandingPage: React.FC<LandingPageProps> = ({ onLogin, variant = 'waitlist' }) => {
  const toast = useToasts();
  const [isWaitlistOpen, setWaitlistOpen] = useState(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isWaitlistVariant = variant === 'waitlist';

  const openWaitlist = () => {
    setWaitlistOpen(true);
  };

  const closeWaitlist = () => {
    setWaitlistOpen(false);
  };

  const primaryCtaLabel = isWaitlistVariant ? 'Entrar na lista de espera' : 'Criar Conta Grátis';
  const secondaryCtaLabel = isWaitlistVariant ? 'Receber novidades' : 'Ver Demo';
  const handlePrimaryCta = isWaitlistVariant ? openWaitlist : onLogin;
  const handleSecondaryCta = isWaitlistVariant ? openWaitlist : onLogin;

  return (
    <div className="min-h-screen bg-[#262624] text-[#faf9f5] font-sans overflow-x-hidden selection:bg-[#f17853]/30">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#262624]/80 border-b border-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Logo
            size={40}
            className="flex items-center gap-3"
            textClassName="font-bold text-xl tracking-tight text-white"
            imgClassName="rounded-xl"
          />

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-400">
            <a href="#system" className="hover:text-white transition-colors">Sistema</a>
            <a href="#pricing" className="hover:text-white transition-colors">Planos</a>
            <a href="#open-finance" className="hover:text-white transition-colors">Open Finance</a>
            <a href="#clt-calculator" className="hover:text-white transition-colors">Calculadora CLT</a>
            <a href="#fire-simulator" className="hover:text-white transition-colors">Simulador FIRE</a>
            <a href="#testimonials" className="hover:text-white transition-colors">Depoimentos</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-4">
            {isWaitlistVariant ? (
              <button
                onClick={openWaitlist}
                className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full font-bold text-sm transition-colors hidden md:block"
              >
                Lista de espera
              </button>
            ) : (
              <>

                <button
                  onClick={onLogin}
                  className="px-6 py-2.5 bg-white text-black rounded-full font-bold text-sm hover:bg-gray-200 transition-colors shadow-lg shadow-white/10 hidden md:block"
                >
                  Começar
                </button>
              </>
            )}

            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
              onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-20 left-0 right-0 bg-[#262624] border-b border-gray-800 animate-fade-in shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex flex-col p-6 space-y-4">
              <a
                href="#system"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium text-gray-300 hover:text-[#f17853]"
              >
                Sistema
              </a>
              <a
                href="#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium text-gray-300 hover:text-[#f17853]"
              >
                Planos
              </a>
              <a
                href="#open-finance"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium text-gray-300 hover:text-[#f17853]"
              >
                Open Finance
              </a>
              <a
                href="#clt-calculator"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium text-gray-300 hover:text-[#f17853]"
              >
                Calculadora CLT
              </a>
              <a
                href="#fire-simulator"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium text-gray-300 hover:text-[#f17853]"
              >
                Simulador FIRE
              </a>
              <a
                href="#testimonials"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium text-gray-300 hover:text-[#f17853]"
              >
                Depoimentos
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium text-gray-300 hover:text-[#f17853]"
              >
                FAQ
              </a>

              <div className="h-px bg-gray-800 my-2"></div>

              {isWaitlistVariant ? (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openWaitlist();
                  }}
                  className="w-full py-3 bg-[#f17853] hover:bg-[#e06949] text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                >
                  Entrar na Lista de Espera
                  <ArrowRight size={18} />
                </button>
              ) : (
                <div className="flex flex-col gap-4">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onLogin();
                    }}
                    className="w-full py-3 text-gray-300 font-bold hover:text-white border border-gray-800 rounded-xl"
                  >
                    Fazer Login
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onLogin();
                    }}
                    className="w-full py-3 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-colors"
                  >
                    Criar Conta Grátis
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section - REMOVED BACKGROUND BLURS */}
      <section className="relative pt-24 pb-14 lg:pt-28 lg:pb-24 px-4 lg:px-6 overflow-hidden bg-[#262624]">
        <div className="max-w-7xl mx-auto flex flex-col lg:grid lg:grid-cols-2 gap-10 lg:gap-16 items-center relative z-10">

          {/* Left: Content */}
          <div className="text-center lg:text-left relative z-20 w-full">
            {isWaitlistVariant && (
              <div className="mb-6 lg:mb-8 animate-fade-in-up">
                <SparklesText
                  text="Lançamento em breve"
                  className="text-sm lg:text-base font-bold text-white"
                  sparklesCount={8}
                  colors={{ first: "#f17853", second: "#ffa366" }}
                />
              </div>
            )}

            <h1 className="text-3xl sm:text-5xl lg:text-7xl font-bold tracking-tight mb-4 lg:mb-6 leading-[1.2] break-words max-w-full flex flex-col items-center lg:items-start">
              <FadeText
                text="O fim das"
                direction="up"
                className="block mb-2"
                framerProps={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0, transition: { type: "spring", duration: 0.8, delay: 0.1 } }
                }}
              />
              <ContainerTextFlip
                words={["planilhas chatas.", "dúvidas financeiras.", "contas manuais.", "surpresas ruins.", "desorganização financeira."]}
                interval={3000}
                className="text-2xl sm:text-4xl lg:text-5xl bg-[#363735] border-[#3A3B39]"
              />
            </h1>

            <p className="text-sm sm:text-base lg:text-xl text-gray-400 mb-8 lg:mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              Apenas diga o que gastou. Nossa IA categoriza, organiza e gera insights para você assumir o controle do seu dinheiro sem esforço.
            </p>

            <div className="flex flex-col w-full sm:flex-row items-center lg:items-start gap-3 lg:gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <button
                onClick={handlePrimaryCta}
                className="w-full sm:w-auto px-5 sm:px-6 lg:px-8 py-3 lg:py-4 rounded-2xl font-bold text-sm sm:text-base lg:text-lg transition-all flex items-center justify-center gap-2 group hover:-translate-y-1 bg-[#f17853] hover:bg-[#e06949] text-white shadow-xl shadow-[#f17853]/30"
              >
                {primaryCtaLabel}
                <ArrowRight className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <div className="mt-6 lg:mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-4 lg:gap-6 text-xs lg:text-sm text-gray-500 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <div className="flex items-center gap-2"><CheckCircle size={16} className="text-gray-600" /> Sem cartão necessário</div>
              <div className="flex items-center gap-2">
                <Users size={16} className="text-gray-600" />
                +<AnimatedNumber value={10} decimals={0} />k Usuários
              </div>
            </div>
          </div>

          {/* Right: Interactive AI Demo */}
          <div className="relative mt-8 lg:mt-0">
            <AIInteractiveDemo />
          </div>
        </div>
      </section>

      {/* System Preview Section */}
      <section id="system" className="py-24 lg:py-32 relative overflow-hidden bg-[#262624]">
        <div className="max-w-7xl mx-auto px-6 relative z-10">

          <AnimatedSection className="flex flex-col items-center text-center max-w-3xl mx-auto mb-24">
            <h2 className="text-3xl lg:text-5xl font-bold mb-6 tracking-tight relative z-10">
              <FadeText
                text="Um sistema completo."
                direction="up"
                className="block"
                framerProps={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0, transition: { type: "spring", duration: 0.8, delay: 0.1 } }
                }}
              />
              <FadeText
                text="E incrivelmente simples."
                direction="up"
                className="block"
                framerProps={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0, transition: { type: "spring", duration: 0.8, delay: 0.3 } }
                }}
              />
            </h2>
            <p className="text-gray-400 text-lg relative z-10">
              Não é apenas um chat. É um ecossistema financeiro completo construído automaticamente pelas suas conversas.
            </p>
          </AnimatedSection>

          {/* Video Demo */}
          <AnimatedSection className="mb-24 relative z-10 w-full max-w-5xl mx-auto">
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-800 bg-[#363735] relative group">
              <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors z-10 pointer-events-none" />
              <video
                src={lpVideo}
                className="w-full h-full object-cover"
                autoPlay
                muted
                loop
                playsInline
              />
            </div>
          </AnimatedSection>

          {/* Feature 1: Open Finance - Mockup à esquerda, texto à direita */}
          <div id="open-finance" className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-32">
            {/* Mockup - Screenshot real do sistema */}
            <AnimatedSection direction="left" className="order-2 lg:order-1">
              <div className="bg-[#363735] rounded-2xl shadow-2xl overflow-hidden border border-gray-800 relative group">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 opacity-5 bg-[#f17853] pointer-events-none transition-opacity group-hover:opacity-10"></div>
                {/* Header */}
                <div className="bg-[#363735] p-6 border-b border-gray-800">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xl font-bold text-white">Contas conectadas</h3>
                    <button className="px-4 py-2 bg-[#f17853] hover:bg-[#e06949] text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors">
                      <Link size={14} />
                      Conectar Banco
                    </button>
                  </div>
                  <p className="text-sm text-gray-500">Visualize saldos e movimentações dos bancos vinculados.</p>
                </div>

                {/* Bancos Conectados Section */}
                <div className="p-6 space-y-4 bg-[#363735]">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-base font-bold text-white">Bancos Conectados</h4>
                    <button className="bg-gray-900 hover:bg-gray-800 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all border border-gray-800 text-xs font-bold">
                      <RotateCcw size={14} />
                      Atualizar
                    </button>
                  </div>

                  {/* Nubank Card */}
                  <div className="bg-[#363735] border border-gray-800 rounded-2xl shadow-xl flex flex-col group relative overflow-hidden">
                    {/* Glow Effect */}
                    <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 opacity-5 bg-[#f17853] pointer-events-none transition-opacity group-hover:opacity-10"></div>

                    {/* Cabeçalho do Banco */}
                    <div className="bg-[#363735]/80 backdrop-blur-sm p-4 border-b border-gray-800 flex items-center justify-between gap-3 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-[#f17853] shadow-inner">
                          <Building size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Instituição</p>
                          <h4 className="text-sm font-bold text-white leading-tight">Nubank</h4>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-2 rounded-xl bg-gray-900 text-gray-400 border border-gray-800">
                          <RefreshCw size={14} />
                        </button>
                        <button className="p-2 rounded-xl bg-gray-900 text-gray-400 border border-gray-800">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Lista de Contas */}
                    <div className="p-4 space-y-3 bg-[#363735] relative z-10">
                      {/* Cartão Gold */}
                      <div className="bg-gray-900/30 border border-gray-800/60 rounded-xl hover:border-gray-700 transition-colors">
                        <div className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex gap-3">
                              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 h-fit">
                                <CreditCard size={18} />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-200">Cartão Gold</p>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mt-0.5">CREDIT · Gold</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-base font-mono font-bold text-emerald-400">
                                R$ <AnimatedNumber value={4488.21} decimals={2} />
                              </p>
                            </div>
                          </div>

                          {/* Bottom Details (Fatura) */}
                          <div className="flex items-center justify-between animate-fade-in mt-2 pt-2 border-t border-gray-800/50">
                            <div className="flex items-center gap-1.5 text-gray-500">
                              <PieChart size={12} />
                              <span className="text-[9px] font-medium">Fatura Atual</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-gray-800/40 px-2 py-1 rounded-lg border border-gray-800/50">
                              <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wide">Vence 15/12</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Conta Corrente */}
                      <div className="bg-gray-900/30 border border-gray-800/60 rounded-xl hover:border-gray-700 transition-colors">
                        <div className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex gap-3">
                              <div className="p-1.5 rounded-lg bg-[#f17853]/10 text-[#f17853] h-fit">
                                <Wallet size={18} />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-200">Conta Corrente</p>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mt-0.5">CHECKING</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-base font-mono font-bold text-emerald-400">
                                R$ <AnimatedNumber value={2845.90} decimals={2} />
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-end pt-1">
                            <div className="text-[10px] uppercase font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[#f17853] bg-[#f17853]/10 border border-[#f17853]/20">
                              <Download size={10} /> Importar
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Banco Inter Card (Mesma estrutura do Nubank) */}
                  <div className="bg-[#363735] border border-gray-800 rounded-2xl shadow-xl flex flex-col group relative overflow-hidden">
                    {/* Glow Effect */}
                    <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 opacity-5 bg-[#f17853] pointer-events-none transition-opacity group-hover:opacity-10"></div>

                    {/* Cabeçalho do Banco */}
                    <div className="bg-[#363735]/80 backdrop-blur-sm p-4 border-b border-gray-800 flex items-center justify-between gap-3 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-[#f17853] shadow-inner">
                          <Building size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Instituição</p>
                          <h4 className="text-sm font-bold text-white leading-tight">Banco Inter</h4>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-2 rounded-xl bg-gray-900 text-gray-400 border border-gray-800">
                          <RefreshCw size={14} />
                        </button>
                        <button className="p-2 rounded-xl bg-gray-900 text-gray-400 border border-gray-800">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Lista de Contas */}
                    <div className="p-4 space-y-3 bg-[#363735] relative z-10">
                      <div className="bg-gray-900/30 border border-gray-800/60 rounded-xl hover:border-gray-700 transition-colors">
                        <div className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex gap-3">
                              <div className="p-1.5 rounded-lg bg-[#f17853]/10 text-[#f17853] h-fit">
                                <Wallet size={18} />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-200">Conta Digital</p>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mt-0.5">CHECKING</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-base font-mono font-bold text-emerald-400">
                                R$ <AnimatedNumber value={1567.45} decimals={2} />
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-end pt-1">
                            <div className="text-[10px] uppercase font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[#f17853] bg-[#f17853]/10 border border-[#f17853]/20">
                              <Download size={10} /> Importar
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </AnimatedSection>

            {/* Texto */}
            <AnimatedSection direction="right" delay={200} className="order-1 lg:order-2">
              <div className="inline-block px-3 py-1 rounded-full bg-emerald-900/30 border border-emerald-700/30 text-emerald-400 text-xs font-bold mb-4 uppercase tracking-wider">Open Finance</div>
              <h3 className="text-3xl lg:text-4xl font-bold mb-6 text-white">
                <FadeText
                  text="Todas as suas contas em um só lugar"
                  direction="up"
                  framerProps={{
                    hidden: { opacity: 0, y: 20 },
                    show: { opacity: 1, y: 0, transition: { type: "spring", duration: 0.8, delay: 0.2 } }
                  }}
                />
              </h3>
              <p className="text-gray-400 text-lg leading-relaxed mb-8">
                Conecte bancos e cartões com tecnologia Open Finance Klavi. Sincronização automática de saldos e transações em tempo real, com segurança bancária.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-900/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                    <Check size={14} />
                  </div>
                  <div>
                    <p className="font-bold text-white mb-1">Sync Automática</p>
                    <p className="text-sm text-gray-400">Transações importadas automaticamente sem esforço manual</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-900/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                    <Check size={14} />
                  </div>
                  <div>
                    <p className="font-bold text-white mb-1">Multi-bancos</p>
                    <p className="text-sm text-gray-400">Suporte para +300 instituições financeiras brasileiras</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-900/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                    <Check size={14} />
                  </div>
                  <div>
                    <p className="font-bold text-white mb-1">Segurança Total</p>
                    <p className="text-sm text-gray-400">Certificação Open Finance com criptografia de ponta</p>
                  </div>
                </li>
              </ul>
            </AnimatedSection>
          </div>

          {/* Feature 2: Calculadora CLT - Texto à esquerda, mockup à direita */}
          <div id="clt-calculator" className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-32">
            {/* Texto */}
            <AnimatedSection direction="left" delay={200}>
              <div className="inline-block px-3 py-1 rounded-full bg-blue-900/30 border border-blue-700/30 text-blue-400 text-xs font-bold mb-4 uppercase tracking-wider">Calculadora CLT</div>
              <h3 className="text-3xl lg:text-4xl font-bold mb-6 text-white">Calcule salário líquido, hora extra e 13º</h3>
              <p className="text-gray-400 text-lg leading-relaxed mb-8">
                Ferramenta completa para CLT com cálculos de INSS, IRRF, hora extra, adicional noturno, vale-transporte e 13º salário. Regras atualizadas 2025.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-900/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                    <Check size={14} />
                  </div>
                  <div>
                    <p className="font-bold text-white mb-1">Hora Extra Precisa</p>
                    <p className="text-sm text-gray-400">Calcule HE 50%, 100% e adicionais noturnos automaticamente</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-900/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                    <Check size={14} />
                  </div>
                  <div>
                    <p className="font-bold text-white mb-1">Descontos CLT</p>
                    <p className="text-sm text-gray-400">INSS, IRRF, vale-transporte e outros descontos calculados</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-900/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                    <Check size={14} />
                  </div>
                  <div>
                    <p className="font-bold text-white mb-1">13º Salário</p>
                    <p className="text-sm text-gray-400">Simule 1ª e 2ª parcelas com descontos proporcionais</p>
                  </div>
                </li>
              </ul>
            </AnimatedSection>

            {/* Mockup - 3 Calculadoras em Tabs */}
            <AnimatedSection direction="right">
              <div className="bg-[#363735] rounded-2xl shadow-2xl overflow-hidden border border-gray-800 relative group">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 opacity-5 bg-[#f17853] pointer-events-none transition-opacity group-hover:opacity-10"></div>
                {/* Tabs */}
                <div className="bg-[#363735] border-b border-gray-800 flex">
                  <button className="flex-1 px-4 py-3 text-sm font-semibold bg-[#f17853] text-white border-r border-gray-800 flex items-center justify-center gap-2">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    Simples
                  </button>
                  <button className="flex-1 px-4 py-3 text-sm font-semibold text-gray-400 hover:text-white border-r border-gray-800 flex items-center justify-center gap-2">
                    <DollarSign size={16} />
                    Líquido CLT
                  </button>
                  <button className="flex-1 px-4 py-3 text-sm font-semibold text-gray-400 hover:text-white flex items-center justify-center gap-2">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Hora Extra
                  </button>
                </div>

                {/* Conteúdo - Lançamento Rápido (Simples) */}
                <div className="p-6">
                  <div className="bg-[#f17853]/10 border border-[#f17853]/30 rounded-xl p-4 mb-6 flex gap-4 items-start">
                    <HelpCircle className="text-[#f17853] shrink-0 mt-1" size={20} />
                    <div>
                      <h4 className="text-sm font-bold text-[#eab3a3] mb-1">Lançamento Rápido</h4>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        Registre entradas avulsas de forma simples.
                        <br />
                        <span className="opacity-70">Ideal para vendas ocasionais, freelances ou bônus de valor fixo.</span>
                      </p>
                    </div>
                  </div>

                  {/* Inputs */}
                  <div className="space-y-5 mb-6">
                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-1.5 block">Descrição</label>
                      <div className="relative group">
                        <Briefcase className="absolute left-3 top-3.5 text-gray-500" size={16} />
                        <div className="w-full bg-gray-800/50 border border-[#f17853] rounded-xl pl-10 pr-4 py-3 text-sm text-white font-medium flex items-center">
                          Projeto Freelance Web
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-1.5 block">Valor Recebido (R$)</label>
                      <div className="relative group">
                        <span className="absolute left-3 top-3 text-gray-500 font-bold text-lg">R$</span>
                        <div className="w-full bg-gray-800/50 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-xl font-bold text-white">
                          2.500,00
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2 border-t border-gray-800">
                      <div className="relative inline-flex items-center">
                        <div className="w-9 h-5 bg-[#f17853] rounded-full relative">
                          <div className="absolute top-[2px] left-[2px] bg-white border-gray-300 border rounded-full h-4 w-4 translate-x-full"></div>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-300">Deduzir Impostos (Estimativa)</p>
                        <p className="text-[9px] text-gray-500">Calcula INSS/IRRF marginal sobre o valor extra.</p>
                      </div>
                    </div>
                  </div>

                  {/* Result Card */}
                  <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-5 flex flex-col relative overflow-hidden mb-6">
                    <div className="space-y-3 relative z-0 mb-4">
                      <h5 className="text-gray-500 text-[10px] font-bold uppercase tracking-wider border-b border-gray-800 pb-2">Resumo do Lançamento</h5>

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">Tipo</span>
                        <span className="text-gray-300 font-medium">Projeto Freelance Web</span>
                      </div>

                      <div className="flex justify-between items-center text-xs pt-2 mt-2 border-t border-gray-800/50 border-dashed">
                        <span className="text-gray-400">Valor Bruto</span>
                        <span className="text-gray-300 font-mono">
                          R$ <AnimatedNumber value={2500} decimals={2} />
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">INSS (~11%)</span>
                        <span className="text-red-400 font-mono">
                          - R$ <AnimatedNumber value={275} decimals={2} />
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">IRRF (~7,5%)</span>
                        <span className="text-red-400 font-mono">
                          - R$ <AnimatedNumber value={187.5} decimals={2} />
                        </span>
                      </div>
                    </div>

                    <div className="relative z-0">
                      <div className="bg-gray-950 rounded-xl p-4 border border-gray-800 transition-colors mb-4 shadow-inner flex flex-col items-center justify-center">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Valor Total</p>
                        <p className="text-3xl font-bold text-green-400">
                          R$ <AnimatedNumber value={2037.5} decimals={2} />
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Botão */}
                  <button className="w-full py-3 bg-[#f17853] hover:bg-[#e06949] text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#f17853]/20">
                    <Check size={18} />
                    Confirmar
                  </button>
                </div>
              </div>
            </AnimatedSection>
          </div>

          {/* Feature 3: FIRE Calculator - Mockup à esquerda, texto à direita */}
          <div id="fire-simulator" className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-32">
            {/* Mockup */}
            <AnimatedSection direction="left" className="order-2 lg:order-1">
              <div className="bg-[#363735] rounded-2xl shadow-2xl overflow-hidden border border-gray-800 relative group">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 opacity-5 bg-[#d97757] pointer-events-none transition-opacity group-hover:opacity-10"></div>

                {/* Header */}
                <div className="bg-[#363735] p-6 border-b border-gray-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Simulador FIRE</h2>
                    <p className="text-gray-400 text-xs mt-1">Planejamento de Independência Financeira</p>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#d97757]/10 text-[#d97757] border border-[#d97757]/20 flex items-center gap-2">
                    <Sparkles size={12} /> Plano Pro
                  </div>
                </div>

                <div className="p-6 grid gap-6 lg:grid-cols-12 bg-[#363735]">
                  {/* Left Column: Parameters */}
                  <div className="lg:col-span-5 space-y-5">
                    <div className="space-y-4 relative z-10">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Parâmetros</h4>

                      {/* Input: Net Worth */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Patrimônio Atual</label>
                        <div className="bg-[#262624] border border-gray-800 rounded-xl p-3 flex items-center gap-3">
                          <div className="p-2 bg-[#363735] rounded-lg text-[#d97757] border border-gray-800">
                            <Wallet size={16} />
                          </div>
                          <div className="text-white font-bold font-mono">50.000</div>
                        </div>
                      </div>

                      {/* Input: Expenses */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Gasto Mensal Estimado</label>
                        <div className="bg-[#262624] border border-gray-800 rounded-xl p-3 flex items-center gap-3">
                          <div className="p-2 bg-[#363735] rounded-lg text-amber-500 border border-gray-800">
                            <Target size={16} />
                          </div>
                          <div className="text-white font-bold font-mono">3.000</div>
                        </div>
                      </div>

                      {/* Input: Savings */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Aporte Mensal</label>
                        <div className="bg-[#262624] border border-gray-800 rounded-xl p-3 flex items-center gap-3">
                          <div className="p-2 bg-[#363735] rounded-lg text-emerald-500 border border-gray-800">
                            <TrendingUp size={16} />
                          </div>
                          <div className="text-white font-bold font-mono">2.000</div>
                        </div>
                      </div>

                      {/* Input: Rate */}
                      <div className="space-y-3 pt-2 border-t border-gray-800">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1 flex items-center gap-2">
                            <Percent size={12} /> Rentabilidade Anual
                          </label>
                          <span className="text-xs font-bold text-[#d97757] bg-[#d97757]/10 px-2 py-0.5 rounded border border-[#d97757]/20 font-mono">8%</span>
                        </div>

                        <div className="w-full h-1.5 bg-gray-800 rounded-lg relative">
                          <div className="absolute top-0 left-0 h-full bg-[#d97757] rounded-lg" style={{ width: '46%' }}></div>
                          <div className="absolute top-0 left-[46%] w-3 h-3 bg-white rounded-full -mt-0.5 shadow-md cursor-pointer"></div>
                        </div>
                        <div className="flex justify-between text-[9px] text-gray-600 uppercase font-bold tracking-wider">
                          <span>Conservador (2%)</span>
                          <span>Agressivo (15%)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Results & Chart */}
                  <div className="lg:col-span-7 space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#262624] border border-gray-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Target size={14} className="text-[#d97757]" />
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Meta FIRE</p>
                        </div>
                        <p className="text-xl font-mono font-bold text-white tracking-tight">
                          R$ <AnimatedNumber value={900000} decimals={0} />
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">Patrimônio necessário</p>
                      </div>
                      <div className="bg-[#262624] border border-gray-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar size={14} className="text-emerald-500" />
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Liberdade em</p>
                        </div>
                        <p className="text-xl font-bold text-white tracking-tight">18a 4m</p>
                        <p className="text-[10px] text-gray-500 mt-1">Previsão: abril de 2043</p>
                      </div>
                    </div>

                    <div className="bg-[#262624] border border-gray-800 rounded-xl overflow-hidden flex flex-col h-[240px]">
                      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TrendingUp size={14} className="text-[#d97757]" />
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Projeção Patrimonial</p>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-[#d97757]"></div>
                            <span className="text-[9px] font-bold text-gray-400 uppercase">Patrimônio</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-gray-600"></div>
                            <span className="text-[9px] font-bold text-gray-600 uppercase">Meta</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 w-full p-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={[
                            { label: 'jan 26', patrimony: 50000, target: 900000 },
                            { label: 'mai 26', patrimony: 62000, target: 900000 },
                            { label: 'set 26', patrimony: 75000, target: 900000 },
                            { label: 'jan 27', patrimony: 90000, target: 900000 },
                            { label: 'mai 27', patrimony: 108000, target: 900000 },
                            { label: 'set 27', patrimony: 130000, target: 900000 },
                            { label: 'jan 28', patrimony: 155000, target: 900000 },
                          ]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                            <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} dy={10} />
                            <YAxis hide />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }}
                              itemStyle={{ color: '#fff' }}
                              formatter={(value: any, name: string) => {
                                const labels: { [key: string]: string } = {
                                  patrimony: 'Patrimônio',
                                  target: 'Meta'
                                };
                                return [new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value), labels[name] || name];
                              }}
                            />
                            <ReferenceLine y={900000} stroke="#4b5563" strokeDasharray="3 3" />
                            <Line type="monotone" dataKey="patrimony" stroke="#d97757" strokeWidth={3} dot={false} name="Patrimônio" />
                            <Line type="linear" dataKey="target" stroke="#4b5563" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Meta" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-[#d97757]/10 border border-[#d97757]/20 rounded-xl p-3 flex gap-3 items-start">
                      <div className="p-1.5 bg-[#d97757]/20 rounded text-[#d97757] shrink-0">
                        <Sparkles size={12} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Regra dos 4%</p>
                        <p className="text-[10px] text-gray-400 leading-relaxed">
                          Para cobrir <strong className="text-white">R$ 3.000</strong> mensais, sua meta é acumular <strong className="text-[#d97757]">R$ 900.000</strong>.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </AnimatedSection>

            <AnimatedSection direction="right" delay={200} className="order-1 lg:order-2">
              <div className="inline-block px-3 py-1 rounded-full bg-orange-900/30 border border-orange-700/30 text-orange-400 text-xs font-bold mb-4 uppercase tracking-wider">FIRE</div>
              <h3 className="text-3xl lg:text-4xl font-bold mb-6 text-white">Quando você pode se aposentar?</h3>
              <p className="text-gray-400 text-lg leading-relaxed mb-8">
                Calculadora FIRE (Financial Independence, Retire Early) com regra dos 4%, juros compostos e projeções personalizadas baseadas nos seus gastos reais.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-orange-900/30 flex items-center justify-center text-orange-400 shrink-0 mt-0.5">
                    <Check size={14} />
                  </div>
                  <div>
                    <p className="font-bold text-white mb-1">Regra dos 4%</p>
                    <p className="text-sm text-gray-400">Calcule o patrimônio necessário baseado em gastos mensais</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-orange-900/30 flex items-center justify-center text-orange-400 shrink-0 mt-0.5">
                    <Check size={14} />
                  </div>
                  <div>
                    <p className="font-bold text-white mb-1">Juros Compostos</p>
                    <p className="text-sm text-gray-400">Projeções com rentabilidade ajustável e aportes mensais</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-orange-900/30 flex items-center justify-center text-orange-400 shrink-0 mt-0.5">
                    <Check size={14} />
                  </div>
                  <div>
                    <p className="font-bold text-white mb-1">Timeline Visual</p>
                    <p className="text-sm text-gray-400">Veja mês a mês como seu patrimônio vai crescer</p>
                  </div>
                </li>
              </ul>
            </AnimatedSection>
          </div>

          <div className="mb-16">
            <AnimatedSection className="text-center mb-12">
              <div className="inline-block px-3 py-1 rounded-full bg-gray-800 border border-gray-700 text-xs font-bold text-gray-300 mb-4 uppercase tracking-wider">E muito mais</div>
              <h3 className="text-3xl lg:text-5xl font-bold mb-6 text-white">Recursos adicionais</h3>
              <p className="text-gray-400 text-lg leading-relaxed max-w-3xl mx-auto">
                Descubra tudo o que nosso sistema oferece para transformar sua gestão financeira
              </p>
            </AnimatedSection>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: <Users size={24} />, title: "Modo Família", desc: "Gerencie finanças de até 5 membros com metas compartilhadas e privacidade individual" },
                { icon: <BrainCircuit size={24} />, title: "Consultor IA", desc: "Pergunte 'Como posso economizar?' e receba planos personalizados" },
                { icon: <TrendingUp size={24} />, title: "Projeções Futuras", desc: "Saiba se vai fechar o mês no azul antes mesmo dele acabar" },
                { icon: <Shield size={24} />, title: "Privacidade Total", desc: "Seus dados são apenas seus. Sem venda de informações, sem anúncios" },
                { icon: <Bell size={24} />, title: "Lembretes Inteligentes", desc: "Nunca mais pague juros. Avisos antes das contas vencerem" },
                { icon: <MessageSquare size={24} />, title: "Input Natural", desc: "Esqueça formulários. Digite como se conversasse com um amigo" }
              ].map((f, i) => (
                <AnimatedSection key={i} delay={i * 100}>
                  <div className="bg-[#363735] p-6 rounded-2xl border border-gray-800 hover:border-[#f17853]/30 transition-all hover:-translate-y-1 group h-full">
                    <div className="w-12 h-12 rounded-xl bg-gray-800/50 flex items-center justify-center text-[#f17853] mb-4 group-hover:scale-110 transition-transform border border-gray-700">
                      {f.icon}
                    </div>
                    <h4 className="text-lg font-bold mb-2 text-white">{f.title}</h4>
                    <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </AnimatedSection>
              ))}
            </div>
          </div>

        </div>
      </section>



      {/* Testimonials Section */}
      <section id="testimonials" className="py-16 lg:py-24 relative overflow-hidden bg-[#262624]">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 relative z-10">

          <AnimatedSection className="flex flex-col items-center text-center max-w-2xl mx-auto mb-12 lg:mb-16">
            <div className="inline-block px-3 py-1 rounded-full bg-gray-800 border border-gray-700 text-xs font-bold text-gray-300 mb-4 uppercase tracking-wider">Depoimentos</div>
            <h2 className="text-2xl lg:text-4xl font-bold mb-4 lg:mb-6">O que nossos usuários dizem</h2>
            <p className="text-gray-400 text-base lg:text-lg">Veja como transformamos a vida financeira de milhares de pessoas.</p>
          </AnimatedSection>

          <div className="flex justify-center gap-6 mt-10 [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)] max-h-[740px] overflow-hidden">
            <TestimonialsColumn
              testimonials={[
                {
                  text: "Finalmente consegui organizar minha vida financeira! A IA categoriza tudo automaticamente e eu só digito 'Almoço 50 reais'. Nunca foi tão fácil.",
                  image: "https://randomuser.me/api/portraits/women/44.jpg",
                  name: "Ana Paula Silva",
                  role: "Empreendedora"
                },
                {
                  text: "O Open Finance mudou tudo. Antes eu perdia horas somando extratos de 3 bancos. Agora tudo sincroniza automaticamente.",
                  image: "https://randomuser.me/api/portraits/men/32.jpg",
                  name: "Ricardo Mendes",
                  role: "Analista Financeiro"
                },
                {
                  text: "A calculadora CLT me salvou! Consigo calcular meu salário líquido, hora extra e 13º em segundos. Indispensável pra quem é CLT.",
                  image: "https://randomuser.me/api/portraits/women/65.jpg",
                  name: "Juliana Costa",
                  role: "Professora"
                }
              ]}
              duration={15}
            />
            <TestimonialsColumn
              testimonials={[
                {
                  text: "O modo família é perfeito! Eu e meu marido conseguimos ver os gastos da casa juntos, mas cada um mantém sua privacidade. Genial!",
                  image: "https://randomuser.me/api/portraits/women/28.jpg",
                  name: "Mariana Oliveira",
                  role: "Designer"
                },
                {
                  text: "Nunca mais me perdi nos gastos do cartão de crédito. O app me avisa antes das faturas vencerem e mostra onde estou gastando mais.",
                  image: "https://randomuser.me/api/portraits/men/46.jpg",
                  name: "Pedro Santos",
                  role: "Desenvolvedor"
                },
                {
                  text: "A calculadora FIRE me mostrou que posso me aposentar em 15 anos! Agora tenho um objetivo claro e sei exatamente quanto preciso poupar.",
                  image: "https://randomuser.me/api/portraits/women/52.jpg",
                  name: "Fernanda Lima",
                  role: "Administradora"
                }
              ]}
              className="hidden md:block"
              duration={19}
            />
            <TestimonialsColumn
              testimonials={[
                {
                  text: "Parei de brigar com planilhas! Simplesmente converso com a IA e ela organiza tudo. É como ter um assistente financeiro pessoal.",
                  image: "https://randomuser.me/api/portraits/men/58.jpg",
                  name: "Carlos Eduardo",
                  role: "Engenheiro"
                },
                {
                  text: "Os insights da IA são impressionantes. Ela descobriu que eu gastava 40% da renda com delivery e me ajudou a reduzir isso.",
                  image: "https://randomuser.me/api/portraits/women/72.jpg",
                  name: "Beatriz Rocha",
                  role: "Médica"
                },
                {
                  text: "Segurança total! Meus dados bancários ficam criptografados e nunca tive problema. Confio 100% na plataforma.",
                  image: "https://randomuser.me/api/portraits/men/71.jpg",
                  name: "João Gabriel",
                  role: "Contador"
                }
              ]}
              className="hidden lg:block"
              duration={17}
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 lg:py-32 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 relative z-10">

          <AnimatedSection className="flex flex-col items-center text-center mb-12 lg:mb-16">
            <h2 className="text-2xl lg:text-5xl font-bold mb-3 lg:mb-4 relative z-10">Planos transparentes</h2>
            <p className="text-sm lg:text-base text-gray-400 relative z-10">Escolha o plano ideal para sua jornada financeira.</p>
          </AnimatedSection>
          <PricingSection onStart={onLogin} />
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 lg:py-24 bg-[#262624] border-t border-gray-900">
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          <AnimatedSection className="text-center mb-12 lg:mb-16">
            <h2 className="text-2xl lg:text-3xl font-bold mb-4">Perguntas Frequentes</h2>
          </AnimatedSection>
          <FAQSection />
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-16 lg:py-24 relative overflow-hidden bg-[#262624]">
        <motion.div
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#f17853]/10 to-transparent pointer-events-none"
        />
        <motion.div
          initial={{ x: "-50%" }}
          animate={{
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.1, 1],
            y: [0, -20, 0]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-24 left-1/2 w-[800px] h-[400px] bg-[#f17853]/15 rounded-full blur-[120px] pointer-events-none"
        />

        <AnimatedSection className="max-w-4xl mx-auto px-4 lg:px-6 text-center relative z-10">
          <h2 className="text-3xl lg:text-6xl font-bold mb-6 lg:mb-8 text-white tracking-tight">Pronto para assumir o controle?</h2>
          <p className="text-base lg:text-xl text-gray-400 mb-8 lg:mb-12 max-w-2xl mx-auto">
            {isWaitlistVariant
              ? 'Estamos finalizando a nova versao. Entre na lista de espera e seja avisado primeiro.'
              : 'Junte-se a milhares de pessoas que pararam de brigar com planilhas e comecaram a usar inteligencia.'}
          </p>
          <button onClick={handlePrimaryCta} className="px-8 lg:px-12 py-4 lg:py-6 bg-[#f17853] hover:bg-[#e06949] text-white rounded-full font-bold text-lg lg:text-xl transition-all shadow-2xl shadow-[#f17853]/40 hover:scale-105 flex items-center gap-3 mx-auto group">
            {primaryCtaLabel}
            <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </AnimatedSection>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12 lg:py-16 bg-[#262624]">
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          <div className="flex flex-col items-center text-center gap-6 mb-8 lg:mb-12">
            <div className="flex items-center gap-2">
              <Logo
                size={32}
                className="gap-2"
                textClassName="font-bold text-xl"
                imgClassName="rounded-lg"
              />
            </div>
            <p className="text-gray-500 max-w-md">
              A plataforma de gestão financeira pessoal mais inteligente do mercado. Simples, rápida e segura.
            </p>
            <div className="flex gap-4">
              <a
                href="https://www.instagram.com/controlarmaisoficial/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
              >
                <Instagram size={18} />
              </a>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-900 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-600">
            <div>© 2025 Controlar+ Pro. Todos os direitos reservados.</div>
          </div>
        </div>
      </footer>

      {isWaitlistVariant && (
        <WaitlistModal
          isOpen={isWaitlistOpen}
          onClose={closeWaitlist}
        />
      )}
    </div>
  );
};
