
import React, { useState, useMemo } from 'react';
import { Transaction, Member, FamilyGoal } from '../types';
import { Trophy, Target, TrendingUp, TrendingDown, Plus, Coins, Check, X, Users } from './Icons';
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

  // Aggregate Stats
  const familyStats = useMemo(() => {
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    return {
      totalIncome,
      totalExpense,
      totalBalance: totalIncome - totalExpense,
      monthlySavings: totalIncome > 0 ? (totalIncome - totalExpense) : 0
    };
  }, [transactions]);

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
    <div className="animate-fade-in space-y-8">
       
       {/* Header Banner */}
       <div className="bg-gradient-to-r from-gray-900 to-gray-800 border border-gray-700 p-6 rounded-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="relative z-10">
             <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-[#d97757]/20 rounded-lg text-[#d97757]">
                   <Users size={24} />
                </div>
                <h2 className="text-2xl font-bold text-white">Relatório Familiar</h2>
             </div>
             <p className="text-gray-400 max-w-md text-sm">
               Visão unificada de todas as contas. Acompanhe o progresso coletivo e gerencie metas conjuntas.
             </p>
          </div>
          <div className="flex -space-x-4 relative z-10">
             {members.map(m => (
               <div key={m.id} className={`w-12 h-12 rounded-full border-4 border-gray-800 ${m.avatarUrl || 'bg-gray-600'} flex items-center justify-center text-white font-bold shadow-lg`}>
                 {m.name.substring(0,1)}
               </div>
             ))}
             <div className="w-12 h-12 rounded-full border-4 border-gray-800 bg-gray-700 flex items-center justify-center text-gray-400 font-bold text-xs shadow-lg">
                Total
             </div>
          </div>
          
          {/* Decor */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#d97757]/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
       </div>

       {/* Aggregate Stats */}
       <div>
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Fluxo de Caixa Total</h3>
          <StatsCards stats={familyStats} />
       </div>

       {/* Family Goals Section */}
       <div>
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
               <Trophy size={16} className="text-yellow-500" /> Metas Compartilhadas
             </h3>
             <button 
               onClick={() => setIsAddingGoal(true)}
               className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
             >
               <Plus size={14} /> Nova Meta
             </button>
          </div>

          {isAddingGoal && (
             <div className="mb-6 bg-gray-900 border border-gray-800 p-4 rounded-xl animate-slide-up">
                <h4 className="text-white font-bold mb-4">Criar Meta Familiar</h4>
                <form onSubmit={handleSaveGoal} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                   <div className="md:col-span-2">
                      <label className="text-xs text-gray-500 mb-1 block">Nome da Meta</label>
                      <input 
                        required 
                        value={newGoal.title}
                        onChange={e => setNewGoal({...newGoal, title: e.target.value})}
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
                        onChange={e => setNewGoal({...newGoal, targetAmount: e.target.value})}
                        placeholder="0.00" 
                        className="input-primary py-2" 
                      />
                   </div>
                   <div className="flex gap-2">
                      <button type="button" onClick={() => setIsAddingGoal(false)} className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm">Cancelar</button>
                      <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold flex-1">Salvar</button>
                   </div>
                </form>
             </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {goals.length === 0 && !isAddingGoal && (
               <div className="col-span-full py-12 text-center bg-gray-900/50 rounded-xl border border-dashed border-gray-800">
                  <Target size={48} className="mx-auto text-gray-700 mb-4" />
                  <p className="text-gray-500">Nenhuma meta definida ainda.</p>
                  <p className="text-sm text-gray-600">Criem objetivos juntos para juntar dinheiro.</p>
               </div>
             )}

             {goals.map(goal => {
                const percentage = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
                
                return (
                  <div key={goal.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col shadow-lg relative overflow-hidden group hover:border-gray-700 transition-colors">
                     <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="bg-gray-800 p-3 rounded-xl text-yellow-500 shadow-inner">
                           <Trophy size={24} />
                        </div>
                        <button 
                          onClick={() => onDeleteGoal(goal.id)}
                          className="text-gray-600 hover:text-red-400 transition-colors"
                        >
                          <X size={16} />
                        </button>
                     </div>

                     <h4 className="text-lg font-bold text-white mb-1 relative z-10">{goal.title}</h4>
                     <p className="text-sm text-gray-400 mb-6 relative z-10">
                        {formatCurrency(goal.currentAmount)} <span className="text-gray-600">de {formatCurrency(goal.targetAmount)}</span>
                     </p>

                     {/* Progress Bar */}
                     <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden mb-6 relative z-10 shadow-inner">
                        <div 
                          className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-1000 ease-out relative"
                          style={{ width: `${percentage}%` }}
                        >
                           <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                     </div>

                     <button 
                       onClick={() => setContributeGoalId(goal.id)}
                       className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 mt-auto relative z-10"
                     >
                       <Plus size={16} /> Contribuir
                     </button>

                     {/* Background Glow */}
                     <div className="absolute bottom-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl -mr-10 -mb-10 pointer-events-none group-hover:bg-yellow-500/10 transition-colors"></div>
                  </div>
                );
             })}
          </div>
       </div>

       {/* Contribute Modal */}
       {contributeGoalId && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
             <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-800 p-6 shadow-2xl animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-lg font-bold text-white">Adicionar Economia</h3>
                   <button onClick={() => setContributeGoalId(null)} className="text-gray-500 hover:text-white"><X size={20}/></button>
                </div>

                <form onSubmit={handleContribute} className="space-y-4">
                   <div>
                      <label className="text-xs text-gray-500 mb-1.5 block uppercase font-bold">Quem está contribuindo?</label>
                      <div className="grid grid-cols-3 gap-2">
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
