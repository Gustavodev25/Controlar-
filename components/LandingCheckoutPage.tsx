import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { CheckoutForm } from './CheckoutForm';
import { useToasts } from './Toast';
import logoImg from '../assets/logo.png';
import fogueteImg from '../assets/foguete.png';
import { API_ENDPOINTS } from '../config/api';
import { auth } from '../services/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { updateUserProfile } from '../services/database';
import { toLocalISODate } from '../utils/dateUtils';
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
    const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
    const [finalPrice, setFinalPrice] = useState<number | null>(null);
    const [currentStep, setCurrentStep] = useState<'registration' | 'payment'>('registration');
    const toast = useToasts();

    const planConfig = {
        id: 'pro',
        name: 'Pro',
        price: billingCycle === 'monthly' ? 35.90 : 399.00 / 12,
        annualPrice: 399.00
    };

    const price = billingCycle === 'monthly' ? planConfig.price : planConfig.annualPrice;

    // Formata a data atual para o texto
    const todayDate = new Date();
    const formattedBillingDate = todayDate.toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

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
            console.log('>>> Starting checkout: validation before payment...');

            const originalPrice = price;
            const finalValue = finalPrice !== undefined ? finalPrice : originalPrice;

            if (finalValue < 5) {
                console.log('>>> 100% coupon detected! Creating account directly...');

                const userCredential = await createUserWithEmailAndPassword(
                    auth,
                    registrationData.email,
                    registrationData.password
                );

                const firebaseUser = userCredential.user;

                await updateProfile(firebaseUser, {
                    displayName: registrationData.name
                });

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

            console.log('>>> Creating account...');
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                registrationData.email,
                registrationData.password
            );

            const firebaseUser = userCredential.user;

            await updateProfile(firebaseUser, {
                displayName: registrationData.name
            });

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

            const token = await firebaseUser.getIdToken();

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
                console.error('>>> Payment failed, deleting account...');

                try {
                    const db = (await import('firebase/firestore')).getFirestore();
                    const { deleteDoc, doc } = await import('firebase/firestore');
                    await deleteDoc(doc(db, 'users', firebaseUser.uid));
                } catch (dbError) {
                    console.error('>>> Failed to delete user doc:', dbError);
                }

                try {
                    await firebaseUser.delete();
                } catch (authError) {
                    console.error('>>> Failed to delete Firebase user:', authError);
                }

                throw new Error(subscriptionData.error || 'Pagamento não foi aprovado. Verifique os dados do cartão.');
            }

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
        <div className="min-h-screen flex flex-col md:flex-row bg-white text-gray-900 font-sans">

            {/* Lado Esquerdo - Resumo (Fundo Pastel) */}
            <div className={`w-full md:w-auto bg-[#c8e6c9] p-6 md:p-8 text-gray-900 flex flex-col justify-start items-center md:items-start ${currentStep === 'registration' ? 'hidden md:flex' : 'flex'}`}>
                <button
                    onClick={onBack}
                    className="w-fit p-2 hover:bg-gray-300/30 rounded-xl transition-colors mb-8 text-gray-700 self-start"
                >
                    <ChevronLeft size={24} />
                </button>

                <div className="mb-8">
                    <img src={logoImg} alt="Controlar+" className="w-14 h-14 rounded-2xl object-contain" />
                </div>

                <div className="max-w-md text-center md:text-left">
                    <p className="text-lg font-medium mb-3 opacity-80">Assinar {planConfig.name}</p>

                    <div className="text-[#2e7d32] mb-4 text-sm">
                        Cancele em 7 dias grátis
                    </div>

                    {appliedCoupon ? (
                        <div className="flex items-end justify-between mb-3 gap-4">
                            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-center flex-1">
                                R$ {(finalPrice !== null ? finalPrice : price).toFixed(2).replace('.', ',')}
                            </h1>
                            <span className="text-sm line-through text-gray-500 font-medium">
                                R$ {price.toFixed(2).replace('.', ',')}
                            </span>
                        </div>
                    ) : (
                        <h1 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight text-center">
                            R$ {price.toFixed(2).replace('.', ',')}
                        </h1>
                    )}
                    <p className="text-gray-700 text-sm md:text-base font-medium mb-12 text-center">
                        Conexões bancárias ilimitadas
                    </p>

                    {/* Caixa de detalhes do plano */}
                    <div className="hidden md:block py-5 border-t border-b border-gray-300 mb-8">
                        <div className="flex justify-between font-bold text-sm md:text-base">
                            <span>{planConfig.name}</span>
                            <span>Plano mensal</span>
                        </div>
                        <div className="text-gray-600 text-xs md:text-sm mt-0.5">
                            R$ {price.toFixed(2).replace('.', ',')}/{billingCycle === 'monthly' ? 'mês' : 'ano'}
                        </div>
                    </div>

                    <div className="hidden md:flex justify-between font-semibold mb-6 text-gray-800">
                        <span>Subtotal</span>
                        <span className={appliedCoupon ? 'line-through text-gray-500' : ''}>R$ {price.toFixed(2).replace('.', ',')}</span>
                    </div>

                    {appliedCoupon ? (
                        <div className="hidden md:block bg-[#a5d6a7] border border-[#81c784] rounded-lg p-3 mb-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold text-[#2e7d32]">Cupom: {appliedCoupon.code}</span>
                                <span className="text-sm font-bold text-[#2e7d32]">-R$ {appliedCoupon.discount.toFixed(2).replace('.', ',')}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="hidden md:block mb-4">
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Adicionar Cupom</label>
                            <input
                                type="text"
                                placeholder="Código do cupom"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#81c784] transition-colors"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const code = (e.target as HTMLInputElement).value;
                                        if (code) {
                                            (e.target as HTMLInputElement).value = '';
                                        }
                                    }
                                }}
                            />
                            <p className="text-xs text-gray-500 mt-1">Pressione Enter para aplicar</p>
                        </div>
                    )}

                    <div className="hidden md:flex justify-between text-sm text-gray-700 font-medium mb-3">
                        <span>Total após período de avaliação</span>
                        <span>R$ {(finalPrice !== null ? finalPrice : price).toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div className="hidden md:flex justify-between font-bold text-lg md:text-xl text-gray-900">
                        <span>Total devido hoje</span>
                        <span>R$ {(finalPrice !== null ? finalPrice : price).toFixed(2).replace('.', ',')}</span>
                    </div>
                </div>
            </div>

            {/* Lado Direito - Formulário (Fundo Branco) */}
            <div className={`w-full md:flex-1 bg-white p-8 md:px-16 md:py-20 flex flex-col justify-center overflow-y-auto ${currentStep === 'registration' ? 'justify-center items-center' : ''}`}>
                <div className="max-w-md w-full mx-auto">
                    {/* O componente CheckoutForm deve renderizar apenas os inputs agora */}
                    <CheckoutForm
                        planName="Pro"
                        price={price}
                        billingCycle={billingCycle}
                        onSubmit={handleCheckoutSubmit}
                        onBack={onBack}
                        isLoading={isLoading}
                        initialCouponCode={couponCode}
                        requiresRegistration={true}
                        onCouponApplied={(code, discount, finalValue) => {
                            setAppliedCoupon({ code, discount });
                            setFinalPrice(finalValue);
                        }}
                        onCouponRemoved={() => {
                            setAppliedCoupon(null);
                            setFinalPrice(null);
                        }}
                        onStepChange={(step) => setCurrentStep(step)}
                    />
                </div>
            </div>
        </div>
    );
};