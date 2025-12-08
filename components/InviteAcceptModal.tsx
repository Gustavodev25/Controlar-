import React from 'react';
import { Users, Check, X, ShieldCheck, Wallet, Crown } from 'lucide-react';

interface InviteAcceptModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  ownerName: string;
  isProcessing: boolean;
}

export const InviteAcceptModal: React.FC<InviteAcceptModalProps> = ({
  isOpen,
  onAccept,
  onDecline,
  ownerName,
  isProcessing
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
      <div className="bg-gray-950 border border-gray-800 rounded-3xl w-full max-w-md p-0 shadow-2xl relative overflow-hidden flex flex-col">
        
        {/* Background Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 opacity-20 bg-[#d97757]" />

        <div className="p-8 text-center relative z-10">
           <div className="w-20 h-20 mx-auto rounded-3xl bg-[#d97757]/10 flex items-center justify-center mb-6 ring-1 ring-[#d97757]/20 shadow-lg shadow-[#d97757]/10">
              <Users size={32} className="text-[#d97757]" />
           </div>
           
           <h2 className="text-2xl font-bold text-white mb-3">Convite Especial</h2>
           <p className="text-gray-400 text-sm leading-relaxed max-w-xs mx-auto">
             <strong className="text-white">{ownerName}</strong> convidou você para fazer parte do plano familiar no Controlar+.
           </p>
        </div>

        <div className="px-8 pb-8 relative z-10">
            <div className="bg-gray-900/50 rounded-2xl p-5 border border-gray-800 mb-6 space-y-4">
               <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-gray-800 text-[#d97757]">
                     <Crown size={16} />
                  </div>
                  <div>
                     <h4 className="text-white text-sm font-bold">Premium Desbloqueado</h4>
                     <p className="text-gray-500 text-xs">Acesso total a todos os recursos PRO.</p>
                  </div>
               </div>
               <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-gray-800 text-[#d97757]">
                     <Wallet size={16} />
                  </div>
                  <div>
                     <h4 className="text-white text-sm font-bold">Metas em Conjunto</h4>
                     <p className="text-gray-500 text-xs">Planejem e alcancem objetivos juntos.</p>
                  </div>
               </div>
               <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-gray-800 text-[#d97757]">
                     <ShieldCheck size={16} />
                  </div>
                  <div>
                     <h4 className="text-white text-sm font-bold">Privacidade Total</h4>
                     <p className="text-gray-500 text-xs">Seus gastos pessoais continuam privados.</p>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
               <button 
                 onClick={onDecline}
                 disabled={isProcessing}
                 className="py-3.5 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 font-bold hover:bg-gray-800 hover:text-white transition-all disabled:opacity-50"
               >
                 Recusar
               </button>
               <button 
                 onClick={onAccept}
                 disabled={isProcessing}
                 className="py-3.5 rounded-xl bg-[#d97757] hover:bg-[#c56a4d] text-white font-bold transition-all shadow-lg shadow-[#d97757]/20 flex items-center justify-center gap-2 disabled:opacity-50"
               >
                 {isProcessing ? (
                     <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                 ) : (
                     <>Aceitar Convite</>
                 )}
               </button>
            </div>
        </div>
      </div>
    </div>
  );
};
