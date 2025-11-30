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
  AlertCircle
} from './Icons';
import { EmptyState } from './EmptyState';
import { CustomAutocomplete, ConfirmationCard } from './UIComponents';
import { parseSubscriptionFromText } from '../services/geminiService';
import coinzinhaImg from '../assets/coinzinha.png';
import { CoinzinhaGreeting } from './CoinzinhaGreeting';
import NumberFlow from '@number-flow/react';

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
  history: Transaction[],
  onDelete: (id: string) => void,
  onEdit: (sub: Subscription) => void
}> = ({ sub, history, onDelete, onEdit }) => {
  
  const lastPayment = history.length > 0 ? history[0].date : 'N/A';
  
  return (
    <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all group relative overflow-hidden">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#d97757]/10 flex items-center justify-center text-[#d97757]">
             <Zap size={20} />
          </div>
          <div>
            <h4 className="font-bold text-white">{sub.name}</h4>
            <p className="text-xs text-gray-500 capitalize">{sub.billingCycle === 'monthly' ? 'Mensal' : 'Anual'}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="block text-lg font-bold text-white">
            <NumberFlow value={sub.amount} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" />
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${sub.status === 'active' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
            {sub.status === 'active' ? 'Ativa' : 'Cancelada'}
          </span>
        </div>
      </div>

      <div className="space-y-2">
         <div className="flex justify-between text-xs">
            <span className="text-gray-500 flex items-center gap-1"><Tag size={12}/> Categoria</span>
            <span className="text-gray-300">{sub.category}</span>
         </div>
         {lastPayment !== 'N/A' && (
             <div className="flex justify-between text-xs">
                <span className="text-gray-500 flex items-center gap-1"><Calendar size={12}/> Último Pagto</span>
                <span className="text-gray-300">{new Date(lastPayment).toLocaleDateString('pt-BR')}</span>
             </div>
         )}
      </div>

      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-800/50 opacity-0 group-hover:opacity-100 transition-opacity">
         <button 
           onClick={() => onEdit(sub)}
           className="flex-1 py-2 bg-gray-900 hover:bg-gray-800 text-gray-300 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
         >
           <Edit2 size={14} /> Editar
         </button>
         <button 
           onClick={() => onDelete(sub.id)}
           className="flex-1 py-2 bg-gray-900 hover:bg-red-900/20 text-red-400 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
         >
           <Trash2 size={14} /> Remover
         </button>
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
            <p className="text-gray-400 text-sm mt-1">Gerencie seus serviços recorrentes</p>
          </div>

          {/* Balloon Hint */}
          <div className="hidden md:block animate-fade-in ml-2">
            <div className="relative bg-blue-500/10 border border-blue-500/20 rounded-lg py-2 px-3 shadow-sm">
                {/* Arrow */}
                <div className="absolute top-1/2 -left-[5px] -translate-y-1/2 w-2.5 h-2.5 bg-gray-950 border-l border-b border-blue-500/20 rotate-45"></div>
                
                <p className="text-[11px] text-blue-200 leading-snug relative z-10">
                  <span className="font-bold text-blue-400">Dica:</span> Veja o impacto no saldo clicando em <strong>"Previsão (Lembretes + Assinaturas)"</strong>.
                </p>
            </div>
          </div>
        </div>

        <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#d97757] hover:bg-[#c56a4d] text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-[#d97757]/20 hover:shadow-[#d97757]/40 hover:-translate-y-0.5 border border-[#d97757]/50"
        >
            <Plus size={20} strokeWidth={2.5} />
            <span className="hidden sm:inline font-bold text-sm">Adicionar</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
         <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl bg-[#d97757]/10 -mr-10 -mt-10"></div>
            <div className="relative z-10">
               <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Custo Mensal</p>
               <p className="text-3xl font-bold text-white">
                  <NumberFlow value={totalMonthly} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" />
               </p>
            </div>
         </div>
         <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Ativas</p>
            <p className="text-3xl font-bold text-green-400">
               <NumberFlow value={subscriptions.filter(s => s.status === 'active').length} />
            </p>
         </div>
         <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Anual Estimado</p>
            <p className="text-3xl font-bold text-gray-300">
               <NumberFlow value={totalMonthly * 12} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" />
            </p>
         </div>
      </div>

      {/* List */}
      {subscriptions.length === 0 ? (
        <EmptyState title="Nenhuma assinatura" description="Adicione serviços como Netflix, Spotify, etc." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
           {subscriptions.map(sub => (
             <SubscriptionCard 
               key={sub.id} 
               sub={sub} 
               history={transactions.filter(t => t.description.toLowerCase().includes(sub.name.toLowerCase()))}
               onDelete={setDeleteId}
               onEdit={handleEdit}
             />
           ))}
        </div>
      )}

      {/* Modal - Styled like Budgets */}
      {isVisible && createPortal(
        <div 
            className={`
                fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-300 ease-in-out
                ${isAnimating ? 'bg-black/90 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-0'}
            `}
        >
           <div 
             className={`
                bg-gray-950 rounded-3xl shadow-2xl w-full max-w-lg overflow-visible border border-gray-800 flex flex-col max-h-[90vh] relative transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]
                ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
            `}
           >
              {/* Background Effects */}
              <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-[#d97757]/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-gray-700/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
              </div>

              {/* Header */}
              <div className="p-5 border-b border-gray-800/50 flex justify-between items-center relative z-10">
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
                 <button onClick={handleClose} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-full transition-colors"><X size={20} /></button>
              </div>
              
              <div className="p-6 overflow-y-visible custom-scrollbar relative z-10">
                  
                  {/* AI MODE */}
                  {modalMode === 'ai' && !editingId && (
                      <div className="space-y-6 animate-fade-in">
                          {!parsedSubscription ? (
                              <>
                                <div className="text-center space-y-4 py-2 flex flex-col items-center">
                                    <CoinzinhaGreeting />
                                    <div className={`w-14 h-14 mx-auto rounded-2xl bg-[#d97757]/10 p-0.5 ring-1 ring-[#d97757]/20 shadow-lg shadow-[#d97757]/10 ${isProcessing ? 'animate-pulse' : ''}`}>
                                    <img src={coinzinhaImg} className="w-full h-full object-cover rounded-2xl" alt="Coinzinha" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Identificar Assinatura</h3>
                                        <p className="text-xs text-gray-500 max-w-xs mx-auto mt-1">
                                        Digite algo como: <span className="text-gray-300">"Spotify 21,90 por mês"</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="relative group">
                                    <textarea
                                    value={aiInput}
                                    onChange={(e) => setAiInput(e.target.value)}
                                    placeholder="Descreva a assinatura aqui..."
                                    className="w-full h-32 p-4 bg-gray-900/50 border border-gray-800 rounded-2xl focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757] outline-none resize-none text-white placeholder-gray-600 transition-all text-sm shadow-inner"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleAiAnalyze();
                                        }
                                    }}
                                    />
                                    <div className="absolute bottom-3 right-3 text-[9px] text-gray-600 uppercase font-bold tracking-wider bg-gray-900 px-2 py-1 rounded border border-gray-800">
                                        Enter ↵
                                    </div>
                                </div>

                                {aiError && (
                                    <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                                    <AlertCircle size={14} className="shrink-0" /> {aiError}
                                    </div>
                                )}

                                <button
                                    onClick={handleAiAnalyze}
                                    disabled={isProcessing || !aiInput.trim()}
                                    className="w-full py-3.5 bg-white text-black hover:bg-gray-200 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-white/5"
                                >
                                    {isProcessing ? 'Analisando...' : <>Processar <ArrowRight size={16} /></>}
                                </button>
                              </>
                          ) : (
                              <div className="space-y-4 animate-slide-up">
                                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 relative overflow-hidden">
                                      <div className="absolute top-0 left-0 w-1 h-full bg-[#d97757]"></div>
                                      <div className="space-y-3">
                                          <div className="flex justify-between">
                                              <span className="text-gray-400 text-xs uppercase font-bold">Serviço</span>
                                              <span className="text-white font-bold">{parsedSubscription.name}</span>
                                          </div>
                                          <div className="flex justify-between">
                                              <span className="text-gray-400 text-xs uppercase font-bold">Valor</span>
                                              <span className="text-[#d97757] font-bold">
                                                <NumberFlow value={parsedSubscription.amount} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" />
                                              </span>
                                          </div>
                                          <div className="flex justify-between">
                                              <span className="text-gray-400 text-xs uppercase font-bold">Ciclo</span>
                                              <span className="text-gray-300 capitalize">{parsedSubscription.billingCycle === 'monthly' ? 'Mensal' : 'Anual'}</span>
                                          </div>
                                      </div>
                                  </div>
                                  <div className="flex gap-2">
                                      <button 
                                        onClick={() => setParsedSubscription(null)}
                                        className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-bold text-xs transition-colors"
                                      >
                                          Tentar Novamente
                                      </button>
                                      <button 
                                        onClick={handleConfirmAi}
                                        className="flex-[2] py-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-[#d97757]/20 flex items-center justify-center gap-2"
                                      >
                                          <Check size={14} /> Confirmar
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
                            <label className="block text-xs font-medium text-gray-400 mb-1.5">Nome do Serviço</label>
                            <input 
                            required
                            type="text" 
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                            placeholder="Ex: Netflix"
                            className="input-primary focus:border-[#d97757]"
                            autoFocus
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            {/* Amount */}
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1.5">Valor (R$)</label>
                                <div className="relative group">
                                <DollarSign className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={16} />
                                <input 
                                    required
                                    type="number" 
                                    step="0.01"
                                    value={formData.amount}
                                    onChange={e => setFormData({...formData, amount: e.target.value})}
                                    className="input-primary pl-10 focus:border-[#d97757]"
                                    placeholder="0.00"
                                />
                                </div>
                            </div>
                            
                            {/* Cycle */}
                            <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5">Ciclo</label>
                            <div className="relative">
                                <RefreshCw className="absolute left-3 top-3.5 text-gray-500" size={16} />
                                <select 
                                    value={formData.billingCycle}
                                    onChange={e => setFormData({...formData, billingCycle: e.target.value as any})}
                                    className="input-primary pl-10 focus:border-[#d97757] appearance-none cursor-pointer"
                                >
                                    <option value="monthly">Mensal</option>
                                    <option value="yearly">Anual</option>
                                </select>
                            </div>
                            </div>
                        </div>

                        {/* Category */}
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5">Categoria</label>
                            <div className="relative z-20 group">
                                <CustomAutocomplete
                                    value={formData.category}
                                    onChange={(val) => setFormData({...formData, category: val})}
                                    options={categories}
                                    icon={<Tag size={16} />}
                                    placeholder="Ex: Lazer, Tecnologia..."
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <button 
                            type="submit"
                            className="w-full py-4 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold shadow-lg shadow-[#d97757]/30 transition-all flex items-center justify-center gap-2"
                            >
                            <Check size={18} /> {editingId ? 'Atualizar Assinatura' : 'Salvar Assinatura'}
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
        confirmText="Excluir"
      />
    </div>
  );
};