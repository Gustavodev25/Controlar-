import React, { useState, useRef, useEffect, useMemo, type JSX } from 'react';
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
    ChevronRight
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
}

interface Message {
    id: string;
    role: 'user' | 'ai';
    content?: string;
    type: 'text' | 'transaction_confirm' | 'multiple_transactions' | 'reminder_confirm' | 'subscription_confirm';
    transactionData?: AIParsedTransaction;
    multipleTransactions?: AIParsedTransaction[];
    unifiedSuggestion?: AIParsedTransaction;
    reminderData?: AIParsedReminder;
    subscriptionData?: AIParsedSubscription;
    isConfirmed?: boolean;
    confirmedChoice?: 'unified' | 'separate';
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
    isProMode = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [view, setView] = useState<'chat' | 'history'>('chat');
    const [history, setHistory] = useState<ChatSession[]>([]);
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
    const [displayedText, setDisplayedText] = useState('');
    const [showBubble, setShowBubble] = useState(false);
    const [isTyping, setIsTyping] = useState(false);

    // Efeito para mostrar frases aleatórias periodicamente
    useEffect(() => {
        if (isOpen) return; // Não mostrar quando o chat está aberto

        const showRandomPhrase = () => {
            if (isOpen) return; // Não mostrar se o chat estiver aberto
            const randomPhrase = coinzinhaPhrases[Math.floor(Math.random() * coinzinhaPhrases.length)];
            setCurrentPhrase(randomPhrase);
            setShowBubble(true);

            // Esconder o balão após 10 segundos
            setTimeout(() => {
                setShowBubble(false);
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
            setDisplayedText('');
        };
    }, [isOpen]);

    // Efeito typewriter - digita o texto letra por letra
    useEffect(() => {
        if (!showBubble || !currentPhrase) {
            setDisplayedText('');
            setIsTyping(false);
            return;
        }

        setIsTyping(true);
        setDisplayedText('...');

        // Primeiro mostra os 3 pontinhos por 800ms
        const dotsTimeout = setTimeout(() => {
            setDisplayedText('');

            let currentIndex = 0;
            const typeInterval = setInterval(() => {
                if (currentIndex < currentPhrase.length) {
                    setDisplayedText(currentPhrase.slice(0, currentIndex + 1));
                    currentIndex++;
                } else {
                    setIsTyping(false);
                    clearInterval(typeInterval);
                }
            }, 35); // 35ms por caractere

            // Guardar referência para cleanup
            (window as any).__coinzinhaTypeInterval = typeInterval;
        }, 800);

        return () => {
            clearTimeout(dotsTimeout);
            if ((window as any).__coinzinhaTypeInterval) {
                clearInterval((window as any).__coinzinhaTypeInterval);
            }
        };
    }, [showBubble, currentPhrase]);

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
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node) && isOpen) {
                // Manter comportamento se desejado, ou remover
            }
        }
        document.addEventListener("mousedown", clickOutsideHandler)
        return () => document.removeEventListener("mousedown", clickOutsideHandler)
    }, [isOpen]);

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

        if (userPlan === 'starter' && starterMessageCount >= 3) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'ai',
                type: 'text',
                content: '🔒 Você atingiu o limite de mensagens do plano Starter. Faça o upgrade para o plano Pro para ter acesso ilimitado ao Consultor IA.',
                timestamp: Date.now()
            }]);
            setInputValue('');
            return;
        }

        const userText = inputValue;
        setInputValue('');

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

            // Construir histórico de conversa para o Claude
            const conversationHistory = messages
                .filter(m => m.type === 'text' && m.content)
                .map(m => ({
                    role: m.role === 'user' ? 'user' as const : 'assistant' as const,
                    content: m.content || ''
                }));

            processClaudeAssistantMessage(text, transactions, budgets, investments, conversationHistory).then(response => {
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

    return (
        <div className="fixed bottom-0 right-6 z-50 flex items-center justify-center">
            {/* Speech Bubble - Typewriter effect com surgimento do Coinzinha */}
            <AnimatePresence>
                {!isOpen && showBubble && currentPhrase && (
                    <motion.div
                        initial={{
                            opacity: 0,
                            scaleY: 0,
                            scaleX: 0.5,
                            y: 60
                        }}
                        animate={{
                            opacity: 1,
                            scaleY: 1,
                            scaleX: 1,
                            y: isHovered ? -24 : 8,
                        }}
                        exit={{
                            opacity: 0,
                            scaleY: 0,
                            scaleX: 0.5,
                            y: 40,
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
                            className="relative bg-[#2d2d2d] border border-[#3a3a3a] rounded-2xl px-4 py-2.5 shadow-2xl"
                            layout
                            transition={{
                                layout: {
                                    type: "spring",
                                    stiffness: 350,
                                    damping: 28
                                }
                            }}
                        >
                            <div className="text-sm text-gray-200 whitespace-nowrap flex items-center min-h-[20px]">
                                {displayedText === '...' ? (
                                    // Pontinhos animados
                                    <div className="flex gap-1">
                                        <motion.span
                                            animate={{ opacity: [0.3, 1, 0.3] }}
                                            transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                                            className="w-1.5 h-1.5 rounded-full bg-gray-400"
                                        />
                                        <motion.span
                                            animate={{ opacity: [0.3, 1, 0.3] }}
                                            transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                                            className="w-1.5 h-1.5 rounded-full bg-gray-400"
                                        />
                                        <motion.span
                                            animate={{ opacity: [0.3, 1, 0.3] }}
                                            transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                                            className="w-1.5 h-1.5 rounded-full bg-gray-400"
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <span>{displayedText}</span>
                                        {isTyping && (
                                            <motion.span
                                                animate={{ opacity: [1, 0] }}
                                                transition={{ duration: 0.4, repeat: Infinity }}
                                                className="ml-0.5 inline-block w-[2px] h-4 bg-[#d97757]"
                                            />
                                        )}
                                    </>
                                )}
                            </div>
                            {/* Arrow pointing down-right - aponta para o Coinzinha */}
                            <div className="absolute -bottom-2 right-[20px] w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px] border-t-[#3a3a3a]" />
                            <div className="absolute -bottom-[7px] right-[21px] w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[9px] border-t-[#2d2d2d]" />
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
                    width: isOpen ? OPEN_WIDTH : 56,
                    height: isOpen ? OPEN_HEIGHT : 56,
                    borderRadius: isOpen ? 16 : 28,
                    y: isOpen ? -24 : (isHovered ? -24 : 32),
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
                                        onClick={() => setIsOpen(false)}
                                        className="p-2 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                        title="Fechar"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Content Area */}
                            <div className="relative flex-1 bg-[#30302E] overflow-hidden">
                                {/* Chat View */}
                                <div className={`absolute inset-0 flex flex-col transition-opacity duration-300 ${view === 'chat' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                                    {/* Messages */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar overflow-x-hidden">
                                        {messages.map((msg) => (
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
                                                            <BlurredStagger text={msg.content || ''} className="whitespace-pre-wrap break-words" />
                                                        ) : (
                                                            <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                                                        )}
                                                        <p className={`text-[10px] mt-1 text-right opacity-60 ${msg.role === 'user' ? 'text-white' : 'text-gray-400'}`}>
                                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                ) : msg.type === 'transaction_confirm' ? (
                                                    /* Single Transaction Card - Redesigned */
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                                        className="w-full max-w-[300px] bg-gradient-to-br from-[#2d2d2d] to-[#252525] border border-[#3a3a3a] rounded-2xl rounded-tl-sm overflow-hidden shadow-xl"
                                                    >
                                                        {/* Header */}
                                                        <div className="bg-gradient-to-r from-[#d97757]/20 to-transparent p-3 border-b border-[#3a3a3a] flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-[#d97757]/20 flex items-center justify-center">
                                                                <Sparkles size={14} className="text-[#d97757]" />
                                                            </div>
                                                            <div>
                                                                <span className="text-xs font-bold text-white uppercase tracking-wider">Nova Transação</span>
                                                                <p className="text-[10px] text-gray-400">{msg.transactionData?.type === 'income' ? '💰 Receita' : '💸 Despesa'}</p>
                                                            </div>
                                                        </div>

                                                        {/* Amount - Hero */}
                                                        <div className="p-4 text-center border-b border-[#3a3a3a]/50">
                                                            <p className="text-gray-400 text-xs mb-1">Valor</p>
                                                            <motion.p
                                                                initial={{ scale: 0.8 }}
                                                                animate={{ scale: 1 }}
                                                                className={`text-3xl font-bold tracking-tight ${msg.transactionData?.type === 'income' ? 'text-green-400' : 'text-[#d97757]'}`}
                                                            >
                                                                R$ {msg.transactionData?.amount.toFixed(2)}
                                                            </motion.p>
                                                        </div>

                                                        {/* Details */}
                                                        <div className="p-4 space-y-3">
                                                            <motion.div
                                                                initial={{ opacity: 0, x: -10 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: 0.1 }}
                                                                className="flex items-center gap-3"
                                                            >
                                                                <div className="w-8 h-8 rounded-lg bg-[#3a3a3a] flex items-center justify-center shrink-0">
                                                                    <Tag size={14} className="text-[#d97757]" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-[10px] text-gray-500 uppercase">Categoria</p>
                                                                    <p className="text-sm text-gray-200 font-medium truncate">{msg.transactionData?.category}</p>
                                                                </div>
                                                            </motion.div>

                                                            <motion.div
                                                                initial={{ opacity: 0, x: -10 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: 0.15 }}
                                                                className="flex items-center gap-3"
                                                            >
                                                                <div className="w-8 h-8 rounded-lg bg-[#3a3a3a] flex items-center justify-center shrink-0">
                                                                    <Calendar size={14} className="text-blue-400" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-[10px] text-gray-500 uppercase">Data</p>
                                                                    <p className="text-sm text-gray-200 font-medium">{msg.transactionData?.date}</p>
                                                                </div>
                                                            </motion.div>

                                                            <motion.div
                                                                initial={{ opacity: 0, x: -10 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: 0.2 }}
                                                                className="flex items-start gap-3"
                                                            >
                                                                <div className="w-8 h-8 rounded-lg bg-[#3a3a3a] flex items-center justify-center shrink-0 mt-0.5">
                                                                    <MessageSquare size={14} className="text-purple-400" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-[10px] text-gray-500 uppercase">Descrição</p>
                                                                    <p className="text-sm text-gray-200 font-medium">{msg.transactionData?.description}</p>
                                                                </div>
                                                            </motion.div>
                                                        </div>

                                                        {/* Action Button */}
                                                        <div className="p-3 border-t border-[#3a3a3a]/50">
                                                            {!msg.isConfirmed ? (
                                                                <motion.button
                                                                    whileHover={{ scale: 1.02 }}
                                                                    whileTap={{ scale: 0.98 }}
                                                                    onClick={() => msg.transactionData && handleConfirmTransaction(msg.id, msg.transactionData)}
                                                                    className="w-full bg-gradient-to-r from-[#d97757] to-[#c56a4d] hover:from-[#e58567] hover:to-[#d97757] text-white py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#d97757]/20 flex items-center justify-center"
                                                                >
                                                                    Confirmar Lançamento
                                                                </motion.button>
                                                            ) : (
                                                                <div className="w-full bg-green-500/10 text-green-400 py-3 rounded-xl text-sm font-bold flex items-center justify-center border border-green-500/20">
                                                                    Lançado com Sucesso
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
                                                        className="w-full max-w-[320px] bg-gradient-to-br from-[#2d2d2d] to-[#252525] border border-[#3a3a3a] rounded-2xl rounded-tl-sm overflow-hidden shadow-xl"
                                                    >
                                                        {/* Header */}
                                                        <div className="bg-gradient-to-r from-[#d97757]/20 via-[#d97757]/10 to-transparent p-3 border-b border-[#3a3a3a] flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-[#d97757]/20 flex items-center justify-center">
                                                                <Sparkles size={14} className="text-[#d97757]" />
                                                            </div>
                                                            <div className="flex-1">
                                                                <span className="text-xs font-bold text-white uppercase tracking-wider">Múltiplas Transações</span>
                                                                <p className="text-[10px] text-gray-400">Detectei {msg.multipleTransactions?.length || 0} itens</p>
                                                            </div>
                                                        </div>

                                                        {/* Transactions List */}
                                                        <div className="p-3 space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                                                            {msg.multipleTransactions?.map((tx, idx) => (
                                                                <motion.div
                                                                    key={idx}
                                                                    initial={{ opacity: 0, x: -10 }}
                                                                    animate={{ opacity: 1, x: 0 }}
                                                                    transition={{ delay: idx * 0.1 }}
                                                                    className="flex items-center gap-3 p-2 rounded-lg bg-[#3a3a3a]/50 border border-[#454545]/50"
                                                                >
                                                                    <div className="w-8 h-8 rounded-lg bg-[#454545] flex items-center justify-center shrink-0 text-xs font-bold text-gray-300">
                                                                        {idx + 1}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm text-gray-200 font-medium truncate">{tx.description}</p>
                                                                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                                                            <span className="flex items-center gap-1">
                                                                                <Tag size={8} />
                                                                                {tx.category}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <span className="text-sm font-bold text-white shrink-0">
                                                                        R$ {tx.amount.toFixed(2)}
                                                                    </span>
                                                                </motion.div>
                                                            ))}
                                                        </div>

                                                        {/* Unified Suggestion */}
                                                        {msg.unifiedSuggestion && (
                                                            <div className="mx-3 mb-3 p-3 rounded-xl bg-[#d97757]/10 border border-[#d97757]/30">
                                                                <p className="text-[10px] text-[#d97757] uppercase mb-1 font-bold">💡 Sugestão unificada:</p>
                                                                <p className="text-sm text-gray-200 font-medium">{msg.unifiedSuggestion.description}</p>
                                                                <p className="text-lg font-bold text-white mt-1">R$ {msg.unifiedSuggestion.amount.toFixed(2)}</p>
                                                            </div>
                                                        )}

                                                        {/* Action Buttons */}
                                                        <div className="p-3 border-t border-[#3a3a3a]/50 space-y-2">
                                                            {!msg.isConfirmed ? (
                                                                <>
                                                                    <motion.button
                                                                        whileHover={{ scale: 1.02 }}
                                                                        whileTap={{ scale: 0.98 }}
                                                                        onClick={() => msg.multipleTransactions && handleConfirmSeparate(msg.id, msg.multipleTransactions)}
                                                                        className="w-full bg-[#3a3a3a] hover:bg-[#454545] text-white py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center border border-[#454545]"
                                                                    >
                                                                        Lançar Separadamente ({msg.multipleTransactions?.length})
                                                                    </motion.button>
                                                                    {msg.unifiedSuggestion && (
                                                                        <motion.button
                                                                            whileHover={{ scale: 1.02 }}
                                                                            whileTap={{ scale: 0.98 }}
                                                                            onClick={() => msg.unifiedSuggestion && handleConfirmUnified(msg.id, msg.unifiedSuggestion)}
                                                                            className="w-full bg-gradient-to-r from-[#d97757] to-[#c56a4d] hover:from-[#e58567] hover:to-[#d97757] text-white py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#d97757]/20 flex items-center justify-center"
                                                                        >
                                                                            Unificar em 1 Transação
                                                                        </motion.button>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <div className="w-full bg-green-500/10 text-green-400 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center border border-green-500/20">
                                                                    {msg.confirmedChoice === 'unified' ? 'Unificado com Sucesso!' : `${msg.multipleTransactions?.length} Lançados!`}
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
                                                        className="w-full max-w-[300px] bg-gradient-to-br from-[#2d2d2d] to-[#252525] border border-[#3a3a3a] rounded-2xl rounded-tl-sm overflow-hidden shadow-xl"
                                                    >
                                                        {/* Header */}
                                                        <div className="bg-gradient-to-r from-blue-500/20 to-transparent p-3 border-b border-[#3a3a3a] flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                                                                <Calendar size={14} className="text-blue-400" />
                                                            </div>
                                                            <div>
                                                                <span className="text-xs font-bold text-white uppercase tracking-wider">Novo Lembrete</span>
                                                                <p className="text-[10px] text-gray-400">
                                                                    {msg.reminderData?.type === 'income' ? 'Receita futura' : 'Despesa futura'} • {msg.reminderData?.isRecurring ? 'Recorrente' : 'Único'}
                                                                    {msg.reminderData?.isRecurring && msg.reminderData?.frequency ? ` • ${msg.reminderData.frequency === 'weekly' ? 'Semanal' : msg.reminderData.frequency === 'yearly' ? 'Anual' : 'Mensal'}` : ''}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Amount - Hero */}
                                                        <div className="p-4 text-center border-b border-[#3a3a3a]/50">
                                                            <p className="text-gray-400 text-xs mb-1">Valor</p>
                                                            <motion.p
                                                                initial={{ scale: 0.8 }}
                                                                animate={{ scale: 1 }}
                                                                className={`text-3xl font-bold tracking-tight ${msg.reminderData?.type === 'income' ? 'text-green-400' : 'text-blue-300'}`}
                                                            >
                                                                R$ {(msg.reminderData?.amount ?? 0).toFixed(2)}
                                                            </motion.p>
                                                        </div>

                                                        {/* Details */}
                                                        <div className="p-4 space-y-3">
                                                            <motion.div
                                                                initial={{ opacity: 0, x: -10 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: 0.1 }}
                                                                className="flex items-start gap-3"
                                                            >
                                                                <div className="w-8 h-8 rounded-lg bg-[#3a3a3a] flex items-center justify-center shrink-0 mt-0.5">
                                                                    <MessageSquare size={14} className="text-blue-400" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-[10px] text-gray-500 uppercase">Descrição</p>
                                                                    <p className="text-sm text-gray-200 font-medium">{msg.reminderData?.description}</p>
                                                                </div>
                                                            </motion.div>

                                                            <motion.div
                                                                initial={{ opacity: 0, x: -10 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: 0.15 }}
                                                                className="flex items-center gap-3"
                                                            >
                                                                <div className="w-8 h-8 rounded-lg bg-[#3a3a3a] flex items-center justify-center shrink-0">
                                                                    <Calendar size={14} className="text-blue-400" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-[10px] text-gray-500 uppercase">Vencimento</p>
                                                                    <p className="text-sm text-gray-200 font-medium">{msg.reminderData?.dueDate}</p>
                                                                </div>
                                                            </motion.div>

                                                            <motion.div
                                                                initial={{ opacity: 0, x: -10 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: 0.2 }}
                                                                className="flex items-center gap-3"
                                                            >
                                                                <div className="w-8 h-8 rounded-lg bg-[#3a3a3a] flex items-center justify-center shrink-0">
                                                                    <Tag size={14} className="text-blue-400" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-[10px] text-gray-500 uppercase">Categoria</p>
                                                                    <p className="text-sm text-gray-200 font-medium truncate">{msg.reminderData?.category}</p>
                                                                </div>
                                                            </motion.div>

                                                            {msg.reminderData?.isRecurring && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, x: -10 }}
                                                                    animate={{ opacity: 1, x: 0 }}
                                                                    transition={{ delay: 0.25 }}
                                                                    className="flex items-center gap-3"
                                                                >
                                                                    <div className="w-8 h-8 rounded-lg bg-[#3a3a3a] flex items-center justify-center shrink-0">
                                                                        <Clock size={14} className="text-blue-400" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-[10px] text-gray-500 uppercase">Recorrência</p>
                                                                        <p className="text-sm text-gray-200 font-medium">
                                                                            {msg.reminderData.frequency === 'weekly' ? 'Semanal' : msg.reminderData.frequency === 'yearly' ? 'Anual' : 'Mensal'}
                                                                        </p>
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </div>

                                                        <div className="p-3 border-t border-[#3a3a3a]/50">
                                                            {!msg.isConfirmed ? (
                                                                <motion.button
                                                                    whileHover={{ scale: 1.02 }}
                                                                    whileTap={{ scale: 0.98 }}
                                                                    onClick={() => msg.reminderData && handleConfirmReminder(msg.id, msg.reminderData)}
                                                                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center"
                                                                >
                                                                    Confirmar Lembrete
                                                                </motion.button>
                                                            ) : (
                                                                <div className="w-full bg-green-500/10 text-green-400 py-3 rounded-xl text-sm font-bold flex items-center justify-center border border-green-500/20">
                                                                    Lembrete Criado
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
                                                        className="w-full max-w-[300px] bg-gradient-to-br from-[#2d2d2d] to-[#252525] border border-[#3a3a3a] rounded-2xl rounded-tl-sm overflow-hidden shadow-xl"
                                                    >
                                                        {/* Header */}
                                                        <div className="bg-gradient-to-r from-purple-500/20 to-transparent p-3 border-b border-[#3a3a3a] flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                                                                <Clock size={14} className="text-purple-400" />
                                                            </div>
                                                            <div>
                                                                <span className="text-xs font-bold text-white uppercase tracking-wider">Nova Assinatura</span>
                                                                <p className="text-[10px] text-gray-400">{msg.subscriptionData?.billingCycle === 'monthly' ? 'Mensal' : 'Anual'}</p>
                                                            </div>
                                                        </div>

                                                        {/* Amount - Hero */}
                                                        <div className="p-4 text-center border-b border-[#3a3a3a]/50">
                                                            <p className="text-gray-400 text-xs mb-1">Valor</p>
                                                            <motion.p
                                                                initial={{ scale: 0.8 }}
                                                                animate={{ scale: 1 }}
                                                                className="text-3xl font-bold tracking-tight text-purple-300"
                                                            >
                                                                R$ {(msg.subscriptionData?.amount ?? 0).toFixed(2)}/{msg.subscriptionData?.billingCycle === 'monthly' ? 'mês' : 'ano'}
                                                            </motion.p>
                                                        </div>

                                                        {/* Details */}
                                                        <div className="p-4 space-y-3">
                                                            <motion.div
                                                                initial={{ opacity: 0, x: -10 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: 0.1 }}
                                                                className="flex items-start gap-3"
                                                            >
                                                                <div className="w-8 h-8 rounded-lg bg-[#3a3a3a] flex items-center justify-center shrink-0 mt-0.5">
                                                                    <MessageSquare size={14} className="text-purple-400" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-[10px] text-gray-500 uppercase">Serviço</p>
                                                                    <p className="text-sm text-gray-200 font-medium">{msg.subscriptionData?.name}</p>
                                                                </div>
                                                            </motion.div>

                                                            <motion.div
                                                                initial={{ opacity: 0, x: -10 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: 0.15 }}
                                                                className="flex items-center gap-3"
                                                            >
                                                                <div className="w-8 h-8 rounded-lg bg-[#3a3a3a] flex items-center justify-center shrink-0">
                                                                    <Tag size={14} className="text-purple-400" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-[10px] text-gray-500 uppercase">Categoria</p>
                                                                    <p className="text-sm text-gray-200 font-medium truncate">{msg.subscriptionData?.category}</p>
                                                                </div>
                                                            </motion.div>

                                                            <motion.div
                                                                initial={{ opacity: 0, x: -10 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: 0.2 }}
                                                                className="flex items-center gap-3"
                                                            >
                                                                <div className="w-8 h-8 rounded-lg bg-[#3a3a3a] flex items-center justify-center shrink-0">
                                                                    <Clock size={14} className="text-purple-400" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-[10px] text-gray-500 uppercase">Ciclo</p>
                                                                    <p className="text-sm text-gray-200 font-medium">{msg.subscriptionData?.billingCycle === 'monthly' ? 'Mensal' : 'Anual'}</p>
                                                                </div>
                                                            </motion.div>
                                                        </div>

                                                        <div className="p-3 border-t border-[#3a3a3a]/50">
                                                            {!msg.isConfirmed ? (
                                                                <motion.button
                                                                    whileHover={{ scale: 1.02 }}
                                                                    whileTap={{ scale: 0.98 }}
                                                                    onClick={() => msg.subscriptionData && handleConfirmSubscription(msg.id, msg.subscriptionData)}
                                                                    className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center"
                                                                >
                                                                    Confirmar Assinatura
                                                                </motion.button>
                                                            ) : (
                                                                <div className="w-full bg-green-500/10 text-green-400 py-3 rounded-xl text-sm font-bold flex items-center justify-center border border-green-500/20">
                                                                    Assinatura Criada
                                                                </div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                ) : null}
                                            </div>
                                        ))}

                                        {isThinking && (
                                            <div className="flex justify-start">
                                                <div className="bg-[#313131] border border-[#3a3a3a] rounded-2xl rounded-tl-sm p-4 flex items-center">
                                                    <TextShimmer className='font-medium text-sm' duration={1.5}>
                                                        Pensando...
                                                    </TextShimmer>
                                                </div>
                                            </div>
                                        )}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* Input Area */}
                                    < div className="p-3 bg-[#333432] border-t border-[#3a3a3a] shrink-0" >
                                        {/* Quick Actions - Scroll horizontal com indicador */}
                                        {
                                            messages.length < 3 && (
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

                                        < div className="flex items-center gap-2 bg-[#2D2D2D] border border-[#3a3a3a] rounded-xl px-3 py-2.5 focus-within:border-[#d97757] focus-within:ring-1 focus-within:ring-[#d97757]/50 transition-all" >
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
                                <div className={`absolute inset-0 bg-[#30302E] flex flex-col transition-opacity duration-300 ${view === 'history' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                                    <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
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

                                    <div className="mt-auto p-4 border-t border-gray-800 shrink-0">
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
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div >
        </div >
    );
};
