import React from 'react';
import { Topbar } from './Topbar';
import { Hero } from './Hero';


export const NovaLanding: React.FC = () => {
    return (
        <div className="min-h-screen bg-[#050505] text-[#faf9f5] font-sans selection:bg-[#d97757]/30">
            <Topbar />
            <Hero />
        </div>
    );
};
