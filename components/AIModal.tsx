
import React, { useState, useEffect } from 'react';
import { X, Sparkles, Bot, Plus, Calendar, DollarSign, Tag, FileSpreadsheet, Check, ArrowRight, Clock } from './Icons';
import { parseTransactionFromText } from '../services/geminiService';
import { AIParsedTransaction, Transaction } from '../types';
import { CustomAutocomplete, CustomDatePicker } from './UIComponents';
import coinzinhaImg from '../assets/coinzinha.png';
import { CoinzinhaGreeting } from './CoinzinhaGreeting';

interface AIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: Omit<Transaction, 'id'>) => void;
}

type Mode = 'ai' | 'manual';

export const AIModal: React.FC<AIModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mode, setMode] = useState<Mode>('ai');
  
  // AI State
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [parsedResult, setParsedResult] = useState<AIParsedTransaction | null>(null);
  const [error, setError] = useState('');

  // Manual State
  const [manualForm, setManualForm] = useState({
    description: '',
    amount: '',
    category: 'Alimentação',
    date: new Date().toISOString().split('T')[0],
    type: 'expense' as 'income' | 'expense'
  });

  // Animation Logic
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (isOpen) {
      setIsVisible(true);
      // Small delay to ensure the DOM is mounted before starting animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      // Wait for animation to finish before unmounting
      timeoutId = setTimeout(() => {
        setIsVisible(false);
      }, 300);
    }
    return () => clearTimeout(timeoutId);
  }, [isOpen]);

  if (!isVisible) return null;

  // AI Handlers
  const handleAnalyze = async () => {
    if (!input.trim()) return;
    
    setIsLoading(true);
    setError('');
    setParsedResult(null);
    
    try {
      const result = await parseTransactionFromText(input);
      if (result) {
        setParsedResult(result);
      } else {
        setError("Não consegui entender os detalhes. Tente algo como: 'Gastei 50 reais na padaria hoje'");
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("MISSING_GEMINI_API_KEY")) {
        setError("Configure a VITE_GEMINI_API_KEY para usar a IA de lançamentos.");
      } else {
        setError("Erro ao conectar com a IA. O serviço pode estar sobrecarregado.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAI = () => {
    if (parsedResult) {
      const installments = parsedResult.installments || 1;
      
      if (installments > 1) {
        // Lógica de Parcelamento
        // Precisamos garantir que a data é tratada como UTC/Local corretamente para não pular dias
        // Parse YYYY-MM-DD
        const [y, m, d] = parsedResult.date.split('-').map(Number);
        
        // Loop para criar N transações
        for (let i = 0; i < installments; i++) {
            // Cria a data baseada no ano/mês/dia originais
            // O mês em JS é 0-indexado, então subtraímos 1 do parse e somamos 'i' para avançar
            const newDate = new Date(y, (m - 1) + i, d);
            
            // Formata de volta para YYYY-MM-DD
            const year = newDate.getFullYear();
            const month = String(newDate.getMonth() + 1).padStart(2, '0');
            const day = String(newDate.getDate()).padStart(2, '0');
            const formattedDate = `${year}-${month}-${day}`;
            
            onConfirm({
                description: `${parsedResult.description} (${i + 1}/${installments})`,
                amount: parsedResult.amount, // O parser já retorna o valor da parcela
                category: parsedResult.category,
                date: formattedDate,
                type: parsedResult.type as 'income' | 'expense',
                status: 'completed' // Assumimos como "agendado/concluído" para aparecer no fluxo
            });
        }
      } else {
        // Transação Única
        onConfirm({
          description: parsedResult.description,
          amount: parsedResult.amount,
          category: parsedResult.category,
          date: parsedResult.date,
          type: parsedResult.type as 'income' | 'expense',
          status: 'completed'
        });
      }
      
      handleClose();
    }
  };

  const formatDate = (dateStr: string) => {
    if(!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  // Manual Handlers
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      description: manualForm.description,
      amount: parseFloat(manualForm.amount),
      category: manualForm.category,
      date: manualForm.date,
      type: manualForm.type,
      status: 'completed'
    });
    handleClose();
  };

  const handleClose = () => {
    // Trigger exit animation first via parent prop change
    onClose();
    
    // Reset internal state after animation completes
    setTimeout(() => {
        setInput('');
        setParsedResult(null);
        setError('');
        setManualForm({
          description: '',
          amount: '',
          category: 'Alimentação',
          date: new Date().toISOString().split('T')[0],
          type: 'expense'
        });
        setMode('ai');
    }, 300);
  };

  const categories = ['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Salário', 'Investimentos', 'Outros'];

  return (
    <div 
        className={`
            fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ease-in-out
            ${isAnimating ? 'bg-black/90 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-0'}
        `}
    >
      <div 
        className={`
            bg-gray-950 rounded-3xl shadow-2xl w-full max-w-lg overflow-visible border border-gray-800 flex flex-col max-h-[90vh] relative transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]
            ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
        `}
      >
        
        {/* Background Effects Container */}
        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#d97757]/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gray-700/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
        </div>

        {/* Header */}
        <div className="p-5 border-b border-gray-800/50 flex justify-between items-center relative z-10">
           <div className="flex gap-2 bg-gray-900/50 p-1 rounded-xl border border-gray-700/50 backdrop-blur-md">
            <button 
              onClick={() => setMode('ai')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${mode === 'ai' ? 'bg-gradient-to-r from-[#d97757] to-[#e68e70] text-white shadow-lg shadow-[#d97757]/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <img src={coinzinhaImg} className="w-4 h-4 rounded-full object-cover" alt="Coinzinha" />
              Coinzinha
            </button>
            <button 
              onClick={() => setMode('manual')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${mode === 'manual' ? 'bg-gray-700 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <Plus size={14} />
              Manual
            </button>
          </div>
          <button onClick={handleClose} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-visible custom-scrollbar relative z-10">
          
          {/* AI MODE */}
          {mode === 'ai' && (
            <div className="space-y-6 animate-fade-in">
              {!parsedResult ? (
                <>
                  <div className="text-center space-y-3 py-4 flex flex-col items-center">
                     <CoinzinhaGreeting />
                     <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#d97757] to-[#e68e70] p-0.5 shadow-xl shadow-[#d97757]/30 ${isLoading ? 'animate-pulse' : ''}`}>
                        <img src={coinzinhaImg} className="w-full h-full object-cover rounded-2xl" alt="Coinzinha" />
                     </div>
                     <div>
                        <h3 className="text-lg font-bold text-white">Como posso ajudar?</h3>
                        <p className="text-sm text-gray-400 max-w-xs mx-auto mt-1">
                        Fale a data e parcelas se necessário.<br/> 
                        <span className="text-[#d97757]">"Notebook 3000 em 10x começando mês que vem"</span>
                        </p>
                     </div>
                  </div>

                  <div className="relative group">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Descreva sua transação aqui..."
                      className="w-full h-32 p-4 bg-gray-900/50 border border-gray-700 rounded-2xl focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757] resize-none text-gray-100 placeholder-gray-600 transition-all text-base"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                           e.preventDefault();
                           handleAnalyze();
                        }
                      }}
                    />
                    <div className="absolute bottom-3 right-3">
                       <span className="text-[10px] text-gray-600 bg-gray-900 px-2 py-1 rounded border border-gray-800">Enter para enviar</span>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/10 p-3 rounded-xl border border-red-900/30 animate-shake">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                      {error}
                    </div>
                  )}

                  <button 
                    onClick={handleAnalyze}
                    disabled={isLoading || !input.trim()}
                    className="w-full py-4 bg-white text-black hover:bg-gray-200 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                        Processando...
                      </span>
                    ) : (
                      <>
                        Processar
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="space-y-6 animate-slide-up">
                   <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-1 border border-gray-700 shadow-2xl">
                      {/* Ticket Header */}
                      <div className="bg-gray-950/50 rounded-t-xl p-3 flex justify-between items-center border-b border-gray-700 border-dashed">
                         <div className="flex items-center gap-2">
                            <Sparkles size={14} className="text-[#d97757]" />
                            <span className="text-xs font-bold text-[#d97757] uppercase tracking-wider">Confirmação IA</span>
                         </div>
                         <span className="text-xs text-gray-500">{formatDate(parsedResult.date)}</span>
                      </div>
                      
                      {/* Ticket Body */}
                      <div className="p-5 space-y-4">
                         <div className="flex items-start justify-between">
                            <div>
                               <p className="text-xs text-gray-400 mb-1">Descrição</p>
                               <p className="text-lg font-bold text-white">{parsedResult.description}</p>
                            </div>
                            <div className="text-right">
                               <p className="text-xs text-gray-400 mb-1">Valor {parsedResult.installments && parsedResult.installments > 1 ? '(parcela)' : ''}</p>
                               <p className="text-2xl font-bold text-white">R$ {parsedResult.amount.toFixed(2)}</p>
                            </div>
                         </div>

                         {parsedResult.installments && parsedResult.installments > 1 && (
                             <div className="bg-[#d97757]/10 border border-[#d97757]/30 rounded-lg p-3 flex items-center gap-3">
                                <div className="p-2 bg-[#d97757]/20 rounded-full text-[#d97757]">
                                    <Clock size={16} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-[#e68e70] uppercase">Parcelamento Inteligente</p>
                                    <p className="text-sm text-gray-300">
                                        Serão gerados <strong className="text-white">{parsedResult.installments} lançamentos</strong> mensais.
                                        <br/>
                                        <span className="text-xs text-gray-400">Total da compra: R$ {(parsedResult.amount * parsedResult.installments).toFixed(2)}</span>
                                    </p>
                                </div>
                             </div>
                         )}

                         <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="bg-gray-950/50 p-3 rounded-xl border border-gray-700/50">
                               <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Categoria</p>
                               <div className="flex items-center gap-2">
                                  <Tag size={14} className="text-gray-400" />
                                  <span className="text-sm font-medium text-gray-200">{parsedResult.category}</span>
                               </div>
                            </div>
                            <div className="bg-gray-950/50 p-3 rounded-xl border border-gray-700/50">
                               <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Tipo</p>
                               <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${parsedResult.type === 'income' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                  <span className={`text-sm font-medium ${parsedResult.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                                    {parsedResult.type === 'income' ? 'Receita' : 'Despesa'}
                                  </span>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>
                  
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setParsedResult(null)}
                      className="flex-1 py-3.5 bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 rounded-xl font-medium transition-all border border-gray-700"
                    >
                      Editar
                    </button>
                    <button 
                      onClick={handleSaveAI}
                      className="flex-[2] py-3.5 bg-green-600 text-white hover:bg-green-500 rounded-xl font-bold transition-all shadow-lg shadow-green-900/40 flex items-center justify-center gap-2"
                    >
                      <Check size={18} />
                      {parsedResult.installments && parsedResult.installments > 1 ? `Gerar ${parsedResult.installments} Parcelas` : 'Confirmar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MANUAL MODE */}
          {mode === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-5 animate-fade-in">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Descrição</label>
                <div className="relative group">
                  <FileSpreadsheet className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={16} />
                  <input 
                    required
                    type="text" 
                    value={manualForm.description}
                    onChange={e => setManualForm({...manualForm, description: e.target.value})}
                    placeholder="Ex: Supermercado"
                    className="input-primary pl-10 focus:border-[#d97757]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Valor (R$)</label>
                  <div className="relative group">
                    <DollarSign className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={16} />
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      value={manualForm.amount}
                      onChange={e => setManualForm({...manualForm, amount: e.target.value})}
                      placeholder="0,00"
                      className="input-primary pl-10 focus:border-[#d97757]"
                    />
                  </div>
                </div>

                <div>
                   <label className="block text-xs font-medium text-gray-400 mb-1.5">Data</label>
                   <div className="relative group z-30">
                    <CustomDatePicker
                      value={manualForm.date}
                      onChange={(val) => setManualForm({...manualForm, date: val})}
                    />
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Categoria</label>
                  <div className="relative group z-20">
                    <CustomAutocomplete 
                      value={manualForm.category}
                      onChange={(val) => setManualForm({...manualForm, category: val})}
                      options={categories}
                      icon={<Tag size={16} />}
                    />
                  </div>
                 </div>

                 <div>
                   <label className="block text-xs font-medium text-gray-400 mb-1.5">Tipo</label>
                   <div className="flex bg-gray-900 rounded-xl p-1 border border-gray-700">
                     <button
                        type="button"
                        onClick={() => setManualForm({...manualForm, type: 'income'})}
                        className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${manualForm.type === 'income' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-300'}`}
                     >
                       Receita
                     </button>
                     <button
                        type="button"
                        onClick={() => setManualForm({...manualForm, type: 'expense'})}
                        className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${manualForm.type === 'expense' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-300'}`}
                     >
                       Despesa
                     </button>
                   </div>
                 </div>
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  className="w-full py-3.5 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/30 flex items-center justify-center gap-2"
                >
                  <Check size={18} />
                  Adicionar Transação
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
