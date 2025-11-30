import React, { useEffect, useRef } from 'react';
import { useToasts } from '../components/Toast';

export const PaymentResult = () => {
  return null; 
};

// Helper hook to check for payment status on mount in App.tsx
export const usePaymentStatus = (onSuccess: (planId: string) => void) => {
  const processedRef = useRef(false);
  const toast = useToasts();

  useEffect(() => {
    if (processedRef.current) return;
    
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const sessionId = params.get('session_id');
    const plan = params.get('plan');

    if (status === 'success' && sessionId && plan) {
      processedRef.current = true;
      toast.success("Pagamento confirmado! Seu plano foi ativado.");
      onSuccess(plan);
      
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (status === 'canceled') {
      processedRef.current = true;
      toast.message({ text: "Assinatura cancelada. Nenhuma cobrança foi feita." });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [onSuccess]);
};