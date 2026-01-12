
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, MessageSquare, User, Shield, Zap, Copy, MessageSquarePlus, Check } from './Icons';
import * as dbService from '../services/database';
import { SupportMessage, SupportTicket, submitTicketRating, listenToTicket } from '../services/database';
import { getAvatarColors, getInitials } from '../utils/avatarUtils';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator } from './Dropdown';
import { toast } from 'sonner';
import { Star, ArrowRightLeft } from 'lucide-react';

// Star Rating Component
const StarRating: React.FC<{ onRate: (rating: number) => void; isSubmitting: boolean }> = ({ onRate, isSubmitting }) => {
    const [hoveredStar, setHoveredStar] = useState<number | null>(null);
    const [selectedStar, setSelectedStar] = useState<number | null>(null);

    const handleClick = (rating: number) => {
        setSelectedStar(rating);
        onRate(rating);
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-6 px-4 bg-gradient-to-b from-[#373734] to-[#30302E] rounded-2xl border border-[#454543] mx-4 my-4 shadow-xl"
        >
            <div className="text-center mb-4">
                <h3 className="text-white font-bold text-lg mb-1">Como foi o atendimento?</h3>
                <p className="text-gray-400 text-sm">Sua avaliação nos ajuda a melhorar!</p>
            </div>

            <div className="flex gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                    <motion.button
                        key={star}
                        disabled={isSubmitting}
                        onMouseEnter={() => setHoveredStar(star)}
                        onMouseLeave={() => setHoveredStar(null)}
                        onClick={() => handleClick(star)}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        className={`p-2 transition-all duration-200 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        <Star
                            size={32}
                            className={`transition-all duration-200 ${(hoveredStar !== null && star <= hoveredStar) || (selectedStar !== null && star <= selectedStar)
                                ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]'
                                : 'text-gray-600'
                                }`}
                        />
                    </motion.button>
                ))}
            </div>

            <p className="text-gray-500 text-xs">
                {hoveredStar === 1 ? 'Péssimo' :
                    hoveredStar === 2 ? 'Ruim' :
                        hoveredStar === 3 ? 'Regular' :
                            hoveredStar === 4 ? 'Bom' :
                                hoveredStar === 5 ? 'Excelente!' : 'Clique em uma estrela'}
            </p>

            {isSubmitting && (
                <div className="mt-2 flex items-center gap-2 text-gray-400 text-sm">
                    <div className="w-4 h-4 border-2 border-[#d97757] border-t-transparent rounded-full animate-spin" />
                    Enviando...
                </div>
            )}
        </motion.div>
    );
};

// Ticket Closed Message Component
const TicketClosedMessage: React.FC<{ rating?: number }> = ({ rating }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center py-4"
    >
        <div className="bg-[#373734] text-gray-400 text-xs px-4 py-2 rounded-full border border-[#454543] flex items-center gap-2">
            <Check size={14} className="text-emerald-500" />
            Atendimento finalizado
            {rating !== undefined && (
                <span className="flex items-center gap-1 ml-1 text-yellow-400">
                    <Star size={12} fill="currentColor" /> {rating}
                </span>
            )}
        </div>
    </motion.div>
);

interface SupportChatProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    userEmail: string;
    userName: string;
    isAdmin?: boolean; // If true, acts as admin viewing a ticket (logic might differ slightly or be reused)
    ticketIdProp?: string; // For admin mode to view specific ticket
    variant?: 'sidebar' | 'embedded';
    sidebarOpen?: boolean; // Prop to know if sidebar is expanded (for positioning)
    onTerminate?: () => void;
    onTransfer?: () => void;
}

export const SupportChat: React.FC<SupportChatProps> = ({
    isOpen, onClose, userId, userEmail, userName, isAdmin = false, ticketIdProp, variant = 'sidebar', sidebarOpen = true, onTerminate, onTransfer
}) => {
    const [activeTicketId, setActiveTicketId] = useState<string | null>(ticketIdProp || null);
    const [messages, setMessages] = useState<SupportMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [ticket, setTicket] = useState<SupportTicket | null>(null);
    const [isSubmittingRating, setIsSubmittingRating] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const lastEmailSentRef = useRef<number>(0); // Track last email sent timestamp

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'; // Reset height
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`; // Limit max height in effect too if needed, but maxHeight CSS handles overflow
        }
    }, [newMessage]);

    // For User: listen to active ticket if not provided
    useEffect(() => {
        if (isAdmin && ticketIdProp) {
            setActiveTicketId(ticketIdProp);
            return;
        }

        if (!isAdmin && userId) {
            const unsubscribe = dbService.getUserActiveTicket(userId, (ticketId) => {
                setActiveTicketId(ticketId);
            });
            return () => unsubscribe();
        }
    }, [userId, isAdmin, ticketIdProp]);

    // Listen to ticket status (for awaitingRating flag)
    useEffect(() => {
        if (!activeTicketId) {
            setTicket(null);
            return;
        }

        const unsubscribe = listenToTicket(activeTicketId, (ticketData) => {
            setTicket(ticketData);
        });
        return () => unsubscribe();
    }, [activeTicketId]);

    // Listen to messages when we have a ticket ID
    useEffect(() => {
        if (!activeTicketId) {
            setMessages([]);
            return;
        }

        const unsubscribe = dbService.listenToTicketMessages(activeTicketId, (msgs) => {
            setMessages(msgs);
            scrollToBottom();

            // If chat is open, mark messages as read
            if (isOpen) {
                dbService.markMessagesAsRead(activeTicketId, isAdmin ? 'admin' : 'user');
            }
        });
        return () => unsubscribe();
    }, [activeTicketId, isOpen, isAdmin]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleSubmitRating = async (rating: number) => {
        if (!activeTicketId || isSubmittingRating) return;

        setIsSubmittingRating(true);
        try {
            await submitTicketRating(activeTicketId, rating);
            toast.success('Obrigado pela sua avaliação!');
        } catch (error) {
            console.error('Error submitting rating:', error);
            toast.error('Erro ao enviar avaliação');
        } finally {
            setIsSubmittingRating(false);
        }
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() || isLoading) return;
        setIsLoading(true);

        try {
            let ticketId = activeTicketId;

            // Create ticket if none exists (only for user)
            if (!ticketId && !isAdmin) {
                ticketId = await dbService.createSupportTicket(userId, userEmail, userName) || null;
                setActiveTicketId(ticketId);
            }

            if (ticketId) {
                await dbService.sendSupportMessage(ticketId, {
                    text: newMessage,
                    senderId: isAdmin ? 'admin' : userId,
                    senderType: isAdmin ? 'admin' : 'user',
                    createdAt: new Date().toISOString()
                });

                // Send Email Notification if Admin (with debounce to avoid multiple emails)
                if (isAdmin) {
                    const now = Date.now();
                    const EMAIL_DEBOUNCE_MS = 60000; // 60 seconds debounce

                    // Only send email if 60 seconds passed since last email
                    if (now - lastEmailSentRef.current > EMAIL_DEBOUNCE_MS) {
                        lastEmailSentRef.current = now;

                        // Non-blocking email send
                        fetch('/api/admin/send-email', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                recipients: [userEmail],
                                subject: 'Nova resposta no suporte - Controlar+',
                                title: 'Suporte Controlar+',
                                body: `Ola ${userName},\n\nVoce tem uma nova mensagem do suporte esperando por voce no app.\n\nAcesse para visualizar e responder.`,
                                buttonText: 'Ver Mensagem',
                                buttonLink: 'https://www.controlarmais.com.br/',
                                headerAlign: 'center',
                                titleAlign: 'center',
                                bodyAlign: 'left'
                            })
                        }).catch(err => console.error("Failed to send support notification email:", err));
                    }
                }

                setNewMessage('');
            }
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Identify attending admin from messages OR ticket assignment
    const [attendingAdmin, setAttendingAdmin] = useState<{ name: string; avatar?: string } | null>(null);

    // 1. Listen to Ticket Assignment (Primary Source)
    useEffect(() => {
        if (!activeTicketId) return;

        const unsub = dbService.listenToTicket(activeTicketId, (ticket) => {
            if (ticket?.assignedTo) {
                // If assigned, fetch that admin's profile
                dbService.getUserProfile(ticket.assignedTo).then(profile => {
                    if (profile) {
                        setAttendingAdmin({
                            name: profile.name || ticket.assignedByName || 'Suporte',
                            avatar: profile.avatarUrl
                        });
                    } else if (ticket.assignedByName) {
                        // Fallback to name in ticket if profile fail
                        setAttendingAdmin({ name: ticket.assignedByName });
                    }
                });
            } else {
                // If NOT assigned, check messages (Secondary Source)
                // This covers legacy cases or unassigned-but-replied tickets
                const lastAdminMsg = [...messages].reverse().find(m => m.senderType === 'admin');
                if (lastAdminMsg) {
                    dbService.getUserProfile(lastAdminMsg.senderId).then(profile => {
                        if (profile) {
                            setAttendingAdmin({
                                name: profile.name || 'Suporte',
                                avatar: profile.avatarUrl
                            });
                        }
                    });
                } else {
                    setAttendingAdmin(null);
                }
            }
        });

        return () => unsub();
    }, [activeTicketId, messages]); // Depend on messages to re-evaluate fallback if needed

    // Render content function to share between modes
    const renderContent = () => {
        const adminAvatarColors = attendingAdmin ? getAvatarColors(attendingAdmin.name) : { bg: 'bg-gray-700', text: 'text-gray-300' };
        const userAvatarColors = getAvatarColors(userName);

        return (
            <div className="flex flex-col h-full min-h-0 bg-[#30302E]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[#373734] bg-[#30302E] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            {isAdmin ? (
                                // Admin View: Show User Avatar
                                <div className={`w-10 h-10 rounded-full border border-[#454543] flex items-center justify-center font-bold text-sm ${userAvatarColors.bg} ${userAvatarColors.text}`}>
                                    {getInitials(userName)}
                                </div>
                            ) : attendingAdmin ? (
                                // User View: Show Admin Avatar
                                attendingAdmin.avatar ? (
                                    <img
                                        src={attendingAdmin.avatar}
                                        alt={attendingAdmin.name}
                                        className="w-10 h-10 rounded-full border border-[#373734] object-cover"
                                    />
                                ) : (
                                    <div className={`w-10 h-10 rounded-full border border-[#454543] flex items-center justify-center font-bold text-sm ${adminAvatarColors.bg} ${adminAvatarColors.text}`}>
                                        {getInitials(attendingAdmin.name)}
                                    </div>
                                )
                            ) : (
                                // Generic Icon when not attended
                                <div className="text-[#d97757]">
                                    <MessageSquare size={20} />
                                </div>
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-md">
                                {isAdmin ? userName : (attendingAdmin ? attendingAdmin.name : 'Suporte')}
                            </h3>
                            {!isAdmin ? (
                                <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <p className="text-xs text-gray-400">Online</p>
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400">{userEmail}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isAdmin && activeTicketId && (
                            <>
                                {/* Quick Actions & Tools */}
                                <Dropdown>
                                    <DropdownTrigger className="text-gray-500 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-colors border border-transparent hover:border-white/10">
                                        <Zap size={18} />
                                    </DropdownTrigger>
                                    <DropdownContent align="right" width="w-64" portal>
                                        <DropdownLabel>Respostas Rápidas</DropdownLabel>
                                        <DropdownItem
                                            icon={MessageSquarePlus}
                                            onClick={() => setNewMessage("Olá! Como posso ajudar você hoje?")}
                                        >
                                            Saudação
                                        </DropdownItem>
                                        <DropdownItem
                                            icon={MessageSquarePlus}
                                            onClick={() => setNewMessage("Vou verificar essa informação, só um momento.")}
                                        >
                                            Aguarde
                                        </DropdownItem>
                                        <DropdownItem
                                            icon={MessageSquarePlus}
                                            onClick={() => setNewMessage("Seu problema foi resolvido? Posso ajudar em algo mais?")}
                                        >
                                            Finalização
                                        </DropdownItem>

                                        <DropdownSeparator />
                                        <DropdownLabel>Ferramentas</DropdownLabel>
                                        <DropdownItem
                                            icon={Copy}
                                            onClick={() => {
                                                navigator.clipboard.writeText(userEmail);
                                                toast.success('Email copiado!');
                                            }}
                                        >
                                            Copiar Email
                                        </DropdownItem>
                                        <DropdownItem
                                            icon={Copy}
                                            onClick={() => {
                                                navigator.clipboard.writeText(userId);
                                                toast.success('ID copiado!');
                                            }}
                                        >
                                            Copiar ID
                                        </DropdownItem>

                                        {onTerminate && (
                                            <>
                                                <DropdownSeparator />
                                                <DropdownItem
                                                    onClick={onTerminate}
                                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                >
                                                    Encerrar Atendimento
                                                </DropdownItem>
                                            </>
                                        )}

                                        {onTransfer && (
                                            <>
                                                <DropdownSeparator />
                                                <DropdownItem
                                                    icon={ArrowRightLeft}
                                                    onClick={onTransfer}
                                                    className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                                >
                                                    Transferir Atendimento
                                                </DropdownItem>
                                            </>
                                        )}
                                    </DropdownContent>
                                </Dropdown>
                            </>
                        )}
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-white transition-colors p-1"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-[#30302E] custom-scrollbar">
                    {!activeTicketId && !isAdmin && (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50">
                            <MessageSquare size={32} className="text-gray-600" />
                            <p className="text-sm text-gray-500 max-w-[200px] leading-relaxed">
                                Como podemos ajudar você hoje?
                            </p>
                        </div>
                    )}

                    <AnimatePresence initial={false}>
                        {messages.map((msg) => {
                            const isMe = isAdmin ? msg.senderType === 'admin' : msg.senderType === 'user';
                            return (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ duration: 0.2 }}
                                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                                >
                                    <div
                                        className={`
                                        ${isAdmin ? 'max-w-[90%] text-base' : 'max-w-[85%] text-sm'} rounded-2xl px-4 py-2.5
                                        ${isMe
                                                ? 'bg-[#d97757] text-white'
                                                : 'bg-[#3d3d3b] text-gray-200'
                                            }
                                    `}
                                    >
                                        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                    </div>
                                    <span className="text-xs text-gray-600 mt-1 px-1">
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>

                    {/* Rating Component - Show when awaiting rating (user side only) */}
                    {!isAdmin && ticket?.awaitingRating && (
                        <StarRating onRate={handleSubmitRating} isSubmitting={isSubmittingRating} />
                    )}

                    {/* Closed Message - Show when ticket is closed */}
                    {ticket?.status === 'closed' && (
                        <TicketClosedMessage rating={ticket.rating} />
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area - Hide when awaiting rating or closed (for user) */}
                {(isAdmin || (!ticket?.awaitingRating && ticket?.status !== 'closed')) && (
                    <div className="p-4 bg-[#30302E] shrink-0">
                        <div className="relative flex items-center gap-2">
                            <textarea
                                ref={textareaRef}
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Digite sua mensagem..."
                                className={`w-full bg-[#3d3d3b] text-white placeholder:text-gray-600 border border-transparent focus:border-[#373734] rounded-xl px-4 py-3 focus:outline-none transition-all custom-scrollbar ${isAdmin ? 'text-base' : 'text-sm'}`}
                                rows={1}
                                style={{ minHeight: '44px', maxHeight: '200px', resize: 'none' }}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={!newMessage.trim() || isLoading}
                                className={`
                                p-2.5 rounded-xl transition-all shrink-0
                                ${!newMessage.trim() || isLoading
                                        ? 'text-gray-600 bg-[#3d3d3b]'
                                        : 'bg-white text-black hover:bg-gray-200'
                                    }
                            `}
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Variant logic
    const isEmbedded = variant === 'embedded';

    if (isEmbedded) {
        if (!isOpen) return null;
        return renderContent();
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop - Transparent on desktop to allow clicking outside, dim on mobile */}
                    <div
                        onClick={onClose}
                        className="fixed inset-0 z-[60] bg-transparent"
                    />

                    {/* Desktop Popover */}
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95, filter: "blur(10px)" }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: 20, scale: 0.95, filter: "blur(10px)" }}
                        transition={{ duration: 0.4, ease: "circInOut", type: "spring", stiffness: 200, damping: 20 }}
                        className={`
                            fixed z-[70]
                            bottom-6 right-6
                            w-[380px] h-[500px]
                            bg-[#30302E] border border-[#373734]
                            rounded-2xl shadow-2xl flex flex-col
                            hidden lg:flex
                        `}
                    >
                        <div className="w-full h-full overflow-hidden rounded-2xl bg-[#30302E]">
                            {renderContent()}
                        </div>
                    </motion.div>

                    {/* Mobile Drawer (Fallback) */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        className="fixed inset-y-0 right-0 w-full sm:w-[400px] z-[70] bg-[#30302E] border-l border-[#373734] lg:hidden flex flex-col shadow-2xl"
                    >
                        {renderContent()}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
