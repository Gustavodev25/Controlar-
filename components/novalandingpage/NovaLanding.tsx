import React from 'react';
import { Topbar } from './Topbar';
import { Hero } from './Hero';
import { FeaturesSectionWithHoverEffects } from './Features';
import logo from '../../assets/logo.png';

const Footer: React.FC = () => {
    return (
        <footer className="bg-[#0a0a0a] border-t border-[#1a1a1a] py-8 mt-16">
            <div className="max-w-6xl mx-auto px-6 flex flex-col items-center gap-4">
                <img
                    src={logo}
                    alt="Controlar+ Logo"
                    className="h-10 w-auto opacity-80"
                />
                <div className="text-center">
                    <p className="text-[#faf9f5]/60 text-sm">
                        Versão beta da Controlar+ v0.1.0
                    </p>
                    <p className="text-[#faf9f5]/40 text-xs mt-1">
                        Você está nas versões iniciais do sistema. Agradecemos por fazer parte dessa jornada!
                    </p>
                </div>
            </div>
        </footer>
    );
};

export const NovaLanding: React.FC = () => {
    return (
        <div className="min-h-screen bg-[#050505] text-[#faf9f5] font-sans selection:bg-[#d97757]/30">
            <Topbar />
            <Hero />
            <FeaturesSectionWithHoverEffects />
            <Footer />
        </div>
    );
};
