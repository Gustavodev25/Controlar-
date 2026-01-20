import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, ChevronLeft, User, Check, FileText, Phone, Sparkles } from 'lucide-react';
import { useToasts } from './Toast';
import { ShiningText } from './ShiningText';
import { auth } from '../services/firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { updateUserProfile, getUserProfile } from '../services/database';
import { AnimatedGridPattern } from './AnimatedGridPattern';
import { TestimonialsColumn } from './novalandingpage/Testimonials';
import { UniversalModal } from './UniversalModal';
import { CustomDatePicker } from './UIComponents';
import { Button } from './Button';



const testimonials = [
    {
        text: "O Controlar+ mudou completamente a forma como lido com meu dinheiro. A clareza que tenho agora é impressionante!",
        image: "https://randomuser.me/api/portraits/men/32.jpg",
        name: "Carlos Eduardo",
        role: "Designer Gráfico",
    },
    {
        text: "Finalmente consegui organizar minhas faturas de cartão de crédito. O sistema é muito intuitivo e fácil de usar.",
        image: "https://randomuser.me/api/portraits/women/44.jpg",
        name: "Fernanda Lima",
        role: "Engenheira Civil",
    },
    {
        text: "A integração automática com os bancos me poupa horas todos os meses. Recomendo demais!",
        image: "https://randomuser.me/api/portraits/men/86.jpg",
        name: "Ricardo Souza",
        role: "Desenvolvedor",
    },
    {
        text: "Interface linda e muito fluida. Dá gosto de entrar para ver as finanças.",
        image: "https://randomuser.me/api/portraits/women/68.jpg",
        name: "Maria Antonieta",
        role: "Arquiteta",
    },
    {
        text: "O suporte é incrível e as funcionalidades de IA me ajudam a prever gastos futuros. Sensacional.",
        image: "https://randomuser.me/api/portraits/men/62.jpg",
        name: "João Pedro",
        role: "Empresário",
    },
    {
        text: "Simplesmente o melhor gerenciador financeiro que já usei. Vale cada centavo.",
        image: "https://randomuser.me/api/portraits/women/90.jpg",
        name: "Jéssica Alves",
        role: "Marketing",
    },
];

