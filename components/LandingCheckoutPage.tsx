import React, { useState } from 'react';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { CheckoutForm } from './CheckoutForm';
import { useToasts } from './Toast';
import fogueteImg from '../assets/foguete.png';
import { API_ENDPOINTS } from '../config/api';
import { auth } from '../services/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { updateUserProfile } from '../services/database';
import { toLocalISODate } from '../utils/dateUtils';
import { AnimatedGridPattern } from './AnimatedGridPattern';
import { getCompleteUtmData } from '../services/utmService';

interface LandingCheckoutPageProps {
    planId: 'pro';
    billingCycle: 'monthly' | 'annual';
    couponCode?: string;
    onBack: () => void;
    onSuccess: () => void;
}

/**
 * Página de checkout especial para usuários vindos da landing page.
 * Coleta dados de cadastro e processa o pagamento em um único fluxo.
 */
export const LandingCheckoutPage: React.FC<LandingCheckoutPageProps> = ({
    planId,
    billingCycle,
    couponCode,
    onBack,
    onSuccess
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const toast = useToasts();

    const planConfig = {
        id: 'pro',
        name: 'Pro',
        price: billingCycle === 'monthly' ? 35.90 : 399.00 / 12,
        annualPrice: 399.00
    };

    const price = billingCycle === 'monthly' ? planConfig.price : planConfig.annualPrice;

    const handleCheckoutSubmit = async (
        cardData: any,
        holderInfo: any,
        installments?: number,
        couponId?: string,
        finalPrice?: number,
        registrationData?: {
            name: string;
            email: string;
            password: string;
            cpf: string;
            birthDate: string;
            phone: string;
            cep: string;
            street: string;
            number: string;
            complement: string;
            neighborhood: string;
            city: string;
            state: string;
        }
    ) => {
        if (!registrationData) {
            toast.error('Dados de cadastro não encontrados.');
            return;
        }

        setIsLoading(true);

        try {
            // 1. Criar conta no Firebase
            console.log('>>> Criando conta no Firebase...');
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                registrationData.email,
                registrationData.password
            );

            const firebaseUser = userCredential.user;

            // Atualizar displayName
            await updateProfile(firebaseUser, {
                displayName: registrationData.name
            });

            // Salvar perfil completo no Firestore
            await updateUserProfile(firebaseUser.uid, {
                name: registrationData.name,
                email: registrationData.email,
                phone: registrationData.phone,
                baseSalary: 0,
                isAdmin: false,
                cpf: registrationData.cpf,
                birthDate: registrationData.birthDate,
                address: {
                    cep: registrationData.cep,
                    street: registrationData.street,
                    number: registrationData.number,
                    complement: registrationData.complement,
                    neighborhood: registrationData.neighborhood,
                    city: registrationData.city,
                    state: registrationData.state
                },
                createdAt: new Date().toISOString()
            });

            console.log('>>> Conta criada com sucesso:', firebaseUser.uid);

            // 2. Calcular preço final
            const originalPrice = price;
            const finalValue = finalPrice !== undefined ? finalPrice : originalPrice;

            // 3. SPECIAL CASE: Se o preço final for < R$ 5 (Asaas mínimo), ativar direto
            if (finalValue < 5) {
                console.log('>>> Cupom 100% detectado! Ativando plano sem cobrança...');

                const nextBillingDate = new Date();
                if (billingCycle === 'annual') {
                    nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
                } else {
                    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
                }

                await updateUserProfile(firebaseUser.uid, {
                    subscription: {
                        plan: planId,
                        status: 'active',
                        billingCycle: billingCycle,
                        installments: 1,
                        nextBillingDate: toLocalISODate(nextBillingDate),
                        couponUsed: couponId,
                        startDate: toLocalISODate(new Date()),
                    },
                    paymentMethodDetails: {
                        last4: cardData.number.replace(/\s/g, '').slice(-4),
                        holder: cardData.holderName || registrationData.name,
                        expiry: `${cardData.expiryMonth}/${cardData.expiryYear.slice(-2)}`,
                        brand: 'credit_card'
                    }
                });

                localStorage.setItem('show_pro_tutorial', 'true');
                sessionStorage.removeItem('pro_tutorial_session_seen');

                toast.success('🎉 Conta criada e plano ativado com sucesso!');
                onSuccess();
                return;
            }

            // 4. Criar cliente no Asaas
            console.log('>>> Criando cliente no Asaas...');
            const token = await firebaseUser.getIdToken();
            const customerResponse = await fetch(API_ENDPOINTS.asaas.customer, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: holderInfo.name || cardData.holderName,
                    email: registrationData.email,
                    cpfCnpj: holderInfo.cpfCnpj,
                    phone: holderInfo.phone,
                    postalCode: holderInfo.postalCode,
                    addressNumber: holderInfo.addressNumber,
                }),
            });

            const customerData = await customerResponse.json();

            if (!customerResponse.ok || !customerData.success) {
                const detail = customerData.details || '';
                const mainError = customerData.error || 'Erro ao criar cliente no Asaas.';
                throw new Error(detail ? `${mainError} ${detail}` : mainError);
            }

            console.log('>>> Cliente criado:', customerData.customer.id);

            // 5. Criar assinatura/pagamento no Asaas
            // Get UTM data for Utmify tracking
            const utmData = getCompleteUtmData();

            console.log('>>> Criando assinatura no Asaas...');
            const subscriptionResponse = await fetch(API_ENDPOINTS.asaas.subscription, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    customerId: customerData.customer.id,
                    planId: planId,
                    billingCycle: billingCycle,
                    value: finalValue,
                    baseValue: originalPrice,
                    installmentCount: installments || 1,
                    creditCard: {
                        holderName: cardData.holderName,
                        number: cardData.number,
                        expiryMonth: cardData.expiryMonth,
                        expiryYear: cardData.expiryYear,
                        ccv: cardData.ccv,
                    },
                    creditCardHolderInfo: {
                        name: holderInfo.name || cardData.holderName,
                        email: registrationData.email,
                        cpfCnpj: holderInfo.cpfCnpj,
                        postalCode: holderInfo.postalCode,
                        addressNumber: holderInfo.addressNumber,
                        phone: holderInfo.phone,
                    },
                    couponId,
                    userId: firebaseUser.uid,
                    utmData, // [NEW] UTM tracking for Utmify
                }),
            });

            const subscriptionData = await subscriptionResponse.json();

            console.log('>>> Resposta da assinatura:', subscriptionData);

            if (!subscriptionResponse.ok || !subscriptionData.success) {
                throw new Error(subscriptionData.error || 'Erro ao processar pagamento.');
            }

            // 6. Verificar se pagamento foi confirmado
            if (subscriptionData.status === 'CONFIRMED' || subscriptionData.status === 'RECEIVED') {
                // Payment was successful!
                // NOTE: The backend (activatePlanOnServer) already updated subscription.* and profile.subscription.*
                // We should NOT update subscription here to avoid race conditions
                // We only update paymentMethodDetails which the backend doesn't handle

                await updateUserProfile(firebaseUser.uid, {
                    // DO NOT include subscription here - backend already updated it via activatePlanOnServer
                    paymentMethodDetails: {
                        last4: cardData.number.replace(/\s/g, '').slice(-4),
                        holder: cardData.holderName || registrationData.name,
                        expiry: `${cardData.expiryMonth}/${cardData.expiryYear.slice(-2)}`,
                        brand: 'credit_card'
                    }
                });

                localStorage.setItem('show_pro_tutorial', 'true');
                sessionStorage.removeItem('pro_tutorial_session_seen');

                toast.success('🎉 Conta criada e pagamento confirmado! Bem-vindo ao Controlar+ Pro!');
                onSuccess();
            } else {
                // Pagamento não foi aprovado - podemos manter a conta mas sem o plano ativo
                throw new Error(subscriptionData.error || 'Pagamento não foi aprovado. Verifique os dados do cartão.');
            }

        } catch (err: any) {
            console.error('Checkout error:', err);

            // Se for erro do Firebase de email já em uso
            if (err.code === 'auth/email-already-in-use') {
                toast.error('Este e-mail já está cadastrado. Faça login para continuar.');
            } else {
                toast.error(err.message || 'Erro ao processar. Tente novamente.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#1a0f0a] text-[#faf9f5] relative overflow-hidden font-sans selection:bg-[#d97757]/30">
            {/* Background Gradients igual da Landing */}
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(58,26,16,0.3)_0%,rgba(26,15,10,0)_100%)] pointer-events-none" />
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_100%,rgba(58,26,16,0.2)_0%,rgba(26,15,10,0)_100%)] pointer-events-none" />

            {/* Background Pattern */}
            <AnimatedGridPattern
                width={60}
                height={60}
                numSquares={20}
                maxOpacity={0.08}
                duration={4}
                repeatDelay={2}
                className="[mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,white_0%,transparent_80%)] fill-white/5 stroke-white/[0.03] fixed inset-0 pointer-events-none"
            />

            {/* Header */}
            {/* Header */}
            <div
                className="py-4 px-4 lg:px-6 sticky top-0 z-50 border-b border-white/10 overflow-hidden"
                style={{
                    backgroundColor: "rgba(10, 10, 10, 0.65)",
                    backdropFilter: "blur(24px) saturate(180%)",
                    WebkitBackdropFilter: "blur(24px) saturate(180%)"
                }}
            >
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] contrast-125" />

                <div className="relative z-10 flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-1.5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <div className="flex items-center gap-3">
                        <img src={fogueteImg} alt="Pro" className="w-8 h-8 object-contain" />
                        <div>
                            <h1 className="text-lg font-bold text-white leading-tight flex items-center gap-2">
                                Assinar Pro
                            </h1>
                            <p className="text-[11px] text-gray-400">
                                Crie sua conta e comece agora
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Checkout Form com Registration */}
            <div className="relative z-10 max-w-7xl mx-auto">
                <CheckoutForm
                    planName="Pro"
                    price={price}
                    billingCycle={billingCycle}
                    onSubmit={handleCheckoutSubmit}
                    onBack={onBack}
                    isLoading={isLoading}
                    initialCouponCode={couponCode}
                    requiresRegistration={true}
                />
            </div>
        </div>
    );
};
