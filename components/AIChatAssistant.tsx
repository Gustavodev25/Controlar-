import React, { useState, useRef, useEffect, useMemo, type JSX } from 'react';
import { motion } from 'framer-motion';
import {
    Sparkles,
    X,
    Send,
    Plus,
    TrendingUp,
    Lightbulb,
    Check,
    Calendar,
    Tag,
    Clock,
    Trash2,
    MessageSquare
} from 'lucide-react';
import { processAssistantMessage } from '../services/geminiService';
import { Transaction, AIParsedTransaction, Budget, Investment } from '../types';
import coinzinhaImg from '../assets/coinzinha.png';

// --- Utilitário simples para classes ---
function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(' ');
}

// --- Componente BlurredStagger (Corrigido para não quebrar layout) ---
export const BlurredStagger = ({
    text,
    className,
}: {
    text: string;
    className?: string;
}) => {
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.005, // Um pouco mais rápido para ficar fluido
            },
        },
    };

    const letterAnimation = {
        hidden: {
            opacity: 0,
            filter: "blur(10px)",
        },
        show: {
            opacity: 1,
            filter: "blur(0)",
        },
    };

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className={cn("inline-block break-words max-w-full", className)} // Adicionado max-w-full e break-words
        >
            {text.split("").map((char, index) => (
                <motion.span
                    key={index}
                    variants={letterAnimation}
                    transition={{ duration: 0.2 }}
                >
                    {char === " " ? "\u00A0" : char}
                </motion.span>
            ))}
        </motion.div>
    );
};

// --- Componente TextShimmer ---
interface TextShimmerProps {
    children: string;
    as?: React.ElementType;
    className?: string;
    duration?: number;
    spread?: number;
}

function TextShimmer({
    children,
    as: Component = 'p',
    className,
    duration = 2,
    spread = 2,
}: TextShimmerProps) {
    const MotionComponent = motion(Component as keyof JSX.IntrinsicElements);

    const dynamicSpread = useMemo(() => {
        return children.length * spread;
    }, [children, spread]);

    return (
        <MotionComponent
            className={cn(
                'relative inline-block bg-[length:250%_100%,auto] bg-clip-text',
                'text-transparent [--base-color:#a1a1aa] [--base-gradient-color:#000]',
                '[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--base-gradient-color),#0000_calc(50%+var(--spread)))] [background-repeat:no-repeat,padding-box]',
                'dark:[--base-color:#71717a] dark:[--base-gradient-color:#ffffff] dark:[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--base-gradient-color),#0000_calc(50%+var(--spread)))]',
                className
            )}
            initial={{ backgroundPosition: '100% center' }}
            animate={{ backgroundPosition: '0% center' }}
            transition={{
                repeat: Infinity,
                duration,
                ease: 'linear',
            }}
            style={
                {
                    '--spread': `${dynamicSpread}px`,
                    backgroundImage: `var(--bg), linear-gradient(var(--base-color), var(--base-color))`,
                } as React.CSSProperties
            }
        >
            {children}
        </MotionComponent>
    );
}

// --- Componente Principal ---

interface AIChatAssistantProps {
    onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
    transactions: Transaction[];
    budgets: Budget[];
    investments: Investment[];
    userPlan?: 'starter' | 'pro' | 'family';
    userName?: string;
}

interface Message {
    id: string;
    role: 'user' | 'ai';
    content?: string;
    type: 'text' | 'transaction_confirm';
    transactionData?: AIParsedTransaction;
    isConfirmed?: boolean;
    timestamp: number;
}

interface ChatSession {
    id: string;
    date: string;
    preview: string;
    messages: Message[];
}

