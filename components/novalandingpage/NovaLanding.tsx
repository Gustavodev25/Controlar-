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

interface SubscribeData {
    planId: 'pro';
    billingCycle: 'monthly' | 'annual';
    couponCode?: string;
}

interface NovaLandingProps {
    onLogin: () => void;
    onSubscribe?: (data: SubscribeData) => void;
}

export const NovaLanding: React.FC<NovaLandingProps> = ({ onLogin, onSubscribe }) => {
    return (
        <div className="min-h-screen bg-[#1a0f0a] text-[#faf9f5] font-sans selection:bg-[#d97757]/30">
            <Topbar onLogin={onLogin} onSubscribe={onSubscribe} />
            <Hero onLogin={onLogin} onSubscribe={onSubscribe} />
            <FeaturesSectionWithHoverEffects />

            <TestimonialsSection />
            <PricingSection onLogin={onLogin} onSubscribe={onSubscribe} />
            <FAQSection onLogin={onLogin} />
            <FinalCTA onLogin={onLogin} onSubscribe={onSubscribe} />
            <Footer />
        </div>
    );
};

