import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Edit2, Check, PlusCircle, Briefcase, Coins, Calculator, X, HelpCircle, Clock, AlertCircle, ChevronRight, Users, Wallet, Trash2, Calendar, Percent, PieChart, CheckCircleFilled, TrendingUp, Lock, Sparkles, Settings, Building } from './Icons';
import { useToasts } from './Toast';
import NumberFlow from '@number-flow/react';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from './Dropdown';
import Lottie from 'lottie-react';
import coinAnimation from '../assets/coin.json';

interface SalaryManagerProps {
  baseSalary: number;
  currentIncome: number;
  estimatedSalary?: number; // Estimated salary from Open Finance transactions (Pro Mode)
  paymentDay?: number;
  advanceValue?: number;
  advancePercent?: number;
  advanceDay?: number;
  onUpdateSalary: (newSalary: number, paymentDay?: number, advanceOptions?: { advanceValue?: number; advancePercent?: number; advanceDay?: number }) => void;
  onAddExtra: (amount: number, description: string, status?: 'completed' | 'pending', date?: string) => void;
  onEditClick?: () => void;
  isSalaryLaunched?: boolean;
  isProMode?: boolean;
  onToggleProMode?: (value: boolean) => void;
  userPlan?: 'starter' | 'pro' | 'family';
  onUpgradeClick?: () => void;
  includeOpenFinance?: boolean;
  onToggleOpenFinance?: (value: boolean) => void;
}

