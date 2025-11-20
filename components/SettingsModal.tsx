
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, User, Mail, Check, Save, Sparkles, Shield, CreditCard, 
  Bell, Download, Trash2, Upload, Smartphone, 
  CheckCircle, Copy, FileText, ChevronRight, ArrowLeft
} from 'lucide-react';
import { User as UserType, Transaction } from '../types';
import { useToasts } from './Toast';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType;
  onUpdateUser: (user: UserType) => void;
  transactions?: Transaction[]; 
}

const AVATAR_GRADIENTS = [
  'bg-gradient-to-br from-[#d97757] to-orange-600',
  'bg-gradient-to-br from-purple-600 to-blue-600',
  'bg-gradient-to-br from-emerald-500 to-teal-600',
  'bg-gradient-to-br from-gray-600 to-gray-800',
  'bg-gradient-to-br from-pink-500 to-rose-500',
  'bg-gradient-to-br from-indigo-500 to-cyan-500',
];

type SettingsTab = 'account' | 'security' | 'plan' | 'notifications' | 'data';

// --- COMPONENTE TWO FACTOR MODAL (Extraído para evitar re-renders) ---
interface TwoFactorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    userEmail: string;
    secretKey: string;
    qrCodeUrl: string;
}

const TwoFactorModal: React.FC<TwoFactorModalProps> = ({ isOpen, onClose, onSuccess, userEmail, secretKey, qrCodeUrl }) => {
    const [step, setStep] = useState<'setup' | 'verify'>('setup');
    const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const toast = useToasts();

    // Animation Logic
    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            setStep('setup');
            setOtp(new Array(6).fill(""));
            requestAnimationFrame(() => requestAnimationFrame(() => setIsAnimating(true)));
        } else {
            setIsAnimating(false);
            setTimeout(() => setIsVisible(false), 300);
        }
    }, [isOpen]);

    // Focus first input when entering verify step
    useEffect(() => {
        if (step === 'verify' && isVisible) {
            setTimeout(() => {
                inputRefs.current[0]?.focus();
            }, 100);
        }
    }, [step, isVisible]);

    const handleOtpChange = (element: HTMLInputElement, index: number) => {
        if (isNaN(Number(element.value))) return false;

        const newOtp = [...otp];
        newOtp[index] = element.value;
        setOtp(newOtp);

        // Focus next input
        if (element.value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === "Backspace") {
            if (!otp[index] && index > 0) {
                inputRefs.current[index - 1]?.focus();
                const newOtp = [...otp];
                newOtp[index] = ""; // Clear current
                newOtp[index - 1] = ""; // Clear previous logic optional, usually just focus back
                // Standard behavior: just focus back if empty, or clear current if not
                if (!otp[index]) {
                     // Focus back logic handled above
                }
            } else {
                const newOtp = [...otp];
                newOtp[index] = "";
                setOtp(newOtp);
                if (index > 0) inputRefs.current[index - 1]?.focus();
            }
        } else if (e.key === "ArrowLeft" && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === "ArrowRight" && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').slice(0, 6).split('');
        if (pastedData.some(char => isNaN(Number(char)))) return;
        
        const newOtp = [...otp];
        pastedData.forEach((char, i) => {
            if (i < 6) newOtp[i] = char;
        });
        setOtp(newOtp);
        inputRefs.current[Math.min(pastedData.length, 5) - 1]?.focus();
    };

    const verifyCode = () => {
        const code = otp.join('');
        if (code.length === 6) {
           onSuccess();
           setStep('setup'); // Reset for next time
        } else {
           toast.error("Código incompleto ou inválido.");
        }
    };

    const copySecret = () => {
        navigator.clipboard.writeText(secretKey);
        toast.success("Chave copiada!");
    };

    if (!isVisible) return null;

    return createPortal(
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-300 ease-in-out ${isAnimating ? 'bg-black/90 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-0'}`}>
            <div className={`bg-gray-950 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-800 flex flex-col relative transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}`}>
                
                {/* Background Effects */}
                <div className="absolute inset-0 pointer-events-none">
                   <div className="absolute top-0 right-0 w-40 h-40 bg-[#d97757]/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                   <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl -ml-10 -mb-10"></div>
                </div>

                <div className="p-6 border-b border-gray-800 flex justify-between items-center relative z-10 bg-gray-950/50">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#d97757]/20 rounded-lg text-[#d97757]">
                         <Smartphone size={20} />
                      </div>
                      <h3 className="font-bold text-white">Autenticação em 2 Fatores</h3>
                   </div>
                   <button onClick={onClose} className="text-gray-500 hover:text-white p-1 rounded-full hover:bg-gray-800">
                      <X size={20} />
                   </button>
                </div>

                <div className="p-8 relative z-10 flex flex-col items-center text-center">
                    {step === 'setup' ? (
                        <>
                           <p className="text-sm text-gray-400 mb-6">
                              Abra seu aplicativo autenticador (Google Authenticator, Authy) e escaneie o código abaixo.
                           </p>

                           <div className="p-4 bg-white rounded-2xl shadow-lg mb-6 mx-auto">
                              {/* Mock QR Code Display */}
                              <img src={qrCodeUrl || "https://via.placeholder.com/150"} alt="QR Code" className="w-40 h-40 mix-blend-multiply" />
                           </div>

                           <div className="flex items-center gap-2 bg-gray-900 p-2.5 rounded-xl border border-gray-800 w-full mb-6">
                              <code className="flex-1 font-mono text-xs text-gray-400 truncate">{secretKey}</code>
                              <button onClick={copySecret} className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors" title="Copiar">
                                 <Copy size={14} />
                              </button>
                           </div>

                           <button 
                             onClick={() => setStep('verify')}
                             className="w-full py-3.5 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/20 flex items-center justify-center gap-2"
                           >
                             Escanear e Continuar <ChevronRight size={16} />
                           </button>
                        </>
                    ) : (
                        <>
                            <p className="text-sm text-gray-400 mb-8">
                                Insira o código de 6 dígitos gerado pelo seu aplicativo para confirmar.
                            </p>

                            <div className="flex justify-center gap-2 mb-8">
                                {otp.map((data, index) => (
                                    <input
                                        key={index}
                                        type="text"
                                        maxLength={1}
                                        ref={el => inputRefs.current[index] = el}
                                        value={data}
                                        onChange={e => handleOtpChange(e.target, index)}
                                        onKeyDown={e => handleKeyDown(e, index)}
                                        onPaste={handlePaste}
                                        className="w-12 h-14 bg-gray-900 border border-gray-700 rounded-xl text-center text-xl font-bold text-white focus:border-[#d97757] focus:ring-1 focus:ring-[#d97757] outline-none transition-all"
                                    />
                                ))}
                            </div>

                            <button 
                              onClick={verifyCode}
                              disabled={otp.join('').length !== 6}
                              className="w-full py-3.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              <CheckCircle size={18} /> Ativar Proteção
                            </button>
                            
                            <button 
                              onClick={() => setStep('setup')}
                              className="mt-4 text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1"
                            >
                              <ArrowLeft size={12} /> Voltar para QR Code
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- COMPONENTE PRINCIPAL SETTINGS ---

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, user, onUpdateUser, transactions = [] }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [formData, setFormData] = useState(user);
  const [isVisible, setIsVisible] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToasts();

  // 2FA State
  const [isTwoFactorModalOpen, setIsTwoFactorModalOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secretKey] = useState('JBSWY3DPEHPK3PXP'); // Mock Secret

  // Billing State (Mock Data)
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'pix'>('credit_card');

  // Mock Notifications
  const [notifications, setNotifications] = useState({ email: true, push: true, marketing: false });

  useEffect(() => {
    setFormData(user);
  }, [user, isOpen]);

  useEffect(() => {
      if(isOpen) setIsVisible(true);
      else setTimeout(() => {
        setIsVisible(false);
      }, 300);
  }, [isOpen]);

  if (!isVisible) return null;

  // --- HANDLERS ---
  const handleSave = () => {
    onUpdateUser(formData);
    toast.success("Perfil atualizado com sucesso!");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, avatarUrl: `bg-[url('${reader.result}')] bg-cover bg-center` });
        toast.success("Foto de perfil atualizada!");
      };
      reader.readAsDataURL(file);
    }
  };

  // --- 2FA HANDLERS ---
  const open2FAModal = () => {
    const label = encodeURIComponent("Finanças.ai Pro");
    const email = encodeURIComponent(user.email);
    const issuer = encodeURIComponent("Finanças.ai");
    const otpAuthUrl = `otpauth://totp/${label}:${email}?secret=${secretKey}&issuer=${issuer}`;
    
    // Mock QR Code generation
    setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpAuthUrl)}`);
    setIsTwoFactorModalOpen(true);
  };

  const handle2FASuccess = () => {
      onUpdateUser({ ...formData, twoFactorEnabled: true });
      setIsTwoFactorModalOpen(false);
      toast.success("Autenticação de 2 fatores ativada!");
  };

  const disable2FA = () => {
    onUpdateUser({ ...formData, twoFactorEnabled: false });
    toast.success("Autenticação de 2 fatores desativada.");
  };

  // --- DATA EXPORT ---
  const handleExportData = () => {
    if (transactions.length === 0) {
        toast.error("Sem dados para exportar.");
        return;
    }
    const headers = ["Data", "Descrição", "Categoria", "Valor", "Tipo", "Status"];
    const rows = transactions.map(t => [
        t.date, `"${t.description}"`, t.category, t.amount.toFixed(2), t.type, t.status
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "minhas_financas.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Download iniciado!");
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const renderSidebarItem = (id: SettingsTab, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
        activeTab === id 
          ? 'bg-[#d97757]/10 text-[#d97757] border border-[#d97757]/20' 
          : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`bg-gray-950 rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] border border-gray-800 flex overflow-hidden transition-all duration-300 transform ${isOpen ? 'translate-y-0 scale-100' : 'translate-y-10 scale-95'}`}>
        
        {/* Sidebar */}
        <div className="w-64 bg-gray-900 border-r border-gray-800 p-6 flex flex-col hidden md:flex">
           <h2 className="text-lg font-bold text-white mb-8 flex items-center gap-2 px-2">
             <div className="w-2 h-2 rounded-full bg-[#d97757]"></div> Configurações
           </h2>
           <div className="space-y-1 flex-1">
              {renderSidebarItem('account', 'Minha Conta', <User size={18} />)}
              {renderSidebarItem('security', 'Segurança', <Shield size={18} />)}
              {renderSidebarItem('plan', 'Planos e Assinatura', <CreditCard size={18} />)}
              {renderSidebarItem('notifications', 'Notificações', <Bell size={18} />)}
              {renderSidebarItem('data', 'Dados e Privacidade', <Download size={18} />)}
           </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-950 relative">
           {/* Mobile Header */}
           <div className="md:hidden p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900">
              <h2 className="font-bold text-white">Configurações</h2>
              <button onClick={onClose} className="text-gray-500"><X size={24}/></button>
           </div>
           
           {/* Desktop Close */}
           <div className="hidden md:flex justify-end p-6 absolute top-0 right-0 z-10">
              <button onClick={onClose} className="text-gray-500 hover:text-white p-2 rounded-full hover:bg-gray-800 transition-colors">
                <X size={20} />
              </button>
           </div>

           <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 lg:p-12">
              
              {/* --- TAB: ACCOUNT --- */}
              {activeTab === 'account' && (
                 <div className="space-y-10 animate-fade-in max-w-2xl">
                    <div>
                       <h3 className="text-3xl font-bold text-white mb-2">Minha Conta</h3>
                       <p className="text-gray-400">Gerencie suas informações pessoais.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 pb-8 border-b border-gray-800">
                       <div className="relative group shrink-0">
                          <div className={`w-32 h-32 rounded-full ${formData.avatarUrl || AVATAR_GRADIENTS[0]} flex items-center justify-center text-4xl font-bold text-white shadow-2xl ring-4 ring-gray-900 overflow-hidden`}>
                             {!formData.avatarUrl?.includes('url') && getInitials(formData.name)}
                          </div>
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute bottom-1 right-1 p-2.5 bg-gray-800 border border-gray-700 rounded-full text-white hover:bg-[#d97757] transition-colors shadow-lg group-hover:scale-110"
                          >
                             <Upload size={18} />
                          </button>
                          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                       </div>
                       <div className="flex-1 space-y-4 w-full">
                          <div className="grid md:grid-cols-2 gap-6">
                             <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-400 ml-1">Nome</label>
                                <input 
                                  type="text"
                                  value={formData.name}
                                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                                  className="input-primary"
                                />
                             </div>
                             <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-400 ml-1">E-mail</label>
                                <input 
                                  type="email"
                                  value={formData.email}
                                  disabled
                                  className="input-primary opacity-60 cursor-not-allowed"
                                />
                             </div>
                          </div>
                          <button 
                             onClick={handleSave}
                             className="px-6 py-2 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/20 flex items-center gap-2 text-sm"
                          >
                             <Save size={16} /> Salvar
                          </button>
                       </div>
                    </div>
                 </div>
              )}

              {/* --- TAB: SECURITY --- */}
              {activeTab === 'security' && (
                 <div className="space-y-10 animate-fade-in max-w-2xl">
                    <div>
                       <h3 className="text-3xl font-bold text-white mb-2">Segurança</h3>
                       <p className="text-gray-400">Proteja sua conta.</p>
                    </div>

                    <div className={`p-6 border rounded-2xl transition-all ${formData.twoFactorEnabled ? 'bg-green-900/10 border-green-900/30' : 'bg-gray-900/30 border-gray-800'}`}>
                        <div className="flex items-center justify-between mb-4">
                             <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${formData.twoFactorEnabled ? 'bg-green-500/20 text-green-500' : 'bg-gray-800 text-gray-400'}`}>
                                   <Smartphone size={20}/>
                                </div>
                                <div>
                                    <h4 className="text-white font-bold">Autenticação de 2 Fatores</h4>
                                    <p className="text-xs text-gray-500 mt-0.5">Camada extra de proteção.</p>
                                </div>
                             </div>
                             {formData.twoFactorEnabled && (
                                <div className="flex items-center gap-2 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">
                                    <CheckCircle size={14} className="text-green-500" />
                                    <span className="text-xs font-bold text-green-500">Ativo</span>
                                </div>
                             )}
                        </div>
                        <div className="pl-[52px]">
                           {formData.twoFactorEnabled ? (
                              <button onClick={disable2FA} className="text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-900/20 px-4 py-2 rounded-lg transition-colors border border-transparent hover:border-red-900/30">
                                 Desativar
                              </button>
                           ) : (
                              <button onClick={open2FAModal} className="text-sm font-bold text-white bg-[#d97757] hover:bg-[#c56a4d] px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-[#d97757]/20">
                                 Configurar Agora
                              </button>
                           )}
                        </div>
                    </div>
                 </div>
              )}

              {/* --- TAB: PLANS (IMPLEMENTATION REQUESTED) --- */}
              {activeTab === 'plan' && (
                 <div className="space-y-8 animate-fade-in">
                    <div>
                        <h3 className="text-3xl font-bold text-white mb-2">Planos e Assinatura</h3>
                        <p className="text-gray-400">Detalhes do seu plano atual e forma de pagamento.</p>
                    </div>

                    <div className="grid md:grid-cols-1 gap-6">
                        {/* PLANO ATUAL - DESTAQUE */}
                        <div className="bg-gradient-to-r from-[#d97757]/20 to-gray-900 border border-[#d97757]/30 rounded-2xl p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-[#d97757] text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">VIGENTE</div>
                            
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-3 bg-[#d97757] rounded-xl text-white shadow-lg">
                                    <Sparkles size={24} />
                                </div>
                                <div>
                                    <p className="text-xs text-[#d97757] font-bold uppercase tracking-wide mb-1">Seu Plano</p>
                                    <h4 className="text-3xl font-bold text-white">Finanças Pro</h4>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-white/10">
                                <div>
                                    <p className="text-gray-400 text-xs uppercase font-bold mb-1">Ciclo de Cobrança</p>
                                    <p className="text-white font-medium">Anual (R$ 299,90/ano)</p>
                                </div>
                                <div>
                                    <p className="text-gray-400 text-xs uppercase font-bold mb-1">Próxima Renovação</p>
                                    <p className="text-white font-medium">15 de Outubro, 2025</p>
                                </div>
                            </div>
                        </div>

                        {/* DADOS DO PAGAMENTO - CARTÃO/PIX ABAIXO */}
                        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                             <div className="flex items-center justify-between mb-6">
                                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                   <CreditCard size={20} className="text-gray-400"/> Método de Pagamento
                                </h4>
                                <button className="text-xs text-[#d97757] hover:text-white transition-colors font-bold uppercase">Alterar</button>
                             </div>

                             {/* Visualização condicional (Mockada para exemplo, mas estrutura pronta) */}
                             {paymentMethod === 'credit_card' ? (
                                 <div className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
                                     <div className="w-12 h-8 bg-gray-700 rounded flex items-center justify-center text-xs font-bold text-white">VISA</div>
                                     <div>
                                         <p className="text-sm font-bold text-white">•••• •••• •••• 4242</p>
                                         <p className="text-xs text-gray-500">Expira em 12/28</p>
                                     </div>
                                     <div className="ml-auto">
                                         <span className="text-[10px] bg-green-900/30 text-green-400 px-2 py-0.5 rounded border border-green-900/50">Padrão</span>
                                     </div>
                                 </div>
                             ) : (
                                 <div className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
                                     <div className="w-12 h-8 bg-gray-700 rounded flex items-center justify-center text-xs font-bold text-white">PIX</div>
                                     <div>
                                         <p className="text-sm font-bold text-white">Pagamento Instantâneo</p>
                                         <p className="text-xs text-gray-500">Chave CPF cadastrada</p>
                                     </div>
                                 </div>
                             )}

                             {/* Histórico Breve */}
                             <div className="mt-6 pt-6 border-t border-gray-800">
                                <p className="text-xs font-bold text-gray-500 uppercase mb-3">Última Fatura</p>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-300">15/10/2024</span>
                                    <span className="font-mono text-white">R$ 299,90</span>
                                    <span className="text-green-400 text-xs font-bold flex items-center gap-1"><CheckCircle size={12}/> Pago</span>
                                </div>
                             </div>
                        </div>
                    </div>
                 </div>
              )}

              {/* --- TAB: NOTIFICATIONS --- */}
              {activeTab === 'notifications' && (
                 <div className="space-y-10 animate-fade-in max-w-2xl">
                    <div>
                       <h3 className="text-3xl font-bold text-white mb-2">Notificações</h3>
                       <p className="text-gray-400">Controle o que você recebe.</p>
                    </div>
                    <div className="space-y-0 divide-y divide-gray-800 border border-gray-800 rounded-2xl bg-gray-900/30 overflow-hidden">
                       {[
                          { id: 'email', label: 'E-mails de Resumo', desc: 'Balanço semanal.' },
                          { id: 'push', label: 'Notificações Push', desc: 'Alertas de contas.' },
                       ].map((item) => (
                          <div key={item.id} className="p-6 flex items-center justify-between hover:bg-gray-900/50 transition-colors">
                             <div className="pr-4">
                                <h4 className="text-white font-bold text-base">{item.label}</h4>
                                <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
                             </div>
                             <button 
                                onClick={() => setNotifications({...notifications, [item.id]: !notifications[item.id as keyof typeof notifications]})}
                                className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${notifications[item.id as keyof typeof notifications] ? 'bg-[#d97757]' : 'bg-gray-700'}`}
                             >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${notifications[item.id as keyof typeof notifications] ? 'translate-x-6' : 'translate-x-1'}`}/>
                             </button>
                          </div>
                       ))}
                    </div>
                 </div>
              )}

              {/* --- TAB: DATA --- */}
              {activeTab === 'data' && (
                 <div className="space-y-10 animate-fade-in max-w-2xl">
                    <div>
                       <h3 className="text-3xl font-bold text-white mb-2">Dados</h3>
                       <p className="text-gray-400">Exporte ou apague seus registros.</p>
                    </div>
                    <button 
                        onClick={handleExportData}
                        className="w-full p-4 border border-gray-800 rounded-2xl bg-gray-900/30 flex items-center justify-between hover:bg-gray-900 transition-colors"
                    >
                        <div>
                            <h4 className="text-white font-bold flex items-center gap-2"><Download size={18}/> Exportar CSV</h4>
                            <p className="text-sm text-gray-500">Baixar todas as transações.</p>
                        </div>
                        <div className="px-4 py-2 bg-gray-800 text-white text-sm font-bold rounded-lg">Baixar</div>
                    </button>
                 </div>
              )}

           </div>
        </div>
      </div>
      
      {/* Externalized 2FA Modal */}
      <TwoFactorModal 
          isOpen={isTwoFactorModalOpen} 
          onClose={() => setIsTwoFactorModalOpen(false)} 
          onSuccess={handle2FASuccess}
          userEmail={user.email}
          secretKey={secretKey}
          qrCodeUrl={qrCodeUrl}
      />
    </div>
  );
};
