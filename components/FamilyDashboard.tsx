
import React, { useState, useMemo } from 'react';
import { Transaction, Member, FamilyGoal } from '../types';
import { Trophy, Target, TrendingUp, TrendingDown, Plus, Coins, Check, X, Users, Trash2, Edit2 } from './Icons';
import { StatsCards } from './StatsCards';
import { ConfirmationCard } from './UIComponents';

interface FamilyDashboardProps {
   transactions: Transaction[];
   members: Member[];
   goals: FamilyGoal[];
   onAddGoal: (goal: Omit<FamilyGoal, 'id'>) => void;
   onUpdateGoal: (goal: FamilyGoal) => void;
   onDeleteGoal: (id: string) => void;
   onAddTransaction: (t: Omit<Transaction, 'id'>) => void; // To record contribution expenses
}

export const FamilyDashboard: React.FC<FamilyDashboardProps> = ({
   transactions,
   members,
   goals,
   onAddGoal,
   onUpdateGoal,
   onDeleteGoal,
   onAddTransaction
}) => {
   const [isAddingGoal, setIsAddingGoal] = useState(false);
   const [newGoal, setNewGoal] = useState({ title: '', targetAmount: '', deadline: '' });

   // Contribution Modal State
   const [contributeGoalId, setContributeGoalId] = useState<string | null>(null);
   const [contributionAmount, setContributionAmount] = useState('');
   const [contributionMemberId, setContributionMemberId] = useState('');

   const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

   // Apenas contabiliza lancamentos concluidos e nao ignorados
   const reviewedTransactions = useMemo(() => {
      return transactions.filter(t => t.status === 'completed' && !t.ignored);
   }, [transactions]);

   // Aggregate Stats
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
         // 1. Update Goal
         const updatedGoal = { ...goal, currentAmount: goal.currentAmount + amount };
         onUpdateGoal(updatedGoal);

         // 2. Create Expense for Member
         onAddTransaction({
            description: `Contribuição: ${goal.title}`,
            amount: amount,
            category: 'Investimentos',
            type: 'expense',
            status: 'completed',
            date: new Date().toISOString().split('T')[0],
            memberId: contributionMemberId
         });

         // Reset
         setContributeGoalId(null);
         setContributionAmount('');
         setContributionMemberId('');
      }
   };

   return (
      <div className="animate-fade-in space-y-8 pb-20 lg:pb-0">

         {/* Header */}
         <div className="flex items-center justify-between">
            <div>
               <h2 className="text-2xl font-bold text-white">Caixinhas</h2>
               <p className="text-gray-400 text-sm">Organize e alcance seus objetivos financeiros.</p>
            </div>
            <button
               onClick={() => setIsAddingGoal(true)}
               className="bg-[#d97757] hover:bg-[#c56a4d] text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-[#d97757]/20"
            >
               <Plus size={18} />
               <span className="hidden sm:inline">Nova Caixinha</span>
            </button>
         </div>

         {/* Aggregate Stats */}
         <div>
            <StatsCards stats={familyStats} />
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
                     {/* Background Progress Bar (Subtle) */}
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

                     <div className="bg-blue-900/20 p-3 rounded-lg text-blue-300 text-xs flex gap-2 items-start">
                        <Coins size={14} className="mt-0.5 shrink-0" />
                        <p>Este valor será registrado como uma despesa ("Investimento") no perfil do membro selecionado.</p>
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
