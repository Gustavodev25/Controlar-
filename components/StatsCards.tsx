import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { TrendingUp, TrendingDown, Wallet, Sparkles, Building, Settings, Check, CreditCard, ChevronLeft, ChevronRight, Lock } from './Icons';
import { DashboardStats, Transaction, ConnectedAccount } from '../types';
import NumberFlow from '@number-flow/react';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator } from './Dropdown';

interface StatsCardsProps {
  stats: DashboardStats;
  isLoading?: boolean;
  accountBalances?: {
    checking: number;
    checkingAccounts?: ConnectedAccount[];
    credit: {
      used: number;
      available: number;
      limit: number;
      accounts?: ConnectedAccount[];
    };
  };
  creditCardTransactions?: Transaction[];
  dashboardDate?: string; // YYYY-MM
  toggles?: {
    includeChecking: boolean;
    setIncludeChecking: (v: boolean) => void;
    includeCredit: boolean;
    setIncludeCredit: (v: boolean) => void;
    creditCardUseTotalLimit?: boolean;
    setCreditCardUseTotalLimit?: (v: boolean) => void;
    creditCardUseFullLimit?: boolean;
    setCreditCardUseFullLimit?: (v: boolean) => void;
    includeOpenFinance?: boolean;
    setIncludeOpenFinance?: (v: boolean) => void;
    enabledCreditCardIds?: string[];
    setEnabledCreditCardIds?: (ids: string[]) => void;
  };
  isProMode?: boolean;
  onActivateProMode?: () => void;
  userPlan?: 'starter' | 'pro' | 'family';
  onUpgradeClick?: () => void;
  hideCards?: boolean;
  labels?: {
    balance?: string;
    income?: string;
    expense?: string;
    savings?: string;
  };
}

