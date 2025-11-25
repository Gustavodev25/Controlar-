import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PiggyBank, ArrowUpCircle } from 'lucide-react';
import { Plus, Edit2, Trash2, X, Check, Target, Calendar, DollarSign, Coins, TrendingUp, Sparkles } from './Icons';
import { useToasts } from './Toast';
import { ConfirmationCard } from './UIComponents';
import { Transaction } from '../types';

export interface Investment {
  id: string;
  memberId?: string;
  name: string;
  icon: string;
  color: string;
  targetAmount: number;
  currentAmount: number;
  createdAt: string;
  deadline?: string;
}

interface InvestmentsProps {
  investments: Investment[];
  onAdd: (investment: Omit<Investment, 'id'>) => void;
  onUpdate: (investment: Investment) => void;
  onDelete: (id: string) => void;
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
}

const TEMPLATES = [
  { name: 'Viajar', icon: 'viajar.png', color: 'blue', suggestedAmount: 5000, isImage: true },
  { name: 'Comprar Carro', icon: 'carro.png', color: 'red', suggestedAmount: 50000, isImage: true },
  { name: 'Reserva', icon: 'reserva.png', color: 'green', suggestedAmount: 10000, isImage: true },
];

const ICON_IMAGES = [
  { file: 'viajar.png', name: 'Viajar' },
  { file: 'carro.png', name: 'Carro' },
  { file: 'reserva.png', name: 'Reserva' },
];

const EMOJI_OPTIONS = [
  '💰', '🏠', '🚗', '✈️', '💍', '📚', '💻', '📱',
  '🎮', '🎸', '🏋️', '🎨', '🍕', '☕', '🎬', '📷',
  '🎁', '💎', '🏆', '🌟', '❤️', '🎯', '🔑', '⚡',
  '🎓', '🛡️', '🎪', '🎭', '🎺', '🎻', '🏖️', '🏔️',
  '🏝️', '🌊', '🌈', '⭐', '🌙', '☀️', '🍰', '🎂',
  '🏅', '💳', '🏦', '📊', '📈', '💵', '💴', '💶',
];

const COLOR_OPTIONS = [
  { value: 'blue', class: 'from-blue-500 to-blue-600', textClass: 'text-blue-400', bgClass: 'bg-blue-900/20' },
  { value: 'green', class: 'from-green-500 to-green-600', textClass: 'text-green-400', bgClass: 'bg-green-900/20' },
  { value: 'purple', class: 'from-purple-500 to-purple-600', textClass: 'text-purple-400', bgClass: 'bg-purple-900/20' },
  { value: 'red', class: 'from-red-500 to-red-600', textClass: 'text-red-400', bgClass: 'bg-red-900/20' },
  { value: 'orange', class: 'from-orange-500 to-orange-600', textClass: 'text-orange-400', bgClass: 'bg-orange-900/20' },
  { value: 'pink', class: 'from-pink-500 to-pink-600', textClass: 'text-pink-400', bgClass: 'bg-pink-900/20' },
  { value: 'indigo', class: 'from-indigo-500 to-indigo-600', textClass: 'text-indigo-400', bgClass: 'bg-indigo-900/20' },
  { value: 'teal', class: 'from-teal-500 to-teal-600', textClass: 'text-teal-400', bgClass: 'bg-teal-900/20' },
];

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);


