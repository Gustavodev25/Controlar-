import React, { useState, useEffect } from 'react';
import { SupportTicket, listenToAllOpenTickets, closeSupportTicket, acceptSupportTicket } from '../services/database';
import { SupportChat } from './SupportChat';
import { MessageSquare, CheckCircle, Shield, X, User, Play } from 'lucide-react';
import { User as UserType } from '../types';
import { getAvatarColors, getInitials } from '../utils/avatarUtils';
import { UniversalModal } from './UniversalModal';
import { toast } from 'sonner';

interface AdminSupportProps {
    currentUser?: UserType;
}

export const AdminSupport: React.FC<AdminSupportProps> = ({ currentUser }) => {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [showTerminationModal, setShowTerminationModal] = useState(false);

    useEffect(() => {
        const unsub = listenToAllOpenTickets((data) => {
            setTickets(data);
        });
        return () => unsub();
    }, []);

    // Update selected ticket real-time status if it changes in the list
    useEffect(() => {
        if (selectedTicket) {
            const updated = tickets.find(t => t.id === selectedTicket.id);
            if (updated) setSelectedTicket(updated);
        }
    }, [tickets]);

    const handleCloseTicket = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Fechar este chamado?')) {
            await closeSupportTicket(id);
            if (selectedTicket?.id === id) {
                setSelectedTicket(null);
            }
        }
    }

    const handleAcceptTicket = async () => {
        if (!selectedTicket || !currentUser || !currentUser.id) return;
        await acceptSupportTicket(selectedTicket.id!, currentUser.id, currentUser.name);
    };

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
            await closeSupportTicket(selectedTicket.id!);
            toast.success('Atendimento encerrado com sucesso!');
            setSelectedTicket(null);
            setShowTerminationModal(false);
        } catch (error) {
            toast.error('Erro ao encerrar atendimento');
        }
    };

    return (
        <div className="flex h-[calc(100vh-140px)] gap-6 overflow-hidden">
            {/* List */}
            <div className="w-[320px] flex flex-col shrink-0 bg-[#30302E] rounded-2xl border border-[#373734] overflow-hidden">
                <div className="p-4 border-b border-[#373734] bg-[#30302E]">
                    <h2 className="font-bold text-lg flex items-center gap-2 text-white">
                        <MessageSquare size={18} className="text-[#d97757]" />
                        Chamados
                        <span className="text-xs font-normal text-gray-500 bg-[#373734] px-2 py-0.5 rounded-full">{tickets.length}</span>
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 bg-[#30302E]">
                    {tickets.length === 0 && (
                        <div className="py-12 text-center text-gray-500 flex flex-col items-center">
                            <div className="w-16 h-16 rounded-full bg-[#373734] flex items-center justify-center mb-3 border border-[#454543]">
                                <CheckCircle size={24} className="opacity-30" />
                            </div>
                            <span className="text-sm font-medium">Tudo limpo por aqui!</span>
                            <span className="text-xs opacity-60 mt-1">Nenhum chamado pendente.</span>
                        </div>
                    )}

                    {tickets.map(ticket => {
                        const isSelected = selectedTicket?.id === ticket.id;
                        const isUnassigned = !ticket.assignedTo;
                        const userAvatarColors = getAvatarColors(ticket.userName || 'User');
                        const timeAgo = getTimeAgo(ticket.lastMessageAt);

                        return (
                            <div
                                key={ticket.id}
                                onClick={() => setSelectedTicket(ticket)}
                                className={`
                                    p-4 rounded-xl cursor-pointer transition-all duration-200 group relative border
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
                                    <span className="text-[10px] font-medium text-gray-400 bg-[#373734] px-1.5 py-0.5 rounded whitespace-nowrap">
                                        {timeAgo}
                                    </span>
                                </div>

                                <div className="pl-[52px] flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {isUnassigned ? (
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
                </div>
            </div>

            {/* Chat View */}
            <div className="flex-1 bg-[#30302E] relative flex flex-col rounded-2xl overflow-hidden border border-[#373734]">
                {selectedTicket ? (
                    <div className="h-full flex flex-col relative bg-[#30302E]">
                        {/* Assignment Banner */}
                        {!selectedTicket.assignedTo && (
                            <div className="absolute inset-x-0 top-0 z-20 bg-blue-500/10 backdrop-blur-md border-b border-blue-500/20 p-3 flex items-center justify-between shadow-lg">
                                <div className="flex items-center gap-2 text-blue-400 text-sm font-medium">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                                    Este chamado aguarda atendimento.
                                </div>
                                <button
                                    onClick={handleAcceptTicket}
                                    className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transform hover:-translate-y-0.5"
                                >
                                    <Play size={12} fill="currentColor" />
                                    Aceitar Chamado
                                </button>
                            </div>
                        )}

                        {/* Assigned Info Banner - Only if assigned to someone else */}
                        {selectedTicket.assignedTo && selectedTicket.assignedTo !== currentUser?.id && (
                            <div className="absolute inset-x-0 top-0 z-20 bg-[#2A2A28] border-b border-[#454543] p-2 flex items-center justify-center text-xs text-gray-400">
                                <User size={12} className="mr-1.5" />
                                Atendido por: <strong className="ml-1 text-[#d97757]">{selectedTicket.assignedByName || 'Admin'}</strong>
                            </div>
                        )}

                        <div className={`flex-1 ${!selectedTicket.assignedTo ? 'pt-[52px]' : ''}`}>
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
        </div>
    );
}
