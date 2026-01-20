import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface TrialBannerProps {
    onLogin: (view?: 'login' | 'signup') => void;
}

export const TrialBanner: React.FC<TrialBannerProps> = ({ onLogin }) => {
    return (
        <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, type: "spring", stiffness: 100, damping: 20 }}
            className="fixed top-0 left-0 right-0 h-10 md:h-12 bg-[#D97757] z-[60] flex items-center justify-center cursor-pointer shadow-lg shadow-[#D97757]/20"
            onClick={() => onLogin('signup')}
        >
            <div className="container mx-auto px-4 flex items-center justify-center gap-2 md:gap-3 text-white text-[10px] md:text-sm font-medium">
                <Sparkles size={14} className="fill-white/20 animate-pulse" />
                <span className="text-center truncate">
                    <span className="opacity-90">Oferta Especial:</span>
                    <span className="font-bold ml-1">Experimente o Plano Pro gratuitamente por 14 dias!</span>
                </span>
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
        </motion.div>
    );
};
