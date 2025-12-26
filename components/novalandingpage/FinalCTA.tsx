import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { BlurTextEffect } from '../BlurTextEffect';
import { AnimatedGridPattern } from '../AnimatedGridPattern';

export const FinalCTA: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
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
                    className="max-w-4xl mx-auto text-center"
                >
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                        <BlurTextEffect>Comece sua jornada</BlurTextEffect> <br />
                        <span className="text-[#D97757]">financeira hoje.</span>
                    </h2>

                    <p className="text-xl text-neutral-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                        Não deixe para depois. Experimente o poder do
                        Controlar+ e veja seu dinheiro render mais.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button onClick={onLogin} className="group px-8 py-4 bg-[#D97757] hover:bg-[#c66a4e] text-white rounded-full font-bold transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(217,119,87,0.3)] hover:shadow-[0_0_30px_rgba(217,119,87,0.5)]">
                            Criar Conta Grátis
                            <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        </button>


                    </div>
                </motion.div>
            </div>
        </section>
    );
};
