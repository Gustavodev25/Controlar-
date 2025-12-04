import React from 'react';
import { Check } from './Icons';

interface InviteLandingProps {
  ownerName: string;
  onAccept: () => void;
}

export const InviteLanding: React.FC<InviteLandingProps> = ({
  ownerName,
  onAccept
}) => {
  return (
    <div className="min-h-screen bg-[#2F302E] flex flex-col items-center justify-center p-4 relative overflow-hidden text-center">

        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#d97757] to-orange-600"></div>
        
        <div className="relative z-10 max-w-md w-full bg-[#2F302E] border border-gray-800 rounded-3xl shadow-2xl overflow-hidden">
           
           {/* Background Effects */}
           <div className="absolute inset-0 pointer-events-none">
             <div className="absolute top-0 right-0 w-64 h-64 bg-[#d97757]/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
             <div className="absolute bottom-0 left-0 w-64 h-64 bg-gray-700/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
           </div>

           <div className="relative z-10 p-8">
             {/* Image Container with animation */}
           <div className="relative w-32 h-32 mx-auto mb-6 group">
              <img 
                src="/assets/familia.png" 
                alt="Família" 
                className="w-full h-full object-contain relative z-10 drop-shadow-2xl transform transition-transform group-hover:scale-105 duration-500"
              />
           </div>
           
           <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">Convite Especial</h2>
           <p className="text-gray-400 leading-relaxed text-lg mb-8">
             Você foi convidado para fazer parte do plano familiar de <span className="text-white font-bold">{ownerName}</span> no Controlar+.
           </p>

           <div className="bg-gray-800/50 rounded-xl p-6 mb-8 border border-gray-700/50 text-left">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Você terá acesso a:</h4>
              <ul className="space-y-3 text-sm text-gray-300">
                 <li className="flex items-center gap-3"><div className="p-1 bg-[#d97757]/10 rounded-full"><Check size={14} className="text-[#d97757]" /></div> Recursos Premium Desbloqueados</li>
                 <li className="flex items-center gap-3"><div className="p-1 bg-[#d97757]/10 rounded-full"><Check size={14} className="text-[#d97757]" /></div> Caixinhas e Metas Compartilhadas</li>
                 <li className="flex items-center gap-3"><div className="p-1 bg-[#d97757]/10 rounded-full"><Check size={14} className="text-[#d97757]" /></div> Privacidade nos seus gastos pessoais</li>
              </ul>
           </div>

           <button 
             onClick={onAccept}
             className="w-full py-4 rounded-xl bg-[#d97757] hover:bg-[#c56a4d] text-white font-bold text-lg transition-all transform hover:scale-[1.02] shadow-xl shadow-[#d97757]/20 flex items-center justify-center gap-2"
           >
             Aceitar Convite
           </button>
           
           <p className="text-xs text-gray-500 mt-4">
               Ao aceitar, você será direcionado para criar sua conta ou fazer login.
           </p>
           </div>
        </div>
    </div>
  );
};