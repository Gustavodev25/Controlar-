import React from 'react';
import { motion } from 'framer-motion';
import heroImg from '../../assets/hero.png';
import { cn } from '../../lib/utils';
import { FlipWords } from './FlipWords';

export const Hero: React.FC = () => {

    return (
        <div className="relative mx-2 mt-2 rounded-[24px] border border-white/10 pt-24 lg:pt-36 pb-0 overflow-hidden min-h-[600px] h-[calc(100vh-1rem)] flex flex-col justify-start items-center">

            {/* --- Background Blurs (Estilo Aurora/Nebulosa) --- */}

            {/* Camada de Fundo - Base Suave (Cobre a largura toda embaixo) */}
            <div className="absolute -bottom-[20%] left-0 right-0 h-[600px] bg-[#D97757] opacity-10 blur-[180px] pointer-events-none" />

            {/* Canto Esquerdo - Mais intenso */}
            <div className="absolute -bottom-32 -left-32 w-[600px] h-[600px] bg-[#D97757] opacity-25 blur-[160px] rounded-full pointer-events-none mix-blend-screen" />

            {/* Canto Direito - Mais intenso */}
            <div className="absolute -bottom-32 -right-32 w-[600px] h-[600px] bg-[#D97757] opacity-25 blur-[160px] rounded-full pointer-events-none mix-blend-screen" />

            {/* Elemento Central de Conexão (Para criar o degradê contínuo igual da imagem) */}
            <div className="absolute -bottom-64 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#D97757] opacity-20 blur-[140px] rounded-full pointer-events-none" />

            {/* --------------------------------------------------- */}

            <div className="container mx-auto px-4 relative z-10 flex flex-col h-full pointer-events-none">

                {/* Text Content */}
                <div className="text-center max-w-6xl mx-auto mt-8 lg:mt-12 flex-shrink-0 pointer-events-auto z-30">
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="text-3xl md:text-4xl lg:text-6xl font-bold text-white tracking-tight mb-4 leading-[1.1]"
                    >
                        Molde seu futuro financeiro com <br className="hidden md:block" />
                        <motion.span layout className="inline-flex items-center justify-center flex-wrap gap-2">
                            <FlipWords words={["inteligência", "estratégia", "controle"]} className="text-[#D97757] !px-0" />
                            <motion.span layout>e precisão.</motion.span>
                        </motion.span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="text-sm md:text-base text-gray-400 mb-6 max-w-3xl mx-auto leading-relaxed"
                    >
                        Oferecemos uma suíte completa de serviços, desde gestão pessoal até insights de IA, tudo entregue com excelência inigualável.
                    </motion.p>
                </div>

                {/* Visual Mockup Area */}
                <div className="relative w-full flex justify-center pointer-events-auto flex-grow items-end pb-0">
                    <motion.div
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="w-[200px] md:w-[350px] lg:w-[400px] z-20 relative -mb-10 md:mb-0"
                    >
                        <img
                            src={heroImg}
                            alt="Interface do Aplicativo Controlar"
                            className="w-full h-auto object-contain drop-shadow-2xl"
                        />
                    </motion.div>
                </div>
            </div>
        </div>
    );
};