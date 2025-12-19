import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Mail, Lock, User as UserIcon, ArrowRight, Sparkles, CheckCircle, ChevronLeft, X, Check, FileText } from './Icons';
import { Logo } from './Logo';
import { auth } from '../services/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { updateUserProfile, getUserProfile } from '../services/database';
import { motion, AnimatePresence } from 'framer-motion';
import { useToasts } from './Toast';
import { CustomDatePicker } from './UIComponents';

interface AuthModalProps {
  onLogin?: (user: any) => void;
  onBack?: () => void;
  isTwoFactorPending?: boolean;
  onVerifyTwoFactor?: (code: string) => Promise<void>;
  onCancelTwoFactor?: () => void;
  inviteContext?: { ownerName: string } | null | undefined;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  onLogin,
  onBack,
  isTwoFactorPending,
  onVerifyTwoFactor,
  onCancelTwoFactor,
  inviteContext
}) => {
  const toast = useToasts();
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState(1);
  const [overflow, setOverflow] = useState("hidden");
  const [isCepLoading, setIsCepLoading] = useState(false);
  const [showAddressFields, setShowAddressFields] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Password Recovery State
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [newPassword, setNewPassword] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    cpf: '',
    birthDate: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  // 2FA & OTP State
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  // Effect to reset/focus OTP when entering 2FA mode or Recovery Step 2
  React.useEffect(() => {
    if (isTwoFactorPending || (isResettingPassword && recoveryStep === 2)) {
      setOtp(new Array(6).fill(""));
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isTwoFactorPending, isResettingPassword, recoveryStep]);

  const handleOtpChange = (value: string, index: number) => {
    if (isNaN(Number(value))) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const validateCPF = (cpf: string) => {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf === '') return false;
    if (cpf.length !== 11 ||
      cpf === "00000000000" ||
      cpf === "11111111111" ||
      cpf === "22222222222" ||
      cpf === "33333333333" ||
      cpf === "44444444444" ||
      cpf === "55555555555" ||
      cpf === "66666666666" ||
      cpf === "77777777777" ||
      cpf === "88888888888" ||
      cpf === "99999999999")
      return false;
    let add = 0;
    for (let i = 0; i < 9; i++)
      add += parseInt(cpf.charAt(i)) * (10 - i);
    let rev = 11 - (add % 11);
    if (rev === 10 || rev === 11)
      rev = 0;
    if (rev !== parseInt(cpf.charAt(9)))
      return false;
    add = 0;
    for (let i = 0; i < 10; i++)
      add += parseInt(cpf.charAt(i)) * (11 - i);
    rev = 11 - (add % 11);
    if (rev === 10 || rev === 11)
      rev = 0;
    if (rev !== parseInt(cpf.charAt(10)))
      return false;
    return true;
  };

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

  const fetchCepData = async (cepValue: string) => {
    const cep = cepValue.replace(/\D/g, '');
    if (cep.length === 8) {
      setIsCepLoading(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setFormData(prev => ({
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
        setShowAddressFields(true);
      } finally {
        setIsCepLoading(false);
      }
    }
  };

  const handleCepBlur = async () => {
    await fetchCepData(formData.cep);
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const formatted = formatCEP(rawVal);
    setFormData({ ...formData, cep: formatted });
    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 8) {
      fetchCepData(digits);
    }
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) {
      toast.error("Digite o código de 6 dígitos.");
      return;
    }
    setIsLoading(true);
    try {
      if (onVerifyTwoFactor) await onVerifyTwoFactor(code);
    } catch (err) {
      // Error handling by parent
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!auth) throw new Error("Auth não inicializado");

      if (isResettingPassword) {
        // --- RECOVERY FLOW ---

        // STEP 1: Send Code
        if (recoveryStep === 1) {
          if (!formData.email) {
            toast.error("Digite seu e-mail.");
            setIsLoading(false);
            return;
          }

          try {
            const res = await fetch('/api/auth/send-recovery-code', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: formData.email })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Erro ao enviar código.');

            toast.success(data.message || "Código enviado! Verifique seu email.");
            setRecoveryStep(2);
          } catch (error: any) {
            toast.error(error.message);
          } finally {
            setIsLoading(false);
          }
          return;
        }

        // STEP 2: Verify Code
        if (recoveryStep === 2) {
          const code = otp.join("");
          if (code.length !== 6) {
            toast.error("Digite o código de 6 dígitos.");
            setIsLoading(false);
            return;
          }

          try {
            const res = await fetch('/api/auth/verify-recovery-code', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: formData.email, code })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Código inválido.');

            toast.success("Código verificado! Crie sua nova senha.");
            setRecoveryStep(3);
          } catch (error: any) {
            toast.error(error.message);
          } finally {
            setIsLoading(false);
          }
          return;
        }

        // STEP 3: Reset Password
        if (recoveryStep === 3) {
          if (newPassword.length < 6) {
            toast.error("A senha deve ter pelo menos 6 caracteres.");
            setIsLoading(false);
            return;
          }

          try {
            const code = otp.join("");
            const res = await fetch('/api/auth/reset-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: formData.email, code, newPassword })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Erro ao redefinir senha.');

            // If server has Firebase Admin, password is already reset
            if (!data.requiresClientReset && !data.requiresFirebaseLink) {
              toast.success("Senha redefinida com sucesso! Faça login com sua nova senha.");
              setIsResettingPassword(false);
              setRecoveryStep(1);
              setNewPassword('');
              setOtp(new Array(6).fill(""));
              setIsLogin(true);
              // Pre-fill email for convenience
              setFormData(prev => ({ ...prev, password: '' }));
            } else if (data.requiresFirebaseLink) {
              // Firebase sent a reset link via email
              toast.success("Verifique seu email! Enviamos um link para redefinir sua senha.");
              setIsResettingPassword(false);
              setRecoveryStep(1);
              setNewPassword('');
              setOtp(new Array(6).fill(""));
              setIsLogin(true);
            } else {
              // Fallback: use Firebase client SDK to send reset email
              if (!auth) throw new Error("Auth não inicializado");

              await sendPasswordResetEmail(auth, formData.email);

              toast.success("Verifique seu email! Enviamos um link para redefinir sua senha.");
              setIsResettingPassword(false);
              setRecoveryStep(1);
              setNewPassword('');
              setOtp(new Array(6).fill(""));
              setIsLogin(true);
            }
          } catch (error: any) {
            toast.error(error.message);
          } finally {
            setIsLoading(false);
          }
          return;
        }

        return;
      }

      // --- LOGIN / REGISTER FLOW ---
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        if (onLogin) onLogin(userCredential.user);
      } else {
        // REGISTRATION FLOW
        if (step === 1) {
          if (!formData.name || !formData.email || !formData.password) {
            toast.error("Preencha todos os campos.");
            setIsLoading(false);
            return;
          }
          if (formData.password.length < 6) {
            toast.error("A senha deve ter pelo menos 6 caracteres.");
            setIsLoading(false);
            return;
          }
          setStep(2);
          setIsLoading(false);
          return;
        }

        if (!validateCPF(formData.cpf)) {
          toast.error("CPF inválido.");
          setIsLoading(false);
          return;
        }
        if (!formData.birthDate || !formData.cep || !formData.street || !formData.number || !formData.city || !formData.state) {
          toast.error("Preencha todos os campos obrigatórios.");
          setIsLoading(false);
          return;
        }
        if (!acceptedTerms) {
          toast.error("Você precisa aceitar os Termos de Uso.");
          setIsLoading(false);
          return;
        }

        // Set flag immediately before auth call to handle race condition with App.tsx listener
        localStorage.setItem('is_new_signup', 'true');


        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        if (userCredential.user) {
          // Flag already set
          await updateProfile(userCredential.user, { displayName: formData.name });
          await updateUserProfile(userCredential.user.uid, {
            name: formData.name,
            email: formData.email,
            baseSalary: 0,
            isAdmin: false,
            cpf: formData.cpf,
            birthDate: formData.birthDate,
            address: {
              cep: formData.cep,
              street: formData.street,
              number: formData.number,
              complement: formData.complement,
              neighborhood: formData.neighborhood,
              city: formData.city,
              state: formData.state
            }
          });
          if (onLogin) onLogin(userCredential.user);
        }

      }
    } catch (err: any) {
      console.error("Erro de autenticação:", err);
      let msg = "Ocorreu um erro. Tente novamente.";
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = "E-mail ou senha incorretos.";
      } else if (err.code === 'auth/email-already-in-use') {
        msg = "Este e-mail já está em uso.";
      } else if (err.code === 'auth/weak-password') {
        msg = "A senha deve ter pelo menos 6 caracteres.";
      }
      toast.error(msg);
      localStorage.removeItem('is_new_signup');
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      if (!auth) throw new Error("Auth não inicializado");
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const existingProfile = await getUserProfile(user.uid);

      if (!existingProfile) {
        await updateUserProfile(user.uid, {
          name: user.displayName || 'Usuário',
          email: user.email || '',
          baseSalary: 0,
          avatarUrl: user.photoURL || undefined,
          isAdmin: false
        });
        localStorage.setItem('is_new_signup', 'true');
      } else {
        await updateUserProfile(user.uid, {
          email: user.email || existingProfile.email,
        });
      }

      if (onLogin) onLogin(user);
    } catch (err: any) {
      console.error("Google Login Error:", err);
      let msg = "Erro ao conectar com Google.";
      if (err.code === 'auth/popup-closed-by-user') {
        msg = "Login cancelado.";
      }
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex w-full h-full bg-gray-950 text-[#faf9f5] font-sans">

      {/* Back Button (Mobile/Desktop) */}
      {onBack && !isTwoFactorPending && (
        <button
          onClick={onBack}
          className="absolute top-6 left-6 z-50 p-2 bg-gray-900 rounded-full text-gray-400 hover:text-white hover:bg-gray-800 transition-colors border border-gray-800"
        >
          <ChevronLeft size={20} />
        </button>
      )}

      {/* LEFT SIDE - Creative Pattern & Branding (Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-[55%] relative bg-[#30302E] overflow-hidden flex-col justify-between p-12">

        {/* Dotted Pattern Background */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: 'radial-gradient(#9a9b99 1.5px, transparent 1.5px)',
            backgroundSize: '32px 32px'
          }}
        ></div>

        {/* Header / Logo */}
        <Logo
          size={32}
          className="relative z-10 ml-10 gap-2"
          textClassName="font-bold text-xl tracking-tight"
          imgClassName="rounded-lg"
        />

        {/* Central Visual Element */}
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <div className="relative">
            {/* Main Glass Card */}
            <div className="w-80 bg-gray-900/60 backdrop-blur-xl border border-gray-700 rounded-2xl p-6 shadow-2xl transform -rotate-3 hover:rotate-0 transition-all duration-500">
              <div className="flex items-center justify-between mb-6">
                <div className="flex flex-col">
                  <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Saldo Total</span>
                  <span className="text-2xl font-bold text-white">R$ 12.450,00</span>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-[#d97757] to-orange-600 rounded-full flex items-center justify-center shadow-lg">
                  <Sparkles size={20} className="text-white" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full w-[70%] bg-[#d97757]"></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Gastos do Mês</span>
                  <span>70%</span>
                </div>
              </div>
            </div>

            {/* Floating Badge */}
            <div className="absolute -right-8 -bottom-4 bg-gray-800 border border-gray-700 p-3 rounded-xl shadow-xl flex items-center gap-3 transform rotate-3 animate-bounce" style={{ animationDuration: '3s' }}>
              <div className="bg-green-500/20 p-1.5 rounded-full text-green-500">
                <CheckCircle size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Meta Atingida</p>
                <p className="text-[10px] text-gray-400">Economia Mensal</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer / Testimonial */}
        <div className="relative z-10 max-w-md ml-10">
          <blockquote className="text-xl font-medium leading-relaxed text-gray-200">
            "A organização financeira que transformou meus planos em realidade. Simples, direto e inteligente."
          </blockquote>
          <div className="mt-4 flex items-center gap-3">
            <div className="text-sm font-bold text-white">Carlos Mendes</div>
            <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
            <div className="text-sm text-gray-400">Usuário do plano gratuito</div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - Form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-4 sm:p-8 lg:p-16 bg-gray-950 relative overflow-y-auto max-h-screen">
        <div className="w-full max-w-sm">

          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <Logo size={32} className="gap-2" textClassName="font-bold text-xl" imgClassName="rounded-lg" />
          </div>

          {isTwoFactorPending ? (
            // --- 2FA VIEW ---
            <div className="space-y-8 animate-fade-in">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight text-white">Verificação de Identidade</h2>
                <p className="text-gray-400">Sua conta possui proteção de dois fatores. Digite o código de 6 dígitos do seu app autenticador.</p>
              </div>

              <form onSubmit={handleVerify} className="space-y-6">
                <div className="flex justify-center gap-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      type="text"
                      maxLength={1}
                      value={digit}
                      ref={el => { inputRefs.current[index] = el; }}
                      onChange={(e) => handleOtpChange(e.target.value, index)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      className="w-12 h-14 text-center text-xl font-bold rounded-xl bg-gray-900 border border-gray-800 text-white focus:border-[#d97757] focus:ring-1 focus:ring-[#d97757] outline-none transition-all"
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otp.join("").length !== 6}
                  className="w-full py-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>Confirmar Acesso <ArrowRight size={18} /></>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onCancelTwoFactor}
                  className="w-full text-sm text-gray-500 hover:text-gray-300 transition-colors flex items-center justify-center gap-1"
                >
                  <ChevronLeft size={14} /> Voltar para login
                </button>
              </form>
            </div>
          ) : (
            // --- ORIGINAL LOGIN/REGISTER VIEW ---
            <motion.div
              initial={false}
              animate={{ height: "auto" }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              style={{ overflow: overflow }}
              onAnimationStart={() => setOverflow("hidden")}
              onAnimationComplete={() => setOverflow("visible")}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={isResettingPassword ? `reset-step-${recoveryStep}` : (isLogin ? 'login' : 'register')}
                  initial={{ opacity: 0, filter: "blur(10px)", scale: 0.95 }}
                  animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                  exit={{ opacity: 0, filter: "blur(10px)", scale: 0.95 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="space-y-8"
                >
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight text-white">
                      {isResettingPassword
                        ? (recoveryStep === 1
                          ? 'Recuperar Senha'
                          : (recoveryStep === 2 ? 'Digite o Código' : 'Nova Senha')
                        )
                        : (inviteContext
                          ? `Convite de ${inviteContext.ownerName}`
                          : (isLogin ? 'Bem-vindo de volta' : 'Comece agora')
                        )
                      }
                    </h2>
                    <p className="text-gray-400">
                      {isResettingPassword
                        ? (recoveryStep === 1
                          ? 'Digite seu e-mail para receber o código de recuperação.'
                          : (recoveryStep === 2
                            ? 'Enviamos um código de 6 dígitos para seu e-mail.'
                            : 'Crie uma nova senha segura para sua conta.')
                        )
                        : (inviteContext
                          ? 'Crie sua conta ou faça login para aceitar o convite e entrar no grupo familiar.'
                          : (isLogin ? 'Preencha seus dados para acessar.' : 'Crie sua conta gratuita em segundos.')
                        )
                      }
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <AnimatePresence mode="wait">

                      {/* --- RECOVERY STEP 1: EMAIL --- */}
                      {isResettingPassword && recoveryStep === 1 && (
                        <motion.div
                          key="rec-1"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="space-y-5"
                        >
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-300 ml-1">E-mail</label>
                            <div className="relative group">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={18} />
                              <input
                                type="email"
                                required
                                placeholder="seu@email.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="input-primary pl-10 bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]"
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* --- RECOVERY STEP 2: OTP --- */}
                      {isResettingPassword && recoveryStep === 2 && (
                        <motion.div
                          key="rec-2"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="space-y-5"
                        >
                          <div className="flex justify-center gap-2">
                            {otp.map((digit, index) => (
                              <input
                                key={index}
                                type="text"
                                maxLength={1}
                                value={digit}
                                ref={el => { inputRefs.current[index] = el; }}
                                onChange={(e) => handleOtpChange(e.target.value, index)}
                                onKeyDown={(e) => handleKeyDown(e, index)}
                                className="w-12 h-14 text-center text-xl font-bold rounded-xl bg-gray-900 border border-gray-800 text-white focus:border-[#d97757] focus:ring-1 focus:ring-[#d97757] outline-none transition-all"
                              />
                            ))}
                          </div>
                          <div className="text-center">
                            <button
                              type="button"
                              onClick={() => setRecoveryStep(1)}
                              className="text-xs text-gray-500 hover:text-white underline"
                            >
                              Enviar novamente ou trocar e-mail
                            </button>
                          </div>
                        </motion.div>
                      )}

                      {/* --- RECOVERY STEP 3: NEW PASSWORD --- */}
                      {isResettingPassword && recoveryStep === 3 && (
                        <motion.div
                          key="rec-3"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="space-y-5"
                        >
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-300 ml-1">Nova Senha</label>
                            <div className="relative group">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={18} />
                              <input
                                type="password"
                                required
                                placeholder="••••••••"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="input-primary pl-10 bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]"
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* --- STANDARD LOGIN/REGISTER FIELDS --- */}
                      {!isResettingPassword && step === 1 && (
                        <motion.div
                          key="step1"
                          initial={{ opacity: 0, x: -20, filter: "blur(5px)" }}
                          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                          exit={{ opacity: 0, x: -20, filter: "blur(5px)" }}
                          transition={{ duration: 0.3 }}
                          className="space-y-5"
                        >
                          {!isLogin && (
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-gray-300 ml-1">Nome Completo</label>
                              <div className="relative group">
                                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={18} />
                                <input
                                  type="text"
                                  required
                                  placeholder="Como devemos te chamar?"
                                  value={formData.name}
                                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                  className="input-primary pl-10 bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]"
                                />
                              </div>
                            </div>
                          )}

                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-300 ml-1">E-mail</label>
                            <div className="relative group">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={18} />
                              <input
                                type="email"
                                required
                                placeholder="seu@email.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="input-primary pl-10 bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]"
                              />
                            </div>
                          </div>

                          {!isResettingPassword && (
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-gray-300 ml-1">Senha</label>
                              <div className="relative group">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={18} />
                                <input
                                  type="password"
                                  required
                                  placeholder="••••••••"
                                  value={formData.password}
                                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                  className="input-primary pl-10 bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]"
                                />
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}

                      {!isResettingPassword && step === 2 && !isLogin && (
                        <motion.div
                          key="step2"
                          initial={{ opacity: 0, x: 20, filter: "blur(5px)" }}
                          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                          exit={{ opacity: 0, x: 20, filter: "blur(5px)" }}
                          transition={{ duration: 0.3 }}
                          className="space-y-4"
                        >
                          {/* Stepper Indicator */}
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-[#d97757] uppercase tracking-wider">Passo Final</span>
                            <div className="flex gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-gray-700"></div>
                              <div className="w-6 h-1.5 rounded-full bg-[#d97757]"></div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-gray-300 ml-1">CPF</label>
                              <input
                                type="text"
                                required
                                placeholder="000.000.000-00"
                                maxLength={14}
                                value={formatCPF(formData.cpf)}
                                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                                className="input-primary bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-gray-300 ml-1">Data Nasc.</label>
                              <CustomDatePicker
                                value={formData.birthDate}
                                onChange={(val) => setFormData({ ...formData, birthDate: val })}
                                placeholder="dd/mm/aaaa"
                                dropdownMode="fixed"
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-300 ml-1">CEP</label>
                            <input
                              type="text"
                              required
                              placeholder="00000-000"
                              maxLength={9}
                              value={formData.cep}
                              onChange={handleCepChange}
                              onBlur={handleCepBlur}
                              className="input-primary bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]"
                            />
                          </div>

                          <AnimatePresence>
                            {showAddressFields && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-4 overflow-hidden"
                              >
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                                  <div className="sm:col-span-2 space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-300 ml-1">Rua</label>
                                    <div className="relative">
                                      {isCepLoading && <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-600 border-t-[#d97757] rounded-full animate-spin"></div>}
                                      <input
                                        type="text"
                                        required
                                        value={formData.street}
                                        onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                                        className={`input-primary bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757] ${isCepLoading ? 'pl-10 text-gray-500' : ''}`}
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-300 ml-1">Número</label>
                                    <input
                                      type="text"
                                      required
                                      value={formData.number}
                                      onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                                      className="input-primary bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]"
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-300 ml-1">Cidade</label>
                                    <div className="relative">
                                      {isCepLoading && <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-600 border-t-[#d97757] rounded-full animate-spin"></div>}
                                      <input
                                        type="text"
                                        required
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        className={`input-primary bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757] ${isCepLoading ? 'pl-10 text-gray-500' : ''}`}
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-300 ml-1">Estado</label>
                                    <div className="relative">
                                      {isCepLoading && <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-600 border-t-[#d97757] rounded-full animate-spin"></div>}
                                      <input
                                        type="text"
                                        required
                                        value={formData.state}
                                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                        className={`input-primary bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757] ${isCepLoading ? 'pl-10 text-gray-500' : ''}`}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Terms Checkbox - Always visible on step 2 */}
                          <div
                            className="flex items-center gap-2 pt-2 cursor-pointer group"
                            onClick={() => setAcceptedTerms(!acceptedTerms)}
                          >
                            <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all border ${acceptedTerms ? 'bg-[#d97757] border-[#d97757] text-white shadow-lg shadow-[#d97757]/20' : 'bg-gray-800 border-gray-700 text-transparent group-hover:border-gray-600'}`}>
                              <Check size={12} strokeWidth={4} />
                            </div>
                            <span className="text-xs text-gray-400 select-none group-hover:text-gray-300 transition-colors font-medium">
                              Li e aceito os <button type="button" onClick={(e) => { e.stopPropagation(); setShowTerms(true); }} className="text-[#d97757] hover:underline font-medium">Termos de Uso</button> do sistema.
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="text-xs text-gray-500 hover:text-gray-300 underline"
                          >
                            Voltar
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button
                      type="submit"
                      disabled={isLoading || (!isLogin && !isResettingPassword && step === 2 && !acceptedTerms)}
                      className="w-full py-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/20 flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          {isResettingPassword
                            ? (recoveryStep === 1
                              ? 'Enviar Código'
                              : (recoveryStep === 2 ? 'Verificar Código' : 'Redefinir Senha')
                            )
                            : (isLogin
                              ? 'Entrar na Plataforma'
                              : (step === 1 ? 'Continuar Cadastro' : 'Finalizar Cadastro')
                            )
                          }
                          <ArrowRight size={18} />
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}

          {!isTwoFactorPending && (
            <div className="flex flex-col items-center gap-4 mt-8">
              <p className="text-center text-sm text-gray-400">
                {isResettingPassword ? (
                  <button
                    onClick={() => { setIsResettingPassword(false); setRecoveryStep(1); }}
                    className="text-[#d97757] hover:text-[#e68e70] font-bold hover:underline transition-all"
                  >
                    Voltar para o login
                  </button>
                ) : (
                  <>
                    {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
                    <button
                      onClick={() => { setIsLogin(!isLogin); }}
                      className="ml-1.5 text-[#d97757] hover:text-[#e68e70] font-bold hover:underline transition-all"
                    >
                      {isLogin ? 'Cadastre-se' : 'Fazer login'}
                    </button>
                  </>
                )}
              </p>

              {isLogin && !isResettingPassword && (
                <button
                  type="button"
                  onClick={() => { setIsResettingPassword(true); setRecoveryStep(1); }}
                  className="text-xs font-medium text-gray-500 hover:text-white transition-all"
                >
                  Esqueceu a senha?
                </button>
              )}
            </div>
          )}
        </div>

        {/* Subtle footer text */}
        <div className="absolute bottom-6 text-[10px] text-gray-600">
          © 2025 Controlar+ Pro. Todos os direitos reservados.
        </div>
      </div>


      {/* Terms Modal */}
      {showTerms && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm transition-all duration-300">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-gray-950 rounded-3xl shadow-2xl w-full max-w-lg border border-gray-800 flex flex-col max-h-[90vh] relative overflow-hidden"
          >

            {/* Background Effects Container */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#d97757]/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-gray-700/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
            </div>

            {/* Header */}
            <div className="p-4 border-b border-gray-800/50 flex justify-between items-center relative z-10 shrink-0">
              <div className="flex gap-2 items-center">
                <div className="bg-[#d97757]/10 p-2 rounded-xl text-[#d97757]">
                  <FileText size={18} />
                </div>
                <h3 className="text-lg font-bold text-white">Termos de Uso</h3>
              </div>
              <button
                onClick={() => setShowTerms(false)}
                className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative z-10 text-gray-300 leading-relaxed text-sm">
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
                <p>Somente em Planos Pro/Family, a Controlar+ poderá armazenar dados de cartão de pagamento do Usuário de forma criptografada e segura, exclusivamente para processamento de cobranças recorrentes de assinatura. Tais dados serão tratados em conformidade com padrões de segurança, incluindo o PCI DSS (Payment Card Industry Data Security Standard), e poderão ser processados por operadores de pagamento contratados.</p>
                <p className="mt-2">No Plano Free, nenhum dado de cartão será armazenado ou coletado.</p>
                <p className="mt-2">A Controlar+ não armazenará dados de cartão em formato legível ("em claro") em seus servidores e utilizará criptografia e tokens de segurança fornecidos por parceiros de pagamento.</p>

                <h5 className="font-bold text-white mt-4 mb-1">5.3 Renovação e Cancelamento</h5>
                <p>As assinaturas dos Planos Pro/Family serão renovadas automaticamente ao final de cada período, salvo cancelamento prévio pelo Usuário. O cancelamento poderá ser realizado a qualquer momento por meio das configurações de conta na plataforma.</p>
                <p className="mt-2">Ao cancelar uma assinatura:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>O Usuário poderá optar por migrar para o Plano Free, mantendo sua conta e dados</li>
                  <li>Ou solicitar a exclusão definitiva da conta e dos dados pessoais associados, conforme detalhado na Política de Privacidade</li>
                </ul>
                <p className="mt-2">Não serão concedidos reembolsos por períodos já cobrados, ressalvado o direito de arrependimento previsto em lei.</p>
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
                  <li>Publicar conteúdo ofensivo, ilegal, discriminatório, pornográfico ou que viole direitos de terceiros</li>
                  <li>Realizar ataques, testes de invasão, envio de malware ou qualquer atividade maliciosa</li>
                  <li>Coletar dados em massa, fazer scraping ou automação sem consentimento</li>
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
                <p className="mt-2">O Usuário será notificado dos motivos quando possível.</p>
              </section>

              <section>
                <h4 className="font-bold text-white mb-2 text-base">8. Direitos de Propriedade Intelectual</h4>
                <p>Todos os conteúdos, funcionalidades e elementos da Controlar+ são protegidos por direitos autorais, marcas registradas, segredos comerciais e demais direitos de propriedade intelectual de titularidade da Controlar Mais LTDA ou de terceiros licenciantes.</p>
                <p className="mt-2">Estes incluem: marca Controlar+, identidade visual, layouts, designs, textos, gráficos, dashboards, fluxos de interface, algoritmos, código-fonte, bases de dados, relatórios e a assistente virtual Coinzinha.</p>
                <p className="mt-2">O Usuário recebe licença limitada, não exclusiva, intransferível e revogável para uso pessoal da plataforma, mediante aceite destes Termos. É vedada qualquer reprodução, modificação, distribuição, venda, locação, aluguel, empréstimo ou uso comercial sem autorização expressa da Controlar+.</p>
              </section>

              <section>
                <h4 className="font-bold text-white mb-2 text-base">9. Isenções e Limitações de Responsabilidade</h4>
                <h5 className="font-bold text-white mt-2 mb-1">9.1 Serviço "No Estado Atual"</h5>
                <p>A Controlar+ é disponibilizada "no estado atual" ("as is"), sem garantias expressas ou implícitas de disponibilidade, segurança, exatidão, adequação para fim específico ou não violação de direitos.</p>

                <h5 className="font-bold text-white mt-4 mb-1">9.2 Indisponibilidades e Falhas</h5>
                <p>A Controlar+ envidará esforços razoáveis para manter a plataforma operacional e segura. Entretanto, não garante funcionamento ininterrupto, sem erros ou falhas, sendo isentada de responsabilidade por:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Indisponibilidades decorrentes de manutenção, atualizações, fatores externos ou infraestrutura de terceiros</li>
                  <li>Falhas de sincronização de dados com instituições financeiras, bancos ou parceiros de Open Finance</li>
                  <li>Divergências entre dados exibidos na Controlar+ e registros oficiais da instituição financeira</li>
                  <li>Atrasos ou erros na transmissão de dados pela internet ou terceiros</li>
                  <li>Caso fortuito ou força maior (eventos imprevisíveis e inevitáveis)</li>
                </ul>

                <h5 className="font-bold text-white mt-4 mb-1">9.3 Dados de Terceiros</h5>
                <p>A exatidão, completude e atualização de dados financeiros provenientes de bancos, instituições de pagamento, plataformas de investimento e integrações de Open Finance dependem exclusivamente desses terceiros. A Controlar+ não é responsável por erros, atrasos, inconsistências ou indisponibilidades causados por terceiros.</p>

                <h5 className="font-bold text-white mt-4 mb-1">9.4 Orientações e Conteúdos</h5>
                <p>A Controlar+ não é responsável por:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Danos resultantes de seguimento de orientações, conteúdos educativos ou sugestões fornecidas pela plataforma ou Coinzinha</li>
                  <li>Decisões financeiras, de investimento ou comerciais baseadas em conteúdos da plataforma</li>
                  <li>Perdas financeiras, prejuízos econômicos ou ganhos não realizados decorrentes do uso ou não uso da Controlar+</li>
                </ul>
                <p className="mt-2">O Usuário é inteiramente responsável por suas decisões financeiras e deve buscar orientação profissional habilitada antes de tomar decisões relevantes.</p>

                <h5 className="font-bold text-white mt-4 mb-1">9.5 Limitação de Responsabilidade</h5>
                <p>Na máxima extensão permitida pela legislação brasileira, em especial pelo Código de Defesa do Consumidor, em nenhuma circunstância a Controlar Mais LTDA será responsável por danos indiretos, incidentais, especiais, punitivos ou consequentes, incluindo perda de dados, lucros cessantes, interrupção de atividades ou danos morais, mesmo que informada da possibilidade de tais danos.</p>
                <p className="mt-2">A responsabilidade total da Controlar Mais LTDA por qualquer reclamação decorrente do uso da plataforma não excederá o valor pago pelo Usuário nos últimos 12 (doze) meses de utilização.</p>
              </section>

              <section>
                <h4 className="font-bold text-white mb-2 text-base">10. Dados Pessoais e Privacidade</h4>
                <p>A coleta, uso, armazenamento e proteção de dados pessoais do Usuário observará a Política de Privacidade, que integra estes Termos de Uso e deve ser lida atentamente.</p>
                <p className="mt-2">A Controlar+ atua como Controladora de Dados, responsável por definir as finalidades e meios de tratamento, em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 – LGPD).</p>
              </section>

              <section>
                <h4 className="font-bold text-white mb-2 text-base">11. Segurança da Informação</h4>
                <p>A Controlar+ implementará medidas técnicas e administrativas razoáveis para proteger os dados pessoais e informações do Usuário contra acessos não autorizados, alterações, perdas ou destruição. Nenhum sistema de segurança, entretanto, é absolutamente à prova de falhas.</p>
                <p className="mt-2">O Usuário também é responsável pela segurança de seus dispositivos, credenciais e pela não exposição de informações confidenciais em redes públicas.</p>
              </section>

              <section>
                <h4 className="font-bold text-white mb-2 text-base">12. Links Externos</h4>
                <p>A Controlar+ poderá conter links para sites, plataformas ou conteúdos de terceiros. Tais links são fornecidos apenas como conveniência e não implicam endosso, afiliação ou responsabilidade da Controlar+ pelo conteúdo, políticas ou práticas de terceiros.</p>
              </section>

              <section>
                <h4 className="font-bold text-white mb-2 text-base">13. Modificações dos Termos</h4>
                <p>A Controlar+ poderá atualizar estes Termos de Uso a qualquer tempo. Alterações substanciais serão comunicadas ao Usuário por e-mail ou mediante aviso na própria plataforma, com prazo mínimo para análise.</p>
                <p className="mt-2">A continuidade do uso após a divulgação das alterações será considerada aceitação das novas condições. Caso o Usuário discorde das modificações, deverá descontinuar o uso e solicitar o cancelamento da conta.</p>
              </section>

              <section>
                <h4 className="font-bold text-white mb-2 text-base">14. Legislação e Foro</h4>
                <p>Estes Termos de Uso são regidos pela legislação brasileira, especialmente:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Código Civil Brasileiro</li>
                  <li>Código de Defesa do Consumidor (Lei nº 8.078/1990)</li>
                  <li>Lei Geral de Proteção de Dados (Lei nº 13.709/2018)</li>
                  <li>Normas de Proteção ao Consumidor e Comércio Eletrônico</li>
                </ul>
                <p className="mt-2">Fica eleito o foro da comarca de São Bernardo do Campo/SP como competente para dirimir quaisquer controvérsias decorrentes destes Termos, ressalvados os casos de competência diversa prevista em lei.</p>
              </section>

              <div className="border-t border-gray-700 my-8"></div>

              <h3 className="text-xl font-bold text-white mb-4">POLÍTICA DE PRIVACIDADE – CONTROLAR+</h3>

              <section>
                <h4 className="font-bold text-white mb-2 text-base">1. Introdução</h4>
                <p>Esta Política de Privacidade descreve como a Controlar Mais LTDA ("Controlar+"), com sede em São Bernardo do Campo/SP, trata dados pessoais coletados de Usuários de sua plataforma de gestão financeira.</p>
                <p className="mt-2">Ao utilizar a Controlar+, o Usuário declara ciência e concordância com os termos desta Política, que integra os Termos de Uso da plataforma.</p>
              </section>

              <section>
                <h4 className="font-bold text-white mb-2 text-base">2. Dados Pessoais Tratados</h4>
                <p>A Controlar+ poderá coletar e tratar os seguintes dados pessoais:</p>

                <h5 className="font-bold text-white mt-4 mb-1">2.1 Dados Cadastrais</h5>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Nome completo</li>
                  <li>Cadastro de Pessoa Física (CPF)</li>
                  <li>Código de Endereçamento Postal (CEP)</li>
                  <li>Endereço residencial (opcional)</li>
                </ul>

                <h5 className="font-bold text-white mt-4 mb-1">2.2 Dados de Contato</h5>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Endereço eletrônico (e-mail)</li>
                  <li>Número de telefone celular/comercial</li>
                </ul>

                <h5 className="font-bold text-white mt-4 mb-1">2.3 Dados de Acesso e Uso</h5>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Histórico de login e acessos (data, hora, dispositivo)</li>
                  <li>Padrões de navegação na plataforma</li>
                  <li>Funcionalidades utilizadas</li>
                  <li>Preferências de configuração</li>
                  <li>Dados de interação com a assistente Coinzinha</li>
                </ul>

                <h5 className="font-bold text-white mt-4 mb-1">2.4 Dados Financeiros</h5>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Informações de contas bancárias e de pagamento (agregadas via Open Finance)</li>
                  <li>Histórico de transações, despesas e receitas</li>
                  <li>Saldos e limites de crédito</li>
                  <li>Dados de cartão de crédito/débito (somente em Planos Pro/Family, de forma criptografada)</li>
                  <li>Metas financeiras e planejamento pessoal</li>
                </ul>

                <h5 className="font-bold text-white mt-4 mb-1">2.5 Dados Técnicos</h5>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Endereço IP (Internet Protocol)</li>
                  <li>Tipo e versão de navegador/dispositivo</li>
                  <li>Logs de acesso e erros</li>
                  <li>Cookies e tecnologias similares</li>
                  <li>Identificadores únicos de dispositivo</li>
                </ul>
              </section>

              <section>
                <h4 className="font-bold text-white mb-2 text-base">3. Finalidades de Tratamento</h4>
                <p>A Controlar+ utilizará os dados pessoais para:</p>

                <h5 className="font-bold text-white mt-4 mb-1">3.1 Execução do Contrato</h5>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Criar, manter e gerenciar a conta do Usuário</li>
                  <li>Autenticar e permitir acesso às funcionalidades</li>
                  <li>Prestar os serviços contratados (organização financeira, dashboards, metas, alertas)</li>
                  <li>Processar cobranças de assinaturas (Planos Pro/Family)</li>
                  <li>Emitir recibos, notas e comprovantes de pagamento</li>
                  <li>Fornecer suporte técnico e atendimento ao cliente</li>
                  <li>Registrar transações e manter histórico de operações</li>
                </ul>

                <h5 className="font-bold text-white mt-4 mb-1">3.2 Personalização e Melhoria do Serviço</h5>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Personalizar a experiência do Usuário na plataforma</li>
                  <li>Fornecer recomendações, insights e sugestões via assistente Coinzinha, baseadas apenas nos dados do próprio Usuário</li>
                  <li>Otimizar funcionalidades, fluxos de interface e performance</li>
                  <li>Realizar análises de uso (em formato agregado e anonimizado) para melhorias do produto</li>
                  <li>Testar novas funcionalidades</li>
                </ul>
                <p className="mt-2 text-gray-400 italic">Importante: A Coinzinha utiliza dados financeiros do Usuário exclusivamente para personalizar a experiência daquele Usuário específico. A IA não é treinada com dados pessoais identificáveis de outros Usuários e não alimenta modelos gerais com dados sensíveis não anonimizados.</p>

                <h5 className="font-bold text-white mt-4 mb-1">3.3 Comunicações</h5>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Enviar comunicações transacionais obrigatórias (confirmações, avisos de segurança, alertas de pagamento, alterações de Termos)</li>
                  <li>Enviar comunicações de marketing, ofertas, promoções e novidades, quando consentimento for obtido ou, conforme legislação aplicável</li>
                  <li>Responder a dúvidas, sugestões e reclamações</li>
                  <li>Notificar sobre atualizações de produtos e recursos</li>
                </ul>

                <h5 className="font-bold text-white mt-4 mb-1">3.4 Conformidade e Proteção de Direitos</h5>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Cumprir obrigações legais e regulatórias (ex.: Lei de Proteção ao Consumidor, LGPD, Marco Civil da Internet)</li>
                  <li>Detectar, investigar e prevenir atividades fraudulentas, abuso, violação de Termos de Uso</li>
                  <li>Resguardar direitos legais da Controlar+ em eventuais disputes, arbitragem ou ações judiciais</li>
                  <li>Responder a ordens judiciais, solicitações de autoridades públicas ou órgãos reguladores</li>
                </ul>

                <h5 className="font-bold text-white mt-4 mb-1">3.5 Open Finance</h5>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Facilitar integração com instituições financeiras via plataformas de Open Finance autorizadas</li>
                  <li>Acessar dados de contas bancárias e transações do Usuário mediante consentimento específico</li>
                  <li>Sincronizar e exibir informações financeiras consolidadas</li>
                </ul>
              </section>

              <section>
                <h4 className="font-bold text-white mb-2 text-base">4. Bases Legais</h4>
                <p>O tratamento de dados pessoais pela Controlar+ é fundamentado em:</p>

                <h5 className="font-bold text-white mt-4 mb-1">4.1 Execução de Contrato</h5>
                <p>Tratamento necessário à celebração, execução e cumprimento do contrato de uso da plataforma (art. 7º, inciso I da LGPD).</p>

                <h5 className="font-bold text-white mt-4 mb-1">4.2 Cumprimento de Obrigação Legal</h5>
                <p>Tratamento necessário ao cumprimento de obrigações legais e regulatórias impostas ao negócio, incluindo a própria LGPD, Código de Defesa do Consumidor, Marco Civil da Internet e regulações do setor financeiro (art. 7º, inciso II da LGPD).</p>

                <h5 className="font-bold text-white mt-4 mb-1">4.3 Interesse Legítimo</h5>
                <p>Em casos específicos, quando o interesse da Controlar+ for compatível e balanceado com direitos e liberdades do titular, incluindo:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Prevenção à fraude e segurança da plataforma</li>
                  <li>Melhoria contínua de produtos e serviços</li>
                  <li>Análise de dados em formato agregado e anonimizado</li>
                  <li>Marketing e comunicação comercial (quando permitido)</li>
                  <li>Defesa de direitos em processos judiciais</li>
                </ul>
                <p className="mt-1">(Art. 7º, inciso IX da LGPD)</p>

                <h5 className="font-bold text-white mt-4 mb-1">4.4 Consentimento</h5>
                <p>Para finalidades não estritamente necessárias ao contrato ou legais, como certas comunicações de marketing direto e armazenamento de cookies de análise, a Controlar+ poderá solicitar consentimento específico do Usuário, que poderá ser revogado a qualquer momento.</p>
                <p className="mt-1">(Art. 7º, inciso VIII da LGPD)</p>
              </section>

              <section>
                <h4 className="font-bold text-white mb-2 text-base">5. Compartilhamento de Dados</h4>
                <p>A Controlar+ poderá compartilhar dados pessoais com:</p>

                <h5 className="font-bold text-white mt-4 mb-1">5.1 Operadores de Dados</h5>
                <p>Fornecedores e prestadores de serviços contratados que atuam como "operadores de dados" sob supervisão e contrato de proteção de dados, incluindo:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Provedores de Pagamento e Cobrança: Asaas e similares, para processamento de cobranças recorrentes</li>
                  <li>Hospedagem em Nuvem: provedores de infraestrutura, armazenamento e backup em nuvem</li>
                  <li>Ferramentas de Análise: plataformas de analytics, monitoramento de erros e performance</li>
                  <li>Suporte e Atendimento: plataformas de helpdesk, chat e email para comunicação com Usuários</li>
                  <li>Open Finance: instituições financeiras e plataformas de Open Finance para integração e acesso a dados bancários</li>
                </ul>

                <h5 className="font-bold text-white mt-4 mb-1">5.2 Compartilhamento Obrigatório</h5>
                <p>Em cumprimento a obrigações legais ou ordem de autoridade pública:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Autoridades fiscais e tributárias</li>
                  <li>Órgãos reguladores (ex.: Banco Central, CVM, ANPD)</li>
                  <li>Autoridades judiciais (ex.: em resposta a mandados de busca, cartas precatórias)</li>
                  <li>Órgãos de segurança pública e inteligência</li>
                </ul>

                <h5 className="font-bold text-white mt-4 mb-1">5.3 Transferências Internacionais</h5>
                <p>Caso dados sejam transmitidos para servidores ou operadores localizados fora do Brasil, a Controlar+ assegurará o mesmo nível de proteção requerido pela LGPD, mediante:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Cláusulas contratuais padrão</li>
                  <li>Certificações internacionais (ex.: Privacy Shield, Standard Contractual Clauses)</li>
                  <li>Adequação legal</li>
                </ul>

                <h5 className="font-bold text-white mt-4 mb-1">5.4 Não Comercialização de Dados</h5>
                <p>A Controlar+ não comercializa, vende, aluga ou cede dados pessoais de Usuários a terceiros para fins comerciais ou de marketing direto sem consentimento expresso.</p>
              </section>

              <section>
                <h4 className="font-bold text-white mb-2 text-base">6. Segurança da Informação</h4>
                <p>A Controlar+ implementará medidas técnicas e administrativas para proteger dados pessoais, incluindo:</p>

                <h5 className="font-bold text-white mt-4 mb-1">6.1 Medidas Técnicas</h5>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Criptografia de dados em trânsito (HTTPS/TLS) e em repouso (AES-256 ou equivalente)</li>
                  <li>Tokenização de dados sensíveis (ex.: cartões de pagamento)</li>
                  <li>Firewalls e sistemas de detecção de intrusão</li>
                  <li>Backups regulares e planos de recuperação de desastres</li>
                  <li>Atualização contínua de sistemas contra vulnerabilidades conhecidas</li>
                </ul>

                <h5 className="font-bold text-white mt-4 mb-1">6.2 Medidas Administrativas</h5>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Controle de acesso restritivo a dados pessoais</li>
                  <li>Autenticação multifatorial para acesso administrativo</li>
                  <li>Treinamento de colaboradores em proteção de dados e segurança</li>
                  <li>Procedimentos de segregação de funções</li>
                  <li>Políticas de confidencialidade contratual</li>
                </ul>

                <h5 className="font-bold text-white mt-4 mb-1">6.3 Limitações</h5>
                <p>Nenhum sistema de segurança é absolutamente à prova de falhas. Embora a Controlar+ se empenhe em proteger dados, não pode garantir segurança absoluta. O Usuário também é responsável por:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Manter a confidencialidade de suas credenciais</li>
                  <li>Não acessar a plataforma em redes Wi-Fi públicas ou não seguras</li>
                  <li>Manter seu dispositivo protegido contra malware</li>
                  <li>Notificar a Controlar+ imediatamente em caso de comprometimento</li>
                </ul>
              </section>

              <section>
                <h4 className="font-bold text-white mb-2 text-base">7. Retenção e Exclusão de Dados</h4>
                <h5 className="font-bold text-white mt-4 mb-1">7.1 Período de Retenção</h5>
                <p>A Controlar+ reterá dados pessoais apenas pelo tempo necessário para:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Cumprir as finalidades descritas nesta Política</li>
                  <li>Cumprir obrigações legais e regulatórias aplicáveis</li>
                  <li>Exercer direitos legais em caso de disputes ou processos judiciais</li>
                  <li>Período de guarda contábil e fiscal exigido por lei</li>
                </ul>

                <h5 className="font-bold text-white mt-4 mb-1">7.2 Exclusão Definitiva</h5>
                <p>Caso o Usuário solicite a exclusão definitiva de sua conta, a Controlar+ procederá à remoção irreversível de todos os dados pessoais associados, incluindo:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Dados cadastrais (nome, CPF, CEP, e-mail, telefone)</li>
                  <li>Histórico financeiro e transações</li>
                  <li>Dados de acesso e uso</li>
                  <li>Dados de cartão de pagamento (se houver)</li>
                </ul>
                <p className="mt-2">Exceção: A Controlar+ poderá manter registros minimamente necessários para:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Cumprimento de obrigações legais (ex.: retenção fiscal por 5 anos)</li>
                  <li>Exercício de direitos legais em eventual litígio</li>
                  <li>Prevenção à fraude (registros de identificação para bloqueio de conta)</li>
                </ul>
                <p className="mt-2">Tais dados serão mantidos isolados e com acesso restrito.</p>

                <h5 className="font-bold text-white mt-4 mb-1">7.3 Prazo Diferenciado</h5>
                <p>Não havendo exigência legal de retenção, os dados pessoais serão excluídos ou anonimizados de forma irreversível imediatamente após a solicitação de exclusão da conta.</p>
              </section>

              <section>
                <h4 className="font-bold text-white mb-2 text-base">8. Cookies e Tecnologias de Rastreamento</h4>
                <h5 className="font-bold text-white mt-4 mb-1">8.1 Uso de Cookies</h5>
                <p>A Controlar+ poderá utilizar cookies e tecnologias similares (web beacons, pixels, identificadores locais) para:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Manter autenticação e sessão do Usuário</li>
                  <li>Armazenar preferências de idioma e interface</li>
                  <li>Coletar dados analíticos de uso da plataforma</li>
                  <li>Personalizar conteúdo e anúncios</li>
                </ul>

                <h5 className="font-bold text-white mt-4 mb-1">8.2 Tipos de Cookies</h5>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Cookies Essenciais: necessários ao funcionamento básico da plataforma (autenticação, segurança)</li>
                  <li>Cookies de Performance: coletam dados sobre como o Usuário utiliza a plataforma (Google Analytics ou equivalente)</li>
                  <li>Cookies de Personalização: armazenam preferências do Usuário</li>
                  <li>Cookies de Marketing: rastreamento de campanhas e efetividade de anúncios</li>
                </ul>

                <h5 className="font-bold text-white mt-4 mb-1">8.3 Consentimento</h5>
                <p>O Usuário poderá controlar cookies nas configurações do navegador. Alguns cookies são essenciais; outros requerem consentimento prévio.</p>
              </section>

              <section>
                <h4 className="font-bold text-white mb-2 text-base">9. Direitos do Titular de Dados</h4>
                <p>Nos termos da LGPD e da legislação aplicável, o Usuário/Titular de Dados poderá exercer os seguintes direitos:</p>

                <h5 className="font-bold text-white mt-4 mb-1">9.1 Direito de Confirmação e Acesso</h5>
                <p>Solicitar confirmação se seus dados estão sendo tratados e acessar cópia de tais dados em formato legível.</p>

                <h5 className="font-bold text-white mt-4 mb-1">9.2 Direito de Correção</h5>
                <p>Solicitar retificação de dados incompletos, inexatos, desatualizados ou inadequados, sem prejuízo de outras disposições legais.</p>

                <h5 className="font-bold text-white mt-4 mb-1">9.3 Direito à Portabilidade</h5>
                <p>Obter cópia de seus dados pessoais em formato estruturado, comumente utilizado e legível por máquina (ex.: planilha Excel, JSON, CSV), para fins de transferência a outro controlador, quando tecnicamente viável.</p>

                <h5 className="font-bold text-white mt-4 mb-1">9.4 Direito à Exclusão</h5>
                <p>Solicitar a exclusão de seus dados pessoais, observadas as hipóteses legais de manutenção mínima (obrigações legais, exercício de direitos em processos).</p>

                <h5 className="font-bold text-white mt-4 mb-1">9.5 Direito de Oposição</h5>
                <p>Opor-se ao tratamento baseado em interesse legítimo, inclusive para fins de marketing direto, devendo a Controlar+ cessar o tratamento em tal finalidade.</p>

                <h5 className="font-bold text-white mt-4 mb-1">9.6 Direito de Revogação de Consentimento</h5>
                <p>Revogar consentimento para tratamentos que dependem de consentimento, sem retroatividade. O Usuário poderá optar por não receber comunicações de marketing a qualquer momento.</p>

                <h5 className="font-bold text-white mt-4 mb-1">9.7 Direito a Informações sobre Tratamento</h5>
                <p>Solicitar informações sobre como seus dados são processados, quais são seus recipientes e por quanto tempo serão retidos.</p>
              </section>

              <section>
                <h4 className="font-bold text-white mb-2 text-base">10. Como Exercer Direitos de Dados</h4>
                <p>O Usuário poderá exercer seus direitos entrando em contato com o Encarregado de Proteção de Dados (DPO) da Controlar+ pelo e-mail:</p>
                <p className="font-medium text-[#d97757] mt-1">rafael.maldanis@controlarmais.com.br</p>
                <p className="mt-2">A solicitação deverá conter:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Identificação clara do Usuário (nome, CPF, e-mail cadastrado)</li>
                  <li>Descrição específica do direito que deseja exercer</li>
                  <li>Informações adicionais que auxiliem na localização dos dados</li>
                </ul>
                <p className="mt-2">A Controlar+ responderá à solicitação no prazo máximo de 15 (quinze) dias úteis, prorrogável por mais 15 (quinze) dias se a complexidade exigir, com notificação prévia ao Usuário.</p>
              </section>

              <section>
                <h4 className="font-bold text-white mb-2 text-base">11. Politica de Cookies – Consentimento</h4>
                <p>O Usuário poderá ajustar suas preferências de cookies:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Cookies Obrigatórios: sempre ativados (necessários ao funcionamento)</li>
                  <li>Cookies de Analytics: podem ser desativados pelo Usuário nas configurações</li>
                  <li>Cookies de Marketing: requerem consentimento explícito prévio</li>
                </ul>
                <p className="mt-2">O Usuário poderá revogar consentimentos de cookies alterando suas configurações de navegador ou entrando em contato com o DPO.</p>
              </section>

              <section>
                <h4 className="font-bold text-white mb-2 text-base">12. Alterações e Atualizações da Política</h4>
                <p>A Controlar+ poderá atualizar esta Política de Privacidade a qualquer tempo. Alterações substanciais serão comunicadas:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Via e-mail ao Usuário</li>
                  <li>Mediante aviso na plataforma</li>
                  <li>Com prazo mínimo de 30 (trinta) dias para revisão</li>
                </ul>
                <p className="mt-2">A continuidade do uso após publicação das alterações implica aceitação da Política revisada. O Usuário poderá descontinuar o uso se discordar das mudanças.</p>
              </section>

              <section>
                <h4 className="font-bold text-white mb-2 text-base">13. Legislação Aplicável e Jurisdição</h4>
                <p>Esta Política de Privacidade é regida pela Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018), bem como demais leis brasileiras de proteção ao consumidor, privacidade e proteção de dados.</p>
                <p className="mt-2">Questões relativas ao tratamento de dados pessoais são de competência da Autoridade Nacional de Proteção de Dados (ANPD), sem prejuízo de jurisdição judicial em caso de conflito.</p>
                <p className="mt-2">Fica eleito o foro da comarca de São Bernardo do Campo/SP como competente para controvérsias decorrentes desta Política.</p>
              </section>

              <section>
                <h4 className="font-bold text-white mb-2 text-base">14. Contato e Suporte</h4>
                <p>Para dúvidas, sugestões ou reclamações quanto a esta Política de Privacidade e ao tratamento de dados pessoais, o Usuário poderá contatar:</p>
                <div className="mt-2 bg-[#272725]/50 p-4 rounded-lg border border-[#373734]">
                  <p className="font-bold text-white">Encarregado de Proteção de Dados (DPO)</p>
                  <p className="text-gray-400">E-mail: <span className="text-[#d97757]">rafael.maldanis@controlarmais.com.br</span></p>
                  <p className="text-gray-400 mt-2">Controlar Mais LTDA</p>
                  <p className="text-gray-400">São Bernardo do Campo/SP</p>
                  <p className="text-gray-400">Brasil</p>
                </div>
              </section>

              <div className="text-xs text-gray-500 mt-8 pt-4 border-t border-gray-800">
                <p>Versão: 1.0</p>
              </div>
            </div>

          </motion.div>
        </div>,
        document.body
      )}
    </div>
  );
};