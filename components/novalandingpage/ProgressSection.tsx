import React from 'react';
import { BlurTextEffect } from '../BlurTextEffect';
import mockup1 from '../../assets/mockup1.png';
import mockup2 from '../../assets/mockup2.png';

export function ProgressSection() {
    return (
        <div className="w-full bg-[#1a0f0a] py-20">
            <div className="container mx-auto px-8">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-12 gap-6">
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#faf9f5] max-w-xl leading-tight">
                        <BlurTextEffect>Acompanhe Suas Metas Financeiras com Facilidade.</BlurTextEffect>
                    </h2>
                    <p className="text-neutral-400 max-w-sm text-base lg:text-lg">
                        <BlurTextEffect>Visualize seus projetos atuais e futuros para ter uma visão clara do seu progresso financeiro.</BlurTextEffect>
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    <div className="bg-[#262624] rounded-2xl p-6 border border-neutral-700 flex flex-col gap-6">
                        <div className="flex-1 flex items-center justify-center bg-[#262624] rounded-xl overflow-hidden p-4">
                            <img
                                src={mockup1}
                                alt="Mockup de salário"
                                className="w-full h-auto rounded-lg"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <p className="text-[#faf9f5] text-lg font-medium leading-relaxed">
                                <BlurTextEffect>Gerencie suas receitas mensais e previsões de ganhos com total clareza e controle.</BlurTextEffect>
                            </p>
                            <p className="text-neutral-500 text-sm font-medium">
                                <BlurTextEffect>Controle de Orçamento</BlurTextEffect>
                            </p>
                        </div>
                    </div>

                    <div className="bg-[#262624] rounded-2xl p-6 border border-neutral-700 flex flex-col gap-6">
                        <div className="flex-1 flex items-center justify-center bg-[#262624] rounded-xl overflow-hidden p-4">
                            <img
                                src={mockup2}
                                alt="Mockup de investimentos"
                                className="w-full h-auto rounded-lg"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <p className="text-[#faf9f5] text-lg font-medium leading-relaxed">
                                <BlurTextEffect>Acompanhe o crescimento do seu patrimônio e atinja suas metas de longo prazo.</BlurTextEffect>
                            </p>
                            <p className="text-neutral-500 text-sm font-medium">
                                <BlurTextEffect>Gestão de Investimentos</BlurTextEffect>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