export const AIChatAssistant: React.FC<AIChatAssistantProps> = ({ onAddTransaction, transactions, budgets, investments, userPlan = 'starter', userName = 'Você' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [view, setView] = useState<'chat' | 'history'>('chat');
    const [history, setHistory] = useState<ChatSession[]>([]);

    const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    // Limit tracking for Starter plan
    const [starterMessageCount, setStarterMessageCount] = useState(0);

    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'ai',
            type: 'text',
            content: 'Olá! Sou seu assistente financeiro. Posso ajudar a lançar gastos ou analisar suas finanças. Como posso ajudar hoje?',
            timestamp: Date.now()
        }
    ]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (view === 'chat') scrollToBottom();
    }, [messages, isThinking, isOpen, view]);

    useEffect(() => {
        if (isOpen && view === 'chat' && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen, view]);

    const handleSendMessage = async () => {
        if (!inputValue.trim()) return;

        // Check Limit for Starter
        if (userPlan === 'starter' && starterMessageCount >= 3) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'ai',
                type: 'text',
                content: '🔒 Você atingiu o limite de mensagens do plano Starter. Faça o upgrade para o plano Plus para ter acesso ilimitado ao Consultor IA.',
                timestamp: Date.now()
            }]);
            setInputValue('');
            return;
        }

        const userText = inputValue;
        setInputValue('');

        // Increment counter for starter
        if (userPlan === 'starter') {
            setStarterMessageCount(prev => prev + 1);
        }

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            type: 'text',
            content: userText,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, userMsg]);
        setIsThinking(true);

        try {
            const response = await processAssistantMessage(userText, transactions, budgets, investments);
            setIsThinking(false);

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'ai',
                type: response.type === 'transaction' ? 'transaction_confirm' : 'text',
                content: response.type === 'text' ? response.content : undefined,
                transactionData: response.type === 'transaction' ? response.data : undefined,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, aiMsg]);

        } catch (error) {
            setIsThinking(false);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'ai',
                type: 'text',
                content: 'Desculpe, tive um problema ao processar. Tente novamente.',
                timestamp: Date.now()
            }]);
        }
    };

    const handleConfirmTransaction = (msgId: string, data: AIParsedTransaction) => {
        onAddTransaction({
            description: data.description,
            amount: data.amount,
            category: data.category,
            date: data.date,
            type: data.type,
            status: 'completed'
        });

        setMessages(prev => prev.map(m =>
            m.id === msgId ? { ...m, isConfirmed: true } : m
        ));

        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'ai',
            type: 'text',
            content: `✅ Transação "${data.description}" adicionada com sucesso!`,
            timestamp: Date.now()
        }]);
    };

    const handleNewChat = () => {
        if (messages.some(m => m.role === 'user')) {
            const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
            const session: ChatSession = {
                id: Date.now().toString(),
                date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
                preview: lastUserMsg?.content?.substring(0, 30) + '...' || 'Nova Conversa',
                messages: [...messages]
            };
            setHistory(prev => [session, ...prev]);
        }

        setMessages([{
            id: Date.now().toString(),
            role: 'ai',
            type: 'text',
            content: 'Olá! Nova conversa iniciada. Como posso ajudar agora?',
            timestamp: Date.now()
        }]);
        setView('chat');
    };

    const handleLoadSession = (session: ChatSession) => {
        setMessages(session.messages);
        setView('chat');
    };

    const handleQuickAction = (text: string) => {
        setInputValue(text);
        if (text === "Adicionar Despesa") {
            inputRef.current?.focus();
        } else {
            const userMsg: Message = {
                id: Date.now().toString(),
                role: 'user',
                type: 'text',
                content: text,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, userMsg]);
            setIsThinking(true);
            processAssistantMessage(text, transactions).then(response => {
                setIsThinking(false);
                if (response.type === 'text') {
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        role: 'ai',
                        type: 'text',
                        content: response.content,
                        timestamp: Date.now()
                    }]);
                }
            });
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">

            {/* Chat Window */}
            <div
                className={`
          absolute bottom-0 right-0
          bg-gray-900 border border-gray-800 shadow-2xl overflow-hidden rounded-2xl
          transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-bottom-right
          ${isOpen
                        ? 'w-[90vw] sm:w-[380px] h-[600px] opacity-100 scale-100 translate-y-0 pointer-events-auto'
                        : 'w-[380px] h-[600px] opacity-0 scale-90 translate-y-10 pointer-events-none'
                    }
        `}
            >
                {/* Header */}
                <div className="h-14 bg-gray-950/80 backdrop-blur-md border-b border-gray-800 flex items-center justify-between px-4 select-none">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#363735] border border-[#3A3B39] shadow-lg overflow-hidden flex items-center justify-center">
                            <img src={coinzinhaImg} alt="IA" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-sm leading-tight">Coinzinha</h3>
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                <span className="text-[10px] text-gray-400 font-medium">Online</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setView(view === 'history' ? 'chat' : 'history')}
                            className={`p-2 rounded-lg transition-colors ${view === 'history' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                            title="Histórico"
                        >
                            <Clock size={18} />
                        </button>
                        <button
                            onClick={handleNewChat}
                            className="p-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
                            title="Nova Conversa"
                        >
                            <Plus size={18} />
                        </button>
                        <div className="w-px h-4 bg-gray-800 mx-1"></div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                            title="Fechar"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="relative h-[calc(100%-56px)] bg-gray-900/50">

                    {/* Chat View */}
                    <div className={`absolute inset-0 flex flex-col transition-opacity duration-300 ${view === 'chat' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar overflow-x-hidden">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up w-full`}
                                >
                                    <div className={`flex items-start gap-3 max-w-full ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                        <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center border bg-[#363735] border-[#3A3B39] text-white shadow-sm overflow-hidden text-xs font-bold">
                                            {msg.role === 'user' ? (
                                                <span>{getInitials(userName)}</span>
                                            ) : (
                                                <img src={coinzinhaImg} alt="IA" className="w-full h-full object-cover" />
                                            )}
                                        </div>

                                        {msg.type === 'text' ? (
                                            <div
                                                className={`
                        max-w-[260px] sm:max-w-[280px] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm overflow-hidden
                        ${msg.role === 'user'
                                                        ? 'bg-[#d97757] text-white rounded-tr-sm'
                                                        : 'bg-gray-800 text-gray-200 rounded-tl-sm border border-gray-700'
                                                    }
                      `}
                                            >
                                                {msg.role === 'ai' ? (
                                                    <BlurredStagger text={msg.content || ''} className="whitespace-pre-wrap break-words" />
                                                ) : (
                                                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                                                )}
                                                <p className={`text-[10px] mt-1 text-right opacity-60 ${msg.role === 'user' ? 'text-white' : 'text-gray-400'}`}>
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        ) : (
                                            /* Transaction Widget */
                                            <div className="w-full max-w-[260px] bg-gray-800 border border-gray-700 rounded-2xl rounded-tl-sm overflow-hidden shadow-lg">
                                                <div className="bg-gradient-to-r from-gray-800 to-gray-800/50 p-3 border-b border-gray-700 flex items-center gap-2">
                                                    <Sparkles size={14} className="text-[#d97757]" />
                                                    <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Confirmação</span>
                                                </div>
                                                <div className="p-4 space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-gray-400 text-xs">Valor</span>
                                                        <span className="text-2xl font-bold text-white tracking-tight">
                                                            R$ {msg.transactionData?.amount.toFixed(2)}
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="bg-gray-900/50 p-2 rounded-lg border border-gray-700/50">
                                                            <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                                                                <Tag size={10} />
                                                                <span className="text-[10px] uppercase">Categoria</span>
                                                            </div>
                                                            <span className="text-sm text-gray-200 font-medium truncate block">{msg.transactionData?.category}</span>
                                                        </div>
                                                        <div className="bg-gray-900/50 p-2 rounded-lg border border-gray-700/50">
                                                            <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                                                                <Calendar size={10} />
                                                                <span className="text-[10px] uppercase">Data</span>
                                                            </div>
                                                            <span className="text-sm text-gray-200 font-medium truncate block">{msg.transactionData?.date}</span>
                                                        </div>
                                                    </div>

                                                    <div className="bg-gray-900/50 p-2 rounded-lg border border-gray-700/50">
                                                        <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                                                            <div className="w-2.5 h-2.5 rounded-full border border-gray-500 flex items-center justify-center text-[6px]">T</div>
                                                            <span className="text-[10px] uppercase">Descrição</span>
                                                        </div>
                                                        <span className="text-sm text-gray-200 font-medium block">{msg.transactionData?.description}</span>
                                                    </div>

                                                    {!msg.isConfirmed ? (
                                                        <button
                                                            onClick={() => msg.transactionData && handleConfirmTransaction(msg.id, msg.transactionData)}
                                                            className="w-full bg-[#d97757] hover:bg-[#c56a4d] text-white py-2.5 rounded-xl text-sm font-bold transition-all hover:shadow-lg hover:shadow-[#d97757]/20 flex items-center justify-center gap-2 active:scale-95"
                                                        >
                                                            <Check size={16} />
                                                            Confirmar Lançamento
                                                        </button>
                                                    ) : (
                                                        <div className="w-full bg-green-500/10 text-green-500 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border border-green-500/20">
                                                            <Check size={16} />
                                                            Lançado com Sucesso
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {isThinking && (
                                <div className="flex justify-start">
                                    <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-tl-sm p-4 flex items-center">
                                        <TextShimmer className='font-medium text-sm' duration={1.5}>
                                            Processando...
                                        </TextShimmer>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-3 bg-gray-950 border-t border-gray-800">
                            {/* Quick Actions */}
                            {messages.length < 3 && (
                                <div className="flex gap-2 mb-3 overflow-x-auto pb-1 no-scrollbar">
                                    <button
                                        onClick={() => handleQuickAction("Adicionar Despesa")}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d97757]/10 hover:bg-[#d97757]/20 rounded-full border border-[#d97757] text-xs text-[#d97757] whitespace-nowrap transition-colors"
                                    >
                                        <Plus size={12} className="text-[#d97757]" />
                                        Add Despesa
                                    </button>
                                    <button
                                        onClick={() => handleQuickAction("Analisar Gastos")}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d97757]/10 hover:bg-[#d97757]/20 rounded-full border border-[#d97757] text-xs text-[#d97757] whitespace-nowrap transition-colors"
                                    >
                                        <TrendingUp size={12} className="text-[#d97757]" />
                                        Analisar Gastos
                                    </button>
                                    <button
                                        onClick={() => handleQuickAction("Dica do dia")}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d97757]/10 hover:bg-[#d97757]/20 rounded-full border border-[#d97757] text-xs text-[#d97757] whitespace-nowrap transition-colors"
                                    >
                                        <Lightbulb size={12} className="text-[#d97757]" />
                                        Dica do dia
                                    </button>
                                </div>
                            )}

                            <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 focus-within:border-[#d97757] focus-within:ring-1 focus-within:ring-[#d97757]/50 transition-all">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    placeholder="Digite sua mensagem..."
                                    className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!inputValue.trim() || isThinking}
                                    className="p-2 bg-[#d97757] hover:bg-[#c56a4d] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-all shadow-lg shadow-[#d97757]/20"
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* History View */}
                    <div className={`absolute inset-0 bg-gray-900 flex flex-col transition-opacity duration-300 ${view === 'history' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                        <div className="p-4">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Histórico de Sessões</h4>

                            {history.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-3">
                                    <MessageSquare size={32} className="opacity-20" />
                                    <p className="text-sm">Nenhuma conversa anterior.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {history.map(session => (
                                        <button
                                            key={session.id}
                                            onClick={() => handleLoadSession(session)}
                                            className="w-full text-left p-3 rounded-xl bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-gray-700 transition-all group"
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-xs text-[#d97757] font-medium">{session.date}</span>
                                            </div>
                                            <p className="text-sm text-gray-300 line-clamp-2 group-hover:text-white transition-colors">
                                                {session.preview}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mt-auto p-4 border-t border-gray-800">
                            <button
                                onClick={() => setHistory([])}
                                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors text-sm"
                            >
                                <Trash2 size={16} />
                                Limpar Histórico
                            </button>
                        </div>
                    </div>

                </div>
            </div>

            {/* Floating Button (FAB) - Logo Only */}
            <button
                onClick={() => setIsOpen(true)}
                className={`
                  bg-[#363735] border border-[#3A3B39]
                  shadow-2xl
                  w-14 h-14 rounded-2xl flex items-center justify-center
                  transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                  hover:border-gray-500 hover:-translate-y-1
                  ${isOpen ? 'translate-y-20 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}
                `}
            >
                <div className="w-8 h-8 rounded-full overflow-hidden">
                    <img src={coinzinhaImg} alt="IA" className="w-full h-full object-cover" />
                </div>
            </button>
        </div>
    );
};
