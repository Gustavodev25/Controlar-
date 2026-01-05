import React, { useState, useEffect, useMemo } from 'react';
import { SupportTicket, listenToAllOpenTickets, closeSupportTicket, acceptSupportTicket, getAllUsers, createSupportTicket, cancelUserSubscription, refundUserPayment, sendSupportMessage, requestTicketRating, listenToClosedTickets, deleteSupportTicket } from '../services/database';
import { SupportChat } from './SupportChat';
import { MessageSquare, CheckCircle, Shield, X, User, Play, Plus, Search, Loader, AlertTriangle, Ban, CreditCard, Star, Archive, ArrowLeft, Trash2 } from 'lucide-react';
import { User as UserType } from '../types';
import { getAvatarColors, getInitials } from '../utils/avatarUtils';
import { UniversalModal } from './UniversalModal';
import { toast } from 'sonner';

interface AdminSupportProps {
    currentUser?: UserType;
}

export const AdminSupport: React.FC<AdminSupportProps> = ({ currentUser }) => {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [closedTickets, setClosedTickets] = useState<SupportTicket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [showTerminationModal, setShowTerminationModal] = useState(false);
    const [activeListTab, setActiveListTab] = useState<'open' | 'closed'>('open');

    // New Ticket / User Search State
    const [showNewTicketModal, setShowNewTicketModal] = useState(false);
    const [availableUsers, setAvailableUsers] = useState<UserType[]>([]);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [pendingTicketId, setPendingTicketId] = useState<string | null>(null);

    useEffect(() => {
        const unsub = listenToAllOpenTickets((data) => {
            setTickets(data);

            // Auto-select pending ticket if it appears
            if (pendingTicketId) {
                const found = data.find(t => t.id === pendingTicketId);
                if (found) {
                    setSelectedTicket(found);
                    setPendingTicketId(null);
                }
            }
        });
        return () => unsub();
    }, [pendingTicketId]);

    // Listen to closed tickets
    useEffect(() => {
        const unsub = listenToClosedTickets((data) => {
            setClosedTickets(data);
        });
        return () => unsub();
    }, []);

    // Update selected ticket real-time status if it changes in the list
    useEffect(() => {
        if (selectedTicket) {
            const allTickets = [...tickets, ...closedTickets];
            const updated = allTickets.find(t => t.id === selectedTicket.id);
            if (updated) setSelectedTicket(updated);
        }
    }, [tickets, closedTickets]);

    // Load users for the new ticket modal
    useEffect(() => {
        if (showNewTicketModal && availableUsers.length === 0) {
            setIsLoadingUsers(true);
            getAllUsers().then(users => {
                // Filter out current admin if desired, or keep all
                setAvailableUsers(users);
                setIsLoadingUsers(false);
            }).catch(err => {
                console.error("Error loading users", err);
                toast.error("Erro ao carregar usuários");
                setIsLoadingUsers(false);
            });
        }
    }, [showNewTicketModal]);

    const handleCloseTicket = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Fechar este chamado?')) {
            await closeSupportTicket(id);
            if (selectedTicket?.id === id) {
                setSelectedTicket(null);
            }
        }
    }

    const handleDeleteTicket = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Tem certeza que deseja EXCLUIR este chamado? Esta ação não pode ser desfeita.')) {
            try {
                await deleteSupportTicket(id);
                toast.success('Chamado excluído com sucesso.');
                if (selectedTicket?.id === id) {
                    setSelectedTicket(null);
                }
            } catch (error) {
                console.error(error);
                toast.error('Erro ao excluir chamado.');
            }
        }
    }

    const handleAcceptTicket = async () => {
        if (!selectedTicket || !currentUser || !currentUser.id) return;
        await acceptSupportTicket(selectedTicket.id!, currentUser.id, currentUser.name);
    };

    const handleStartNewTicket = async (user: UserType) => {
        if (!user.id) return;

        try {
            // Check if there's already an open ticket for this user in our current list
            const existingOpen = tickets.find(t => t.userId === user.id);
            if (existingOpen) {
                setSelectedTicket(existingOpen);
                setShowNewTicketModal(false);
                toast.info(`Já existe um chamado aberto para ${user.name}`);
                return;
            }

            // Create new ticket (or get existing if any logic on backend handles it)
            // Note: createSupportTicket logic on database.ts ensures distinct open tickets per user usually
            const ticketId = await createSupportTicket(user.id, user.email, user.name);

            if (ticketId) {
                setPendingTicketId(ticketId);
                // We'll rely on the listener to select it, helping with optimistic UI
                // But for immediate feedback:
                toast.success('Chamado iniciado!');
                setShowNewTicketModal(false);
            }
        } catch (error) {
            console.error(error);
            toast.error('Erro ao iniciar chamado');
        }
    };

    const filteredUsers = useMemo(() => {
        if (!userSearchTerm) return availableUsers.slice(0, 50); // Limit initial view
        const lower = userSearchTerm.toLowerCase();
        return availableUsers.filter(u =>
            (u.name || '').toLowerCase().includes(lower) ||
            (u.email || '').toLowerCase().includes(lower)
        ).slice(0, 50); // Limit results
    }, [availableUsers, userSearchTerm]);

    const getTimeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return 'agora';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
        return `${Math.floor(diffInSeconds / 86400)}d`;
    };

    const handleTerminate = async () => {
        if (!selectedTicket) return;

        try {
            // Mark ticket as awaiting rating - the user will see a star rating UI
            await requestTicketRating(selectedTicket.id!);

            toast.success('Solicitação de avaliação enviada! Aguardando resposta do usuário.');
            setShowTerminationModal(false);
            // Keep selectedTicket open to monitor user response
        } catch (error) {
            console.error(error);
            toast.error('Erro ao solicitar avaliação');
        }
    };

    const handleAdminCancelSubscription = async () => {
        if (!selectedTicket || !selectedTicket.userId) return;
        if (!confirm("Tem certeza que deseja cancelar a assinatura deste usuário?")) return;

        try {
            await cancelUserSubscription(selectedTicket.userId);
            toast.success("Assinatura cancelada com sucesso.");
            // Optionally auto-close ticket or add system message
        } catch (error) {
            console.error(error);
            toast.error("Erro ao cancelar assinatura.");
        }
    };

    const handleAdminRefund = async () => {
        if (!selectedTicket || !selectedTicket.userId) return;
        if (!confirm("Confirmar estorno do pagamento? Esta ação não pode ser desfeita.")) return;

        try {
            await refundUserPayment(selectedTicket.userId);
            toast.success("Estorno processado (simulado).");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao processar estorno.");
        }
    };

    // Mobile view state: show list or chat
    const isMobileView = typeof window !== 'undefined' && window.innerWidth < 1024;

    return (
        <div className="flex h-full w-full min-h-0 gap-0 lg:gap-4 overflow-hidden p-2 lg:p-4">
            {/* List - Hidden on mobile when ticket selected */}
            <div className={`
                ${selectedTicket ? 'hidden lg:flex' : 'flex'}
                w-full lg:w-[450px] flex-col shrink-0 bg-[#30302E] rounded-2xl border border-[#373734] overflow-hidden
            `}>
                <div className="p-3 lg:p-4 border-b border-[#373734] bg-[#30302E] flex items-center justify-between">
                    <h2 className="font-bold text-base lg:text-lg flex items-center gap-2 text-white">
                        <MessageSquare size={18} className="text-[#d97757]" />
                        Chamados
                    </h2>
                    <button
                        onClick={() => setShowNewTicketModal(true)}
                        className="p-1.5 rounded-lg bg-[#3d3d3b] hover:bg-[#454543] text-gray-300 hover:text-white transition-colors"
                        title="Novo Atendimento"
                    >
                        <Plus size={16} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[#373734]">
                    <button
                        onClick={() => setActiveListTab('open')}
                        className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeListTab === 'open'
                            ? 'text-white bg-[#373734] border-b-2 border-[#d97757]'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-[#373734]/30'
                            }`}
                    >
                        <MessageSquare size={14} />
                        Abertos
                        <span className="text-xs bg-[#454543] px-1.5 py-0.5 rounded-full">{tickets.length}</span>
                    </button>
                    <button
                        onClick={() => setActiveListTab('closed')}
                        className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeListTab === 'closed'
                            ? 'text-white bg-[#373734] border-b-2 border-[#d97757]'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-[#373734]/30'
                            }`}
                    >
                        <Archive size={14} />
                        Finalizados
                        <span className="text-xs bg-[#454543] px-1.5 py-0.5 rounded-full">{closedTickets.length}</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 bg-[#30302E]">
                    {activeListTab === 'open' && tickets.length === 0 && (
                        <div className="py-12 text-center text-gray-500 flex flex-col items-center">
                            <div className="w-16 h-16 rounded-full bg-[#373734] flex items-center justify-center mb-3 border border-[#454543]">
                                <CheckCircle size={24} className="opacity-30" />
                            </div>
                            <span className="text-sm font-medium">Tudo limpo por aqui!</span>
                            <span className="text-xs opacity-60 mt-1">Nenhum chamado pendente.</span>
                        </div>
                    )}

                    {activeListTab === 'closed' && closedTickets.length === 0 && (
                        <div className="py-12 text-center text-gray-500 flex flex-col items-center">
                            <div className="w-16 h-16 rounded-full bg-[#373734] flex items-center justify-center mb-3 border border-[#454543]">
                                <Archive size={24} className="opacity-30" />
                            </div>
                            <span className="text-sm font-medium">Nenhum atendimento finalizado</span>
                            <span className="text-xs opacity-60 mt-1">Os chamados fechados aparecerão aqui.</span>
                        </div>
                    )}

                    {/* Open Tickets */}
                    {activeListTab === 'open' && tickets.map(ticket => {
                        const isSelected = selectedTicket?.id === ticket.id;
                        const isUnassigned = !ticket.assignedTo;
                        const userAvatarColors = getAvatarColors(ticket.userName || 'User');
                        const timeAgo = getTimeAgo(ticket.lastMessageAt);

                        return (
                            <div
                                key={ticket.id}
                                onClick={() => setSelectedTicket(ticket)}
                                className={`
                                    p-5 rounded-xl cursor-pointer transition-all duration-200 group relative border
                                    ${isSelected
                                        ? 'bg-[#373734] border-[#d97757] shadow-[0_0_15px_-3px_rgba(217,119,87,0.15)]'
                                        : 'bg-[#373734]/50 border-transparent hover:border-[#454543] hover:bg-[#373734]'
                                    }
                                `}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${userAvatarColors.bg} ${userAvatarColors.text} ring-2 ring-[#30302E]`}>
                                            {getInitials(ticket.userName || 'User')}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className={`font-semibold text-sm truncate ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                                                {ticket.userName || 'Usuário'}
                                            </span>
                                            <span className="text-xs text-gray-500 truncate">{ticket.userEmail}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => handleDeleteTicket(e, ticket.id!)}
                                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-black/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                            title="Excluir Chamado"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                        <span className="text-[10px] font-medium text-gray-400 bg-[#373734] px-1.5 py-0.5 rounded whitespace-nowrap">
                                            {timeAgo}
                                        </span>
                                    </div>
                                </div>

                                <div className="pl-[52px] flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {ticket.type === 'cancellation_request' && (
                                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                                                CANCELAMENTO
                                            </span>
                                        )}
                                        {ticket.awaitingRating ? (
                                            <span className="flex items-center gap-1.5 text-[10px] font-medium text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20">
                                                <Star size={10} fill="currentColor" />
                                                Aguardando Avaliação
                                            </span>
                                        ) : isUnassigned ? (
                                            <span className="flex items-center gap-1.5 text-[10px] font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                                Novo
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                Em Andamento
                                            </span>
                                        )}
                                    </div>
                                    {ticket.unreadCount && ticket.unreadCount > 0 && (
                                        <div className="w-5 h-5 rounded-full bg-[#d97757] flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-orange-900/20">
                                            {ticket.unreadCount}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Closed Tickets */}
                    {activeListTab === 'closed' && closedTickets.map(ticket => {
                        const isSelected = selectedTicket?.id === ticket.id;
                        const userAvatarColors = getAvatarColors(ticket.userName || 'User');
                        const closedDate = ticket.ratedAt || ticket.lastMessageAt;

                        return (
                            <div
                                key={ticket.id}
                                onClick={() => setSelectedTicket(ticket)}
                                className={`
                                    p-5 rounded-xl cursor-pointer transition-all duration-200 group relative border
                                    ${isSelected
                                        ? 'bg-[#373734] border-[#d97757] shadow-[0_0_15px_-3px_rgba(217,119,87,0.15)]'
                                        : 'bg-[#373734]/50 border-transparent hover:border-[#454543] hover:bg-[#373734]'
                                    }
                                `}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${userAvatarColors.bg} ${userAvatarColors.text} ring-2 ring-[#30302E] opacity-70`}>
                                            {getInitials(ticket.userName || 'User')}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className={`font-semibold text-sm truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                                {ticket.userName || 'Usuário'}
                                            </span>
                                            <span className="text-xs text-gray-500 truncate">{ticket.userEmail}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => handleDeleteTicket(e, ticket.id!)}
                                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-black/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                            title="Excluir Chamado"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                        <span className="text-[10px] font-medium text-gray-500 bg-[#373734] px-1.5 py-0.5 rounded whitespace-nowrap">
                                            {new Date(closedDate).toLocaleDateString('pt-BR')}
                                        </span>
                                    </div>
                                </div>

                                <div className="pl-[52px] flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {/* Rating Badge */}
                                        {ticket.rating !== undefined ? (
                                            <span className="flex items-center gap-1 text-[10px] font-medium text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        size={10}
                                                        className={i < ticket.rating! ? 'fill-yellow-400' : 'fill-gray-600 text-gray-600'}
                                                    />
                                                ))}
                                                <span className="ml-1">{ticket.rating}/5</span>
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500 bg-gray-500/10 px-2 py-0.5 rounded-full border border-gray-500/20">
                                                Sem avaliação
                                            </span>
                                        )}
                                    </div>
                                    <span className="flex items-center gap-1 text-[10px] text-gray-500">
                                        <CheckCircle size={12} />
                                        Finalizado
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Chat View - Full screen on mobile when ticket selected */}
            <div className={`
                ${selectedTicket ? 'flex' : 'hidden lg:flex'}
                flex-1 min-h-0 bg-[#30302E] relative flex-col rounded-2xl overflow-hidden border border-[#373734]
                ${selectedTicket ? 'w-full' : ''}
            `}>
                {selectedTicket ? (
                    <div className="h-full min-h-0 flex flex-col relative bg-[#30302E]">
                        {/* Mobile Back Button Header */}
                        <div className="lg:hidden flex items-center gap-3 p-3 border-b border-[#373734] bg-[#30302E]">
                            <button
                                onClick={() => setSelectedTicket(null)}
                                className="p-2 rounded-xl bg-[#373734] hover:bg-[#454543] text-gray-300 hover:text-white transition-colors"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${getAvatarColors(selectedTicket.userName || 'User').bg} ${getAvatarColors(selectedTicket.userName || 'User').text}`}>
                                    {getInitials(selectedTicket.userName || 'User')}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="font-semibold text-sm text-white truncate">
                                        {selectedTicket.userName || 'Usuário'}
                                    </span>
                                    <span className="text-xs text-gray-500 truncate">{selectedTicket.userEmail}</span>
                                </div>
                            </div>
                            {selectedTicket.assignedTo && (
                                <span className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full border ${selectedTicket.awaitingRating
                                    ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                                    : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                    }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${selectedTicket.awaitingRating ? 'bg-yellow-500' : 'bg-emerald-500'}`} />
                                    {selectedTicket.awaitingRating ? 'Avaliação' : 'Ativo'}
                                </span>
                            )}
                        </div>

                        {/* Assignment Banner - relative on mobile, absolute on desktop */}
                        {!selectedTicket.assignedTo && (
                            <div className="relative lg:absolute inset-x-0 lg:top-0 z-20 bg-blue-500/10 backdrop-blur-md border-b border-blue-500/20 p-2 lg:p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-lg">
                                <div className="flex items-center gap-2 text-blue-400 text-xs lg:text-sm font-medium">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                                    <span className="hidden lg:inline">Este chamado aguarda atendimento.</span>
                                    <span className="lg:hidden">Aguardando atendimento</span>
                                </div>
                                <button
                                    onClick={handleAcceptTicket}
                                    className="px-3 lg:px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transform hover:-translate-y-0.5 w-full sm:w-auto justify-center"
                                >
                                    <Play size={12} fill="currentColor" />
                                    Aceitar Chamado
                                </button>
                            </div>
                        )}

                        {/* Assigned Info Banner - Only if assigned to someone else (hidden on mobile - info is in mobile header) */}
                        {selectedTicket.assignedTo && selectedTicket.assignedTo !== currentUser?.id && (
                            <div className="hidden lg:flex absolute inset-x-0 top-0 z-20 bg-[#2A2A28] border-b border-[#454543] p-2 items-center justify-center text-xs text-gray-400">
                                <User size={12} className="mr-1.5" />
                                <strong className="ml-1 text-[#d97757]">{selectedTicket.assignedByName || 'Admin'}</strong>
                            </div>
                        )}

                        {/* Cancellation Request Action Panel */}
                        {selectedTicket.type === 'cancellation_request' && (
                            <div className="bg-red-500/5 border-b border-red-500/10 p-3 lg:p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 z-10">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-500/10 rounded-lg text-red-500 shrink-0">
                                        <AlertTriangle size={18} />
                                    </div>
                                    <div>
                                        <h4 className="text-xs lg:text-sm font-bold text-red-400">Solicitação de Cancelamento</h4>
                                        <p className="text-[10px] lg:text-xs text-gray-500">O usuário solicitou o cancelamento do plano.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 w-full lg:w-auto">
                                    <button
                                        onClick={handleAdminRefund}
                                        className="flex-1 lg:flex-initial px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-bold transition-colors border border-gray-700 flex items-center justify-center gap-2"
                                        title="Estornar Pagamento"
                                    >
                                        <CreditCard size={14} /> <span className="hidden sm:inline">Estornar</span>
                                    </button>
                                    <button
                                        onClick={handleAdminCancelSubscription}
                                        className="flex-1 lg:flex-initial px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
                                        title="Cancelar Plano"
                                    >
                                        <Ban size={14} /> <span className="hidden sm:inline">Cancelar Plano</span>
                                    </button>
                                </div>
                            </div>
                        )}
                        {/* Chat container - on mobile, assignment banner is hidden since we have mobile header */}
                        <div className={`flex-1 min-h-0 overflow-hidden ${!selectedTicket.assignedTo ? 'lg:pt-[52px]' : ''}`}>
                            <SupportChat
                                isOpen={true}
                                onClose={() => setSelectedTicket(null)}
                                userId={selectedTicket.userId}
                                userEmail={selectedTicket.userEmail}
                                userName={selectedTicket.userName || 'User'}
                                isAdmin={true}
                                ticketIdProp={selectedTicket.id}
                                variant="embedded"
                                onTerminate={() => setShowTerminationModal(true)}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                        <div className="w-24 h-24 rounded-full bg-[#373734] border border-[#373734] flex items-center justify-center mb-6 shadow-2xl">
                            <Shield size={40} className="text-[#d97757] opacity-80" />
                        </div>
                        <h3 className="font-bold text-xl text-gray-300 mb-2">Painel de Suporte</h3>
                        <p className="text-sm text-gray-500 max-w-[250px] text-center leading-relaxed">
                            Selecione um chamado à esquerda para visualizar detalhes e conversar com o usuário.
                        </p>
                    </div>
                )}
            </div>

            {/* Termination Modal */}
            <UniversalModal
                isOpen={showTerminationModal}
                onClose={() => setShowTerminationModal(false)}
                title="Encerrar Atendimento"
                width="max-w-md"
                themeColor="#ef4444" // Red
                icon={<X size={20} />}
                footer={
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setShowTerminationModal(false)}
                            className="px-4 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-sm font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleTerminate}
                            className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold shadow-lg shadow-red-500/20 transition-all"
                        >
                            Sim, encerrar
                        </button>
                    </div>
                }
            >
                <div className="text-gray-300 text-sm leading-relaxed">
                    <p>Tem certeza que deseja encerrar este atendimento?</p>
                    <p className="mt-2 text-gray-400 text-xs">O status do chamado será alterado para "Fechado" e a conversa será arquivada.</p>
                </div>
            </UniversalModal>

            {/* New Ticket Modal */}
            <UniversalModal
                isOpen={showNewTicketModal}
                onClose={() => setShowNewTicketModal(false)}
                title="Iniciar Novo Atendimento"
                width="max-w-lg"
                themeColor="#d97757"
                icon={<MessageSquare size={20} />}
            >
                <div className="space-y-4">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Buscar usuário..."
                            value={userSearchTerm}
                            onChange={(e) => setUserSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-[#373734] border border-[#454543] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#d97757] transition-all"
                            autoFocus
                        />
                    </div>

                    <div className="min-h-[300px] max-h-[400px] overflow-y-auto custom-scrollbar border border-[#373734]/50 rounded-xl bg-[#2A2A28]">
                        {isLoadingUsers ? (
                            <div className="flex items-center justify-center h-[300px]">
                                <div className="flex flex-col items-center gap-3">
                                    <Loader size={24} className="animate-spin text-[#d97757]" />
                                    <span className="text-xs text-gray-500">Carregando usuários...</span>
                                </div>
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="flex items-center justify-center h-[300px] text-gray-500 text-sm">
                                Nenhum usuário encontrado
                            </div>
                        ) : (
                            <div className="divide-y divide-[#373734]/50">
                                {filteredUsers.map(user => (
                                    <div
                                        key={user.id}
                                        onClick={() => handleStartNewTicket(user)}
                                        className="p-3 hover:bg-[#373734] cursor-pointer transition-colors flex items-center justify-between group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${getAvatarColors(user.name).bg} ${getAvatarColors(user.name).text}`}>
                                                {getInitials(user.name)}
                                            </div>
                                            <div>
                                                <div className="font-medium text-white text-sm group-hover:text-[#d97757] transition-colors">
                                                    {user.name}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {user.email}
                                                </div>
                                            </div>
                                        </div>
                                        <button className="p-2 rounded-lg bg-[#3d3d3b] text-gray-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-[#d97757] hover:text-white">
                                            <MessageSquare size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </UniversalModal>
        </div >
    );
}
