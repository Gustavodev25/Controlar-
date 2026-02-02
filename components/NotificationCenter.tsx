import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, AlertTriangle, Info, Check, Sparkles, Clock, Calendar, TrendingUp, Target, RotateCcw } from './Icons';
import { Reminder, Budget, Transaction, Subscription } from '../types';
import { getCurrentLocalMonth, toLocalISODate } from '../utils/dateUtils';

export interface SystemNotification {
  id: string;
  type: 'system' | 'alert' | 'update' | 'budget_warning' | 'budget_danger';
  title: string;
  message: string;
  date: string;
  read: boolean;
  archived?: boolean;
}

interface NotificationCenterProps {
  reminders: Reminder[];
  budgets: Budget[];
  transactions: Transaction[];
  subscriptions?: Subscription[];
  externalNotifications?: SystemNotification[];
  onArchiveNotification?: (id: string) => void;
  onDeleteNotification?: (id: string) => void;
  onMarkReadNotification?: (id: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  reminders = [],
  budgets = [],
  transactions = [],
  subscriptions = [],
  externalNotifications = [],
  onArchiveNotification,
  onDeleteNotification,
  onMarkReadNotification
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mock de notificações do sistema (mantendo vazio por enquanto ou poderia ter mensagens reais de sistema)
  const [systemNotifications, setSystemNotifications] = useState<SystemNotification[]>([]);

  // Estado para IDs de lembretes/assinaturas "limpos" (dismissed) - persistido em localStorage
  const [dismissedReminderIds, setDismissedReminderIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('notification_dismissed_reminders');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [dismissedSubscriptionIds, setDismissedSubscriptionIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('notification_dismissed_subscriptions');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Persist dismissed IDs to localStorage
  useEffect(() => {
    localStorage.setItem('notification_dismissed_reminders', JSON.stringify(dismissedReminderIds));
  }, [dismissedReminderIds]);
  useEffect(() => {
    localStorage.setItem('notification_dismissed_subscriptions', JSON.stringify(dismissedSubscriptionIds));
  }, [dismissedSubscriptionIds]);

  // Identificar lembretes vencidos ou vencendo hoje (excluindo os dismissed)
  const alertReminders = useMemo(() => {
    return reminders.filter(r => {
      if (dismissedReminderIds.includes(r.id)) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date((r.dueDate || toLocalISODate()) + "T00:00:00");
      due.setHours(0, 0, 0, 0);
      return due <= today;
    });
  }, [reminders, dismissedReminderIds]);

  // Identificar assinaturas vencidas ou perto do prazo (últimos 3 dias)
  const alertSubscriptions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    return subscriptions.filter(sub => {
      if (dismissedSubscriptionIds.includes(sub.id)) return false;
      if (sub.status === 'canceled') return false;

      // Verificar se já foi paga este mês
      if (sub.paidMonths?.includes(currentMonth)) return false;

      // Se tem lastPaymentDate, calcular quando vence
      if (sub.lastPaymentDate) {
        const lastPayment = new Date(sub.lastPaymentDate + "T00:00:00");
        let nextDue: Date;

        if (sub.billingCycle === 'yearly') {
          nextDue = new Date(lastPayment);
          nextDue.setFullYear(nextDue.getFullYear() + 1);
        } else {
          nextDue = new Date(lastPayment);
          nextDue.setMonth(nextDue.getMonth() + 1);
        }

        const daysUntilDue = Math.ceil((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        // Mostrar se está atrasada (negativo) ou perto (3 dias)
        return daysUntilDue <= 3;
      }

      return false;
    });
  }, [subscriptions, dismissedSubscriptionIds]);

  // Gerar alertas de orçamento
  const budgetAlerts = useMemo(() => {
    const alerts: SystemNotification[] = [];
    const currentMonth = getCurrentLocalMonth();

    budgets.forEach(budget => {
      const spent = transactions
        .filter(t =>
          t.type === 'expense' &&
          t.category === budget.category &&
          t.date.startsWith(currentMonth) &&
          (!budget.memberId || t.memberId === budget.memberId)
        )
        .reduce((acc, t) => acc + t.amount, 0);

      const percentage = (spent / budget.limitAmount) * 100;

      if (percentage >= 100) {
        alerts.push({
          id: `budget-danger-${budget.id}-${currentMonth}`,
          type: 'budget_danger',
          title: 'Orçamento Excedido',
          message: `Você excedeu o limite de ${budget.category} (${percentage.toFixed(0)}%).`,
          date: toLocalISODate(),
          read: false
        });
      } else if (percentage >= budget.alertThreshold) {
        alerts.push({
          id: `budget-warning-${budget.id}-${currentMonth}`,
          type: 'budget_warning',
          title: 'Alerta de Orçamento',
          message: `Você atingiu ${percentage.toFixed(0)}% do limite de ${budget.category}.`,
          date: toLocalISODate(),
          read: false
        });
      }
    });

    return alerts;
  }, [budgets, transactions]);

  const combinedSystem = [...externalNotifications.filter(n => !n.archived), ...systemNotifications];
  const allNotifications = [...alertReminders, ...alertSubscriptions, ...budgetAlerts, ...combinedSystem];
  const unreadCount = allNotifications.filter(n => 'read' in n ? !n.read : true).length; // Simplificação, assumindo que reminders contam como não lidos sempre que aparecem aqui

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllRead = () => {
    // Limpar todos os alertas: system notifications, lembretes e assinaturas
    setSystemNotifications(prev => prev.map(n => ({ ...n, read: true })));

    // Adicionar todos os lembretes atuais à lista de dismissed
    const reminderIdsToDismiss = alertReminders.map(r => r.id);
    setDismissedReminderIds(prev => [...new Set([...prev, ...reminderIdsToDismiss])]);

    // Adicionar todas as assinaturas atuais à lista de dismissed  
    const subscriptionIdsToDismiss = alertSubscriptions.map(s => s.id);
    setDismissedSubscriptionIds(prev => [...new Set([...prev, ...subscriptionIdsToDismiss])]);
  };

  // Função para limpar um lembrete específico
  const dismissReminder = (id: string) => {
    setDismissedReminderIds(prev => [...prev, id]);
  };

  // Função para limpar uma assinatura específica
  const dismissSubscription = (id: string) => {
    setDismissedSubscriptionIds(prev => [...prev, id]);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl transition-all ${isOpen ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: -5, scale: 0.95, filter: "blur(10px)", opacity: 0 }}
            animate={{ y: 0, scale: 1, filter: "blur(0px)", opacity: 1 }}
            exit={{ y: -5, scale: 0.95, opacity: 0, filter: "blur(10px)" }}
            transition={{ duration: 0.4, ease: "circInOut", type: "spring", stiffness: 200, damping: 20 }}
            className="absolute right-0 mt-3 w-80 md:w-96 bg-[#30302E] border border-[#373734] rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.2)] ring-1 ring-white/5 overflow-hidden z-50 origin-top-right"
          >
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950/50 backdrop-blur-sm">
              <h3 className="font-bold text-white">Central de Notificações</h3>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[10px] font-bold text-[#d97757] hover:text-[#c56a4d] flex items-center gap-1">
                  <Check size={12} /> Limpar
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">

              {/* Alertas de Lembretes */}
              {alertReminders.length > 0 && (
                <div className="p-2">
                  <p className="px-3 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Contas Vencendo</p>
                  {alertReminders.map(r => {
                    const isIncome = r.type === 'income';
                    return (
                      <div key={r.id} className={`m-1 p-3 rounded-xl flex items-start gap-3 border ${isIncome ? 'bg-green-900/10 border-green-900/30' : 'bg-red-900/10 border-red-900/30'} group`}>
                        <div className={`p-2 rounded-lg shrink-0 ${isIncome ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {isIncome ? <TrendingUp size={16} /> : <AlertTriangle size={16} />}
                        </div>
                        <div className="flex-1">
                          <h4 className={`text-sm font-bold ${isIncome ? 'text-green-200' : 'text-red-200'}`}>{r.description}</h4>
                          <p className={`text-xs mt-1 flex items-center gap-1 ${isIncome ? 'text-green-400/70' : 'text-red-400/70'}`}>
                            <Clock size={12} /> {isIncome ? 'Recebimento Previsto:' : 'Vence:'} {new Date((r.dueDate || toLocalISODate()) + "T00:00:00").toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <button
                          onClick={() => dismissReminder(r.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition-all"
                          title="Limpar alerta"
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Alertas de Assinaturas */}
              {alertSubscriptions.length > 0 && (
                <div className="p-2">
                  {alertReminders.length > 0 && <div className="h-px bg-gray-800 mx-2 my-2"></div>}
                  <p className="px-3 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Assinaturas Pendentes</p>
                  {alertSubscriptions.map(sub => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    let nextDue: Date | null = null;
                    let daysUntilDue = 0;

                    if (sub.lastPaymentDate) {
                      const lastPayment = new Date(sub.lastPaymentDate + "T00:00:00");
                      nextDue = new Date(lastPayment);
                      if (sub.billingCycle === 'yearly') {
                        nextDue.setFullYear(nextDue.getFullYear() + 1);
                      } else {
                        nextDue.setMonth(nextDue.getMonth() + 1);
                      }
                      daysUntilDue = Math.ceil((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    }

                    const isOverdue = daysUntilDue < 0;

                    return (
                      <div key={sub.id} className={`m-1 p-3 rounded-xl flex items-start gap-3 border ${isOverdue ? 'bg-red-900/10 border-red-900/30' : 'bg-yellow-900/10 border-yellow-900/30'} group`}>
                        <div className={`p-2 rounded-lg shrink-0 ${isOverdue ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          <RotateCcw size={16} />
                        </div>
                        <div className="flex-1">
                          <h4 className={`text-sm font-bold ${isOverdue ? 'text-red-200' : 'text-yellow-200'}`}>{sub.name}</h4>
                          <p className={`text-xs mt-1 flex items-center gap-1 ${isOverdue ? 'text-red-400/70' : 'text-yellow-400/70'}`}>
                            <Clock size={12} />
                            {isOverdue
                              ? `Atrasada há ${Math.abs(daysUntilDue)} dia${Math.abs(daysUntilDue) !== 1 ? 's' : ''}`
                              : daysUntilDue === 0
                                ? 'Vence hoje'
                                : `Vence em ${daysUntilDue} dia${daysUntilDue !== 1 ? 's' : ''}`
                            }
                            {nextDue && ` (${nextDue.toLocaleDateString('pt-BR')})`}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            R$ {sub.amount.toFixed(2)} / {sub.billingCycle === 'yearly' ? 'ano' : 'mês'}
                          </p>
                        </div>
                        <button
                          onClick={() => dismissSubscription(sub.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition-all"
                          title="Limpar alerta"
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Alertas de Orçamento */}
              {budgetAlerts.length > 0 && (
                <div className="p-2">
                  {(alertReminders.length > 0 || alertSubscriptions.length > 0) && <div className="h-px bg-gray-800 mx-2 my-2"></div>}
                  <p className="px-3 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Orçamentos</p>
                  {budgetAlerts.map(alert => (
                    <div key={alert.id} className={`m-1 p-3 rounded-xl flex items-start gap-3 border ${alert.type === 'budget_danger' ? 'bg-red-900/10 border-red-900/30' : 'bg-yellow-900/10 border-yellow-900/30'}`}>
                      <div className={`p-2 rounded-lg shrink-0 ${alert.type === 'budget_danger' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        <Target size={16} />
                      </div>
                      <div>
                        <h4 className={`text-sm font-bold ${alert.type === 'budget_danger' ? 'text-red-200' : 'text-yellow-200'}`}>{alert.title}</h4>
                        <p className={`text-xs mt-1 ${alert.type === 'budget_danger' ? 'text-red-400/70' : 'text-yellow-400/70'}`}>
                          {alert.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Notificações do Sistema */}
              {combinedSystem.length > 0 && (
                <div className="p-2">
                  {(alertReminders.length > 0 || alertSubscriptions.length > 0 || budgetAlerts.length > 0) && <div className="h-px bg-gray-800 mx-2 my-2"></div>}
                  <p className="px-3 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Sistema</p>
                  {combinedSystem.map(n => (
                    <div key={n.id} className={`m-1 p-3 rounded-xl border transition-colors ${n.read ? 'bg-transparent border-transparent' : 'bg-gray-800/40 border-gray-800'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg shrink-0 ${n.type === 'update' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-400'}`}>
                          {n.type === 'update' ? <Sparkles size={16} /> : <Info size={16} />}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <h4 className={`text-sm font-bold ${n.read ? 'text-gray-400' : 'text-white'}`}>{n.title}</h4>
                            {!n.read && <div className="w-2 h-2 rounded-full bg-[#d97757]"></div>}
                          </div>
                          <p className="text-xs text-gray-500">{n.message}</p>
                          <p className="text-[10px] text-gray-600 mt-2 flex items-center gap-1"><Calendar size={10} /> {n.date}</p>
                          <div className="flex gap-2 mt-2">
                            {onMarkReadNotification && !n.read && (
                              <button
                                onClick={() => onMarkReadNotification(n.id)}
                                className="text-[10px] px-2 py-1 rounded bg-gray-800 text-gray-300 hover:text-white"
                              >
                                Marcar como lida
                              </button>
                            )}
                            {onArchiveNotification && (
                              <button
                                onClick={() => onArchiveNotification(n.id)}
                                className="text-[10px] px-2 py-1 rounded bg-gray-800 text-gray-300 hover:text-white"
                              >
                                Arquivar
                              </button>
                            )}
                            {onDeleteNotification && (
                              <button
                                onClick={() => onDeleteNotification(n.id)}
                                className="text-[10px] px-2 py-1 rounded bg-gray-900 text-red-400 hover:text-red-200 border border-red-500/40"
                              >
                                Excluir
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {allNotifications.length === 0 && (
                <div className="py-12 text-center text-gray-500 text-sm flex flex-col items-center gap-3">
                  <div className="p-3 bg-gray-800 rounded-full text-gray-600">
                    <Bell size={24} />
                  </div>
                  <p>Nenhuma notificação.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
