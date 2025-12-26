import { cn } from "@/lib/utils";
import {
    IconAdjustmentsBolt,
    IconChartBar,
    IconCloud,
    IconCurrencyDollar,
    IconEaseInOut,
    IconHeart,
    IconRouteAltLeft,
    IconShield,
    IconTerminal2,
    IconWallet,
} from "@tabler/icons-react";

import { BlurTextEffect } from '../BlurTextEffect';

export function FeaturesSectionWithHoverEffects() {
    const features = [
        {
            title: "Conexão Bancária",
            description:
                "Conecte e sincronize todas as suas contas bancárias automaticamente em um só lugar.",
            icon: <IconCloud />,
        },
        {
            title: "Dashboard Intuitivo",
            description:
                "Visualize o desempenho das suas finanças com gráficos claros e fáceis de entender.",
            icon: <IconChartBar />,
        },
        {
            title: "Preços Transparentes",
            description:
                "Assinatura acessível com todos os recursos liberados. Sem taxas ocultas.",
            icon: <IconCurrencyDollar />,
        },
        {
            title: "Segurança de Ponta",
            description: "Seus dados protegidos co m criptografia de nível bancário e total privacidade.",
            icon: <IconShield />,
        },
        {
            title: "Gestão de Cartões",
            description: "Controle faturas e limites de múltiplos cartões de crédito sem complicação.",
            icon: <IconWallet />,
        },
        {
            title: "Suporte Especializado",
            description:
                "Nossa equipe está pronta para ajudar você a conquistar seus objetivos financeiros.",
            icon: <IconHeart />,
        },
        {
            title: "Metas Financeiras",
            description:
                "Defina objetivos de economia e acompanhe seu progresso mês a mês.",
            icon: <IconRouteAltLeft />,
        },
        {
            title: "IA Inteligente",
            description: "Insights personalizados para otimizar seus gastos e aumentar seu patrimônio.",
            icon: <IconTerminal2 />,
        },
    ];
    return (
        <div id="features" className="w-full bg-[#262624] py-20">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 relative z-10 container mx-auto px-8">
                {features.map((feature, index) => (
                    <Feature key={feature.title} {...feature} index={index} />
                ))}
            </div>
        </div>
    );
}

const Feature = ({
    title,
    description,
    icon,
    index,
}: {
    title: string;
    description: string;
    icon: React.ReactNode;
    index: number;
}) => {
    return (
        <div
            className={cn(
                "flex flex-col lg:border-r py-10 relative group/feature border-neutral-700",
                (index === 0 || index === 4) && "lg:border-l border-neutral-700",
                index < 4 && "lg:border-b border-neutral-700"
            )}
        >
            {index < 4 && (
                <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-[#30302E] to-transparent pointer-events-none" />
            )}
            {index >= 4 && (
                <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-b from-[#30302E] to-transparent pointer-events-none" />
            )}
            <div className="mb-4 relative z-10 px-10 text-neutral-400">
                {icon}
            </div>
            <div className="text-lg font-bold mb-2 relative z-10 px-10">
                <div className="absolute left-0 inset-y-0 h-6 group-hover/feature:h-8 w-1 rounded-tr-full rounded-br-full bg-neutral-700 group-hover/feature:bg-[#D97757] transition-all duration-200 origin-center" />
                <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-neutral-100">
                    <BlurTextEffect>{title}</BlurTextEffect>
                </span>
            </div>
            <p className="text-sm text-neutral-300 max-w-xs relative z-10 px-10">
                <BlurTextEffect>{description}</BlurTextEffect>
            </p>
        </div>
    );
};
