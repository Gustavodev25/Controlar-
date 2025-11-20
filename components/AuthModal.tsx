
import React, { useState } from 'react';
import { Mail, Lock, User as UserIcon, ArrowRight, Sparkles, CheckCircle, ChevronLeft } from './Icons';
import { Logo } from './Logo';
import { auth } from '../services/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { updateUserProfile } from '../services/database';

interface AuthModalProps {
  onLogin?: (user: any) => void;
  onBack?: () => void; // Added callback to go back to landing
}

export const AuthModal: React.FC<AuthModalProps> = ({ onLogin, onBack }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      if (!auth) throw new Error("Auth não inicializado");

      if (isLogin) {
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        if (userCredential.user) {
          await updateProfile(userCredential.user, { displayName: formData.name });
          // Create initial DB Profile with 0 base salary
          await updateUserProfile(userCredential.user.uid, {
            name: formData.name,
            email: formData.email,
            baseSalary: 0
          });
        }
      }
    } catch (err: any) {
      console.error(err);
      let msg = "Ocorreu um erro. Tente novamente.";
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
         msg = "E-mail ou senha incorretos.";
      } else if (err.code === 'auth/email-already-in-use') {
         msg = "Este e-mail já está em uso.";
      } else if (err.code === 'auth/weak-password') {
         msg = "A senha deve ter pelo menos 6 caracteres.";
      }
      setError(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex w-full h-full bg-gray-950 text-[#faf9f5] font-sans">
      
      {/* Back Button (Mobile/Desktop) */}
      {onBack && (
        <button 
          onClick={onBack}
          className="absolute top-6 left-6 z-50 p-2 bg-gray-900 rounded-full text-gray-400 hover:text-white hover:bg-gray-800 transition-colors border border-gray-800"
        >
          <ChevronLeft size={20} />
        </button>
      )}
      
      {/* LEFT SIDE - Creative Pattern & Branding (Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-[55%] relative bg-gray-900 overflow-hidden flex-col justify-between p-12">
        
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

        {/* Central Visual Element (Abstract Chart/UI representation) */}
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
      <div className="w-full lg:w-[45%] flex items-center justify-center p-8 lg:p-16 bg-gray-950 relative">
         <div className="w-full max-w-sm">
            
            {/* Mobile Logo (Only visible on mobile) */}
            <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
              <Logo
                size={32}
                className="gap-2"
                textClassName="font-bold text-xl"
                imgClassName="rounded-lg"
              />
            </div>

            {/* Animated Container */}
            <div key={isLogin ? 'login' : 'register'} className="space-y-8 animate-fade-in">
                <div className="space-y-2">
                   <h2 className="text-3xl font-bold tracking-tight text-white">
                     {isLogin ? 'Bem-vindo de volta' : 'Comece agora'}
                   </h2>
                   <p className="text-gray-400">
                     {isLogin ? 'Preencha seus dados para acessar.' : 'Crie sua conta gratuita em segundos.'}
                   </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
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
                               onChange={(e) => setFormData({...formData, name: e.target.value})}
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
                             onChange={(e) => setFormData({...formData, email: e.target.value})}
                             className="input-primary pl-10 bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]"
                          />
                      </div>
                   </div>

                   <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-300 ml-1">Senha</label>
                      <div className="relative group">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={18} />
                          <input 
                             type="password" 
                             required
                             placeholder="••••••••"
                             value={formData.password}
                             onChange={(e) => setFormData({...formData, password: e.target.value})}
                             className="input-primary pl-10 bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757]"
                          />
                      </div>
                   </div>

                   {isLogin && (
                     <div className="flex justify-end">
                        <button type="button" className="text-xs font-medium text-[#d97757] hover:text-[#c56a4d] transition-colors">
                          Esqueceu a senha?
                        </button>
                     </div>
                   )}

                   {error && (
                     <div className="p-3 rounded-lg bg-red-900/20 border border-red-900/50 text-red-400 text-xs flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                        {error}
                     </div>
                   )}

                   <button 
                     type="submit" 
                     disabled={isLoading}
                     className="w-full py-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/20 flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
                   >
                     {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                     ) : (
                        <>
                          {isLogin ? 'Entrar na Plataforma' : 'Criar Conta Grátis'}
                          <ArrowRight size={18} />
                        </>
                     )}
                   </button>
                </form>
            </div>

            <p className="text-center text-sm text-gray-400 mt-8">
               {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
               <button 
                 onClick={() => { setIsLogin(!isLogin); setError(''); }}
                 className="ml-1.5 text-[#d97757] hover:text-[#e68e70] font-bold hover:underline transition-all"
               >
                 {isLogin ? 'Cadastre-se' : 'Fazer login'}
               </button>
            </p>
         </div>

         {/* Subtle footer text */}
        <div className="absolute bottom-6 text-[10px] text-gray-600">
           © 2025 Controlar+ Pro. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
};
