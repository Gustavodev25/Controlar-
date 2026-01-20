import React, { useState, useEffect } from 'react';
import { Lock, Loader2, Ticket, X, Check, User, Mail, Phone, MapPin, Calendar, ChevronRight, ArrowLeft, FileText, Zap, ShieldCheck, Users, TrendingUp, Timer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import NumberFlow from '@number-flow/react';

import { useToasts } from './Toast';
import { CustomSelect, CustomDatePicker } from './UIComponents';
import * as dbService from '../services/database';
import { Button } from './Button';
import { Coupon } from '../types';
import { UniversalModal } from './UniversalModal';
import { usePixelEvent } from '../hooks/usePixelEvent';

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

// Dados de cadastro completo (quando requiresRegistration = true)
interface RegistrationData {
  name: string;
  email: string;
  password: string;
  cpf: string;
  birthDate: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface CheckoutFormProps {
  planName: string;
  price: number;
  billingCycle?: 'monthly' | 'annual';
  onSubmit: (cardData: CreditCardData, holderInfo: HolderInfo, installments?: number, couponId?: string, finalPrice?: number, registrationData?: RegistrationData) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
  initialCouponCode?: string;
  /** Se true, exibe step de cadastro antes do pagamento */
  requiresRegistration?: boolean;
}

const CheckoutTimer: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const target = new Date(now);
      target.setHours(24, 0, 0, 0); // Next midnight

      const difference = target.getTime() - now.getTime();
      if (difference > 0) {
        return {
          h: Math.floor((difference / (1000 * 60 * 60)) % 24),
          m: Math.floor((difference / 1000 / 60) % 60),
          s: Math.floor((difference / 1000) % 60),
        };
      }
      return { h: 0, m: 0, s: 0 };
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-1.5 text-white">
      <span className="text-base font-bold bg-[#D97757]/10 border border-[#D97757]/20 rounded px-2.5 py-1 text-[#D97757]">
        <NumberFlow value={timeLeft.h} format={{ minimumIntegerDigits: 2 }} />
      </span>
      <span className="text-xs font-bold text-[#D97757]">:</span>
      <span className="text-base font-bold bg-[#D97757]/10 border border-[#D97757]/20 rounded px-2.5 py-1 text-[#D97757]">
        <NumberFlow value={timeLeft.m} format={{ minimumIntegerDigits: 2 }} />
      </span>
      <span className="text-xs font-bold text-[#D97757]">:</span>
      <span className="text-base font-bold bg-[#D97757]/10 border border-[#D97757]/20 rounded px-2.5 py-1 text-[#D97757]">
        <NumberFlow value={timeLeft.s} format={{ minimumIntegerDigits: 2 }} />
      </span>
    </div>
  );
};

