
import React, { useState, useRef, useEffect } from 'react';
import { Bell, AlertTriangle, Info, Check, Sparkles, Clock, Calendar } from './Icons';
import { Reminder } from '../types';

interface NotificationCenterProps {
  reminders: Reminder[];
}

interface SystemNotification {
  id: string;
  type: 'system' | 'alert' | 'update';
  title: string;
  message: string;
  date: string;
  read: boolean;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ reminders }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mock de notificações do sistema
  const [systemNotifications, setSystemNotifications] = useState<SystemNotification[]>([
    {
      id: 'sys-1',
      type: 'update',
      title: 'Consultor IA Atualizado',
      message: 'Novas capacidades de previsão financeira adicionadas.',
      date: new Date().toISOString().split('T')[0],
      read: false
    },
    {
      id: 'sys-2',
      type: 'system',
      title: 'Segurança',
      message: 'Lembre-se de ativar o 2FA nas configurações.',
      date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      read: true
    }
  ]);

  // Identificar lembretes vencidos ou vencendo hoje
  const alertReminders = reminders.filter(r => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(r.dueDate);
    due.setHours(0, 0, 0, 0);
    return due <= today;
  });

  const unreadCount = systemNotifications.filter(n => !n.read).length + alertReminders.length;

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
      setSystemNotifications(prev => prev.map(n => ({...n, read: true})));
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
        <div className="absolute right-0 mt-3 w-80 md:w-96 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in origin-top-right">
          <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950/50 backdrop-blur-sm">
             <h3 className="font-bold text-white">Central de Notificações</h3>
             {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[10px] font-bold text-[#d97757] hover:text-[#c56a4d] flex items-center gap-1">
                    <Check size={12} /> Marcar lidas
                </button>
             )}
          </div>

          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
             {/* Alertas de Lembretes */}
             {alertReminders.length > 0 && (
                 <div className="p-2">
                    <p className="px-3 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Contas & Alertas</p>
                    {alertReminders.map(r => (
                        <div key={r.id} className="m-1 p-3 bg-red-900/10 border border-red-900/30 rounded-xl flex items-start gap-3">
                            <div className="p-2 bg-red-500/20 rounded-lg text-red-400 shrink-0"><AlertTriangle size={16} /></div>
                            <div>
                                <h4 className="text-sm font-bold text-red-200">{r.description}</h4>
                                <p className="text-xs text-red-400/70 mt-1 flex items-center gap-1">
                                    <Clock size={12} /> Vence: {new Date(r.dueDate).toLocaleDateString('pt-BR')}
                                </p>
                            </div>
                        </div>
                    ))}
                 </div>
             )}

             {/* Notificações do Sistema */}
             <div className="p-2">
                {alertReminders.length > 0 && <div className="h-px bg-gray-800 mx-2 my-2"></div>}
                <p className="px-3 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Sistema</p>
                {systemNotifications.map(n => (
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
                                <p className="text-[10px] text-gray-600 mt-2 flex items-center gap-1"><Calendar size={10}/> {n.date}</p>
                            </div>
                        </div>
                    </div>
                ))}
             </div>
             
             {alertReminders.length === 0 && systemNotifications.length === 0 && (
                 <div className="py-8 text-center text-gray-500 text-sm">Nenhuma notificação.</div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};
