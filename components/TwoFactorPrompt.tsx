import React, { useEffect, useRef, useState } from 'react';
import { Lock, Smartphone, X } from './Icons';
import { useToasts } from './Toast';

interface TwoFactorPromptProps {
  isOpen: boolean;
  email?: string | null;
  onConfirm: (code: string) => Promise<void>;
  onCancel: () => void;
  isVerifying?: boolean;
}

export const TwoFactorPrompt: React.FC<TwoFactorPromptProps> = ({
  isOpen,
  email,
  onConfirm,
  onCancel,
  isVerifying = false
}) => {
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const toast = useToasts();

  useEffect(() => {
    if (isOpen) {
      setOtp(new Array(6).fill(""));
      const timeout = setTimeout(() => inputRefs.current[0]?.focus(), 120);
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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

  const handleConfirm = async () => {
    const code = otp.join("");
    if (code.length !== 6) {
      toast.error("Digite os 6 dígitos para continuar.");
      return;
    }
    await onConfirm(code);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-950 border border-gray-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#d97757]/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="flex items-center justify-between p-5 border-b border-gray-800 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#d97757]/15 rounded-xl text-[#d97757]">
              <Smartphone size={20} />
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500 font-semibold">Verificação Necessária</p>
              <h3 className="text-white font-bold text-lg">Confirme com o autenticador</h3>
            </div>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-white rounded-full p-2 hover:bg-gray-800 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6 relative z-10">
          <div className="flex items-center gap-3 bg-gray-900/60 border border-gray-800 rounded-xl p-3">
            <div className="p-2 bg-gray-800 rounded-lg text-gray-300">
              <Lock size={18} />
            </div>
            <div>
              <p className="text-sm text-gray-300 font-semibold">Insira o código do app autenticador</p>
              {email && <p className="text-xs text-gray-500">Conta: {email}</p>}
            </div>
          </div>

          <div className="flex justify-center gap-2">
            {otp.map((digit, index) => (
              <input
                key={index}
                type="text"
                maxLength={1}
                value={digit}
                ref={el => inputRefs.current[index] = el}
                onChange={(e) => handleOtpChange(e.target.value, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className="w-12 h-14 text-center text-xl font-bold rounded-xl bg-gray-900 border border-gray-800 text-white focus:border-[#d97757] focus:ring-1 focus:ring-[#d97757] outline-none transition-all"
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleConfirm}
              disabled={isVerifying}
              className="flex-1 py-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Smartphone size={18} />
              )}
              Confirmar acesso
            </button>
            <button
              onClick={onCancel}
              disabled={isVerifying}
              className="px-4 py-3 bg-gray-900 border border-gray-800 text-gray-200 rounded-xl font-semibold hover:bg-gray-800 transition-colors disabled:opacity-60"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