export const SalaryManager: React.FC<SalaryManagerProps> = ({
  baseSalary,
  currentIncome,
  estimatedSalary = 0,
  paymentDay,
  advanceValue,
  advancePercent,
  advanceDay,
  onUpdateSalary,
  onAddExtra,
  onEditClick,
  isSalaryLaunched,
  isProMode = false,
  onToggleProMode,
  userPlan = 'starter',
  onUpgradeClick,
  includeOpenFinance = true,
  onToggleOpenFinance
}) => {
  // State for Base Salary Editing
  const [isEditing, setIsEditing] = useState(false);
  const [tempSalary, setTempSalary] = useState(baseSalary.toString());
  const [tempPaymentDay, setTempPaymentDay] = useState(paymentDay?.toString() || '5');

  // Split / Advance Logic
  const [hasAdvance, setHasAdvance] = useState(!!(advancePercent && advancePercent > 0) || !!(advanceValue && advanceValue > 0));
  const [tempAdvancePercent, setTempAdvancePercent] = useState(advancePercent?.toString() || '40');
  const [tempAdvanceDay, setTempAdvanceDay] = useState(advanceDay?.toString() || '20');

  const [salaryError, setSalaryError] = useState<string | null>(null);

  // State for Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // State for Config Dropdown
  const [showConfigTooltip, setShowConfigTooltip] = useState(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('hasSeenConfigTooltip_v2');
    }
    return false;
  });

  const dismissTooltip = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfigTooltip(false);
    localStorage.setItem('hasSeenConfigTooltip_v2', 'true');
  };

  const toast = useToasts();

  // Modal Logic State
  const [activeTab, setActiveTab] = useState<'simple' | 'calculator' | 'clt'>('simple');

  // Simple Mode State
  const [extraAmount, setExtraAmount] = useState('');
  const [extraDesc, setExtraDesc] = useState('Freelance');
  const [simpleDeductTaxes, setSimpleDeductTaxes] = useState(false);

  // Calculator Mode State
  const [monthlyHours, setMonthlyHours] = useState('220');
  const [otQuantity, setOtQuantity] = useState('');
  const [otPercent, setOtPercent] = useState('50');
  const [tempBaseSalary, setTempBaseSalary] = useState('');
  const [deductTaxes, setDeductTaxes] = useState(false);

  // CLT Mode State
  const [cltGross, setCltGross] = useState('');
  const [cltDependents, setCltDependents] = useState('0');
  const [cltOtherDiscounts, setCltOtherDiscounts] = useState('');
  const [cltBenefits, setCltBenefits] = useState('');

  // Validation State
  const [errors, setErrors] = useState<{ monthlyHours?: boolean, otQuantity?: boolean, tempBaseSalary?: boolean }>({});

  // --- Calculated Values (Real-time) ---
  // Helper to safely parse inputs that might contain commas
  const parseInput = (val: string) => {
    if (!val) return 0;
    // Replace comma with dot
    const normalized = val.replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // 1. Hora Extra Logic
  const effectiveBaseSalary = baseSalary > 0 ? baseSalary : parseInput(tempBaseSalary);
  const safeBaseSalary = effectiveBaseSalary || 0;
  const safeMonthlyHours = parseInput(monthlyHours) || 220;
  const hourlyRate = safeMonthlyHours > 0 ? safeBaseSalary / safeMonthlyHours : 0;

  const safeOtPercent = parseInput(otPercent) || 50;
  const otMultiplier = 1 + (safeOtPercent / 100);
  const otHourlyRate = hourlyRate * otMultiplier;

  const safeOtQuantity = parseInput(otQuantity) || 0;
  const totalCalculated = otHourlyRate * safeOtQuantity;

  // 2. CLT Logic (2025 Rules)
  const safeCltGross = parseInput(cltGross);
  const safeCltDependents = parseInt(cltDependents) || 0;
  const safeCltOtherDiscounts = parseInput(cltOtherDiscounts);
  const safeCltBenefits = parseInput(cltBenefits);

  const calculateCLT = (gross: number, dependents: number) => {
    if (gross <= 0) return { inss: 0, irrf: 0, net: 0 };

    // 1. INSS (2025 Progressive)
    let inss = 0;
    if (gross <= 1518.00) {
      inss = gross * 0.075;
    } else if (gross <= 2793.88) {
      inss = (gross * 0.09) - 22.77;
    } else if (gross <= 4190.83) {
      inss = (gross * 0.12) - 106.59;
    } else if (gross <= 8157.41) {
      inss = (gross * 0.14) - 190.40;
    } else {
      inss = 951.63; // Teto
    }

    // 2. IRRF (2025 Rules)
    // Option A: Legal Deductions (INSS + Dependents)
    const deductibleDependents = dependents * 189.59;
    const baseA = gross - inss - deductibleDependents;

    // Option B: Simplified Discount (Replaces Legal Deductions)
    const simplifiedDiscount = 607.20; // 2025
    const baseB = gross - simplifiedDiscount;

    // Use the smaller base (beneficial for user)
    const finalBase = Math.min(baseA, baseB);

    // IRRF Calculation Function (2025 Table)
    const calcTax = (base: number) => {
      if (base <= 2428.80) return 0;
      if (base <= 2826.65) return (base * 0.075) - 182.16;
      if (base <= 3751.05) return (base * 0.15) - 394.16;
      if (base <= 4664.68) return (base * 0.225) - 675.49;
      return (base * 0.275) - 908.73;
    };

    const taxA = Math.max(0, calcTax(baseA));
    const taxB = Math.max(0, calcTax(baseB)); // Note: BaseB here is Gross - 607.20 (NO INSS deduction)

    const irrf = Math.min(taxA, taxB);

    return {
      inss,
      irrf,
      net: gross - inss - irrf
    };
  };

  // Calculate Marginal Tax for Overtime
  const taxesOnBase = calculateCLT(effectiveBaseSalary, 0);
  const taxesOnTotal = calculateCLT(effectiveBaseSalary + totalCalculated, 0);
  const marginalDiscount = (taxesOnTotal.inss + taxesOnTotal.irrf) - (taxesOnBase.inss + taxesOnBase.irrf);
  const finalOtValue = deductTaxes ? Math.max(0, totalCalculated - marginalDiscount) : totalCalculated;

  // Calculate Marginal Tax for Simple Mode
  const simpleAmountVal = parseInput(extraAmount);
  const simpleTaxesOnBase = calculateCLT(baseSalary > 0 ? baseSalary : 0, 0);
  const simpleTaxesOnTotal = calculateCLT((baseSalary > 0 ? baseSalary : 0) + simpleAmountVal, 0);
  const simpleMarginalDiscount = (simpleTaxesOnTotal.inss + simpleTaxesOnTotal.irrf) - (simpleTaxesOnBase.inss + simpleTaxesOnBase.irrf);
  const finalSimpleValue = simpleDeductTaxes ? Math.max(0, simpleAmountVal - simpleMarginalDiscount) : simpleAmountVal;

  const cltResults = calculateCLT(safeCltGross, safeCltDependents);
  const finalCltNet = Math.max(0, cltResults.net - safeCltOtherDiscounts + safeCltBenefits);

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
    const val = parseInput(tempSalary);
    const day = parseInt(tempPaymentDay);

    if (isNaN(val)) {
      setSalaryError("Insira um número válido");
      return;
    }

    if (val < 0) {
      setSalaryError("O valor não pode ser negativo");
      return;
    }

    if (isNaN(day) || day < 1 || day > 31) {
      setSalaryError("Dia de pagamento inválido (1-31)");
      return;
    }

    let advPercent = 0;
    let advDay = 0;

    if (hasAdvance) {
      advPercent = parseInput(tempAdvancePercent);
      advDay = parseInt(tempAdvanceDay);

      if (isNaN(advPercent) || advPercent <= 0 || advPercent >= 100) {
        setSalaryError("Porcentagem do vale inválida");
        return;
      }
      if (isNaN(advDay) || advDay < 1 || advDay > 31) {
        setSalaryError("Dia do vale inválido (1-31)");
        return;
      }
    }

    onUpdateSalary(val, day, {
      advancePercent: hasAdvance ? advPercent : 0,
      advanceValue: 0, // We prefer percent now
      advanceDay: hasAdvance ? advDay : undefined
    });

    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveSalary();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setTempSalary(baseSalary.toString());
      setTempPaymentDay(paymentDay?.toString() || '5');
      setSalaryError(null);
    }
  };

  const handleAddSimple = (e: React.FormEvent) => {
    e.preventDefault();

    if (finalSimpleValue > 0) {
      const desc = `${extraDesc}${simpleDeductTaxes ? ' - Líq.' : ''}`;
      onAddExtra(finalSimpleValue, desc);
      handleCloseModal();
    } else {
      toast.error("Por favor, insira um valor válido.");
    }
  };

  const handleAddCalculated = () => {
    const newErrors = {
      monthlyHours: !safeMonthlyHours || safeMonthlyHours <= 0,
      otQuantity: !safeOtQuantity || safeOtQuantity <= 0,
      tempBaseSalary: baseSalary <= 0 && (!effectiveBaseSalary || effectiveBaseSalary <= 0)
    };
    setErrors(newErrors);

    if (newErrors.monthlyHours || newErrors.otQuantity || newErrors.tempBaseSalary) {
      toast.error("Preencha todos os campos corretamente.");
      return;
    }

    if (finalOtValue > 0) {
      // Generate description with calculation details
      const desc = `Hora Extra (${safeOtQuantity.toString().replace('.', ',')}h à ${safeOtPercent}%)${deductTaxes ? ' - Líq.' : ''}`;
      // Arredondamos para 2 casas decimais para o registro
      const finalAmount = Math.round((finalOtValue + Number.EPSILON) * 100) / 100;

      onAddExtra(finalAmount, desc);
      handleCloseModal();
    } else {
      toast.error("O valor total deve ser maior que zero.");
    }
  };

  const handleAddCLT = () => {
    if (finalCltNet > 0) {
      onAddExtra(finalCltNet, "Salário Líquido (CLT)");
      handleCloseModal();
    } else {
      toast.error("Valor inválido.");
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setExtraAmount('');
      setOtQuantity('');
      setTempBaseSalary('');
      setExtraDesc('Freelance');
      setCltGross('');
      setCltDependents('0');
      setCltOtherDiscounts('');
      setCltBenefits('');
      setErrors({});
      setSalaryError(null);
      setDeductTaxes(false);
      setSimpleDeductTaxes(false);
      setActiveTab('simple');
    }, 300);
  };


  return (
    <>
      {/* Animação pulsante para o blur */}
      <style>{`
        @keyframes blur-pulse {
          0%, 100% {
            opacity: 0.12;
            transform: translate(40px, -40px) scale(1);
          }
          50% {
            opacity: 0.22;
            transform: translate(40px, -40px) scale(1.05);
          }
        }
        .animate-blur-pulse {
          animation: blur-pulse 5s ease-in-out infinite;
        }
      `}</style>
      {/* Header com título e switch */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Controle de Renda</h2>
          <p className="text-xs text-gray-500">Gerencie seus ganhos mensais</p>
        </div>

        {/* Switch Modo Manual / Modo Pro */}
        <div className="flex items-center gap-2">
          {/* Config Dropdown Trigger */}
          {onToggleOpenFinance && isProMode && (
            <Dropdown>
              <DropdownTrigger className={`p-2 px-3 rounded-xl border transition-all flex items-center gap-2 data-[state=open]:bg-[#30302E] data-[state=open]:border-gray-800 data-[state=open]:text-gray-400 data-[state=open]:hover:text-white ${includeOpenFinance ? 'bg-[#30302E] border-gray-800 text-gray-500 hover:text-gray-400' : 'bg-[#30302E] border-gray-800 text-gray-500 hover:text-gray-400'}`}>
                <Settings size={16} />
                <span className="text-xs font-medium">Configuração Global</span>
              </DropdownTrigger>

              {/* Tooltip */}
              {showConfigTooltip && (
                <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 w-48 bg-[#363735] border border-[#3A3B39] text-white p-3 rounded-xl shadow-xl animate-fade-in z-50 flex items-start gap-2">
                  {/* Arrow */}
                  <div className="absolute top-1/2 -translate-y-1/2 right-[-6px] w-3 h-3 bg-[#363735] border-r border-t border-[#3A3B39] rotate-45"></div>

                  <div className="flex-1">
                    <p className="text-[10px] font-bold uppercase opacity-80 mb-0.5 text-[#d97757]">Configuração Global</p>
                    <p className="text-xs font-medium leading-tight text-gray-200">Configure o Open Finance por aqui.</p>
                  </div>
                  <button onClick={dismissTooltip} className="text-gray-500 hover:text-white transition-colors">
                    <X size={14} />
                  </button>
                </div>
              )}

              <DropdownContent width="w-64" align="right" portal>
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-700/50 px-2 pt-1">
                  <div className="p-1.5 rounded bg-orange-900/30 text-orange-400">
                    <Settings size={12} />
                  </div>
                  <p className="text-xs text-gray-400 font-medium">Configuração Global</p>
                </div>

                <DropdownItem
                  onClick={() => onToggleOpenFinance(!includeOpenFinance)}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded bg-blue-900/30 text-blue-400`}>
                        <Building size={14} />
                      </div>
                      <span className="text-sm">Incluir Open Finance</span>
                    </div>
                    <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 ${includeOpenFinance ? 'bg-[#d97757]' : 'bg-gray-700'}`}>
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${includeOpenFinance ? 'translate-x-5' : 'translate-x-1'}`} />
                    </div>
                  </div>
                </DropdownItem>
              </DropdownContent>
            </Dropdown>
          )}

          <div className="flex items-center gap-3 bg-[#30302E] border border-gray-800 rounded-xl px-3 py-2">
            <span className={`text-xs font-medium transition-colors ${!isProMode ? 'text-white' : 'text-gray-500'}`}>
              Manual
            </span>
            <button
              onClick={() => {
                // Se o usuário está no plano gratuito e tenta ativar o modo Auto, redireciona para upgrade
                if (userPlan === 'starter' && !isProMode) {
                  onUpgradeClick?.();
                  return;
                }
                onToggleProMode?.(!isProMode);
              }}
              className={`relative w-12 h-6 rounded-full transition-colors ${isProMode
                ? 'bg-[#d97757]'
                : 'bg-gray-700'
                }`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-md ${isProMode ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
            <div className="flex items-center gap-1">
              <span className={`text-xs font-medium transition-colors ${isProMode ? 'text-[#d97757]' : 'text-gray-500'}`}>
                Auto
              </span>
              {userPlan === 'starter' && !isProMode && (
                <Lock size={12} className="text-amber-500" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Widget Principal do Dashboard */}
      <div className="bg-[#30302E] rounded-xl border border-gray-800 shadow-sm overflow-hidden mb-6 flex flex-col lg:flex-row animate-fade-in">

        {/* Lado Esquerdo: Visualização e Edição do Salário */}
        <div className="p-6 flex-1 relative overflow-hidden border-b lg:border-b-0 lg:border-r border-gray-800">
          {/* Blur using Primary Color (Terracotta) - Pulsante */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#d97757] rounded-full blur-3xl pointer-events-none animate-blur-pulse"></div>

          <div className="flex justify-between items-start mb-2 relative z-10">
            <div className="flex items-center gap-2">
              <Coins size={18} className="text-[#d97757]" />
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                {isProMode ? 'Renda Estimada' : 'Salário Base'}
              </h3>
              {isProMode && (
                <span className="text-[9px] bg-[#d97757]/20 text-[#d97757] px-1.5 py-0.5 rounded font-medium">
                  AUTO
                </span>
              )}
            </div>
            {!isEditing && baseSalary > 0 && !isProMode && (
              <button
                onClick={() => {
                  if (onEditClick) {
                    onEditClick();
                  } else {
                    setTempSalary(baseSalary.toString().replace('.', ','));
                    setTempPaymentDay(paymentDay?.toString() || '5');
                    setIsEditing(true);
                    setSalaryError(null);
                  }
                }}
                className="text-gray-500 hover:text-[#d97757] transition-colors text-xs flex items-center gap-1"
              >
                <Edit2 size={12} /> Editar
              </button>
            )}
          </div>

          <div className="mt-3 relative group min-h-[48px] flex flex-col justify-center">
            {isEditing ? (
              <div className="space-y-4 animate-fade-in relative z-20 w-full">
                <div className="flex items-center gap-3 w-full">
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-gray-400 text-xl font-medium">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={tempSalary}
                      onChange={(e) => {
                        setTempSalary(e.target.value);
                        if (salaryError) setSalaryError(null);
                      }}
                      onKeyDown={handleKeyDown}
                      className={`bg-gray-800 text-white text-2xl font-bold w-full rounded-lg px-3 py-1 border outline-none transition-all shadow-inner ${salaryError ? 'border-red-500 focus:ring-2 focus:ring-red-500/50' : 'border-gray-700 focus:border-[#d97757] focus:ring-2 focus:ring-[#d97757]/50'}`}
                      autoFocus
                      placeholder="0,00"
                    />
                  </div>

                  <div className="w-24">
                    <label className="text-[10px] text-gray-400 block mb-0.5">Dia Pagto.</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={tempPaymentDay}
                      onChange={(e) => setTempPaymentDay(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="bg-gray-800 text-white text-sm font-bold w-full rounded-lg px-2 py-1.5 border border-gray-700 focus:border-[#d97757] outline-none text-center"
                    />
                  </div>
                </div>

                {/* Divisão de Salário / Vale */}
                <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
                  <div className="flex items-center gap-2 mb-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasAdvance}
                        onChange={(e) => setHasAdvance(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#d97757]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#d97757]"></div>
                    </label>
                    <span className="text-xs font-medium text-gray-300">Recebo Adiantamento (Vale)</span>
                  </div>

                  {hasAdvance && (
                    <div className="space-y-3 animate-fade-in">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <label className="text-[10px] text-gray-400 block mb-1 flex justify-between">
                            <span>Porcentagem do Vale</span>
                            <span className="text-white font-bold">{tempAdvancePercent}%</span>
                          </label>
                          <input
                            type="range"
                            min="10"
                            max="80"
                            step="5"
                            value={tempAdvancePercent}
                            onChange={(e) => setTempAdvancePercent(e.target.value)}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#d97757]"
                          />
                        </div>
                        <div className="w-20">
                          <label className="text-[10px] text-gray-400 block mb-0.5">Dia Vale</label>
                          <input
                            type="number"
                            min="1"
                            max="31"
                            value={tempAdvanceDay}
                            onChange={(e) => setTempAdvanceDay(e.target.value)}
                            className="bg-[#30302E] text-white text-xs font-bold w-full rounded-lg px-2 py-1.5 border border-gray-700 focus:border-[#d97757] outline-none text-center"
                          />
                        </div>
                      </div>

                      {/* Preview Calculation */}
                      {(() => {
                        const sal = parseInput(tempSalary);
                        const perc = parseInput(tempAdvancePercent);
                        const vale = sal * (perc / 100);
                        const resto = sal - vale;
                        return (
                          <div className="flex gap-2 text-[10px]">
                            <div className="flex-1 bg-[#30302E]/50 p-2 rounded border border-gray-700/50">
                              <p className="text-gray-500 mb-0.5">Vale ({perc}%)</p>
                              <p className="text-[#eab3a3] font-mono font-bold">{formatCurrency(vale)}</p>
                            </div>
                            <div className="flex-1 bg-[#30302E]/50 p-2 rounded border border-gray-700/50">
                              <p className="text-gray-500 mb-0.5">Restante</p>
                              <p className="text-white font-mono font-bold">{formatCurrency(resto)}</p>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setSalaryError(null);
                    }}
                    className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveSalary}
                    className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-lg shadow-green-900/20 flex items-center gap-2 text-xs font-bold"
                  >
                    <Check size={14} />
                    Salvar Configuração
                  </button>
                </div>

                {salaryError && (
                  <p className="text-red-400 text-xs flex items-center gap-1 animate-shake">
                    <AlertCircle size={12} /> {salaryError}
                  </p>
                )}
              </div>
            ) : isProMode ? (
              // Modo Pro: Exibição somente leitura da estimativa
              <div className="p-2 -ml-2 w-full">
                {estimatedSalary > 0 ? (
                  <div className="flex flex-col w-full">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white">
                        {formatCurrency(estimatedSalary)}
                      </span>
                      <span className="text-sm text-gray-500 font-medium">/mês</span>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs text-emerald-400 flex items-center gap-1 bg-emerald-900/30 px-2 py-1 rounded border border-emerald-500/30">
                        <div className="w-6 h-6 flex items-center justify-center">
                          <Lottie animationData={coinAnimation} loop={true} />
                        </div>
                        Analisado através das transações
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <span className="text-xl font-medium text-gray-400 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 animate-spin"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M4.05 11a8 8 0 1 1 .5 4m-.5 5v-5h5" /></svg>
                      Aguardando dados
                    </span>
                    <span className="text-xs text-gray-500 ml-8">
                      Conecte suas contas para ver a estimativa
                    </span>
                  </div>
                )}
              </div>
            ) : (
              // Modo Manual: Editável por clique
              <div
                onClick={() => {
                  if (onEditClick) {
                    onEditClick();
                  } else {
                    setTempSalary(baseSalary.toString().replace('.', ','));
                    setTempPaymentDay(paymentDay?.toString() || '5');
                    setIsEditing(true);
                    setSalaryError(null);
                  }
                }}
                className="flex items-baseline gap-2 cursor-pointer hover:bg-gray-800/50 p-2 -ml-2 rounded-lg transition-all group w-full"
                title="Clique para editar seu salário base"
              >
                {baseSalary > 0 ? (
                  <>
                    <div className="flex flex-col w-full">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-white group-hover:text-[#eab3a3] transition-colors">
                          {formatCurrency(baseSalary)}
                        </span>
                        <span className="text-sm text-gray-500 font-medium">/mês</span>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs text-gray-500 flex items-center gap-1 bg-gray-800/50 px-2 py-1 rounded border border-gray-700/50">
                          <Clock size={10} /> Recebe dia {paymentDay || 5}
                        </span>

                        {(advancePercent || (advanceValue && advanceValue > 0)) && (
                          <span className="text-xs text-[#eab3a3] flex items-center gap-1 bg-[#d97757]/10 px-2 py-1 rounded border border-[#d97757]/20">
                            <PieChart size={10} />
                            Vale {advancePercent}% (Dia {advanceDay || 20})
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-1">
                    <span className="text-xl font-medium text-gray-300 group-hover:text-white transition-colors flex items-center gap-2">
                      <AlertCircle size={20} className="text-amber-400" />
                      Definir Renda Mensal
                    </span>
                    <span className="text-xs text-gray-500 group-hover:text-amber-400/80 transition-colors ml-7">
                      Clique para configurar salário e data
                    </span>
                  </div>
                )}

                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-gray-300 text-[10px] px-2 py-1 rounded ml-auto self-start mt-2">
                  Editar
                </div>
              </div>
            )}
          </div>

          {/* Salary Insights Grid */}
          {baseSalary > 0 && !isEditing && !isProMode && (
            <div className="mt-6 grid grid-cols-2 gap-2 animate-fade-in">
              {/* Hourly Rate Card */}
              <div className="bg-gray-800/30 rounded-lg p-2.5 border border-gray-800/50 flex flex-col justify-center relative group hover:bg-gray-800/50 transition-colors">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock size={12} className="text-gray-500" />
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Valor Hora</span>
                </div>
                <p className="text-gray-300 font-mono font-bold text-sm">
                  {formatCurrency(baseSalary / 220)}
                </p>
              </div>

              {/* Payment Countdown */}
              <div className="bg-gray-800/30 rounded-lg p-2.5 border border-gray-800/50 flex flex-col justify-center relative group hover:bg-gray-800/50 transition-colors">
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar size={12} className="text-gray-500" />
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Próx. Pagto</span>
                </div>
                <p className="text-gray-300 font-mono font-bold text-sm">
                  {(() => {
                    if (!paymentDay) return <span className="text-gray-600 text-xs font-sans">Definir dia</span>;

                    const today = new Date();
                    const currentDay = today.getDate();
                    let days = 0;

                    // Check upcoming payment (either Main or Advance)
                    const dates = [paymentDay];
                    if (advanceDay) dates.push(advanceDay);
                    dates.sort((a, b) => a - b);

                    const nextDate = dates.find(d => d >= currentDay) || dates[0]; // Next in this month or first of next month

                    if (currentDay === nextDate) return <span className="text-green-400">Hoje!</span>;

                    if (nextDate > currentDay) {
                      days = nextDate - currentDay;
                    } else {
                      // Get days in current month to find exact days until next month's date
                      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
                      days = (daysInMonth - currentDay) + nextDate;
                    }

                    return <span className={days <= 5 ? 'text-[#d97757]' : ''}>{days} dias</span>;
                  })()}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Lado Direito: Botão de Ação - Apenas no Modo Manual */}
        {!isProMode && (
          <div className="p-6 lg:w-80 bg-[#30302E]/30 flex flex-col justify-center gap-3 border-t lg:border-t-0 border-gray-800">
            <div className="text-center mb-1">
              <p className="text-base font-medium text-gray-200">Gerenciar Renda</p>
              <p className="text-xs text-gray-500">Lançamentos e Ferramentas</p>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1 w-full">
              <button
                disabled={isSalaryLaunched}
                onClick={() => {
                  if (isSalaryLaunched) return;

                  if (baseSalary <= 0) {
                    toast.error("Defina um salário base primeiro.");
                    return;
                  }

                  const today = new Date();
                  const pDay = paymentDay || 5;

                  // Main Salary Date
                  let targetDate = new Date(today.getFullYear(), today.getMonth(), pDay)
                  const dateStr = targetDate.toISOString().split('T')[0];

                  // Calculate Advance (Value or Percent)
                  let advance = advanceValue || 0;

                  // Calculate based on percent if preferred (and configured)
                  if (advancePercent && advancePercent > 0) {
                    advance = baseSalary * (advancePercent / 100);
                  }

                  // Round to 2 decimals
                  advance = Math.round((advance + Number.EPSILON) * 100) / 100;
                  const salaryRemaining = Math.max(0, baseSalary - advance);

                  // 1. Register Remaining Salary (Main Payment)
                  onAddExtra(salaryRemaining, "Salário Mensal", "pending", dateStr);

                  // 2. Register Advance (Vale)
                  if (advance > 0) {
                    // Determine Vale Date
                    let valeDateStr = dateStr;
                    if (advanceDay) {
                      const vDate = new Date(today.getFullYear(), today.getMonth(), advanceDay);
                      valeDateStr = vDate.toISOString().split('T')[0];
                    }

                    setTimeout(() => {
                      onAddExtra(advance, "Vale / Adiantamento", "pending", valeDateStr);
                    }, 100);

                    toast.success(`Lançados: Salário (${targetDate.getDate()}) e Vale (${advanceDay || targetDate.getDate()})!`);
                  } else {
                    toast.success(`Salário lançado para dia ${targetDate.getDate()}!`);
                  }
                }}
                className={`col-span-2 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs mb-1 border ${isSalaryLaunched
                  ? 'bg-green-900/20 text-green-500 border-green-900/30 cursor-default'
                  : 'bg-[#d97757]/10 hover:bg-[#d97757]/20 text-[#d97757] hover:text-white border-[#d97757]/20 hover:border-[#d97757]'
                  }`}
              >
                {isSalaryLaunched ? <CheckCircleFilled size={14} /> : <Calendar size={14} />}
                {isSalaryLaunched ? 'Salário Lançado' : 'Lançar Salário Atual'}
              </button>

              <button
                onClick={() => { setActiveTab('simple'); setIsModalOpen(true); }}
                className="col-span-2 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl font-medium transition-all border border-gray-700 hover:border-gray-600 flex items-center justify-center gap-2 text-xs"
              >
                <PlusCircle size={14} className="text-[#d97757]" />
                Lançar Extra
              </button>
              <button
                onClick={() => { setActiveTab('clt'); setIsModalOpen(true); }}
                className="py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl font-medium transition-all border border-gray-700 hover:border-gray-600 flex flex-col items-center justify-center gap-1 text-xs"
              >
                <Briefcase size={14} className="text-[#d97757]" />
                Calc. CLT
              </button>
              <button
                onClick={() => { setActiveTab('calculator'); setIsModalOpen(true); }}
                className="py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl font-medium transition-all border border-gray-700 hover:border-gray-600 flex flex-col items-center justify-center gap-1 text-xs"
              >
                <Clock size={14} className="text-[#d97757]" />
                Calc. Hora Extra
              </button>
            </div>
          </div>
        )}
      </div >

      {/* MODAL DE INSERÇÃO DE RENDA */}
      {
        isVisible && createPortal(
          <div
            className={`
                fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ease-in-out
                ${isAnimating ? 'bg-black/90 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-0'}
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
                <div className="flex gap-2 bg-[#30302E]/50 p-1 rounded-xl border border-gray-700/50 backdrop-blur-md overflow-x-auto no-scrollbar max-w-[80%]">
                  <button
                    onClick={() => setActiveTab('simple')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'simple' ? 'bg-gradient-to-r from-[#d97757] to-[#e68e70] text-white shadow-lg shadow-[#d97757]/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                    <Briefcase size={14} />
                    Simples
                  </button>
                  <button
                    onClick={() => setActiveTab('clt')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'clt' ? 'bg-gray-800 text-white shadow-lg border border-gray-700' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                    <Coins size={14} />
                    Líquido CLT
                  </button>
                  <button
                    onClick={() => setActiveTab('calculator')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'calculator' ? 'bg-gray-800 text-white shadow-lg border border-gray-700' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                    <Calculator size={14} />
                    Hora Extra
                  </button>
                </div>

                <button onClick={handleCloseModal} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-full transition-colors shrink-0">
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto custom-scrollbar relative z-10">

                {/* ABA: SIMPLES */}
                {activeTab === 'simple' && (
                  <form onSubmit={handleAddSimple} className="space-y-6 animate-slide-up">
                    <>
                      <div className="bg-[#d97757]/10 border border-[#d97757]/30 rounded-xl p-4 flex gap-4 items-start">
                        <HelpCircle className="text-[#d97757] shrink-0 mt-1" size={20} />
                        <div>
                          <h4 className="text-sm font-bold text-[#eab3a3] mb-1">Lançamento Rápido</h4>
                          <p className="text-xs text-gray-400 leading-relaxed">
                            Registre entradas avulsas de forma simples.
                            <br />
                            <span className="opacity-70">Ideal para vendas ocasionais, freelances ou bônus de valor fixo.</span>
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                autoFocus
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-gray-400 mb-1.5 block">Valor Recebido (R$)</label>
                            <div className="relative group">
                              <span className="absolute left-3 top-3 text-gray-500 font-bold text-lg group-focus-within:text-[#d97757] transition-colors">R$</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                required
                                placeholder="0,00"
                                value={extraAmount}
                                onChange={e => setExtraAmount(e.target.value)}
                                className="input-primary pl-10 text-xl font-bold text-white focus:border-[#d97757]"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-3 pt-2 border-t border-gray-800">
                            <label className="relative inline-flex items-center cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={simpleDeductTaxes}
                                onChange={(e) => setSimpleDeductTaxes(e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#d97757]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#d97757]"></div>
                            </label>
                            <div>
                              <p className="text-xs font-bold text-gray-300">Deduzir Impostos (Estimativa)</p>
                              <p className="text-[9px] text-gray-500">Calcula INSS/IRRF marginal sobre o valor extra.</p>
                            </div>
                          </div>
                        </div>

                        {/* Result Card (Summary) */}
                        <div className="bg-[#30302E]/50 rounded-2xl border border-gray-800 p-5 flex flex-col h-full justify-between relative overflow-hidden">

                          <div className="space-y-3 relative z-0 mb-4">
                            <h5 className="text-gray-500 text-[10px] font-bold uppercase tracking-wider border-b border-gray-800 pb-2">Resumo do Lançamento</h5>

                            <div className="flex justify-between items-center text-xs group">
                              <span className="text-gray-400">Tipo</span>
                              <span className="text-gray-300 font-medium">{extraDesc || '...'}</span>
                            </div>

                            {simpleDeductTaxes && simpleAmountVal > 0 && (
                              <>
                                <div className="flex justify-between items-center text-xs group pt-2 mt-2 border-t border-gray-800/50 border-dashed">
                                  <span className="text-gray-400">Bruto</span>
                                  <span className="text-gray-300 font-mono">{formatCurrency(simpleAmountVal)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs group">
                                  <span className="text-gray-400">Descontos (Marginal)</span>
                                  <span className="text-red-400 font-mono">- {formatCurrency(simpleMarginalDiscount)}</span>
                                </div>
                              </>
                            )}
                          </div>

                          <div className="relative z-0">
                            <div className={`bg-gray-950 rounded-xl p-4 border transition-colors mb-4 shadow-inner flex flex-col items-center justify-center ${finalSimpleValue > 0 ? 'border-green-500/30' : 'border-gray-800'}`}>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Valor Total {simpleDeductTaxes ? '(Líquido)' : ''}</p>
                              <p className={`text-3xl font-bold ${finalSimpleValue > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                                <NumberFlow
                                  value={finalSimpleValue}
                                  format={{ style: 'currency', currency: 'BRL' }}
                                  locales="pt-BR"
                                />
                              </p>
                            </div>

                            <button
                              type="submit"
                              className="w-full py-3 bg-[#d97757] hover:bg-[#c56a4d] text-[#faf9f5] rounded-xl font-bold shadow-lg shadow-[#d97757]/20 transition-all flex items-center justify-center gap-2"
                            >
                              <Check size={18} />
                              Confirmar
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  </form>
                )}

                {/* ABA: CLT */}
                {activeTab === 'clt' && (
                  <div className="space-y-6 animate-slide-up">
                    <>
                      <div className="bg-[#d97757]/10 border border-[#d97757]/30 rounded-xl p-4 flex gap-4 items-start">
                        <HelpCircle className="text-[#d97757] shrink-0 mt-1" size={20} />
                        <div>
                          <h4 className="text-sm font-bold text-[#eab3a3] mb-1">Calculadora de Salário Líquido</h4>
                          <p className="text-xs text-gray-400 leading-relaxed">
                            Descontos automáticos de INSS e IRRF (Regras 2025).
                            <br />
                            <span className="opacity-70">Considera desconto simplificado quando vantajoso.</span>
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-5">
                          <div>
                            <label className="text-xs font-medium text-gray-400 mb-1.5 block">
                              Salário Bruto (R$)
                            </label>
                            <div className="relative group">
                              <span className="absolute left-3 top-3 text-gray-500 font-bold text-lg group-focus-within:text-[#d97757] transition-colors">R$</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="Ex: 5000,00"
                                value={cltGross}
                                onChange={e => setCltGross(e.target.value)}
                                className="input-primary pl-10 text-lg font-bold focus:border-[#d97757]"
                                autoFocus
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-gray-400 mb-1.5 block">
                              Nº de Dependentes
                            </label>
                            <div className="relative group">
                              <Users className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-[#d97757]" size={16} />
                              <input
                                type="number"
                                min="0"
                                value={cltDependents}
                                onChange={e => setCltDependents(e.target.value)}
                                className="input-primary pl-10 focus:border-[#d97757]"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-gray-400 mb-1.5 block">
                              Outros Descontos (R$)
                            </label>
                            <div className="relative group">
                              <span className="absolute left-3 top-3 text-gray-500 font-bold text-lg group-focus-within:text-[#d97757] transition-colors">R$</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="0,00"
                                value={cltOtherDiscounts}
                                onChange={e => setCltOtherDiscounts(e.target.value)}
                                className="input-primary pl-10 font-bold focus:border-[#d97757]"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-gray-400 mb-1.5 block">
                              Benefícios (R$)
                            </label>
                            <div className="relative group">
                              <span className="absolute left-3 top-3 text-gray-500 font-bold text-lg group-focus-within:text-[#d97757] transition-colors">R$</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="0,00"
                                value={cltBenefits}
                                onChange={e => setCltBenefits(e.target.value)}
                                className="input-primary pl-10 font-bold focus:border-[#d97757]"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Result Card */}
                        <div className="bg-[#30302E]/50 rounded-2xl border border-gray-800 p-5 flex flex-col h-full justify-between relative overflow-hidden">
                          <div className="space-y-3 relative z-0 mb-4">
                            <h5 className="text-gray-500 text-[10px] font-bold uppercase tracking-wider border-b border-gray-800 pb-2">Detalhes do Cálculo</h5>

                            <div className="flex justify-between items-center text-xs group">
                              <span className="text-gray-400">INSS</span>
                              <span className="text-red-400 font-mono">- {formatCurrency(cltResults.inss)}</span>
                            </div>

                            <div className="flex justify-between items-center text-xs group">
                              <span className="text-gray-400">IRRF</span>
                              <span className="text-red-400 font-mono">- {formatCurrency(cltResults.irrf)}</span>
                            </div>

                            {safeCltOtherDiscounts > 0 && (
                              <div className="flex justify-between items-center text-xs group">
                                <span className="text-gray-400">Outros Descontos</span>
                                <span className="text-red-400 font-mono">- {formatCurrency(safeCltOtherDiscounts)}</span>
                              </div>
                            )}

                            {safeCltBenefits > 0 && (
                              <div className="flex justify-between items-center text-xs group">
                                <span className="text-gray-400">Benefícios</span>
                                <span className="text-green-400 font-mono">+ {formatCurrency(safeCltBenefits)}</span>
                              </div>
                            )}
                          </div>

                          <div className="relative z-0">
                            <div className={`bg-gray-950 rounded-xl p-4 border transition-colors mb-4 shadow-inner flex flex-col items-center justify-center ${finalCltNet > 0 ? 'border-green-500/30' : 'border-gray-800'}`}>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Salário Líquido</p>
                              <p className={`text-3xl font-bold ${finalCltNet > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                                <NumberFlow
                                  value={finalCltNet}
                                  format={{ style: 'currency', currency: 'BRL' }}
                                  locales="pt-BR"
                                />
                              </p>
                            </div>

                            <button
                              onClick={handleAddCLT}
                              disabled={finalCltNet <= 0}
                              className="w-full py-3 bg-[#d97757] hover:bg-[#c56a4d] text-[#faf9f5] rounded-xl font-bold shadow-lg shadow-[#d97757]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              <Check size={18} />
                              Lançar Líquido
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  </div>
                )}

                {/* ABA: CALCULADORA (HORA EXTRA) */}
                {activeTab === 'calculator' && (
                  <div className="space-y-6 animate-slide-up">
                    <>
                      <div className="bg-[#d97757]/10 border border-[#d97757]/30 rounded-xl p-4 flex gap-4 items-start">
                        <HelpCircle className="text-[#d97757] shrink-0 mt-1" size={20} />
                        <div>
                          <h4 className="text-sm font-bold text-[#eab3a3] mb-1">Calculadora de Hora Extra</h4>
                          <p className="text-xs text-gray-400 leading-relaxed">
                            {baseSalary > 0 ? (
                              <>Usando seu salário base de <span className="text-white font-bold">{formatCurrency(baseSalary)}</span>.</>
                            ) : (
                              <>Insira seu salário base abaixo para calcular horas extras.</>
                            )}
                            <br />
                            <span className="opacity-70">Fórmula: (Salário / Divisor) * (1 + %) * Horas</span>
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Inputs */}
                        <div className="space-y-5">
                          {baseSalary <= 0 && (
                            <div>
                              <label className="text-xs font-medium text-gray-400 mb-1.5 block">
                                Salário Base (R$)
                              </label>
                              <div className="relative group">
                                <span className="absolute left-3 top-3 text-gray-500 font-bold text-lg group-focus-within:text-[#d97757] transition-colors">R$</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="Ex: 3000,00"
                                  value={tempBaseSalary}
                                  onChange={e => { setTempBaseSalary(e.target.value); if (errors.tempBaseSalary) setErrors({ ...errors, tempBaseSalary: false }); }}
                                  className={`input-primary pl-10 text-lg font-bold ${errors.tempBaseSalary ? 'border-red-500 bg-red-900/10 focus:border-red-500' : 'focus:border-[#d97757]'}`}
                                />
                              </div>
                            </div>
                          )}
                          <div>
                            <label className="flex justify-between text-xs font-medium text-gray-400 mb-1.5">
                              <span>Divisor Mensal (Horas)</span>
                            </label>
                            <div className="relative group">
                              <Clock className={`absolute left-3 top-3.5 ${errors.monthlyHours ? 'text-red-500' : 'text-gray-500 group-focus-within:text-[#d97757]'}`} size={16} />
                              <input
                                type="text"
                                inputMode="numeric"
                                value={monthlyHours}
                                onChange={e => { setMonthlyHours(e.target.value); if (errors.monthlyHours) setErrors({ ...errors, monthlyHours: false }); }}
                                className={`input-primary pl-10 ${errors.monthlyHours ? 'border-red-500 bg-red-900/10 focus:border-red-500' : 'focus:border-[#d97757]'}`}
                                placeholder="Padrão: 220"
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
                              Quantidade de Horas Feitas
                            </label>
                            <div className="relative group">
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="Ex: 2,5"
                                value={otQuantity}
                                onChange={e => { setOtQuantity(e.target.value); if (errors.otQuantity) setErrors({ ...errors, otQuantity: false }); }}
                                className={`input-primary text-lg font-bold ${errors.otQuantity ? 'border-red-500 bg-red-900/10 focus:border-red-500 text-red-400' : 'focus:border-[#d97757]'}`}
                                autoFocus
                              />
                              <span className="absolute right-3 top-3.5 text-xs font-bold text-gray-500 uppercase">Horas</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 pt-2 border-t border-gray-800">
                            <label className="relative inline-flex items-center cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={deductTaxes}
                                onChange={(e) => setDeductTaxes(e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#d97757]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#d97757]"></div>
                            </label>
                            <div>
                              <p className="text-xs font-bold text-gray-300">Deduzir Impostos (Estimativa)</p>
                              <p className="text-[9px] text-gray-500">Calcula INSS/IRRF marginal sobre o valor extra.</p>
                            </div>
                          </div>
                        </div>

                        {/* Result Card */}
                        <div className="bg-[#30302E]/50 rounded-2xl border border-gray-800 p-5 flex flex-col h-full justify-between relative overflow-hidden">

                          <div className="space-y-3 relative z-0 mb-4">
                            <h5 className="text-gray-500 text-[10px] font-bold uppercase tracking-wider border-b border-gray-800 pb-2">Detalhamento</h5>

                            <div className="flex justify-between items-center text-xs group">
                              <span className="text-gray-400">Valor da Hora Normal</span>
                              <span className="text-gray-300 font-mono">{formatCurrency(hourlyRate)}</span>
                            </div>

                            <div className="flex justify-between items-center text-xs group">
                              <span className="text-gray-400 flex items-center gap-1"><ChevronRight size={10} /> Valor Hora Extra (+{otPercent}%)</span>
                              <span className="text-[#eab3a3] font-mono font-medium">{formatCurrency(otHourlyRate)}</span>
                            </div>

                            {deductTaxes && totalCalculated > 0 && (
                              <>
                                <div className="flex justify-between items-center text-xs group pt-2 mt-2 border-t border-gray-800/50 border-dashed">
                                  <span className="text-gray-400">Bruto Total</span>
                                  <span className="text-gray-300 font-mono">{formatCurrency(totalCalculated)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs group">
                                  <span className="text-gray-400">Descontos (Marginal)</span>
                                  <span className="text-red-400 font-mono">- {formatCurrency(marginalDiscount)}</span>
                                </div>
                              </>
                            )}
                          </div>

                          <div className="relative z-0">
                            <div className={`bg-gray-950 rounded-xl p-4 border transition-colors mb-4 shadow-inner flex flex-col items-center justify-center ${finalOtValue > 0 ? 'border-green-500/30' : 'border-gray-800'}`}>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Total a Receber {deductTaxes ? '(Líquido)' : '(Bruto)'}</p>
                              <p className={`text-3xl font-bold ${finalOtValue > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                                <NumberFlow
                                  value={finalOtValue}
                                  format={{ style: 'currency', currency: 'BRL' }}
                                  locales="pt-BR"
                                />
                              </p>
                            </div>

                            <button
                              onClick={handleAddCalculated}
                              disabled={finalOtValue <= 0}
                              className="w-full py-3 bg-[#d97757] hover:bg-[#c56a4d] text-[#faf9f5] rounded-xl font-bold shadow-lg shadow-[#d97757]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              <Check size={18} />
                              Lançar Renda
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  </div>
                )}
              </div>

            </div>
          </div>,
          document.body
        )
      }
    </>
  );
};