export const CheckoutForm: React.FC<CheckoutFormProps> = ({
  planName,
  price,
  billingCycle = 'monthly',
  onSubmit,
  onBack,
  isLoading,
  initialCouponCode,
  requiresRegistration = false
}) => {
  // Step: 'registration' ou 'payment'
  const [currentStep, setCurrentStep] = useState<'registration' | 'payment'>(
    requiresRegistration ? 'registration' : 'payment'
  );

  // Dados de cadastro
  const [registrationData, setRegistrationData] = useState<RegistrationData>({
    name: '',
    email: '',
    password: '',
    cpf: '',
    birthDate: '',
    phone: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: ''
  });

  const [showAddressFields, setShowAddressFields] = useState(false);
  const [isCepLoading, setIsCepLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

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

  // Estado para cartão de teste admin
  const [isTestCard, setIsTestCard] = useState(false);

  // Dados do cartão de teste que passam na validação Luhn (número de teste válido)
  const TEST_CARD_DATA: CreditCardData = {
    holderName: 'ADMIN TESTE',
    number: '4532015112830366', // Número válido que passa no Luhn
    expiryMonth: '12',
    expiryYear: (new Date().getFullYear() + 2).toString(),
    ccv: '123'
  };

  const TEST_HOLDER_INFO: HolderInfo = {
    name: 'Admin Teste',
    email: 'admin@controlar.app',
    cpfCnpj: '52998224725', // CPF válido para teste
    postalCode: '01310100',
    addressNumber: '1000',
    phone: '11999999999'
  };

  // Função para usar cartão de teste
  const handleUseTestCard = () => {
    setCardData(TEST_CARD_DATA);
    setHolderInfo(TEST_HOLDER_INFO);
    setIsTestCard(true);
  };

  // Coupon State
  const [couponCode, setCouponCode] = useState(initialCouponCode || '');
  const [spotsLeft, setSpotsLeft] = useState(3);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);


  useEffect(() => {
    if (initialCouponCode) {
      handleApplyCoupon(initialCouponCode);
    }
  }, [initialCouponCode]);

  const toast = useToasts();
  const { trackEvent } = usePixelEvent();

  // ===== FUNÇÕES DE FORMATAÇÃO =====
  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const formatCEP = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{3})\d+?$/, '$1');
  };

  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  // ===== VALIDAÇÕES =====
  const validateCPFChecksum = (cpf: string) => {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf === '') return false;
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let add = 0;
    for (let i = 0; i < 9; i++) add += parseInt(cpf.charAt(i)) * (10 - i);
    let rev = 11 - (add % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cpf.charAt(9))) return false;
    add = 0;
    for (let i = 0; i < 10; i++) add += parseInt(cpf.charAt(i)) * (11 - i);
    rev = 11 - (add % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cpf.charAt(10))) return false;
    return true;
  };

  // ===== BUSCA CEP =====
  const fetchCepData = async (cepValue: string) => {
    const cep = cepValue.replace(/\D/g, '');
    if (cep.length === 8) {
      setIsCepLoading(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setRegistrationData(prev => ({
            ...prev,
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf
          }));
          setShowAddressFields(true);
        } else {
          toast.error('CEP não encontrado.');
          setShowAddressFields(true);
        }
      } catch (err) {
        console.error("Erro ao buscar CEP:", err);
      } finally {
        setIsCepLoading(false);
      }
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const formatted = formatCEP(rawVal);
    setRegistrationData({ ...registrationData, cep: formatted });
    if (formatted.replace(/\D/g, '').length === 8) {
      fetchCepData(formatted);
    }
  };

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

  // Detect card brand from number
  const detectCardBrand = (number: string): { brand: string; color: string } | null => {
    const cleaned = number.replace(/\s/g, '');
    if (cleaned.length < 1) return null;

    // Visa: starts with 4
    if (/^4/.test(cleaned)) {
      return { brand: 'VISA', color: 'bg-blue-600' };
    }

    // Mastercard: 51-55 or 2221-2720
    if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) {
      return { brand: 'MASTER', color: 'bg-red-600' };
    }

    // Elo: Brazilian card with specific ranges
    if (/^(636368|636297|504175|438935|451416|636369|5067|4576|4011|509)/.test(cleaned)) {
      return { brand: 'ELO', color: 'bg-yellow-500' };
    }

    // Hipercard
    if (/^(606282|3841)/.test(cleaned)) {
      return { brand: 'HIPER', color: 'bg-orange-600' };
    }

    // Diners Club: 300-305, 36, 38
    if (/^3(?:0[0-5]|[68])/.test(cleaned)) {
      return { brand: 'DINERS', color: 'bg-gray-600' };
    }

    // Discover: 6011, 65, 644-649
    if (/^6(?:011|5|4[4-9])/.test(cleaned)) {
      return { brand: 'DISCOVER', color: 'bg-orange-500' };
    }

    // JCB: 35
    if (/^35/.test(cleaned)) {
      return { brand: 'JCB', color: 'bg-green-600' };
    }

    return null;
  };

  const detectedBrand = detectCardBrand(cardData.number);

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

  const handleApplyCoupon = async (codeToValidate?: string) => {
    const code = codeToValidate || couponCode;
    if (!code) return;

    setIsValidatingCoupon(true);
    try {
      const result = await dbService.validateCoupon(code.toUpperCase());

      if (result.isValid && result.coupon) {
        setAppliedCoupon(result.coupon);
        toast.success("Cupom aplicado com sucesso!");
      } else {
        setAppliedCoupon(null);
        toast.error(result.error || "Cupom inválido.");
      }
    } catch (error: any) {
      console.error("Erro detalhado ao validar cupom:", error);
      toast.error(`Erro ao validar cupom: ${error.message || error}`);
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
      if (appliedCoupon.type === 'progressive') {
        // For progressive coupons, use month 1 discount for first subscription
        const month1Rule = appliedCoupon.progressiveDiscounts?.find(d => d.month === 1);
        if (month1Rule) {
          if (month1Rule.discountType === 'fixed') {
            discount = month1Rule.discount;
          } else {
            // Default to percentage
            discount = price * (month1Rule.discount / 100);
          }
        }
      } else if (appliedCoupon.type === 'percentage') {
        discount = price * (appliedCoupon.value / 100);
      } else {
        discount = appliedCoupon.value;
      }
      finalPrice = Math.max(0, price - discount);
    }

    return { finalPrice, discount };
  };

  const { finalPrice, discount } = calculateTotal();

  // ===== VALIDAÇÃO DO STEP DE CADASTRO =====
  const validateRegistrationStep = (): boolean => {
    if (!registrationData.name || !registrationData.email || !registrationData.password) {
      toast.error("Preencha nome, e-mail e senha.");
      return false;
    }
    if (registrationData.password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return false;
    }
    if (!validateCPFChecksum(registrationData.cpf)) {
      toast.error("CPF inválido.");
      return false;
    }
    if (!registrationData.birthDate || !registrationData.cep || !registrationData.street || !registrationData.number || !registrationData.city || !registrationData.state || !registrationData.phone) {
      toast.error("Preencha todos os campos obrigatórios.");
      return false;
    }
    if (registrationData.phone.replace(/\D/g, '').length < 10) {
      toast.error("Telefone inválido.");
      return false;
    }
    if (!acceptedTerms) {
      toast.error("Você precisa aceitar os Termos de Uso.");
      return false;
    }
    return true;
  };

  const handleContinueToPayment = () => {
    if (validateRegistrationStep()) {
      // Preencher holderInfo automaticamente com dados do cadastro
      setHolderInfo(prev => ({
        ...prev,
        name: registrationData.name,
        email: registrationData.email,
        cpfCnpj: registrationData.cpf,
        postalCode: registrationData.cep,
        addressNumber: registrationData.number,
        phone: registrationData.phone
      }));
      // Also pre-fill card holder name if empty
      if (!cardData.holderName) {
        setCardData(prev => ({ ...prev, holderName: registrationData.name.toUpperCase() }));
      }
      setCurrentStep('payment');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic required fields check
    if (!cardData.number || !cardData.holderName || !cardData.ccv || !holderInfo.cpfCnpj || !holderInfo.postalCode || !holderInfo.addressNumber || !holderInfo.phone) {
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

    // Validate Phone
    const validatePhone = (phone: string): boolean => {
      const cleaned = phone.replace(/\D/g, '');
      return cleaned.length >= 10 && cleaned.length <= 11;
    };

    if (!holderInfo.phone || !validatePhone(holderInfo.phone)) {
      toast.error("Telefone inválido. Informe DDD + Número.");
      return;
    }

    // If coupon used, increment usage
    if (appliedCoupon) {
      dbService.incrementCouponUsage(appliedCoupon.id, finalPrice);
    }

    // Determinar o preço final - se for cartão de teste admin, usar 0 para ativar sem cobrança
    const priceToSubmit = isTestCard ? 0 : finalPrice;
    const couponToSubmit = isTestCard ? 'ADMIN_TEST_CARD' : appliedCoupon?.id;

    // Meta Pixel: AddPaymentInfo (não rastrear se for cartão de teste)
    if (!isTestCard) {
      trackEvent('AddPaymentInfo', {
        value: finalPrice,
        currency: 'BRL',
        content_name: `Plano ${planName} - ${billingCycle === 'annual' ? 'Anual' : 'Mensal'}`,
        content_type: 'subscription',
        content_category: 'Assinatura',
      });
    }

    // Passar registrationData se requiresRegistration
    await onSubmit(
      cardData,
      { ...holderInfo, name: cardData.holderName },
      installments,
      couponToSubmit,
      priceToSubmit,
      requiresRegistration ? registrationData : undefined
    );
  };

  const inputStyle = "input-primary w-full bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757] text-[#faf9f5] placeholder-gray-500 h-11 transition-all";

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

  // ===== RENDERIZAÇÃO DO STEP DE CADASTRO =====
  const renderRegistrationStep = () => (
    <motion.div
      key="registration"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="p-6"
    >
      {/* Scarcity Banner */}


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda - Formulário de Cadastro */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-[24px] border border-white/10 p-8 relative overflow-hidden shadow-[0_8px_40px_-10px_rgba(0,0,0,0.6)]" style={{ backgroundColor: "rgba(10, 10, 10, 0.65)", backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)" }}>
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] contrast-125" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 backdrop-blur-md flex items-center justify-center text-white/90 text-sm font-bold">1</div>
              <h2 className="text-lg font-bold text-white">Crie sua conta</h2>
            </div>
            <p className="text-sm text-gray-400 mb-6 ml-11">Preencha seus dados para criar sua conta</p>

            <div className="space-y-4">
              {/* Nome, Email, Senha */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-2 ml-1">Nome Completo</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><User size={18} /></div>
                  <input
                    type="text"
                    value={registrationData.name}
                    onChange={(e) => setRegistrationData({ ...registrationData, name: e.target.value })}
                    placeholder="Seu nome completo"
                    className={`${inputStyle} pl-11`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-2 ml-1">E-mail</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><Mail size={18} /></div>
                  <input
                    type="email"
                    value={registrationData.email}
                    onChange={(e) => setRegistrationData({ ...registrationData, email: e.target.value })}
                    placeholder="seu@email.com"
                    className={`${inputStyle} pl-11`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-2 ml-1">Senha</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><Lock size={18} /></div>
                  <input
                    type="password"
                    value={registrationData.password}
                    onChange={(e) => setRegistrationData({ ...registrationData, password: e.target.value })}
                    placeholder="••••••••"
                    className={`${inputStyle} pl-11`}
                  />
                </div>
              </div>

              {/* CPF e Data de Nascimento */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-2 ml-1">CPF</label>
                  <input
                    type="text"
                    maxLength={14}
                    value={formatCPF(registrationData.cpf)}
                    onChange={(e) => setRegistrationData({ ...registrationData, cpf: e.target.value })}
                    placeholder="000.000.000-00"
                    className={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-2 ml-1">Data de Nascimento</label>
                  <CustomDatePicker
                    value={registrationData.birthDate}
                    onChange={(val) => setRegistrationData({ ...registrationData, birthDate: val })}
                    placeholder="dd/mm/aaaa"
                    dropdownMode="fixed"
                  />
                </div>
              </div>

              {/* CEP e Telefone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-2 ml-1">CEP</label>
                  <input
                    type="text"
                    maxLength={9}
                    value={registrationData.cep}
                    onChange={handleCepChange}
                    placeholder="00000-000"
                    className={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-2 ml-1">Telefone / WhatsApp</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><Phone size={18} /></div>
                    <input
                      type="text"
                      maxLength={15}
                      value={formatPhone(registrationData.phone)}
                      onChange={(e) => setRegistrationData({ ...registrationData, phone: e.target.value })}
                      placeholder="(00) 90000-0000"
                      className={`${inputStyle} pl-11`}
                    />
                  </div>
                </div>
              </div>

              {/* Campos de endereço (aparecem após CEP) */}
              <AnimatePresence>
                {showAddressFields && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4 overflow-hidden">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-gray-300 mb-2 ml-1">Rua</label>
                        <input
                          type="text"
                          value={registrationData.street}
                          onChange={(e) => setRegistrationData({ ...registrationData, street: e.target.value })}
                          className={inputStyle}
                        />
                      </div>
                      <div className="w-24">
                        <label className="block text-xs font-semibold text-gray-300 mb-2 ml-1">Número</label>
                        <input
                          type="text"
                          value={registrationData.number}
                          onChange={(e) => setRegistrationData({ ...registrationData, number: e.target.value })}
                          className={inputStyle}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-2 ml-1">Cidade</label>
                        <input
                          type="text"
                          value={registrationData.city}
                          onChange={(e) => setRegistrationData({ ...registrationData, city: e.target.value })}
                          className={inputStyle}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-2 ml-1">Estado</label>
                        <input
                          type="text"
                          value={registrationData.state}
                          onChange={(e) => setRegistrationData({ ...registrationData, state: e.target.value })}
                          className={inputStyle}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Termos de Uso */}
              <div
                className="flex items-center gap-2 pt-2 cursor-pointer group"
                onClick={() => setAcceptedTerms(!acceptedTerms)}
              >
                <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all border ${acceptedTerms ? 'bg-[#d97757] border-[#d97757] text-white' : 'bg-[#1A1A19] border-gray-700 text-transparent group-hover:border-gray-600'}`}>
                  <Check size={12} strokeWidth={4} />
                </div>
                <span className="text-xs text-gray-400 select-none group-hover:text-gray-300 transition-colors">
                  Li e aceito os <button type="button" onClick={(e) => { e.stopPropagation(); setShowTerms(true); }} className="text-[#d97757] hover:underline font-medium">Termos de Uso</button> do sistema.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna Direita - Resumo */}
        <div className="lg:col-span-1">
          <div className="rounded-[24px] border border-white/10 p-8 relative overflow-hidden shadow-[0_8px_40px_-10px_rgba(0,0,0,0.6)] sticky top-6" style={{ backgroundColor: "rgba(10, 10, 10, 0.65)", backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)" }}>
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] contrast-125" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />

            {/* Guarantee Tag Flush Top */}
            <div className="-mt-8 -mx-8 bg-[#00A96E]/10 border-b border-[#00A96E]/10 p-3 flex items-center justify-center gap-2 mb-8">
              <ShieldCheck size={14} className="text-[#00A96E]/80" fill="currentColor" fillOpacity={0.2} />
              <span className="text-[#00A96E]/90 text-xs font-bold uppercase tracking-wide">
                Garantia de 15 DIAS ou seu dinheiro de volta
              </span>
            </div>

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
                <span className="text-gray-400">Duração</span>
                <span className="font-medium text-white">{billingCycle === 'annual' ? 'Anual' : 'Mensal'}</span>
              </div>
            </div>



            <div className="flex justify-between items-center mb-6">
              <span className="text-lg font-bold text-white">Total</span>
              <span className="text-2xl font-bold text-[#d97757]">
                R$ {finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <button
              type="button"
              onClick={handleContinueToPayment}
              disabled={isLoading}
              className="w-full h-12 bg-[#d97757] hover:bg-[#c56a4d] text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#d97757]/20"
            >
              Continuar para Pagamento
              <ChevronRight size={18} />
            </button>

            <button
              type="button"
              onClick={onBack}
              className="w-full mt-3 h-10 text-gray-400 hover:text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} />
              Voltar
            </button>
          </div>
        </div>
      </div>

      {/* Terms Modal */}
      <UniversalModal
        isOpen={showTerms}
        onClose={() => setShowTerms(false)}
        title="Termos de Uso"
        subtitle="Leia com atenção antes de continuar"
        icon={<FileText size={24} />}
      >
        <div className="space-y-6 text-gray-300 leading-relaxed text-sm max-h-[60vh] overflow-y-auto no-scrollbar">
          <h3 className="text-xl font-bold text-white mb-4">TERMOS DE USO – CONTROLAR+</h3>

          <section>
            <h4 className="font-bold text-white mb-2 text-base">1. Aceitação dos Termos</h4>
            <p>Controlar Mais LTDA ("Controlar+"), pessoa jurídica de direito privado, com sede em São Bernardo do Campo/SP, disponibiliza ao usuário ("Usuário") a plataforma de gestão financeira Controlar+, acessível por meio de aplicativo mobile, web e/ou demais interfaces.</p>
            <p className="mt-2">Ao se cadastrar, acessar ou utilizar a Controlar+, o Usuário declara ter lido, compreendido e aceito integralmente estes Termos de Uso, incluindo a Política de Privacidade que integra este documento. A utilização contínua da plataforma após atualizações dos Termos implica aceitação das novas condições.</p>
          </section>

          <section>
            <h4 className="font-bold text-white mb-2 text-base">2. Descrição do Serviço</h4>
            <p>A Controlar+ oferece ferramentas digitais para:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Acompanhamento e organização de finanças pessoais</li>
              <li>Consolidação de contas bancárias e de pagamento via Open Finance</li>
              <li>Categorização automática de despesas e receitas</li>
              <li>Visualização de dashboards e relatórios financeiros</li>
              <li>Criação e acompanhamento de metas financeiras</li>
              <li>Lembretes e notificações de pagamentos</li>
              <li>Utilização da assistente virtual "Coinzinha" para auxílio, insights e orientações de caráter informativo</li>
            </ul>

            <h5 className="font-bold text-white mt-4 mb-2">2.1 Escopo e Limitações</h5>
            <p>A Controlar+ atua como ferramenta de apoio à organização e acompanhamento financeiro pessoal. Eventuais orientações, simulações, conteúdos educativos ou sugestões fornecidas pela plataforma e pela Coinzinha possuem caráter informativo e educacional, não configurando consultoria financeira, contábil, jurídica, tributária ou de investimentos personalizada.</p>
            <p className="mt-2">O Usuário reconhece que:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>As recomendações e conteúdos da Controlar+ não garantem resultados financeiros, econômicos ou de rentabilidade</li>
              <li>Não substituem análise individualizada realizada por profissional habilitado e licenciado</li>
              <li>Determinadas decisões financeiras, especialmente aquelas envolvendo produtos de investimento, câmbio ou operações sujeitas a regulação da CVM (Comissão de Valores Mobiliários), devem ser realizadas com orientação de consultor ou assessor especializado</li>
              <li>A exatidão de dados financeiros provenientes de instituições financeiras parceiras e integrações de Open Finance depende de tais terceiros e pode estar sujeita a atrasos, divergências ou falhas de sincronização</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-white mb-2 text-base">3. Planos de Serviço</h4>
            <p>A Controlar+ oferece diferentes planos:</p>
            <p className="mt-2"><strong>Plano Free:</strong> acesso a funcionalidades básicas de organização manual de finanças, sem integração de Open Finance e sem armazenamento de dados de cartão de pagamento.</p>
            <p className="mt-2"><strong>Plano Pro e Plano Family:</strong> acesso a funcionalidades avançadas, incluindo integração Open Finance, automações, relatórios detalhados e demais recursos indicados na plataforma. Sujeitos a cobrança recorrente mensal.</p>
            <p className="mt-2">As características, funcionalidades, preços, períodos de teste, descontos promocionais e limites de cada plano serão informados na própria plataforma e podem ser atualizados pela Controlar+ a qualquer tempo, com notificação prévia ao Usuário.</p>
          </section>

          <section>
            <h4 className="font-bold text-white mb-2 text-base">4. Cadastro e Elegibilidade</h4>
            <p>Para utilizar a Controlar+, o Usuário deverá:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Ser maior de 18 (dezoito) anos de idade</li>
              <li>Fornecer dados verdadeiros, completos e atualizados no formulário de cadastro, incluindo nome, CPF, CEP, e-mail e telefone</li>
              <li>Aceitar e manter atualizada sua senha/credenciais de acesso, sendo responsável por manter sigilo e não compartilhá-las</li>
              <li>Responsabilizar-se por todas as ações e operações realizadas em sua conta</li>
            </ul>
            <p className="mt-2">O Usuário se compromete a comunicar imediatamente a Controlar+ em caso de uso indevido, acesso não autorizado, comprometimento de credenciais ou qualquer atividade suspeita em sua conta.</p>
          </section>

          <section>
            <h4 className="font-bold text-white mb-2 text-base">5. Cobrança e Assinatura</h4>
            <h5 className="font-bold text-white mt-2 mb-1">5.1 Planos Pagos</h5>
            <p>Os Planos Pro e Family estão sujeitos a cobrança recorrente mensal, realizada por meio de parceiros de pagamento como a plataforma Asaas ou equivalentes.</p>

            <h5 className="font-bold text-white mt-4 mb-1">5.2 Armazenamento de Dados de Cartão</h5>
            <p>Somente em Planos Pro/Family, a Controlar+ poderá armazenar dados de cartão de pagamento do Usuário de forma criptografada e segura, exclusivamente para processamento de cobranças recorrentes de assinatura.</p>
            <p className="mt-2">No Plano Free, nenhum dado de cartão será armazenado ou coletado.</p>

            <h5 className="font-bold text-white mt-4 mb-1">5.3 Renovação e Cancelamento</h5>
            <p>As assinaturas dos Planos Pro serão renovadas automaticamente ao final de cada período, salvo cancelamento prévio pelo Usuário.</p>
            <p className="mt-2">Ao cancelar uma assinatura:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>O Usuário poderá optar por migrar para o Plano Free, mantendo sua conta e dados</li>
              <li>Ou solicitar a exclusão definitiva da conta e dos dados pessoais associados</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-white mb-2 text-base">6. Restrições de Uso</h4>
            <p>O Usuário compromete-se a utilizar a Controlar+ apenas para fins lícitos e pessoais, sendo vedado:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Violar leis, regulamentações, direitos de terceiros ou políticas de segurança da plataforma</li>
              <li>Tentar contornar, desabilitar ou comprometer mecanismos de segurança, criptografia ou proteção</li>
              <li>Realizar engenharia reversa, decompilação ou acesso não autorizado ao código-fonte</li>
              <li>Compartilhar credenciais ou dar acesso a terceiros não autorizados</li>
              <li>Utilizar a plataforma para fins comerciais, revenda de serviços ou exploração econômica sem autorização expressa</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-white mb-2 text-base">7. Suspensão e Encerramento</h4>
            <p>A Controlar+ poderá, a seu exclusivo critério e sem aviso prévio, suspender ou encerrar a conta do Usuário em caso de:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Violação destes Termos de Uso ou da Política de Privacidade</li>
              <li>Detecção de atividades fraudulentas, não autorizadas ou ilícitas</li>
              <li>Violação de direitos de terceiros</li>
              <li>Exigência de autoridade legal, ordem judicial ou regulatória</li>
              <li>Inatividade prolongada</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-white mb-2 text-base">8. Direitos de Propriedade Intelectual</h4>
            <p>Todos os conteúdos, funcionalidades e elementos da Controlar+ são protegidos por direitos autorais, marcas registradas e demais direitos de propriedade intelectual.</p>
            <p className="mt-2">O Usuário recebe licença limitada, não exclusiva, intransferível e revogável para uso pessoal da plataforma.</p>
          </section>

          <section>
            <h4 className="font-bold text-white mb-2 text-base">9. Isenções e Limitações de Responsabilidade</h4>
            <p>A Controlar+ é disponibilizada "no estado atual" ("as is"), sem garantias expressas ou implícitas de disponibilidade, segurança, exatidão, adequação para fim específico ou não violação de direitos.</p>
          </section>

          <section>
            <h4 className="font-bold text-white mb-2 text-base">10. Dados Pessoais e Privacidade</h4>
            <p>A coleta, uso, armazenamento e proteção de dados pessoais do Usuário observará a Política de Privacidade, que integra estes Termos de Uso e deve ser lida atentamente.</p>
            <p className="mt-2">A Controlar+ atua como Controladora de Dados, em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 – LGPD).</p>
          </section>

          <section>
            <h4 className="font-bold text-white mb-2 text-base">11. Legislação e Foro</h4>
            <p>Estes Termos de Uso são regidos pela legislação brasileira. Fica eleito o foro da comarca de São Bernardo do Campo/SP como competente para dirimir quaisquer controvérsias decorrentes destes Termos.</p>
          </section>

          <div className="border-t border-gray-700 my-8"></div>

          <h3 className="text-xl font-bold text-white mb-4">POLÍTICA DE PRIVACIDADE – CONTROLAR+</h3>

          <section>
            <h4 className="font-bold text-white mb-2 text-base">Dados Pessoais Tratados</h4>
            <p>A Controlar+ poderá coletar e tratar os seguintes dados pessoais:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Dados Cadastrais: Nome completo, CPF, CEP, Endereço</li>
              <li>Dados de Contato: E-mail, Telefone</li>
              <li>Dados de Acesso e Uso: Histórico de login, padrões de navegação</li>
              <li>Dados Financeiros: Informações de contas bancárias, transações, saldos</li>
              <li>Dados Técnicos: Endereço IP, tipo de navegador, cookies</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-white mb-2 text-base">Direitos do Titular de Dados</h4>
            <p>Nos termos da LGPD, o Usuário poderá exercer direitos como:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Direito de Confirmação e Acesso</li>
              <li>Direito de Correção</li>
              <li>Direito à Portabilidade</li>
              <li>Direito à Exclusão</li>
              <li>Direito de Oposição</li>
              <li>Direito de Revogação de Consentimento</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-white mb-2 text-base">Contato e Suporte</h4>
            <p>Para dúvidas sobre esta Política de Privacidade:</p>
            <div className="mt-2 bg-[#272725]/50 p-4 rounded-lg border border-[#373734]">
              <p className="font-bold text-white">Encarregado de Proteção de Dados (DPO)</p>
              <p className="text-gray-400">E-mail: <span className="text-[#d97757]">rafael.maldanis@controlarmais.com.br</span></p>
              <p className="text-gray-400 mt-2">Controlar Mais LTDA</p>
              <p className="text-gray-400">São Bernardo do Campo/SP - Brasil</p>
            </div>
          </section>

          <div className="text-xs text-gray-500 mt-8 pt-4 border-t border-gray-800">
            <p>Versão: 1.0</p>
          </div>
        </div>
      </UniversalModal>
    </motion.div>
  );

  // ===== RENDERIZAÇÃO DO STEP DE PAGAMENTO =====
  const renderPaymentStep = () => (
    <motion.div
      key="payment"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="p-6"
    >


      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Coluna Esquerda - Formulário */}
          <div className="lg:col-span-2 space-y-6">

            {/* Payment Detail */}
            <div className="rounded-[24px] border border-white/10 p-8 relative overflow-hidden shadow-[0_8px_40px_-10px_rgba(0,0,0,0.6)]" style={{ backgroundColor: "#30302E", backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)" }}>
              <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] contrast-125" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />
              <div className="flex items-center gap-3 mb-1">
                {requiresRegistration && (
                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 backdrop-blur-md flex items-center justify-center text-white/90 text-sm font-bold">2</div>
                )}
                <h2 className="text-lg font-bold text-white">Informações de Pagamento</h2>
              </div>
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-gray-400 ml-11">Preencha os dados do seu cartão de crédito</p>
                {/* Botão secreto para admin usar cartão de teste */}

              </div>

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
                    {detectedBrand && (
                      <div className={`absolute right-3 top-1/2 -translate-y-1/2 ${detectedBrand.color} text-white text-xs font-bold px-2 py-0.5 rounded transition-all`}>
                        {detectedBrand.brand}
                      </div>
                    )}
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
                      portal={true}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-2 ml-1">Ano</label>
                    <CustomSelect
                      value={cardData.expiryYear}
                      onChange={(value) => setCardData(prev => ({ ...prev, expiryYear: value }))}
                      options={yearOptions}
                      placeholder="AAAA"
                      portal={true}
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
                      portal={true}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Security Notice */}
            <div className="rounded-[24px] border border-white/10 p-6 relative overflow-hidden shadow-[0_8px_40px_-10px_rgba(0,0,0,0.6)] flex gap-4 mb-6" style={{ backgroundColor: "#30302E", backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)" }}>
              <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] contrast-125" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />
              <div className="text-green-500 shrink-0 mt-0.5 relative z-10">
                <Lock size={20} />
              </div>
              <div className="relative z-10">
                <h3 className="font-bold text-white mb-2">Pagamento Seguro</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Seus dados são protegidos com criptografia de ponta a ponta. Utilizamos as melhores práticas de segurança do mercado.
                </p>
              </div>
            </div>

            {/* Social Proof */}
            <div className="flex items-center gap-3 justify-center text-xs text-gray-500 mt-2">
              <div className="flex -space-x-2">
                {[
                  "https://randomuser.me/api/portraits/women/44.jpg",
                  "https://randomuser.me/api/portraits/men/32.jpg",
                  "https://randomuser.me/api/portraits/women/65.jpg",
                  "https://randomuser.me/api/portraits/men/86.jpg"
                ].map((src, i) => (
                  <div key={i} className="w-6 h-6 rounded-full border-2 border-[#121212] flex items-center justify-center overflow-hidden bg-gray-800">
                    <img src={src} alt="User" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              <span><strong className="text-white">Mais de 1.200</strong> pessoas já assinaram essa semana.</span>
            </div>
          </div>

          {/* Coluna Direita - Summary */}
          <div className="lg:col-span-1">
            <div className="rounded-[24px] border border-white/10 p-8 relative overflow-hidden shadow-[0_8px_40px_-10px_rgba(0,0,0,0.6)] sticky top-6" style={{ backgroundColor: "#30302E", backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)" }}>
              <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] contrast-125" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />

              {/* Guarantee Tag Flush Top */}
              <div className="-mt-8 -mx-8 bg-[#00A96E]/10 border-b border-[#00A96E]/10 p-3 flex items-center justify-center gap-2 mb-8">
                <ShieldCheck size={14} className="text-[#00A96E]/80" fill="currentColor" fillOpacity={0.2} />
                <span className="text-[#00A96E]/90 text-xs font-bold uppercase tracking-wide">
                  Garantia de 15 DIAS ou seu dinheiro de volta
                </span>
              </div>

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

              {/* Coupon Input - Only for monthly plans */}
              {billingCycle === 'monthly' && (
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-gray-400 mb-2">Cupom de Desconto</label>
                  {!appliedCoupon ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="Código"
                        className={`${inputStyle} flex-1 uppercase`}
                      />
                      <Button
                        type="button"
                        onClick={() => handleApplyCoupon()}
                        disabled={!couponCode || isValidatingCoupon}
                        isLoading={isValidatingCoupon}
                        className="w-auto px-6 shadow-none"
                      >
                        Aplicar
                      </Button>
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
              )}



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
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Processando...
                  </>
                ) : (
                  "Confirmar pagamento"
                )}
              </button>

              {requiresRegistration && (
                <button
                  type="button"
                  onClick={() => setCurrentStep('registration')}
                  className="w-full mt-3 h-10 text-gray-400 hover:text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={16} />
                  Voltar para Cadastro
                </button>
              )}

              {!requiresRegistration && (
                <button
                  type="button"
                  onClick={onBack}
                  className="w-full mt-3 h-10 text-gray-400 hover:text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={16} />
                  Voltar
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
    </motion.div>
  );

  return (
    <AnimatePresence mode="wait">
      {currentStep === 'registration' ? renderRegistrationStep() : renderPaymentStep()}
    </AnimatePresence>
  );
};
