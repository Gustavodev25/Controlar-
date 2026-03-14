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
            phone: string;
        }
    ) => {
        if (!registrationData) {
            toast.error('Dados de cadastro não encontrados.');
            return;
        }

        setIsLoading(true);

        try {
            // ⭐ FIXED: Process payment FIRST, then create account only if payment succeeds
            // This prevents orphaned accounts without confirmed payment
            console.log('>>> Starting checkout: validation before payment...');

            // 1. Calcular preço final
            const originalPrice = price;
            const finalValue = finalPrice !== undefined ? finalPrice : originalPrice;

            // 2. SPECIAL CASE: Se o preço final for < R$ 5 (Asaas mínimo), criar conta direto
            if (finalValue < 5) {
                console.log('>>> 100% coupon detected! Creating account directly...');

                // Create the actual account
                const userCredential = await createUserWithEmailAndPassword(
                    auth,
                    registrationData.email,
                    registrationData.password
                );

                const firebaseUser = userCredential.user;

                // Update displayName
                await updateProfile(firebaseUser, {
                    displayName: registrationData.name
                });

                // Save complete profile
                const nextBillingDate = new Date();
                if (billingCycle === 'annual') {
                    nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
                } else {
                    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
                }

                await updateUserProfile(firebaseUser.uid, {
                    name: registrationData.name,
                    email: registrationData.email,
                    phone: registrationData.phone,
                    baseSalary: 0,
                    isAdmin: false,
                    cpf: registrationData.cpf,
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
                    },
                    createdAt: new Date().toISOString()
                });

                localStorage.setItem('show_pro_tutorial', 'true');
                sessionStorage.removeItem('pro_tutorial_session_seen');

                toast.success('🎉 Conta criada e cupom 100% aplicado com sucesso!');
                onSuccess();
                return;
            }

            // 3. Create account FIRST, then process payment
            console.log('>>> Creating account...');
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                registrationData.email,
                registrationData.password
            );

            const firebaseUser = userCredential.user;

            // Update displayName
            await updateProfile(firebaseUser, {
                displayName: registrationData.name
            });

            // Save complete profile (without subscription yet)
            await updateUserProfile(firebaseUser.uid, {
                name: registrationData.name,
                email: registrationData.email,
                phone: registrationData.phone,
                baseSalary: 0,
                isAdmin: false,
                cpf: registrationData.cpf,
                createdAt: new Date().toISOString()
            });

            console.log('>>> Account created:', firebaseUser.uid);

            // 4. Get auth token for API requests
            const token = await firebaseUser.getIdToken();

            // 5. Criar cliente no Asaas
            console.log('>>> Creating customer in Asaas...');
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

            console.log('>>> Customer created:', customerData.customer.id);

            // 6. Criar assinatura/pagamento no Asaas
            // Get UTM data for Utmify tracking
            const utmData = getCompleteUtmData();

            console.log('>>> Processing payment...');
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
                        ccv: cardData.cvv,
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
                    utmData,
                }),
            });

            const subscriptionData = await subscriptionResponse.json();

            console.log('>>> Payment response:', subscriptionData);

            if (!subscriptionResponse.ok || !subscriptionData.success) {
                // Payment failed - delete the account we just created
                console.error('>>> Payment failed, deleting account...');

                try {
                    // Delete from Firestore first
                    const db = (await import('firebase/firestore')).getFirestore();
                    const { deleteDoc, doc } = await import('firebase/firestore');
                    await deleteDoc(doc(db, 'users', firebaseUser.uid));
                } catch (dbError) {
                    console.error('>>> Failed to delete user doc:', dbError);
                }

                // Then delete Firebase Auth user
                try {
                    await firebaseUser.delete();
                } catch (authError) {
                    console.error('>>> Failed to delete Firebase user:', authError);
                }

                throw new Error(subscriptionData.error || 'Pagamento não foi aprovado. Verifique os dados do cartão.');
            }

            // 7. Payment confirmed! Just update payment details in the profile
            if (subscriptionData.status === 'CONFIRMED' || subscriptionData.status === 'RECEIVED') {
                console.log('>>> Payment confirmed! Updating account with payment details...');

                await updateUserProfile(firebaseUser.uid, {
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
                // Payment status is not confirmed - delete the account
                console.error('>>> Payment not confirmed, deleting account...');

                try {
                    const db = (await import('firebase/firestore')).getFirestore();
                    const { deleteDoc, doc } = await import('firebase/firestore');
                    await deleteDoc(doc(db, 'users', firebaseUser.uid));
                    await firebaseUser.delete();
                } catch (cleanupError) {
                    console.error('>>> Failed to cleanup:', cleanupError);
                }

                throw new Error('Pagamento não confirmado. Por favor, tente novamente.');
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