export const Investments: React.FC<InvestmentsProps> = ({
  investments,
  onAdd,
  onUpdate,
  onDelete,
  onAddTransaction
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [modalStep, setModalStep] = useState<'template' | 'form'>('template');
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Deposit modal
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [depositInvestment, setDepositInvestment] = useState<Investment | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  const [formData, setFormData] = useState<Omit<Investment, 'id'>>({
    name: '',
    icon: '💰',
    color: 'blue',
    targetAmount: 0,
    currentAmount: 0,
    createdAt: new Date().toISOString().split('T')[0],
    deadline: ''
  });

  const toast = useToasts();

  // Animation Control
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

  // Close icon picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (iconPickerOpen && !target.closest('.icon-picker-container')) {
        setIconPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [iconPickerOpen]);

  const handleOpenModal = (investment?: Investment) => {
    if (investment) {
      setEditingInvestment(investment);
      setFormData({
        name: investment.name,
        icon: investment.icon,
        color: investment.color,
        targetAmount: investment.targetAmount,
        currentAmount: investment.currentAmount,
        createdAt: investment.createdAt,
        deadline: investment.deadline || ''
      });
      setModalStep('form');
    } else {
      setEditingInvestment(null);
      setFormData({
        name: '',
        icon: '💰',
        color: 'blue',
        targetAmount: 0,
        currentAmount: 0,
        createdAt: new Date().toISOString().split('T')[0],
        deadline: ''
      });
      setModalStep('template');
    }
    setIsModalOpen(true);
  };

  const handleSelectTemplate = (template: typeof TEMPLATES[0]) => {
    setFormData({
      ...formData,
      name: template.name,
      icon: template.icon,
      color: template.color,
      targetAmount: template.suggestedAmount,
    });
    setModalStep('form');
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIconPickerOpen(false);
    setTimeout(() => {
      setEditingInvestment(null);
      setModalStep('template');
      setFormData({
        name: '',
        icon: '💰',
        color: 'blue',
        targetAmount: 0,
        currentAmount: 0,
        createdAt: new Date().toISOString().split('T')[0],
        deadline: ''
      });
    }, 300);
  };

  const handleSave = () => {
    if (!formData.name || formData.targetAmount <= 0) {
      toast.error("Preencha o nome e a meta.");
      return;
    }

    if (editingInvestment) {
      onUpdate({ ...editingInvestment, ...formData });
      toast.success("Caixinha atualizada!");
    } else {
      onAdd(formData);
      toast.success("Caixinha criada!");
    }
    handleCloseModal();
  };

  const handleOpenDeposit = (investment: Investment) => {
    setDepositInvestment(investment);
    setDepositAmount('');
    setDepositModalOpen(true);
  };

  const handleDeposit = () => {
    if (!depositInvestment) return;
    const amount = parseFloat(depositAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast.error("Insira um valor válido.");
      return;
    }

    const newAmount = depositInvestment.currentAmount + amount;
    onUpdate({
      ...depositInvestment,
      currentAmount: Math.min(newAmount, depositInvestment.targetAmount)
    });

    // Criar transação de despesa (dinheiro saindo da conta para a caixinha)
    onAddTransaction({
      date: new Date().toISOString().split('T')[0],
      description: `Depósito em ${depositInvestment.name}`,
      amount: amount,
      category: `Caixinha - ${depositInvestment.name}`,
      type: 'expense',
      status: 'completed',
      memberId: depositInvestment.memberId
    });

    toast.success(`R$ ${amount.toFixed(2)} depositado em ${depositInvestment.icon} ${depositInvestment.name}!`);
    setDepositModalOpen(false);
    setDepositInvestment(null);
    setDepositAmount('');
  };

  const handleWithdraw = () => {
    if (!depositInvestment) return;
    const amount = parseFloat(depositAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast.error("Insira um valor válido.");
      return;
    }

    const newAmount = depositInvestment.currentAmount - amount;
    if (newAmount < 0) {
      toast.error("Saldo insuficiente na caixinha.");
      return;
    }

    onUpdate({
      ...depositInvestment,
      currentAmount: newAmount
    });

    // Criar transação de receita (dinheiro voltando da caixinha para a conta)
    onAddTransaction({
      date: new Date().toISOString().split('T')[0],
      description: `Retirada de ${depositInvestment.name}`,
      amount: amount,
      category: `Caixinha - ${depositInvestment.name}`,
      type: 'income',
      status: 'completed',
      memberId: depositInvestment.memberId
    });

    toast.success(`R$ ${amount.toFixed(2)} retirado de ${depositInvestment.icon} ${depositInvestment.name}!`);
    setDepositModalOpen(false);
    setDepositInvestment(null);
    setDepositAmount('');
  };
  const getColorClass = (color: string) => {
    return COLOR_OPTIONS.find(c => c.value === color) || COLOR_OPTIONS[0];
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage < 70) return 'bg-green-500';
    if (percentage < 90) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const totalSaved = investments.reduce((sum, inv) => sum + inv.currentAmount, 0);
  const totalTarget = investments.reduce((sum, inv) => sum + inv.targetAmount, 0);
  const depositProgress = depositInvestment && depositInvestment.targetAmount > 0
    ? (depositInvestment.currentAmount / depositInvestment.targetAmount) * 100
    : 0;

  return (
    <div className="space-y-6 animate-fade-in pb-20 lg:pb-0 flex flex-col h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Caixinhas</h2>
          <p className="text-gray-400 text-sm">Visual alinhado ao painel de Orçamentos Mensais.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-[#d97757] hover:bg-[#c56a4d] text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-[#d97757]/20"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Nova Caixinha</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Coins size={16} className="text-green-400" />
            <p className="text-xs text-gray-500 font-medium">Total Guardado</p>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalSaved)}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Target size={16} className="text-blue-400" />
            <p className="text-xs text-gray-500 font-medium">Meta Total</p>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalTarget)}</p>
        </div>
      </div>

      {/* Lista de Caixinhas */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {investments.length === 0 ? (
          <div className="py-12 text-center text-gray-500 bg-gray-900/50 rounded-2xl border border-dashed border-gray-800">
            <div className="w-16 h-16 mx-auto mb-3 bg-gray-800/60 rounded-full flex items-center justify-center">
              <PiggyBank size={32} className="opacity-50" />
            </div>
            <p className="text-base font-medium">Nenhuma caixinha criada</p>
            <p className="text-sm text-gray-400">Crie a primeira para monitorar seus objetivos.</p>
            <button
              onClick={() => handleOpenModal()}
              className="mt-4 px-5 py-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-colors shadow-lg shadow-[#d97757]/20 flex items-center gap-2 mx-auto"
            >
              <Plus size={18} />
              Criar Caixinha
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {investments.map((investment) => {
              const progress = investment.targetAmount > 0
                ? (investment.currentAmount / investment.targetAmount) * 100
                : 0;
              const colorClass = getColorClass(investment.color);
              const isComplete = progress >= 100;
              const remainingAmount = Math.max(investment.targetAmount - investment.currentAmount, 0);

              return (
                <div
                  key={investment.id}
                  className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-sm hover:border-gray-700 transition-all group relative overflow-hidden"
                >
                  <div
                    className={`absolute bottom-0 left-0 h-1 transition-all duration-500 ${getProgressBarColor(progress)}`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  ></div>

                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl bg-gray-800/70 ${colorClass.textClass} flex items-center justify-center`}>
                        {investment.icon.includes('.png') ? (
                          <img
                            src={`/assets/${investment.icon}`}
                            alt={investment.name}
                            className="w-10 h-10 object-contain"
                          />
                        ) : (
                          <span className="text-3xl">{investment.icon}</span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-lg">{investment.name}</h3>
                        {investment.deadline && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <Calendar size={12} />
                            {new Date(investment.deadline).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenModal(investment)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteId(investment.id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">
                        Guardado: <span className="text-white font-semibold">{formatCurrency(investment.currentAmount)}</span>
                      </span>
                      <span className="text-gray-400">
                        Meta: <span className="text-white font-semibold">{formatCurrency(investment.targetAmount)}</span>
                      </span>
                    </div>

                    <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(progress)}`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between items-center text-xs mt-1">
                      <span className={`${isComplete ? 'text-green-400 font-semibold' : 'text-gray-500'}`}>
                        {Math.min(progress, 100).toFixed(0)}% alcançado
                      </span>
                      {isComplete ? (
                        <span className="flex items-center gap-1 text-green-400 font-semibold">
                          <Sparkles size={14} />
                          Meta concluída
                        </span>
                      ) : (
                        <span className={`font-semibold ${colorClass.textClass}`}>
                          Falta {formatCurrency(remainingAmount)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <button
                      onClick={() => handleOpenDeposit(investment)}
                      className="w-full py-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/20 flex items-center justify-center gap-2"
                    >
                      <ArrowUpCircle size={18} />
                      Depositar / Retirar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isVisible && createPortal(
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ease-in-out ${isAnimating ? 'bg-black/90 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-0'}`}
        >
          <div
            className={`bg-gray-950 rounded-3xl shadow-2xl w-full max-w-2xl overflow-visible border border-gray-800 flex flex-col max-h-[90vh] relative transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}`}
          >
            {/* Background Effects */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#d97757]/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-gray-700/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
            </div>

            {/* Header */}
            <div className="p-5 border-b border-gray-800/50 flex justify-between items-center relative z-10">
              <h3 className="font-bold text-white flex items-center gap-2">
                <PiggyBank size={20} className="text-[#d97757]" />
                {editingInvestment ? 'Editar Caixinha' : 'Nova Caixinha'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar relative z-10">
              {modalStep === 'template' && !editingInvestment ? (
                <div className="space-y-6 animate-fade-in">
                  <div className="text-center mb-2">
                    <h4 className="text-3xl font-bold text-white mb-3 bg-gradient-to-r from-white via-gray-200 to-white bg-clip-text text-transparent">
                      Escolha um modelo
                    </h4>
                    <p className="text-sm text-gray-400">Selecione um dos modelos prontos para começar rapidamente</p>
                  </div>

                  {/* Templates Grid */}
                  <div className="grid grid-cols-3 gap-4">
                    {TEMPLATES.map((template) => {
                      const colorClass = getColorClass(template.color);
                      return (
                        <button
                          key={template.name}
                          onClick={() => handleSelectTemplate(template)}
                          className={`p-6 bg-gradient-to-br from-gray-900 to-gray-950 border-2 border-gray-700 rounded-2xl hover:border-gray-500 transition-all duration-300 group text-center hover:shadow-2xl hover:-translate-y-2 relative overflow-hidden`}
                        >
                          {/* Gradient overlay on hover */}
                          <div className={`absolute inset-0 bg-gradient-to-br ${colorClass.class} opacity-0 group-hover:opacity-20 transition-all duration-300`}></div>

                          {/* Glow effect */}
                          <div className={`absolute inset-0 bg-gradient-to-br ${colorClass.class} opacity-0 group-hover:opacity-30 blur-xl transition-opacity duration-300`}></div>

                          <div className="relative z-10 flex flex-col items-center gap-3">
                            <div className="mb-2 transform group-hover:scale-125 transition-transform duration-300 drop-shadow-2xl">
                              <img
                                src={`/assets/${template.icon}`}
                                alt={template.name}
                                className="w-20 h-20 object-contain"
                              />
                            </div>
                            <div>
                              <p className="text-base font-bold text-white mb-2 group-hover:text-white tracking-wide">
                                {template.name}
                              </p>
                              <div className={`inline-flex items-center px-3 py-1.5 rounded-full ${colorClass.bgClass} border ${colorClass.textClass.replace('text-', 'border-').replace('-400', '-900/50')}`}>
                                <p className={`text-sm font-bold ${colorClass.textClass}`}>
                                  {formatCurrency(template.suggestedAmount)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Divider */}
                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-800"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-gray-950 px-4 text-sm text-gray-500 font-medium">OU</span>
                    </div>
                  </div>

                  {/* Custom Option */}
                  <button
                    onClick={() => setModalStep('form')}
                    className="w-full p-6 bg-gradient-to-br from-[#d97757]/10 via-gray-900/50 to-gray-950/50 hover:from-[#d97757]/20 hover:via-gray-900/70 hover:to-gray-950/70 text-white rounded-2xl font-bold transition-all duration-300 border-2 border-[#d97757]/30 hover:border-[#d97757]/50 flex flex-col items-center gap-3 group hover:shadow-2xl hover:shadow-[#d97757]/20 hover:-translate-y-1 relative overflow-hidden"
                  >
                    {/* Animated background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#d97757]/10 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>

                    <div className="relative z-10 flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-[#d97757]/20 flex items-center justify-center group-hover:bg-[#d97757]/30 transition-colors group-hover:scale-110 duration-300">
                        <Plus size={32} className="text-[#d97757] group-hover:rotate-90 transition-transform duration-300" />
                      </div>
                      <div>
                        <p className="text-xl font-bold text-white mb-1">Criar do Zero</p>
                        <p className="text-sm text-gray-400">Personalize completamente sua caixinha</p>
                      </div>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="space-y-5 animate-fade-in">
                  {/* Icon and Name Row */}
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="flex-shrink-0 relative icon-picker-container">
                      <label className="text-sm font-medium text-gray-300 mb-2 block">Ícone</label>
                      <button
                        type="button"
                        onClick={() => setIconPickerOpen(!iconPickerOpen)}
                        className="w-20 h-20 bg-gray-900 border-2 border-gray-700 rounded-xl hover:border-[#d97757] transition-all flex items-center justify-center relative overflow-hidden group"
                      >
                        {formData.icon.includes('.png') ? (
                          <img
                            src={`/assets/${formData.icon}`}
                            alt="Ícone"
                            className="w-14 h-14 object-contain"
                          />
                        ) : (
                          <span className="text-4xl">{formData.icon}</span>
                        )}
                        <div className="absolute inset-0 bg-[#d97757]/0 group-hover:bg-[#d97757]/10 transition-all"></div>
                      </button>

                      {/* Icon Picker Dropdown */}
                      {iconPickerOpen && (
                        <div className="absolute z-50 mt-2 bg-gray-950 border-2 border-gray-700 rounded-xl shadow-2xl p-4 w-80 animate-fade-in">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-sm font-bold text-white">Escolha um Ícone</h4>
                            <button
                              onClick={() => setIconPickerOpen(false)}
                              className="text-gray-500 hover:text-white transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </div>

                          {/* Template Images */}
                          <div className="mb-4">
                            <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Imagens</p>
                            <div className="grid grid-cols-3 gap-2">
                              {ICON_IMAGES.map((img) => (
                                <button
                                  key={img.file}
                                  type="button"
                                  onClick={() => {
                                    setFormData({ ...formData, icon: img.file });
                                    setIconPickerOpen(false);
                                  }}
                                  className={`p-3 bg-gray-900 border-2 rounded-lg hover:border-[#d97757] hover:scale-105 transition-all ${formData.icon === img.file ? 'border-[#d97757] ring-2 ring-[#d97757]/50 scale-105' : 'border-gray-700'}`}
                                >
                                  <img
                                    src={`/assets/${img.file}`}
                                    alt={img.name}
                                    className="w-full h-12 object-contain mb-1"
                                  />
                                  <p className="text-[10px] text-gray-400 text-center font-medium">{img.name}</p>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Emojis */}
                          <div>
                            <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Emojis</p>
                            <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                              {EMOJI_OPTIONS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => {
                                    setFormData({ ...formData, icon: emoji });
                                    setIconPickerOpen(false);
                                  }}
                                  className={`p-2 bg-gray-900 border-2 rounded-lg hover:border-[#d97757] hover:scale-110 transition-all text-2xl ${formData.icon === emoji ? 'border-[#d97757] ring-2 ring-[#d97757]/50 scale-110' : 'border-gray-700'}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-300 mb-2 block">Nome da Caixinha</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full h-20 px-4 bg-gray-900 border border-gray-700 rounded-xl focus:ring-2 focus:ring-[#d97757] focus:border-[#d97757] text-gray-100 text-lg font-medium transition-all"
                        placeholder="Ex: Viagem para Europa"
                      />
                    </div>
                  </div>

                  {/* Color Selection */}
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-3 block">Escolha a Cor</label>
                    <div className="grid grid-cols-4 gap-3">
                      {COLOR_OPTIONS.slice(0, 8).map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, color: color.value })}
                          className={`h-12 rounded-lg bg-gradient-to-r ${color.class} transition-all ${formData.color === color.value ? 'ring-2 ring-white scale-105' : 'opacity-60 hover:opacity-100 hover:scale-105'}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Target Amount */}
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">Valor da Meta</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formData.targetAmount > 0 ? formData.targetAmount.toString().replace('.', ',') : ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(',', '.');
                          const parsed = parseFloat(val);
                          setFormData({ ...formData, targetAmount: isNaN(parsed) ? 0 : parsed });
                        }}
                        className="w-full p-3.5 pl-11 bg-gray-900 border border-gray-700 rounded-xl focus:ring-2 focus:ring-[#d97757] focus:border-[#d97757] text-gray-100 text-lg font-bold transition-all"
                        placeholder="0,00"
                      />
                    </div>
                  </div>

                  {/* Deadline */}
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">Prazo <span className="text-gray-500 text-xs font-normal">(Opcional)</span></label>
                    <input
                      type="date"
                      value={formData.deadline}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                      className="w-full p-3.5 bg-gray-900 border border-gray-700 rounded-xl focus:ring-2 focus:ring-[#d97757] focus:border-[#d97757] text-gray-100 transition-all"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {modalStep === 'form' && (
              <div className="p-5 border-t border-gray-800/50 flex gap-3 relative z-10">
                <button
                  type="button"
                  onClick={() => editingInvestment ? handleCloseModal() : setModalStep('template')}
                  className="flex-1 py-3 bg-gray-800/50 hover:bg-gray-700 text-white rounded-xl font-bold transition-all border border-gray-700"
                >
                  {editingInvestment ? 'Cancelar' : 'Voltar'}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 py-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/20 flex items-center justify-center gap-2"
                >
                  <Check size={18} />
                  {editingInvestment ? 'Salvar' : 'Criar Caixinha'}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Deposit/Withdraw Modal */}
      {depositModalOpen && depositInvestment && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in">
          <div className="bg-gray-950 rounded-3xl shadow-2xl w-full max-w-lg border border-gray-800 overflow-hidden relative animate-slide-up">
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#d97757]/10 rounded-full blur-3xl -mr-12 -mt-12"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-gray-700/10 rounded-full blur-3xl -ml-12 -mb-12"></div>
            </div>

            {/* Header */}
            <div className="p-5 border-b border-gray-800/50 flex justify-between items-center relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#d97757]/15 text-[#d97757] border border-[#d97757]/30">
                  <ArrowUpCircle size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Caixinha</p>
                  <h3 className="text-lg font-bold text-white">{depositInvestment.name}</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <Coins size={12} />
                    Saldo: {formatCurrency(depositInvestment.currentAmount)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setDepositModalOpen(false);
                  setDepositInvestment(null);
                  setDepositAmount('');
                }}
                className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 relative z-10">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-3">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Saldo Atual</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(depositInvestment.currentAmount)}</p>
                </div>
                <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-3">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Meta</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(depositInvestment.targetAmount)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-3">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Progresso</p>
                  <p className="text-lg font-bold text-white flex items-center gap-2">
                    {Math.min(depositProgress, 100).toFixed(0)}%
                    <span className={`w-14 h-1.5 rounded-full block ${getProgressBarColor(depositProgress)}`}></span>
                  </p>
                </div>
                <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-3">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Falta para a meta</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(Math.max(depositInvestment.targetAmount - depositInvestment.currentAmount, 0))}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400 flex items-center gap-2">
                  <DollarSign size={14} />
                  Valor da operação
                </label>
                <div className="relative group">
                  <span className="absolute left-4 top-4 text-gray-500 font-bold text-xl group-focus-within:text-[#d97757] transition-colors">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full p-4 pl-12 bg-gray-900/70 border border-gray-700 rounded-2xl focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757] text-gray-100 text-2xl font-bold transition-all"
                    placeholder="0,00"
                    autoFocus
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleDeposit}
                  className="py-3.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-900/30 flex items-center justify-center gap-2"
                >
                  <ArrowUpCircle size={18} />
                  Depositar
                </button>
                <button
                  onClick={handleWithdraw}
                  className="py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-900/30 flex items-center justify-center gap-2"
                >
                  <TrendingUp size={18} className="rotate-180" />
                  Retirar
                </button>
              </div>

              <button
                onClick={() => {
                  setDepositModalOpen(false);
                  setDepositInvestment(null);
                  setDepositAmount('');
                }}
                className="w-full py-3 bg-gray-800/60 hover:bg-gray-700 text-white rounded-xl font-medium transition-all border border-gray-700 hover:border-gray-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation */}
      <ConfirmationCard
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            onDelete(deleteId);
            toast.success("Caixinha removida!");
            setDeleteId(null);
          }
        }}
        title="Remover Caixinha?"
        description="VocÃª estÃ¡ prestes a apagar esta caixinha. Esta aÃ§Ã£o nÃ£o pode ser desfeita."
        isDestructive={true}
        confirmText="Sim, remover"
        cancelText="Cancelar"
      />
    </div>
  );
};




