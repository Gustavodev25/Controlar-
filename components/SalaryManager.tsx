import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Edit2, Check, PlusCircle, Briefcase, Coins, Calculator, X, HelpCircle, Clock, AlertCircle } from './Icons';
import { useToasts } from './Toast';

interface SalaryManagerProps {
  baseSalary: number;
  currentIncome: number;
  onUpdateSalary: (newSalary: number) => void;
  onAddExtra: (amount: number, description: string) => void;
}

export const SalaryManager: React.FC<SalaryManagerProps> = ({ baseSalary, currentIncome, onUpdateSalary, onAddExtra }) => {
  // State for Base Salary Editing
  const [isEditing, setIsEditing] = useState(false);
  const [tempSalary, setTempSalary] = useState(baseSalary.toString());
  const [salaryError, setSalaryError] = useState<string | null>(null);
  
  // State for Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const toast = useToasts();

  // Modal Logic State
  const [activeTab, setActiveTab] = useState<'simple' | 'calculator'>('simple');
  
  // Simple Mode State
  const [extraAmount, setExtraAmount] = useState('');
  const [extraDesc, setExtraDesc] = useState('Freelance');

  // Calculator Mode State
  const [monthlyHours, setMonthlyHours] = useState('220');
  const [otQuantity, setOtQuantity] = useState('');
  const [otPercent, setOtPercent] = useState('50');
  
  // Validation State
  const [errors, setErrors] = useState<{monthlyHours?: boolean, otQuantity?: boolean}>({});

  // Calculated values
  // If baseSalary is 0, we use a fallback (e.g., 1) to avoid division by zero in UI display, though logic handles it.
  const safeMonthlyHours = parseFloat(monthlyHours) || 0;
  const safeOtQuantity = parseFloat(otQuantity) || 0;
  
  const hourlyRate = safeMonthlyHours > 0 ? baseSalary / safeMonthlyHours : 0;
  const otRate = hourlyRate * (1 + (parseFloat(otPercent) || 50) / 100);
  const totalCalculated = otRate * safeOtQuantity;

  // --- Effects for Animation ---
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

  const handleSaveSalary = () => {
    setSalaryError(null);
    const val = parseFloat(tempSalary);
    
    if (isNaN(val)) {
      setSalaryError("Insira um número válido");
      return;
    }
    
    if (val < 0) {
        setSalaryError("O valor não pode ser negativo");
        return;
    }

    onUpdateSalary(val);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveSalary();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setTempSalary(baseSalary.toString());
      setSalaryError(null);
    }
  };

  const handleAddSimple = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(extraAmount);
    if (!isNaN(val) && val > 0) {
      onAddExtra(val, extraDesc);
      handleCloseModal();
    } else {
      toast.error("Por favor, insira um valor válido.");
    }
  };

  const handleAddCalculated = () => {
    const newErrors = {
      monthlyHours: !safeMonthlyHours || safeMonthlyHours <= 0,
      otQuantity: !safeOtQuantity || safeOtQuantity <= 0
    };
    setErrors(newErrors);

    if (newErrors.monthlyHours || newErrors.otQuantity) {
      toast.error("Verifique os campos em vermelho.");
      return;
    }

    if (totalCalculated > 0) {
      const hours = parseFloat(otQuantity);
      const percent = parseFloat(otPercent);
      const desc = `Hora Extra (${hours}h à ${percent}%)`;
      onAddExtra(totalCalculated, desc);
      handleCloseModal();
    } else {
      toast.error("Valor calculado é inválido.");
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
        setExtraAmount('');
        setOtQuantity('');
        setExtraDesc('Freelance');
        setErrors({});
        setSalaryError(null);
        setActiveTab('simple');
    }, 300);
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const progressPercentage = baseSalary > 0 ? Math.min(100, (currentIncome / baseSalary) * 100) : 0;

  return (
    <>
      {/* Widget Principal do Dashboard */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-sm overflow-hidden mb-6 flex flex-col lg:flex-row">
        
        {/* Lado Esquerdo: Visualização e Edição do Salário */}
        <div className="p-6 flex-1 relative overflow-hidden border-b lg:border-b-0 lg:border-r border-gray-800">
           {/* Blur using Primary Color (Terracotta) */}
           <div className="absolute top-0 right-0 w-48 h-48 bg-[#d97757]/15 rounded-full -mr-10 -mt-10 blur-3xl pointer-events-none"></div>
           
           <div className="flex justify-between items-start mb-2 relative z-10">
            <div className="flex items-center gap-2">
              <Coins size={18} className="text-[#d97757]" />
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Salário Base & Metas</h3>
            </div>
            {!isEditing && baseSalary > 0 && (
               <button 
                 onClick={() => { setTempSalary(baseSalary.toString()); setIsEditing(true); setSalaryError(null); }} 
                 className="text-gray-500 hover:text-[#d97757] transition-colors text-xs flex items-center gap-1"
               >
                 <Edit2 size={12} /> Editar Meta
               </button>
            )}
          </div>

          <div className="mt-3 relative group min-h-[48px] flex flex-col justify-center">
            {isEditing ? (
              <div className="space-y-2 animate-fade-in relative z-20">
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-gray-400 text-xl font-medium">R$</span>
                    <input 
                        type="number"
                        value={tempSalary}
                        onChange={(e) => {
                            setTempSalary(e.target.value);
                            if (salaryError) setSalaryError(null);
                        }}
                        onKeyDown={handleKeyDown}
                        className={`bg-gray-800 text-white text-2xl font-bold w-full rounded-lg px-3 py-1 border outline-none transition-all shadow-inner ${salaryError ? 'border-red-500 focus:ring-2 focus:ring-red-500/50' : 'border-gray-700 focus:border-[#d97757] focus:ring-2 focus:ring-[#d97757]/50'}`}
                        autoFocus
                        placeholder="0.00"
                    />
                    <button 
                    onClick={handleSaveSalary}
                    className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-lg shadow-green-900/20 shrink-0"
                    title="Salvar (Enter)"
                    >
                    <Check size={18} />
                    </button>
                  </div>
                  {salaryError && (
                      <p className="text-red-400 text-xs flex items-center gap-1 animate-shake">
                          <AlertCircle size={12} /> {salaryError}
                      </p>
                  )}
              </div>
            ) : (
              <div 
                onClick={() => { setTempSalary(baseSalary.toString()); setIsEditing(true); setSalaryError(null); }}
                className="flex items-baseline gap-2 cursor-pointer hover:bg-gray-800/50 p-2 -ml-2 rounded-lg transition-all group w-full"
                title="Clique para editar seu salário base"
              >
                {baseSalary > 0 ? (
                   <>
                      <span className="text-4xl font-bold text-white group-hover:text-[#eab3a3] transition-colors">
                        {formatCurrency(baseSalary)}
                      </span>
                      <span className="text-sm text-gray-500 font-medium">/mês</span>
                   </>
                ) : (
                   <span className="text-xl font-medium text-gray-400 group-hover:text-white transition-colors flex items-center gap-2">
                      Definir Meta Salarial
                   </span>
                )}
                
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-gray-300 text-[10px] px-2 py-1 rounded ml-auto">
                  Editar
                </div>
              </div>
            )}
          </div>

          {/* Barra de Progresso */}
          <div className="mt-6">
             <div className="flex justify-between text-xs mb-2">
                <span className="text-gray-400 font-medium">Progresso da Meta Mensal</span>
                {baseSalary > 0 && (
                    <span className={currentIncome >= baseSalary ? 'text-green-400 font-bold' : 'text-[#d97757] font-bold'}>
                    {Math.round(progressPercentage)}%
                    </span>
                )}
             </div>
             <div className="w-full h-3 bg-gray-800/50 rounded-full overflow-hidden border border-gray-800">
                <div 
                  className={`h-full transition-all duration-1000 ease-out relative ${currentIncome > baseSalary ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-[#d97757] to-[#e08a6e]'}`}
                  style={{ width: `${progressPercentage}%` }}
                >
                  {progressPercentage > 0 && <div className="absolute inset-0 bg-white/20 animate-pulse"></div>}
                </div>
             </div>
             <div className="flex justify-between mt-2 text-xs">
               <div className="flex items-center gap-1.5">
                 <div className="w-2 h-2 rounded-full bg-gray-700"></div>
                 <span className="text-gray-500">Meta: {formatCurrency(baseSalary)}</span>
               </div>
               <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${currentIncome > baseSalary ? 'bg-green-500' : 'bg-[#d97757]'}`}></div>
                  <span className="text-gray-300">Realizado: {formatCurrency(currentIncome)}</span>
               </div>
             </div>
          </div>
        </div>

        {/* Lado Direito: Botão de Ação */}
        <div className="p-6 lg:w-80 bg-gray-900/30 flex flex-col justify-center items-center gap-4 border-t lg:border-t-0 border-gray-800">
           <div className="text-center">
             <p className="text-base font-medium text-gray-200">Renda Extra ou Hora Extra?</p>
             <p className="text-xs text-gray-500 mt-1">Registre ganhos adicionais para alcançar sua meta mais rápido.</p>
           </div>
           <button 
             onClick={() => setIsModalOpen(true)}
             className="w-full py-3 bg-[#d97757] hover:bg-[#c56a4d] text-[#faf9f5] rounded-xl font-medium transition-all shadow-lg shadow-[#d97757]/20 flex items-center justify-center gap-2 group border border-[#d97757]/50"
           >
             <div className="bg-white/20 p-1 rounded-full group-hover:scale-110 transition-transform">
               <PlusCircle size={18} />
             </div>
             Adicionar Renda
           </button>
        </div>
      </div>

      {/* MODAL DE INSERÇÃO DE RENDA */}
      {isVisible && createPortal(
        <div 
            className={`
                fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ease-in-out
                ${isAnimating ? 'bg-gray-950/90 backdrop-blur-sm' : 'bg-gray-950/0 backdrop-blur-0'}
            `}
        >
          <div 
             className={`
                bg-gray-950 rounded-3xl shadow-2xl w-full max-w-xl overflow-visible border border-gray-800 flex flex-col max-h-[90vh] relative transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]
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
              {/* Toggle Tab Style */}
              <div className="flex gap-2 bg-gray-900/50 p-1 rounded-xl border border-gray-700/50 backdrop-blur-md">
                <button 
                  onClick={() => setActiveTab('simple')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'simple' ? 'bg-gradient-to-r from-[#d97757] to-[#e68e70] text-white shadow-lg shadow-[#d97757]/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                  <Briefcase size={14} />
                  Simples
                </button>
                <button 
                  onClick={() => setActiveTab('calculator')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'calculator' ? 'bg-gray-800 text-white shadow-lg border border-gray-700' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                  <Calculator size={14} />
                  Calculadora
                </button>
              </div>

              <button onClick={handleCloseModal} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar relative z-10">
              
              {/* ABA: SIMPLES */}
              {activeTab === 'simple' && (
                <form onSubmit={handleAddSimple} className="space-y-6 animate-fade-in py-2">
                   <div className="text-center space-y-2 mb-8">
                      <div className="w-16 h-16 bg-gradient-to-br from-[#d97757] to-[#e68e70] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-[#d97757]/30">
                        <Coins size={32} className="text-white" />
                      </div>
                      <h4 className="text-white font-bold text-lg">Lançamento Rápido</h4>
                      <p className="text-sm text-gray-400 max-w-xs mx-auto">Para vendas ocasionais, freelances ou bônus de valor fixo.</p>
                   </div>

                   <div className="space-y-5">
                      <div>
                        <label className="text-xs font-medium text-gray-400 mb-1.5 block">Descrição</label>
                        <div className="relative group">
                            <Briefcase className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={16} />
                            <input 
                            type="text" 
                            required
                            placeholder="Ex: Venda de item usado"
                            value={extraDesc}
                            onChange={e => setExtraDesc(e.target.value)}
                            className="input-primary pl-10 focus:border-[#d97757]"
                            />
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium text-gray-400 mb-1.5 block">Valor Recebido (R$)</label>
                        <div className="relative group">
                            <span className="absolute left-3 top-3 text-gray-500 font-bold text-lg group-focus-within:text-[#d97757] transition-colors">R$</span>
                            <input 
                            type="number" 
                            required
                            step="0.01"
                            placeholder="0.00"
                            value={extraAmount}
                            onChange={e => setExtraAmount(e.target.value)}
                            className="input-primary pl-10 text-xl font-bold text-white focus:border-[#d97757]"
                            />
                        </div>
                      </div>
                   </div>

                   <div className="pt-4">
                        <button type="submit" className="w-full py-4 bg-[#d97757] hover:bg-[#c56a4d] text-[#faf9f5] rounded-xl font-bold shadow-lg shadow-[#d97757]/30 transition-all flex items-center justify-center gap-2">
                            <Check size={18} />
                            Confirmar Lançamento
                        </button>
                   </div>
                </form>
              )}

              {/* ABA: CALCULADORA */}
              {activeTab === 'calculator' && (
                <div className="space-y-6 animate-slide-up">
                   <div className="bg-[#d97757]/10 border border-[#d97757]/30 rounded-xl p-4 flex gap-4 items-start">
                      <HelpCircle className="text-[#d97757] shrink-0 mt-1" size={20} />
                      <div>
                        <h4 className="text-sm font-bold text-[#eab3a3] mb-1">Como funciona o cálculo?</h4>
                        {baseSalary > 0 ? (
                          <p className="text-xs text-gray-400 leading-relaxed">
                            Baseado no seu salário atual de {formatCurrency(baseSalary)}. O cálculo divide o salário pelas horas mensais e aplica o percentual extra.
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 leading-relaxed">
                            Defina um salário base no painel principal para usar a calculadora com precisão.
                          </p>
                        )}
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Inputs */}
                      <div className="space-y-5">
                         <div>
                            <label className="flex justify-between text-xs font-medium text-gray-400 mb-1.5">
                              <span>Divisor Mensal (Horas)</span>
                            </label>
                            <div className="relative group">
                              <Clock className={`absolute left-3 top-3.5 ${errors.monthlyHours ? 'text-red-500' : 'text-gray-500 group-focus-within:text-[#d97757]'}`} size={16} />
                              <input 
                                type="number" 
                                value={monthlyHours}
                                onChange={e => { setMonthlyHours(e.target.value); if(errors.monthlyHours) setErrors({...errors, monthlyHours: false}); }}
                                className={`input-primary pl-10 ${errors.monthlyHours ? 'border-red-500 bg-red-900/10 focus:border-red-500' : 'focus:border-[#d97757]'}`}
                              />
                            </div>
                         </div>

                         <div>
                            <label className="text-xs font-medium text-gray-400 mb-1.5 block">
                              Adicional (%)
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                               {[
                                 { label: '50%', value: '50', desc: 'Dia útil' }, 
                                 { label: '60%', value: '60', desc: 'Noturno' }, 
                                 { label: '100%', value: '100', desc: 'Feriado' }
                               ].map((opt) => (
                                 <button
                                   key={opt.value}
                                   onClick={() => setOtPercent(opt.value)}
                                   className={`p-2 rounded-lg border text-center transition-all ${otPercent === opt.value ? 'bg-[#d97757] border-[#d97757] text-[#faf9f5] shadow-lg' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                                 >
                                   <div className="font-bold text-sm">{opt.label}</div>
                                 </button>
                               ))}
                            </div>
                         </div>

                         <div>
                            <label className="text-xs font-medium text-gray-400 mb-1.5 block">
                              Quantidade de Horas
                            </label>
                            <div className="relative group">
                                <input 
                                    type="number" 
                                    placeholder="Ex: 2.5"
                                    value={otQuantity}
                                    onChange={e => { setOtQuantity(e.target.value); if(errors.otQuantity) setErrors({...errors, otQuantity: false}); }}
                                    className={`input-primary text-lg font-bold ${errors.otQuantity ? 'border-red-500 bg-red-900/10 focus:border-red-500 text-red-400' : 'focus:border-[#d97757]'}`}
                                    autoFocus
                                />
                                <span className="absolute right-3 top-3.5 text-xs font-bold text-gray-500 uppercase">Horas</span>
                            </div>
                         </div>
                      </div>

                      {/* Result Card */}
                      <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-5 flex flex-col h-full justify-between relative overflow-hidden">
                         
                         <div className="space-y-3 relative z-0 mb-4">
                            <h5 className="text-gray-500 text-[10px] font-bold uppercase tracking-wider border-b border-gray-800 pb-2">Resumo</h5>
                            
                            <div className="flex justify-between items-center text-xs">
                               <span className="text-gray-400">Valor Hora</span>
                               <span className="text-gray-300 font-mono">{formatCurrency(hourlyRate)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                               <span className="text-gray-400">Hora Extra (+{otPercent}%)</span>
                               <span className="text-[#eab3a3] font-mono font-medium">{formatCurrency(otRate)}</span>
                            </div>
                         </div>

                         <div className="relative z-0">
                            <div className={`bg-gray-950 rounded-xl p-4 border transition-colors mb-4 shadow-inner ${totalCalculated > 0 ? 'border-green-500/30' : 'border-gray-800'}`}>
                               <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 text-center">Total a Receber</p>
                               <p className={`text-3xl font-bold text-center ${totalCalculated > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                                 {formatCurrency(totalCalculated)}
                               </p>
                            </div>
                            
                            <button 
                              onClick={handleAddCalculated}
                              disabled={totalCalculated <= 0}
                              className="w-full py-3 bg-[#d97757] hover:bg-[#c56a4d] text-[#faf9f5] rounded-xl font-bold shadow-lg shadow-[#d97757]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              <Check size={18} />
                              Lançar
                            </button>
                         </div>
                      </div>
                   </div>
                </div>
              )}
            </div>

          </div>
        </div>,
        document.body
      )}
    </>
  );
};