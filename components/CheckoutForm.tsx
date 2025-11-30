import React, { useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { useToasts } from './Toast';
import { CustomSelect } from './UIComponents';

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
  onSubmit: (cardData: CreditCardData, holderInfo: HolderInfo) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
}

export const CheckoutForm: React.FC<CheckoutFormProps> = ({ planName, price, onSubmit, onBack, isLoading }) => {
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

  const toast = useToasts();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardData.number || !cardData.holderName || !cardData.ccv || !holderInfo.cpfCnpj || !holderInfo.postalCode || !holderInfo.addressNumber) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    await onSubmit(cardData, { ...holderInfo, name: cardData.holderName });
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

  return (
    <div className="p-6">
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Coluna Esquerda - Formulário */}
          <div className="lg:col-span-2 space-y-6">

            {/* Payment Detail */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
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
              </div>
            </div>

            {/* Security Notice */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex gap-4">
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

          {/* Coluna Direita - Summary */}
          <div className="lg:col-span-1">
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 sticky top-6">
              <h3 className="text-lg font-bold text-white mb-6">Resumo</h3>

              <div className="space-y-4 mb-6 pb-6 border-b border-gray-800">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Plano</span>
                  <span className="font-medium text-white">{planName}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Valor</span>
                  <span className="font-medium text-white">R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Taxa</span>
                  <span className="font-medium text-white">R$ 0,00</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Duração</span>
                  <span className="font-medium text-white">Mensal</span>
                </div>
              </div>

              <div className="flex justify-between items-center mb-6">
                <span className="text-lg font-bold text-white">Total</span>
                <span className="text-2xl font-bold text-[#d97757]">R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
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