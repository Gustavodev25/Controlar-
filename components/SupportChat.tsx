
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, MessageSquare, User, Shield, Zap, Copy, MessageSquarePlus, Check } from './Icons';
import * as dbService from '../services/database';
import { SupportMessage } from '../services/database';
import { getAvatarColors, getInitials } from '../utils/avatarUtils';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator } from './Dropdown';
import { toast } from 'sonner';

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
}

export const SupportChat: React.FC<SupportChatProps> = ({
    isOpen, onClose, userId, userEmail, userName, isAdmin = false, ticketIdProp, variant = 'sidebar', sidebarOpen = true, onTerminate
}) => {
    const [activeTicketId, setActiveTicketId] = useState<string | null>(ticketIdProp || null);
    const [messages, setMessages] = useState<SupportMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

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
            <div className="flex flex-col h-full bg-[#30302E]">
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
                                                    icon={X}
                                                    onClick={onTerminate}
                                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                >
                                                    Encerrar Atendimento
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
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#30302E] custom-scrollbar">
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
                                        max-w-[85%] rounded-2xl px-4 py-2.5 text-sm
                                        ${isMe
                                                ? 'bg-[#d97757] text-white'
                                                : 'bg-[#3d3d3b] text-gray-200'
                                            }
                                    `}
                                    >
                                        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                    </div>
                                    <span className="text-[10px] text-gray-600 mt-1 px-1">
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-[#30302E] shrink-0">
                    <div className="relative flex items-center gap-2">
                        <textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Digite sua mensagem..."
                            className="w-full bg-[#3d3d3b] text-white placeholder:text-gray-600 border border-transparent focus:border-[#373734] rounded-xl px-4 py-3 text-sm focus:outline-none transition-all resize-none custom-scrollbar"
                            rows={1}
                            style={{ minHeight: '44px', maxHeight: '100px' }}
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
