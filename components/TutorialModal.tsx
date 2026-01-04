import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Edit2, Tag, List, Settings, ChevronRight, ChevronLeft, HelpCircle } from './Icons';
import { UniversalModal } from './UniversalModal';

interface TutorialModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const steps = [
    {
        title: 'Edição de Categorias',
        description: 'Para organizar seus gastos, você pode alterar a categoria de qualquer transação individualmente.',
        icon: <Tag size={24} className="text-[#d97757]" />,
        content: (
            <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-[#1a1a19] rounded-xl border border-[#373734]">
                    <div className="p-2 bg-[#333432] rounded-lg">
                        <Edit2 size={20} className="text-gray-400" />
                    </div>
                    <div className="text-sm text-gray-300">
                        Clique no ícone de <strong>lápis</strong> ao lado de qualquer transação para abrir a edição e mudar a categoria.
                    </div>
                </div>
                <div className="text-xs text-gray-500 text-center">
                    Dica: Categorizar corretamente ajuda a gerar relatórios mais precisos.
                </div>
            </div>
        )
    },
    {
        title: 'Seleção Múltipla (Em Lote)',
        description: 'Agilize sua organização editando várias transações de uma única vez.',
        icon: <List size={24} className="text-blue-400" />,
        content: (
            <div className="space-y-4">
                <div className="p-4 bg-[#1a1a19] rounded-xl border border-[#373734] space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-5 h-5 shrink-0 rounded border border-[#d97757] bg-[#d97757] flex items-center justify-center">
                            <Check size={12} className="text-white" strokeWidth={3} />
                        </div>
                        <p className="text-sm text-gray-300">
                            Clicando na caixa de seleção à esquerda de cada item, você ativa o <strong>Modo de Seleção</strong>.
                        </p>
                    </div>
                    <div className="h-px bg-[#373734] w-full" />
                    <p className="text-sm text-gray-400">
                        Uma barra de ações aparecerá no topo da tabela, permitindo aplicar uma categoria para <strong>todos os itens selecionados</strong> de uma vez.
                    </p>
                </div>
            </div>
        )
    },
    {
        title: 'Gestão de Categorias',
        description: 'Crie e personalize suas próprias categorias para adaptar o sistema à sua realidade.',
        icon: <Settings size={24} className="text-emerald-400" />,
        content: (
            <div className="space-y-4">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 p-3 bg-[#1a1a19] rounded-xl border border-[#373734]">
                        <span className="text-[#d97757] font-bold">1.</span>
                        <span className="text-sm text-gray-300">Acesse <strong>Gerenciar Categorias</strong> no menu lateral.</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-[#1a1a19] rounded-xl border border-[#373734]">
                        <span className="text-[#d97757] font-bold">2.</span>
                        <span className="text-sm text-gray-300">Crie novas categorias ou renomeie as existentes.</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-[#1a1a19] rounded-xl border border-[#373734]">
                        <span className="text-[#d97757] font-bold">3.</span>
                        <span className="text-sm text-gray-300">As mudanças se aplicam automaticamente em todo o sistema.</span>
                    </div>
                </div>
            </div>
        )
    }
];

export const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose }) => {
    const [currentStep, setCurrentStep] = useState(0);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            onClose();
            // Reset after closing usually, but keeping state allows resuming if opened again? 
            // Better to reset on open or close. Let's reset on close.
            setTimeout(() => setCurrentStep(0), 300);
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const step = steps[currentStep];

    return (
        <UniversalModal
            isOpen={isOpen}
            onClose={onClose}
            title="Como organizar suas finanças"
            icon={<HelpCircle size={20} />}
            themeColor="#d97757"
            footer={
                <div className="flex items-center justify-between w-full">
                    <div className="flex gap-1">
                        {steps.map((_, idx) => (
                            <div
                                key={idx}
                                className={`w-2 h-2 rounded-full transition-all ${idx === currentStep ? 'bg-[#d97757] w-4' : 'bg-gray-700'
                                    }`}
                            />
                        ))}
                    </div>

                    <div className="flex gap-2">
                        {currentStep > 0 && (
                            <button
                                onClick={handlePrev}
                                className="px-4 py-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg text-sm font-medium transition-colors"
                            >
                                Voltar
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            className="px-4 py-2 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-lg text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-[#d97757]/20"
                        >
                            {currentStep === steps.length - 1 ? 'Entendi' : 'Próximo'}
                            {currentStep < steps.length - 1 && <ChevronRight size={16} />}
                        </button>
                    </div>
                </div>
            }
        >
            <div className="py-2">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-6"
                    >
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-bold text-white">{step.title}</h3>
                            <p className="text-gray-400 text-sm leading-relaxed max-w-xs mx-auto">
                                {step.description}
                            </p>
                        </div>

                        <div className="pt-2">
                            {step.content}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </UniversalModal>
    );
};
