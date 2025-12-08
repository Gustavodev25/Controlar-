import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Bell, AlertTriangle, Info, Check, Sparkles, Clock, Calendar, TrendingUp, Target } from './Icons';
import { Reminder, Budget, Transaction } from '../types';
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
  externalNotifications?: SystemNotification[];
  onArchiveNotification?: (id: string) => void;
  onDeleteNotification?: (id: string) => void;
  onMarkReadNotification?: (id: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  reminders = [],
  budgets = [],
  transactions = [],
  externalNotifications = [],
  onArchiveNotification,
  onDeleteNotification,
  onMarkReadNotification
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mock de notificações do sistema (mantendo vazio por enquanto ou poderia ter mensagens reais de sistema)
  const [systemNotifications, setSystemNotifications] = useState<SystemNotification[]>([]);

  // Identificar lembretes vencidos ou vencendo hoje
  const alertReminders = useMemo(() => {
    return reminders.filter(r => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date((r.dueDate || toLocalISODate()) + "T00:00:00");
      due.setHours(0, 0, 0, 0);
      return due <= today;
    });
  }, [reminders]);

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
  const allNotifications = [...alertReminders, ...budgetAlerts, ...combinedSystem];
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
    // Para reminders, não temos "read" state persistido, então isso afetaria apenas system/budget notifications locais
    // Idealmente, isso persistiria no backend. Aqui vamos apenas limpar visualmente os system notifications
    setSystemNotifications(prev => prev.map(n => ({ ...n, read: true })));
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

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 md:w-96 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-dropdown-open origin-top-right">
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
                    <div key={r.id} className={`m-1 p-3 rounded-xl flex items-start gap-3 border ${isIncome ? 'bg-green-900/10 border-green-900/30' : 'bg-red-900/10 border-red-900/30'}`}>
                      <div className={`p-2 rounded-lg shrink-0 ${isIncome ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {isIncome ? <TrendingUp size={16} /> : <AlertTriangle size={16} />}
                      </div>
                      <div>
                        <h4 className={`text-sm font-bold ${isIncome ? 'text-green-200' : 'text-red-200'}`}>{r.description}</h4>
                        <p className={`text-xs mt-1 flex items-center gap-1 ${isIncome ? 'text-green-400/70' : 'text-red-400/70'}`}>
                          <Clock size={12} /> {isIncome ? 'Recebimento Previsto:' : 'Vence:'} {new Date((r.dueDate || toLocalISODate()) + "T00:00:00").toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Alertas de Orçamento */}
            {budgetAlerts.length > 0 && (
              <div className="p-2">
                {alertReminders.length > 0 && <div className="h-px bg-gray-800 mx-2 my-2"></div>}
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
                {(alertReminders.length > 0 || budgetAlerts.length > 0) && <div className="h-px bg-gray-800 mx-2 my-2"></div>}
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
        </div>
      )}
    </div>
  );
};
