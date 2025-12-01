import React from 'react';
import { Users, Check, X } from './Icons';

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
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#1a1a19] border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl transform transition-all scale-100 relative overflow-hidden">
        
        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 to-blue-600"></div>
        
        <div className="flex flex-col items-center text-center mb-6">
           <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4 shadow-inner">
              <Users size={32} className="text-[#d97757]" />
           </div>
           <h2 className="text-2xl font-bold text-white mb-2">Convite Especial</h2>
           <p className="text-gray-400 leading-relaxed">
             Você foi convidado para fazer parte do plano familiar de <span className="text-white font-bold">{ownerName}</span>.
           </p>
        </div>

        <div className="bg-gray-900/50 rounded-xl p-4 mb-6 border border-gray-800/50">
           <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Benefícios Inclusos</h4>
           <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-center gap-2"><Check size={14} className="text-green-500" /> Recursos Premium Desbloqueados</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-green-500" /> Caixinhas e Metas Compartilhadas</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-green-500" /> Privacidade nos seus gastos pessoais</li>
           </ul>
        </div>

        <div className="flex gap-3">
           <button 
             onClick={onDecline}
             disabled={isProcessing}
             className="flex-1 py-3.5 rounded-xl border border-gray-700 text-gray-300 font-bold hover:bg-gray-800 transition-colors disabled:opacity-50"
           >
             Recusar
           </button>
           <button 
             onClick={onAccept}
             disabled={isProcessing}
             className="flex-1 py-3.5 rounded-xl bg-[#d97757] hover:bg-[#c56a4d] text-white font-bold transition-colors shadow-lg shadow-[#d97757]/20 flex items-center justify-center gap-2 disabled:opacity-50"
           >
             {isProcessing ? (
                 <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
             ) : (
                 <>Aceitar e Entrar</>
             )}
           </button>
        </div>
      </div>
    </div>
  );
};
