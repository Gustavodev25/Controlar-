import React, { useState, useRef, useEffect, useMemo, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
    MessageSquare,
    ChevronRight,
    Maximize2,
    Minimize2,
    PanelLeftClose,
    PanelLeft
} from 'lucide-react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { processClaudeAssistantMessage, AIParsedReminder, AIParsedSubscription } from '../services/claudeService';
import { saveChatHistory, listenToChatHistory, clearChatHistory, ChatSession as DBChatSession } from '../services/database';
import { Transaction, AIParsedTransaction, Budget, Investment, Reminder, Subscription } from '../types';
import coinzinhaImg from '../assets/coinzinha.png';

// --- Utilitário simples para classes ---
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// --- Formatador de Texto da IA (remove emojis e renderiza markdown) ---
const FormattedAIText = ({ text }: { text: string }) => {
    // Remove emojis
    const removeEmojis = (str: string) => {
        return str.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F910}-\u{1F96B}]|[\u{1F980}-\u{1F9E0}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{267F}]|[\u{2693}]|[\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26CE}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{270D}]|[\u{270F}]|[\u{2712}]|[\u{2714}]|[\u{2716}]|[\u{271D}]|[\u{2721}]|[\u{2728}]|[\u{2733}-\u{2734}]|[\u{2744}]|[\u{2747}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2763}-\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{27B0}]|[\u{27BF}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{2B50}]|[\u{2B55}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]|[\u{1F004}]|[\u{1F0CF}]/gu, '').trim();
    };

    const cleanText = removeEmojis(text);
    const lines = cleanText.split('\n');

    return (
        <div className="space-y-2">
            {lines.map((line, lineIndex) => {
                const trimmedLine = line.trim();

                // Linha vazia
                if (!trimmedLine) return <div key={lineIndex} className="h-2" />;

                // Processar negrito **texto**
                const formatBold = (str: string) => {
                    const parts = str.split(/(\*\*[^*]+\*\*)/g);
                    return parts.map((part, i) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
                        }
                        return <span key={i}>{part}</span>;
                    });
                };

                // Lista com hífen
                if (trimmedLine.startsWith('- ')) {
                    return (
                        <div key={lineIndex} className="flex gap-2 pl-2">
                            <span className="text-gray-500">•</span>
                            <span>{formatBold(trimmedLine.slice(2))}</span>
                        </div>
                    );
                }

                // Lista numerada
                const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
                if (numberedMatch) {
                    return (
                        <div key={lineIndex} className="flex gap-2">
                            <span className="text-[#d97757] font-medium min-w-[20px]">{numberedMatch[1]}.</span>
                            <span>{formatBold(numberedMatch[2])}</span>
                        </div>
                    );
                }

                // Texto normal
                return <p key={lineIndex}>{formatBold(trimmedLine)}</p>;
            })}
        </div>
    );
};

// --- Button Component (Inline for simplicity) ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'ghost' | 'default';
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'default', ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                    variant === 'ghost' ? "hover:bg-accent hover:text-accent-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90",
                    className
                )}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

// --- Formatador de Markdown para React ---
const FormattedText = ({ text, className }: { text: string; className?: string }) => {
    // Quebra o texto em linhas para preservar formatação
    const lines = text.split('\n');

    const formatLine = (line: string, lineIndex: number): React.ReactNode => {
        // Processar a linha para encontrar formatações inline
        const currentText = line;
        let keyIndex = 0;

        // Regex para encontrar **texto** (negrito)
        const boldRegex = /\*\*([^*]+)\*\*/g;

        // Primeiro, substituir negrito
        let lastIndex = 0;
        let match;

        // Reset regex
        boldRegex.lastIndex = 0;

        const processedParts: React.ReactNode[] = [];
        const matches: { start: number; end: number; content: string; type: 'bold' }[] = [];

        // Encontrar todos os negritos
        while ((match = boldRegex.exec(currentText)) !== null) {
            matches.push({
                start: match.index,
                end: match.index + match[0].length,
                content: match[1],
                type: 'bold'
            });
        }

        // Ordenar por posição
        matches.sort((a, b) => a.start - b.start);

        // Construir os parts
        lastIndex = 0;
        matches.forEach((m, idx) => {
            // Texto antes do match
            if (m.start > lastIndex) {
                const beforeText = currentText.slice(lastIndex, m.start);
                processedParts.push(<span key={`${lineIndex}-${keyIndex++}`}>{beforeText}</span>);
            }

            // O match formatado
            if (m.type === 'bold') {
                processedParts.push(
                    <strong key={`${lineIndex}-${keyIndex++}`} className="font-bold text-white">
                        {m.content}
                    </strong>
                );
            }

            lastIndex = m.end;
        });

        // Texto restante após o último match
        if (lastIndex < currentText.length) {
            processedParts.push(<span key={`${lineIndex}-${keyIndex++}`}>{currentText.slice(lastIndex)}</span>);
        }

        // Se não teve matches, retorna o texto como está
        if (processedParts.length === 0) {
            return <span key={lineIndex}>{line}</span>;
        }

        return <span key={lineIndex}>{processedParts}</span>;
    };

    return (
        <div className={cn("whitespace-pre-wrap break-words", className)}>
            {lines.map((line, idx) => (
                <React.Fragment key={idx}>
                    {formatLine(line, idx)}
                    {idx < lines.length - 1 && <br />}
                </React.Fragment>
            ))}
        </div>
    );
};

// --- Componente BlurredStagger com suporte a Markdown ---
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
                staggerChildren: 0.005,
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

    // Parse markdown inline: **bold** => <strong>
    const parseMarkdown = (input: string): { char: string; isBold: boolean; isNewLine: boolean }[] => {
        const result: { char: string; isBold: boolean; isNewLine: boolean }[] = [];
        let i = 0;
        let inBold = false;

        while (i < input.length) {
            // Check for ** (bold toggle)
            if (input[i] === '*' && input[i + 1] === '*') {
                inBold = !inBold;
                i += 2;
                continue;
            }

            // Check for newline
            if (input[i] === '\n') {
                result.push({ char: '\n', isBold: false, isNewLine: true });
                i++;
                continue;
            }

            result.push({ char: input[i], isBold: inBold, isNewLine: false });
            i++;
        }

        return result;
    };

    const parsedChars = parseMarkdown(text);

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className={cn("inline-block break-words max-w-full", className)}
        >
            {parsedChars.map((item, index) => {
                if (item.isNewLine) {
                    return <br key={index} />;
                }

                return (
                    <motion.span
                        key={index}
                        variants={letterAnimation}
                        transition={{ duration: 0.2 }}
                        className={item.isBold ? "font-bold text-white" : ""}
                    >
                        {item.char === " " ? "\u00A0" : item.char}
                    </motion.span>
                );
            })}
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
    onAddReminder?: (r: Omit<Reminder, 'id'>) => void;
    onAddSubscription?: (s: Omit<Subscription, 'id'>) => void;
    transactions: Transaction[];
    budgets: Budget[];
    investments: Investment[];
    userPlan?: 'starter' | 'pro' | 'family';
    userName?: string;
    userId?: string;
    isProMode?: boolean;
    onUpgrade?: () => void;
    activeTab?: string;
    setActiveTab?: (tab: any) => void;
}

interface Message {
    id: string;
    role: 'user' | 'ai';
    content?: string;
    type: 'text' | 'transaction_confirm' | 'multiple_transactions' | 'reminder_confirm' | 'subscription_confirm' | 'mixed_items';
    transactionData?: AIParsedTransaction;
    multipleTransactions?: AIParsedTransaction[];
    unifiedSuggestion?: AIParsedTransaction;
    reminderData?: AIParsedReminder;
    subscriptionData?: AIParsedSubscription;
    // Mixed items support
    mixedTransactions?: AIParsedTransaction[];
    mixedReminders?: AIParsedReminder[];
    mixedSubscriptions?: AIParsedSubscription[];
    isConfirmed?: boolean;
    confirmedChoice?: 'unified' | 'separate' | 'all';
    timestamp: number;
}

interface ChatSession {
    id: string;
    date: string;
    preview: string;
    messages: Message[];
}

