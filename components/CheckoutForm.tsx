import React, { useState } from 'react';
import { Lock, Loader2, Ticket, X, Check } from 'lucide-react';
import { useToasts } from './Toast';
import { CustomSelect } from './UIComponents';
import * as dbService from '../services/database';
import { Coupon } from '../types';

interface CreditCardData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

interface HolderInfo {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  phone: string;
}

interface CheckoutFormProps {
  planName: string;
  price: number;
  billingCycle?: 'monthly' | 'annual';
  onSubmit: (cardData: CreditCardData, holderInfo: HolderInfo, installments?: number, couponId?: string) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
}

export const CheckoutForm: React.FC<CheckoutFormProps> = ({
  planName,
  price,
  billingCycle = 'monthly',
  onSubmit,
  onBack,
  isLoading
}) => {
  const [cardData, setCardData] = useState<CreditCardData>({
    holderName: '',
    number: '',
    expiryMonth: '',
    expiryYear: '',
    ccv: ''
  });

  const [holderInfo, setHolderInfo] = useState<HolderInfo>({
    name: '',
    email: '',
    cpfCnpj: '',
    postalCode: '',
    addressNumber: '',
    phone: ''
  });

  const [installments, setInstallments] = useState(1);

  // Coupon State
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  const toast = useToasts();

  // Luhn Algorithm for Credit Card Validation
  const validateCardNumber = (number: string): boolean => {
    const cleaned = number.replace(/\s/g, '');

    // Check if it's only digits
    if (!/^\d+$/.test(cleaned)) return false;

    // Check length (most cards are 13-19 digits)
    if (cleaned.length < 13 || cleaned.length > 19) return false;

    // Check for obvious fake patterns (all same digits)
    if (/^(.)\1+$/.test(cleaned)) return false;

    // Luhn Algorithm
    let sum = 0;
    let isEven = false;

    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  };

  // Validate card expiry date
  const validateExpiryDate = (month: string, year: string): boolean => {
    if (!month || !year) return false;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const expMonth = parseInt(month, 10);
    const expYear = parseInt(year, 10);

    // Check if month is valid
    if (expMonth < 1 || expMonth > 12) return false;

    // Check if card is expired
    if (expYear < currentYear) return false;
    if (expYear === currentYear && expMonth < currentMonth) return false;

    return true;
  };

  // Validate CVV
  const validateCVV = (cvv: string): boolean => {
    // CVV must be 3-4 digits
    return /^\d{3,4}$/.test(cvv);
  };

  // Validate CPF (Brazilian ID)
  const validateCPF = (cpf: string): boolean => {
    const cleaned = cpf.replace(/\D/g, '');

    // CPF must have 11 digits
    if (cleaned.length !== 11) return false;

    // Check for known invalid CPFs (all same digits)
    if (/^(.)\1+$/.test(cleaned)) return false;

    // Validate CPF checksum
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleaned[i]) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleaned[9])) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleaned[i]) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleaned[10])) return false;

    return true;
  };

  // Função para colocar espaços no número do cartão (visual)
  const formatCardNumber = (value: string) => {
    return value.replace(/\W/gi, '').replace(/(.{4})/g, '$1 ').trim();
  };

  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // Limites de caracteres
    if (name === 'number' && value.length > 16) return;
    if (name === 'ccv' && value.length > 4) return;
    if ((name === 'expiryMonth' || name === 'expiryYear') && value.length > 4) return;

    setCardData(prev => ({ ...prev, [name]: value }));
  };

  const handleHolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setHolderInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyCoupon = async () => {
    if (!couponCode) return;

    setIsValidatingCoupon(true);
    try {
      const result = await dbService.validateCoupon(couponCode.toUpperCase());

      if (result.isValid && result.coupon) {
        setAppliedCoupon(result.coupon);
        toast.success("Cupom aplicado com sucesso!");
      } else {
        setAppliedCoupon(null);
        toast.error(result.error || "Cupom inválido.");
      }
    } catch (error) {
      toast.error("Erro ao validar cupom.");
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  const calculateTotal = () => {
    let finalPrice = price;
    let discount = 0;

    if (appliedCoupon) {
      if (appliedCoupon.type === 'percentage') {
        discount = price * (appliedCoupon.value / 100);
      } else {
        discount = appliedCoupon.value;
      }
      finalPrice = Math.max(0, price - discount);
    }

    return { finalPrice, discount };
  };

  const { finalPrice, discount } = calculateTotal();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic required fields check
    if (!cardData.number || !cardData.holderName || !cardData.ccv || !holderInfo.cpfCnpj || !holderInfo.postalCode || !holderInfo.addressNumber) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    // Validate card number with Luhn algorithm
    if (!validateCardNumber(cardData.number)) {
      toast.error("Número do cartão inválido. Verifique os dígitos.");
      return;
    }

    // Validate expiry date
    if (!validateExpiryDate(cardData.expiryMonth, cardData.expiryYear)) {
      toast.error("Data de validade inválida ou cartão expirado.");
      return;
    }

    // Validate CVV
    if (!validateCVV(cardData.ccv)) {
      toast.error("CVV inválido. Deve ter 3 ou 4 dígitos.");
      return;
    }

    // Validate CPF
    if (!validateCPF(holderInfo.cpfCnpj)) {
      toast.error("CPF inválido. Verifique os dígitos.");
      return;
    }

    // If coupon used, increment usage
    if (appliedCoupon) {
      dbService.incrementCouponUsage(appliedCoupon.id);
    }

    await onSubmit(cardData, { ...holderInfo, name: cardData.holderName }, installments, appliedCoupon?.id);
  };

  const inputStyle = "w-full bg-[rgba(58,59,57,0.5)] border border-[#4a4b49] rounded-xl px-4 h-11 text-[#faf9f5] text-sm placeholder-gray-500 focus:outline-none focus:border-[#d97757] focus:bg-[rgba(58,59,57,0.8)] hover:border-gray-500 transition-all";

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: (i + 1).toString().padStart(2, '0'),
    label: (i + 1).toString().padStart(2, '0')
  }));

  const yearOptions = Array.from({ length: 10 }, (_, i) => {
    const year = new Date().getFullYear() + i;
    return { value: year.toString(), label: year.toString() };
  });

  const installmentOptions = Array.from({ length: 12 }, (_, i) => {
    const count = i + 1;
    const value = finalPrice / count;
    return {
      value: count.toString(),
      label: `${count}x de R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} sem juros`
    };
  });

  return (
    <div className="p-6">
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Coluna Esquerda - Formulário */}
          <div className="lg:col-span-2 space-y-6">

            {/* Payment Detail - COR ALTERADA AQUI */}
            <div className="bg-[#30302E] rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-bold text-white mb-1">Informações de Pagamento</h2>
              <p className="text-sm text-gray-400 mb-6">Preencha os dados do seu cartão de crédito</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-2 ml-1">Número do Cartão</label>
                  <div className="relative">
                    <input
                      type="text"
                      name="number"
                      placeholder="1234 5678 9012 3456"
                      value={formatCardNumber(cardData.number)}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\s/g, '');
                        if (value.length <= 16) {
                          setCardData(prev => ({ ...prev, number: value }));
                        }
                      }}
                      className={inputStyle}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                      VISA
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-2 ml-1">Nome no Cartão</label>
                  <input
                    type="text"
                    name="holderName"
                    placeholder="Nome completo"
                    value={cardData.holderName}
                    onChange={handleCardChange}
                    className={inputStyle}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-2 ml-1">Mês</label>
                    <CustomSelect
                      value={cardData.expiryMonth}
                      onChange={(value) => setCardData(prev => ({ ...prev, expiryMonth: value }))}
                      options={monthOptions}
                      placeholder="MM"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-2 ml-1">Ano</label>
                    <CustomSelect
                      value={cardData.expiryYear}
                      onChange={(value) => setCardData(prev => ({ ...prev, expiryYear: value }))}
                      options={yearOptions}
                      placeholder="AAAA"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-2 ml-1">CVV</label>
                    <input
                      type="text"
                      name="ccv"
                      placeholder="123"
                      maxLength={4}
                      value={cardData.ccv}
                      onChange={handleCardChange}
                      className={inputStyle}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-2 ml-1">CPF/CNPJ</label>
                    <input
                      type="text"
                      name="cpfCnpj"
                      placeholder="000.000.000-00"
                      value={holderInfo.cpfCnpj}
                      onChange={handleHolderChange}
                      className={inputStyle}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-2 ml-1">Telefone</label>
                    <input
                      type="tel"
                      name="phone"
                      placeholder="(00) 00000-0000"
                      value={holderInfo.phone}
                      onChange={handleHolderChange}
                      className={inputStyle}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-2 ml-1">CEP</label>
                    <input
                      type="text"
                      name="postalCode"
                      placeholder="00000-000"
                      value={holderInfo.postalCode}
                      onChange={handleHolderChange}
                      className={inputStyle}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-2 ml-1">Número</label>
                    <input
                      type="text"
                      name="addressNumber"
                      placeholder="123"
                      value={holderInfo.addressNumber}
                      onChange={handleHolderChange}
                      className={inputStyle}
                    />
                  </div>
                </div>

                {billingCycle === 'annual' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-2 ml-1">Parcelamento</label>
                    <CustomSelect
                      value={installments.toString()}
                      onChange={(v) => setInstallments(Number(v))}
                      options={installmentOptions}
                      placeholder="Selecione o parcelamento"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Security Notice - COR ALTERADA AQUI */}
            <div className="bg-[#30302E] border border-gray-800 rounded-xl p-5 flex gap-4">
              <div className="text-green-500 shrink-0 mt-0.5">
                <Lock size={20} />
              </div>
              <div>
                <h3 className="font-bold text-white mb-2">Pagamento Seguro</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Seus dados são protegidos com criptografia de ponta a ponta. Utilizamos as melhores práticas de segurança do mercado.
                </p>
              </div>
            </div>
          </div>

          {/* Coluna Direita - Summary - COR ALTERADA AQUI */}
          <div className="lg:col-span-1">
            <div className="bg-[#30302E] rounded-xl p-6 border border-gray-800 sticky top-6">
              <h3 className="text-lg font-bold text-white mb-6">Resumo</h3>

              <div className="space-y-4 mb-6 pb-6 border-b border-gray-800">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Plano</span>
                  <span className="font-medium text-white">{planName}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Valor Original</span>
                  <span className="font-medium text-white">R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>

                {appliedCoupon && (
                  <div className="flex justify-between text-sm text-green-500 animate-fade-in">
                    <span className="font-medium flex items-center gap-1">
                      <Ticket size={12} />
                      Desconto ({appliedCoupon.code})
                    </span>
                    <span className="font-bold">- R$ {discount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Taxa</span>
                  <span className="font-medium text-white">R$ 0,00</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Duração</span>
                  <span className="font-medium text-white">{billingCycle === 'annual' ? 'Anual' : 'Mensal'}</span>
                </div>
              </div>

              {/* Coupon Input */}
              <div className="mb-6">
                <label className="block text-xs font-semibold text-gray-400 mb-2">Cupom de Desconto</label>
                {!appliedCoupon ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Código"
                      className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 h-10 text-white text-sm focus:border-[#d97757] focus:outline-none uppercase"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={!couponCode || isValidatingCoupon}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-3 rounded-lg font-medium text-sm disabled:opacity-50 transition-colors"
                    >
                      {isValidatingCoupon ? <Loader2 size={16} className="animate-spin" /> : 'Aplicar'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-lg p-2.5 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <div className="bg-green-500 rounded-full p-0.5">
                        <Check size={10} className="text-black" />
                      </div>
                      <span className="text-green-500 font-bold text-sm tracking-wide">{appliedCoupon.code}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center mb-6">
                <span className="text-lg font-bold text-white">Total</span>
                <div className="text-right">
                  <span className="text-2xl font-bold text-[#d97757]">
                    {installments > 1
                      ? `${installments}x R$ ${(finalPrice / installments).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : `R$ ${finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    }
                  </span>
                  {installments > 1 && (
                    <div className="text-xs text-gray-400 mt-1">
                      Total: R$ {finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-[#d97757] hover:bg-[#c56a4d] text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#d97757]/20"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : "Confirmar Pagamento"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
