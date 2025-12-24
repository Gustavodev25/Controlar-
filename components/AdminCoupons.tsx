import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, Trash2, Edit2, Ticket, Percent, DollarSign, X, Filter, Clock, Handshake, Wallet, CheckCircle } from 'lucide-react';
import { Coupon } from '../types';
import * as dbService from '../services/database';
import { useToasts } from './Toast';
import { CustomSelect, CustomDatePicker } from './UIComponents';
import { ConfirmationBar } from './ConfirmationBar';

export const AdminCoupons: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const toast = useToasts();

  // Modal Animation State
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Delete Confirmation State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Toggle Status Confirmation State
  const [toggleCoupon, setToggleCoupon] = useState<Coupon | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    type: 'percentage' as 'percentage' | 'fixed' | 'progressive',
    value: 0,
    isActive: true,
    maxUses: '' as string | number,
    expirationDate: '',
    validityMode: 'none' as 'none' | 'date' | 'months',
    validityMonths: '' as string | number,
    progressiveDiscounts: [{ month: 1, discount: 100 }] as { month: number; discount: number }[],
    // Partnership fields
    isPartnership: false,
    partnerName: '',
    partnerCommissionType: 'percentage' as 'percentage' | 'fixed',
    partnerCommissionValue: 0,
    partnerPix: ''
  });

  // Tab State
  const [activeTab, setActiveTab] = useState<'coupons' | 'partners'>('coupons');

  // Filter States
  const [usageFilter, setUsageFilter] = useState<'all' | 'unused' | 'partial' | 'exhausted'>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'soon' | 'later' | 'none'>('all');

  const loadCoupons = async () => {
    setIsLoading(true);
    try {
      const data = await dbService.getCoupons();
      // Sort by creation date desc
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCoupons(data);
    } catch (error) {
      console.error("Error loading coupons:", error);
      toast.error("Erro ao carregar cupons.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  // Modal Animation Effect
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

  const handleOpenModal = (coupon?: Coupon) => {
    if (coupon) {
      setEditingCoupon(coupon);
      setFormData({
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        isActive: coupon.isActive,
        maxUses: coupon.maxUses || '',
        expirationDate: coupon.expirationDate || '',
        validityMode: coupon.expirationDate ? 'date' : 'none',
        validityMonths: '',
        progressiveDiscounts: coupon.progressiveDiscounts || [{ month: 1, discount: 100 }],
        isPartnership: !!coupon.partnership,
        partnerName: coupon.partnership?.partnerName || '',
        partnerCommissionType: coupon.partnership?.commissionType || 'percentage',
        partnerCommissionValue: coupon.partnership?.commissionValue || 0,
        partnerPix: coupon.partnership?.partnerPix || ''
      });
    } else {
      setEditingCoupon(null);
      setFormData({
        code: '',
        type: 'percentage',
        value: 0,
        isActive: true,
        maxUses: '',
        expirationDate: '',
        validityMode: 'none',
        validityMonths: '',
        progressiveDiscounts: [{ month: 1, discount: 100 }],
        isPartnership: false,
        partnerName: '',
        partnerCommissionType: 'percentage',
        partnerCommissionValue: 0,
        partnerPix: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setEditingCoupon(null);
      setFormData({
        code: '',
        type: 'percentage',
        value: 0,
        isActive: true,
        maxUses: '',
        expirationDate: '',
        validityMode: 'none',
        validityMonths: '',
        progressiveDiscounts: [{ month: 1, discount: 100 }],
        isPartnership: false,
        partnerName: '',
        partnerCommissionType: 'percentage',
        partnerCommissionValue: 0,
        partnerPix: ''
      });
    }, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.code) {
      toast.error("Código do cupom é obrigatório.");
      return;
    }

    if (formData.type === 'progressive') {
      if (formData.progressiveDiscounts.length === 0) {
        toast.error("Adicione pelo menos uma regra de desconto.");
        return;
      }
    } else if (formData.value <= 0 && !formData.isPartnership) {
      toast.error("O valor do desconto deve ser maior que zero.");
      return;
    }

    try {
      const payload: any = {
        code: formData.code.toUpperCase(),
        type: formData.type,
        value: formData.type === 'progressive' ? 0 : Number(formData.value),
        isActive: formData.isActive,
        createdAt: editingCoupon?.createdAt || new Date().toISOString(),
        currentUses: editingCoupon?.currentUses || 0
      };

      // Save progressive discounts
      if (formData.type === 'progressive') {
        payload.progressiveDiscounts = formData.progressiveDiscounts.sort((a, b) => a.month - b.month);
      }

      // Save partnership
      if (formData.isPartnership && formData.partnerName) {
        payload.partnership = {
          partnerName: formData.partnerName,
          commissionType: formData.partnerCommissionType,
          commissionValue: Number(formData.partnerCommissionValue),
          accumulatedCommission: editingCoupon?.partnership?.accumulatedCommission || 0,
          partnerPix: formData.partnerPix
        };
      }

      if (formData.maxUses) payload.maxUses = Number(formData.maxUses);

      // Calculate expiration date based on validity mode
      if (formData.validityMode === 'date' && formData.expirationDate) {
        payload.expirationDate = formData.expirationDate;
      } else if (formData.validityMode === 'months' && formData.validityMonths) {
        const months = Number(formData.validityMonths);
        const expirationDate = new Date();
        expirationDate.setMonth(expirationDate.getMonth() + months);
        payload.expirationDate = expirationDate.toISOString().split('T')[0];
      }
      // If validityMode is 'none', no expirationDate is set

      if (editingCoupon) {
        await dbService.updateCoupon({ ...payload, id: editingCoupon.id });
        toast.success("Cupom atualizado!");
      } else {
        await dbService.addCoupon(payload);
        toast.success("Cupom criado!");
      }

      handleCloseModal();
      loadCoupons();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar cupom.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      await dbService.deleteCoupon(deleteId);
      toast.success("Cupom removido.");
      loadCoupons();
    } catch (error) {
      toast.error("Erro ao remover cupom.");
    } finally {
      setDeleteId(null);
    }
  };

  const handleConfirmToggle = async () => {
    if (!toggleCoupon) return;
    try {
      await dbService.updateCoupon({ ...toggleCoupon, isActive: !toggleCoupon.isActive });
      toast.success(toggleCoupon.isActive ? "Cupom inativado." : "Cupom ativado.");
      loadCoupons();
    } catch (error) {
      toast.error("Erro ao atualizar status.");
    } finally {
      setToggleCoupon(null);
    }
  };

  const handleResetCommission = async (coupon: Coupon) => {
    if (confirm(`Confirma o pagamento de R$ ${coupon.partnership?.accumulatedCommission?.toFixed(2)} para ${coupon.partnership?.partnerName}? O saldo será zerado.`)) {
      try {
        await dbService.resetPartnerCommission(coupon.id);
        toast.success("Comissão zerada com sucesso!");
        loadCoupons();
      } catch (error) {
        toast.error("Erro ao zerar comissão.");
      }
    }
  };

  const handleToggleClick = (coupon: Coupon) => {
    if (coupon.isActive) {
      // Se está ativo, pede confirmação para inativar
      setToggleCoupon(coupon);
    } else {
      // Se está inativo, ativa diretamente
      handleConfirmToggle();
      // Precisamos fazer inline já que toggleCoupon não estará setado
      dbService.updateCoupon({ ...coupon, isActive: true })
        .then(() => {
          toast.success("Cupom ativado.");
          loadCoupons();
        })
        .catch(() => toast.error("Erro ao ativar cupom."));
    }
  };

  const filteredCoupons = useMemo(() => {
    const today = new Date();
    const in7Days = new Date();
    in7Days.setDate(today.getDate() + 7);

    return coupons.filter(c => {
      // Search filter
      if (searchTerm && !c.code.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Usage filter
      if (usageFilter !== 'all') {
        const usage = c.currentUses || 0;
        const max = c.maxUses || null;

        if (usageFilter === 'unused' && usage > 0) return false;
        if (usageFilter === 'partial' && (usage === 0 || (max && usage >= max))) return false;
        if (usageFilter === 'exhausted' && (!max || usage < max)) return false;
      }

      // Period filter
      if (periodFilter !== 'all') {
        if (periodFilter === 'none' && c.expirationDate) return false;
        if (periodFilter === 'soon') {
          if (!c.expirationDate) return false;
          const exp = new Date(c.expirationDate);
          if (exp > in7Days) return false;
        }
        if (periodFilter === 'later') {
          if (!c.expirationDate) return false;
          const exp = new Date(c.expirationDate);
          if (exp <= in7Days) return false;
        }
      }

      return true;
    });
  }, [coupons, searchTerm, usageFilter, periodFilter]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Gerenciar Cupons</h2>
          <p className="text-gray-400 text-sm mt-1">Crie e gerencie códigos de desconto para o checkout.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-[#d97757] hover:bg-[#c56a4d] text-white px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-[#d97757]/20"
        >
          <Plus size={18} />
          Novo Cupom
        </button>
      </div>



      {/* Smooth Tabs */}
      <div className="flex justify-start mb-6">
        <div className="bg-[#30302E] p-1 rounded-xl inline-flex gap-0 relative">
          {/* Sliding Pill */}
          <div
            className={`absolute top-1 bottom-1 rounded-lg bg-[#3a3a38] border border-gray-700 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${activeTab === 'coupons'
              ? 'left-1 w-[calc(50%-2px)]'
              : 'left-[50%] w-[calc(50%-2px)]'
              }`}
          />

          <button
            onClick={() => setActiveTab('coupons')}
            className={`relative z-10 flex items-center justify-center gap-2 px-5 py-2 text-sm font-medium transition-colors duration-200 rounded-lg ${activeTab === 'coupons'
              ? 'text-white'
              : 'text-gray-400 hover:text-gray-300'
              }`}
          >
            <Ticket size={16} />
            Cupons
          </button>

          <button
            onClick={() => setActiveTab('partners')}
            className={`relative z-10 flex items-center justify-center gap-2 px-5 py-2 text-sm font-medium transition-colors duration-200 rounded-lg ${activeTab === 'partners'
              ? 'text-white'
              : 'text-gray-400 hover:text-gray-300'
              }`}
          >
            <Handshake size={16} />
            Parceiros
          </button>
        </div>
      </div>


      {
        activeTab === 'coupons' && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Search - Left */}
              <div className="flex items-center gap-2 px-3 bg-gray-900/50 rounded-xl border border-gray-800/50 min-w-[200px] max-w-[280px]">
                <Search size={16} className="text-gray-500 shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent border-none outline-none text-white placeholder-gray-500 text-sm w-full h-9"
                />
              </div>

              {/* Filters - Right */}
              <div className="flex items-center gap-3">
                {/* Usage Filter */}
                <CustomSelect
                  value={usageFilter}
                  onChange={(v) => setUsageFilter(v as any)}
                  options={[
                    { value: 'all', label: 'Todos os usos' },
                    { value: 'unused', label: 'Não usados' },
                    { value: 'partial', label: 'Parcialmente usados' },
                    { value: 'exhausted', label: 'Esgotados' }
                  ]}
                />

                {/* Period Filter */}
                <CustomSelect
                  value={periodFilter}
                  onChange={(v) => setPeriodFilter(v as any)}
                  options={[
                    { value: 'all', label: 'Todas as validades' },
                    { value: 'soon', label: 'Vence em 7 dias' },
                    { value: 'later', label: 'Vence depois' },
                    { value: 'none', label: 'Sem validade' }
                  ]}
                />

                {/* Active filters indicator */}
                {(usageFilter !== 'all' || periodFilter !== 'all') && (
                  <button
                    onClick={() => { setUsageFilter('all'); setPeriodFilter('all'); }}
                    className="text-[10px] text-[#d97757] hover:text-white font-bold uppercase flex items-center gap-1 transition-colors"
                  >
                    <X size={12} /> Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="bg-[#30302E] rounded-xl border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-900/50 border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                      <th className="p-4 font-medium">Código</th>
                      <th className="p-4 font-medium">Desconto</th>
                      <th className="p-4 font-medium">Uso</th>
                      <th className="p-4 font-medium">Validade</th>
                      <th className="p-4 font-medium">Status</th>
                      <th className="p-4 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-500">Carregando...</td>
                      </tr>
                    ) : filteredCoupons.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-500">Nenhum cupom encontrado.</td>
                      </tr>
                    ) : (
                      filteredCoupons.map((coupon) => (
                        <tr key={coupon.id} className="hover:bg-white/5 transition-colors text-sm">
                          <td className="p-4 font-bold text-white">
                            <div className="flex flex-col">
                              <span className="flex items-center gap-2">
                                {coupon.code}
                                {coupon.partnership && (
                                  <div title={`Parceiro: ${coupon.partnership.partnerName}`}>
                                    <Handshake size={14} className="text-[#d97757]" />
                                  </div>
                                )}
                              </span>
                              {coupon.partnership && (
                                <span className="text-[10px] text-gray-500 font-normal mt-0.5">
                                  {coupon.partnership.partnerName}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-gray-300">
                            {coupon.type === 'progressive' ? (
                              <span className="text-[#d97757]" title={coupon.progressiveDiscounts?.map(d => `Mês ${d.month}: ${d.discount}%`).join(', ')}>
                                Progressivo
                              </span>
                            ) : coupon.type === 'percentage' ? `${coupon.value}%` : `R$ ${coupon.value.toFixed(2)}`}
                          </td>
                          <td className="p-4 text-gray-300">
                            {coupon.currentUses} {coupon.maxUses ? `/ ${coupon.maxUses}` : '(Ilimitado)'}
                            {coupon.partnership && coupon.partnership.accumulatedCommission > 0 && (
                              <div className="mt-1 flex items-center gap-1 text-[11px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded w-fit">
                                <Wallet size={10} />
                                <span>R$ {coupon.partnership.accumulatedCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-gray-300">
                            {coupon.expirationDate ? new Date(coupon.expirationDate).toLocaleDateString('pt-BR') : 'Indeterminado'}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${coupon.isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                              {coupon.isActive ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => handleToggleClick(coupon)}
                                className={`p-1.5 rounded-lg transition-colors ${coupon.isActive
                                  ? 'hover:bg-amber-500/10 text-gray-400 hover:text-amber-400'
                                  : 'hover:bg-green-500/10 text-gray-400 hover:text-green-400'
                                  }`}
                                title={coupon.isActive ? 'Inativar cupom' : 'Ativar cupom'}
                              >
                                {coupon.isActive ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20.042 16.045a9 9 0 0 0 -12.087 -12.087m-2.318 1.677a9 9 0 1 0 12.725 12.73" />
                                    <path d="M3 3l18 18" />
                                  </svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
                                  </svg>
                                )}
                              </button>
                              <button
                                onClick={() => handleOpenModal(coupon)}
                                className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                                title="Editar cupom"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => setDeleteId(coupon.id)}
                                className="p-1.5 hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                                title="Excluir cupom"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      }

      {
        activeTab === 'partners' && (
          <div className="bg-[#30302E] rounded-xl border border-gray-800 overflow-hidden animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-900/50 border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="p-4 font-medium">Parceiro</th>
                    <th className="p-4 font-medium">Cupom Vinculado</th>
                    <th className="p-4 font-medium">Total de Usos</th>
                    <th className="p-4 font-medium">Regra de Comissão</th>
                    <th className="p-4 font-medium">Saldo a Pagar</th>
                    <th className="p-4 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {coupons.filter(c => c.partnership).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500">Nenhuma parceria ativa.</td>
                    </tr>
                  ) : (
                    coupons.filter(c => c.partnership).map(coupon => (
                      <tr key={coupon.id} className="hover:bg-white/5 transition-colors text-sm">
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-white">{coupon.partnership?.partnerName}</span>
                            {coupon.partnership?.partnerPix && (
                              <span className="text-[10px] text-gray-500 mt-0.5 font-mono bg-gray-900 px-1 py-0.5 rounded w-fit">
                                PIX: {coupon.partnership.partnerPix}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-gray-300">
                          <span className="bg-white/5 px-2 py-1 rounded border border-white/10 font-mono text-xs">
                            {coupon.code}
                          </span>
                        </td>
                        <td className="p-4 text-gray-300">
                          {coupon.currentUses} usos
                        </td>
                        <td className="p-4 text-gray-300">
                          {coupon.partnership?.commissionType === 'percentage'
                            ? `${coupon.partnership.commissionValue}% por venda`
                            : `R$ ${coupon.partnership?.commissionValue.toFixed(2)} por venda`
                          }
                        </td>
                        <td className="p-4">
                          <span className={`font-bold ${(coupon.partnership?.accumulatedCommission || 0) > 0
                            ? 'text-green-400'
                            : 'text-gray-500'
                            }`}>
                            R$ {(coupon.partnership?.accumulatedCommission || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          {(coupon.partnership?.accumulatedCommission || 0) > 0 && (
                            <button
                              onClick={() => handleResetCommission(coupon)}
                              className="text-[11px] bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ml-auto font-medium"
                            >
                              <CheckCircle size={12} />
                              Marcar Pago (Zerar)
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      }

      {/* Modal - Redesign igual ao padrão do sistema */}
      {
        isVisible && createPortal(
          <div className={`
          fixed inset-0 z-[9999] flex items-center justify-center p-4 
          transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
          ${isAnimating ? 'backdrop-blur-md bg-black/60' : 'backdrop-blur-none bg-black/0'}
        `}>
            <div className={`
            bg-gray-950 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-800 
            flex flex-col max-h-[90vh] relative 
            transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
            ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
          `}>

              {/* Background Glow */}
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 opacity-20 bg-[#d97757]" />

              {/* Header Modal */}
              <div className="p-5 border-b border-gray-800/50 flex justify-between items-center relative z-10">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  {editingCoupon ? (
                    <>
                      <Edit2 size={16} className="text-[#d97757]" />
                      Editar Cupom
                    </>
                  ) : (
                    <>
                      <Ticket size={16} className="text-[#d97757]" />
                      Novo Cupom
                    </>
                  )}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-500 hover:text-white p-2 hover:bg-gray-800/50 rounded-lg transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content Modal */}
              <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar space-y-5 animate-fade-in relative z-10">

                {/* Código do Cupom */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Código do Cupom</label>
                  <div className="relative">
                    <Ticket className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600 uppercase"
                      placeholder="EX: DESCONTO10"
                      disabled={!!editingCoupon}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Tipo */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Tipo</label>
                    <CustomSelect
                      value={formData.type}
                      onChange={(v) => setFormData(prev => ({ ...prev, type: v as any }))}
                      options={[
                        { value: 'percentage', label: 'Porcentagem (%)' },
                        { value: 'fixed', label: 'Valor Fixo (R$)' },
                        { value: 'progressive', label: 'Progressivo' }
                      ]}
                    />
                  </div>

                  {/* Valor - Only for non-progressive */}
                  {formData.type !== 'progressive' && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Valor</label>
                      <div className="relative">
                        {formData.type === 'percentage' ? (
                          <Percent className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                        ) : (
                          <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                        )}
                        <input
                          type="number"
                          value={formData.value}
                          onChange={(e) => setFormData(prev => ({ ...prev, value: Number(e.target.value) }))}
                          className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600 font-mono"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Progressive Discounts Editor */}
                {formData.type === 'progressive' && (
                  <div className="space-y-3 animate-fade-in border border-[#d97757]/20 rounded-xl p-4 bg-[#d97757]/5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-medium text-[#d97757] uppercase tracking-wide flex items-center gap-1.5">
                        <Ticket size={12} />
                        Descontos por Mês
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const nextMonth = formData.progressiveDiscounts.length > 0
                            ? Math.max(...formData.progressiveDiscounts.map(d => d.month)) + 1
                            : 1;
                          setFormData(prev => ({
                            ...prev,
                            progressiveDiscounts: [...prev.progressiveDiscounts, { month: nextMonth, discount: 0 }]
                          }));
                        }}
                        className="text-[10px] text-[#d97757] hover:text-white font-bold uppercase flex items-center gap-1 transition-colors bg-[#d97757]/10 hover:bg-[#d97757]/20 px-2 py-1 rounded-lg"
                      >
                        <Plus size={10} />
                        Adicionar
                      </button>
                    </div>

                    <div className="space-y-2">
                      {formData.progressiveDiscounts.map((rule, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">Mês</span>
                              <input
                                type="number"
                                min="1"
                                value={rule.month}
                                onChange={(e) => {
                                  const newRules = [...formData.progressiveDiscounts];
                                  newRules[idx].month = Number(e.target.value);
                                  setFormData(prev => ({ ...prev, progressiveDiscounts: newRules }));
                                }}
                                className="w-full bg-gray-900/40 border border-gray-800/60 rounded-lg text-white pl-12 pr-3 py-2 text-sm focus:border-gray-700 outline-none transition-all font-mono"
                              />
                            </div>
                            <div className="relative">
                              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" size={12} />
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={rule.discount}
                                onChange={(e) => {
                                  const newRules = [...formData.progressiveDiscounts];
                                  newRules[idx].discount = Math.min(100, Math.max(0, Number(e.target.value)));
                                  setFormData(prev => ({ ...prev, progressiveDiscounts: newRules }));
                                }}
                                className="w-full bg-gray-900/40 border border-gray-800/60 rounded-lg text-white px-3 py-2 text-sm focus:border-gray-700 outline-none transition-all font-mono pr-8"
                                placeholder="Desconto"
                              />
                            </div>
                          </div>
                          {formData.progressiveDiscounts.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  progressiveDiscounts: prev.progressiveDiscounts.filter((_, i) => i !== idx)
                                }));
                              }}
                              className="p-1.5 hover:bg-red-500/10 rounded-lg text-gray-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {/* Limite de Uso */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Limite de Uso</label>
                    <input
                      type="number"
                      value={formData.maxUses}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxUses: e.target.value }))}
                      className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white px-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600"
                      placeholder="Ilimitado"
                    />
                  </div>

                  {/* Validade */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Validade</label>
                    <CustomSelect
                      value={formData.validityMode}
                      onChange={(v) => setFormData(prev => ({
                        ...prev,
                        validityMode: v as any,
                        expirationDate: v === 'none' ? '' : prev.expirationDate,
                        validityMonths: v === 'none' ? '' : prev.validityMonths
                      }))}
                      options={[
                        { value: 'none', label: 'Sem validade' },
                        { value: 'date', label: 'Data específica' },
                        { value: 'months', label: 'Por meses' }
                      ]}
                    />
                  </div>
                </div>

                {/* Conditional Validity Fields */}
                {formData.validityMode !== 'none' && (
                  <div className="animate-fade-in">
                    {formData.validityMode === 'date' ? (
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Data de Expiração</label>
                        <CustomDatePicker
                          value={formData.expirationDate}
                          onChange={(val) => setFormData(prev => ({ ...prev, expirationDate: val }))}
                          placeholder="Selecione a data"
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Quantidade de Meses</label>
                        <div className="relative">
                          <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                          <input
                            type="number"
                            min="1"
                            value={formData.validityMonths}
                            onChange={(e) => setFormData(prev => ({ ...prev, validityMonths: e.target.value }))}
                            className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600"
                            placeholder="Ex: 3 (meses a partir de hoje)"
                          />
                        </div>
                        {formData.validityMonths && Number(formData.validityMonths) > 0 && (
                          <p className="text-[10px] text-gray-500 mt-1">
                            Expira em: {(() => {
                              const d = new Date();
                              d.setMonth(d.getMonth() + Number(formData.validityMonths));
                              return d.toLocaleDateString('pt-BR');
                            })()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Toggle Ativo */}
                {/* Partnership Toggle */}
                <div className="border border-gray-800/40 rounded-xl p-4 bg-gray-900/20 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <Handshake size={16} className={`transition-colors ${formData.isPartnership ? 'text-[#d97757]' : 'text-gray-600'}`} />
                      <div>
                        <span className="block text-sm font-medium text-gray-300">Modo Parceria</span>
                        <span className="block text-[10px] text-gray-500">Vincular a influencer/parceiro</span>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isPartnership}
                        onChange={() => setFormData(prev => ({ ...prev, isPartnership: !prev.isPartnership }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#d97757]"></div>
                    </label>
                  </div>

                  {formData.isPartnership && (
                    <div className="space-y-4 animate-fade-in pt-2 border-t border-gray-800/40 mt-2">
                      {/* Partner Name */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Nome do Parceiro / Influencer</label>
                        <input
                          type="text"
                          value={formData.partnerName}
                          onChange={(e) => setFormData(prev => ({ ...prev, partnerName: e.target.value }))}
                          className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white px-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600"
                          placeholder="Ex: @influencer_top"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Tipo de Comissão</label>
                          <CustomSelect
                            value={formData.partnerCommissionType}
                            onChange={(v) => setFormData(prev => ({ ...prev, partnerCommissionType: v as any }))}
                            options={[
                              { value: 'percentage', label: 'Porcentagem (%)' },
                              { value: 'fixed', label: 'Valor Fixo (R$)' }
                            ]}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Valor Comissão</label>
                          <div className="relative">
                            {formData.partnerCommissionType === 'percentage' ? (
                              <Percent className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                            ) : (
                              <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                            )}
                            <input
                              type="number"
                              value={formData.partnerCommissionValue}
                              onChange={(e) => setFormData(prev => ({ ...prev, partnerCommissionValue: Number(e.target.value) }))}
                              className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Pix Key */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Chave Pix (Opcional)</label>
                        <input
                          type="text"
                          value={formData.partnerPix}
                          onChange={(e) => setFormData(prev => ({ ...prev, partnerPix: e.target.value }))}
                          className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white px-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600"
                          placeholder="CPF, Email ou Aleatória"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Toggle Ativo */}
                <div className="flex items-center justify-between py-3 border-t border-gray-800/40">
                  <div className="flex items-center gap-2.5">
                    <Ticket size={15} className={`transition-colors ${formData.isActive ? 'text-[#d97757]' : 'text-gray-600'}`} />
                    <div>
                      <span className="block text-sm font-medium text-gray-300">Cupom Ativo</span>
                      <span className="block text-[10px] text-gray-500">Disponível para uso no checkout</span>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#d97757]"></div>
                  </label>
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800/50 transition-all font-medium text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 rounded-xl bg-[#d97757] hover:bg-[#c56a4d] text-white font-bold transition-all shadow-lg shadow-[#d97757]/20 text-sm"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )
      }

      {/* Delete Confirmation */}
      <ConfirmationBar
        isOpen={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleConfirmDelete}
        label="Excluir Cupom?"
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        isDestructive={true}
      />

      {/* Inactivate Confirmation */}
      <ConfirmationBar
        isOpen={!!toggleCoupon}
        onCancel={() => setToggleCoupon(null)}
        onConfirm={handleConfirmToggle}
        label="Inativar Cupom?"
        confirmText="Sim, inativar"
        cancelText="Cancelar"
      />
    </div >
  );
};