export const AIChatAssistant: React.FC<AIChatAssistantProps> = ({
    onAddTransaction,
    onAddReminder,
    onAddSubscription,
    transactions,
    budgets,
    investments,
    userPlan = 'starter',
    userName = 'Você',
    userId,
    isProMode = false,
    onUpgrade,
    activeTab,
    setActiveTab
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [view, setView] = useState<'chat' | 'history'>('chat');
    const [history, setHistory] = useState<ChatSession[]>([]);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const historyLoadedRef = useRef(false);

    // --- Frases aleatórias do Coinzinha ---
    const coinzinhaPhrases = [
        "Dica: Registre seus gastos diários!",
        "Já definiu suas metas do mês?",
        "Poupar hoje é investir no amanhã!",
        "Que tal analisar seus gastos?",
        "Cada real economizado conta!",
        "Não esqueça dos seus lembretes!",
        "Cuidado com as compras por impulso!",
        "Seus investimentos agradecem!",
        "Pequenos gastos somam no final!",
        "Continue assim, você está indo bem!",
        "Disciplina financeira é o segredo!",
        "Já organizou suas contas hoje?",
        "Posso te ajudar com algo?",
        "Me pergunte qualquer coisa!",
        "Vamos organizar suas finanças!"
    ];

    const [currentPhrase, setCurrentPhrase] = useState<string | null>(null);
    const [showBubble, setShowBubble] = useState(false);
    const [showDots, setShowDots] = useState(false);

    // Efeito para mostrar frases aleatórias periodicamente
    useEffect(() => {
        if (isOpen) return; // Não mostrar quando o chat está aberto

        const showRandomPhrase = () => {
            if (isOpen) return; // Não mostrar se o chat estiver aberto
            const randomPhrase = coinzinhaPhrases[Math.floor(Math.random() * coinzinhaPhrases.length)];
            setCurrentPhrase(randomPhrase);
            setShowBubble(true);
            setShowDots(true);

            // Transição de dots para texto após 800ms
            setTimeout(() => {
                setShowDots(false);
            }, 800);

            // Esconder o balão após 10 segundos
            setTimeout(() => {
                setShowBubble(false);
                setShowDots(false);
            }, 10000);
        };

        // Mostrar primeira frase após 10 segundos
        const initialTimeout = setTimeout(() => {
            showRandomPhrase();
        }, 10000);

        // Depois, mostrar a cada 30-60 segundos (aleatório)
        const interval = setInterval(() => {
            showRandomPhrase();
        }, 45000);

        return () => {
            clearTimeout(initialTimeout);
            clearInterval(interval);
            setShowBubble(false);
            setShowDots(false);
        };
    }, [isOpen]);

    const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    // Limit tracking for Starter plan
    const [starterMessageCount, setStarterMessageCount] = useState(() => {
        const saved = localStorage.getItem('coinzinha_starter_count');
        return saved ? parseInt(saved, 10) : 0;
    });

    useEffect(() => {
        localStorage.setItem('coinzinha_starter_count', starterMessageCount.toString());
    }, [starterMessageCount]);

    useEffect(() => {
        if (isOpen) {
            const saved = localStorage.getItem('coinzinha_starter_count');
            if (saved) setStarterMessageCount(parseInt(saved, 10));
        }
    }, [isOpen]);

    const isLimitReached = userPlan === 'starter' && starterMessageCount >= 5;

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
    const wrapperRef = useRef<HTMLDivElement>(null);
    const quickActionsRef = useRef<HTMLDivElement>(null);

    // Estado para drag-to-scroll no desktop
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    // Handlers para drag-to-scroll
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!quickActionsRef.current) return;
        setIsDragging(true);
        setStartX(e.pageX - quickActionsRef.current.offsetLeft);
        setScrollLeft(quickActionsRef.current.scrollLeft);
        quickActionsRef.current.style.cursor = 'grabbing';
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        if (quickActionsRef.current) {
            quickActionsRef.current.style.cursor = 'grab';
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !quickActionsRef.current) return;
        e.preventDefault();
        const x = e.pageX - quickActionsRef.current.offsetLeft;
        const walk = (x - startX) * 2; // Multiplicador para velocidade do scroll
        quickActionsRef.current.scrollLeft = scrollLeft - walk;
    };

    const handleMouseLeave = () => {
        setIsDragging(false);
        if (quickActionsRef.current) {
            quickActionsRef.current.style.cursor = 'grab';
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (view === 'chat') scrollToBottom();
    }, [messages, isThinking, isOpen, view]);

    useEffect(() => {
        function clickOutsideHandler(e: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node) && isOpen && !isFullScreen) {
                // Manter comportamento se desejado, ou remover
            }
        }
        document.addEventListener("mousedown", clickOutsideHandler)
        return () => document.removeEventListener("mousedown", clickOutsideHandler)
    }, [isOpen, isFullScreen]);

    // --- Carregar histórico do Firebase ---
    useEffect(() => {
        if (!userId) return;

        const unsubscribe = listenToChatHistory(userId, (sessions) => {
            if (!historyLoadedRef.current) {
                historyLoadedRef.current = true;
            }
            setHistory(sessions as ChatSession[]);
        });

        return () => unsubscribe();
    }, [userId]);

    // --- Salvar histórico no Firebase quando mudar ---
    useEffect(() => {
        if (!userId || !historyLoadedRef.current) return;

        // Debounce para não salvar a cada alteração mínima
        const timeoutId = setTimeout(() => {
            saveChatHistory(userId, history as DBChatSession[]);
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [history, userId]);

    const handleSendMessage = async () => {
        if (!inputValue.trim()) return;

        if (userPlan === 'starter') {
            const currentCount = parseInt(localStorage.getItem('coinzinha_starter_count') || '0', 10);
            if (currentCount >= 5) {
                setStarterMessageCount(currentCount);
                return;
            }
            setStarterMessageCount(currentCount + 1);
        }

        const userText = inputValue;
        setInputValue('');

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            type: 'text',
            content: userText,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, userMsg]);
        setIsThinking(true);

        // Construir histórico de conversa para o Claude
        const conversationHistory = messages
            .filter(m => m.type === 'text' && m.content)
            .map(m => ({
                role: m.role === 'user' ? 'user' as const : 'assistant' as const,
                content: m.content || ''
            }));

        try {
            const response = await processClaudeAssistantMessage(
                userText,
                transactions,
                budgets,
                investments,
                conversationHistory
            );
            setIsThinking(false);

            let aiMsg: Message;

            if (response.type === 'multiple_transactions') {
                aiMsg = {
                    id: (Date.now() + 1).toString(),
                    role: 'ai',
                    type: 'multiple_transactions',
                    multipleTransactions: response.data,
                    unifiedSuggestion: response.unifiedSuggestion,
                    timestamp: Date.now()
                };
            } else if (response.type === 'transaction') {
                aiMsg = {
                    id: (Date.now() + 1).toString(),
                    role: 'ai',
                    type: 'transaction_confirm',
                    transactionData: response.data,
                    timestamp: Date.now()
                };
            } else if (response.type === 'reminder') {
                aiMsg = {
                    id: (Date.now() + 1).toString(),
                    role: 'ai',
                    type: 'reminder_confirm',
                    reminderData: response.data,
                    timestamp: Date.now()
                };
            } else if (response.type === 'subscription') {
                aiMsg = {
                    id: (Date.now() + 1).toString(),
                    role: 'ai',
                    type: 'subscription_confirm',
                    subscriptionData: response.data,
                    timestamp: Date.now()
                };
            } else if (response.type === 'mixed_items') {
                aiMsg = {
                    id: (Date.now() + 1).toString(),
                    role: 'ai',
                    type: 'mixed_items',
                    mixedTransactions: response.transactions,
                    mixedReminders: response.reminders,
                    mixedSubscriptions: response.subscriptions,
                    timestamp: Date.now()
                };
            } else if (response.type === 'text') {
                aiMsg = {
                    id: (Date.now() + 1).toString(),
                    role: 'ai',
                    type: 'text',
                    content: response.content,
                    timestamp: Date.now()
                };
            } else {
                // Fallback para qualquer outro tipo
                aiMsg = {
                    id: (Date.now() + 1).toString(),
                    role: 'ai',
                    type: 'text',
                    content: 'Mensagem processada.',
                    timestamp: Date.now()
                };
            }
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

    // Quick action handler - triggers a message with the action text
    const handleQuickAction = (text: string) => {
        setInputValue(text);
        // Slight delay to show the input before sending
        setTimeout(() => {
            const fakeEvent = { key: 'Enter' };
            setInputValue('');
            // Create user message
            const userMsg: Message = {
                id: Date.now().toString(),
                role: 'user',
                type: 'text',
                content: text,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, userMsg]);
            // Trigger AI response
            handleSendMessageWithText(text);
        }, 100);
    };

    // Helper to send message with specific text
    const handleSendMessageWithText = async (text: string) => {
        if (!text.trim()) return;

        if (userPlan === 'starter') {
            const currentCount = parseInt(localStorage.getItem('coinzinha_starter_count') || '0', 10);
            if (currentCount >= 5) {
                setStarterMessageCount(currentCount);
                return;
            }
            setStarterMessageCount(currentCount + 1);
        }

        setIsThinking(true);

        const conversationHistory = messages
            .filter(m => m.type === 'text' && m.content)
            .map(m => ({
                role: m.role === 'user' ? 'user' as const : 'assistant' as const,
                content: m.content || ''
            }));

        try {
            const response = await processClaudeAssistantMessage(
                text,
                transactions,
                budgets,
                investments,
                conversationHistory
            );
            setIsThinking(false);

            let aiMsg: Message;

            if (response.type === 'text') {
                aiMsg = {
                    id: (Date.now() + 1).toString(),
                    role: 'ai',
                    type: 'text',
                    content: response.content,
                    timestamp: Date.now()
                };
            } else {
                aiMsg = {
                    id: (Date.now() + 1).toString(),
                    role: 'ai',
                    type: 'text',
                    content: 'Mensagem processada.',
                    timestamp: Date.now()
                };
            }
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
        // Bloquear criação de transação no modo Pro (Auto)
        if (isProMode) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'ai',
                type: 'text',
                content: `⚠️ Você está no modo **Auto** - transações são importadas automaticamente das suas contas conectadas.\n\nPara adicionar transações manualmente, troque para o modo **Manual** nas configurações.`,
                timestamp: Date.now()
            }]);
            return;
        }

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

    // Handler para confirmar múltiplas transações separadas
    const handleConfirmSeparate = (msgId: string, transactions: AIParsedTransaction[]) => {
        // Bloquear no modo Pro
        if (isProMode) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'ai',
                type: 'text',
                content: `⚠️ Você está no modo **Auto** - transações são importadas automaticamente.\n\nPara adicionar manualmente, troque para o modo **Manual**.`,
                timestamp: Date.now()
            }]);
            return;
        }

        transactions.forEach(data => {
            onAddTransaction({
                description: data.description,
                amount: data.amount,
                category: data.category,
                date: data.date,
                type: data.type,
                status: 'completed'
            });
        });

        setMessages(prev => prev.map(m =>
            m.id === msgId ? { ...m, isConfirmed: true, confirmedChoice: 'separate' } : m
        ));

        const descriptions = transactions.map(t => t.description).join(', ');
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'ai',
            type: 'text',
            content: `✅ ${transactions.length} transações adicionadas: ${descriptions}`,
            timestamp: Date.now()
        }]);
    };

    // Handler para confirmar transação unificada
    const handleConfirmUnified = (msgId: string, unifiedData: AIParsedTransaction) => {
        // Bloquear no modo Pro
        if (isProMode) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'ai',
                type: 'text',
                content: `⚠️ Você está no modo **Auto** - transações são importadas automaticamente.\n\nPara adicionar manualmente, troque para o modo **Manual**.`,
                timestamp: Date.now()
            }]);
            return;
        }

        onAddTransaction({
            description: unifiedData.description,
            amount: unifiedData.amount,
            category: unifiedData.category,
            date: unifiedData.date,
            type: unifiedData.type,
            status: 'completed'
        });

        setMessages(prev => prev.map(m =>
            m.id === msgId ? { ...m, isConfirmed: true, confirmedChoice: 'unified' } : m
        ));

        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'ai',
            type: 'text',
            content: `✅ Transação unificada "${unifiedData.description}" (R$ ${unifiedData.amount.toFixed(2)}) adicionada!`,
            timestamp: Date.now()
        }]);
    };

    // Handler para confirmar lembrete
    const handleConfirmReminder = (msgId: string, data: AIParsedReminder) => {
        if (onAddReminder) {
            onAddReminder({
                description: data.description,
                amount: data.amount,
                category: data.category,
                dueDate: data.dueDate,
                type: data.type,
                isRecurring: data.isRecurring,
                frequency: data.frequency
            });

            setMessages(prev => prev.map(m =>
                m.id === msgId ? { ...m, isConfirmed: true } : m
            ));

            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'ai',
                type: 'text',
                content: `📅 Lembrete "${data.description}" adicionado para ${data.dueDate}!`,
                timestamp: Date.now()
            }]);
        } else {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'ai',
                type: 'text',
                content: `⚠️ Não foi possível adicionar o lembrete. Vá em "Lembretes" no menu principal.`,
                timestamp: Date.now()
            }]);
        }
    };

    // Handler para confirmar assinatura
    const handleConfirmSubscription = (msgId: string, data: AIParsedSubscription) => {
        if (onAddSubscription) {
            onAddSubscription({
                userId: userId || '',
                name: data.name,
                amount: data.amount,
                category: data.category,
                billingCycle: data.billingCycle,
                status: 'active'
            });

            setMessages(prev => prev.map(m =>
                m.id === msgId ? { ...m, isConfirmed: true } : m
            ));

            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'ai',
                type: 'text',
                content: `✨ Assinatura "${data.name}" (R$ ${data.amount.toFixed(2)}/${data.billingCycle === 'monthly' ? 'mês' : 'ano'}) adicionada!`,
                timestamp: Date.now()
            }]);
        } else {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'ai',
                type: 'text',
                content: `⚠️ Não foi possível adicionar a assinatura. Vá em "Assinaturas" no menu principal.`,
                timestamp: Date.now()
            }]);
        }
    };

    // Handler para confirmar todos os itens mistos de uma vez
    const handleConfirmMixedItems = (
        msgId: string,
        transactions?: AIParsedTransaction[],
        reminders?: AIParsedReminder[],
        subscriptions?: AIParsedSubscription[]
    ) => {
        // Bloquear transações no modo Pro
        if (isProMode && transactions && transactions.length > 0) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'ai',
                type: 'text',
                content: `⚠️ Você está no modo **Auto** - transações são importadas automaticamente.\n\nPara adicionar manualmente, troque para o modo **Manual**.`,
                timestamp: Date.now()
            }]);
            return;
        }

        let addedCount = 0;
        const addedItems: string[] = [];

        // Adicionar transações
        if (transactions && transactions.length > 0) {
            transactions.forEach(tx => {
                onAddTransaction({
                    description: tx.description,
                    amount: tx.amount,
                    category: tx.category,
                    date: tx.date,
                    type: tx.type,
                    status: 'completed'
                });
                addedCount++;
            });
            addedItems.push(`${transactions.length} despesa(s)`);
        }

        // Adicionar lembretes
        if (reminders && reminders.length > 0 && onAddReminder) {
            reminders.forEach(rem => {
                onAddReminder({
                    description: rem.description,
                    amount: rem.amount,
                    category: rem.category,
                    dueDate: rem.dueDate,
                    type: rem.type,
                    isRecurring: rem.isRecurring,
                    frequency: rem.frequency
                });
                addedCount++;
            });
            addedItems.push(`${reminders.length} lembrete(s)`);
        }

        // Adicionar assinaturas
        if (subscriptions && subscriptions.length > 0 && onAddSubscription) {
            subscriptions.forEach(sub => {
                onAddSubscription({
                    userId: userId || '',
                    name: sub.name,
                    amount: sub.amount,
                    category: sub.category,
                    billingCycle: sub.billingCycle,
                    status: 'active'
                });
                addedCount++;
            });
            addedItems.push(`${subscriptions.length} assinatura(s)`);
        }

        setMessages(prev => prev.map(m =>
            m.id === msgId ? { ...m, isConfirmed: true, confirmedChoice: 'all' } : m
        ));

        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'ai',
            type: 'text',
            content: `✅ **${addedCount} itens salvos com sucesso!**\n\n${addedItems.join(', ')}`,
            timestamp: Date.now()
        }]);
    };

    const handleNewChat = () => {
        if (messages.some(m => m.role === 'user')) {
            const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
            const session: ChatSession = {
                id: Date.now().toString(),
                date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
                preview: lastUserMsg?.content?.substring(0, 40).trim() || 'Nova Conversa',
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

    const handleClearHistory = async () => {
        if (userId) {
            await clearChatHistory(userId);
        }
        setHistory([]);
    };

    // --- Animation Config ---
    const SPEED_FACTOR = 1;
    const OPEN_WIDTH = 380;
    const OPEN_HEIGHT = 600;

    // Exact spring config from request
    const SPRING_CONFIG = {
        type: "spring" as const,
        stiffness: 550 / SPEED_FACTOR,
        damping: 45,
        mass: 0.7,
    };

    // --- PAGE MODE (ZEN MODE) ---
    // When activeTab === 'chat', render full-screen in a portal
    const isPageMode = activeTab === 'chat';
    const chatMountPoint = typeof document !== 'undefined' ? document.getElementById('chat-mount-point') : null;

    // Check if this is the empty state (only welcome message)
    const isEmptyState = isPageMode && (
        messages.length === 0 ||
        (messages.length === 1 && (
            messages[0].id === 'welcome' ||
            messages[0].content?.includes('Como posso ajudar') ||
            messages[0].content?.includes('Sou seu assistente financeiro') ||
            messages[0].content?.includes('Nova conversa iniciada')
        ))
    );

    // Empty State Component for Page Mode
    const PageModeEmptyState = () => (
        <div className="flex flex-col items-center justify-center h-full px-4">
            {/* Logo Centralizada */}
            <div className="w-28 h-28 mb-4 relative">
                <div className="absolute inset-0 bg-[#d97757]/20 blur-3xl rounded-full" />
                <img src={coinzinhaImg} alt="Coinzinha" className="w-full h-full object-contain relative z-10 drop-shadow-2xl" />
            </div>

            {/* Texto Descritivo */}
            <p className="text-gray-400 text-sm mb-8 text-center max-w-md leading-relaxed">
                Sou a <span className="text-[#d97757] font-medium">Coinzinha</span>, sua assistente financeira pessoal. Posso ajudar a lançar gastos, analisar suas finanças ou dar dicas de economia.
            </p>

            {/* Atalhos Rápidos Centralizados */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
                {[
                    { text: "Adicionar Despesa", icon: <Plus size={16} className="text-[#d97757]" />, label: "Lançar Gasto", desc: "Registre uma nova compra" },
                    { text: "Analisar Gastos", icon: <TrendingUp size={16} className="text-blue-400" />, label: "Analisar", desc: "Veja seus gastos do mês" },
                    { text: "Dica do dia", icon: <Lightbulb size={16} className="text-yellow-400" />, label: "Dica", desc: "Sugestão financeira" },
                    { text: "Como economizar?", icon: <Sparkles size={16} className="text-green-400" />, label: "Economizar", desc: "Plano para poupar" }
                ].map((action, idx) => (
                    <button
                        key={idx}
                        onClick={() => handleQuickAction(action.text)}
                        className="flex flex-col items-start gap-2 p-4 bg-[#2a2a2a]/50 hover:bg-[#2a2a2a] border border-[#3a3a3a] hover:border-[#d97757]/30 rounded-xl transition-all group text-left"
                    >
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-[#333] group-hover:bg-[#3a3a3a] transition-colors">
                                {action.icon}
                            </div>
                            <span className="font-semibold text-sm text-gray-200 group-hover:text-white">{action.label}</span>
                        </div>
                        <span className="text-xs text-gray-500 group-hover:text-gray-400">{action.desc}</span>
                    </button>
                ))}
            </div>
        </div>
    );

    // Page Mode Render (Zen Mode - Full Screen)
    if (isPageMode && chatMountPoint) {
        return createPortal(
            <div className="flex h-full w-full bg-[#30302E] overflow-hidden">
                {/* Left Sidebar (Desktop) - History */}
                <div className={`hidden lg:flex border-r border-[#3a3a3a] flex-col transition-all duration-300 ${isSidebarCollapsed ? 'w-0 overflow-hidden opacity-0' : 'w-[280px]'}`}>
                    <div className="p-4">
                        <button
                            onClick={handleNewChat}
                            className="w-full flex items-center gap-2 p-2.5 rounded-lg text-gray-300 hover:bg-[#3a3a3a]/50 hover:text-white transition-all text-sm"
                        >
                            <Plus size={16} />
                            Nova Conversa
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-1">
                        {history.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-32 text-gray-500 gap-2 mt-10">
                                <MessageSquare size={24} className="opacity-20" />
                                <p className="text-xs text-center">Nenhum histórico.</p>
                            </div>
                        ) : (
                            history.map(session => (
                                <button
                                    key={session.id}
                                    onClick={() => handleLoadSession(session)}
                                    className="w-full text-left p-2.5 rounded-lg hover:bg-[#3a3a3a]/50 transition-all group flex items-start gap-2"
                                >
                                    <MessageSquare size={14} className="text-gray-600 group-hover:text-gray-400 mt-0.5 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-gray-300 line-clamp-1 group-hover:text-white transition-colors font-medium">{session.preview}</p>
                                        <span className="text-[10px] text-gray-600 group-hover:text-gray-500">{session.date}</span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                    <div className="p-3 border-t border-[#3a3a3a]">
                        <button
                            onClick={handleClearHistory}
                            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs"
                        >
                            <Trash2 size={14} />
                            Limpar Histórico
                        </button>
                    </div>
                </div>

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col relative min-w-0">
                    {/* Header - Toggle Sidebar & Close Button */}
                    <div className="absolute top-0 left-0 right-0 p-4 z-50 flex items-center justify-between pointer-events-none">
                        {/* Toggle Sidebar Button */}
                        <div className="pointer-events-auto hidden lg:block">
                            <button
                                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                                className="p-2 rounded-lg bg-[#2a2a2a]/80 backdrop-blur-sm border border-[#3a3a3a] text-gray-400 hover:text-white hover:bg-[#333] transition-all"
                                title={isSidebarCollapsed ? "Mostrar sidebar" : "Esconder sidebar"}
                            >
                                {isSidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
                            </button>
                        </div>
                        {/* Close Button */}
                        <div className="pointer-events-auto">
                            <button
                                onClick={() => setActiveTab && setActiveTab('dashboard')}
                                className="p-2.5 rounded-xl bg-[#2a2a2a]/80 backdrop-blur-sm border border-[#3a3a3a] text-gray-400 hover:text-white hover:bg-[#333] transition-all shadow-lg"
                                title="Fechar"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                        {isEmptyState ? (
                            <PageModeEmptyState />
                        ) : (
                            <div className="max-w-3xl mx-auto flex flex-col gap-6 p-4 lg:p-8 pt-20">
                                {messages
                                    .filter(msg => !(msg.id === 'welcome' || msg.content?.includes('Nova conversa iniciada')))
                                    .map((msg) => {
                                        // Calcular tempo relativo
                                        const now = Date.now();
                                        const diff = now - msg.timestamp;
                                        const seconds = Math.floor(diff / 1000);
                                        const minutes = Math.floor(seconds / 60);
                                        const hours = Math.floor(minutes / 60);
                                        let timeAgo = '';
                                        if (hours > 0) {
                                            timeAgo = `há ${hours}h`;
                                        } else if (minutes > 0) {
                                            timeAgo = `há ${minutes} min`;
                                        } else {
                                            timeAgo = 'agora';
                                        }

                                        return (
                                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                                                {msg.type === 'text' ? (
                                                    msg.role === 'user' ? (
                                                        // Usuário - com balão
                                                        <div className="max-w-[85%] lg:max-w-[75%] p-4 rounded-2xl rounded-br-sm text-sm leading-relaxed bg-[#d97757] text-white shadow-sm">
                                                            <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                                                            <p className="text-[10px] mt-2 text-right opacity-60 text-white">{timeAgo}</p>
                                                        </div>
                                                    ) : (
                                                        // IA - sem balão, texto formatado sem emojis
                                                        <div className="max-w-[85%] lg:max-w-[75%]">
                                                            <div className="text-sm leading-relaxed text-gray-300">
                                                                <FormattedAIText text={msg.content || ''} />
                                                            </div>
                                                            <p className="text-[10px] mt-2 text-gray-500">{timeAgo}</p>
                                                        </div>
                                                    )
                                                ) : msg.type === 'transaction_confirm' ? (
                                                    /* Single Transaction Card */
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                                        className="w-full max-w-[320px] bg-[#252525] border border-[#404040] rounded-2xl overflow-hidden shadow-xl"
                                                    >
                                                        <div className="p-4 pb-0 flex justify-between items-start">
                                                            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#333] border border-[#444]">
                                                                <Tag size={10} className="text-gray-400" />
                                                                <span className="text-[10px] font-medium text-gray-300 uppercase tracking-wide">{msg.transactionData?.category}</span>
                                                            </div>
                                                            <div className={`w-2 h-2 rounded-full ${msg.transactionData?.type === 'income' ? 'bg-green-500' : 'bg-[#d97757]'}`} />
                                                        </div>
                                                        <div className="px-5 py-6 text-center">
                                                            <p className="text-xs text-gray-500 font-medium mb-1">{msg.transactionData?.date}</p>
                                                            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-3xl font-bold text-white tracking-tight mb-2">
                                                                R$ {msg.transactionData?.amount.toFixed(2)}
                                                            </motion.div>
                                                            <p className="text-sm text-gray-400 font-medium leading-relaxed">{msg.transactionData?.description}</p>
                                                        </div>
                                                        <div className="p-3 pt-0">
                                                            {!msg.isConfirmed ? (
                                                                <motion.button
                                                                    whileHover={{ scale: 1.02 }}
                                                                    whileTap={{ scale: 0.98 }}
                                                                    onClick={() => msg.transactionData && handleConfirmTransaction(msg.id, msg.transactionData)}
                                                                    className="w-full bg-[#d97757] hover:bg-[#c56a4d] text-white py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#d97757]/10 flex items-center justify-center gap-2"
                                                                >
                                                                    <Check size={16} />
                                                                    Confirmar
                                                                </motion.button>
                                                            ) : (
                                                                <div className="w-full bg-[#333] text-gray-400 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-[#444]">
                                                                    <Check size={14} className="text-green-500" />
                                                                    Lançado
                                                                </div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                ) : msg.type === 'multiple_transactions' ? (
                                                    /* Multiple Transactions Card */
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                                        className="w-full max-w-[320px] bg-[#252525] border border-[#404040] rounded-2xl overflow-hidden shadow-xl"
                                                    >
                                                        <div className="p-4 border-b border-[#333]">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <div className="w-6 h-6 rounded-lg bg-[#333] flex items-center justify-center">
                                                                    <Sparkles size={12} className="text-[#d97757]" />
                                                                </div>
                                                                <span className="text-xs font-bold text-white">Múltiplos Itens ({msg.multipleTransactions?.length})</span>
                                                            </div>
                                                        </div>
                                                        <div className="p-2 space-y-1 max-h-[180px] overflow-y-auto custom-scrollbar">
                                                            {msg.multipleTransactions?.map((tx, idx) => (
                                                                <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-[#30302E] border border-[#3a3a3a]/50">
                                                                    <div className="flex flex-col min-w-0 pr-2">
                                                                        <span className="text-xs font-medium text-gray-200 truncate">{tx.description}</span>
                                                                        <span className="text-[10px] text-gray-500">{tx.category}</span>
                                                                    </div>
                                                                    <span className="text-xs font-bold text-white whitespace-nowrap">R$ {tx.amount.toFixed(2)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {msg.unifiedSuggestion && (
                                                            <div className="mx-2 mb-2 p-3 rounded-xl bg-[#d97757]/10 border border-[#d97757]/20 flex items-center justify-between">
                                                                <div>
                                                                    <p className="text-[10px] text-[#d97757] font-bold uppercase">Sugestão Unificada</p>
                                                                    <p className="text-xs text-gray-300 font-medium">{msg.unifiedSuggestion.description}</p>
                                                                </div>
                                                                <p className="text-sm font-bold text-white">R$ {msg.unifiedSuggestion.amount.toFixed(2)}</p>
                                                            </div>
                                                        )}
                                                        <div className="p-3 pt-1 space-y-2">
                                                            {!msg.isConfirmed ? (
                                                                <>
                                                                    <motion.button
                                                                        whileHover={{ scale: 1.01 }}
                                                                        whileTap={{ scale: 0.99 }}
                                                                        onClick={() => msg.multipleTransactions && handleConfirmSeparate(msg.id, msg.multipleTransactions)}
                                                                        className="w-full bg-[#333] hover:bg-[#3a3a3a] text-white py-2.5 rounded-xl text-xs font-bold transition-all border border-[#444]"
                                                                    >
                                                                        Lançar Separados
                                                                    </motion.button>
                                                                    {msg.unifiedSuggestion && (
                                                                        <motion.button
                                                                            whileHover={{ scale: 1.01 }}
                                                                            whileTap={{ scale: 0.99 }}
                                                                            onClick={() => msg.unifiedSuggestion && handleConfirmUnified(msg.id, msg.unifiedSuggestion)}
                                                                            className="w-full bg-[#d97757] hover:bg-[#c56a4d] text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-[#d97757]/10"
                                                                        >
                                                                            Unificar Tudo
                                                                        </motion.button>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <div className="w-full bg-[#333] text-gray-400 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-[#444]">
                                                                    <Check size={14} className="text-green-500" />
                                                                    Processado
                                                                </div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                ) : msg.type === 'reminder_confirm' ? (
                                                    /* Reminder Card */
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                                        className="w-full max-w-[320px] bg-[#252525] border border-[#404040] rounded-2xl overflow-hidden shadow-xl"
                                                    >
                                                        <div className="p-4 pb-0 flex justify-between items-start">
                                                            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#333] border border-[#444]">
                                                                <Tag size={10} className="text-blue-400" />
                                                                <span className="text-[10px] font-medium text-gray-300 uppercase tracking-wide">{msg.reminderData?.category}</span>
                                                            </div>
                                                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                        </div>
                                                        <div className="px-5 py-6 text-center">
                                                            <div className="flex justify-center items-center gap-1.5 mb-1">
                                                                <Calendar size={10} className="text-gray-500" />
                                                                <p className="text-xs text-gray-500 font-medium">{msg.reminderData?.dueDate}</p>
                                                            </div>
                                                            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-3xl font-bold text-white tracking-tight mb-2">
                                                                R$ {(msg.reminderData?.amount ?? 0).toFixed(2)}
                                                            </motion.div>
                                                            <p className="text-sm text-gray-400 font-medium leading-relaxed">{msg.reminderData?.description}</p>
                                                            {msg.reminderData?.isRecurring && (
                                                                <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400">
                                                                    <Clock size={8} />
                                                                    <span>{msg.reminderData.frequency === 'weekly' ? 'Semanal' : msg.reminderData.frequency === 'yearly' ? 'Anual' : 'Mensal'}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="p-3 pt-0">
                                                            {!msg.isConfirmed ? (
                                                                <motion.button
                                                                    whileHover={{ scale: 1.02 }}
                                                                    whileTap={{ scale: 0.98 }}
                                                                    onClick={() => msg.reminderData && handleConfirmReminder(msg.id, msg.reminderData)}
                                                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2"
                                                                >
                                                                    <Calendar size={16} />
                                                                    Criar Lembrete
                                                                </motion.button>
                                                            ) : (
                                                                <div className="w-full bg-[#333] text-gray-400 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-[#444]">
                                                                    <Check size={14} className="text-green-500" />
                                                                    Criado
                                                                </div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                ) : msg.type === 'subscription_confirm' ? (
                                                    /* Subscription Card */
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                                        className="w-full max-w-[320px] bg-[#252525] border border-[#404040] rounded-2xl overflow-hidden shadow-xl"
                                                    >
                                                        <div className="p-4 pb-0 flex justify-between items-start">
                                                            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#333] border border-[#444]">
                                                                <Tag size={10} className="text-purple-400" />
                                                                <span className="text-[10px] font-medium text-gray-300 uppercase tracking-wide">{msg.subscriptionData?.category}</span>
                                                            </div>
                                                            <div className="w-2 h-2 rounded-full bg-purple-500" />
                                                        </div>
                                                        <div className="px-5 py-6 text-center">
                                                            <p className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wider">
                                                                {msg.subscriptionData?.billingCycle === 'monthly' ? 'Mensal' : 'Anual'}
                                                            </p>
                                                            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-3xl font-bold text-white tracking-tight mb-2">
                                                                R$ {(msg.subscriptionData?.amount ?? 0).toFixed(2)}
                                                            </motion.div>
                                                            <p className="text-sm text-gray-400 font-medium leading-relaxed">{msg.subscriptionData?.name}</p>
                                                        </div>
                                                        <div className="p-3 pt-0">
                                                            {!msg.isConfirmed ? (
                                                                <motion.button
                                                                    whileHover={{ scale: 1.02 }}
                                                                    whileTap={{ scale: 0.98 }}
                                                                    onClick={() => msg.subscriptionData && handleConfirmSubscription(msg.id, msg.subscriptionData)}
                                                                    className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-purple-500/10 flex items-center justify-center gap-2"
                                                                >
                                                                    <Clock size={16} />
                                                                    Assinar
                                                                </motion.button>
                                                            ) : (
                                                                <div className="w-full bg-[#333] text-gray-400 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-[#444]">
                                                                    <Check size={14} className="text-green-500" />
                                                                    Ativo
                                                                </div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                ) : msg.type === 'mixed_items' ? (
                                                    /* Mixed Items Card */
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                                        className="w-full max-w-[320px] bg-[#252525] border border-[#404040] rounded-2xl overflow-hidden shadow-xl"
                                                    >
                                                        <div className="p-4 border-b border-[#333]">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <div className="w-6 h-6 rounded-lg bg-[#333] flex items-center justify-center">
                                                                    <Sparkles size={12} className="text-[#d97757]" />
                                                                </div>
                                                                <span className="text-xs font-bold text-white">
                                                                    {(msg.mixedTransactions?.length || 0) + (msg.mixedReminders?.length || 0) + (msg.mixedSubscriptions?.length || 0)} Itens Identificados
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="p-2 space-y-1 max-h-[180px] overflow-y-auto custom-scrollbar">
                                                            {msg.mixedTransactions?.map((tx, idx) => (
                                                                <div key={`tx-${idx}`} className="flex items-center justify-between p-2.5 rounded-lg bg-[#30302E] border border-[#3a3a3a]/50">
                                                                    <div className="flex flex-col min-w-0 pr-2">
                                                                        <span className="text-xs font-medium text-gray-200 truncate">{tx.description}</span>
                                                                        <span className="text-[10px] text-gray-500">{tx.category}</span>
                                                                    </div>
                                                                    <span className="text-xs font-bold text-white whitespace-nowrap">R$ {tx.amount.toFixed(2)}</span>
                                                                </div>
                                                            ))}
                                                            {msg.mixedReminders?.map((rem, idx) => (
                                                                <div key={`rem-${idx}`} className="flex items-center justify-between p-2.5 rounded-lg bg-[#30302E] border border-[#3a3a3a]/50">
                                                                    <div className="flex flex-col min-w-0 pr-2">
                                                                        <span className="text-xs font-medium text-gray-200 truncate">{rem.description}</span>
                                                                        <span className="text-[10px] text-gray-500">{rem.category}</span>
                                                                    </div>
                                                                    <span className="text-xs font-bold text-white whitespace-nowrap">R$ {rem.amount.toFixed(2)}</span>
                                                                </div>
                                                            ))}
                                                            {msg.mixedSubscriptions?.map((sub, idx) => (
                                                                <div key={`sub-${idx}`} className="flex items-center justify-between p-2.5 rounded-lg bg-[#30302E] border border-[#3a3a3a]/50">
                                                                    <div className="flex flex-col min-w-0 pr-2">
                                                                        <span className="text-xs font-medium text-gray-200 truncate">{sub.name}</span>
                                                                        <span className="text-[10px] text-gray-500">{sub.billingCycle === 'monthly' ? 'Mensal' : 'Anual'}</span>
                                                                    </div>
                                                                    <span className="text-xs font-bold text-white whitespace-nowrap">R$ {sub.amount.toFixed(2)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="p-3 pt-1">
                                                            {!msg.isConfirmed ? (
                                                                <motion.button
                                                                    whileHover={{ scale: 1.01 }}
                                                                    whileTap={{ scale: 0.99 }}
                                                                    onClick={() => handleConfirmMixedItems(
                                                                        msg.id,
                                                                        msg.mixedTransactions,
                                                                        msg.mixedReminders,
                                                                        msg.mixedSubscriptions
                                                                    )}
                                                                    className="w-full bg-[#d97757] hover:bg-[#c56a4d] text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-[#d97757]/10"
                                                                >
                                                                    Salvar Tudo
                                                                </motion.button>
                                                            ) : (
                                                                <div className="w-full bg-[#333] text-gray-400 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-[#444]">
                                                                    <Check size={14} className="text-green-500" />
                                                                    Processado
                                                                </div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                {isThinking && (
                                    <div className="flex justify-start w-full">
                                        <span className="text-sm text-gray-400 animate-pulse">Pensando...</span>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-4 lg:p-6 bg-[#30302E] shrink-0">
                        <div className="max-w-3xl mx-auto w-full">
                            <div className="flex items-center gap-3 bg-[#2a2a2a] border border-[#3a3a3a] focus-within:border-[#d97757]/50 focus-within:ring-1 focus-within:ring-[#d97757]/50 rounded-2xl px-4 py-3 shadow-lg transition-all">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !isLimitReached && handleSendMessage()}
                                    placeholder={isLimitReached ? "Limite atingido" : "Digite sua mensagem..."}
                                    disabled={isLimitReached}
                                    className="flex-1 bg-transparent text-base text-white placeholder-gray-500 focus:outline-none"
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!inputValue.trim() || isThinking || isLimitReached}
                                    className="p-2 bg-[#d97757] hover:bg-[#c56a4d] disabled:opacity-50 rounded-xl text-white transition-all shadow-lg shadow-[#d97757]/20"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                            <p className="text-center text-[10px] text-gray-500 mt-2">O Coinzinha pode cometer erros. Verifique informações importantes.</p>
                        </div>
                    </div>
                </div>
            </div>,
            chatMountPoint
        );
    }

    return (
        <div className={cn(
            "fixed z-50 flex items-center justify-center transition-all duration-300",
            isFullScreen ? "inset-0 bg-black/50 backdrop-blur-sm" : "bottom-0 right-6"
        )}>
            {/* Speech Bubble - Typewriter effect com surgimento do Coinzinha */}
            <AnimatePresence>
                {!isOpen && showBubble && currentPhrase && !isFullScreen && (
                    <motion.div
                        initial={{
                            opacity: 0,
                            scaleY: 0,
                            scaleX: 0.5,
                            y: 60,
                            filter: "blur(10px)"
                        }}
                        animate={{
                            opacity: 1,
                            scaleY: 1,
                            scaleX: 1,
                            y: isHovered ? -48 : 8,
                            filter: "blur(0)"
                        }}
                        exit={{
                            opacity: 0,
                            scaleY: 0,
                            scaleX: 0.5,
                            y: 40,
                            filter: "blur(10px)",
                            transition: { duration: 0.2, ease: "easeIn" }
                        }}
                        transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 22,
                            mass: 0.8
                        }}
                        className="absolute bottom-[56px] right-[4px] z-[60] origin-bottom"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <motion.div
                            className="relative bg-[#30302E] backdrop-blur-sm border border-[#373734] ring-1 ring-white/5 rounded-2xl px-4 py-3 shadow-[0_0_20px_rgba(0,0,0,0.2)] max-w-[250px]"
                            layout
                            transition={{
                                layout: {
                                    type: "spring",
                                    stiffness: 350,
                                    damping: 28
                                }
                            }}
                        >
                            <div className="text-sm text-gray-200 whitespace-normal flex items-center min-h-[20px]">
                                {showDots ? (
                                    // Pontinhos animados
                                    <div className="flex gap-1.5 px-1">
                                        <motion.span
                                            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                                            transition={{ duration: 0.8, repeat: Infinity, delay: 0 }}
                                            className="w-1.5 h-1.5 rounded-full bg-gray-400"
                                        />
                                        <motion.span
                                            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                                            transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
                                            className="w-1.5 h-1.5 rounded-full bg-gray-400"
                                        />
                                        <motion.span
                                            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                                            transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
                                            className="w-1.5 h-1.5 rounded-full bg-gray-400"
                                        />
                                    </div>
                                ) : (
                                    <span className="leading-relaxed">{currentPhrase}</span>
                                )}
                            </div>
                            {/* Arrow pointing down-right - aponta para o Coinzinha */}
                            <div className="absolute -bottom-2 right-[20px] w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px] border-t-[#373734]" />
                            <div className="absolute -bottom-[7px] right-[21px] w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[9px] border-t-[#30302E]" />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div
                ref={wrapperRef}
                className={cn(
                    "relative flex flex-col items-center overflow-hidden shadow-2xl",
                    isOpen ? "bg-[#2d2d2d] border border-[#3a3a3a]" : "bg-transparent border-0"
                )}
                initial={false}
                animate={{
                    width: isFullScreen ? "100vw" : (isOpen ? OPEN_WIDTH : 56),
                    height: isFullScreen ? "100vh" : (isOpen ? OPEN_HEIGHT : 56),
                    borderRadius: isFullScreen ? 0 : (isOpen ? 16 : 28),
                    y: isFullScreen ? 0 : (isOpen ? -24 : (isHovered ? -24 : 32)),
                }}
                transition={{
                    ...SPRING_CONFIG,
                    delay: isOpen ? 0 : 0.08,
                }}
                onMouseEnter={() => !isOpen && setIsHovered(true)}
                onMouseLeave={() => !isOpen && setIsHovered(false)}
                // Mobile override
                style={isOpen && typeof window !== 'undefined' && window.innerWidth < 450 ? { width: '90vw' } : {}}
            >
                <AnimatePresence mode="wait">
                    {!isOpen ? (
                        /* --- CLOSED STATE (Peek Logo) --- */
                        <motion.div
                            key="peek-logo"
                            className="w-full h-full flex items-center justify-center cursor-pointer relative"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => setIsOpen(true)}
                        >
                            <motion.div
                                className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center"
                                animate={{
                                    scale: isHovered ? 1.1 : 1,
                                }}
                                transition={{ duration: 0.2 }}
                            >
                                <img src={coinzinhaImg} alt="Coinzinha" className="w-full h-full object-contain" />
                            </motion.div>
                        </motion.div>
                    ) : (
                        /* --- OPEN STATE (Chat Interface) --- */
                        <motion.div
                            key="chat-interface"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: 0.1, duration: 0.2 }}
                            className="flex flex-col w-full h-full"
                        >
                            {/* Header */}
                            <div className="h-14 bg-[#333432] border-b border-[#3a3a3a] flex items-center justify-between px-4 select-none shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center">
                                        <img src={coinzinhaImg} alt="Coinzinha" className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-sm leading-tight">Coinzinha</h3>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-1.5 h-1.5 rounded-full ${isThinking ? 'bg-yellow-500' : 'bg-green-500'} animate-pulse`}></span>
                                            <span className="text-[10px] text-gray-400 font-medium">
                                                {isThinking ? 'Digitando...' : 'Online'}
                                            </span>
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
                                        onClick={() => {
                                            setIsOpen(false);
                                            setActiveTab && setActiveTab('chat');
                                        }}
                                        className="p-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
                                        title="Abrir em tela cheia"
                                    >
                                        <Maximize2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="p-2 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                        title=" Fechar"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Content Area */}
                            <div className="relative flex-1 bg-[#30302E] overflow-hidden flex flex-col items-center w-full">
                                {/* Chat View */}
                                <div className={`absolute inset-0 flex flex-col transition-opacity duration-300 w-full ${view === 'chat' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                                    {/* Messages */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar overflow-x-hidden w-full flex flex-col items-center">
                                        <div className={cn("w-full flex flex-col gap-3", isFullScreen ? "max-w-4xl" : "")}>
                                            {messages.map((msg, index) => (
                                                <div
                                                    key={msg.id}
                                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up w-full`}
                                                >
                                                    {msg.type === 'text' ? (
                                                        <div
                                                            className={`
                                                                max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm overflow-hidden
                                                                ${msg.role === 'user'
                                                                    ? 'bg-[#d97757] text-white rounded-br-sm'
                                                                    : 'bg-[#3a3a3a] text-gray-200 rounded-bl-sm border border-[#454545]'
                                                                }
                                                                `}
                                                        >
                                                            {msg.role === 'ai' ? (
                                                                <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                                                            ) : (
                                                                <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                                                            )}
                                                            <p className={`text-[10px] mt-1 text-right opacity-60 ${msg.role === 'user' ? 'text-white' : 'text-gray-400'}`}>
                                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                    ) : msg.type === 'transaction_confirm' ? (
                                                        /* Single Transaction Card - Minimalist Redesign */
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                            transition={{ duration: 0.3, ease: "easeOut" }}
                                                            className="w-full max-w-[280px] bg-[#252525] border border-[#404040] rounded-2xl overflow-hidden shadow-xl"
                                                        >
                                                            {/* Top: Category Badge */}
                                                            <div className="p-4 pb-0 flex justify-between items-start">
                                                                <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#333] border border-[#444]">
                                                                    <Tag size={10} className="text-gray-400" />
                                                                    <span className="text-[10px] font-medium text-gray-300 uppercase tracking-wide">{msg.transactionData?.category}</span>
                                                                </div>
                                                                <div className={`w-2 h-2 rounded-full ${msg.transactionData?.type === 'income' ? 'bg-green-500' : 'bg-[#d97757]'}`} />
                                                            </div>

                                                            {/* Center: Amount & Info */}
                                                            <div className="px-5 py-6 text-center">
                                                                <p className="text-xs text-gray-500 font-medium mb-1">
                                                                    {msg.transactionData?.date}
                                                                </p>
                                                                <motion.div
                                                                    initial={{ scale: 0.9 }}
                                                                    animate={{ scale: 1 }}
                                                                    className="text-3xl font-bold text-white tracking-tight mb-2"
                                                                >
                                                                    R$ {msg.transactionData?.amount.toFixed(2)}
                                                                </motion.div>
                                                                <p className="text-sm text-gray-400 font-medium leading-relaxed">
                                                                    {msg.transactionData?.description}
                                                                </p>
                                                            </div>

                                                            {/* Bottom: Action */}
                                                            <div className="p-3 pt-0">
                                                                {!msg.isConfirmed ? (
                                                                    <motion.button
                                                                        whileHover={{ scale: 1.02 }}
                                                                        whileTap={{ scale: 0.98 }}
                                                                        onClick={() => msg.transactionData && handleConfirmTransaction(msg.id, msg.transactionData)}
                                                                        className="w-full bg-[#d97757] hover:bg-[#c56a4d] text-white py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#d97757]/10 flex items-center justify-center gap-2"
                                                                    >
                                                                        <Check size={16} />
                                                                        Confirmar
                                                                    </motion.button>
                                                                ) : (
                                                                    <div className="w-full bg-[#333] text-gray-400 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-[#444]">
                                                                        <Check size={14} className="text-green-500" />
                                                                        Lançado
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    ) : msg.type === 'multiple_transactions' ? (
                                                        /* Multiple Transactions Card - Minimalist Redesign */
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                            transition={{ duration: 0.3, ease: "easeOut" }}
                                                            className="w-full max-w-[300px] bg-[#252525] border border-[#404040] rounded-2xl overflow-hidden shadow-xl"
                                                        >
                                                            <div className="p-4 border-b border-[#333]">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <div className="w-6 h-6 rounded-lg bg-[#333] flex items-center justify-center">
                                                                        <Sparkles size={12} className="text-[#d97757]" />
                                                                    </div>
                                                                    <span className="text-xs font-bold text-white">Múltiplos Itens ({msg.multipleTransactions?.length})</span>
                                                                </div>
                                                            </div>

                                                            <div className="p-2 space-y-1 max-h-[180px] overflow-y-auto custom-scrollbar">
                                                                {msg.multipleTransactions?.map((tx, idx) => (
                                                                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-[#30302E] border border-[#3a3a3a]/50">
                                                                        <div className="flex flex-col min-w-0 pr-2">
                                                                            <span className="text-xs font-medium text-gray-200 truncate">{tx.description}</span>
                                                                            <span className="text-[10px] text-gray-500">{tx.category}</span>
                                                                        </div>
                                                                        <span className="text-xs font-bold text-white whitespace-nowrap">R$ {tx.amount.toFixed(2)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {msg.unifiedSuggestion && (
                                                                <div className="mx-2 mb-2 p-3 rounded-xl bg-[#d97757]/10 border border-[#d97757]/20 flex items-center justify-between">
                                                                    <div>
                                                                        <p className="text-[10px] text-[#d97757] font-bold uppercase">Sugestão Unificada</p>
                                                                        <p className="text-xs text-gray-300 font-medium">{msg.unifiedSuggestion.description}</p>
                                                                    </div>
                                                                    <p className="text-sm font-bold text-white">R$ {msg.unifiedSuggestion.amount.toFixed(2)}</p>
                                                                </div>
                                                            )}

                                                            <div className="p-3 pt-1 space-y-2">
                                                                {!msg.isConfirmed ? (
                                                                    <>
                                                                        <motion.button
                                                                            whileHover={{ scale: 1.01 }}
                                                                            whileTap={{ scale: 0.99 }}
                                                                            onClick={() => msg.multipleTransactions && handleConfirmSeparate(msg.id, msg.multipleTransactions)}
                                                                            className="w-full bg-[#333] hover:bg-[#3a3a3a] text-white py-2.5 rounded-xl text-xs font-bold transition-all border border-[#444]"
                                                                        >
                                                                            Lançar Separados
                                                                        </motion.button>
                                                                        {msg.unifiedSuggestion && (
                                                                            <motion.button
                                                                                whileHover={{ scale: 1.01 }}
                                                                                whileTap={{ scale: 0.99 }}
                                                                                onClick={() => msg.unifiedSuggestion && handleConfirmUnified(msg.id, msg.unifiedSuggestion)}
                                                                                className="w-full bg-[#d97757] hover:bg-[#c56a4d] text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-[#d97757]/10"
                                                                            >
                                                                                Unificar Tudo
                                                                            </motion.button>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <div className="w-full bg-[#333] text-gray-400 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-[#444]">
                                                                        <Check size={14} className="text-green-500" />
                                                                        Processado
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    ) : msg.type === 'reminder_confirm' ? (
                                                        /* Reminder Card - Minimalist Redesign */
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                            transition={{ duration: 0.3, ease: "easeOut" }}
                                                            className="w-full max-w-[280px] bg-[#252525] border border-[#404040] rounded-2xl overflow-hidden shadow-xl"
                                                        >
                                                            {/* Top: Category Badge */}
                                                            <div className="p-4 pb-0 flex justify-between items-start">
                                                                <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#333] border border-[#444]">
                                                                    <Tag size={10} className="text-blue-400" />
                                                                    <span className="text-[10px] font-medium text-gray-300 uppercase tracking-wide">{msg.reminderData?.category}</span>
                                                                </div>
                                                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                            </div>

                                                            {/* Center: Amount & Info */}
                                                            <div className="px-5 py-6 text-center">
                                                                <div className="flex justify-center items-center gap-1.5 mb-1">
                                                                    <Calendar size={10} className="text-gray-500" />
                                                                    <p className="text-xs text-gray-500 font-medium">
                                                                        {msg.reminderData?.dueDate}
                                                                    </p>
                                                                </div>
                                                                <motion.div
                                                                    initial={{ scale: 0.9 }}
                                                                    animate={{ scale: 1 }}
                                                                    className="text-3xl font-bold text-white tracking-tight mb-2"
                                                                >
                                                                    R$ {(msg.reminderData?.amount ?? 0).toFixed(2)}
                                                                </motion.div>
                                                                <p className="text-sm text-gray-400 font-medium leading-relaxed">
                                                                    {msg.reminderData?.description}
                                                                </p>
                                                                {msg.reminderData?.isRecurring && (
                                                                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400">
                                                                        <Clock size={8} />
                                                                        <span>{msg.reminderData.frequency === 'weekly' ? 'Semanal' : msg.reminderData.frequency === 'yearly' ? 'Anual' : 'Mensal'}</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Bottom: Action */}
                                                            <div className="p-3 pt-0">
                                                                {!msg.isConfirmed ? (
                                                                    <motion.button
                                                                        whileHover={{ scale: 1.02 }}
                                                                        whileTap={{ scale: 0.98 }}
                                                                        onClick={() => msg.reminderData && handleConfirmReminder(msg.id, msg.reminderData)}
                                                                        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2"
                                                                    >
                                                                        <Calendar size={16} />
                                                                        Criar Lembrete
                                                                    </motion.button>
                                                                ) : (
                                                                    <div className="w-full bg-[#333] text-gray-400 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-[#444]">
                                                                        <Check size={14} className="text-green-500" />
                                                                        Criado
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    ) : msg.type === 'subscription_confirm' ? (
                                                        /* Subscription Card - Minimalist Redesign */
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                            transition={{ duration: 0.3, ease: "easeOut" }}
                                                            className="w-full max-w-[280px] bg-[#252525] border border-[#404040] rounded-2xl overflow-hidden shadow-xl"
                                                        >
                                                            {/* Top: Category Badge */}
                                                            <div className="p-4 pb-0 flex justify-between items-start">
                                                                <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#333] border border-[#444]">
                                                                    <Tag size={10} className="text-purple-400" />
                                                                    <span className="text-[10px] font-medium text-gray-300 uppercase tracking-wide">{msg.subscriptionData?.category}</span>
                                                                </div>
                                                                <div className="w-2 h-2 rounded-full bg-purple-500" />
                                                            </div>

                                                            {/* Center: Amount & Info */}
                                                            <div className="px-5 py-6 text-center">
                                                                <p className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wider">
                                                                    {msg.subscriptionData?.billingCycle === 'monthly' ? 'Mensal' : 'Anual'}
                                                                </p>
                                                                <motion.div
                                                                    initial={{ scale: 0.9 }}
                                                                    animate={{ scale: 1 }}
                                                                    className="text-3xl font-bold text-white tracking-tight mb-2"
                                                                >
                                                                    R$ {(msg.subscriptionData?.amount ?? 0).toFixed(2)}
                                                                </motion.div>
                                                                <p className="text-sm text-gray-400 font-medium leading-relaxed">
                                                                    {msg.subscriptionData?.name}
                                                                </p>
                                                            </div>

                                                            {/* Bottom: Action */}
                                                            <div className="p-3 pt-0">
                                                                {!msg.isConfirmed ? (
                                                                    <motion.button
                                                                        whileHover={{ scale: 1.02 }}
                                                                        whileTap={{ scale: 0.98 }}
                                                                        onClick={() => msg.subscriptionData && handleConfirmSubscription(msg.id, msg.subscriptionData)}
                                                                        className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-purple-500/10 flex items-center justify-center gap-2"
                                                                    >
                                                                        <Clock size={16} />
                                                                        Assinar
                                                                    </motion.button>
                                                                ) : (
                                                                    <div className="w-full bg-[#333] text-gray-400 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-[#444]">
                                                                        <Check size={14} className="text-green-500" />
                                                                        Ativo
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    ) : msg.type === 'mixed_items' ? (
                                                        /* Mixed Items Card (Popup) */
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                            transition={{ duration: 0.3, ease: "easeOut" }}
                                                            className="w-full max-w-[300px] bg-[#252525] border border-[#404040] rounded-2xl overflow-hidden shadow-xl"
                                                        >
                                                            <div className="p-4 border-b border-[#333]">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <div className="w-6 h-6 rounded-lg bg-[#333] flex items-center justify-center">
                                                                        <Sparkles size={12} className="text-[#d97757]" />
                                                                    </div>
                                                                    <span className="text-xs font-bold text-white">Múltiplos Itens ({(msg.mixedTransactions?.length || 0) + (msg.mixedReminders?.length || 0) + (msg.mixedSubscriptions?.length || 0)})</span>
                                                                </div>
                                                            </div>
                                                            <div className="p-2 space-y-1 max-h-[180px] overflow-y-auto custom-scrollbar">
                                                                {msg.mixedTransactions?.map((tx, idx) => (
                                                                    <div key={`tx-${idx}`} className="flex items-center justify-between p-2.5 rounded-lg bg-[#30302E] border border-[#3a3a3a]/50">
                                                                        <div className="flex flex-col min-w-0 pr-2">
                                                                            <span className="text-xs font-medium text-gray-200 truncate">{tx.description}</span>
                                                                            <span className="text-[10px] text-gray-500">{tx.category}</span>
                                                                        </div>
                                                                        <span className="text-xs font-bold text-white whitespace-nowrap">R$ {tx.amount.toFixed(2)}</span>
                                                                    </div>
                                                                ))}
                                                                {msg.mixedReminders?.map((rem, idx) => (
                                                                    <div key={`rem-${idx}`} className="flex items-center justify-between p-2.5 rounded-lg bg-[#30302E] border border-[#3a3a3a]/50">
                                                                        <div className="flex flex-col min-w-0 pr-2">
                                                                            <span className="text-xs font-medium text-gray-200 truncate">{rem.description}</span>
                                                                            <span className="text-[10px] text-gray-500">{rem.category}</span>
                                                                        </div>
                                                                        <span className="text-xs font-bold text-white whitespace-nowrap">R$ {rem.amount.toFixed(2)}</span>
                                                                    </div>
                                                                ))}
                                                                {msg.mixedSubscriptions?.map((sub, idx) => (
                                                                    <div key={`sub-${idx}`} className="flex items-center justify-between p-2.5 rounded-lg bg-[#30302E] border border-[#3a3a3a]/50">
                                                                        <div className="flex flex-col min-w-0 pr-2">
                                                                            <span className="text-xs font-medium text-gray-200 truncate">{sub.name}</span>
                                                                            <span className="text-[10px] text-gray-500">{sub.billingCycle === 'monthly' ? 'Mensal' : 'Anual'}</span>
                                                                        </div>
                                                                        <span className="text-xs font-bold text-white whitespace-nowrap">R$ {sub.amount.toFixed(2)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="p-3 pt-1">
                                                                {!msg.isConfirmed ? (
                                                                    <motion.button
                                                                        whileHover={{ scale: 1.01 }}
                                                                        whileTap={{ scale: 0.99 }}
                                                                        onClick={() => handleConfirmMixedItems(
                                                                            msg.id,
                                                                            msg.mixedTransactions,
                                                                            msg.mixedReminders,
                                                                            msg.mixedSubscriptions
                                                                        )}
                                                                        className="w-full bg-[#d97757] hover:bg-[#c56a4d] text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-[#d97757]/10"
                                                                    >
                                                                        Salvar Tudo
                                                                    </motion.button>
                                                                ) : (
                                                                    <div className="w-full bg-[#333] text-gray-400 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-[#444]">
                                                                        <Check size={14} className="text-green-500" />
                                                                        Processado
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    ) : null}
                                                </div>
                                            ))}

                                            {isThinking && (
                                                <div className="flex justify-start w-full">
                                                    <div className="bg-[#313131] border border-[#3a3a3a] rounded-2xl rounded-tl-sm p-4 flex items-center">
                                                        <TextShimmer className='font-medium text-sm' duration={1.5}>
                                                            Pensando...
                                                        </TextShimmer>
                                                    </div>
                                                </div>
                                            )}
                                            <div ref={messagesEndRef} />
                                        </div>
                                    </div>

                                    {/* Input Area */}
                                    <div className="p-3 bg-[#333432] border-t border-[#3a3a3a] shrink-0 w-full flex flex-col items-center">
                                        <div className={cn("w-full", isFullScreen ? "max-w-4xl" : "")}>
                                            {/* Usage Banner for Starter Users */}
                                            {userPlan === 'starter' && !isLimitReached && (
                                                <div className="mb-3 px-3 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-xl flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Sparkles size={12} className="text-[#d97757]" />
                                                        <span className="text-[10px] text-gray-400 font-medium">Utilização</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-16 h-1.5 bg-[#3a3a3a] rounded-full overflow-hidden">
                                                            <motion.div
                                                                className="h-full bg-[#d97757]"
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${(starterMessageCount / 5) * 100}%` }}
                                                                transition={{ duration: 0.5, ease: "easeOut" }}
                                                            />
                                                        </div>
                                                        <span className="text-[10px] font-bold text-white">{starterMessageCount} de 5</span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Limit Banner - Minimalist */}
                                            {isLimitReached && (
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="mb-3 px-2 flex items-center justify-between"
                                                >
                                                    <span className="text-xs text-gray-400">
                                                        Limite de 5 mensagens atingido.
                                                    </span>
                                                    <button
                                                        onClick={() => onUpgrade?.()}
                                                        className="text-xs font-bold text-[#d97757] hover:text-[#c56a4d] transition-colors"
                                                    >
                                                        Fazer Upgrade
                                                    </button>
                                                </motion.div>
                                            )}

                                            {/* Quick Actions - Scroll horizontal com indicador */}
                                            {
                                                !isLimitReached && messages.length < 3 && (
                                                    <div className="relative mb-3">
                                                        {/* Container com scroll - Drag to scroll no desktop */}
                                                        <div
                                                            ref={quickActionsRef}
                                                            className="flex gap-2 overflow-x-auto scrollbar-hide pr-8 cursor-grab select-none"
                                                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                                            onMouseDown={handleMouseDown}
                                                            onMouseUp={handleMouseUp}
                                                            onMouseMove={handleMouseMove}
                                                            onMouseLeave={handleMouseLeave}
                                                        >
                                                            <button
                                                                onClick={() => handleQuickAction("Adicionar Despesa")}
                                                                className="group flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] hover:bg-[#353535] rounded-xl border border-[#3a3a3a] hover:border-[#d97757]/50 text-xs text-gray-300 hover:text-white whitespace-nowrap transition-all duration-200 shrink-0"
                                                            >
                                                                <div className="w-6 h-6 rounded-lg bg-[#d97757]/20 flex items-center justify-center group-hover:bg-[#d97757]/30 transition-colors">
                                                                    <Plus size={12} className="text-[#d97757]" />
                                                                </div>
                                                                <span className="font-medium">Lançar</span>
                                                            </button>
                                                            <button
                                                                onClick={() => handleQuickAction("Analisar Gastos")}
                                                                className="group flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] hover:bg-[#353535] rounded-xl border border-[#3a3a3a] hover:border-blue-500/50 text-xs text-gray-300 hover:text-white whitespace-nowrap transition-all duration-200 shrink-0"
                                                            >
                                                                <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                                                                    <TrendingUp size={12} className="text-blue-400" />
                                                                </div>
                                                                <span className="font-medium">Analisar</span>
                                                            </button>
                                                            <button
                                                                onClick={() => handleQuickAction("Dica do dia")}
                                                                className="group flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] hover:bg-[#353535] rounded-xl border border-[#3a3a3a] hover:border-yellow-500/50 text-xs text-gray-300 hover:text-white whitespace-nowrap transition-all duration-200 shrink-0"
                                                            >
                                                                <div className="w-6 h-6 rounded-lg bg-yellow-500/20 flex items-center justify-center group-hover:bg-yellow-500/30 transition-colors">
                                                                    <Lightbulb size={12} className="text-yellow-400" />
                                                                </div>
                                                                <span className="font-medium">Dica</span>
                                                            </button>
                                                            <button
                                                                onClick={() => handleQuickAction("Como economizar?")}
                                                                className="group flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] hover:bg-[#353535] rounded-xl border border-[#3a3a3a] hover:border-green-500/50 text-xs text-gray-300 hover:text-white whitespace-nowrap transition-all duration-200 shrink-0"
                                                            >
                                                                <div className="w-6 h-6 rounded-lg bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                                                                    <Sparkles size={12} className="text-green-400" />
                                                                </div>
                                                                <span className="font-medium">Economizar</span>
                                                            </button>
                                                        </div>
                                                        {/* Gradiente + Seta indicando mais conteúdo */}
                                                        <div className="absolute right-0 top-0 bottom-0 flex items-center pointer-events-none">
                                                            <div className="w-12 h-full bg-gradient-to-l from-[#333432] to-transparent" />
                                                            <motion.div
                                                                animate={{ x: [0, 3, 0] }}
                                                                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                                                                className="absolute right-0 w-6 h-6 flex items-center justify-center"
                                                            >
                                                                <ChevronRight size={16} className="text-gray-400" />
                                                            </motion.div>
                                                        </div>
                                                    </div>
                                                )
                                            }

                                            <div className={`flex items-center gap-2 bg-[#2D2D2D] border ${isLimitReached ? 'border-red-500/30 opacity-50' : 'border-[#3a3a3a] focus-within:border-[#d97757] focus-within:ring-1 focus-within:ring-[#d97757]/50'} rounded-xl px-3 py-2.5 transition-all`}>
                                                <input
                                                    ref={inputRef}
                                                    type="text"
                                                    value={inputValue}
                                                    onChange={(e) => setInputValue(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && !isLimitReached && handleSendMessage()}
                                                    placeholder={isLimitReached ? "Limite de mensagens atingido" : "Digite sua mensagem..."}
                                                    disabled={isLimitReached}
                                                    className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none disabled:cursor-not-allowed"
                                                />
                                                <button
                                                    onClick={handleSendMessage}
                                                    disabled={!inputValue.trim() || isThinking || isLimitReached}
                                                    className="p-2 bg-[#d97757] hover:bg-[#c56a4d] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-all shadow-lg shadow-[#d97757]/20"
                                                >
                                                    <Send size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* History View */}
                                <div className={`absolute inset-0 bg-[#30302E] flex flex-col transition-opacity duration-300 ${view === 'history' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                                    <div className="p-4 flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center">
                                        <div className={cn("w-full h-full", isFullScreen ? "max-w-4xl" : "")}>
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
                                    </div>

                                    <div className="mt-auto p-4 border-t border-gray-800 shrink-0 w-full flex justify-center">
                                        <div className={cn("w-full", isFullScreen ? "max-w-4xl" : "")}>
                                            <button
                                                onClick={() => {
                                                    setHistory([]);
                                                    if (userId) clearChatHistory(userId);
                                                }}
                                                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors text-sm"
                                            >
                                                <Trash2 size={16} />
                                                Limpar Histórico
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div >
        </div >
    );
};