import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { calculatePaymentDate, toLocalISODate } from '../utils/dateUtils';
import { createPortal } from 'react-dom';
import { Edit2, Check, PlusCircle, Briefcase, Coins, Calculator, X, HelpCircle, Clock, AlertCircle, ChevronRight, Users, Wallet, Trash2, Calendar, Percent, PieChart, CheckCircleFilled, TrendingUp, Lock, Sparkles, Settings, Building, Filter, CreditCard, Pig } from './Icons';
import { useToasts } from './Toast';
import NumberFlow from '@number-flow/react';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownLabel } from './Dropdown';
import Lottie from 'lottie-react';
import coinAnimation from '../assets/coin.json';
import { ConnectedAccount } from '../types';
import { ConfirmationBar } from './ConfirmationBar';
import { UniversalModal } from './UniversalModal';

interface SalaryManagerProps {
  baseSalary: number;
  currentIncome: number;
  estimatedSalary?: number; // Estimated salary from Open Finance transactions (Pro Mode)
  paymentDay?: number | string;
  advanceValue?: number;
  advancePercent?: number;
  advanceDay?: number;
  onUpdateSalary: (newSalary: number, paymentDay?: number | string, advanceOptions?: { advanceValue?: number; advancePercent?: number; advanceDay?: number }, salaryExemptFromDiscounts?: boolean) => void;
  onAddExtra: (amount: number, description: string, status?: 'completed' | 'pending', date?: string, accountId?: string) => void;
  onEditClick?: () => void;
  isSalaryLaunched?: boolean;
  salaryExemptFromDiscounts?: boolean;
  userPlan?: 'starter' | 'pro' | 'family';
  onUpgradeClick?: () => void;
  includeOpenFinance?: boolean;
  onToggleOpenFinance?: (value: boolean) => void;
  viewFilter?: 'all' | 'credit_card' | 'savings' | 'checking';
  onViewFilterChange?: (filter: 'all' | 'credit_card' | 'savings' | 'checking') => void;
  connectedAccounts?: ConnectedAccount[];
  onDeleteSalary?: () => void;
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
  salaryExemptFromDiscounts,
  userPlan = 'starter',
  onUpgradeClick,
  includeOpenFinance = true,
  onToggleOpenFinance,
  viewFilter = 'all',
  onViewFilterChange,
  connectedAccounts = [],
  onDeleteSalary
}) => {
  // State for Base Salary Editing
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tempSalary, setTempSalary] = useState(baseSalary.toString());
  const [tempPaymentDay, setTempPaymentDay] = useState(paymentDay?.toString() || '5');
  const [tempSalaryTaxExempt, setTempSalaryTaxExempt] = useState(!!salaryExemptFromDiscounts);

  // Split / Advance Logic
  const [hasAdvance, setHasAdvance] = useState(!!(advancePercent && advancePercent > 0) || !!(advanceValue && advanceValue > 0));
  const [tempAdvancePercent, setTempAdvancePercent] = useState(advancePercent?.toString() || '40');
  const [tempAdvanceDay, setTempAdvanceDay] = useState(advanceDay?.toString() || '20');

  const [salaryError, setSalaryError] = useState<string | null>(null);

  // State for Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showTools, setShowTools] = useState(false);

  // State for Account Selection when launching salary
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [pendingSalaryLaunch, setPendingSalaryLaunch] = useState<{
    salaryRemaining: number;
    advance: number;
    dateStr: string;
    valeDateStr?: string;
    advanceDay?: number;
    targetDate: Date;
  } | null>(null);

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

  // Extra Modal State (Simple/Calc/CLT Account Selector)
  const [selectedExtraAccountId, setSelectedExtraAccountId] = useState<string>('');

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

  // Filter accounts for selectors (exclude investments/loans AND Auto Credit Cards)
  const validAccounts = connectedAccounts.filter(acc => {
    const type = (acc.type || '').toUpperCase();
    const subtype = (acc.subtype || '').toUpperCase();
    const isInvestment = type.includes('INVESTMENT') || subtype.includes('INVESTMENT');
    const isLoan = type.includes('LOAN') || subtype.includes('LOAN');

    // Check for Auto Credit Card
    const isCredit = type === 'CREDIT' || subtype === 'CREDIT_CARD';
    const isAuto = acc.connectionMode !== 'MANUAL';

    if (isCredit && isAuto) return false;

    return !isInvestment && !isLoan;
  });

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

    // Handle variable date string or number
    let day: number | string = parseInt(tempPaymentDay);
    if (isNaN(day)) {
      day = tempPaymentDay; // It's a string code
    }

    if (isNaN(val)) {
      setSalaryError("Insira um número válido");
      return;
    }

    if (val < 0) {
      setSalaryError("O valor não pode ser negativo");
      return;
    }

    // Validate only if it is a number
    if (typeof day === 'number' && (day < 1 || day > 31)) {
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
      advanceValue: 0,
      advancePercent: hasAdvance ? advPercent : 0,
      advanceDay: hasAdvance ? advDay : undefined
    }, tempSalaryTaxExempt);

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
      onAddExtra(finalSimpleValue, desc, 'completed', undefined, selectedExtraAccountId || undefined);
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

      onAddExtra(finalAmount, desc, 'completed', undefined, selectedExtraAccountId || undefined);
      handleCloseModal();
    } else {
      toast.error("O valor total deve ser maior que zero.");
    }
  };

  const handleAddCLT = () => {
    if (finalCltNet > 0) {
      onAddExtra(finalCltNet, "Salário Líquido (CLT)", 'completed', undefined, selectedExtraAccountId || undefined);
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
      setSelectedExtraAccountId('');
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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        {/* Linha 1: Título */}
        <div>
          <h2 className="text-lg font-semibold text-white">Controle de Renda</h2>
          <p className="text-xs text-gray-500">Gerencie seus ganhos mensais</p>
        </div>

        {/* Linha 2: Controles */}
        <div className="flex items-center gap-2">
          {/* Config Dropdown Trigger */}
          {onToggleOpenFinance && (
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

              <DropdownContent width="w-64" align="left" portal>
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

                {/* Separator */}
                <div className="h-px bg-gray-700/50 my-2 mx-2"></div>

                <div className="flex items-center gap-2 mb-2 px-2">
                  <div className="p-1.5 rounded bg-purple-900/30 text-purple-400">
                    <Filter size={12} />
                  </div>
                  <p className="text-xs text-gray-400 font-medium">Filtro de Visualização</p>
                </div>

                <DropdownItem
                  onClick={() => onViewFilterChange?.('all')}
                  className={viewFilter === 'all' ? 'bg-[#d97757]/10 !text-[#d97757]' : ''}
                  icon={Filter}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>Mostrar Tudo</span>
                    {viewFilter === 'all' && <Check size={14} />}
                  </div>
                </DropdownItem>

                <DropdownItem
                  onClick={() => onViewFilterChange?.('checking')}
                  className={viewFilter === 'checking' ? 'bg-[#d97757]/10 !text-[#d97757]' : ''}
                  icon={Wallet}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>Conta Corrente</span>
                    {viewFilter === 'checking' && <Check size={14} />}
                  </div>
                </DropdownItem>

                <DropdownItem
                  onClick={() => onViewFilterChange?.('credit_card')}
                  className={viewFilter === 'credit_card' ? 'bg-[#d97757]/10 !text-[#d97757]' : ''}
                  icon={CreditCard}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>Cartão de Crédito</span>
                    {viewFilter === 'credit_card' && <Check size={14} />}
                  </div>
                </DropdownItem>

                <DropdownItem
                  onClick={() => onViewFilterChange?.('savings')}
                  className={viewFilter === 'savings' ? 'bg-[#d97757]/10 !text-[#d97757]' : ''}
                  icon={Pig}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>Poupança e Caixinhas</span>
                    {viewFilter === 'savings' && <Check size={14} />}
                  </div>
                </DropdownItem>
              </DropdownContent>
            </Dropdown>
          )}


        </div>
      </div>

      {/* Widget Principal do Dashboard */}
      <div className="bg-[#30302E] rounded-xl border border-gray-800 shadow-sm overflow-hidden mb-6 flex flex-col lg:flex-row animate-fade-in">

        {/* Lado Esquerdo: Visualização e Edição do Salário */}
        <div className="p-4 flex-1 relative overflow-hidden border-b lg:border-b-0 lg:border-r border-gray-800">
          {/* Blur using Primary Color (Terracotta) - Pulsante */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#d97757] rounded-full blur-3xl pointer-events-none animate-blur-pulse"></div>

          <div className="flex justify-between items-start mb-2 relative z-10">
            <div className="flex items-center gap-2">
              <Coins size={18} className="text-[#d97757]" />
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                Salário Base
              </h3>
            </div>
            {!isEditing && baseSalary > 0 && (
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
            {/* Modo Display (Sempre visível, clique abre o modal) */}
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
                        <Clock size={10} />
                        {typeof paymentDay === 'string'
                          ? (paymentDay === 'business_day_5' ? '5º Dia Útil' : paymentDay === 'business_day_last' ? 'Último Dia Útil' : 'Último Dia')
                          : `Recebe dia ${paymentDay || 5}`}
                      </span>

                      {(!!advancePercent || (!!advanceValue && advanceValue > 0)) && (
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
            </div>

            {/* Modal de Configuração de Salário */}
            <UniversalModal
              isOpen={isEditing}
              onClose={() => {
                setIsEditing(false);
                setSalaryError(null);
              }}
              title="Configurar Renda"
              subtitle="Defina seu salário base e adiantamentos"
              icon={<Coins size={18} />}
              themeColor="#d97757"
              width="max-w-lg"
            >
              <div className="space-y-5 animate-fade-in">

                {/* Salário Base */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Salário Base (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 font-bold">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={tempSalary}
                      onChange={(e) => {
                        setTempSalary(e.target.value);
                        if (salaryError) setSalaryError(null);
                      }}
                      onKeyDown={handleKeyDown}
                      className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600 font-bold"
                      placeholder="0,00"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Dia do Pagamento */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Dia do Pagamento</label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                    <select
                      value={tempPaymentDay}
                      onChange={(e) => setTempPaymentDay(e.target.value)}
                      className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="" disabled>Selecione</option>
                      <optgroup label="Datas Variáveis">
                        <option value="business_day_5">5º Dia Útil</option>
                        <option value="business_day_last">Último Dia Útil</option>
                        <option value="last_day">Último Dia</option>
                      </optgroup>
                      <optgroup label="Dia Fixo">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                </div>

                {/* Isenção de Impostos */}
                <div className="bg-gray-900/40 rounded-xl p-3 border border-gray-800/60 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <Sparkles size={14} className="text-yellow-500" /> Isento de Descontos
                    </span>
                    <span className="text-[10px] text-gray-500 block mt-0.5">INSS/IRRF zerados no salário principal.</span>
                  </div>
                  <div className="flex bg-gray-900 rounded-lg p-0.5 border border-gray-700">
                    <button
                      type="button"
                      onClick={() => setTempSalaryTaxExempt(false)}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${!tempSalaryTaxExempt ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      Não
                    </button>
                    <button
                      type="button"
                      onClick={() => setTempSalaryTaxExempt(true)}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${tempSalaryTaxExempt ? 'bg-[#d97757] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      Sim
                    </button>
                  </div>
                </div>

                {/* Configuração de Vale */}
                <div className="pt-2 border-t border-gray-800/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400 flex items-center gap-2">
                      <PieChart size={14} /> Recebe Adiantamento (Vale)?
                    </span>
                    <div className="flex bg-gray-900 rounded-lg p-0.5 border border-gray-700">
                      <button
                        type="button"
                        onClick={() => setHasAdvance(false)}
                        className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${!hasAdvance ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                        Não
                      </button>
                      <button
                        type="button"
                        onClick={() => setHasAdvance(true)}
                        className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${hasAdvance ? 'bg-[#d97757] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                        Sim
                      </button>
                    </div>
                  </div>

                  {hasAdvance && (
                    <div className="animate-fade-in space-y-4 bg-gray-900/20 p-4 rounded-xl border border-gray-800/40">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Porcentagem (%)</label>
                          <div className="relative">
                            <Percent className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                            <input
                              type="number"
                              min="1"
                              max="80"
                              value={tempAdvancePercent}
                              onChange={(e) => setTempAdvancePercent(e.target.value)}
                              className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600 text-center font-bold"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Dia do Vale</label>
                          <div className="relative">
                            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                            <input
                              type="number"
                              min="1"
                              max="31"
                              value={tempAdvanceDay}
                              onChange={(e) => setTempAdvanceDay(e.target.value)}
                              className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600 text-center font-bold"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Preview Calculation */}
                      {(() => {
                        const sal = parseInput(tempSalary);
                        let vale = 0;
                        if (hasAdvance) {
                          vale = sal * (parseInput(tempAdvancePercent) / 100);
                        }
                        let totalTax = 0;
                        if (!tempSalaryTaxExempt) {
                          const { inss, irrf } = calculateCLT(sal, 0);
                          totalTax = inss + irrf;
                        }
                        const resto = Math.max(0, sal - vale - totalTax);

                        return (
                          <div className="flex gap-3 text-xs pt-2">
                            <div className="flex-1 bg-gray-900/50 p-3 rounded-xl border border-gray-800 flex flex-col items-center">
                              <p className="text-gray-500 mb-1">Vale ({tempAdvancePercent}%)</p>
                              <p className="text-[#eab3a3] font-mono font-bold">{formatCurrency(vale)}</p>
                            </div>
                            <div className="flex-1 bg-gray-900/50 p-3 rounded-xl border border-gray-800 flex flex-col items-center">
                              <p className="text-gray-500 mb-1">Líquido Restante</p>
                              <p className="text-white font-mono font-bold">{formatCurrency(resto)}</p>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>

                {salaryError && (
                  <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400 text-xs animate-shake">
                    <AlertCircle size={16} />
                    {salaryError}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    onClick={handleSaveSalary}
                    className="w-full py-3.5 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/30 flex items-center justify-center gap-2"
                  >
                    <Check size={18} />
                    Salvar Configuração
                  </button>
                </div>

              </div>
            </UniversalModal>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-gray-300 text-[10px] px-2 py-1 rounded ml-auto self-start mt-2">
              Editar
            </div>
          </div>

          {/* Salary Insights Grid */}
          {baseSalary > 0 && !isEditing && (
            <div className="mt-4 grid grid-cols-2 gap-2 animate-fade-in">
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
                    today.setHours(0, 0, 0, 0);

                    // Calc payment dates near today
                    // Look at current month and next month
                    const candidates: Date[] = [];

                    // Helper to add candidate
                    const addCandidate = (pDay: number | string | undefined, monthOffset: number) => {
                      if (!pDay) return;
                      const refDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
                      const date = calculatePaymentDate(pDay, refDate);
                      date.setHours(0, 0, 0, 0);
                      candidates.push(date);
                    };

                    // Current and Next Month for Salary
                    addCandidate(paymentDay, 0);
                    addCandidate(paymentDay, 1);

                    // Current and Next Month for Advance
                    if (advanceDay) {
                      // Advance is always number for now based on types, but let's be safe
                      addCandidate(advanceDay, 0);
                      addCandidate(advanceDay, 1);
                    }

                    // Sort and find first future date (or today)
                    candidates.sort((a, b) => a.getTime() - b.getTime());

                    const nextDate = candidates.find(d => d >= today) || candidates[0];

                    if (!nextDate) return <span className="text-gray-600">--</span>;

                    const diffTime = nextDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays === 0) return <span className="text-green-400">Hoje!</span>;

                    return <span className={diffDays <= 5 ? 'text-[#d97757]' : ''}>{diffDays} dias</span>;
                  })()}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Lado Direito: Botão de Ação */}
        {
          <div className="p-4 lg:w-80 bg-[#30302E]/30 flex flex-col justify-center border-t lg:border-t-0 border-gray-800 relative">
            {/* Decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10"></div>

            <div className="flex items-center gap-2 mb-3 px-1">
              <Sparkles size={14} className="text-[#d97757]" />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Ações Rápidas</span>
            </div>

            <div className="grid grid-cols-2 gap-2 relative z-10">
              {/* Button 1: Lançar Salário */}
              {isSalaryLaunched ? (
                <Dropdown className="w-full h-full">
                  <DropdownTrigger className="w-full h-full">
                    <button
                      className={`
                        w-full h-full relative overflow-hidden group p-3 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all duration-300 border
                        bg-green-500/5 border-green-500/10 hover:bg-green-500/10 hover:border-green-500/30 cursor-pointer
                      `}
                    >
                      <div className={`
                        p-2 rounded-full transition-all duration-300
                        bg-green-500/10 text-green-500 group-hover:scale-110
                      `}>
                        <Check size={16} />
                      </div>
                      <span className={`text-[10px] font-medium transition-colors uppercase tracking-wide text-green-600/70 group-hover:text-green-500`}>
                        Lançado
                      </span>
                    </button>
                  </DropdownTrigger>
                  <DropdownContent width="w-40" align="center">
                    <DropdownItem
                      onClick={() => setShowDeleteConfirm(true)}
                      danger
                      icon={Trash2}
                    >
                      Deslançar
                    </DropdownItem>
                  </DropdownContent>
                </Dropdown>
              ) : (
                <button
                  onClick={() => {
                    if (baseSalary <= 0) {
                      toast.error("Defina um salário base primeiro.");
                      return;
                    }

                    const today = new Date();
                    const pDay = paymentDay || 5;

                    let targetDate = calculatePaymentDate(pDay, today);
                    const dateStr = toLocalISODate(targetDate);

                    let advance = advanceValue || 0;
                    if (advancePercent && advancePercent > 0) {
                      advance = baseSalary * (advancePercent / 100);
                    }
                    advance = Math.round((advance + Number.EPSILON) * 100) / 100;

                    let totalTaxes = 0;
                    if (!salaryExemptFromDiscounts) {
                      const { inss, irrf } = calculateCLT(baseSalary, 0);
                      totalTaxes = inss + irrf;
                    }

                    const netSalary = baseSalary - totalTaxes;
                    const salaryRemaining = Math.max(0, netSalary - advance);

                    let valeDateStr = dateStr;
                    if (advanceDay) {
                      const vDate = new Date(today.getFullYear(), today.getMonth(), advanceDay);
                      valeDateStr = vDate.toISOString().split('T')[0];
                    }

                    // Filtrar apenas contas válidas (Excluir Investimentos e Empréstimos)
                    const checkingAccounts = connectedAccounts.filter(acc => {
                      const type = (acc.type || '').toUpperCase();
                      const subtype = (acc.subtype || '').toUpperCase();
                      const isInvestment = type.includes('INVESTMENT') || subtype.includes('INVESTMENT');
                      const isLoan = type.includes('LOAN') || subtype.includes('LOAN');
                      return !isInvestment && !isLoan;
                    });

                    // Se não há contas, lançar diretamente sem accountId
                    if (checkingAccounts.length === 0) {
                      onAddExtra(salaryRemaining, "Salário Mensal", "pending", dateStr);
                      if (advance > 0) {
                        setTimeout(() => {
                          onAddExtra(advance, "Vale / Adiantamento", "pending", valeDateStr);
                        }, 100);
                        toast.success(`Lançados: Salário (${targetDate.getDate()}) e Vale (${advanceDay || targetDate.getDate()})!`);
                      } else {
                        toast.success(`Salário lançado para dia ${targetDate.getDate()}!`);
                      }
                      return;
                    }

                    // Preparar dados pendentes e abrir modal de seleção
                    setPendingSalaryLaunch({
                      salaryRemaining,
                      advance,
                      dateStr,
                      valeDateStr: advance > 0 ? valeDateStr : undefined,
                      advanceDay,
                      targetDate
                    });
                    setSelectedAccountId(''); // Resetar seleção
                    setShowAccountModal(true);
                  }}
                  className={`
                  relative overflow-hidden group p-3 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all duration-300 border
                  bg-gray-800/40 hover:bg-gray-800 border-gray-800 hover:border-[#d97757]/50 cursor-pointer
                `}
                >
                  <div className={`
                  p-2 rounded-full transition-all duration-300
                  bg-[#2a2a28] text-gray-400 group-hover:text-[#d97757] group-hover:bg-[#d97757]/10 group-hover:scale-105
                `}>
                    <Calendar size={16} />
                  </div>
                  <span className={`text-[10px] font-medium transition-colors uppercase tracking-wide text-gray-400 group-hover:text-orange-100`}>
                    Lançar Mês
                  </span>
                </button>
              )}

              {/* Button 2: Lançar Extra */}
              <button
                onClick={() => { setActiveTab('simple'); setIsModalOpen(true); }}
                className="relative overflow-hidden group p-3 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all duration-300 border bg-gray-800/40 hover:bg-gray-800 border-gray-800 hover:border-[#d97757]/50 cursor-pointer"
              >
                <div className="p-2 rounded-full bg-[#2a2a28] text-gray-400 group-hover:text-[#d97757] group-hover:bg-[#d97757]/10 transition-all duration-300 group-hover:scale-105">
                  <PlusCircle size={16} />
                </div>
                <span className="text-[10px] font-medium text-gray-400 group-hover:text-orange-100 transition-colors uppercase tracking-wide">
                  Novo Extra
                </span>
              </button>

              {/* Button 3: Calc CLT */}
              <button
                onClick={() => { setActiveTab('clt'); setIsModalOpen(true); }}
                className="relative overflow-hidden group p-3 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all duration-300 border bg-gray-800/40 hover:bg-gray-800 border-gray-800 hover:border-[#d97757]/50 cursor-pointer"
              >
                <div className="p-2 rounded-full bg-[#2a2a28] text-gray-400 group-hover:text-[#d97757] group-hover:bg-[#d97757]/10 transition-all duration-300 group-hover:scale-105">
                  <Briefcase size={16} />
                </div>
                <span className="text-[10px] font-medium text-gray-400 group-hover:text-orange-100 transition-colors uppercase tracking-wide">
                  Calc. CLT
                </span>
              </button>

              {/* Button 4: Hora Extra */}
              <button
                onClick={() => { setActiveTab('calculator'); setIsModalOpen(true); }}
                className="relative overflow-hidden group p-3 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all duration-300 border bg-gray-800/40 hover:bg-gray-800 border-gray-800 hover:border-[#d97757]/50 cursor-pointer"
              >
                <div className="p-2 rounded-full bg-[#2a2a28] text-gray-400 group-hover:text-[#d97757] group-hover:bg-[#d97757]/10 transition-all duration-300 group-hover:scale-105">
                  <Clock size={16} />
                </div>
                <span className="text-[10px] font-medium text-gray-400 group-hover:text-orange-100 transition-colors uppercase tracking-wide">
                  Hora Extra
                </span>
              </button>
            </div>
          </div>
        }
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

                          {/* Account Selector */}
                          <div>
                            <label className="text-xs font-medium text-gray-400 mb-1.5 block">Conta de Destino</label>
                            <Dropdown className="w-full">
                              <DropdownTrigger className="w-full">
                                <div className="bg-gray-800/50 hover:bg-gray-800 transition-colors text-white text-sm rounded-lg px-3 py-2.5 border border-gray-700 focus:border-[#d97757] flex items-center justify-between group">
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    <div className={`p-1 rounded ${selectedExtraAccountId ? 'bg-white/5' : 'bg-[#d97757]/10'}`}>
                                      {selectedExtraAccountId ? (
                                        (() => {
                                          const acc = validAccounts.find(a => a.id === selectedExtraAccountId);
                                          if (acc?.connector?.imageUrl) return <img src={acc.connector.imageUrl} className="w-4 h-4 rounded-full" />;
                                          return <Building size={14} className="text-gray-300" />;
                                        })()
                                      ) : (
                                        <Wallet size={14} className="text-[#d97757]" />
                                      )}
                                    </div>
                                    <span className={`truncate ${selectedExtraAccountId ? 'text-gray-200' : 'text-gray-400'}`}>
                                      {selectedExtraAccountId
                                        ? (validAccounts.find(a => a.id === selectedExtraAccountId)?.name || 'Conta Selecionada')
                                        : 'Sem conta específica'
                                      }
                                    </span>
                                  </div>
                                  <ChevronRight size={14} className="text-gray-500 rotate-90 group-data-[state=open]:rotate-[-90deg] transition-transform" />
                                </div>
                              </DropdownTrigger>
                              <DropdownContent width="w-[320px]" align="left" className="max-h-60 overflow-y-auto">
                                <DropdownLabel>Selecione a Conta</DropdownLabel>
                                <DropdownItem onClick={() => setSelectedExtraAccountId('')}>
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-[#d97757]/10 rounded text-[#d97757]"><Wallet size={14} /></div>
                                    <div className="flex flex-col">
                                      <span className="text-sm font-medium">Sem conta específica</span>
                                      <span className="text-[10px] text-gray-500">Apenas registro</span>
                                    </div>
                                    {selectedExtraAccountId === '' && <Check size={14} className="ml-auto text-[#d97757]" />}
                                  </div>
                                </DropdownItem>
                                {validAccounts.map(acc => (
                                  <DropdownItem key={acc.id} onClick={() => setSelectedExtraAccountId(acc.id)}>
                                    <div className="flex items-center gap-2 w-full">
                                      {acc.connector?.imageUrl ? (
                                        <img src={acc.connector.imageUrl} className="w-6 h-6 rounded-md object-contain bg-white/5 p-0.5" />
                                      ) : (
                                        <div className="w-6 h-6 rounded-md bg-gray-800 flex items-center justify-center text-gray-400"><Building size={12} /></div>
                                      )}
                                      <div className="flex flex-col overflow-hidden">
                                        <span className="text-sm font-medium truncate text-gray-200">{acc.name || acc.institution}</span>
                                        <span className="text-[10px] text-gray-500 truncate">{acc.type === 'CREDIT' ? 'Cartão' : 'Conta'} • {acc.connectionMode === 'MANUAL' ? 'Manual' : 'Auto'}</span>
                                      </div>
                                      {selectedExtraAccountId === acc.id && <Check size={14} className="ml-auto text-[#d97757] shrink-0" />}
                                    </div>
                                  </DropdownItem>
                                ))}
                              </DropdownContent>
                            </Dropdown>
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

                          {/* Account Selector for CLT */}
                          <div>
                            <label className="text-xs font-medium text-gray-400 mb-1.5 block">Conta de Destino</label>
                            <Dropdown className="w-full">
                              <DropdownTrigger className="w-full">
                                <div className="bg-gray-800/50 hover:bg-gray-800 transition-colors text-white text-sm rounded-lg px-3 py-2.5 border border-gray-700 focus:border-[#d97757] flex items-center justify-between group">
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    <div className={`p-1 rounded ${selectedExtraAccountId ? 'bg-white/5' : 'bg-[#d97757]/10'}`}>
                                      {selectedExtraAccountId ? (
                                        (() => {
                                          const acc = validAccounts.find(a => a.id === selectedExtraAccountId);
                                          if (acc?.connector?.imageUrl) return <img src={acc.connector.imageUrl} className="w-4 h-4 rounded-full" />;
                                          return <Building size={14} className="text-gray-300" />;
                                        })()
                                      ) : (
                                        <Wallet size={14} className="text-[#d97757]" />
                                      )}
                                    </div>
                                    <span className={`truncate ${selectedExtraAccountId ? 'text-gray-200' : 'text-gray-400'}`}>
                                      {selectedExtraAccountId
                                        ? (validAccounts.find(a => a.id === selectedExtraAccountId)?.name || 'Conta Selecionada')
                                        : 'Sem conta específica'
                                      }
                                    </span>
                                  </div>
                                  <ChevronRight size={14} className="text-gray-500 rotate-90 group-data-[state=open]:rotate-[-90deg] transition-transform" />
                                </div>
                              </DropdownTrigger>
                              <DropdownContent width="w-[320px]" align="left" className="max-h-60 overflow-y-auto">
                                <DropdownLabel>Selecione a Conta</DropdownLabel>
                                <DropdownItem onClick={() => setSelectedExtraAccountId('')}>
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-[#d97757]/10 rounded text-[#d97757]"><Wallet size={14} /></div>
                                    <div className="flex flex-col">
                                      <span className="text-sm font-medium">Sem conta específica</span>
                                      <span className="text-[10px] text-gray-500">Apenas registro</span>
                                    </div>
                                    {selectedExtraAccountId === '' && <Check size={14} className="ml-auto text-[#d97757]" />}
                                  </div>
                                </DropdownItem>
                                {validAccounts.map(acc => (
                                  <DropdownItem key={acc.id} onClick={() => setSelectedExtraAccountId(acc.id)}>
                                    <div className="flex items-center gap-2 w-full">
                                      {acc.connector?.imageUrl ? (
                                        <img src={acc.connector.imageUrl} className="w-6 h-6 rounded-md object-contain bg-white/5 p-0.5" />
                                      ) : (
                                        <div className="w-6 h-6 rounded-md bg-gray-800 flex items-center justify-center text-gray-400"><Building size={12} /></div>
                                      )}
                                      <div className="flex flex-col overflow-hidden">
                                        <span className="text-sm font-medium truncate text-gray-200">{acc.name || acc.institution}</span>
                                        <span className="text-[10px] text-gray-500 truncate">{acc.type === 'CREDIT' ? 'Cartão' : 'Conta'} • {acc.connectionMode === 'MANUAL' ? 'Manual' : 'Auto'}</span>
                                      </div>
                                      {selectedExtraAccountId === acc.id && <Check size={14} className="ml-auto text-[#d97757] shrink-0" />}
                                    </div>
                                  </DropdownItem>
                                ))}
                              </DropdownContent>
                            </Dropdown>
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

                          {/* Account Selector */}
                          <div>
                            <label className="text-xs font-medium text-gray-400 mb-1.5 block">Conta de Destino</label>
                            <Dropdown className="w-full">
                              <DropdownTrigger className="w-full">
                                <div className="bg-gray-800/50 hover:bg-gray-800 transition-colors text-white text-sm rounded-lg px-3 py-2.5 border border-gray-700 focus:border-[#d97757] flex items-center justify-between group">
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    <div className={`p-1 rounded ${selectedExtraAccountId ? 'bg-white/5' : 'bg-[#d97757]/10'}`}>
                                      {selectedExtraAccountId ? (
                                        (() => {
                                          const acc = validAccounts.find(a => a.id === selectedExtraAccountId);
                                          if (acc?.connector?.imageUrl) return <img src={acc.connector.imageUrl} className="w-4 h-4 rounded-full" />;
                                          return <Building size={14} className="text-gray-300" />;
                                        })()
                                      ) : (
                                        <Wallet size={14} className="text-[#d97757]" />
                                      )}
                                    </div>
                                    <span className={`truncate ${selectedExtraAccountId ? 'text-gray-200' : 'text-gray-400'}`}>
                                      {selectedExtraAccountId
                                        ? (validAccounts.find(a => a.id === selectedExtraAccountId)?.name || 'Conta Selecionada')
                                        : 'Sem conta específica'
                                      }
                                    </span>
                                  </div>
                                  <ChevronRight size={14} className="text-gray-500 rotate-90 group-data-[state=open]:rotate-[-90deg] transition-transform" />
                                </div>
                              </DropdownTrigger>
                              <DropdownContent width="w-[320px]" align="left" className="max-h-60 overflow-y-auto">
                                <DropdownLabel>Selecione a Conta</DropdownLabel>
                                <DropdownItem onClick={() => setSelectedExtraAccountId('')}>
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-[#d97757]/10 rounded text-[#d97757]"><Wallet size={14} /></div>
                                    <div className="flex flex-col">
                                      <span className="text-sm font-medium">Sem conta específica</span>
                                      <span className="text-[10px] text-gray-500">Apenas registro</span>
                                    </div>
                                    {selectedExtraAccountId === '' && <Check size={14} className="ml-auto text-[#d97757]" />}
                                  </div>
                                </DropdownItem>
                                {validAccounts.map(acc => (
                                  <DropdownItem key={acc.id} onClick={() => setSelectedExtraAccountId(acc.id)}>
                                    <div className="flex items-center gap-2 w-full">
                                      {acc.connector?.imageUrl ? (
                                        <img src={acc.connector.imageUrl} className="w-6 h-6 rounded-md object-contain bg-white/5 p-0.5" />
                                      ) : (
                                        <div className="w-6 h-6 rounded-md bg-gray-800 flex items-center justify-center text-gray-400"><Building size={12} /></div>
                                      )}
                                      <div className="flex flex-col overflow-hidden">
                                        <span className="text-sm font-medium truncate text-gray-200">{acc.name || acc.institution}</span>
                                        <span className="text-[10px] text-gray-500 truncate">{acc.type === 'CREDIT' ? 'Cartão' : 'Conta'} • {acc.connectionMode === 'MANUAL' ? 'Manual' : 'Auto'}</span>
                                      </div>
                                      {selectedExtraAccountId === acc.id && <Check size={14} className="ml-auto text-[#d97757] shrink-0" />}
                                    </div>
                                  </DropdownItem>
                                ))}
                              </DropdownContent>
                            </Dropdown>
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
          </div >,
          document.body
        )
      }

      {/* Modal de Seleção de Conta para Lançar Salário */}
      <UniversalModal
        isOpen={showAccountModal && !!pendingSalaryLaunch}
        onClose={() => {
          setShowAccountModal(false);
          setPendingSalaryLaunch(null);
        }}
        title="Selecionar Conta"
        subtitle="Onde você receberá o salário?"
        icon={<Wallet size={18} />}
        width="max-w-md"
        footer={
          <button
            onClick={() => {
              if (!pendingSalaryLaunch) return;

              const { salaryRemaining, advance, dateStr, valeDateStr, advanceDay: advDay, targetDate } = pendingSalaryLaunch;
              const accountIdToUse = selectedAccountId || undefined;

              onAddExtra(salaryRemaining, "Salário Mensal", "pending", dateStr, accountIdToUse);

              if (advance > 0 && valeDateStr) {
                setTimeout(() => {
                  onAddExtra(advance, "Vale / Adiantamento", "pending", valeDateStr, accountIdToUse);
                }, 100);
                toast.success(`Lançados: Salário (${targetDate.getDate()}) e Vale (${advDay || targetDate.getDate()})!`);
              } else {
                toast.success(`Salário lançado para dia ${targetDate.getDate()}!`);
              }

              setShowAccountModal(false);
              setPendingSalaryLaunch(null);
            }}
            className="w-full py-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
          >
            <Check size={16} />
            Confirmar
          </button>
        }
      >
        <div className="space-y-3">
          {/* Opção sem conta específica */}
          <button
            onClick={() => setSelectedAccountId('')}
            className={`w-full p-4 rounded-xl border transition-all flex items-center gap-4 ${selectedAccountId === ''
              ? 'border-[#d97757] bg-[#d97757]/10'
              : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
              }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedAccountId === '' ? 'bg-[#d97757]/20' : 'bg-gray-800'}`}>
              <Wallet size={24} className={selectedAccountId === '' ? 'text-[#d97757]' : 'text-gray-400'} />
            </div>
            <div className="flex-1 text-left">
              <p className={`font-medium ${selectedAccountId === '' ? 'text-white' : 'text-gray-300'}`}>
                Sem conta específica
              </p>
              <p className="text-xs text-gray-500">Lançar sem vincular a uma conta</p>
            </div>
            {selectedAccountId === '' && (
              <div className="w-5 h-5 rounded-full bg-[#d97757] flex items-center justify-center">
                <Check size={12} className="text-white" />
              </div>
            )}
          </button>

          {/* Lista de contas - Apenas contas manuais */}
          {connectedAccounts
            .filter(acc => {
              // Mostrar apenas contas manuais
              return acc.connectionMode === 'MANUAL';
            })
            .map(acc => (
              <button
                key={acc.id}
                onClick={() => setSelectedAccountId(acc.id)}
                className={`w-full p-4 rounded-xl border transition-all flex items-center gap-4 ${selectedAccountId === acc.id
                  ? 'border-[#d97757] bg-[#d97757]/10'
                  : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
                  }`}
              >
                {/* Icon/Avatar - Sem fundo, logo maior */}
                <div className="flex-shrink-0">
                  {acc.connector?.imageUrl ? (
                    <img src={acc.connector.imageUrl} alt="" className="w-10 h-10 rounded-lg object-contain" />
                  ) : (
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedAccountId === acc.id ? 'bg-[#d97757]/20' : 'bg-gray-800'}`}>
                      <Building size={24} className={selectedAccountId === acc.id ? 'text-[#d97757]' : 'text-gray-400'} />
                    </div>
                  )}
                </div>

                <div className="flex-1 text-left">
                  <p className={`font-medium ${selectedAccountId === acc.id ? 'text-white' : 'text-gray-300'}`}>
                    {acc.name || acc.institution || 'Conta'}
                  </p>
                  <p className="text-xs text-gray-500 flex items-center gap-2">
                    <span>{acc.institution || 'Banco'}</span>
                    {acc.connectionMode === 'MANUAL' && (
                      <span className="px-1.5 py-0.5 bg-gray-800 rounded text-[9px] text-gray-400">Manual</span>
                    )}
                  </p>
                </div>

                {selectedAccountId === acc.id && (
                  <div className="w-5 h-5 rounded-full bg-[#d97757] flex items-center justify-center">
                    <Check size={12} className="text-white" />
                  </div>
                )}
              </button>
            ))}
        </div>
      </UniversalModal>

      <ConfirmationBar
        isOpen={showDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          onDeleteSalary?.();
          setShowDeleteConfirm(false);
        }}
        label="Deslançar Salário?"
        description="A transação do mês atual será removida."
        confirmText="Sim, deslançar"
        isDestructive
      />
    </>
  );
};