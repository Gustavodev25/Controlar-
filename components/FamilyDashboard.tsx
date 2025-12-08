import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { EmptyState } from './EmptyState';
import { Transaction, Member, FamilyGoal, FamilyGroup, User } from '../types';
import { Trophy, Target, TrendingUp, TrendingDown, Plus, Coins, Check, X, Trash2, Edit2, Copy, Link as LinkIcon, UserPlus, LogOut, ChevronRight, Mail } from './Icons';
import { Users as UsersIcon, MapPin, MessageCircle } from 'lucide-react';
import { StatsCards } from './StatsCards';
import { ConfirmationCard } from './UIComponents';
import { toLocalISODate } from '../utils/dateUtils';
import * as familyService from '../services/familyService';
import * as dbService from '../services/database';
import { useToasts } from './Toast';

interface FamilyDashboardProps {
    transactions: Transaction[];
    members: Member[];
    goals: FamilyGoal[];
    onAddGoal: (goal: Omit<FamilyGoal, 'id'>) => void;
    onUpdateGoal: (goal: FamilyGoal) => void;
    onDeleteGoal: (id: string) => void;
    onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
    currentUser?: User | null;
    userId?: string | null;
    onUpgrade?: () => void;
}

export const FamilyDashboard: React.FC<FamilyDashboardProps> = ({
    transactions,
    members,
    goals,
    onAddGoal,
    onUpdateGoal,
    onDeleteGoal,
    onAddTransaction,
    currentUser,
    userId,
    onUpgrade
}) => {
    const toast = useToasts();
    const [isAddingGoal, setIsAddingGoal] = useState(false);
    const [newGoal, setNewGoal] = useState({ title: '', targetAmount: '', deadline: '' });

    // Family Management State
    const [familyGroup, setFamilyGroup] = useState<FamilyGroup | null>(null);
    const [familyMembersData, setFamilyMembersData] = useState<Partial<User>[]>([]);
    const [loadingFamily, setLoadingFamily] = useState(true);
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [joinToken, setJoinToken] = useState('');
    const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [isInviteVisible, setIsInviteVisible] = useState(false);
    const [isInviteAnimating, setIsInviteAnimating] = useState(false);
    const [selectedMember, setSelectedMember] = useState<Partial<User> | null>(null);

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        if (showInviteModal) {
            setIsInviteVisible(true);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsInviteAnimating(true);
                });
            });
        } else {
            setIsInviteAnimating(false);
            timeoutId = setTimeout(() => {
                setIsInviteVisible(false);
            }, 300);
        }
        return () => clearTimeout(timeoutId);
    }, [showInviteModal]);

    // Contribution Modal State
    const [contributeGoalId, setContributeGoalId] = useState<string | null>(null);
    const [contributionAmount, setContributionAmount] = useState('');
    const [contributionMemberId, setContributionMemberId] = useState('');

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    // Load Family Data
    useEffect(() => {
        if (!userId || !currentUser?.familyGroupId) {
            setLoadingFamily(false);
            return;
        }
        const unsub = familyService.listenToFamilyGroup(currentUser.familyGroupId, (group) => {
            setFamilyGroup(group);
            if (group) {
                Promise.all(group.members.map(mid => dbService.getUserProfile(mid)))
                    .then(profiles => {
                        setFamilyMembersData(profiles.filter(p => p !== null) as Partial<User>[]);
                    });
            }
            setLoadingFamily(false);
        });
        return () => unsub();
    }, [userId, currentUser?.familyGroupId]);

    // Handle Invite Generation
    const handleGenerateInvite = async () => {
        if (!familyGroup) return;
        setIsGeneratingInvite(true);
        try {
            const token = await familyService.createInvite(familyGroup.id);
            const link = `${window.location.origin}?inviteToken=${token}&familyId=${familyGroup.id}`;
            setInviteLink(link);
            setShowInviteModal(true);
            toast.success("Link de convite gerado!");
        } catch (error: any) {
            toast.error(error.message || "Erro ao gerar convite.");
        } finally {
            setIsGeneratingInvite(false);
        }
    };

    const handleCopyLink = () => {
        if (inviteLink) {
            navigator.clipboard.writeText(inviteLink);
            toast.success("Link copiado para a área de transferência!");
        }
    };

    const handleShareWhatsApp = () => {
        if (inviteLink) {
            const message = encodeURIComponent(`Junte-se ao nosso plano familiar! ${inviteLink}`);
            window.open(`https://wa.me/?text=${message}`, '_blank');
        }
    };

    const handleShareEmail = () => {
        if (inviteLink) {
            const subject = encodeURIComponent('Convite para Plano Familiar');
            const body = encodeURIComponent(`Olá! Você foi convidado para participar do nosso plano familiar.\n\nClique no link abaixo para aceitar:\n${inviteLink}`);
            window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
        }
    };

    const handleLeaveFamily = async () => {
        if (!familyGroup || !userId) return;
        if (confirm("Tem certeza que deseja sair do plano familiar?")) {
            try {
                await familyService.removeMember(familyGroup.id, userId);
                toast.success("Você saiu da família.");
                setFamilyGroup(null);
            } catch (e) {
                toast.error("Erro ao sair do grupo.");
            }
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!familyGroup) return;
        if (confirm("Remover este membro da família?")) {
            try {
                await familyService.removeMember(familyGroup.id, memberId);
                toast.success("Membro removido.");
            } catch (e) {
                toast.error("Erro ao remover membro.");
            }
        }
    };

    // Get member stats
    const getMemberStats = (memberId: string) => {
        const memberTransactions = transactions.filter(t => t.memberId === memberId && t.status === 'completed');
        const income = memberTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
        const expense = memberTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
        return { income, expense, balance: income - expense };
    };

    // Existing Goals Logic
    const reviewedTransactions = useMemo(() => {
        return transactions.filter(t => t.status === 'completed' && !t.ignored);
    }, [transactions]);

    const familyStats = useMemo(() => {
        const totalIncome = reviewedTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
        const totalExpense = reviewedTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
        return {
            totalIncome,
            totalExpense,
            totalBalance: totalIncome - totalExpense,
            monthlySavings: totalIncome > 0 ? (totalIncome - totalExpense) : 0
        };
    }, [reviewedTransactions]);

    const handleSaveGoal = (e: React.FormEvent) => {
        e.preventDefault();
        onAddGoal({
            title: newGoal.title,
            targetAmount: parseFloat(newGoal.targetAmount),
            currentAmount: 0,
            deadline: newGoal.deadline || undefined
        });
        setIsAddingGoal(false);
        setNewGoal({ title: '', targetAmount: '', deadline: '' });
    };

    const handleContribute = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contributeGoalId || !contributionMemberId) return;
        const amount = parseFloat(contributionAmount);
        const goal = goals.find(g => g.id === contributeGoalId);
        if (goal && amount > 0) {
            const updatedGoal = { ...goal, currentAmount: goal.currentAmount + amount };
            onUpdateGoal(updatedGoal);
            onAddTransaction({
                description: `Contribuição: ${goal.title}`,
                amount: amount,
                category: 'Investimentos',
                type: 'expense',
                status: 'completed',
                date: toLocalISODate(),
                memberId: contributionMemberId
            });
            setContributeGoalId(null);
            setContributionAmount('');
            setContributionMemberId('');
        }
    };

    return (
        <div className="animate-fade-in space-y-12 pb-20 lg:pb-0">
            {/* Empty State - No Family Group */}
            {!familyGroup && !loadingFamily && (
                <EmptyState
                    image="/assets/familia.png"
                    title={currentUser?.subscription?.plan === 'family' || currentUser?.subscription?.plan === 'pro'
                        ? 'Configure sua Família'
                        : 'Crie sua Família'
                    }
                    description={currentUser?.subscription?.plan === 'family' || currentUser?.subscription?.plan === 'pro'
                        ? 'Você já tem o plano ativo! Agora crie o grupo para convidar os membros.'
                        : 'Compartilhe os benefícios Premium com quem você ama. Acompanhem metas juntos e gerenciem o orçamento doméstico.'
                    }
                    action={{
                        label: currentUser?.subscription?.plan === 'family' || currentUser?.subscription?.plan === 'pro'
                            ? 'Criar Grupo Familiar'
                            : 'Ativar Plano Familiar',
                        onClick: () => {
                            if (userId) {
                                const currentPlan = currentUser?.subscription?.plan || 'starter';
                                if (currentPlan === 'starter') {
                                    if (onUpgrade) onUpgrade();
                                    return;
                                }
                                const toastId = toast.loading("Criando grupo familiar...");
                                const plan = currentPlan === 'pro' ? 'pro' : 'family';
                                familyService.initializeFamilyGroup(userId, plan)
                                    .then(() => {
                                        toast.dismiss(toastId);
                                        toast.success("Grupo familiar criado!");
                                    })
                                    .catch((err) => {
                                        toast.dismiss(toastId);
                                        console.error("Erro ao criar grupo:", err);
                                        if (err.code === 'permission-denied') {
                                            toast.error("Permissão negada! Atualize as regras do Firestore no Firebase Console.");
                                        } else {
                                            toast.error(`Erro ao criar grupo: ${err.message}`);
                                        }
                                    });
                            }
                        }
                    }}
                />
            )}

            {/* Main Family Dashboard */}
            {familyGroup && (
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-white">Plano Familiar</h2>
                            <p className="text-gray-400 text-sm">Gerencie os membros da sua família Premium.</p>
                        </div>
                        {currentUser?.familyRole === 'owner' && (
                            <div className="px-3 py-1 bg-[#d97757]/10 border border-[#d97757]/30 rounded-lg text-[#d97757] text-xs font-bold uppercase tracking-wider">
                                {familyGroup.plan === 'family' ? 'Plano Family (3 Vagas)' : 'Plano Pro (2 Vagas)'}
                            </div>
                        )}
                    </div>

                    {/* Members Section - Spotify Style */}
                    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
                        {/* Header with green checkmarks */}
                        <div className="p-6 border-b border-gray-800">
                            <h3 className="text-xl font-bold text-white mb-3">Membros do plano</h3>

                            {/* Green checkmarks row */}
                            <div className="flex items-center gap-1.5 mb-2">
                                {Array.from({ length: familyService.PLAN_LIMITS[familyGroup.plan] }).map((_, index) => (
                                    <div
                                        key={index}
                                        className={`w-5 h-5 rounded-full flex items-center justify-center ${index < familyGroup.members.length
                                            ? 'bg-green-500'
                                            : 'bg-gray-800'
                                            }`}
                                    >
                                        {index < familyGroup.members.length && (
                                            <Check size={12} className="text-white" />
                                        )}
                                    </div>
                                ))}
                            </div>
                            <p className="text-gray-400 text-sm">
                                {familyGroup.members.length}/{familyService.PLAN_LIMITS[familyGroup.plan]} contas usadas
                            </p>
                        </div>

                        {/* Members List */}
                        <div className="divide-y divide-gray-800">
                            {familyMembersData.map((member, index) => {
                                const memberId = familyGroup.members[index];
                                const isOwner = memberId === familyGroup.ownerId;
                                const isCurrentUser = memberId === userId;

                                return (
                                    <div
                                        key={memberId}
                                        onClick={() => setSelectedMember(member)}
                                        className="flex items-center gap-4 p-4 hover:bg-gray-800 cursor-pointer transition-colors"
                                    >
                                        {/* Avatar */}
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white overflow-hidden flex-shrink-0 ${isOwner
                                            ? 'bg-gradient-to-br from-[#d97757] to-[#c4583a]'
                                            : 'bg-gradient-to-br from-gray-700 to-gray-600'
                                            }`}>
                                            {member?.avatarUrl ? (
                                                <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                member?.name?.[0]?.toUpperCase() || '?'
                                            )}
                                        </div>

                                        {/* Name and Role */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-white font-bold text-base truncate">
                                                {isCurrentUser ? 'Você' : (member?.name || 'Usuário')}
                                            </h4>
                                            <p className="text-gray-400 text-sm">
                                                {isOwner ? 'Administrador do plano' : 'Membro do plano'}
                                            </p>
                                        </div>

                                        {/* Arrow */}
                                        <ChevronRight size={20} className="text-gray-600 flex-shrink-0" />
                                    </div>
                                );
                            })}

                            {/* Pending Invites */}
                            {familyGroup.invites?.filter(i => i.status === 'pending').map((invite) => (
                                <div
                                    key={invite.token}
                                    className="flex items-center gap-4 p-4 hover:bg-gray-800 cursor-pointer transition-colors"
                                    onClick={() => {
                                        const link = `${window.location.origin}?inviteToken=${invite.token}`;
                                        navigator.clipboard.writeText(link);
                                        toast.success("Link copiado!");
                                    }}
                                >
                                    {/* Avatar Placeholder */}
                                    <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 text-gray-500">
                                        <UserPlus size={20} />
                                    </div>

                                    {/* Name */}
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-gray-400 font-bold text-base">Aguardando...</h4>
                                        <p className="text-gray-500 text-sm">Convite pendente</p>
                                    </div>

                                    {/* Arrow */}
                                    <ChevronRight size={20} className="text-gray-600 flex-shrink-0" />
                                </div>
                            ))}
                        </div>

                        {/* Help Link */}
                        <div className="p-4 border-t border-gray-800">
                            <button className="text-[#d97757] text-sm hover:underline">
                                Como adicionar membros do Family
                            </button>
                        </div>

                        {/* Invite Section - Integrated & Visual */}
                        {currentUser?.familyRole === 'owner' && (
                            <div className="p-6 border-t border-gray-800">
                                <h3 className="text-lg font-bold text-white mb-6">Adicionar Novo Membro</h3>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                    {/* Step 1 */}
                                    <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 flex flex-col items-center text-center group hover:border-[#d97757]/30 transition-colors">
                                        <div className="h-24 w-full bg-gray-900 rounded-lg mb-3 relative overflow-hidden flex items-center justify-center border border-gray-800">
                                            <div className="absolute inset-0 bg-gradient-to-br from-gray-800/50 to-transparent"></div>
                                            {/* Mini Button Mockup */}
                                            <div className="px-3 py-1.5 bg-[#d97757] rounded-md shadow-lg shadow-[#d97757]/20 flex items-center gap-1 transform group-hover:scale-105 transition-transform">
                                                <div className="w-2 h-2 bg-white rounded-full"></div>
                                                <div className="w-8 h-1 bg-white/50 rounded-full"></div>
                                            </div>
                                            {/* Cursor Mockup */}
                                            <div className="absolute bottom-6 right-8 text-white drop-shadow-md transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="rotate-[-15deg]"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path></svg>
                                            </div>
                                        </div>
                                        <p className="text-white font-bold text-sm mb-1">1. Gerar Link</p>
                                        <p className="text-gray-500 text-xs">Crie um link de acesso exclusivo.</p>
                                    </div>

                                    {/* Step 2 */}
                                    <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 flex flex-col items-center text-center group hover:border-[#d97757]/30 transition-colors">
                                        <div className="h-24 w-full bg-gray-900 rounded-lg mb-3 relative overflow-hidden flex items-center justify-center border border-gray-800">
                                            <div className="absolute inset-0 bg-gradient-to-br from-gray-800/50 to-transparent"></div>
                                            {/* Link Bubble Mockup */}
                                            <div className="bg-gray-800 border border-gray-700 rounded-lg p-2 flex items-center gap-2 w-3/4 transform group-hover:-translate-y-1 transition-transform shadow-md">
                                                <div className="w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                                                    <LinkIcon size={8} />
                                                </div>
                                                <div className="h-1 w-full bg-gray-700 rounded-full"></div>
                                            </div>
                                        </div>
                                        <p className="text-white font-bold text-sm mb-1">2. Enviar</p>
                                        <p className="text-gray-500 text-xs">Compartilhe no WhatsApp ou E-mail.</p>
                                    </div>

                                    {/* Step 3 */}
                                    <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 flex flex-col items-center text-center group hover:border-[#d97757]/30 transition-colors">
                                        <div className="h-24 w-full bg-gray-900 rounded-lg mb-3 relative overflow-hidden flex items-center justify-center border border-gray-800">
                                            <div className="absolute inset-0 bg-gradient-to-br from-gray-800/50 to-transparent"></div>
                                            {/* Profile Card Mockup */}
                                            <div className="flex items-center gap-2 bg-gray-800 px-3 py-2 rounded-lg border border-gray-700 transform group-hover:scale-105 transition-transform shadow-md">
                                                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-[8px] text-white font-bold shadow-sm">
                                                    <Check size={10} />
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="w-10 h-1 bg-gray-600 rounded-full"></div>
                                                    <div className="w-6 h-1 bg-gray-700 rounded-full"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-white font-bold text-sm mb-1">3. Pronto!</p>
                                        <p className="text-gray-500 text-xs">O membro entra no plano na hora.</p>
                                    </div>
                                </div>

                                <div className="flex justify-center">
                                     {familyGroup.members.length >= familyService.PLAN_LIMITS[familyGroup.plan] ? (
                                         <div className="px-6 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-bold text-center w-full md:w-auto">
                                             Limite de membros atingido
                                         </div>
                                     ) : (
                                        <button
                                            onClick={handleGenerateInvite}
                                            disabled={isGeneratingInvite}
                                            className="w-full md:w-auto px-8 py-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/20 flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <LinkIcon size={18} />
                                            Gerar Link de Convite
                                        </button>
                                     )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Leave Family Button */}
                    {currentUser?.familyRole === 'member' && (
                        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
                            <button
                                onClick={handleLeaveFamily}
                                className="flex items-center gap-2 text-red-500 hover:text-red-400 text-sm font-bold"
                            >
                                <LogOut size={16} />
                                Sair da Família
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Invite Modal */}
            {isInviteVisible && createPortal(
                <div className={`
                    fixed inset-0 z-[9999] flex items-center justify-center p-4 
                    transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
                    ${isInviteAnimating ? 'backdrop-blur-md bg-black/60' : 'backdrop-blur-none bg-black/0'}
                `}>
                    <div className={`
                        bg-gray-950 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-800 
                        flex flex-col relative 
                        transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
                        ${isInviteAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
                    `}>
                        {/* Background Glow */}
                        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 opacity-20 bg-[#d97757]" />

                        <div className="p-6 border-b border-gray-800 flex justify-between items-center relative z-10 bg-gray-950/80 backdrop-blur-sm">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <UserPlus size={18} className="text-[#d97757]" />
                                Convidar Pessoa
                            </h3>
                            <button
                                onClick={() => setShowInviteModal(false)}
                                className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-xl border border-transparent hover:border-gray-700 transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 relative z-10 space-y-6">
                            <div className="text-center space-y-2">
                                <h4 className="text-xl font-bold text-white">Compartilhe o Acesso</h4>
                                <p className="text-sm text-gray-400 max-w-xs mx-auto leading-relaxed">
                                    Envie este link para quem você quer adicionar ao seu plano familiar.
                                </p>
                            </div>

                            {/* Link Display */}
                            <div className="group relative">
                                <div className="absolute inset-0 bg-[#d97757]/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                <div className="bg-gray-900/80 rounded-2xl p-1.5 flex items-center gap-2 border border-gray-800 hover:border-[#d97757]/30 transition-colors relative z-10">
                                    <div className="flex-1 bg-gray-950/50 rounded-xl px-4 py-3 text-sm text-gray-300 font-mono truncate select-all">
                                        {inviteLink}
                                    </div>
                                    <button
                                        onClick={handleCopyLink}
                                        className="p-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl transition-all shadow-lg shadow-[#d97757]/20 active:scale-95 flex-shrink-0"
                                        title="Copiar Link"
                                    >
                                        <Copy size={18} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button className="text-[#d97757] text-xs font-bold hover:underline w-full text-center uppercase tracking-wider flex items-center justify-center gap-1 opacity-80 hover:opacity-100 transition-opacity">
                                    <span className="w-4 h-4 rounded-full bg-[#d97757]/20 flex items-center justify-center text-[10px]">?</span>
                                    Como adicionar membros
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Member Detail Modal */}
            {selectedMember && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
                    <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-800 p-6 shadow-2xl animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Detalhes do Membro</h3>
                            <button
                                onClick={() => setSelectedMember(null)}
                                className="text-gray-500 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="text-center mb-6">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4 overflow-hidden">
                                {selectedMember?.avatarUrl ? (
                                    <img src={selectedMember.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    selectedMember?.name?.[0] || '?'
                                )}
                            </div>
                            <h4 className="text-white font-bold text-lg">{selectedMember?.name || 'Usuário'}</h4>
                            <p className="text-gray-400 text-sm">{selectedMember?.email || 'email@exemplo.com'}</p>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-gray-800 rounded-xl p-4 text-center">
                                <p className="text-gray-400 text-xs mb-1">Total Gastos</p>
                                <p className="text-red-400 font-bold text-lg">
                                    {formatCurrency(getMemberStats(familyGroup!.members[familyMembersData.indexOf(selectedMember)]).expense)}
                                </p>
                            </div>
                            <div className="bg-gray-800 rounded-xl p-4 text-center">
                                <p className="text-gray-400 text-xs mb-1">Saldo</p>
                                <p className={`font-bold text-lg ${getMemberStats(familyGroup!.members[familyMembersData.indexOf(selectedMember)]).balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {formatCurrency(getMemberStats(familyGroup!.members[familyMembersData.indexOf(selectedMember)]).balance)}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => setSelectedMember(null)}
                            className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold transition-colors"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}

            {/* Contribute Modal */}
            {contributeGoalId && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-3 lg:p-4">
                    <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-800 p-5 lg:p-6 shadow-2xl animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white">Adicionar Economia</h3>
                            <button onClick={() => setContributeGoalId(null)} className="text-gray-500 hover:text-white"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleContribute} className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-500 mb-1.5 block uppercase font-bold">Quem está contribuindo?</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {members.map(m => (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => setContributionMemberId(m.id)}
                                            className={`p-2 rounded-lg border text-center transition-all ${contributionMemberId === m.id ? 'bg-[#d97757] border-[#d97757] text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}
                                        >
                                            <div className="text-xs font-bold truncate">{m.name}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1.5 block uppercase font-bold">Valor (R$)</label>
                                <input
                                    type="number"
                                    required
                                    step="0.01"
                                    autoFocus
                                    value={contributionAmount}
                                    onChange={e => setContributionAmount(e.target.value)}
                                    className="input-primary text-xl font-bold text-green-400"
                                    placeholder="0.00"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={!contributionMemberId || !contributionAmount}
                                className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                            >
                                Confirmar Depósito
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
