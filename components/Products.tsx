import React, { useState, useEffect } from 'react';
import {
    Home,
    Heart,
    Shield,
    Banknote,
    TrendingUp,
    Globe,
    PieChart,
    Building2,
    Users,
    MessageCircle,
    ArrowRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { UniversalModal, ModalSection, ModalDivider } from './UniversalModal';
import { GlowingEffect } from './GlowingEffect';
import { Button } from './Button';
import felipeImg from '../assets/felipe.png';
import xpIcon from '../assets/bancos/xp.png';
import NumberFlow from '@number-flow/react';

interface Product {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    whatsappMessage: string;
    color: string;
}

const products: Product[] = [
    {
        id: 'consorcios',
        title: 'Consórcios',
        description: 'Planeje a compra do seu bem com taxas reduzidas e sem juros.',
        icon: <Users size={24} />,
        whatsappMessage: 'Olá! Gostaria de saber mais sobre Consórcios.',
        color: '#3B82F6' // Blue
    },
    {
        id: 'financiamento',
        title: 'Financiamento Imobiliário',
        description: 'Conquiste a casa própria com as melhores condições do mercado.',
        icon: <Home size={24} />,
        whatsappMessage: 'Olá! Gostaria de fazer uma simulação de Financiamento Imobiliário.',
        color: '#8B5CF6' // Purple
    },
    {
        id: 'saude',
        title: 'Plano de Saúde',
        description: 'Cuide de você e da sua família com os melhores convênios.',
        icon: <Heart size={24} />,
        whatsappMessage: 'Olá! Estou interessado em cotar um Plano de Saúde.',
        color: '#EF4444' // Red
    },
    {
        id: 'seguro',
        title: 'Seguro de Vida',
        description: 'Proteção financeira para quem você mais ama, com tranquilidade.',
        icon: <Shield size={24} />,
        whatsappMessage: 'Olá! Quero conhecer as opções de Seguro de Vida.',
        color: '#10B981' // Green
    },
    {
        id: 'cambio',
        title: 'Câmbio',
        description: 'Soluções de câmbio para viagens e transferências internacionais.',
        icon: <Banknote size={24} />,
        whatsappMessage: 'Olá! Preciso de informações sobre serviços de Câmbio.',
        color: '#F59E0B' // Amber
    },
    {
        id: 'assessoria',
        title: 'Assessoria de Investimentos',
        description: 'Especialistas dedicados para multiplicar o seu patrimônio.',
        icon: <TrendingUp size={24} />,
        whatsappMessage: 'Olá! Gostaria de falar com um Assessor de Investimentos.',
        color: '#06B6D4' // Cyan
    },
    {
        id: 'internacional',
        title: 'Investimentos Internacionais',
        description: 'Diversifique sua carteira investindo nas maiores economias do mundo.',
        icon: <Globe size={24} />,
        whatsappMessage: 'Olá! Tenho interesse em Investimentos Internacionais.',
        color: '#EC4899' // Pink
    },
    {
        id: 'planejamento',
        title: 'Planejamento Financeiro',
        description: 'Organize suas finanças e trace metas claras para o futuro.',
        icon: <PieChart size={24} />,
        whatsappMessage: 'Olá! Quero saber como funciona o Planejamento Financeiro.',
        color: '#6366F1' // Indigo
    },
    {
        id: 'empresas',
        title: 'Soluções para Empresas',
        description: 'Crédito, gestão de caixa e benefícios para o seu negócio.',
        icon: <Building2 size={24} />,
        whatsappMessage: 'Olá! Busco Soluções Financeiras para minha Empresa.',
        color: '#64748B' // Slate
    }
];

export const Products: React.FC = () => {
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [stats, setStats] = useState({ custodia: 0, clientes: 0, anos: 0 });

    useEffect(() => {
        const timer = setTimeout(() => {
            setStats({ custodia: 17, clientes: 22000, anos: 20 });
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    const handleProductClick = (product: Product) => {
        setSelectedProduct(product);
    };

    const handleCloseModal = () => {
        setSelectedProduct(null);
    };

    const handleWhatsAppRedirect = () => {
        if (selectedProduct) {
            // Replace with the actual support number. Using a placeholder or generic one.
            // If the user has a specific number, they can provide it. I'll use a generic intent link structure.
            // Assuming a brazilian number, e.g., standard business number. I will leave the number empty so it opens the contact picker or use a standard one if the user provided one previously.
            // The instructions say "envia para um whatsapp". I'll use a specific efficient link.
            // Since I don't have the specific number in the prompt, I'll use a placeholder or logic.
            // Looking at previous context there is no specific sales number, only the AI bot number.
            // I will use a placeholder number '5511999999999' which user can easily search and replace, or just launch whatsapp with text if possible (needs number usually).
            // I will use a blank number to force user to pick contact or use a placeholder that is obvious.
            // Actually, better to use a placeholder and comment.
            const phoneNumber = "5511973778790";
            const message = encodeURIComponent(selectedProduct.whatsappMessage);
            window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
            handleCloseModal();
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto mb-20">
            <div className="mb-10 relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#1c1c1a] to-[#2a2a27] border border-[#373734] p-6 sm:p-8">
                <div className="absolute top-0 right-0 -mt-6 -mr-6 opacity-[0.07] rotate-12 blur-[1px] z-0 pointer-events-none">
                    <img src={xpIcon} alt="XP Logo" className="w-40 h-auto grayscale" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row items-center md:items-center justify-between gap-6 md:gap-12">
                    <div className="w-full max-w-2xl text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-3 mb-3">
                            <span className="bg-[#fbbf24]/10 text-[#fbbf24] text-xs font-bold px-2.5 py-1 rounded-full border border-[#fbbf24]/20 uppercase tracking-widest flex items-center gap-1.5">
                                <Shield size={12} className="fill-[#fbbf24]" />
                                Assessor Credenciado
                            </span>
                            <span className="text-gray-500 text-xs font-semibold uppercase tracking-widest hidden sm:inline-block">Parceiro XP Investimentos</span>
                        </div>

                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
                            Excelência e confiança para o seu patrimônio.
                        </h1>

                        <p className="text-gray-400 text-sm md:text-base leading-relaxed mb-6 mx-auto md:mx-0 max-w-lg md:max-w-none">
                            Conte com a segurança e a credibilidade de um escritório credenciado à <strong className="text-white">XP Investimentos</strong>. Oferecemos uma curadoria exclusiva de produtos financeiros para cada etapa da sua vida, com atendimento personalizado e transparente.
                        </p>

                        <div className="grid grid-cols-3 gap-4 md:gap-6 py-2 border-t border-white/5 md:border-none pt-4 md:pt-2 mt-4 md:mt-0">
                            <div>
                                <p className="text-2xl md:text-3xl font-bold text-white flex items-center justify-center md:justify-start gap-1">
                                    R$ <NumberFlow value={stats.custodia} format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }} /> Bi
                                </p>
                                <p className="text-[10px] md:text-xs text-gray-400 mt-1 uppercase tracking-wider font-medium">Sob Custódia</p>
                            </div>
                            <div>
                                <p className="text-2xl md:text-3xl font-bold text-white flex items-center justify-center md:justify-start gap-1">
                                    + <NumberFlow value={stats.clientes} />
                                </p>
                                <p className="text-[10px] md:text-xs text-gray-400 mt-1 uppercase tracking-wider font-medium">Clientes</p>
                            </div>
                            <div>
                                <p className="text-2xl md:text-3xl font-bold text-white flex items-center justify-center md:justify-start gap-1">
                                    + <NumberFlow value={stats.anos} />
                                </p>
                                <p className="text-[10px] md:text-xs text-gray-400 mt-1 uppercase tracking-wider font-medium">Anos de mercado</p>
                            </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-white/5 hidden md:block">
                            <p className="text-[#fbbf24] font-medium tracking-wide">Felipe Batista</p>
                            <p className="text-xs text-gray-500 uppercase tracking-widest mt-0.5">Assessor de Investimentos</p>
                        </div>
                    </div>

                    {/* Advisor Image - Free standing with mask */}
                    <div className="relative -mb-10 mt-4 md:mt-0 md:-mr-8 shrink-0">
                        <img
                            src={felipeImg}
                            alt="Assessor"
                            className="h-64 sm:h-80 md:h-96 w-auto object-cover object-top mask-image-gradient scale-x-[-1]"
                            style={{
                                maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
                                WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)'
                            }}
                        />
                        <div className="md:hidden absolute bottom-4 right-0 left-0 text-center pb-4">
                            <p className="text-[#fbbf24] font-medium tracking-wide text-sm drop-shadow-md">Felipe Batista</p>
                            <p className="text-[10px] text-gray-300 uppercase tracking-widest mt-0.5 drop-shadow-md">Assessor de Investimentos</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product, index) => (
                    <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => handleProductClick(product)}
                        className="group relative bg-[#30302E] border border-gray-800 rounded-2xl p-6 cursor-pointer hover:border-[#d97757]/50 hover:bg-[#373734] transition-all duration-300 overflow-hidden"
                    >
                        <GlowingEffect
                            spread={40}
                            glow={true}
                            disabled={false}
                            proximity={64}
                            inactiveZone={0.01}
                            variant="orange"
                            borderWidth={2}
                        />
                        <div className="relative z-10">
                            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[#d97757] transition-colors">{product.title}</h3>
                            <p className="text-sm text-gray-400 leading-relaxed mb-4">
                                {product.description}
                            </p>

                            <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider mt-auto pt-4 border-t border-gray-800/50 group-hover:border-gray-700">
                                <span>Saiba mais</span>
                                <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-[-10px] group-hover:translate-x-0 text-[#d97757]">
                                    <ArrowRight size={16} />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Universal Modal for WhatsApp Redirection */}
            <UniversalModal
                isOpen={!!selectedProduct}
                onClose={handleCloseModal}
                title={selectedProduct?.title}
                subtitle="Entre em contato com um especialista"
                themeColor="#D97757"
            >
                <div className="flex flex-col items-stretch text-center p-4">
                    <div className="w-16 h-16 mx-auto bg-[#D97757]/10 rounded-full flex items-center justify-center mb-6 text-[#D97757] animate-pulse">
                        <MessageCircle size={32} />
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2">
                        Iniciar conversa no WhatsApp
                    </h3>

                    <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
                        Você será redirecionado para o WhatsApp para falar com nosso time de especialistas em <strong>{selectedProduct?.title}</strong>.
                    </p>

                    <ModalSection icon={<MessageCircle size={16} />} title="Mensagem pré-definida" iconClassName="text-[#D97757]">
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-sm text-gray-300 italic mb-6">
                            "{selectedProduct?.whatsappMessage}"
                        </div>
                    </ModalSection>

                    <Button
                        onClick={handleWhatsAppRedirect}
                        fullWidth
                        size="lg"
                    >
                        <MessageCircle size={20} />
                        Continuar para o WhatsApp
                    </Button>
                </div>
            </UniversalModal>
        </div>
    );
};
