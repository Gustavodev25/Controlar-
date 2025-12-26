
import React from 'react';
import { NovaLanding } from './novalandingpage/NovaLanding';

interface LandingPageProps {
  onLogin: () => void;
  variant?: 'waitlist' | 'auth';
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  return <NovaLanding onLogin={onLogin} />;
};
