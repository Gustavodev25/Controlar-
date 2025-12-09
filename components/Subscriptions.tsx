import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Subscription, Transaction } from '../types';
import { 
  RefreshCw, 
  Plus, 
  Trash2, 
  Calendar, 
  Tag, 
  DollarSign, 
  Check,
  Zap,
  X,
  Edit2,
  Sparkles,
  ArrowRight,
  Bot,
  AlertCircle,
  CreditCard,
  TrendingUp,
  getCategoryIcon,
  CalendarClock
} from './Icons';
import { EmptyState } from './EmptyState';
import { CustomAutocomplete, ConfirmationCard, CustomSelect } from './UIComponents';
import { parseSubscriptionFromText } from '../services/geminiService';
import coinzinhaImg from '../assets/coinzinha.png';
import { CoinzinhaGreeting } from './CoinzinhaGreeting';
import NumberFlow from '@number-flow/react';
import { FileText } from 'lucide-react';

interface SubscriptionsProps {
  subscriptions: Subscription[];
  transactions: Transaction[]; // To show history
  onAddSubscription: (sub: Omit<Subscription, 'id'>) => void;
  onUpdateSubscription: (sub: Subscription) => void;
  onDeleteSubscription: (id: string) => void;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const SubscriptionCard: React.FC<{ 
  sub: Subscription, 
  onDelete: (id: string) => void,
  onEdit: (sub: Subscription) => void
}> = ({ sub, onDelete, onEdit }) => {
  
  // Cores based on Status/Cycle
  let statusConfig = {
    barColor: "bg-emerald-500",
    iconBg: "bg-emerald-500/10 text-emerald-500",
    statusText: sub.billingCycle === 'monthly' ? "Mensal" : "Anual",
    textColor: "text-emerald-400",
    glowColor: "bg-emerald-500"
  };

  if (sub.status === 'canceled') {
    statusConfig = {
        barColor: "bg-red-500",
        iconBg: "bg-red-500/10 text-red-500",
        statusText: "Cancelada",
        textColor: "text-red-400",
        glowColor: "bg-red-500"
    };
  }

  return (
    <div className="bg-gray-950 rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-all group relative overflow-hidden shadow-lg shadow-black/20">
      
      {/* Luz de fundo decorativa suave */}
      <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none ${statusConfig.glowColor}`}></div>

      <div className="flex flex-col sm:flex-row items-center gap-4 relative z-10">
        {/* Ícone */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/5 shadow-inner ${statusConfig.iconBg}`}>
             {getCategoryIcon(sub.category, 20)}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 w-full min-w-0 text-center sm:text-left">
             <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                <h4 className="font-bold text-gray-100 text-base truncate">{sub.name}</h4>
                <span className="text-[9px] px-1.5 py-0.5 bg-gray-900 text-gray-500 rounded border border-gray-800 uppercase tracking-wider font-bold flex items-center gap-1">
                  <RefreshCw size={8} /> Auto
                </span>
             </div>
             
             <div className="flex items-center justify-center sm:justify-start gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1.5 bg-gray-900/50 px-2 py-1 rounded-md border border-gray-800/50">
                    <Tag size={12} /> {sub.category}
                </span>
                <span className="flex items-center gap-1.5 font-mono text-gray-400">
                     <Calendar size={12} /> {sub.billingCycle === 'monthly' ? 'Todo mês' : 'Todo ano'}
                </span>
             </div>
        </div>
        
        {/* Valores e Ações */}
        <div className="flex items-center justify-between w-full sm:w-auto gap-6 border-t border-gray-800/50 pt-3 sm:pt-0 sm:border-t-0">
             <div className="text-right flex-1 sm:flex-auto">
                <p className="font-mono font-bold text-lg text-gray-200">
                    <NumberFlow value={sub.amount} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" />
                </p>
                <p className={`text-[10px] font-bold uppercase tracking-wide ${statusConfig.textColor}`}>
                    {statusConfig.statusText}
                </p>
             </div>
             <div className="flex items-center gap-2">
                <button
                    onClick={() => onEdit(sub)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-900 hover:bg-[#d97757]/10 text-gray-500 hover:text-[#d97757] border border-gray-800 hover:border-[#d97757]/30 transition-all"
                    title="Editar"
                >
                    <Edit2 size={16} strokeWidth={2.5} />
                </button>
                <button
                    onClick={() => onDelete(sub.id)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-900 hover:bg-red-500/10 text-gray-500 hover:text-red-400 border border-gray-800 hover:border-red-500/30 transition-all"
                    title="Excluir"
                >
                    <Trash2 size={16} strokeWidth={2.5} />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export const Subscriptions: React.FC<SubscriptionsProps> = ({ subscriptions, transactions, onAddSubscription, onUpdateSubscription, onDeleteSubscription }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Mode state
  const [modalMode, setModalMode] = useState<'ai' | 'manual'>('ai');

  // AI State
  const [aiInput, setAiInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiError, setAiError] = useState('');
  const [parsedSubscription, setParsedSubscription] = useState<{ name: string, amount: number, billingCycle: 'monthly' | 'yearly', category: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    billingCycle: 'monthly' as 'monthly' | 'yearly',
    category: 'Lazer',
    status: 'active' as 'active' | 'canceled'
  });

  const categories = ['Lazer', 'Tecnologia', 'Trabalho', 'Educação', 'Saúde', 'Outros', 'Moradia', 'Transporte'];

  // Modal Animation Logic
  useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        if (isModalOpen) {
            setIsVisible(true);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsAnimating(true);
                });
            });
        } else {
            setIsAnimating(false);
            timeoutId = setTimeout(() => {
                setIsVisible(false);
            }, 300);
        }
        return () => clearTimeout(timeoutId);
  }, [isModalOpen]);

  const handleAiAnalyze = async () => {
    if (!aiInput.trim()) return;
    setIsProcessing(true);
    setAiError('');
    setParsedSubscription(null);

    try {
        const result = await parseSubscriptionFromText(aiInput);
        if (result) {
            setParsedSubscription(result);
        } else {
            setAiError("Não entendi. Tente: 'Netflix 55 reais todo mês'");
        }
    } catch (e) {
        setAiError("Erro de conexão com a IA.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleConfirmAi = () => {
      if (parsedSubscription) {
          setFormData({
              name: parsedSubscription.name,
              amount: parsedSubscription.amount.toString(),
              billingCycle: parsedSubscription.billingCycle,
              category: parsedSubscription.category,
              status: 'active'
          });
          setModalMode('manual');
          setParsedSubscription(null);
          setAiInput('');
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      userId: '', // Filled by service/parent logic usually
      name: formData.name,
      amount: parseFloat(formData.amount),
      billingCycle: formData.billingCycle,
      category: formData.category,
      status: formData.status
    };

    if (editingId) {
       const original = subscriptions.find(s => s.id === editingId);
       if (original) {
           onUpdateSubscription({ ...original, ...data });
       }
    } else {
       onAddSubscription(data);
    }
    handleClose();
  };

  const handleEdit = (sub: Subscription) => {
    setEditingId(sub.id);
    setFormData({
      name: sub.name,
      amount: sub.amount.toString(),
      billingCycle: sub.billingCycle,
      category: sub.category,
      status: sub.status
    });
    setModalMode('manual');
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setTimeout(() => {
        setEditingId(null);
        setFormData({ name: '', amount: '', billingCycle: 'monthly', category: 'Lazer', status: 'active' });
        setModalMode('ai');
        setAiInput('');
        setParsedSubscription(null);
        setAiError('');
    }, 300);
  };

  const totalMonthly = useMemo(() => {
    return subscriptions
      .filter(s => s.status === 'active')
      .reduce((acc, curr) => {
        const monthlyAmount = curr.billingCycle === 'monthly' ? curr.amount : curr.amount / 12;
        return acc + monthlyAmount;
      }, 0);
  }, [subscriptions]);

  return (
    <div className="w-full space-y-8 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Assinaturas</h2>
            <p className="text-gray-400 text-sm mt-1">Gerencie seus servicos recorrentes</p>
          </div>

          {/* Balloon Hint */}
          <div className="hidden md:block animate-fade-in ml-2">
            <div className="relative bg-blue-500/10 border border-blue-500/20 rounded-lg py-2 px-3">
                {/* Arrow */}
                <div className="absolute top-1/2 -left-[5px] -translate-y-1/2 w-2.5 h-2.5 bg-gray-950 border-l border-b border-blue-500/20 rotate-45"></div>
                
                <p className="text-[11px] text-blue-200 leading-snug relative z-10">
                  <span className="font-bold text-blue-400">Dica:</span> Veja o impacto no saldo clicando em <strong>"Previsão"</strong>.
                </p>
            </div>
          </div>
        </div>

        <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#d97757] hover:bg-[#c56a4d] text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-[#d97757]/20 hover:shadow-[#d97757]/40 hover:-translate-y-0.5 border border-[#d97757]/50"
        >
            <Plus size={20} strokeWidth={2.5} />
            <span className="hidden sm:inline font-bold text-sm">Novo</span>
        </button>
      </div>

      {/* Stats Cards - Identico ao Reminders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5 flex flex-col justify-between">
           <div className="flex justify-between items-start mb-3">
               <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gray-900 border border-gray-800 rounded-xl text-emerald-500">
                        <CreditCard size={20} />
                    </div>
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Custo Mensal</span>
               </div>
           </div>
           <div className="">
              <p className="text-3xl font-bold text-white tracking-tight">
                <NumberFlow 
                    value={totalMonthly}
                    format={{ style: 'currency', currency: 'BRL' }}
                    locales="pt-BR"
                />
              </p>
              <p className="text-xs text-gray-500 mt-1">Total comprometido mensalmente</p>
           </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5 flex flex-col justify-between">
           <div className="flex justify-between items-start mb-3">
               <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gray-900 border border-gray-800 rounded-xl text-blue-500">
                        <TrendingUp size={20} />
                    </div>
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Estimativa Anual</span>
               </div>
           </div>
           <div className="">
              <p className="text-3xl font-bold text-white tracking-tight">
                <NumberFlow 
                    value={totalMonthly * 12}
                    format={{ style: 'currency', currency: 'BRL' }}
                    locales="pt-BR"
                />
              </p>
              <p className="text-xs text-gray-500 mt-1">Projeção de custo anual</p>
           </div>
        </div>
      </div>

      {/* Lista de assinaturas */}
      {subscriptions.length === 0 ? (
        <EmptyState title="Nenhuma assinatura" description="Adicione serviços como Netflix, Spotify, etc." />
      ) : (
        <div className="animate-fade-in space-y-3">
           {subscriptions.map(sub => (
             <SubscriptionCard 
               key={sub.id} 
               sub={sub} 
               onDelete={setDeleteId}
               onEdit={handleEdit}
             />
           ))}
        </div>
      )}

      {/* Modal Reformulada (Visual Reminders) */}
      {isVisible && createPortal(
        <div 
            className={`
                fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
                ${isAnimating ? 'backdrop-blur-md bg-black/60' : 'backdrop-blur-none bg-black/0'}
            `}
        >
           <div 
             className={`
                bg-gray-950 rounded-3xl shadow-2xl w-full max-w-lg overflow-visible border border-gray-800 flex flex-col max-h-[90vh] relative transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
                ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
            `}
           >
              {/* Background Glow */}
              <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 opacity-20 ${modalMode === 'ai' ? 'bg-[#d97757]' : 'bg-gray-600'}`} />

              {/* Header */}
              <div className="p-6 border-b border-gray-800 flex justify-between items-center relative z-10 bg-gray-950/80 backdrop-blur-sm">
                 {!editingId ? (
                    <div className="flex gap-1 bg-gray-900 p-1.5 rounded-xl border border-gray-800 shadow-inner">
                        <button
                        onClick={() => setModalMode('ai')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${modalMode === 'ai' ? 'bg-[#d97757] text-white shadow-lg shadow-[#d97757]/20 ring-1 ring-[#d97757]/50' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
                        >
                        <img src={coinzinhaImg} className="w-4 h-4 rounded-full object-cover" alt="Coinzinha" />
                        Coinzinha
                        </button>
                        <button
                        onClick={() => setModalMode('manual')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${modalMode === 'manual' ? 'bg-gray-800 text-white ring-1 ring-gray-700' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
                        >
                        <Plus size={14} />
                        Manual
                        </button>
                    </div>
                 ) : (
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#d97757]/20 rounded-xl text-[#d97757]">
                        <Edit2 size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-white">Editar Assinatura</h3>
                    </div>
                 )}
                 <button onClick={handleClose} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-xl border border-transparent hover:border-gray-700 transition-all"><X size={20} /></button>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar relative z-10">
                  
                  {/* AI MODE */}
                  {modalMode === 'ai' && !editingId && (
                      <div className="space-y-6 animate-fade-in">
                          {!parsedSubscription ? (
                              <>
                                <div className="text-center space-y-4 py-2 flex flex-col items-center">
                                    <CoinzinhaGreeting />
                                    <div className={`w-16 h-16 mx-auto rounded-2xl bg-[#d97757]/10 p-0.5 ring-1 ring-[#d97757]/20 shadow-lg shadow-[#d97757]/10 ${isProcessing ? 'animate-pulse' : ''}`}>
                                    <img src={coinzinhaImg} className="w-full h-full object-cover rounded-2xl" alt="Coinzinha" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Identificar Assinatura</h3>
                                        <p className="text-sm text-gray-500 max-w-xs mx-auto mt-1 leading-relaxed">
                                        Digite algo como: <span className="text-gray-300 font-medium">"Spotify 21,90 por mês"</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="relative group">
                                    <textarea
                                    value={aiInput}
                                    onChange={(e) => setAiInput(e.target.value)}
                                    placeholder="Descreva a assinatura aqui..."
                                    className="w-full h-36 p-5 bg-gray-900/50 border border-gray-800 rounded-2xl focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757] outline-none resize-none text-white placeholder-gray-600 transition-all text-base shadow-inner"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleAiAnalyze();
                                        }
                                    }}
                                    />
                                    <div className="absolute bottom-4 right-4 text-[10px] text-gray-600 uppercase font-bold tracking-wider bg-gray-900 px-2 py-1 rounded border border-gray-800">
                                        Enter ↵
                                    </div>
                                </div>

                                {aiError && (
                                    <div className="flex items-center gap-3 text-red-400 text-sm bg-red-500/10 p-4 rounded-2xl border border-red-500/20">
                                    <AlertCircle size={18} className="shrink-0" /> {aiError}
                                    </div>
                                )}

                                <button
                                    onClick={handleAiAnalyze}
                                    disabled={isProcessing || !aiInput.trim()}
                                    className="w-full py-4 bg-white text-black hover:bg-gray-200 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-white/5"
                                >
                                    {isProcessing ? 'Analisando...' : <>Processar <ArrowRight size={18} /></>}
                                </button>
                              </>
                          ) : (
                              <div className="space-y-6 animate-slide-up">
                                  {/* Ticket Result */}
                                  <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden relative shadow-2xl">
                                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#d97757] to-amber-500"></div>
                                      
                                      <div className="absolute top-0 right-0 w-24 h-24 bg-[#d97757]/10 blur-2xl rounded-full pointer-events-none"></div>

                                      <div className="p-6 relative z-10">
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <span className="text-[10px] px-2 py-1 rounded-lg border uppercase tracking-wider font-bold bg-[#d97757]/10 text-[#d97757] border-[#d97757]/20">
                                                  Assinatura Identificada
                                                </span>
                                                <h3 className="text-2xl font-bold text-white mt-3 leading-tight">{parsedSubscription.name}</h3>
                                            </div>
                                            <div className="text-right bg-gray-950 p-3 rounded-xl border border-gray-800">
                                                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Valor</p>
                                                <p className="text-xl font-mono font-bold text-gray-200">
                                                    <NumberFlow value={parsedSubscription.amount} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" />
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 flex flex-col gap-1">
                                                <div className="flex items-center gap-2 text-gray-400">
                                                    <Tag size={14} /> <span className="text-[10px] uppercase font-bold">Categoria</span>
                                                </div>
                                                <p className="text-base font-bold text-white">{parsedSubscription.category}</p>
                                            </div>
                                            <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 flex flex-col gap-1">
                                                <div className="flex items-center gap-2 text-gray-400">
                                                    <RefreshCw size={14} /> <span className="text-[10px] uppercase font-bold">Ciclo</span>
                                                </div>
                                                <p className="text-base font-bold text-white capitalize">
                                                    {parsedSubscription.billingCycle === 'monthly' ? 'Mensal' : 'Anual'}
                                                </p>
                                            </div>
                                        </div>
                                      </div>
                                  </div>

                                  <div className="flex gap-3 pt-2">
                                      <button 
                                        onClick={() => setParsedSubscription(null)}
                                        className="flex-1 py-3.5 bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl font-bold transition-all border border-gray-800 hover:border-gray-700"
                                      >
                                          Corrigir
                                      </button>
                                      <button 
                                        onClick={handleConfirmAi}
                                        className="flex-[2] py-3.5 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/20 border border-[#d97757]/50 flex items-center justify-center gap-2"
                                      >
                                          <Check size={18} strokeWidth={3} /> Confirmar
                                      </button>
                                  </div>
                              </div>
                          )}
                      </div>
                  )}

                  {/* MANUAL FORM */}
                  {(modalMode === 'manual' || editingId) && (
                    <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in">
                        {/* Name */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block ml-1">Nome do Serviço</label>
                            <div className="relative group">
                                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={18} />
                                <input 
                                    required
                                    type="text" 
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    placeholder="Ex: Netflix"
                                    className="w-full bg-gray-900/50 border border-gray-800 rounded-xl text-white pl-12 pr-4 py-3.5 text-sm focus:border-[#d97757] focus:ring-1 focus:ring-[#d97757]/50 outline-none transition-all"
                                    autoFocus
                                />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            {/* Amount */}
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block ml-1">Valor (R$)</label>
                                <div className="relative group">
                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={18} />
                                    <input 
                                        required
                                        type="number" 
                                        step="0.01"
                                        value={formData.amount}
                                        onChange={e => setFormData({...formData, amount: e.target.value})}
                                        className="w-full bg-gray-900/50 border border-gray-800 rounded-xl text-white pl-12 pr-4 py-3.5 text-sm focus:border-[#d97757] focus:ring-1 focus:ring-[#d97757]/50 outline-none transition-all"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            
                            {/* Cycle */}
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block ml-1">Ciclo</label>
                                <CustomSelect 
                                    value={formData.billingCycle}
                                    onChange={(val) => setFormData({...formData, billingCycle: val as any})}
                                    options={[
                                        { value: 'monthly', label: 'Mensal' },
                                        { value: 'yearly', label: 'Anual' }
                                    ]}
                                    icon={<RefreshCw size={16} />}
                                    className="w-full text-sm"
                                />
                            </div>
                        </div>

                        {/* Category */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block ml-1">Categoria</label>
                            <CustomAutocomplete
                                value={formData.category}
                                onChange={(val) => setFormData({...formData, category: val})}
                                options={categories}
                                icon={<Tag size={18} />}
                                placeholder="Ex: Lazer, Tecnologia..."
                            />
                        </div>

                        <div className="pt-2">
                            <button 
                            type="submit"
                            className="w-full py-4 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold shadow-lg shadow-[#d97757]/30 transition-all flex items-center justify-center gap-2"
                            >
                            <Check size={20} strokeWidth={3} /> {editingId ? 'Atualizar Assinatura' : 'Salvar Assinatura'}
                            </button>
                        </div>
                    </form>
                  )}
              </div>
           </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation */}
      <ConfirmationCard
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && onDeleteSubscription(deleteId)}
        title="Excluir Assinatura"
        description="Tem certeza? Você deixará de acompanhar este gasto recorrente."
        isDestructive={true}
        confirmText="Sim, excluir"
        cancelText="Cancelar"
      />
    </div>
  );
};