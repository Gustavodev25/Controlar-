import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { BlurTextEffect } from '../BlurTextEffect';
import { AnimatedGridPattern } from '../AnimatedGridPattern';

interface SubscribeData {
    planId: 'pro';
    billingCycle: 'monthly' | 'annual';
    couponCode?: string;
}

interface FinalCTAProps {
    onLogin: (view?: 'login' | 'signup') => void;
    onSubscribe?: (data: SubscribeData) => void;
}

export const FinalCTA: React.FC<FinalCTAProps> = ({ onLogin, onSubscribe }) => {
    return (
        <section className="relative w-full py-24 bg-[radial-gradient(ellipse_60%_40%_at_50%_40%,_#3a1a10_0%,_#1a0f0a_100%)] overflow-hidden">
            {/* Grid Animado de Fundo - Sutil e Centralizado */}
            <AnimatedGridPattern
                width={60}
                height={60}
                numSquares={20}
                maxOpacity={0.08}
                duration={4}
                repeatDelay={2}
                className="[mask-image:radial-gradient(ellipse_50%_50%_at_50%_40%,white_0%,transparent_70%)] fill-white/5 stroke-white/[0.03]"
            />

            <div className="container mx-auto px-6 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="max-w-4xl mx-auto text-center flex flex-col items-center"
                >
                    {/* New Premium Scarcity Badge */}
                    <div className="flex justify-center mb-6">
                        <div className="relative group cursor-pointer" onClick={() => onSubscribe && onSubscribe({ planId: 'pro', billingCycle: 'monthly', couponCode: 'PROMO50' })}>
                            <div className="absolute -inset-1 bg-gradient-to-r from-[#D97757] via-amber-500 to-[#D97757] rounded-full blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
                            <div className="relative px-2 py-1 md:px-4 md:py-1.5 bg-[#1a0f0a] ring-1 ring-white/10 rounded-full leading-none flex items-center gap-2 md:gap-3">
                                <span className="flex items-center justify-center px-2 py-0.5 rounded-full bg-gradient-to-r from-[#D97757] to-amber-600 text-[10px] font-bold text-white shadow-sm shadow-orange-500/50">
                                    NOVO
                                </span>
                                <span className="text-gray-300 text-[10px] md:text-xs tracking-wide">
                                    Desconto exclusivo liberado: <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D97757] to-amber-500 font-bold">50% OFF</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                        <BlurTextEffect>Comece sua jornada</BlurTextEffect> <br />
                        <span className="text-[#D97757]">financeira hoje.</span>
                    </h2>

                    <p className="text-xl text-neutral-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                        Não deixe para depois. Experimente o poder do
                        Controlar+ e veja seu dinheiro render mais.
                    </p>

                    <div className="flex flex-col items-center justify-center gap-4">
                        <button onClick={() => {
                            if (onSubscribe) onSubscribe({ planId: 'pro', billingCycle: 'monthly', couponCode: 'PROMO50' });
                        }} className="group px-12 py-5 bg-[#D97757] hover:bg-[#c66a4e] text-white rounded-full font-bold transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(217,119,87,0.3)] hover:shadow-[0_0_30px_rgba(217,119,87,0.5)] relative overflow-hidden text-lg">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                            Assinar Agora com 50% OFF
                            <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        </button>

                        <div className="flex items-center gap-2 mt-2">
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                Cupom <span className="text-emerald-400">PROMO50</span> aplicado automaticamente
                            </span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

