import React from 'react';
import { TrendingUp, TrendingDown, Wallet, Sparkles } from './Icons';
import { DashboardStats } from '../types';

interface StatsCardsProps {
  stats: DashboardStats;
  isLoading?: boolean;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, isLoading = false }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-800 flex items-center justify-between">
            <div className="space-y-3 w-full">
               <div className="h-3 bg-gray-800 rounded w-1/3"></div>
               <div className="h-8 bg-gray-800 rounded w-2/3"></div>
            </div>
            <div className="h-10 w-10 bg-gray-800 rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-fade-in">
      <div className="bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-800 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400 font-medium">Saldo Total</p>
          <p className={`text-2xl font-bold mt-1 ${stats.totalBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
            {formatCurrency(stats.totalBalance)}
          </p>
        </div>
        <div className="p-3 bg-blue-900/20 rounded-lg text-blue-400">
          <Wallet size={24} />
        </div>
      </div>

      <div className="bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-800 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400 font-medium">Receitas</p>
          <p className="text-2xl font-bold mt-1 text-green-400">
            {formatCurrency(stats.totalIncome)}
          </p>
        </div>
        <div className="p-3 bg-green-900/20 rounded-lg text-green-400">
          <TrendingUp size={24} />
        </div>
      </div>

      <div className="bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-800 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400 font-medium">Despesas</p>
          <p className="text-2xl font-bold mt-1 text-red-400">
            {formatCurrency(stats.totalExpense)}
          </p>
        </div>
        <div className="p-3 bg-red-900/20 rounded-lg text-red-400">
          <TrendingDown size={24} />
        </div>
      </div>

      <div className="bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-800 flex items-center justify-between relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-sm text-gray-400 font-medium">Economia Mensal</p>
          <p className="text-2xl font-bold mt-1 text-purple-400">
            {formatCurrency(stats.monthlySavings)}
          </p>
        </div>
        <div className="p-3 bg-purple-900/20 rounded-lg text-purple-400 relative z-10">
          <Sparkles size={24} />
        </div>
        {/* Decorative background element */}
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-gradient-to-br from-purple-900/20 to-transparent rounded-full opacity-50"></div>
      </div>
    </div>
  );
};