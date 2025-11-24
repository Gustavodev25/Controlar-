
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
   X, User, Mail, Check, Save, Sparkles, Shield, CreditCard,
   Bell, Download, Trash2, Upload, Smartphone,
   CheckCircle, Copy, FileText, ChevronRight, ArrowLeft, Coins,
   PiggyBank, ShieldCheck, Lock, Cloud, Trophy, Crown, Users,
   Zap, Activity, Search, Bot, BrainCircuit, Link, Wifi, Wand2, Award
} from 'lucide-react';
import { User as UserType, Transaction, FamilyGoal, Investment, Reminder, ConnectedAccount } from '../types';
import { useToasts } from './Toast';
import { buildOtpAuthUrl, generateBase32Secret, verifyTOTP } from '../services/twoFactor';

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

type SettingsTab = 'account' | 'security' | 'plan' | 'notifications' | 'data';

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
   connectedAccounts = []
}) => {
   const [activeTab, setActiveTab] = useState<SettingsTab>('account');
   const [formData, setFormData] = useState(user);
   const [isVisible, setIsVisible] = useState(false);
   const fileInputRef = useRef<HTMLInputElement>(null);
   const toast = useToasts();
   const normalizeMonth = (dateStr: string) => dateStr.slice(0, 7);

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
                              <div className="space-y-2">
                                 <label className="text-xs font-medium text-gray-400 ml-1 flex items-center gap-2">
                                    <Coins size={14} className="text-[#d97757]" />
                                    Salário Base Mensal
                                 </label>
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
                                 <p className="text-xs text-gray-500 ml-1">Este valor será usado como base para cálculo de horas extras</p>
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

                  {/* --- TAB: PLANS (IMPLEMENTATION REQUESTED) --- */}
                  {activeTab === 'plan' && (
                     <div className="space-y-8 animate-fade-in">
                        <div>
                           <h3 className="text-3xl font-bold text-white mb-2">Planos e Assinatura</h3>
                           <p className="text-gray-400">Todas as contas estão no plano gratuito com recursos liberados sem cobranças.</p>
                        </div>

                        <div className="grid md:grid-cols-1 gap-6">
                           {/* PLANO ATUAL - DESTAQUE */}
                           <div className="bg-gradient-to-r from-[#d97757]/20 to-gray-900 border border-[#d97757]/30 rounded-2xl p-6 relative overflow-hidden">
                              <div className="absolute top-0 right-0 bg-[#d97757] text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">PLANO GRATUITO</div>

                              <div className="flex items-center gap-4 mb-6">
                                 <div className="p-3 bg-[#d97757] rounded-xl text-white shadow-lg">
                                    <Sparkles size={24} />
                                 </div>
                                 <div>
                                    <p className="text-xs text-[#d97757] font-bold uppercase tracking-wide mb-1">Seu Plano</p>
                                    <h4 className="text-3xl font-bold text-white">Controlar+ Gratuito</h4>
                                    <p className="text-sm text-gray-300 mt-1">Sem assinatura; todos os recursos essenciais estão liberados para qualquer conta.</p>
                                 </div>
                              </div>

                              <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-white/10">
                                 <div>
                                    <p className="text-gray-400 text-xs uppercase font-bold mb-1">Cobrança</p>
                                    <p className="text-white font-medium">Gratuito para todas as contas</p>
                                 </div>
                                 <div>
                                    <p className="text-gray-400 text-xs uppercase font-bold mb-1">Renovação</p>
                                    <p className="text-white font-medium">Não expira nem gera faturas</p>
                                 </div>
                              </div>
                           </div>

                           {/* INFORMAÇÕES DE COBRANÇA (GRATUITO) */}
                           <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                              <div className="flex items-center justify-between mb-6">
                                 <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                    <CreditCard size={20} className="text-gray-400" /> Cobrança
                                 </h4>
                              </div>

                              <div className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
                                 <div className="w-12 h-12 rounded flex items-center justify-center bg-gray-700 text-white font-bold">Grátis</div>
                                 <div className="flex-1">
                                    <p className="text-sm font-bold text-white">Nenhuma forma de pagamento necessária</p>
                                    <p className="text-xs text-gray-500">Plano gratuito ativo para todas as contas.</p>
                                 </div>
                                 <div className="ml-auto">
                                    <span className="text-[10px] bg-green-900/30 text-green-400 px-2 py-0.5 rounded border border-green-900/50">Ativo</span>
                                 </div>
                              </div>

                              <div className="mt-6 pt-6 border-t border-gray-800">
                                 <p className="text-xs font-bold text-gray-500 uppercase mb-3">Benefícios incluídos</p>
                                 <div className="space-y-3 text-sm text-gray-300">
                                    <div className="flex items-center gap-2"><CheckCircle size={12} className="text-[#d97757]" /> Consultor IA e lançamentos inteligentes sem custo</div>
                                    <div className="flex items-center gap-2"><CheckCircle size={12} className="text-[#d97757]" /> Modo família e metas compartilhadas liberados</div>
                                    <div className="flex items-center gap-2"><CheckCircle size={12} className="text-[#d97757]" /> Lembretes e exportações ilimitados</div>
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
                                    onClick={() => setNotifications({ ...notifications, [item.id]: !notifications[item.id as keyof typeof notifications] })}
                                    className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${notifications[item.id as keyof typeof notifications] ? 'bg-[#d97757]' : 'bg-gray-700'}`}
                                 >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${notifications[item.id as keyof typeof notifications] ? 'translate-x-6' : 'translate-x-1'}`} />
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
                                 if (transactions.length === 0) {
                                    toast.error("Sem dados para exportar.");
                                    return;
                                 }
                                 // Generate detailed report
                                 const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
                                 const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
                                 const balance = totalIncome - totalExpense;

                                 const headers = ["=== RELATÓRIO FINANCEIRO ===", "", `Gerado em: ${new Date().toLocaleString('pt-BR')}`, "", "---", ""];
                                 const summary = [
                                    "RESUMO GERAL:",
                                    `Total de Receitas: R$ ${totalIncome.toFixed(2)}`,
                                    `Total de Despesas: R$ ${totalExpense.toFixed(2)}`,
                                    `Saldo: R$ ${balance.toFixed(2)}`,
                                    `Total de Transações: ${transactions.length}`,
                                    "",
                                    "---",
                                    "",
                                    "TRANSAÇÕES DETALHADAS:",
                                    "Data,Descrição,Categoria,Valor,Tipo,Status"
                                 ];
                                 const rows = transactions
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .map(t => `${t.date},"${t.description}",${t.category},${t.amount.toFixed(2)},${t.type === 'income' ? 'Receita' : 'Despesa'},${t.status === 'completed' ? 'Pago' : 'Pendente'}`);

                                 const content = [...headers, ...summary, ...rows].join("\n");
                                 const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
                                 const link = document.createElement("a");
                                 link.href = URL.createObjectURL(blob);
                                 link.setAttribute("download", `relatorio_financeiro_${new Date().toISOString().split('T')[0]}.csv`);
                                 document.body.appendChild(link);
                                 link.click();
                                 document.body.removeChild(link);
                                 toast.success("Relatório gerado com sucesso!");
                              }}
                              className="w-full p-4 border border-gray-800 rounded-2xl bg-gray-900/30 flex items-center justify-between hover:bg-gray-900 transition-colors group"
                           >
                              <div className="flex items-center gap-4">
                                 <div className="p-3 bg-blue-900/20 rounded-xl text-blue-400 group-hover:bg-blue-900/30 transition-colors">
                                    <Download size={24} />
                                 </div>
                                 <div className="text-left">
                                    <h4 className="text-white font-bold flex items-center gap-2">Gerar Relatório Completo</h4>
                                    <p className="text-sm text-gray-500">Extrato detalhado com resumo financeiro</p>
                                 </div>
                              </div>
                              <ChevronRight size={20} className="text-gray-600 group-hover:text-white transition-colors" />
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
      </div>
   );
};


