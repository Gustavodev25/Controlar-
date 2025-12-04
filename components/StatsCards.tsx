import React, { useState, useRef, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, Sparkles, CreditCard, Building, Link, Settings, Check } from './Icons';
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
    creditCardUseTotalLimit?: boolean;
    setCreditCardUseTotalLimit?: (v: boolean) => void;
    creditCardUseFullLimit?: boolean;
    setCreditCardUseFullLimit?: (v: boolean) => void;
  };
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, isLoading = false, accountBalances, toggles }) => {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const configRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (configRef.current && !configRef.current.contains(event.target as Node)) {
        setIsConfigOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
           <div className={`p-5 rounded-xl shadow-sm border transition-all duration-200 ${toggles.includeChecking ? 'bg-gray-900 border-gray-800' : 'bg-gray-900/50 border-gray-800/50'}`}>
              <div className="flex items-start justify-between">
                 <div className={`flex items-center gap-3 ${!toggles.includeChecking ? 'opacity-50' : ''}`}>
                    <div className="p-2.5 bg-emerald-900/20 rounded-lg text-emerald-400">
                       <Building size={20} />
                    </div>
                    <div>
                       <p className="text-sm text-gray-400 font-medium">Saldo em Conta</p>
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
                    <div 
                        onClick={() => toggles.setIncludeChecking(!toggles.includeChecking)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 cursor-pointer ${toggles.includeChecking ? 'bg-[#d97757]' : 'bg-gray-700'}`}
                        title="Incluir no Saldo Total"
                    >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${toggles.includeChecking ? 'translate-x-5' : 'translate-x-1'}`} />
                    </div>
                 </div>
              </div>
           </div>

           {/* Credit Card */}
           <div className={`p-5 rounded-xl shadow-sm border transition-all duration-200 ${toggles.includeCredit ? 'bg-gray-900 border-gray-800' : 'bg-gray-900/50 border-gray-800/50'}`}>
              <div className="flex items-start justify-between mb-3">
                 <div className={`flex items-center gap-3 ${!toggles.includeCredit ? 'opacity-50' : ''}`}>
                    <div className="p-2.5 bg-orange-900/20 rounded-lg text-orange-400">
                       <CreditCard size={20} />
                    </div>
                    <div>
                       <p className="text-sm text-gray-400 font-medium">Cartão de Crédito</p>
                       <div className="flex items-baseline gap-2">
                           <p className="text-2xl font-bold text-white mt-0.5">
                             <NumberFlow 
                               value={
                                   toggles.creditCardUseFullLimit 
                                   ? accountBalances.credit.limit 
                                   : accountBalances.credit.used
                               } 
                               format={{ style: 'currency', currency: 'BRL' }}
                               locales="pt-BR"
                             />
                           </p>
                           <span className="text-xs text-gray-500 font-medium">
                               {toggles.creditCardUseFullLimit ? 'limite total' : 'fatura atual'}
                           </span>
                       </div>
                    </div>
                 </div>
                 
                 {/* Config Dropdown Trigger */}
                 <div className="relative" ref={configRef}>
                    <button 
                        onClick={() => setIsConfigOpen(!isConfigOpen)}
                        className={`p-2 rounded-lg transition-colors ${isConfigOpen ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}`}
                    >
                        <Settings size={16} />
                    </button>

                    {/* Dropdown Menu */}
                    {isConfigOpen && (
                        <div className="absolute top-full right-0 mt-2 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 p-2 overflow-hidden animate-scale-in origin-top-right">
                            <div className="px-2 py-1.5 border-b border-gray-800 mb-1">
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Configuração do Cartão</span>
                            </div>

                            {/* Switch 1: Include in Balance */}
                            <div 
                                onClick={() => toggles.setIncludeCredit(!toggles.includeCredit)}
                                className="flex items-center justify-between p-2 hover:bg-gray-800 rounded-lg cursor-pointer transition-colors group"
                            >
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded bg-orange-900/30 text-orange-400`}>
                                        <CreditCard size={14} />
                                    </div>
                                    <span className="text-sm text-gray-300 group-hover:text-white">Incluir nas Despesas</span>
                                </div>
                                <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 ${toggles.includeCredit ? 'bg-[#d97757]' : 'bg-gray-700'}`}>
                                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${toggles.includeCredit ? 'translate-x-5' : 'translate-x-1'}`} />
                                </div>
                            </div>

                            {/* Switch 2: Use Total Debt (Pluggy) vs Monthly Spending */}
                            {toggles.setCreditCardUseTotalLimit && (
                                <div 
                                    onClick={() => {
                                        const newValue = !toggles.creditCardUseTotalLimit;
                                        toggles.setCreditCardUseTotalLimit!(newValue);
                                        if (newValue && toggles.setCreditCardUseFullLimit) toggles.setCreditCardUseFullLimit(false);
                                    }}
                                    className="flex items-center justify-between p-2 hover:bg-gray-800 rounded-lg cursor-pointer transition-colors group"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded bg-purple-900/30 text-purple-400`}>
                                            <Link size={14} />
                                        </div>
                                        <span className="text-sm text-gray-300 group-hover:text-white">Usar Saldo do Banco</span>
                                    </div>
                                    <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 ${toggles.creditCardUseTotalLimit ? 'bg-[#d97757]' : 'bg-gray-700'}`}>
                                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${toggles.creditCardUseTotalLimit ? 'translate-x-5' : 'translate-x-1'}`} />
                                    </div>
                                </div>
                            )}

                            {/* Switch 3: Use Full Limit (Comprometido) */}
                            {toggles.setCreditCardUseFullLimit && (
                                <div 
                                    onClick={() => {
                                        const newValue = !toggles.creditCardUseFullLimit;
                                        toggles.setCreditCardUseFullLimit!(newValue);
                                        if (newValue && toggles.setCreditCardUseTotalLimit) toggles.setCreditCardUseTotalLimit(false);
                                    }}
                                    className="flex items-center justify-between p-2 hover:bg-gray-800 rounded-lg cursor-pointer transition-colors group"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded bg-red-900/30 text-red-400`}>
                                            <TrendingDown size={14} />
                                        </div>
                                        <span className="text-sm text-gray-300 group-hover:text-white">Limite Total</span>
                                    </div>
                                    <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 ${toggles.creditCardUseFullLimit ? 'bg-[#d97757]' : 'bg-gray-700'}`}>
                                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${toggles.creditCardUseFullLimit ? 'translate-x-5' : 'translate-x-1'}`} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                 </div>
              </div>
              
              {/* Credit Limit Progress */}
              <div className={`w-full ${!toggles.includeCredit ? 'opacity-50' : ''}`}>
                  <div className="w-full bg-gray-800 rounded-full h-1.5 mb-2 overflow-hidden">
                       <div 
                         className="bg-orange-500 h-1.5 rounded-full transition-all duration-500" 
                         style={{ width: `${accountBalances.credit.limit > 0 ? Math.min((accountBalances.credit.used / accountBalances.credit.limit) * 100, 100) : 0}%` }}
                       ></div>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                       <span className="text-emerald-400 font-medium">
                          Disp: {formatCurrency(accountBalances.credit.available)}
                       </span>
                       <span className="text-gray-500">
                          Lim: {formatCurrency(accountBalances.credit.limit)}
                       </span>
                  </div>
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