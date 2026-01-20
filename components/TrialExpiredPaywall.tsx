import React from 'react';
import { motion } from 'framer-motion';
import { Lock, ArrowRight } from 'lucide-react';

interface TrialExpiredPaywallProps {
    userName: string;
    onSubscribe: () => void;
}

export const TrialExpiredPaywall: React.FC<TrialExpiredPaywallProps> = ({
    userName,
    onSubscribe
}) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] bg-gray-950/90 backdrop-blur-sm flex items-center justify-center p-4"
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 20 }}
                className="relative max-w-sm w-full bg-[#1A1A19] border border-gray-800 rounded-2xl p-8 text-center shadow-2xl"
            >
                {/* Icon */}
                <div className="w-12 h-12 mx-auto mb-6 bg-gray-900 rounded-full flex items-center justify-center border border-gray-800">
                    <Lock className="w-5 h-5 text-gray-400" />
                </div>

                {/* Title */}
                <h2 className="text-xl font-bold text-white mb-2">
                    Visualização Limitada
                </h2>

                {/* Message */}
                <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                    Seu período de teste de 14 dias chegou ao fim.
                    <br />
                    Para continuar acessando seus dados e usando os recursos Pro, ative sua assinatura.
                </p>

                {/* CTA Button */}
                <button
                    onClick={onSubscribe}
                    className="w-full py-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 group shadow-lg shadow-[#d97757]/20"
                >
                    Assinar Controlar+
                    <ArrowRight className="w-4 h-4 text-white/80 group-hover:text-white transition-colors" />
                </button>

                {/* Price Hint */}
                <p className="text-xs text-gray-500 mt-4">
                    Apenas R$ 35,90/mês
                </p>
            </motion.div>
        </motion.div>
    );
};
