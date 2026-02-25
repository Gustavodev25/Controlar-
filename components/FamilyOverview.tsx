import React, { useMemo } from 'react';
import { DashboardStats, FamilyGoal, Transaction, ConnectedAccount } from '../types';
import { Investments, Investment } from './Investments';
import { StatsCards } from './StatsCards';
import { toLocalISODate } from '../utils/dateUtils';

interface FamilyOverviewProps {
  stats: DashboardStats;
  goals: FamilyGoal[];
  // StatsCards props (kept for compatibility but unused)
  isLoading?: boolean;
  accountBalances?: any;
  creditCardTransactions?: Transaction[];
  dashboardDate?: string;
  toggles?: any;
  isProMode?: boolean;
  onActivateProMode?: () => void;
  userPlan?: 'starter' | 'pro' | 'family';
  onUpgradeClick?: () => void;
  // Goal handlers
  onAddGoal: (goal: Omit<FamilyGoal, 'id'>) => void;
  onUpdateGoal: (goal: FamilyGoal) => void;
  onDeleteGoal: (id: string) => void;
  onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
  userId?: string;
}

export const FamilyOverview: React.FC<FamilyOverviewProps> = ({
  goals,
  userPlan,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
  onAddTransaction,
  userId
}) => {

  // Map FamilyGoal to Investment for the Investments component
  const mappedInvestments: Investment[] = useMemo(() => {
    return goals.map(g => ({
      id: g.id,
      name: g.title,
      icon: g.icon || 'reserva.png',
      color: 'blue', // Default color for family goals
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      createdAt: toLocalISODate(), // Dummy date
      deadline: g.deadline
    }));
  }, [goals]);

  const handleAddInvestment = (inv: Omit<Investment, 'id'>) => {
    onAddGoal({
      title: inv.name,
      targetAmount: inv.targetAmount,
      currentAmount: inv.currentAmount,
      deadline: inv.deadline,
      icon: inv.icon
    });
  };

  const handleUpdateInvestment = (inv: Investment) => {
    onUpdateGoal({
      id: inv.id,
      title: inv.name,
      targetAmount: inv.targetAmount,
      currentAmount: inv.currentAmount,
      deadline: inv.deadline,
      icon: inv.icon
    });
  };

  return (
    <div className="animate-fade-in">
        <Investments
          investments={mappedInvestments}
          connectedSavingsAccounts={[]} // Family goals don't support connected accounts yet
          transactions={[]} // Transactions for family goals not separated yet
          onAdd={handleAddInvestment}
          onUpdate={handleUpdateInvestment}
          onDelete={onDeleteGoal}
          onAddTransaction={onAddTransaction}
          userPlan={userPlan}
          title="Caixinhas da Família"
          subtitle="Planejem seus sonhos juntos"
          userId={userId}
        />
    </div>
  );
};