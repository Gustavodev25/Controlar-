
import React from 'react';
import { TrendingUp, TrendingDown, Wallet, Sparkles, CreditCard, Building } from './Icons';
import { DashboardStats } from '../types';
import NumberFlow from '@number-flow/react';

interface StatsCardsProps {
  stats: DashboardStats;
  isLoading?: boolean;
  accountBalances?: {
    checking: number;
    credit: {
        used: number;
        available: number;
        limit: number;
    };
  };
  toggles?: {
    includeChecking: boolean;
    setIncludeChecking: (v: boolean) => void;
    includeCredit: boolean;
    setIncludeCredit: (v: boolean) => void;
  };
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, isLoading = false, accountBalances, toggles }) => {
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
    <div className="space-y-4 mb-6 animate-fade-in">
      {/* Account Balances & Toggles Row */}
      {(accountBalances && toggles) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {/* Checking Account */}
           <div className={`p-5 rounded-xl shadow-sm border transition-all duration-200 ${toggles.includeChecking ? 'bg-gray-900 border-gray-800' : 'bg-gray-900/50 border-gray-800/50 opacity-75'}`}>
              <div className="flex items-start justify-between">
                 <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-900/20 rounded-lg text-emerald-400">
                       <Building size={20} />
                    </div>
                    <div>
                       <p className="text-sm text-gray-400 font-medium">Saldo em Conta Corrente</p>
                       <p className="text-2xl font-bold text-white mt-0.5">
                         <NumberFlow 
                           value={accountBalances.checking} 
                           format={{ style: 'currency', currency: 'BRL' }}
                           locales="pt-BR"
                         />
                       </p>
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={toggles.includeChecking} 
                        onChange={(e) => toggles.setIncludeChecking(e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                      <span className="ml-2 text-xs font-medium text-gray-400 hidden sm:block">Considerar</span>
                    </label>
                 </div>
              </div>
           </div>

           {/* Credit Card */}
           <div className={`p-5 rounded-xl shadow-sm border transition-all duration-200 ${toggles.includeCredit ? 'bg-gray-900 border-gray-800' : 'bg-gray-900/50 border-gray-800/50 opacity-75'}`}>
              <div className="flex items-start justify-between mb-3">
                 <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-orange-900/20 rounded-lg text-orange-400">
                       <CreditCard size={20} />
                    </div>
                    <div>
                       <p className="text-sm text-gray-400 font-medium">Cartão de Crédito</p>
                       <div className="flex items-baseline gap-2">
                           <p className="text-2xl font-bold text-white mt-0.5">
                             <NumberFlow 
                               value={accountBalances.credit.used} 
                               format={{ style: 'currency', currency: 'BRL' }}
                               locales="pt-BR"
                             />
                           </p>
                           <span className="text-xs text-gray-500 font-medium">utilizado</span>
                       </div>
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={toggles.includeCredit} 
                        onChange={(e) => toggles.setIncludeCredit(e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                      <span className="ml-2 text-xs font-medium text-gray-400 hidden sm:block">Considerar</span>
                    </label>
                 </div>
              </div>
              
              {/* Credit Limit Progress */}
              <div className="w-full bg-gray-800 rounded-full h-1.5 mb-2 overflow-hidden">
                   <div 
                     className="bg-orange-500 h-1.5 rounded-full transition-all duration-500" 
                     style={{ width: `${accountBalances.credit.limit > 0 ? Math.min((accountBalances.credit.used / accountBalances.credit.limit) * 100, 100) : 0}%` }}
                   ></div>
              </div>
              <div className="flex justify-between items-center text-xs">
                   <span className="text-emerald-400 font-medium">
                      Disponível: {formatCurrency(accountBalances.credit.available)}
                   </span>
                   <span className="text-gray-500">
                      Limite: {formatCurrency(accountBalances.credit.limit)}
                   </span>
              </div>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 font-medium">Saldo Total</p>
            <p className={`text-2xl font-bold mt-1 ${stats.totalBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
              <NumberFlow 
                value={stats.totalBalance} 
                format={{ style: 'currency', currency: 'BRL' }}
                locales="pt-BR"
              />
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
            <NumberFlow 
              value={stats.totalIncome} 
              format={{ style: 'currency', currency: 'BRL' }}
              locales="pt-BR"
            />
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
            <NumberFlow 
              value={stats.totalExpense} 
              format={{ style: 'currency', currency: 'BRL' }}
              locales="pt-BR"
            />
          </p>
        </div>
        <div className="p-3 bg-red-900/20 rounded-lg text-red-400">
          <TrendingDown size={24} />
        </div>
      </div>

      <div className="bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-800 flex items-center justify-between relative overflow-hidden">
        <div className="relative z-10">
          {/* Changed generic label to accommodate Year/Custom filters */}
          <p className="text-sm text-gray-400 font-medium">Resultado do Período</p>
          <p className="text-2xl font-bold mt-1 text-purple-400">
            <NumberFlow 
              value={stats.monthlySavings} 
              format={{ style: 'currency', currency: 'BRL' }}
              locales="pt-BR"
            />
          </p>
        </div>
        <div className="p-3 bg-purple-900/20 rounded-lg text-purple-400 relative z-10">
          <Sparkles size={24} />
        </div>
        {/* Decorative background element */}
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-gradient-to-br from-purple-900/20 to-transparent rounded-full opacity-50"></div>
      </div>
    </div>
    </div>
  );
};
