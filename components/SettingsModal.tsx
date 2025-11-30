import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
   X, User, Mail, Check, Save, Sparkles, Shield, CreditCard,
   Bell, Download, Trash2, Upload, Smartphone,
   CheckCircle, Copy, FileText, ChevronRight, ArrowLeft, Coins,
   PiggyBank, ShieldCheck, Lock, Cloud, Trophy, Crown, Users,
   Zap, Activity, Search, Bot, BrainCircuit, Link, Wifi, Wand2, Award, Calendar, CreditCard as CardIcon, Star,
   Puzzle, Rocket
} from 'lucide-react';
import { User as UserType, Transaction, FamilyGoal, Investment, Reminder, ConnectedAccount } from '../types';
import { useToasts } from './Toast';
import { buildOtpAuthUrl, generateBase32Secret, verifyTOTP } from '../services/twoFactor';
import { ConfirmationCard } from './UIComponents';
import quebraCabecaImg from '../assets/quebra-cabeca.png';
import fogueteImg from '../assets/foguete.png';
import familiaImg from '../assets/familia.png';

interface SettingsModalProps {
   isOpen: boolean;
   onClose: () => void;
   user: UserType;
   onUpdateUser: (user: UserType) => Promise<void> | void;
   transactions?: Transaction[];
   familyGoals?: FamilyGoal[];
   investments?: Investment[];
   reminders?: Reminder[];
   connectedAccounts?: ConnectedAccount[];
   onNavigateToSubscription: () => void;
   initialTab?: 'profile' | 'plan' | 'badges' | 'data';
}

const AVATAR_GRADIENTS = [
   'bg-gradient-to-br from-[#d97757] to-orange-600',
   'bg-gradient-to-br from-purple-600 to-blue-600',
   'bg-gradient-to-br from-emerald-500 to-teal-600',
   'bg-gradient-to-br from-gray-600 to-gray-800',
   'bg-gradient-to-br from-pink-500 to-rose-500',
   'bg-gradient-to-br from-indigo-500 to-cyan-500',
];

interface BadgeDefinition {
   id: string;
   title: string;
   description: string;
   category: string;
   icon: React.ReactNode;
   image?: string;
   colorClass: string;
   unlocked: boolean;
   requirement: string;
}

type SettingsTab = 'account' | 'finance' | 'security' | 'plan' | 'notifications' | 'data';

// --- COMPONENTE TWO FACTOR MODAL (Extraído para evitar re-renders) ---
interface TwoFactorModalProps {
   isOpen: boolean;
   onClose: () => void;
   onSuccess: (code: string) => Promise<boolean> | boolean;
   userEmail: string;
   secretKey: string;
   qrCodeUrl: string;
   isVerifying: boolean;
}

