import React from 'react';
import { ShiningText } from '../ShiningText';
import { AnimatedGridPattern } from '../AnimatedGridPattern';
import { InfiniteSlider } from '../InfiniteSlider';
import dashboardImg from '../../assets/dashboard.png';

// Bank logos
import bancodobrasilLogo from '../../assets/bancos/bancodobrasil.png';
import bradescoLogo from '../../assets/bancos/bradesco.png';
import brbLogo from '../../assets/bancos/brb.png';
import c6Logo from '../../assets/bancos/c6.png';
import caixaLogo from '../../assets/bancos/caixa.png';
import interLogo from '../../assets/bancos/inter.png';
import nubankLogo from '../../assets/bancos/nubank.png';
import santanderLogo from '../../assets/bancos/santander.png';
import xpLogo from '../../assets/bancos/xp.png';

export function Hero() {
    const banks = [
        { name: 'Banco do Brasil', logo: bancodobrasilLogo },
        { name: 'Bradesco', logo: bradescoLogo },
        { name: 'BRB', logo: brbLogo },
        { name: 'C6 Bank', logo: c6Logo },
        { name: 'Caixa', logo: caixaLogo },
        { name: 'Inter', logo: interLogo },
        { name: 'Nubank', logo: nubankLogo },
        { name: 'Santander', logo: santanderLogo },
        { name: 'XP', logo: xpLogo },
    ];

    return (
        <div className="w-full bg-[#1a0f0a] flex flex-col">
            <section className="relative w-full min-h-screen bg-[radial-gradient(ellipse_60%_40%_at_50%_40%,_#3a1a10_0%,_#1a0f0a_100%)] overflow-hidden flex items-center justify-center pt-40 pb-0">

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

                <div className="container mx-auto flex flex-col items-center justify-center z-10 px-4 lg:px-12 h-full">
                    <div className="space-y-8 text-center max-w-4xl">
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-tight">
                            Desbloqueie o Potencial <br />
                            das suas <ShiningText text="Finanças." />
                        </h1>
                        <p className="text-xl text-gray-400 max-w-xl mx-auto">
                            Controlar+ é a plataforma financeira mais produtiva já feita.
                            Obtenha clareza total sobre seu dinheiro em segundos.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                            <button className="px-12 py-4 min-w-[200px] bg-[#D97757] hover:bg-[#c66a4e] text-white rounded-full font-medium transition-all flex items-center justify-center gap-2 group">
                                Começar Agora
                                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </button>
                            <button className="px-12 py-4 min-w-[200px] bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-full font-medium transition-all flex items-center justify-center gap-2">
                                Saber mais
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Dashboard Image - Cortado pela máscara do container */}
                    <div className="relative w-full max-w-5xl mt-8 translate-y-[15%]">
                        <div className="relative rounded-t-xl overflow-hidden border border-white/10 border-b-0 shadow-2xl shadow-black/50">
                            <img
                                src={dashboardImg}
                                alt="Dashboard Controlar+"
                                className="w-full h-auto"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Infinite Slider - Bancos Parceiros */}
            <section className="relative w-full py-8 bg-[#30302E] border-t border-white/5">
                <div className="flex items-center">
                    {/* Quadrado com texto */}
                    <div className="flex-shrink-0 px-8 py-4 border-r border-white/10">
                        <p className="text-sm text-gray-400 uppercase tracking-widest whitespace-nowrap">Conecte com seus bancos favoritos</p>
                    </div>

                    {/* Slider */}
                    <div className="relative flex-1 overflow-hidden">
                        {/* Fade nas laterais */}
                        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#30302E] to-transparent z-10 pointer-events-none" />
                        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#30302E] to-transparent z-10 pointer-events-none" />

                        <InfiniteSlider gap={48} duration={30}>
                            {banks.map((bank) => (
                                <div key={bank.name} className="flex items-center justify-center px-6 py-4">
                                    <img
                                        src={bank.logo}
                                        alt={bank.name}
                                        className="h-8 w-auto opacity-60 hover:opacity-100 transition-opacity"
                                    />
                                </div>
                            ))}
                        </InfiniteSlider>
                    </div>
                </div>
            </section>
        </div>
    );
}