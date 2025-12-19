
import React from 'react';
import { UniversalModal, ModalSection, ModalDivider } from './UniversalModal';
import coinzinhaImg from '../assets/coinzinha.png';
import quebraCabecaImg from '../assets/quebra-cabeca.png';
import fogueteImg from '../assets/foguete.png';
import { ArrowRight } from 'lucide-react';

interface PostSignupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectPlan: (plan: 'free' | 'pro') => void;
    userName?: string;
}

export const PostSignupModal: React.FC<PostSignupModalProps> = ({ isOpen, onClose, onSelectPlan, userName }) => {
    return (
        <UniversalModal
            isOpen={isOpen}
            onClose={onClose}
            title="Bem-vindo ao Controlar+!"
            themeColor="#ff9f43" // Amber/Orange
            width="max-w-2xl"
        >
            <div className="flex flex-col md:flex-row gap-6 items-start">

                {/* Left Side: Mascot & Intro */}
                <div className="w-full md:w-1/3 flex flex-col items-center text-center">
                    <div className="relative mb-4">
                        <img
                            src={coinzinhaImg}
                            alt="Coinzinha"
                            className="w-32 h-32 object-contain drop-shadow-xl animate-float"
                        />
                    </div>

                    <h3 className="text-white font-bold text-lg mb-2">
                        Olá, {userName?.split(' ')[0] || 'Viajante'}!
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                        Sou o Coinzinha, seu novo assistente financeiro. Qual caminho vamos trilhar juntos hoje?
                    </p>
                </div>

                {/* Right Side: Options */}
                <div className="w-full md:w-2/3 space-y-4">

                    {/* Free Option */}
                    <div
                        onClick={() => onSelectPlan('free')}
                        className="group relative bg-[#363735] hover:bg-[#3f403e] border-2 border-transparent hover:border-gray-500 rounded-2xl p-4 transition-all cursor-pointer flex items-center gap-4"
                    >
                        <div className="w-12 h-12 rounded-xl bg-gray-700/50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
                            <img src={quebraCabecaImg} alt="Essencial" className="w-10 h-10 object-contain" />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-white font-bold text-sm mb-1">Caminho Essencial</h4>
                            <p className="text-gray-400 text-xs">Controle manual simples e direto.</p>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                            <span className="text-xs font-semibold text-gray-400 bg-gray-700/50 px-2 py-1 rounded">Grátis</span>
                        </div>
                    </div>

                    {/* Pro Option */}
                    <div
                        onClick={() => onSelectPlan('pro')}
                        className="group relative bg-[#363735] border-2 border-[#d97757]/30 hover:border-[#d97757] rounded-2xl p-4 transition-all cursor-pointer flex items-center gap-4 overflow-hidden"
                    >
                        {/* Shimmer Effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer" />

                        <div className="w-12 h-12 rounded-xl bg-[#d97757]/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
                            <img src={fogueteImg} alt="Pro" className="w-10 h-10 object-contain" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-white font-bold text-sm">Caminho Pro</h4>
                                <span className="text-[10px] font-bold bg-[#d97757] text-white px-1.5 py-0.5 rounded">RECOMENDADO</span>
                            </div>
                            <p className="text-gray-400 text-xs text-left">Automação total, IA e Open Finance.</p>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                            <span className="text-xs font-semibold text-[#d97757] bg-[#d97757]/20 px-2 py-1 rounded">Pro</span>
                        </div>
                    </div>

                    <div className="text-xs text-gray-500 text-center mt-4">
                        Você pode mudar de plano a qualquer momento nas configurações.
                    </div>

                </div>
            </div>
        </UniversalModal>
    );
};
