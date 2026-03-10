
import React from 'react';
import { NovaLanding } from './novalandingpage/NovaLanding';

interface SubscribeData {
  planId: 'pro';
  billingCycle: 'monthly' | 'annual';
  couponCode?: string;
}

interface LandingPageProps {
  onLogin: (view?: 'login' | 'signup', showTerms?: boolean) => void;
  onSubscribe?: (data: SubscribeData) => void;
  variant?: 'waitlist' | 'auth';
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onSubscribe }) => {
  return <NovaLanding onLogin={onLogin} onSubscribe={onSubscribe} />;
};