const LoginTestimonialsColumn = (props: {
    className?: string;
    testimonials: typeof testimonials;
    duration?: number;
}) => {
    return (
        <div className={props.className}>
            <motion.div
                animate={{
                    translateY: "-50%",
                }}
                transition={{
                    duration: props.duration || 10,
                    repeat: Infinity,
                    ease: "linear",
                    repeatType: "loop",
                }}
                className="flex flex-col gap-6 pb-6"
            >
                {[
                    ...new Array(2).fill(0).map((_, index) => (
                        <React.Fragment key={index}>
                            {props.testimonials.map(({ text, image, name, role }, i) => (
                                <div
                                    className="rounded-[24px] border border-white/10 p-6 relative overflow-hidden shadow-[0_8px_40px_-10px_rgba(0,0,0,0.6)] flex flex-col gap-6 max-w-xs w-full"
                                    key={i}
                                    style={{
                                        backgroundColor: "rgba(10, 10, 10, 0.65)",
                                        backdropFilter: "blur(24px) saturate(180%)",
                                        WebkitBackdropFilter: "blur(24px) saturate(180%)",
                                    }}
                                >
                                    {/* Textura Noise */}
                                    <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] contrast-125" />

                                    {/* Borda Superior Brilhante */}
                                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />

                                    <div className="relative z-10 flex flex-col gap-6">
                                        <div className="text-[#faf9f5] leading-relaxed text-sm font-medium">{text}</div>
                                        <div className="flex items-center gap-3">
                                            <img
                                                width={40}
                                                height={40}
                                                src={image}
                                                alt={name}
                                                className="h-10 w-10 rounded-full bg-neutral-800 object-cover"
                                            />
                                            <div className="flex flex-col">
                                                <div className="font-bold tracking-tight text-[#faf9f5] leading-5 text-sm">{name}</div>
                                                <div className="leading-5 text-neutral-500 tracking-tight text-xs font-medium">{role}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </React.Fragment>
                    )),
                ]}
            </motion.div>
        </div>
    );
};


interface SubscribeData {
    planId: 'pro';
    billingCycle: 'monthly' | 'annual';
    couponCode?: string;
}

interface LoginNewProps {
    onSubscribe?: (data: SubscribeData) => void;
    initialView?: 'login' | 'signup';
}

export const LoginNew: React.FC<LoginNewProps> = ({ onSubscribe, initialView = 'login' }) => {
    const toast = useToasts();
    const [isLogin, setIsLogin] = useState(initialView === 'login');
    const [step, setStep] = useState(1);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [showTerms, setShowTerms] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Password Recovery State
    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const [recoveryStep, setRecoveryStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
    const [newPassword, setNewPassword] = useState('');
    const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Form States
    const [formData, setFormData] = useState({
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

    const [isCepLoading, setIsCepLoading] = useState(false);
    const [showAddressFields, setShowAddressFields] = useState(false);

    useEffect(() => {
        if (isResettingPassword && recoveryStep === 2) {
            setOtp(new Array(6).fill(""));
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
    }, [isResettingPassword, recoveryStep]);

    // Helpers
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
                    setShowAddressFields(true); // Allow manual entry
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
        setFormData({ ...formData, cep: formatted });
        if (formatted.replace(/\D/g, '').length === 8) {
            fetchCepData(formatted);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (!auth) throw new Error("Auth não inicializado");

            if (isResettingPassword) {
                // --- RECOVERY FLOW ---
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
                    }
                    setIsLoading(false);
                    return;
                }

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
                    }
                    setIsLoading(false);
                    return;
                }

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

                        if (!data.requiresClientReset && !data.requiresFirebaseLink) {
                            toast.success("Senha redefinida com sucesso!");
                            setIsResettingPassword(false);
                            setRecoveryStep(1);
                            setNewPassword('');
                            setOtp(new Array(6).fill(""));
                            setIsLogin(true);
                            setFormData(prev => ({ ...prev, password: '' }));
                        } else if (data.requiresFirebaseLink) {
                            toast.success("Verifique seu email! Link enviado.");
                            setIsResettingPassword(false);
                            setRecoveryStep(1);
                            setIsLogin(true);
                        } else {
                            await sendPasswordResetEmail(auth, formData.email);
                            toast.success("Email de redefinição enviado.");
                            setIsResettingPassword(false);
                            setRecoveryStep(1);
                            setIsLogin(true);
                        }
                    } catch (error: any) {
                        toast.error(error.message);
                    }
                    setIsLoading(false);
                    return;
                }
                return;
            }

            if (isLogin) {
                // LOGIN FLOW
                if (!formData.email || !formData.password) {
                    toast.error('Preencha todos os campos.');
                    setIsLoading(false);
                    return;
                }
                await signInWithEmailAndPassword(auth, formData.email, formData.password);
                window.location.href = '/dashboard';
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

                // Step 2 Validation
                if (!validateCPF(formData.cpf)) {
                    toast.error("CPF inválido.");
                    setIsLoading(false);
                    return;
                }
                if (!formData.birthDate || !formData.cep || !formData.street || !formData.number || !formData.city || !formData.state || !formData.phone) {
                    toast.error("Preencha todos os campos obrigatórios.");
                    setIsLoading(false);
                    return;
                }
                if (formData.phone.replace(/\D/g, '').length < 10) {
                    toast.error("Telefone inválido.");
                    setIsLoading(false);
                    return;
                }
                if (!acceptedTerms) {
                    toast.error("Você precisa aceitar os Termos de Uso.");
                    setIsLoading(false);
                    return;
                }

                localStorage.setItem('is_new_signup', 'true');
                const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);

                if (userCredential.user) {
                    await updateProfile(userCredential.user, { displayName: formData.name });
                    await updateUserProfile(userCredential.user.uid, {
                        name: formData.name,
                        email: formData.email,
                        phone: formData.phone,
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
                        },
                        subscription: {
                            plan: 'pro',
                            status: 'trial',
                            billingCycle: 'monthly',
                            trialStartedAt: new Date().toISOString(),
                            trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                        },
                        createdAt: new Date().toISOString()
                    });
                    // Success - Redirect handled by auth listener or we can force it
                    window.location.href = '/dashboard';
                }
            }
        } catch (err: any) {
            console.error(err);
            let msg = "Ocorreu um erro. Tente novamente.";
            if (err.code === 'auth/email-already-in-use') msg = "Este e-mail já está em uso.";
            else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') msg = "E-mail ou senha incorretos.";
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        // setError(''); // Removed error state, using toast
        try {
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
                    isAdmin: false,
                    subscription: {
                        plan: 'pro',
                        status: 'trial',
                        billingCycle: 'monthly',
                        trialStartedAt: new Date().toISOString(),
                        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                    },
                    createdAt: new Date().toISOString()
                });
                localStorage.setItem('is_new_signup', 'true');
            }

            window.location.href = '/dashboard';
        } catch (err: any) {
            console.error(err);
            // setError("Erro ao conectar com Google."); // Removed error state, using toast
            toast.error("Erro ao conectar com Google.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-[#1a0f0a] text-[#faf9f5] font-sans selection:bg-[#d97757]/30 relative overflow-hidden bg-[radial-gradient(ellipse_60%_40%_at_50%_40%,_#3a1a10_0%,_#1a0f0a_100%)]">

            {/* Grid Animado de Fundo */}
            <AnimatedGridPattern
                width={60}
                height={60}
                numSquares={20}
                maxOpacity={0.08}
                duration={4}
                repeatDelay={2}
                className="[mask-image:radial-gradient(ellipse_50%_50%_at_50%_40%,white_0%,transparent_70%)] fill-white/5 stroke-white/[0.03]"
            />

            {/* LEFT SIDE - Testimonials (Hidden on Mobile) */}
            <div className="hidden lg:flex w-1/2 h-screen items-center justify-center relative z-10 p-12 overflow-hidden mask-image-gradient">
                <div className="grid grid-cols-2 gap-6 h-[120vh] -rotate-6 scale-90 opacity-80">
                    <LoginTestimonialsColumn testimonials={testimonials} duration={20} />
                    <LoginTestimonialsColumn testimonials={[...testimonials].reverse()} duration={25} />
                </div>
            </div>

            {/* RIGHT SIDE - Form */}
            <div className="w-full lg:w-1/2 h-screen flex items-center justify-center p-6 relative z-10">
                <motion.div
                    layout
                    initial="hidden"
                    animate="visible"
                    variants={{
                        hidden: { opacity: 0, scale: 0.95 },
                        visible: {
                            opacity: 1,
                            scale: 1,
                            transition: {
                                delayChildren: 0.2,
                                staggerChildren: 0.1
                            }
                        }
                    }}
                    transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30
                    }}
                    className="w-full max-w-[420px] rounded-[24px] border border-white/10 p-8 relative z-10 overflow-hidden shadow-[0_8px_40px_-10px_rgba(0,0,0,0.6)]"
                    style={{
                        backgroundColor: "rgba(10, 10, 10, 0.65)",
                        backdropFilter: "blur(24px) saturate(180%)",
                        WebkitBackdropFilter: "blur(24px) saturate(180%)",
                    }}
                >
                    {/* Noise & Glow */}
                    <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] contrast-125" />
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />

                    <motion.div
                        layout="position"
                        className="text-left mb-8"
                    >
                        {/* Trial Banner - Only visible on Signup */}
                        {!isLogin && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="-mt-8 -mx-8 mb-8 bg-[#d97757]/15 border-b border-[#d97757]/10 p-3 flex items-center justify-center text-center relative overflow-hidden backdrop-blur-sm"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-[#d97757]/10 via-transparent to-[#d97757]/10 opacity-30" />
                                <div className="relative z-10">
                                    <p className="text-[#d97757] text-xs font-bold leading-tight tracking-wide uppercase">
                                        Oferta Especial: 14 Dias de Teste Grátis
                                    </p>
                                </div>
                            </motion.div>
                        )}
                        {/* Back Button inline with title */}
                        {((!isLogin && step === 2) || (isResettingPassword && recoveryStep > 0)) && (
                            <button
                                onClick={() => {
                                    if (isResettingPassword) {
                                        if (recoveryStep === 1) setIsResettingPassword(false);
                                        else setRecoveryStep(prev => prev - 1);
                                    } else {
                                        setStep(1);
                                    }
                                }}
                                className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors mb-4 -ml-1"
                            >
                                <ChevronLeft size={18} />
                                <span className="text-sm">Voltar</span>
                            </button>
                        )}

                        <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
                            {isResettingPassword ? (
                                recoveryStep === 1 ? 'Recuperar Senha' :
                                    recoveryStep === 2 ? 'Digite o Código' : 'Nova Senha'
                            ) : (
                                isLogin ? <span>Boas-vindas ao <ShiningText text="Controlar+" /></span> : 'Crie sua conta'
                            )}
                        </h1>
                        <p className="text-gray-400 text-sm">
                            {isResettingPassword ? (
                                recoveryStep === 1 ? 'Digite seu e-mail para receber o código.' :
                                    recoveryStep === 2 ? 'Enviamos um código para seu e-mail.' : 'Crie uma nova senha segura.'
                            ) : (
                                isLogin
                                    ? 'Acesse sua conta para continuar.'
                                    : step === 1
                                        ? 'Preencha seus dados iniciais.'
                                        : 'Finalize seu cadastro.'
                            )}
                        </p>
                    </motion.div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <AnimatePresence mode="wait">
                            {isResettingPassword ? (
                                <motion.div
                                    key={`reset-step-${recoveryStep}`}
                                    initial={{ opacity: 0, filter: "blur(10px)" }}
                                    animate={{ opacity: 1, filter: "blur(0px)" }}
                                    exit={{ opacity: 0, filter: "blur(10px)" }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-4"
                                >
                                    {recoveryStep === 1 && (
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-wider">E-mail</label>
                                            <div className="relative group">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors"><Mail size={18} /></div>
                                                <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="seu@email.com" className="input-primary pl-11 bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]" />
                                            </div>
                                        </div>
                                    )}

                                    {recoveryStep === 2 && (
                                        <div className="space-y-4">
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
                                                        className="w-12 h-14 text-center text-xl font-bold rounded-xl bg-gray-900/50 border border-gray-800 text-white focus:border-[#d97757] focus:ring-1 focus:ring-[#d97757] focus:bg-gray-900 outline-none transition-all"
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {recoveryStep === 3 && (
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-wider">Nova Senha</label>
                                            <div className="relative group">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors"><Lock size={18} /></div>
                                                <input
                                                    type="password"
                                                    required
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    placeholder="••••••••"
                                                    className="input-primary pl-11 bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            ) : isLogin ? (
                                /* LOGIN FIELDS */
                                <motion.div
                                    key="login-fields"
                                    initial={{ opacity: 0, filter: "blur(10px)" }}
                                    animate={{ opacity: 1, filter: "blur(0px)" }}
                                    exit={{ opacity: 0, filter: "blur(10px)" }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-4"
                                >
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-wider">E-mail</label>
                                        <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors"><Mail size={18} /></div>
                                            <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="seu@email.com" className="input-primary pl-11 bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]" />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center pl-1 pr-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Senha</label>
                                            <button type="button" onClick={() => { setIsResettingPassword(true); setRecoveryStep(1); }} className="text-[10px] text-[#d97757] hover:text-orange-400 transition-colors font-medium">Esqueceu?</button>
                                        </div>
                                        <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors"><Lock size={18} /></div>
                                            <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••" className="input-primary pl-11 bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]" />
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                /* REGISTER FIELDS */
                                step === 1 ? (
                                    <motion.div
                                        key="register-step1"
                                        initial={{ opacity: 0, filter: "blur(10px)" }}
                                        animate={{ opacity: 1, filter: "blur(0px)" }}
                                        exit={{ opacity: 0, filter: "blur(10px)" }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-4"
                                    >
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-wider">Nome Completo</label>
                                            <div className="relative group">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors"><User size={18} /></div>
                                                <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Seu nome" className="input-primary pl-11 bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]" />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-wider">E-mail</label>
                                            <div className="relative group">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors"><Mail size={18} /></div>
                                                <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="seu@email.com" className="input-primary pl-11 bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]" />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-wider">Senha</label>
                                            <div className="relative group">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors"><Lock size={18} /></div>
                                                <input type="password" required value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••" className="input-primary pl-11 bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]" />
                                            </div>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="register-step2"
                                        initial={{ opacity: 0, filter: "blur(10px)" }}
                                        animate={{ opacity: 1, filter: "blur(0px)" }}
                                        exit={{ opacity: 0, filter: "blur(10px)" }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-4"
                                    >
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-wider">CPF</label>
                                                <input type="text" maxLength={14} required value={formatCPF(formData.cpf)} onChange={(e) => setFormData({ ...formData, cpf: e.target.value })} placeholder="000.000.000-00" className="input-primary bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-wider">Data Nasc.</label>
                                                <CustomDatePicker
                                                    value={formData.birthDate}
                                                    onChange={(val) => setFormData({ ...formData, birthDate: val })}
                                                    placeholder="dd/mm/aaaa"
                                                    dropdownMode="fixed"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-wider">CEP</label>
                                            <input type="text" maxLength={9} required value={formData.cep} onChange={handleCepChange} placeholder="00000-000" className="input-primary bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]" />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-wider">Telefone / WhatsApp <span className="text-[#d97757]">*</span></label>
                                            <div className="relative group">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors"><Phone size={18} /></div>
                                                <input type="text" maxLength={15} required value={formatPhone(formData.phone)} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="(00) 90000-0000" className="input-primary pl-11 bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]" />
                                            </div>
                                        </div>

                                        <AnimatePresence>
                                            {showAddressFields && (
                                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4 overflow-hidden">
                                                    <div className="flex gap-4">
                                                        <div className="w-2/3 space-y-1.5">
                                                            <label className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-wider">Rua</label>
                                                            <input type="text" required value={formData.street} onChange={(e) => setFormData({ ...formData, street: e.target.value })} className="input-primary bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]" />
                                                        </div>
                                                        <div className="w-1/3 space-y-1.5">
                                                            <label className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-wider">Número</label>
                                                            <input type="text" required value={formData.number} onChange={(e) => setFormData({ ...formData, number: e.target.value })} className="input-primary bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]" />
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-4">
                                                        <div className="w-1/2 space-y-1.5">
                                                            <label className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-wider">Cidade</label>
                                                            <input type="text" required value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="input-primary bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]" />
                                                        </div>
                                                        <div className="w-1/2 space-y-1.5">
                                                            <label className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-wider">Estado</label>
                                                            <input type="text" required value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} className="input-primary bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]" />
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

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
                                    </motion.div>
                                )
                            )}
                        </AnimatePresence>

                        <Button
                            type="submit"
                            isLoading={isLoading}
                            fullWidth
                            size="lg"
                            className="mt-4 relative z-20"
                        >
                            {isResettingPassword
                                ? (recoveryStep === 1 ? 'Enviar Código' : recoveryStep === 2 ? 'Verificar Código' : 'Redefinir Senha')
                                : (isLogin ? 'Entrar' : (step === 1 ? 'Continuar' : 'Finalizar Cadastro'))
                            }
                        </Button>
                    </form>

                    <motion.p layout className="mt-8 text-left text-xs text-gray-500">
                        {isResettingPassword ? (
                            <a
                                href="#"
                                onClick={(e) => { e.preventDefault(); setIsResettingPassword(false); setRecoveryStep(1); setIsLogin(true); }}
                                className="font-bold text-white hover:text-[#d97757] transition-colors ml-1"
                            >
                                Voltar para Login
                            </a>
                        ) : (
                            <>
                                {isLogin ? 'Ainda não tem conta?' : 'Já tem uma conta?'}
                                <a
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setIsLogin(!isLogin);
                                        setStep(1);
                                    }}
                                    className="font-bold text-white hover:text-[#d97757] transition-colors ml-1"
                                >
                                    {isLogin ? 'Criar agora' : 'Fazer login'}
                                </a>
                            </>
                        )}
                    </motion.p>
                </motion.div>
            </div>

            {/* Footer Text */}
            <div className="absolute bottom-6 right-0 w-1/2 text-center z-10 text-[10px] text-gray-600 hidden lg:block">
                © {new Date().getFullYear()} Controlar+. Todos os direitos reservados.
            </div>

            {/* Terms Modal - Using UniversalModal */}
            <UniversalModal
                isOpen={showTerms}
                onClose={() => setShowTerms(false)}
                title="Termos de Uso"
                subtitle="Leia com atenção antes de continuar"
                icon={<FileText size={24} />}
            >
                <div className="space-y-6 text-gray-300 leading-relaxed text-sm">
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
        </div >
    );
};
