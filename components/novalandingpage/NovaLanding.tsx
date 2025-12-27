import React from 'react';
import { Topbar } from './Topbar';
import { Hero } from './Hero';
import { FeaturesSectionWithHoverEffects } from './Features';
import { ProgressSection } from './ProgressSection';
import { TestimonialsSection } from './Testimonials';
import { FAQSection } from './FAQ';
import { PricingSection } from './PricingSection';
import { FinalCTA } from './FinalCTA';

import { Footer } from './Footer';

export const NovaLanding: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
    return (
        <div className="min-h-screen bg-[#1a0f0a] text-[#faf9f5] font-sans selection:bg-[#d97757]/30">
            <Topbar onLogin={onLogin} />
            <Hero onLogin={onLogin} />
            <FeaturesSectionWithHoverEffects />

            <TestimonialsSection />
            <PricingSection onLogin={onLogin} />
            <FAQSection onLogin={onLogin} />
            <FinalCTA onLogin={onLogin} />
            <Footer />
        </div>
    );
};
