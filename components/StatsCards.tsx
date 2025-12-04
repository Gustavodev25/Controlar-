import React, { useState, useRef, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, Sparkles, CreditCard, Building, Link, Settings, Check, Info, X, Calendar } from './Icons';
import { DashboardStats, Transaction, ConnectedAccount } from '../types';
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
        accounts?: ConnectedAccount[];
    };
  };
  creditCardTransactions?: Transaction[];
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

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, isLoading = false, accountBalances, toggles, creditCardTransactions = [] }) => {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const configRef = useRef<HTMLDivElement>(null);

  const creditAccounts = accountBalances?.credit?.accounts || [];
  const primaryAccount = creditAccounts[0];

  // Debug State
  const [showDebug, setShowDebug] = useState(false);
  const [closingDay, setClosingDay] = useState(1);
  const [dueDay, setDueDay] = useState(10);

  // Sync closing day and due day from API if available
  useEffect(() => {
      if (primaryAccount) {
          if (primaryAccount.balanceCloseDate) {
            const closeDatePart = primaryAccount.balanceCloseDate.split('-')[2];
            if (closeDatePart) setClosingDay(parseInt(closeDatePart));
          }
          if (primaryAccount.balanceDueDate) {
            const dueDatePart = primaryAccount.balanceDueDate.split('-')[2];
            if (dueDatePart) setDueDay(parseInt(dueDatePart));
          }
      }
  }, [primaryAccount]);

  // Helper to calculate Invoice Due Date
  const getInvoiceMonth = (dateStr: string, closeDay: number, dueDay: number) => {
    if (!dateStr) return 'Desconhecido';
    const date = new Date(dateStr + 'T12:00:00');
    const day = date.getDate();
    
    let closingMonth = date.getMonth();
    let closingYear = date.getFullYear();

    // 1. Determine which Closing Cycle the transaction belongs to
    if (day >= closeDay) {
      // Belongs to NEXT month's closing
      closingMonth++;
      if (closingMonth > 11) {
        closingMonth = 0;
        closingYear++;
      }
    }
    
    // 2. Determine Due Date based on that Closing Cycle
    // If Due Day < Close Day, it means the Due Date wraps to the NEXT month relative to the Closing Date
    // e.g. Close 25th, Due 5th (Next Month)
    // If Due Day >= Close Day, it usually means Same Month (e.g. Close 1st, Due 10th)
    let dueMonth = closingMonth;
    let dueYear = closingYear;

    if (dueDay < closeDay) {
        dueMonth++;
        if (dueMonth > 11) {
            dueMonth = 0;
            dueYear++;
        }
    }

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${monthNames[dueMonth]}/${dueYear}`;
  };

  const today = new Date().toISOString().split('T')[0];
  const currentInvoiceLabel = getInvoiceMonth(today, closingDay, dueDay);

  // Calculate Next Invoice Label
  const getNextInvoiceLabel = (currentLabel: string) => {
    const [month, year] = currentLabel.split('/');
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    let monthIndex = monthNames.indexOf(month);
    let yearNum = parseInt(year);
    
    monthIndex++;
    if (monthIndex > 11) {
      monthIndex = 0;
      yearNum++;
    }
    return `${monthNames[monthIndex]}/${yearNum}`;
  };

  const nextInvoiceLabel = getNextInvoiceLabel(currentInvoiceLabel);
  const isInvoiceClosed = new Date().getDate() >= closingDay;

  // Filter transactions that match the current simulated invoice
  const simulatedInvoiceTransactions = creditCardTransactions.filter(t => getInvoiceMonth(t.date, closingDay, dueDay) === currentInvoiceLabel);
  const simulatedInvoiceTotal = simulatedInvoiceTransactions.reduce((acc, t) => t.type === 'expense' ? acc + t.amount : acc - t.amount, 0);

  const nextInvoiceTransactions = creditCardTransactions.filter(t => getInvoiceMonth(t.date, closingDay, dueDay) === nextInvoiceLabel);
  const nextInvoiceTotal = nextInvoiceTransactions.reduce((acc, t) => t.type === 'expense' ? acc + t.amount : acc - t.amount, 0);

  // --- API Bill Integration ---
  let displayCurrentTotal = simulatedInvoiceTotal;
  let displayNextTotal = nextInvoiceTotal;
  let isApiCurrent = false;
  let isApiNext = false;

  if (primaryAccount?.bills?.length) {
      const monthMap: Record<string, number> = {
          'Janeiro': 0, 'Fevereiro': 1, 'Março': 2, 'Abril': 3, 'Maio': 4, 'Junho': 5,
          'Julho': 6, 'Agosto': 7, 'Setembro': 8, 'Outubro': 9, 'Novembro': 10, 'Dezembro': 11
      };

      const getBillMonthYear = (dateStr: string) => {
          const d = new Date(dateStr);
          return { month: d.getMonth(), year: d.getFullYear() };
      };

      // Helper: matches a Label (Due Date Month) to a Bill (Due Date)
      // Label is now the Due Date Month/Year, so we match directly.
      const findBillForLabel = (label: string) => {
          const [lblMonthName, lblYearStr] = label.split('/');
          const lblMonth = monthMap[lblMonthName];
          const lblYear = parseInt(lblYearStr);

          return primaryAccount.bills?.find(b => {
              const { month, year } = getBillMonthYear(b.dueDate);
              return month === lblMonth && year === lblYear;
          });
      };

      const currentBill = findBillForLabel(currentInvoiceLabel);
      if (currentBill) {
          displayCurrentTotal = currentBill.totalAmount;
          isApiCurrent = true;
      }

      const nextBill = findBillForLabel(nextInvoiceLabel);
      if (nextBill) {
          displayNextTotal = nextBill.totalAmount;
          isApiNext = true;
      }
  }

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
                 <div className="flex items-center gap-1">
                    <button 
                        onClick={() => setShowDebug(!showDebug)}
                        className={`p-2 rounded-lg transition-colors ${showDebug ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-blue-400 hover:bg-gray-800/50'}`}
                        title="Debug Fatura"
                    >
                        <Info size={16} />
                    </button>

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
              </div>
              
              {/* Credit Limit Progress */}
              {!showDebug ? (
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
              ) : (
                  /* Debug Panel - Fatura atual */
                  <div className="w-full bg-gray-800/40 rounded-lg p-3 border border-blue-500/10 animate-fade-in">
                      <div className="flex flex-col gap-2 mb-3">
                          <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                  <span className="text-blue-400 font-bold text-xs uppercase tracking-wider">Status da Fatura</span>
                                  <div className="group relative">
                                      <Info size={12} className="text-gray-500 cursor-help" />
                                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 bg-black/90 text-gray-300 text-[10px] p-2 rounded border border-gray-700 z-50">
                                          Altere o dia de fechamento para ver a fatura fechada e a próxima em aberto.
                                      </div>
                                  </div>
                              </div>
                              
                              <div className="flex items-center bg-gray-900 rounded-md border border-gray-700 px-2 py-1">
                                  {primaryAccount ? (
                                    <span className="text-[9px] text-emerald-400 font-bold uppercase mr-1">Via API</span>
                                  ) : null}
                                  <input 
                                    type="number" 
                                    min="1" 
                                    max="31"
                                    value={closingDay}
                                    disabled={!!primaryAccount}
                                    onChange={(e) => setClosingDay(parseInt(e.target.value) || 1)}
                                    className={`w-8 bg-transparent text-white text-center text-xs font-bold focus:outline-none ${primaryAccount ? 'opacity-70 cursor-not-allowed' : ''}`}
                                  />
                              </div>
                          </div>
                      </div>
                      
                      {/* Invoices Summary */}
                      <div className="grid grid-cols-1 gap-2 mb-3">
                          {/* Current/Closed Invoice */}
                          <div className={`flex justify-between items-center p-2 rounded border ${isInvoiceClosed ? 'bg-blue-900/20 border-blue-500/30' : 'bg-gray-900/50 border-gray-800/50'}`}>
                              <div>
                                  <p className={`text-[10px] font-bold uppercase tracking-wide ${isInvoiceClosed ? 'text-blue-400' : 'text-gray-400'}`}>
                                      {isInvoiceClosed ? 'Fatura Fechada' : 'Fatura Atual'}
                                  </p>
                                  <p className="text-xs text-gray-500">{currentInvoiceLabel}</p>
                              </div>
                              <div className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                      {isApiCurrent && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 rounded border border-emerald-500/30">API</span>}
                                      <p className={`font-mono font-bold text-sm ${isInvoiceClosed ? 'text-white' : 'text-gray-300'}`}>
                                          {formatCurrency(displayCurrentTotal)}
                                      </p>
                                  </div>
                              </div>
                          </div>

                          {/* Next Invoice */}
                          <div className="flex justify-between items-center p-2 rounded bg-gray-900/30 border border-gray-800/30">
                              <div>
                                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">
                                      {isInvoiceClosed ? 'Fatura Atual (Em Aberto)' : 'Próxima Fatura'}
                                  </p>
                                  <p className="text-xs text-gray-600">{nextInvoiceLabel}</p>
                              </div>
                              <div className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                      {isApiNext && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 rounded border border-emerald-500/30">API</span>}
                                      <p className="text-gray-400 font-mono font-bold text-sm">
                                          {formatCurrency(displayNextTotal)}
                                      </p>
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div className="space-y-1">
                          <div className="flex justify-between text-[9px] text-gray-500 px-1 uppercase tracking-wider">
                              <span>Lançamentos na Fatura ({simulatedInvoiceTransactions.length})</span>
                              <span>Valor</span>
                          </div>
                          <div className="max-h-32 overflow-y-auto custom-scrollbar bg-gray-900 p-1 rounded border border-gray-800">
                              {simulatedInvoiceTransactions.length === 0 && <p className="text-gray-600 text-center text-[10px] py-2">Nenhuma transação encontrada</p>}
                              {simulatedInvoiceTransactions
                                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                  .map((t) => {
                                  return (
                                      <div key={t.id} className="flex justify-between items-center p-1.5 rounded text-[10px] border-b border-gray-800/50 last:border-0 bg-blue-500/5">
                                          <div className="flex items-center gap-2 overflow-hidden">
                                              <div className="w-1 h-1 rounded-full shrink-0 bg-blue-400"></div>
                                              <span className="text-gray-400 font-mono whitespace-nowrap">{t.date.slice(8)}/{t.date.slice(5,7)}</span>
                                              <span className="truncate text-gray-300" title={t.description}>{t.description}</span>
                                          </div>
                                          <span className={`font-mono ml-2 ${t.type === 'income' ? 'text-emerald-400' : 'text-gray-300'}`}>
                                              {formatCurrency(t.amount)}
                                          </span>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  </div>
              )}
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