import React from 'react';
import { Topbar } from './Topbar';
import { Hero } from './Hero';

export const NovaLanding: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-950 text-[#faf9f5] font-sans selection:bg-[#d97757]/30">
            <Topbar />
            <main>
                <Hero />
            </main>
            <div className="py-20 px-6 flex flex-col items-center justify-center">
                <p className="text-gray-400 text-lg max-w-2xl text-center">
                    Mais seções em breve...
                </p>
            </div>
        </div>
    );
};
