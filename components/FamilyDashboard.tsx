
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, Member, FamilyGoal, FamilyGroup, User } from '../types';
import { Trophy, Target, TrendingUp, TrendingDown, Plus, Coins, Check, X, Users, Trash2, Edit2, Copy, Link as LinkIcon, UserPlus, LogOut } from './Icons';
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
   currentUser?: User | null; // Pass current user for context
   userId?: string | null;
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
   userId
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
            // Fetch profiles for all members
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

   const handleJoinFamily = async () => {
       // In a real app, we'd likely parse the token from the URL or input.
       // For now, we assume the user might manually input a token if the link flow isn't automatic.
       // But usually we rely on the URL param check in App.tsx. 
       // This manual input is a fallback.
       if (!userId || !joinToken) return;
       
       // We need groupId to join. The token alone might not be enough if we didn't implement a global lookup.
       // Our service requires (userId, groupId, token).
       // If the user only has the token, we can't join without the GroupID unless we scan.
       // Strategy: The "Link" contains ID and Token? No, I implemented token storage in the group.
       // I need to find the group by token. 
       // Since Firestore doesn't allow easy "array contains object field" query without index, 
       // I will assume for this prototype that the "Token" input is actually "GroupId:Token" or we just ask the user for the "Código da Família" (Group ID) + Token.
       // OR better: The link I generated above is `?inviteToken=${token}`. 
       // If I can't find the group by token easily, I should change the link to include `groupId`.
       
       // Let's assume for now the user pasted the whole link or just the token.
       // I'll just show a toast saying "Use o link fornecido pelo administrador" if they try manual entry without proper implementation.
       toast.info("Por favor, utilize o link de convite enviado pelo administrador para entrar automaticamente.");
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

   // Render Slots Logic
   const renderSlots = () => {
      if (!familyGroup) return null;
      
      const planLimit = familyService.PLAN_LIMITS[familyGroup.plan] || 0;
      const slots = [];

      // Filled Slots
      familyGroup.members.forEach((memberId, index) => {
         const profile = familyMembersData[index];
         const isMe = memberId === userId;
         const isOwner = memberId === familyGroup.ownerId;

         slots.push(
            <div key={`member-${memberId}`} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col items-center justify-center gap-2 relative group">
               <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-lg font-bold text-white">
                  {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" /> : (profile?.name?.[0] || '?')}
               </div>
               <div className="text-center">
                  <p className="font-bold text-white text-sm truncate max-w-[120px]">{profile?.name || 'Usuário'}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">{isOwner ? 'Admin' : 'Membro'}</p>
               </div>
               
               {/* Remove Button (Only for Owner, not on self) */}
               {currentUser?.familyRole === 'owner' && !isOwner && (
                   <button 
                       onClick={() => handleRemoveMember(memberId)}
                       className="absolute top-2 right-2 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                       title="Remover membro"
                   >
                       <X size={14} />
                   </button>
               )}
            </div>
         );
      });

      // Pending Invites
      const pendingInvites = familyGroup.invites?.filter(i => i.status === 'pending') || [];
      pendingInvites.forEach((invite) => {
          slots.push(
            <div key={`invite-${invite.token}`} className="bg-gray-800/50 border border-dashed border-gray-700 rounded-xl p-4 flex flex-col items-center justify-center gap-2">
               <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-gray-500 animate-pulse">
                  <UserPlus size={20} />
               </div>
               <div className="text-center">
                  <p className="font-medium text-gray-400 text-xs">Aguardando...</p>
                  <button 
                    onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}?inviteToken=${invite.token}`);
                        toast.success("Link copiado novamente!");
                    }}
                    className="text-[10px] text-[#d97757] hover:underline mt-1"
                  >
                      Copiar Link
                  </button>
               </div>
            </div>
          );
      });

      // Empty Slots
      const usedCount = slots.length;
      const remaining = Math.max(0, planLimit - usedCount);

      for (let i = 0; i < remaining; i++) {
         slots.push(
            <div key={`empty-${i}`} className="bg-gray-900/50 border border-dashed border-gray-800 rounded-xl p-4 flex flex-col items-center justify-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
               <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-gray-600">
                  <Plus size={20} />
               </div>
               <div className="text-center">
                  <p className="font-medium text-gray-500 text-xs">Vaga Disponível</p>
                  {currentUser?.familyRole === 'owner' && (
                      <button onClick={handleGenerateInvite} className="text-[10px] text-[#d97757] hover:underline mt-1">Convidar</button>
                  )}
               </div>
            </div>
         );
      }

      return slots;
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

         {/* SECTION 1: Family Plan Management */}
         <div className="space-y-6">
             <div className="flex items-center justify-between">
                <div>
                   <h2 className="text-2xl font-bold text-white">Plano Familiar</h2>
                   <p className="text-gray-400 text-sm">Gerencie os membros da sua família Premium.</p>
                </div>
                {familyGroup && currentUser?.familyRole === 'owner' && (
                   <div className="px-3 py-1 bg-[#d97757]/10 border border-[#d97757]/30 rounded-lg text-[#d97757] text-xs font-bold uppercase tracking-wider">
                       {familyGroup.plan === 'family' ? 'Plano Family (5 Vagas)' : 'Plano Pro (2 Vagas)'}
                   </div>
                )}
             </div>

             {/* If User has no family group yet */}
             {!familyGroup && !loadingFamily && (
                 <div className="bg-gradient-to-r from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-8 text-center relative overflow-hidden">
                     <div className="relative z-10">
                         <Users size={48} className="mx-auto text-[#d97757] mb-4" />
                         <h3 className="text-xl font-bold text-white mb-2">
                            {currentUser?.subscription?.plan === 'family' || currentUser?.subscription?.plan === 'pro' 
                                ? 'Configure sua Família' 
                                : 'Crie sua Família'
                            }
                         </h3>
                         <p className="text-gray-400 max-w-md mx-auto mb-6">
                             {currentUser?.subscription?.plan === 'family' || currentUser?.subscription?.plan === 'pro' 
                                ? 'Você já tem o plano ativo! Agora crie o grupo para convidar os membros.'
                                : 'Compartilhe os benefícios Premium com quem você ama. Acompanhem metas juntos e gerenciem o orçamento doméstico.'
                             }
                         </p>
                         <button 
                            onClick={() => {
                                if (userId) {
                                    // Initialize as Pro/Family based on subscription (defaulting to Family for demo if needed, or checking sub)
                                    const plan = currentUser?.subscription?.plan === 'pro' ? 'pro' : 'family';
                                    familyService.initializeFamilyGroup(userId, plan)
                                        .then(() => toast.success("Grupo familiar criado!"))
                                        .catch((err) => {
                                            console.error("Erro ao criar grupo:", err);
                                            if (err.code === 'permission-denied') {
                                                toast.error("Permissão negada! Atualize as regras do Firestore no Firebase Console para permitir a coleção 'families'.");
                                            } else {
                                                toast.error(`Erro ao criar grupo: ${err.message}`);
                                            }
                                        });
                                }
                            }}
                            className="px-6 py-3 bg-[#d97757] hover:bg-[#c56a4d] text-white font-bold rounded-xl transition-transform hover:scale-105"
                         >
                             {currentUser?.subscription?.plan === 'family' || currentUser?.subscription?.plan === 'pro' 
                                ? 'Criar Grupo Familiar' 
                                : 'Ativar Plano Familiar'
                             }
                         </button>
                     </div>
                 </div>
             )}

             {/* Slots Grid */}
             {familyGroup && (
                 <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-6">
                         {renderSlots()}
                     </div>

                     {/* Invite Link Area */}
                     {inviteLink && (
                         <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex items-center justify-between gap-4 animate-slide-up">
                             <div className="flex items-center gap-3 overflow-hidden">
                                 <div className="p-2 bg-[#d97757]/10 rounded-lg text-[#d97757]">
                                     <LinkIcon size={18} />
                                 </div>
                                 <div className="min-w-0">
                                     <p className="text-xs text-gray-500 font-bold uppercase">Link de Convite</p>
                                     <p className="text-sm text-white truncate">{inviteLink}</p>
                                 </div>
                             </div>
                             <button 
                                onClick={handleCopyLink}
                                className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                                title="Copiar"
                             >
                                 <Copy size={18} />
                             </button>
                         </div>
                     )}

                     {/* Leave Button */}
                     {currentUser?.familyRole === 'member' && (
                         <div className="mt-4 pt-4 border-t border-gray-800 flex justify-end">
                             <button 
                                onClick={handleLeaveFamily}
                                className="text-red-500 hover:text-red-400 text-sm flex items-center gap-2"
                             >
                                 <LogOut size={14} />
                                 Sair da Família
                             </button>
                         </div>
                     )}
                 </div>
             )}
         </div>

         {/* SECTION 2: Goals (Caixinhas) - ONLY IF FAMILY GROUP EXISTS */}
         {familyGroup && (
            <>
                <div className="h-px bg-gray-800/50"></div>

                <div className="space-y-8">
                    <div className="flex items-center justify-between">
                        <div>
                        <h2 className="text-2xl font-bold text-white">Caixinhas</h2>
                        <p className="text-gray-400 text-sm">Organize e alcance seus objetivos financeiros.</p>
                        </div>
                        <button
                        onClick={() => setIsAddingGoal(true)}
                        className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors border border-gray-700"
                        >
                        <Plus size={18} />
                        <span className="hidden sm:inline">Nova Caixinha</span>
                        </button>
                    </div>

                    {/* Create Goal Form */}
                    {isAddingGoal && (
                        <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl animate-slide-up">
                        <h4 className="text-white font-bold mb-4">Criar Nova Caixinha</h4>
                        <form onSubmit={handleSaveGoal} className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
                            <div className="lg:col-span-2">
                                <label className="text-xs text-gray-500 mb-1 block">Nome do Objetivo</label>
                                <input
                                    required
                                    value={newGoal.title}
                                    onChange={e => setNewGoal({ ...newGoal, title: e.target.value })}
                                    placeholder="Ex: Viagem de Férias"
                                    className="input-primary py-2"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Valor Alvo (R$)</label>
                                <input
                                    required
                                    type="number"
                                    value={newGoal.targetAmount}
                                    onChange={e => setNewGoal({ ...newGoal, targetAmount: e.target.value })}
                                    placeholder="0.00"
                                    className="input-primary py-2"
                                />
                            </div>
                            <div className="flex gap-2 lg:flex-row">
                                <button type="button" onClick={() => setIsAddingGoal(false)} className="flex-1 lg:flex-none px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 transition-colors">Cancelar</button>
                                <button type="submit" className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-bold transition-colors">Salvar</button>
                            </div>
                        </form>
                        </div>
                    )}

                    {/* Goals Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {goals.length === 0 && !isAddingGoal && (
                        <div className="col-span-full py-12 text-center text-gray-500 bg-gray-900/50 rounded-2xl border border-dashed border-gray-800">
                            <Target size={48} className="mx-auto text-gray-700 mb-4" />
                            <p>Nenhuma caixinha definida ainda.</p>
                            <button onClick={() => setIsAddingGoal(true)} className="text-[#d97757] hover:underline mt-2 text-sm">Criar a primeira</button>
                        </div>
                        )}

                        {goals.map(goal => {
                        const percentage = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);

                        return (
                            <div key={goal.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-sm hover:border-gray-700 transition-all group relative overflow-hidden">
                                <div
                                    className="absolute bottom-0 left-0 h-1 bg-yellow-500 transition-all duration-500"
                                    style={{ width: `${percentage}%` }}
                                ></div>

                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-gray-800 rounded-xl text-yellow-500">
                                        <Trophy size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">{goal.title}</h3>
                                        <p className="text-xs text-gray-500">Meta Familiar</p>
                                    </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => onDeleteGoal(goal.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Guardado: <span className="text-white font-medium">{formatCurrency(goal.currentAmount)}</span></span>
                                    <span className="text-gray-400">Meta: <span className="text-white font-medium">{formatCurrency(goal.targetAmount)}</span></span>
                                    </div>

                                    <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-yellow-500 rounded-full transition-all duration-500"
                                        style={{ width: `${percentage}%` }}
                                    ></div>
                                    </div>

                                    <div className="flex justify-between items-center text-xs mt-1">
                                    <span className="text-yellow-500 font-bold">
                                        {percentage.toFixed(0)}% alcançado
                                    </span>
                                    </div>

                                    <button
                                    onClick={() => setContributeGoalId(goal.id)}
                                    className="w-full mt-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
                                    >
                                    <Plus size={14} />
                                    Contribuir
                                    </button>
                                </div>
                            </div>
                        );
                        })}
                    </div>
                </div>
            </>
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
