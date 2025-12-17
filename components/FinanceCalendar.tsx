import React, { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, X, Bell, TrendingUp } from './Icons';
import { Reminder, Transaction } from '../types';

interface FinanceCalendarProps {
  month: string; // YYYY-MM
  transactions: Transaction[];
  reminders: Reminder[];
  isLoading?: boolean;
}

export const FinanceCalendar: React.FC<FinanceCalendarProps> = ({
  month,
  transactions,
  reminders,
  isLoading = false
}) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isModalAnimating, setModalAnimating] = useState(false);

  const months = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

  const { year, monthIndex } = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return { year: y, monthIndex: m - 1 };
  }, [month]);

  const daysInMonth = useMemo(() => new Date(year, monthIndex + 1, 0).getDate(), [year, monthIndex]);
  const startWeekday = useMemo(() => new Date(year, monthIndex, 1).getDay(), [year, monthIndex]);
  const todayKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const itemsByDate = useMemo(() => {
    const map: Record<string, { transactions: Transaction[]; reminders: Reminder[] }> = {};

    transactions.forEach(t => {
      if (t.ignored) return;
      if (!t.date.startsWith(month)) return;
      const key = t.date;
      if (!map[key]) map[key] = { transactions: [], reminders: [] };
      map[key].transactions.push(t);
    });

    reminders.forEach(r => {
      if (!r.dueDate.startsWith(month)) return;
      const key = r.dueDate;
      if (!map[key]) map[key] = { transactions: [], reminders: [] };
      map[key].reminders.push(r);
    });

    return map;
  }, [month, reminders, transactions]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatLongDate = (iso: string) => {
    const date = new Date(iso + 'T12:00:00');
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  };

  const renderDots = useCallback((dateKey: string) => {
    const dayItems = itemsByDate[dateKey];
    if (!dayItems) return null;

    const incomeCount = dayItems.transactions.filter(t => t.type === 'income').length;
    const expenseCount = dayItems.transactions.filter(t => t.type === 'expense').length;
    const reminderCount = dayItems.reminders.length;

    return (
      <div className="flex items-center gap-1 mt-2 flex-wrap">
        {expenseCount > 0 && (
          <span
            className="h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_0_2px_rgba(239,68,68,0.25)]"
            title={`${expenseCount} despesa(s)`}
          />
        )}
        {incomeCount > 0 && (
          <span
            className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_2px_rgba(52,211,153,0.25)]"
            title={`${incomeCount} receita(s)`}
          />
        )}
        {reminderCount > 0 && (
          <span
            className="h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_0_2px_rgba(251,191,36,0.25)]"
            title={`${reminderCount} lembrete(s)`}
          />
        )}
      </div>
    );
  }, [itemsByDate]);

  const selectedItems = selectedDate ? itemsByDate[selectedDate] : null;

  const dayCells = useMemo(() => {
    const cells: React.ReactNode[] = [];

    for (let i = 0; i < startWeekday; i++) {
      cells.push(<div key={`empty-${i}`} className="rounded-2xl bg-[#30302E]/40 border border-gray-900 h-20 sm:h-24" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayKey = `${month}-${String(day).padStart(2, '0')}`;
      const hasItems = Boolean(itemsByDate[dayKey]);
      const isToday = dayKey === todayKey;

      cells.push(
        <button
          key={dayKey}
          onClick={() => {
            setSelectedDate(dayKey);
            setModalVisible(true);
            requestAnimationFrame(() => {
              requestAnimationFrame(() => setModalAnimating(true));
            });
          }}
          className={`relative h-20 sm:h-24 w-full rounded-2xl border transition-all text-left p-3 ${
            hasItems
              ? 'border-[#d97757]/50 bg-[#30302E]/80 hover:border-[#e68e70] hover:bg-[#30302E]'
              : 'border-gray-800 bg-[#30302E]/40 hover:border-gray-700 hover:bg-[#30302E]/60'
          } ${isToday ? 'ring-2 ring-[#d97757]/60 ring-offset-2 ring-offset-gray-950' : ''}`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-white leading-none">{day}</p>
              {isToday && <p className="hidden sm:block text-[10px] uppercase text-[#d97757] font-bold mt-0.5">Hoje</p>}
            </div>
            {hasItems && <Calendar size={14} className="text-[#d97757]" />}
          </div>
          {renderDots(dayKey)}
        </button>
      );
    }

    return cells;
  }, [daysInMonth, itemsByDate, month, renderDots, startWeekday, todayKey]);

  const handleCloseModal = () => {
    setModalAnimating(false);
    setTimeout(() => {
      setModalVisible(false);
      setSelectedDate(null);
    }, 300);
  };

  return (
    <div className="bg-[#30302E] border border-gray-800 rounded-2xl p-4 lg:p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Calendario Financeiro</p>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar size={18} className="text-[#d97757]" /> {months[monthIndex]} de {year}
          </h3>
          <p className="text-sm text-gray-400">Clique em um dia para ver transacoes e lembretes.</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Receitas
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" /> Despesas
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" /> Lembretes
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 sm:gap-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
        {weekdays.map(day => (
          <span key={day} className="text-center">
            {day}
          </span>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-7 gap-2 sm:gap-3">
          {Array.from({ length: 35 }).map((_, idx) => (
            <div
              key={idx}
              className="h-20 sm:h-24 rounded-2xl bg-gray-800/50 border border-gray-800 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2 sm:gap-3">{dayCells}</div>
      )}

      {isModalVisible && createPortal(
        <div
          className={`fixed inset-0 z-[120] flex items-center justify-center p-4 transition-all duration-300 ease-in-out ${
            isModalAnimating ? 'bg-black/90 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-0'
          }`}
          onClick={handleCloseModal}
        >
          <div
            className={`bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl p-5 relative overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
              isModalAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'
            }`}
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-[#d97757]/10 blur-3xl" />
            <div className="flex items-start justify-between gap-4 mb-4 relative z-10">
              <div>
                <p className="text-xs uppercase font-semibold text-gray-500">Itens do dia</p>
                <h4 className="text-lg font-bold text-white">{formatLongDate(selectedDate)}</h4>
                <p className="text-sm text-gray-400">
                  {selectedItems
                    ? `${selectedItems.transactions.length} transacoes | ${selectedItems.reminders.length} lembretes`
                    : 'Sem movimentacoes para esta data.'}
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-[#30302E] hover:bg-gray-800 border border-gray-800 text-gray-300 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {!selectedItems || (selectedItems.transactions.length === 0 && selectedItems.reminders.length === 0) ? (
              <div className="relative z-10 p-4 rounded-xl border border-dashed border-gray-800 bg-[#30302E]/60 text-gray-400 text-sm">
                Nenhuma transacao ou lembrete para este dia.
              </div>
            ) : (
              <div className="space-y-4 relative z-10">
                {selectedItems.transactions.length > 0 && (
                  <div className="bg-[#30302E]/60 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-200 font-semibold mb-3 text-sm">
                      <TrendingUp size={14} className="text-emerald-400" />
                      <span>Transacoes</span>
                    </div>
                    <div className="space-y-2">
                      {selectedItems.transactions.map(t => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between gap-3 p-2 rounded-lg bg-gray-800/60 border border-gray-800"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${
                                t.type === 'income' ? 'bg-emerald-400' : 'bg-red-400'
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="text-sm text-white truncate">{t.description}</p>
                              <p className="text-xs text-gray-400 truncate">{t.category}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p
                              className={`text-sm font-semibold ${
                                t.type === 'income' ? 'text-emerald-400' : 'text-red-400'
                              }`}
                            >
                              {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                            </p>
                            <p className="text-[11px] text-gray-500 uppercase">{t.status === 'pending' ? 'Pendente' : 'Concluida'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedItems.reminders.length > 0 && (
                  <div className="bg-[#30302E]/60 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-200 font-semibold mb-3 text-sm">
                      <Bell size={14} className="text-amber-300" />
                      <span>Lembretes</span>
                    </div>
                    <div className="space-y-2">
                      {selectedItems.reminders.map(r => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between gap-3 p-2 rounded-lg bg-gray-800/60 border border-gray-800"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${
                                r.type === 'income' ? 'bg-emerald-400' : r.type === 'expense' ? 'bg-red-400' : 'bg-amber-300'
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="text-sm text-white truncate">{r.description}</p>
                              <p className="text-xs text-gray-400 truncate">{r.category}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p
                              className={`text-sm font-semibold ${
                                r.type === 'income' ? 'text-emerald-400' : r.type === 'expense' ? 'text-red-400' : 'text-amber-200'
                              }`}
                            >
                              {r.type === 'income' ? '+' : r.type === 'expense' ? '-' : ''} {formatCurrency(r.amount)}
                            </p>
                            {r.isRecurring && (
                              <p className="text-[11px] text-gray-500 uppercase">Recorrente {r.frequency ? `(${r.frequency})` : ''}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