export const StatsCards: React.FC<StatsCardsProps> = ({ 
  stats, 
  isLoading = false, 
  accountBalances, 
  toggles, 
  creditCardTransactions = [], 
  dashboardDate, 
  isProMode = true, 
  onActivateProMode, 
  userPlan = 'starter', 
  onUpgradeClick,
  hideCards = false,
  labels
}) => {
  
  // Use enabledCreditCardIds from toggles (Synced with App.tsx)
  const cardsIncludedInExpenses = useMemo(() => {
    return new Set(toggles?.enabledCreditCardIds || []);
  }, [toggles?.enabledCreditCardIds]);

  const checkingAccounts = (accountBalances?.checkingAccounts || []).filter(acc => {
    const type = (acc.type || '').toUpperCase();
    const subtype = (acc.subtype || '').toUpperCase();
    const name = (acc.name || '').toUpperCase();
    
    // Filter out Savings accounts based on multiple criteria
    const isSavings = 
        type === 'SAVINGS' || 
        type === 'SAVINGS_ACCOUNT' ||
        subtype === 'SAVINGS' || 
        subtype === 'SAVINGS_ACCOUNT' ||
        name.includes('POUPANÇA') ||
        name.includes('POUPANCA');

    return !isSavings;
  });
  
  // Initialize or fallback to the first account if selection is invalid or null
  const [selectedCheckingAccountId, setSelectedCheckingAccountId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('finances_selected_checking_account');
      // If we have a stored ID, check if it's still valid in the filtered list (optimization: hard to check here without list, so just return it)
      return stored; 
    }
    return null;
  });
  
  // Ensure we always have a valid selection if accounts exist
  useEffect(() => {
    if (checkingAccounts.length > 0) {
      const isValid = selectedCheckingAccountId && checkingAccounts.some(acc => acc.id === selectedCheckingAccountId);
      if (!isValid) {
        setSelectedCheckingAccountId(checkingAccounts[0].id);
      }
    }
  }, [checkingAccounts, selectedCheckingAccountId]);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (selectedCheckingAccountId) {
        localStorage.setItem('finances_selected_checking_account', selectedCheckingAccountId);
      } else {
        localStorage.removeItem('finances_selected_checking_account');
      }
    }
  }, [selectedCheckingAccountId]);

  const [activeCardIndex, setActiveCardIndex] = useState(0);

  // Calculate credit card invoice for the filtered month
  // This calculates the total expenses on credit cards for the displayed period
  const creditCardInvoice = useMemo(() => {
    if (!dashboardDate || creditCardTransactions.length === 0) {
      // If no month filter or no transactions, show total from accountBalances
      return accountBalances?.credit?.used || 0;
    }

    // Filter transactions that belong to the selected month
    // Only count expenses (positive amounts or expense type transactions)
    const monthTransactions = creditCardTransactions.filter(tx => {
      // Check if transaction date starts with the dashboard month (YYYY-MM)
      if (!tx.date.startsWith(dashboardDate)) return false;
      // Only count completed transactions
      if (tx.status !== 'completed' && tx.status !== 'pending') return false;
      // Only count non-ignored transactions
      if ((tx as any).ignored) return false;
      return true;
    });

    // Sum up the amounts
    // Convention: expenses are positive amounts with type 'expense'
    const total = monthTransactions.reduce((sum, tx) => {
      // For credit card transactions, expenses increase the invoice
      if (tx.type === 'expense') {
        return sum + Math.abs(tx.amount);
      }
      // Payments/credits decrease the invoice (these would be type 'income' on credit cards)
      if (tx.type === 'income') {
        return sum - Math.abs(tx.amount);
      }
      return sum;
    }, 0);

    return Math.max(0, total); // Invoice can't be negative
  }, [creditCardTransactions, dashboardDate, accountBalances?.credit?.used]);

  // Get credit card accounts for display
  const creditAccounts = accountBalances?.credit?.accounts || [];
  const creditLimit = accountBalances?.credit?.limit || 0;
  const creditAvailable = accountBalances?.credit?.available || 0;

  // Calculate invoice per individual card - matches transactions to cards and filters by month
  const cardInvoices = useMemo(() => {
    // Get unique accountIds from transactions for fallback matching strategy
    const uniqueAccountIds = [...new Set(creditCardTransactions.map(tx => tx.accountId).filter(Boolean))];

    return creditAccounts.map((card, cardIndex) => {
      // Try to match transactions by accountId first
      let cardTransactions = creditCardTransactions.filter(tx =>
        tx.accountId === card.id
      );

      // If no match by accountId, try alternative matching strategies
      if (cardTransactions.length === 0) {
        // Strategy 1: If there are exactly N unique accountIds for N cards, map by index
        if (uniqueAccountIds.length === creditAccounts.length && uniqueAccountIds.length > 0) {
          const sortedAccountIds = [...uniqueAccountIds].sort();
          const targetAccountId = sortedAccountIds[cardIndex];
          cardTransactions = creditCardTransactions.filter(tx => tx.accountId === targetAccountId);
        }

        // Strategy 2: If still no match, and this is the only card, use all transactions
        if (cardTransactions.length === 0 && creditAccounts.length === 1) {
          cardTransactions = creditCardTransactions;
        }
      }

      // Filter by dashboard date (month) if specified
      let filteredTransactions = cardTransactions;
      if (dashboardDate) {
        filteredTransactions = cardTransactions.filter(tx =>
          tx.date && tx.date.startsWith(dashboardDate)
        );
      }

      // Calculate invoice from filtered transactions (simple sum for the month)
      let invoiceValue = 0;

      if (filteredTransactions.length > 0) {
        // Sum up expenses for the selected month
        invoiceValue = filteredTransactions.reduce((sum, tx) => {
          if ((tx as any).ignored) return sum;
          // For credit cards: expenses add to invoice, income/payments reduce it
          if (tx.type === 'expense') {
            return sum + Math.abs(tx.amount);
          } else if (tx.type === 'income') {
            return sum - Math.abs(tx.amount);
          }
          return sum;
        }, 0);
        invoiceValue = Math.max(0, invoiceValue); // Invoice can't be negative
      } else {
        // Fallback to card balance (from API)
        invoiceValue = Math.abs(card.balance || 0);
      }

      // Calculate limit and available for this card
      // If card has its own values, use them. Otherwise, estimate proportionally
      let cardLimit = card.creditLimit || 0;
      let cardAvailable = card.availableCreditLimit || 0;

      // If this card doesn't have its own limit data,
      // estimate proportionally from the global totals
      if (cardLimit === 0 && creditLimit > 0) {
        const totalBalance = creditAccounts.reduce((sum, c) => sum + Math.abs(c.balance || 0), 0);
        const cardProportion = totalBalance > 0 ? Math.abs(card.balance || 0) / totalBalance : 1 / creditAccounts.length;
        cardLimit = creditLimit * cardProportion;
      }

      // IMPORTANT: Calculate available based on the CURRENT month's invoice, not the fixed balance
      // This makes the available value change when the month filter changes
      if (cardLimit > 0) {
        cardAvailable = Math.max(0, cardLimit - invoiceValue);
      }

      return {
        cardId: card.id,
        invoice: invoiceValue,
        limit: cardLimit,
        available: cardAvailable
      };
    });
  }, [creditAccounts, creditCardTransactions, dashboardDate, creditLimit]);

  // Navigation functions for credit card carousel
  const goToNextCard = () => {
    if (creditAccounts.length > 0) {
      setActiveCardIndex(prev => (prev + 1) % creditAccounts.length);
    }
  };

  const goToPrevCard = () => {
    if (creditAccounts.length > 0) {
      setActiveCardIndex(prev => (prev - 1 + creditAccounts.length) % creditAccounts.length);
    }
  };

  // Get current card data
  const currentCard = creditAccounts[activeCardIndex];
  const currentCardInvoice = cardInvoices[activeCardIndex] || { invoice: 0, limit: 0, available: 0 };

  // Drag state for card carousel
  const [isDragging, setIsDragging] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);

  // Handle drag end to switch cards
  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    const threshold = 50; // Minimum drag distance to trigger card change

    if (info.offset.x < -threshold) {
      // Swiped left - go to next card
      goToNextCard();
    } else if (info.offset.x > threshold) {
      // Swiped right - go to previous card
      goToPrevCard();
    }
  };

  // Calculate displayed checking balance based on selection
  const displayedCheckingBalance = selectedCheckingAccountId
    ? (checkingAccounts.find(acc => acc.id === selectedCheckingAccountId)?.balance ?? 0)
    : (accountBalances?.checking ?? 0);

  const selectedCheckingAccount = selectedCheckingAccountId
    ? checkingAccounts.find(acc => acc.id === selectedCheckingAccountId)
    : null;

  // Calculate adjusted Total Balance based on selected checking account
  const adjustedTotalBalance = useMemo(() => {
    // Safety check
    if (!accountBalances || !toggles) return stats.totalBalance;

    // Check if Checking is included in the global stats calculation
    const isCheckingIncluded = toggles.includeChecking;

    if (!isCheckingIncluded) {
      return stats.totalBalance;
    }

    const totalChecking = accountBalances.checking || 0;
    
    // Adjust: Remove total, add displayed (which is selected or total)
    return stats.totalBalance - totalChecking + displayedCheckingBalance;
  }, [stats.totalBalance, toggles, accountBalances, displayedCheckingBalance]);

  // Helper to translate account type/subtype to Portuguese
  const getAccountTypeLabel = (acc: ConnectedAccount) => {
    const type = (acc.type || '').toUpperCase();
    const subtype = (acc.subtype || '').toUpperCase();

    // Se o type for CHECKING, é conta corrente
    if (type === 'CHECKING') return 'Conta Corrente';

    if (subtype === 'CHECKING_ACCOUNT' || subtype === 'CHECKING') return 'Conta Corrente';
    if (subtype === 'SALARY_ACCOUNT' || subtype === 'SALARY') return 'Conta Salário';
    if (subtype === 'PAYMENT_ACCOUNT' || subtype === 'PAYMENT') return 'Conta de Pagamento';
    if (subtype === 'SAVINGS_ACCOUNT' || subtype === 'SAVINGS') return 'Poupança';
    if (subtype === 'INDIVIDUAL') return 'Conta Corrente';

    // Fallback: mostra o subtype ou type
    return subtype || type || 'Conta Corrente';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[#30302E] p-6 rounded-xl shadow-sm border border-gray-800 flex items-center justify-between">
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
      {!hideCards && accountBalances && toggles && (isProMode || userPlan === 'starter') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Checking Account */}
          <div className={`relative p-4 rounded-xl shadow-sm border transition-all duration-200 h-[120px] flex flex-col justify-between ${toggles.includeChecking ? 'bg-[#30302E] border-gray-800' : 'bg-[#30302E]/50 border-gray-800/50'}`}>
            {/* Blur overlay for Manual Mode */}
            {!isProMode && userPlan === 'starter' && (
              <div
                onClick={userPlan === 'starter' ? onUpgradeClick : onActivateProMode}
                className="absolute inset-0 z-20 bg-[#30302E]/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center cursor-pointer group transition-all hover:bg-[#30302E]/70"
              >
                <div className="p-3 bg-[#d97757]/20 rounded-xl mb-2 group-hover:scale-110 transition-transform">
                  {userPlan === 'starter' ? <Lock size={24} className="text-[#d97757]" /> : <Building size={24} className="text-[#d97757]" />}
                </div>
                <p className="text-sm font-bold text-white">Modo Auto</p>
                {userPlan === 'starter' ? (
                  <span className="mt-2 text-xs text-amber-500 font-medium">
                    Funcionalidade Pro
                  </span>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">Ative para ver saldo automático</p>
                )}
              </div>
            )}
            <div className="flex items-start justify-between">
              <div className={`flex items-center gap-3 ${!toggles.includeChecking ? 'opacity-50' : ''}`}>
                <div className="p-2.5 bg-emerald-900/20 rounded-lg text-emerald-400">
                  <Building size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-400 font-medium">
                      {selectedCheckingAccount
                        ? (selectedCheckingAccount.institution || selectedCheckingAccount.name || 'Conta')
                        : 'Saldo em Conta'}
                    </p>
                    {checkingAccounts.length > 1 && !selectedCheckingAccountId && (
                      <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded font-mono">
                        {checkingAccounts.length} contas
                      </span>
                    )}
                    {selectedCheckingAccountId && (
                      <span className="text-[10px] text-emerald-500 bg-emerald-900/30 px-1.5 py-0.5 rounded font-mono border border-emerald-500/30">
                        1 de {checkingAccounts.length}
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-white mt-0.5">
                    <NumberFlow
                      value={displayedCheckingBalance}
                      format={{ style: 'currency', currency: 'BRL' }}
                      locales="pt-BR"
                    />
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Dropdown>
                  <DropdownTrigger className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 transition-colors data-[state=open]:bg-gray-800 data-[state=open]:text-white">
                    <Settings size={16} />
                  </DropdownTrigger>
                  
                  <DropdownContent width="w-72" align="right" portal>
                    <DropdownLabel>Contas Correntes</DropdownLabel>
                    
                    {/* Toggle include in balance */}
                    <div
                      onClick={() => toggles.setIncludeChecking(!toggles.includeChecking)}
                      className="flex items-center justify-between px-2.5 py-2 hover:bg-gray-800 rounded-lg cursor-pointer transition-colors group mx-1 my-1"
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded bg-emerald-900/30 text-emerald-400">
                          <Wallet size={14} />
                        </div>
                        <span className="text-sm text-gray-300 group-hover:text-white">Incluir no Saldo</span>
                      </div>
                      <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 ${toggles.includeChecking ? 'bg-[#d97757]' : 'bg-gray-700'}`}>
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${toggles.includeChecking ? 'translate-x-5' : 'translate-x-1'}`} />
                      </div>
                    </div>

                    <DropdownSeparator />
                    
                    <DropdownLabel>Suas Contas</DropdownLabel>
                    
                    {checkingAccounts.length === 0 ? (
                       <div className="px-3 py-2 text-sm text-gray-500 text-center">Nenhuma conta conectada</div>
                    ) : (
                      <div className="p-1 space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                        {checkingAccounts.map((acc) => (
                          <div
                            key={acc.id}
                            onClick={() => setSelectedCheckingAccountId(acc.id)}
                            className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-all ${selectedCheckingAccountId === acc.id
                              ? 'bg-emerald-900/30 border border-emerald-500/30'
                              : 'bg-transparent hover:bg-gray-800'
                              }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="p-1.5 rounded bg-emerald-900/30 text-emerald-400 flex-shrink-0">
                                <Building size={14} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-white font-medium truncate">{acc.institution || acc.name || 'Conta'}</p>
                                <p className="text-[10px] text-gray-500 truncate">{getAccountTypeLabel(acc)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-bold font-mono flex-shrink-0 ${(acc.balance ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {formatCurrency(acc.balance ?? 0)}
                              </p>
                              {selectedCheckingAccountId === acc.id && (
                                <Check size={14} className="text-emerald-400" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </DropdownContent>
                </Dropdown>
              </div>
            </div>
          </div>

          {/* Credit Card Carousel - Improved Fluid Stack */}
          <div
            ref={constraintsRef}
            className="relative h-[120px] perspective-[1000px]"
          >
            {/* Blur overlay for Manual Mode */}
            {!isProMode && userPlan === 'starter' && (
              <div
                onClick={userPlan === 'starter' ? onUpgradeClick : onActivateProMode}
                className="absolute inset-0 z-20 bg-[#30302E]/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center cursor-pointer group transition-all hover:bg-[#30302E]/70"
              >
                <div className="p-3 bg-[#d97757]/20 rounded-xl mb-2 group-hover:scale-110 transition-transform">
                  {userPlan === 'starter' ? <Lock size={24} className="text-[#d97757]" /> : <CreditCard size={24} className="text-[#d97757]" />}
                </div>
                <p className="text-sm font-bold text-white">Modo Auto</p>
                {userPlan === 'starter' ? (
                  <span className="mt-2 text-xs text-amber-500 font-medium">
                    Funcionalidade Pro
                  </span>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">Ative para ver cartões conectados</p>
                )}
              </div>
            )}
            <AnimatePresence mode="popLayout">
              {creditAccounts.length > 0 ? (
                creditAccounts.map((card, index) => {
                  // We only render the active card and the next 2 cards for the stack effect
                  // But to make it truly fluid with AnimatePresence, we can render them all 
                  // and control visibility via variants, OR simpler:
                  // Render the stack conceptually.

                  // Actually, to get the "popLayout" working for the active card replacement,
                  // we should structure it as:
                  // 1. Background Stack (Static items animating to new positions)
                  // 2. Active Card (The one draggable)

                  // Let's use the approach where we map all cards but style them based on offset
                  const offset = (index - activeCardIndex + creditAccounts.length) % creditAccounts.length;

                  // We only want to render the top 3 cards visually to avoid DOM clutter and z-fighting
                  // But we need to render the "exiting" card too.
                  // Since we are mapping ALL cards, we can just control opacity/z-index.

                  if (offset > 2 && offset !== creditAccounts.length - 1) {
                    // Hide cards that are deep in the stack, unless it's the one that might be "previous" (for reverse anims)
                    // For simplicity in this specific requested flow "swiping", we focus on the forward stack.
                    return null;
                  }

                  const cardInvoice = cardInvoices[index] || { invoice: 0, limit: 0, available: 0 };
                  const isCurrent = offset === 0;
                  const isNext = offset === 1;
                  const isNextNext = offset === 2;

                  // Dynamic z-index
                  const zIndex = creditAccounts.length - offset;

                  return (
                    <motion.div
                      key={card.id}
                      layoutId={isCurrent ? undefined : `card-${card.id}`} // Only layout animate background cards
                      initial={false}
                      animate={{
                        scale: isCurrent ? 1 : 1 - (offset * 0.05),
                        y: isCurrent ? 0 : offset * 10, // Stack effect downwards
                        z: isCurrent ? 0 : -offset, // slight depth
                        opacity: isCurrent ? 1 : 1 - (offset * 0.2),
                        zIndex: zIndex,
                        x: 0
                      }}
                      // Only the current card gets the drag/swipe logic
                      drag={isCurrent && creditAccounts.length > 1 ? "x" : false}
                      dragConstraints={{ left: 0, right: 0 }} // We want it to snap back or fly away
                      dragElastic={0.2}
                      onDragStart={() => setIsDragging(true)}
                      onDragEnd={(e, { offset: swipeOffset, velocity }) => {
                        setIsDragging(false);
                        if (!isCurrent) return;
                        const swipeThreshold = 100;
                        if (swipeOffset.x < -swipeThreshold || velocity.x < -500) {
                          // Swipe Left -> Next Card
                          goToNextCard();
                        } else if (swipeOffset.x > swipeThreshold || velocity.x > 500) {
                          // Swipe Right -> Prev Card
                          goToPrevCard();
                        }
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30
                      }}
                      className={`absolute inset-0 p-4 rounded-xl border flex flex-col justify-between h-[120px] shadow-lg ${isCurrent
                        ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 cursor-grab active:cursor-grabbing'
                        : 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700/50 pointer-events-none'
                        }`}
                      style={{
                        transformStyle: 'preserve-3d',
                        boxShadow: isCurrent
                          ? '0 8px 30px -10px rgba(0, 0, 0, 0.5)'
                          : '0 4px 15px -5px rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      {/* Card Content */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-lg ${isCurrent ? 'bg-orange-900/20 text-orange-400' : 'bg-gray-700/20 text-gray-500'}`}>
                            <CreditCard size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-medium truncate max-w-[120px] ${isCurrent ? 'text-gray-400' : 'text-gray-500'}`}>
                                {card.institution || card.name || 'Cartão'}
                              </p>
                              {isCurrent && creditAccounts.length > 1 && (
                                <span className="text-[10px] text-orange-400 bg-orange-900/30 px-1.5 py-0.5 rounded font-mono border border-orange-500/30">
                                  {index + 1}/{creditAccounts.length}
                                </span>
                              )}
                            </div>
                            <div className="flex items-baseline gap-2">
                              <p className={`text-2xl font-bold mt-0.5 ${isCurrent ? 'text-white' : 'text-gray-400'}`}>
                                <NumberFlow
                                  value={cardInvoice.invoice}
                                  format={{ style: 'currency', currency: 'BRL' }}
                                  locales="pt-BR"
                                />
                              </p>
                              {isCurrent && (
                                <span className="text-xs text-gray-500 font-medium">
                                  {dashboardDate ? 'mês' : 'atual'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Settings button and Swipe Hint (only on current) */}
                        {isCurrent && (
                          <div className="flex items-center gap-2">
                            {/* Settings Button */}
                             <Dropdown>
                                <DropdownTrigger asChild>
                                  <motion.button
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    onPointerDown={(e) => e.stopPropagation()} // Prevent drag start
                                    className={`p-1.5 rounded-lg transition-colors ${cardsIncludedInExpenses.size > 0
                                      ? 'bg-orange-900/50 text-orange-400'
                                      : 'bg-gray-800/50 hover:bg-gray-700 text-gray-400 hover:text-orange-400'
                                      }`}
                                    title="Configurações do cartão"
                                  >
                                    <Settings size={14} />
                                  </motion.button>
                                </DropdownTrigger>
                                
                                <DropdownContent width="w-[280px]" align="right" className="max-h-[300px] overflow-y-auto custom-scrollbar" portal>
                                   <DropdownLabel>Configurações do Cartão</DropdownLabel>
                                   <div className="px-2.5 py-1">
                                      <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2 font-medium">Fatura nas Despesas</p>
                                      <div className="space-y-1">
                                        {creditAccounts.map((card, index) => {
                                          const cardInvoice = cardInvoices[index];
                                          const isEnabled = cardsIncludedInExpenses.has(card.id);

                                          const toggleCard = () => {
                                            const newSet = new Set(cardsIncludedInExpenses);
                                            if (isEnabled) newSet.delete(card.id);
                                            else newSet.add(card.id);
                                            
                                            // Update parent state (App.tsx)
                                            if (toggles?.setEnabledCreditCardIds) {
                                              toggles.setEnabledCreditCardIds(Array.from(newSet));
                                            }
                                          };

                                          return (
                                            <div
                                              key={`expense-${card.id}`}
                                              onClick={(e) => { e.stopPropagation(); toggleCard(); }}
                                              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${isEnabled ? 'bg-orange-900/30 border border-orange-500/30' : 'bg-transparent hover:bg-gray-800'
                                                }`}
                                            >
                                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <div className={`p-1 rounded ${isEnabled ? 'bg-orange-900/30 text-orange-400' : 'bg-gray-700/50 text-gray-500'}`}>
                                                  <TrendingDown size={10} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                  <p className="text-xs text-white font-medium truncate">{card.institution || card.name || 'Cartão'}</p>
                                                </div>
                                                <p className="text-[10px] text-gray-500 font-mono">{formatCurrency(cardInvoice?.invoice || 0)}</p>
                                              </div>
                                              {isEnabled && <Check size={12} className="text-orange-400 ml-1" />}
                                            </div>
                                          );
                                        })}
                                      </div>
                                   </div>
                                   
                                   {/* Summary */}
                                    {cardsIncludedInExpenses.size > 0 && (
                                      <>
                                        <DropdownSeparator />
                                        <div className="px-2.5 py-2">
                                          <p className="text-orange-400 text-xs">
                                            + {formatCurrency(cardInvoices.filter((_, i) => cardsIncludedInExpenses.has(creditAccounts[i]?.id)).reduce((sum, c) => sum + c.invoice, 0))} será somado às despesas
                                          </p>
                                        </div>
                                      </>
                                    )}

                                </DropdownContent>
                             </Dropdown>

                            {/* Swipe Hint */}
                            {creditAccounts.length > 1 && !isDragging && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex items-center gap-0.5 text-gray-500"
                              >
                                <ChevronLeft size={14} className="text-gray-600" />
                                <ChevronRight size={14} className="text-gray-600" />
                              </motion.div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="w-full">
                        {/* Progress bar track - always visible */}
                        <div className={`w-full rounded-full h-2.5 mb-2 overflow-hidden ${isCurrent ? 'bg-gray-700' : 'bg-gray-800/40'}`}>
                          {(() => {
                            // Use the card's calculated limit (may be proportional)
                            const limit = cardInvoice.limit || 0;
                            // Use absolute value as extra safety for progress bar
                            const invoice = Math.abs(cardInvoice.invoice || 0);

                            // Calculate percentage width
                            let widthPercentage = 0;
                            if (limit > 0) {
                              widthPercentage = Math.min((invoice / limit) * 100, 100);
                              // Ensure a minimal visibility slice if there's any invoice
                              if (invoice > 0 && widthPercentage < 3) widthPercentage = 3;
                            } else if (invoice > 0) {
                              // Fallback if no limit is known but there is an invoice
                              widthPercentage = 100;
                            }

                            // Calculate color based on ratio (if limit exists)
                            let colorClass = 'from-orange-500 to-orange-400';
                            if (limit > 0) {
                              const ratio = invoice / limit;
                              if (ratio > 0.8) colorClass = 'from-red-600 to-red-400';
                              else if (ratio > 0.5) colorClass = 'from-yellow-500 to-yellow-400';
                            } else if (invoice > 0) {
                              // No limit but has invoice - use a neutral or caution color
                              colorClass = 'from-blue-500 to-blue-400';
                            }

                            return (
                              <motion.div
                                className={`h-full rounded-full bg-gradient-to-r ${colorClass}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${widthPercentage}%` }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                                style={{
                                  opacity: isCurrent ? 1 : 0.5,
                                  minWidth: invoice > 0 ? '8px' : '0px' // Garantir visibilidade mínima
                                }}
                              />
                            );
                          })()}
                        </div>
                        {isCurrent && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-emerald-400 font-medium">
                              Disp: {formatCurrency(cardInvoice.available || 0)}
                            </span>
                            {/* Dot indicators */}
                            {creditAccounts.length > 1 && (
                              <div className="flex gap-1.5">
                                {creditAccounts.map((_, idx) => (
                                  <motion.div
                                    key={idx}
                                    animate={{
                                      width: idx === activeCardIndex ? 16 : 6,
                                      backgroundColor: idx === activeCardIndex ? '#fb923c' : '#4b5563'
                                    }}
                                    className="h-1.5 rounded-full"
                                  />
                                ))}
                              </div>
                            )}
                            <span className="text-gray-500">
                              Lim: {formatCurrency(cardInvoice.limit || 0)}
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                /* Empty State (Same as before) */
                <div className="absolute inset-0 p-4 rounded-xl shadow-sm border bg-[#30302E]/50 border-gray-800/50 flex flex-col justify-between h-[120px]">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 opacity-50">
                      <div className="p-2.5 bg-orange-900/20 rounded-lg text-orange-400">
                        <CreditCard size={20} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 font-medium">Cartão de Crédito</p>
                        <div className="flex items-baseline gap-2">
                          <p className="text-2xl font-bold text-white mt-0.5">
                            <NumberFlow
                              value={creditCardInvoice}
                              format={{ style: 'currency', currency: 'BRL' }}
                              locales="pt-BR"
                            />
                          </p>
                          <span className="text-xs text-gray-500 font-medium">
                            {dashboardDate ? 'fatura do mês' : 'fatura atual'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-full opacity-50">
                    <div className="w-full bg-gray-800 rounded-full h-1.5 mb-2 overflow-hidden">
                      <div
                        className="bg-orange-500 h-1.5 rounded-full"
                        style={{
                          width: creditLimit > 0
                            ? `${Math.min((creditCardInvoice / creditLimit) * 100, 100)}%`
                            : '0%'
                        }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-emerald-400 font-medium">
                        Disp: {formatCurrency(creditAvailable)}
                      </span>
                      <span className="text-gray-500">
                        Lim: {formatCurrency(creditLimit)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>

        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#30302E] p-6 rounded-xl shadow-sm border border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 font-medium">{labels?.balance || 'Saldo Total'}</p>
            <p className={`text-2xl font-bold mt-1 ${adjustedTotalBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
              <NumberFlow
                value={adjustedTotalBalance}
                format={{ style: 'currency', currency: 'BRL' }}
                locales="pt-BR"
              />
            </p>
          </div>
          <div className="p-3 bg-blue-900/20 rounded-lg text-blue-400">
            <Wallet size={24} />
          </div>
        </div>

        <div className="bg-[#30302E] p-6 rounded-xl shadow-sm border border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 font-medium">{labels?.income || 'Receitas'}</p>
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

        <div className="bg-[#30302E] p-6 rounded-xl shadow-sm border border-gray-800 flex items-center justify-between relative">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-400 font-medium">{labels?.expense || 'Despesas'}</p>
              {!hideCards && cardsIncludedInExpenses.size > 0 && (
                <span className="text-[10px] text-orange-400 bg-orange-900/30 px-1.5 py-0.5 rounded font-medium">
                  + {cardsIncludedInExpenses.size} cartão{cardsIncludedInExpenses.size > 1 ? 'es' : ''}
                </span>
              )}
            </div>
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

        <div className="bg-[#30302E] p-6 rounded-xl shadow-sm border border-gray-800 flex items-center justify-between relative overflow-hidden">
          <div className="relative z-10">
            {/* Changed generic label to accommodate Year/Custom filters */}
            <p className="text-sm text-gray-400 font-medium">{labels?.savings || 'Resultado do Período'}</p>
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
    </div >
  );
};  