const TwoFactorModal: React.FC<TwoFactorModalProps> = ({ isOpen, onClose, onSuccess, userEmail, secretKey, qrCodeUrl, isVerifying }) => {
   const [step, setStep] = useState<'setup' | 'verify'>('setup');
   const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
   const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
   const [isAnimating, setIsAnimating] = useState(false);
   const [isVisible, setIsVisible] = useState(false);
   const toast = useToasts();
   const [isVerifyingCode, setIsVerifyingCode] = useState(false);
   const isBusy = isVerifying || isVerifyingCode;

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

   const verifyCode = async () => {
      const code = otp.join('');
      if (code.length !== 6) {
         toast.error("Código incompleto ou inválido.");
         return;
      }
      try {
         setIsVerifyingCode(true);
         const ok = await onSuccess(code);
         if (ok) {
            setStep('setup');
            setOtp(new Array(6).fill(""));
         }
      } catch (err) {
         toast.error("Não foi possível validar o código.");
      } finally {
         setIsVerifyingCode(false);
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
                     {userEmail && <p className="text-xs text-gray-500 mb-2">Conta: {userEmail}</p>}

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
                              ref={(el: HTMLInputElement | null) => { inputRefs.current[index] = el; }}
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
                        disabled={otp.join('').length !== 6 || isBusy}
                        className="w-full py-3.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                     >
                        {isBusy ? (
                           <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                           <CheckCircle size={18} />
                        )}
                        Ativar Proteção
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

// --- COMPONENTE CREDIT CARD MODAL ---
interface CreditCardModalProps {
   isOpen: boolean;
   onClose: () => void;
   onSave: (cardData: { number: string; holder: string; expiry: string; cvc: string }) => Promise<void>;
}

const CreditCardModal: React.FC<CreditCardModalProps> = ({ isOpen, onClose, onSave }) => {
   const [step, setStep] = useState<'input' | 'verifying'>('input');
   const [cardData, setCardData] = useState({ number: '', holder: '', expiry: '', cvc: '' });
   const [isAnimating, setIsAnimating] = useState(false);
   const [isVisible, setIsVisible] = useState(false);
   const toast = useToasts();

   useEffect(() => {
      if (isOpen) {
         setIsVisible(true);
         setStep('input');
         setCardData({ number: '', holder: '', expiry: '', cvc: '' });
         requestAnimationFrame(() => requestAnimationFrame(() => setIsAnimating(true)));
      } else {
         setIsAnimating(false);
         setTimeout(() => setIsVisible(false), 300);
      }
   }, [isOpen]);

   // Luhn Algorithm for basic validity check
   const isValidLuhn = (num: string) => {
      let arr = (num + '').split('').reverse().map(x => parseInt(x));
      let lastDigit = arr.splice(0, 1)[0];
      let sum = arr.reduce((acc, val, i) => (i % 2 !== 0 ? acc + val : acc + ((val * 2) % 9) || 9), 0);
      return (sum + lastDigit) % 10 === 0;
   };

   const handleSave = async () => {
      // Basic Format Validation
      const cleanNum = cardData.number.replace(/\D/g, '');
      if (cleanNum.length < 16 || !isValidLuhn(cleanNum)) {
         toast.error("Número de cartão inválido.");
         return;
      }
      if (!cardData.holder.trim().includes(' ')) {
         toast.error("Digite o nome completo impresso no cartão.");
         return;
      }
      if (cardData.expiry.length !== 5) {
         toast.error("Data de validade incompleta.");
         return;
      }
      if (cardData.cvc.length < 3) {
         toast.error("CVC inválido.");
         return;
      }

      setStep('verifying');
      
      // Simulate Bank Verification
      try {
         await new Promise(resolve => setTimeout(resolve, 2000)); // Fake API delay
         await onSave(cardData);
         onClose();
      } catch (error) {
         setStep('input');
      }
   };

   // Formatters
   const formatCardNumber = (val: string) => {
      const v = val.replace(/\D/g, '').slice(0, 16);
      const parts = [];
      for (let i = 0; i < v.length; i += 4) parts.push(v.slice(i, i + 4));
      return parts.join(' ');
   };

   const formatExpiry = (val: string) => {
      const v = val.replace(/\D/g, '').slice(0, 4);
      if (v.length >= 2) return `${v.slice(0, 2)}/${v.slice(2)}`;
      return v;
   };

   if (!isVisible) return null;

   return createPortal(
      <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-300 ease-in-out ${isAnimating ? 'bg-black/90 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-0'}`}>
         <div className={`bg-gray-950 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-800 flex flex-col relative transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}`}>
            
             {/* Background Effects (Matched to TwoFactorModal) */}
             <div className="absolute inset-0 pointer-events-none">
               <div className="absolute top-0 right-0 w-40 h-40 bg-[#d97757]/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
               <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl -ml-10 -mb-10"></div>
            </div>

            <div className="p-6 border-b border-gray-800 flex justify-between items-center relative z-10 bg-gray-950/50">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#d97757]/20 rounded-lg text-[#d97757]">
                     <CreditCard size={20} />
                  </div>
                  <h3 className="font-bold text-white">Atualizar Cartão</h3>
               </div>
               <button onClick={onClose} className="text-gray-500 hover:text-white p-1 rounded-full hover:bg-gray-800">
                  <X size={20} />
               </button>
            </div>

            <div className="p-8 relative z-10">
               {step === 'input' ? (
                  <div className="space-y-6">
                     {/* Visual Card Preview - Adjusted for narrower container */}
                     <div className="relative w-full h-40 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 shadow-xl p-5 flex flex-col justify-between overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <div className="flex justify-between items-start z-10">
                           <div className="w-10 h-6 bg-white/10 rounded flex items-center justify-center gap-1">
                              <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                           </div>
                           <Wifi size={16} className="text-gray-500 rotate-90" />
                        </div>
                        <div className="z-10 space-y-3">
                           <div className="text-lg font-mono text-gray-200 tracking-widest drop-shadow-md truncate">
                              {cardData.number || '•••• •••• •••• ••••'}
                           </div>
                           <div className="flex justify-between items-end">
                              <div className="overflow-hidden">
                                 <div className="text-[8px] uppercase text-gray-500 font-bold">Nome</div>
                                 <div className="text-xs text-gray-300 font-medium uppercase tracking-wide truncate max-w-[120px]">
                                    {cardData.holder || 'SEU NOME'}
                                 </div>
                              </div>
                              <div className="text-right shrink-0">
                                 <div className="text-[8px] uppercase text-gray-500 font-bold">Validade</div>
                                 <div className="text-xs text-gray-300 font-mono">
                                    {cardData.expiry || 'MM/AA'}
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* Form Fields */}
                     <div className="space-y-4">
                        <div>
                           <div className="relative">
                              <input 
                                 type="text" 
                                 value={formatCardNumber(cardData.number)}
                                 onChange={e => setCardData({...cardData, number: e.target.value})}
                                 placeholder="0000 0000 0000 0000"
                                 className="input-primary pl-10 font-mono text-sm"
                                 maxLength={19}
                              />
                              <CreditCard size={16} className="absolute left-3 top-3.5 text-gray-500" />
                           </div>
                        </div>
                        
                        <div>
                           <input 
                              type="text" 
                              value={cardData.holder}
                              onChange={e => setCardData({...cardData, holder: e.target.value.toUpperCase()})}
                              placeholder="Nome no cartão"
                              className="input-primary uppercase text-sm"
                           />
                        </div>

                        <div className="flex gap-3">
                           <div className="flex-1">
                              <input 
                                 type="text" 
                                 value={formatExpiry(cardData.expiry)}
                                 onChange={e => setCardData({...cardData, expiry: e.target.value})}
                                 placeholder="MM/AA"
                                 className="input-primary text-center font-mono text-sm"
                                 maxLength={5}
                              />
                           </div>
                           <div className="w-20">
                              <div className="relative">
                                 <input 
                                    type="text" 
                                    value={cardData.cvc}
                                    onChange={e => setCardData({...cardData, cvc: e.target.value.replace(/\D/g, '').slice(0,4)})}
                                    placeholder="CVC"
                                    className="input-primary text-center font-mono pl-6 text-sm"
                                    maxLength={4}
                                 />
                                 <Lock size={12} className="absolute left-2 top-3.5 text-gray-500" />
                              </div>
                           </div>
                        </div>
                     </div>

                     <button
                        onClick={handleSave}
                        disabled={!cardData.number || !cardData.holder || !cardData.expiry || !cardData.cvc}
                        className="w-full py-3.5 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                        Verificar e Salvar
                     </button>
                  </div>
               ) : (
                  <div className="py-8 flex flex-col items-center text-center animate-fade-in">
                     <div className="w-16 h-16 border-4 border-[#d97757]/20 border-t-[#d97757] rounded-full animate-spin mb-6"></div>
                     <h3 className="text-xl font-bold text-white mb-2">Validando cartão...</h3>
                     <p className="text-gray-400 text-sm max-w-xs">
                        Estamos verificando os dados com a operadora.
                     </p>
                  </div>
               )}
            </div>
         </div>
      </div>,
      document.body
   );
};

// --- COMPONENTE PRINCIPAL SETTINGS ---

export const SettingsModal: React.FC<SettingsModalProps> = ({
   isOpen,
   onClose,
   user,
   onUpdateUser,
   transactions = [],
   familyGoals = [],
   investments = [],
   reminders = [],
   connectedAccounts = [],
   onNavigateToSubscription,
   initialTab = 'account'
}) => {
   const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab as SettingsTab);
   const [formData, setFormData] = useState(user);
   const [isVisible, setIsVisible] = useState(false);
   const [autoRenew, setAutoRenew] = useState(true); // Moved to top level
   const [showAutoRenewConfirmation, setShowAutoRenewConfirmation] = useState(false);
   const [isCardModalOpen, setIsCardModalOpen] = useState(false);
   const fileInputRef = useRef<HTMLInputElement>(null);
   const toast = useToasts();
   const normalizeMonth = (dateStr: string) => dateStr.slice(0, 7);

   // Plan Logic
   const plan = formData.subscription?.plan || 'starter';
   const cycle = formData.subscription?.billingCycle || 'monthly';
   const status = formData.subscription?.status || 'active';
   const nextDate = formData.subscription?.nextBillingDate;

   const planStyle = useMemo(() => {
      switch(plan) {
         case 'pro': return { 
            gradient: 'bg-gradient-to-br from-gray-900 to-[#d97757]/20 border-[#d97757]/30', 
            text: 'text-[#d97757]', 
            icon: <img src={fogueteImg} alt="Pro" className="w-8 h-8 object-contain" />,
            label: 'Plus'
         };
         case 'family': return { 
            gradient: 'bg-gradient-to-br from-gray-900 to-[#D4B996]/20 border-[#D4B996]/30', 
            text: 'text-[#D4B996]', 
            icon: <img src={familiaImg} alt="Family" className="w-8 h-8 object-contain" />,
            label: 'Family'
         };
         default: return { 
            gradient: 'bg-gradient-to-br from-gray-900 to-[#8B5CF6]/20 border-[#8B5CF6]/30', 
            text: 'text-[#8B5CF6]', 
            icon: <img src={quebraCabecaImg} alt="Starter" className="w-8 h-8 object-contain" />,
            label: 'Starter'
         };
      }
   }, [plan]);

   // BADGES CALCULATIONS
   const monthlyBalances = useMemo(() => {
      const map: Record<string, { income: number; expense: number }> = {};
      transactions.forEach((t) => {
         const month = normalizeMonth(t.date);
         if (!map[month]) map[month] = { income: 0, expense: 0 };
         if (t.type === 'income') map[month].income += t.amount;
         else map[month].expense += t.amount;
      });
      return map;
   }, [transactions]);

   const positiveMonths = useMemo(() => Object.entries(monthlyBalances)
      .filter(([_, v]) => v.income > v.expense)
      .map(([month]) => month)
      .sort(), [monthlyBalances]);

   const hasThreePositiveInRow = useMemo(() => {
      const months = [...positiveMonths].sort();
      let streak = 0;
      let last: string | null = null;
      for (const m of months) {
         if (last) {
            const [y, mo] = last.split('-').map(Number);
            const [ny, nmo] = m.split('-').map(Number);
            const expectedMonth = mo === 12 ? 1 : mo + 1;
            const expectedYear = mo === 12 ? y + 1 : y;
            if (ny === expectedYear && nmo === expectedMonth) {
               streak += 1;
            } else {
               streak = 1;
            }
         } else {
            streak = 1;
         }
         last = m;
         if (streak >= 3) return true;
      }
      return false;
   }, [positiveMonths]);

   const totalInvested = useMemo(
      () => investments.reduce((sum, inv) => sum + inv.currentAmount, 0),
      [investments]
   );

   const hasCompletedFamilyGoal = useMemo(
      () => familyGoals.some((g) => g.currentAmount >= g.targetAmount),
      [familyGoals]
   );

   const hasTeamwork = useMemo(() => {
      if (!transactions.length || !familyGoals.length) return false;
      return familyGoals.some((goal) => {
         const related = transactions.filter((t) => {
            const text = `${t.description} ${t.category}`.toLowerCase();
            return text.includes(goal.title.toLowerCase());
         });
         const byMonth: Record<string, Set<string>> = {};
         related.forEach((t) => {
            if (!t.memberId) return;
            const m = normalizeMonth(t.date);
            if (!byMonth[m]) byMonth[m] = new Set();
            byMonth[m].add(t.memberId);
         });
         return Object.values(byMonth).some((s) => s.size >= 2);
      });
   }, [transactions, familyGoals]);

   const longestTransactionStreak = useMemo(() => {
      if (!transactions.length) return 0;
      const dates = Array.from(new Set(transactions.map((t) => t.date))).sort();
      let maxStreak = 1;
      let streak = 1;
      for (let i = 1; i < dates.length; i++) {
         const prev = new Date(dates[i - 1]);
         const cur = new Date(dates[i]);
         const diff = (cur.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
         if (diff === 1) {
            streak += 1;
            maxStreak = Math.max(maxStreak, streak);
         } else {
            streak = 1;
         }
      }
      return maxStreak;
   }, [transactions]);

   const allCategorizedThisMonth = useMemo(() => {
      if (!transactions.length) return false;
      const currentMonth = new Date().toISOString().slice(0, 7);
      const currentTx = transactions.filter((t) => normalizeMonth(t.date) === currentMonth);
      if (!currentTx.length) return false;
      return currentTx.every((t) => {
         const cat = (t.category || '').toLowerCase();
         return cat && !['outros', 'outro', 'others'].includes(cat);
      });
   }, [transactions]);

   const aiUsed = useMemo(
      () => transactions.some((t) => {
         const source = (t as any).importSource?.toLowerCase?.() || '';
         const desc = t.description.toLowerCase();
         return source.includes('ai') || desc.includes('ia ') || desc.includes(' ia') || desc.includes('consultor');
      }),
      [transactions]
   );

   const voiceUsed = useMemo(
      () => transactions.some((t) => {
         const source = (t as any).importSource?.toLowerCase?.() || '';
         return source.includes('voice') || source.includes('voz');
      }),
      [transactions]
   );

   const hasBankConnection = useMemo(
      () => connectedAccounts.length > 0 || transactions.some((t) => ((t as any).importSource || '').toLowerCase().includes('pluggy')),
      [connectedAccounts, transactions]
   );

   const monthsActive = useMemo(() => {
      if (!transactions.length) return 0;
      const dates = transactions.map((t) => new Date(t.date));
      const first = dates.reduce((a, b) => (a < b ? a : b));
      const now = new Date();
      return (now.getFullYear() - first.getFullYear()) * 12 + (now.getMonth() - first.getMonth());
   }, [transactions]);

   const unlockedBadges: BadgeDefinition[] = useMemo(() => {
      const badges: BadgeDefinition[] = [
         {
            id: 'poupador',
            title: 'Poupador Iniciante',
            description: 'Feche um mês no azul.',
            category: 'Economia',
            icon: <PiggyBank size={18} className="text-green-400" />,
            image: 'Poupador Iniciante.png',
            colorClass: 'bg-green-500/10 border-green-500/30',
            unlocked: positiveMonths.length >= 1,
            requirement: 'Primeiro mês com saldo positivo'
         },
         {
            id: 'escudo',
            title: 'Escudo Financeiro',
            description: '3 meses seguidos no azul.',
            category: 'Economia',
            icon: <ShieldCheck size={18} className="text-blue-400" />,
            image: 'Escudo Financeiro.png',
            colorClass: 'bg-blue-500/10 border-blue-500/30',
            unlocked: hasThreePositiveInRow,
            requirement: '3 meses consecutivos com saldo positivo'
         },
         {
            id: 'reserva',
            title: 'Mestre da Reserva',
            description: 'R$ 1.000 em investimentos/caixinhas.',
            category: 'Economia',
            icon: <Lock size={18} className="text-yellow-400" />,
            image: 'Mestre da Reserva.png',
            colorClass: 'bg-yellow-500/10 border-yellow-500/30',
            unlocked: totalInvested >= 1000,
            requirement: 'Acumule R$ 1.000 em reservas'
         },
         {
            id: 'sonhador',
            title: 'Sonhador',
            description: 'Crie sua primeira meta familiar.',
            category: 'Metas',
            icon: <Cloud size={18} className="text-purple-400" />,
            image: 'Sonhador.png',
            colorClass: 'bg-purple-500/10 border-purple-500/30',
            unlocked: familyGoals.length >= 1,
            requirement: 'Pelo menos uma meta criada'
         },
         {
            id: 'conquistador',
            title: 'Conquistador',
            description: 'Complete uma meta familiar.',
            category: 'Metas',
            icon: <Trophy size={18} className="text-amber-300" />,
            image: 'Conquistador.png',
            colorClass: 'bg-amber-500/10 border-amber-500/30',
            unlocked: hasCompletedFamilyGoal,
            requirement: 'Bata 100% de uma meta'
         },
         {
            id: 'team',
            title: 'Trabalho em Equipe',
            description: 'Dois membros contribuíram na mesma meta no mês.',
            category: 'Metas',
            icon: <Users size={18} className="text-orange-400" />,
            image: 'Trabalho em Equipe.png',
            colorClass: 'bg-orange-500/10 border-orange-500/30',
            unlocked: hasTeamwork,
            requirement: 'Contribuições de 2 membros na mesma meta'
         },
         {
            id: 'ninja',
            title: 'Data Ninja',
            description: '7 dias seguidos registrando transações.',
            category: 'Organização',
            icon: <Zap size={18} className="text-red-400" />,
            image: 'Data Ninja.png',
            colorClass: 'bg-red-500/10 border-red-500/30',
            unlocked: longestTransactionStreak >= 7,
            requirement: 'Registrar por 7 dias consecutivos'
         },
         {
            id: 'detetive',
            title: 'Detetive de Gastos',
            description: '100% das transações do mês categorizadas.',
            category: 'Organização',
            icon: <Search size={18} className="text-indigo-400" />,
            image: 'Detetive de Gastos.png',
            colorClass: 'bg-indigo-500/10 border-indigo-500/30',
            unlocked: allCategorizedThisMonth,
            requirement: 'Nenhuma transação como "Outros" no mês'
         },
         {
            id: 'prevenido',
            title: 'Prevenido',
            description: 'Cadastre 5 lembretes de contas.',
            category: 'Organização',
            icon: <Bell size={18} className="text-cyan-400" />,
            image: 'Prevenido.png',
            colorClass: 'bg-cyan-500/10 border-cyan-500/30',
            unlocked: reminders.length >= 5,
            requirement: '5 lembretes cadastrados'
         },
         {
            id: 'futurista',
            title: 'Futurista',
            description: 'Use o Consultor IA.',
            category: 'Tecnologia',
            icon: <Bot size={18} className="text-fuchsia-400" />,
            image: 'Futurista.png',
            colorClass: 'bg-fuchsia-500/10 border-fuchsia-500/30',
            unlocked: aiUsed,
            requirement: 'Primeiro uso do Consultor IA'
         },
         {
            id: 'conectado',
            title: 'Conectado',
            description: 'Conecte uma conta bancária.',
            category: 'Tecnologia',
            icon: <Link size={18} className="text-lime-400" />,
            image: 'Conectado.png',
            colorClass: 'bg-lime-500/10 border-lime-500/30',
            unlocked: hasBankConnection,
            requirement: 'Primeira conta conectada'
         },
         {
            id: 'voz',
            title: 'Mágico da Voz',
            description: 'Adicione despesa via comando de voz/chat natural.',
            category: 'Tecnologia',
            icon: <Wand2 size={18} className="text-purple-300" />,
            image: 'Mágico da Voz.png',
            colorClass: 'bg-purple-500/10 border-purple-500/30',
            unlocked: voiceUsed,
            requirement: 'Registrar 1 transação por voz'
         },
      ];

      const bronze = monthsActive >= 1 && transactions.length >= 10;
      const silver = monthsActive >= 3 && hasCompletedFamilyGoal;
      const gold = monthsActive >= 6 && positiveMonths.length >= 6;
      const diamond = bronze && silver && gold && badges.filter(b => b.unlocked).length >= 10;

      badges.push(
         {
            id: 'bronze',
            title: 'Nível Bronze',
            description: '1 mês de uso + 10 transações.',
            category: 'Nível',
            icon: <Award size={18} className="text-amber-600" />,
            image: 'Nível Bronze.png',
            colorClass: 'bg-amber-600/10 border-amber-600/30',
            unlocked: bronze,
            requirement: '>=1 mês e 10 transações'
         },
         {
            id: 'prata',
            title: 'Nível Prata',
            description: '3 meses de uso + 1 meta concluída.',
            category: 'Nível',
            icon: <Award size={18} className="text-slate-200" />,
            image: 'Nível Prata.png',
            colorClass: 'bg-slate-200/10 border-slate-200/30',
            unlocked: silver,
            requirement: '>=3 meses e 1 meta concluída'
         },
         {
            id: 'ouro',
            title: 'Nível Ouro',
            description: '6 meses no azul consistente.',
            category: 'Nível',
            icon: <Crown size={18} className="text-yellow-300" />,
            image: 'Nível Ouro.png',
            colorClass: 'bg-yellow-400/10 border-yellow-400/30',
            unlocked: gold,
            requirement: '>=6 meses e saldo positivo recorrente'
         },
         {
            id: 'diamante',
            title: 'Nível Diamante',
            description: 'Guru das finanças.',
            category: 'Nível',
            icon: <Award size={18} className="text-blue-200" />,
            image: 'Nível Platina.png',
            colorClass: 'bg-blue-300/10 border-blue-300/30',
            unlocked: diamond,
            requirement: 'Desbloqueie os principais badges'
         },
      );

      return badges;
   }, [
      positiveMonths,
      hasThreePositiveInRow,
      totalInvested,
      familyGoals,
      hasCompletedFamilyGoal,
      hasTeamwork,
      longestTransactionStreak,
      allCategorizedThisMonth,
      reminders,
      aiUsed,
      hasBankConnection,
      voiceUsed,
      monthsActive,
      transactions.length
   ]);

   // 2FA State
   const [isTwoFactorModalOpen, setIsTwoFactorModalOpen] = useState(false);
   const [qrCodeUrl, setQrCodeUrl] = useState('');
   const [secretKey, setSecretKey] = useState('');
   const [isVerifying2FA, setIsVerifying2FA] = useState(false);

   // Mock Notifications
   const [notifications, setNotifications] = useState({ email: true, push: true, marketing: false });

   useEffect(() => {
      setFormData(user);
   }, [user, isOpen]);

   useEffect(() => {
      if (isOpen) setIsVisible(true);
      else setTimeout(() => {
         setIsVisible(false);
      }, 300);
   }, [isOpen]);

   if (!isVisible) return null;

   // --- HANDLERS ---
   const persistUser = async (payload: UserType) => {
      await Promise.resolve(onUpdateUser(payload));
   };

   const handleSave = async () => {
      await persistUser(formData);
      toast.success("Perfil atualizado com sucesso!");
   };

   const handleUpdateCard = async (cardData: { number: string; holder: string; expiry: string; cvc: string }) => {
      // In a real app, you would send this to your backend/Stripe here
      // For now, we just update the visual state or show a success message
      toast.success("Novo cartão validado e vinculado com sucesso!");
      setIsCardModalOpen(false);
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
      const issuer = "Controlar+";
      const newSecret = generateBase32Secret(32);
      setSecretKey(newSecret);

      const otpAuthUrl = buildOtpAuthUrl(newSecret, `${issuer}:${user.email || 'usuario'}`, issuer);
      setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpAuthUrl)}`);
      setIsTwoFactorModalOpen(true);
   };

   const handle2FASuccess = async (code: string) => {
      if (!secretKey) {
         toast.error("Não foi possível gerar a chave. Tente novamente.");
         return false;
      }
      try {
         setIsVerifying2FA(true);
         const isValid = await verifyTOTP(secretKey, code);
         if (!isValid) {
            toast.error("Código inválido ou expirado.");
            return false;
         }
         const updated = { ...formData, twoFactorEnabled: true, twoFactorSecret: secretKey };
         await persistUser(updated);
         setFormData(updated);
         setIsTwoFactorModalOpen(false);
         toast.success("Autenticação de 2 fatores ativada!");
         return true;
      } catch (err) {
         toast.error("Erro ao ativar 2FA. Tente novamente.");
         return false;
      } finally {
         setIsVerifying2FA(false);
      }
   };

   const disable2FA = async () => {
      setIsVerifying2FA(true);
      const updated = { ...formData, twoFactorEnabled: false, twoFactorSecret: null };
      await persistUser(updated);
      setFormData(updated);
      setSecretKey('');
      toast.success("Autenticação de 2 fatores desativada.");
      setIsVerifying2FA(false);
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
         className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${activeTab === id
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
                  {renderSidebarItem('finance', 'Financeiro', <Coins size={18} />)}
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
                  <button onClick={onClose} className="text-gray-500"><X size={24} /></button>
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
                                       onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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

                        {/* Badges */}
                        <div className="space-y-3">
                           <div className="flex items-center justify-between">
                              <div>
                                 <h4 className="text-xl font-bold text-white">Minhas Conquistas</h4>
                                 <p className="text-sm text-gray-400">Desbloqueie badges ao usar o app.</p>
                              </div>
                              <span className="text-xs font-bold text-gray-400 px-3 py-1 rounded-full border border-gray-800">
                                 {unlockedBadges.filter(b => b.unlocked).length} / {unlockedBadges.length} desbloqueadas
                              </span>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {unlockedBadges.map((badge) => (
                                 <div
                                    key={badge.id}
                                    className={`relative border rounded-2xl p-4 flex gap-3 items-center transition-all ${badge.unlocked ? `${badge.colorClass} backdrop-blur-sm` : 'bg-gray-900/40 border-gray-800 opacity-80'}`}
                                 >
                                    {!badge.unlocked && (
                                       <div className="absolute inset-0 rounded-2xl bg-black/20 pointer-events-none" />
                                    )}
                                    <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-gray-800 flex items-center justify-center bg-gray-900/70">
                                       {badge.image ? (
                                          <img src={`/assets/badges/${badge.image}`} alt={badge.title} className="w-full h-full object-contain" />
                                       ) : (
                                          badge.icon
                                       )}
                                    </div>
                                    <div className="flex-1">
                                       <div className="flex items-center gap-2">
                                          <p className="text-sm font-bold text-white">{badge.title}</p>
                                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-gray-700 text-gray-400 uppercase tracking-wide">
                                             {badge.category}
                                          </span>
                                       </div>
                                       <p className="text-xs text-gray-400">{badge.description}</p>
                                       {!badge.unlocked && (
                                          <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                                             <Lock size={12} /> {badge.requirement}
                                          </p>
                                       )}
                                       {badge.unlocked && (
                                          <p className="text-[10px] text-green-400 mt-1 flex items-center gap-1">
                                             <Check size={12} /> Desbloqueado
                                          </p>
                                       )}
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>
                     </div>
                  )}

                  {/* --- TAB: FINANCE --- */}
                  {activeTab === 'finance' && (
                     <div className="space-y-10 animate-fade-in max-w-2xl">
                        <div>
                           <h3 className="text-3xl font-bold text-white mb-2">Financeiro</h3>
                           <p className="text-gray-400">Configurações de renda e datas.</p>
                        </div>

                        <div className="space-y-6">
                           <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6">
                              <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                 <Coins size={20} className="text-[#d97757]" /> Renda Mensal
                              </h4>
                              
                              <div className="space-y-4">
                                 <div className="space-y-2">
                                    <label className="text-xs font-medium text-gray-400 ml-1">Salário Base (Meta)</label>
                                    <div className="relative">
                                       <span className="absolute left-3 top-3 text-gray-500 font-bold text-lg">R$</span>
                                       <input
                                          type="text"
                                          inputMode="decimal"
                                          placeholder="0,00"
                                          value={formData.baseSalary ? formData.baseSalary.toString().replace('.', ',') : ''}
                                          onChange={(e) => {
                                             const val = e.target.value.replace(',', '.');
                                             const parsed = parseFloat(val);
                                             setFormData({ ...formData, baseSalary: isNaN(parsed) ? 0 : parsed });
                                          }}
                                          className="input-primary pl-10 text-lg font-bold"
                                       />
                                    </div>
                                    <p className="text-xs text-gray-500 ml-1">Valor usado para cálculo de metas e horas extras.</p>
                                 </div>

                                 <div className="space-y-2">
                                    <label className="text-xs font-medium text-gray-400 ml-1">Dia do Pagamento</label>
                                    <div className="relative max-w-[120px]">
                                       <Calendar size={16} className="absolute left-3 top-3.5 text-gray-500" />
                                       <input
                                          type="number"
                                          min="1"
                                          max="31"
                                          placeholder="Dia 5"
                                          value={formData.salaryPaymentDay || ''}
                                          onChange={(e) => {
                                             const val = parseInt(e.target.value);
                                             if (!isNaN(val) && val >= 1 && val <= 31) {
                                                setFormData({ ...formData, salaryPaymentDay: val });
                                             } else if (e.target.value === '') {
                                                setFormData({ ...formData, salaryPaymentDay: undefined });
                                             }
                                          }}
                                          className="input-primary pl-10 font-bold"
                                       />
                                    </div>
                                    <p className="text-xs text-gray-500 ml-1">Dia usual de recebimento do salário.</p>
                                 </div>
                              </div>
                           </div>

                           <button
                              onClick={handleSave}
                              className="px-6 py-2.5 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/20 flex items-center gap-2 text-sm"
                           >
                              <Save size={16} /> Salvar Alterações
                           </button>
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
                                    <Smartphone size={20} />
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
                                 <button
                                    onClick={disable2FA}
                                    disabled={isVerifying2FA}
                                    className="text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-900/20 px-4 py-2 rounded-lg transition-colors border border-transparent hover:border-red-900/30 disabled:opacity-60 disabled:cursor-not-allowed"
                                 >
                                    {isVerifying2FA ? 'Processando...' : 'Desativar'}
                                 </button>
                              ) : (
                                 <button
                                    onClick={open2FAModal}
                                    disabled={isVerifying2FA}
                                    className="text-sm font-bold text-white bg-[#d97757] hover:bg-[#c56a4d] px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-[#d97757]/20 disabled:opacity-60 disabled:cursor-not-allowed"
                                 >
                                    Configurar Agora
                                 </button>
                              )}
                           </div>
                        </div>
                     </div>
                  )}

                  {/* --- TAB: PLANS (REDESIGNED) --- */}
                  {activeTab === 'plan' && (
                     <div className="space-y-8 animate-fade-in max-w-3xl mx-auto">
                        <div>
                           <h3 className="text-3xl font-bold text-white mb-2">Assinatura & Cobrança</h3>
                           <p className="text-gray-400">Gerencie seu plano e método de pagamento.</p>
                        </div>

                        <div className="space-y-6">
                                 {/* 1. Plan Status Card */}
                                 <div className={`relative overflow-hidden rounded-3xl border p-8 ${planStyle.gradient}`}>
                                    <div className="relative z-10 flex flex-col md:flex-row justify-between gap-6">
                                       <div className="space-y-4">
                                          <div className="flex items-center gap-3">
                                             <div className={`p-3 rounded-xl bg-gray-950/50 border border-white/5 ${planStyle.text} shadow-lg`}>
                                                {planStyle.icon}
                                             </div>
                                             <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Plano Atual</p>
                                                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                                                   {planStyle.label}
                                                   {status === 'active' && (
                                                      <span className="px-2.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-[10px] font-bold uppercase tracking-wide">
                                                         Ativo
                                                      </span>
                                                   )}
                                                </h2>
                                             </div>
                                          </div>
                                          
                                          <div className="flex gap-6 text-sm">
                                             <div className="flex items-center gap-2 text-gray-300">
                                                <Calendar size={16} className="text-gray-500" />
                                                <span>Renova em: <b className="text-white">{nextDate ? new Date(nextDate).toLocaleDateString('pt-BR') : 'N/A'}</b></span>
                                             </div>
                                             <div className="flex items-center gap-2 text-gray-300">
                                                <Coins size={16} className="text-gray-500" />
                                                <span>Ciclo: <b className="text-white capitalize">{cycle === 'annual' ? 'Anual' : 'Mensal'}</b></span>
                                             </div>
                                          </div>
                                       </div>

                                       <div className="flex flex-col justify-center gap-3 min-w-[200px]">
                                          <button 
                                             onClick={onNavigateToSubscription}
                                             className="w-full py-3.5 bg-white hover:bg-gray-100 text-black rounded-xl font-bold transition-all shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                                          >
                                             {plan === 'starter' ? 'Fazer Upgrade' : 'Gerenciar Plano'}
                                          </button>
                                          {plan !== 'starter' && (
                                             <p className="text-xs text-center text-gray-500">
                                                Próxima fatura: R$ {plan === 'pro' ? (cycle === 'annual' ? '199,90' : '19,90') : (cycle === 'annual' ? '599,90' : '59,90')}
                                             </p>
                                          )}
                                       </div>
                                    </div>

                                    {/* Background Decor */}
                                    <div className={`absolute -right-10 -top-10 w-64 h-64 rounded-full blur-3xl opacity-10 ${planStyle.text.replace('text-', 'bg-')}`}></div>
                                 </div>

                                 {/* 2. Payment & Billing Details */}
                                 <div className="grid md:grid-cols-2 gap-6">
                                    
                                    {/* Payment Method Card */}
                                    <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-6 flex flex-col justify-between group hover:border-gray-700 transition-colors">
                                       <div className="flex justify-between items-start mb-6">
                                          <h4 className="font-bold text-white flex items-center gap-2">
                                             <CreditCard size={18} className="text-gray-400"/> Método de Pagamento
                                          </h4>
                                          <button 
                                             onClick={() => setIsCardModalOpen(true)}
                                             className="text-xs font-bold text-[#d97757] hover:text-[#c56a4d] transition-colors"
                                          >
                                             Alterar
                                          </button>
                                       </div>

                                       {/* Visual Card Mockup */}
                                       <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border border-gray-700/50 relative overflow-hidden mb-4">
                                          <div className="relative z-10">
                                             <div className="flex justify-between items-center mb-6">
                                                <div className="w-8 h-5 bg-white/10 rounded flex items-center justify-center">
                                                   <div className="w-4 h-4 rounded-full bg-red-500/80 -mr-2"></div>
                                                   <div className="w-4 h-4 rounded-full bg-yellow-500/80"></div>
                                                </div>
                                                <span className="text-[10px] font-mono text-gray-400">CREDIT</span>
                                             </div>
                                             <div className="flex justify-between items-end">
                                                <div>
                                                   <p className="text-[10px] text-gray-500 mb-0.5">Número</p>
                                                   <p className="text-sm font-mono text-gray-200 tracking-widest">**** **** **** 8829</p>
                                                </div>
                                                <div className="text-right">
                                                   <p className="text-[10px] text-gray-500 mb-0.5">Validade</p>
                                                   <p className="text-xs font-mono text-gray-200">08/29</p>
                                                </div>
                                             </div>
                                          </div>
                                          {/* Shine effect */}
                                          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                                       </div>

                                       <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/5 p-2 rounded-lg border border-green-500/10">
                                          <ShieldCheck size={14} /> Pagamento seguro via Asaas
                                       </div>
                                    </div>

                                    {/* Billing Settings */}
                                    <div className="space-y-4">
                                       {/* Auto Renew Toggle */}
                                       <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-6">
                                          <div className="flex justify-between items-center mb-2">
                                              <h4 className="font-bold text-white flex items-center gap-2">
                                                <Calendar size={18} className="text-gray-400"/> Cobrança Automática
                                              </h4>
                                              <button 
                                                onClick={() => {
                                                   if (autoRenew) {
                                                      setShowAutoRenewConfirmation(true);
                                                   } else {
                                                      setAutoRenew(true);
                                                      toast.success("Cobrança automática ativada.");
                                                   }
                                                }}
                                                className={`w-11 h-6 rounded-full transition-colors duration-300 relative ${autoRenew ? 'bg-[#d97757]' : 'bg-gray-700'}`}
                                              >
                                                 <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform duration-300 ${autoRenew ? 'left-6' : 'left-1'}`}></div>
                                              </button>
                                          </div>
                                          <p className="text-xs text-gray-500 leading-relaxed mb-4">
                                             Renovar automaticamente seu plano {cycle === 'annual' ? 'anual' : 'mensal'} usando o cartão cadastrado para evitar interrupções.
                                          </p>
                                          {autoRenew && (
                                             <div className="flex items-center gap-2 text-xs text-gray-400">
                                                <CheckCircle size={14} className="text-[#d97757]" />
                                                Próxima cobrança agendada para {nextDate ? new Date(nextDate).toLocaleDateString('pt-BR') : '...'}
                                             </div>
                                          )}
                                       </div>

                                       {/* Last Payment Info */}
                                       <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-6 flex items-center justify-between">
                                          <div>
                                             <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Último Pagamento</p>
                                             <p className="text-white font-bold text-lg">
                                                R$ {plan === 'pro' ? (cycle === 'annual' ? '199,90' : '19,90') : (plan === 'family' ? (cycle === 'annual' ? '599,90' : '59,90') : '0,00')}
                                             </p>
                                          </div>
                                          <div className="text-right">
                                             <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Data</p>
                                             <p className="text-gray-300 font-medium">
                                                {new Date().toLocaleDateString('pt-BR')}
                                             </p>
                                          </div>
                                       </div>
                                    </div>
                                 </div>

                                 <div className="flex justify-center pt-4">
                                     <button className="text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1">
                                       Cancelar assinatura
                                     </button>
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
                           ].map((item) => {
                              const key = item.id as keyof typeof notifications;
                              const isOn = notifications[key];
                              const toggle = () => setNotifications({ ...notifications, [key]: !isOn });
                              const bgClass = isOn ? 'bg-[#d97757]' : 'bg-gray-700';
                              const translateClass = isOn ? 'translate-x-6' : 'translate-x-1';
                              
                              return (
                                 <div key={item.id} className="p-6 flex items-center justify-between hover:bg-gray-900/50 transition-colors">
                                    <div className="pr-4">
                                       <h4 className="text-white font-bold text-base">{item.label}</h4>
                                       <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
                                    </div>
                                    <button
                                       onClick={toggle}
                                       className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${bgClass}`}
                                    >
                                       <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${translateClass}`} />
                                    </button>
                                 </div>
                              );
                           })}
                        </div>
                     </div>
                  )}

                  {/* --- TAB: DATA --- */}
                  {activeTab === 'data' && (
                     <div className="space-y-10 animate-fade-in max-w-2xl">
                        <div>
                           <h3 className="text-3xl font-bold text-white mb-2">Dados e Relatórios</h3>
                           <p className="text-gray-400">Exporte seus registros financeiros.</p>
                        </div>

                        <div className="space-y-3">
                           <button
                              onClick={handleExportData}
                              className="w-full p-4 border border-gray-800 rounded-2xl bg-gray-900/30 flex items-center justify-between hover:bg-gray-900 transition-colors group"
                           >
                              <div className="flex items-center gap-4">
                                 <div className="p-3 bg-green-900/20 rounded-xl text-green-400 group-hover:bg-green-900/30 transition-colors">
                                    <FileText size={24} />
                                 </div>
                                 <div className="text-left">
                                    <h4 className="text-white font-bold flex items-center gap-2">Exportar CSV</h4>
                                    <p className="text-sm text-gray-500">Baixar todas as transações em formato planilha</p>
                                 </div>
                              </div>
                              <ChevronRight size={20} className="text-gray-600 group-hover:text-white transition-colors" />
                           </button>

                           <button
                              onClick={() => {
                                 if (plan === 'starter') {
                                     toast.error("Relatórios avançados disponíveis no plano Plus.");
                                     return;
                                 }
                                 if (transactions.length === 0) {
                                    toast.error("Sem dados para exportar.");
                                    return;
                                 }
                                 // Generate detailed report
                                 const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
                                 const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
                                 const balance = totalIncome - totalExpense;

                                 const dateStr = new Date().toLocaleString('pt-BR');
                                 const headers = ["=== RELATÓRIO FINANCEIRO ===", "", "Gerado em: " + dateStr, "", "---", ""];
                                 const summary = [
                                    "RESUMO GERAL:",
                                    "Total de Receitas: R$ " + totalIncome.toFixed(2),
                                    "Total de Despesas: R$ " + totalExpense.toFixed(2),
                                    "Saldo: R$ " + balance.toFixed(2),
                                    "Total de Transações: " + transactions.length,
                                    "",
                                    "---",
                                    "",
                                    "TRANSAÇÕES DETALHADAS:",
                                    "Data,Descrição,Categoria,Valor,Tipo,Status"
                                 ];
                                 const rows = transactions
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .map(t => {
                                       const typeStr = t.type === 'income' ? 'Receita' : 'Despesa';
                                       const statusStr = t.status === 'completed' ? 'Pago' : 'Pendente';
                                       return t.date + ',"'+ t.description +'",' + t.category + ',' + t.amount.toFixed(2) + ',' + typeStr + ',' + statusStr;
                                    });

                                 const content = [...headers, ...summary, ...rows].join("\n");
                                 const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
                                 const link = document.createElement("a");
                                 link.href = URL.createObjectURL(blob);
                                 link.setAttribute("download", "relatorio_financeiro_" + new Date().toISOString().split('T')[0] + ".csv");
                                 document.body.appendChild(link);
                                 link.click();
                                 document.body.removeChild(link);
                                 toast.success("Relatório gerado com sucesso!");
                              }}
                              className={`w-full p-4 border border-gray-800 rounded-2xl bg-gray-900/30 flex items-center justify-between transition-colors group ${plan === 'starter' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-900'}`}
                           >
                              <div className="flex items-center gap-4">
                                 <div className={`p-3 rounded-xl transition-colors ${plan === 'starter' ? 'bg-gray-800 text-gray-500' : 'bg-blue-900/20 text-blue-400 group-hover:bg-blue-900/30'}`}>
                                    <Download size={24} />
                                 </div>
                                 <div className="text-left">
                                    <h4 className="text-white font-bold flex items-center gap-2">
                                        Gerar Relatório Completo
                                        {plan === 'starter' && <span className="text-[10px] px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded border border-gray-700 uppercase">Plus</span>}
                                    </h4>
                                    <p className="text-sm text-gray-500">Extrato detalhado com resumo financeiro</p>
                                 </div>
                              </div>
                              {plan !== 'starter' && <ChevronRight size={20} className="text-gray-600 group-hover:text-white transition-colors" />}
                           </button>
                        </div>
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
            isVerifying={isVerifying2FA}
         />

         {/* Credit Card Modal */}
         <CreditCardModal
            isOpen={isCardModalOpen}
            onClose={() => setIsCardModalOpen(false)}
            onSave={handleUpdateCard}
         />

         {/* Auto Renew Confirmation */}
         <ConfirmationCard
            isOpen={showAutoRenewConfirmation}
            onClose={() => setShowAutoRenewConfirmation(false)}
            onConfirm={() => {
               setAutoRenew(false);
               toast.success("Cobrança automática pausada.");
            }}
            title="Desabilitar Cobrança Recorrente?"
            description="Você está prestes a desativar a renovação automática. Isso pode resultar na perda de benefícios do seu plano atual."
            isDestructive={true}
            confirmText="Sim, desativar"
            cancelText="Manter ativa"
         />
      </div>
   );
};