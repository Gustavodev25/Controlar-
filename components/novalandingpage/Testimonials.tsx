
import React from "react";
import { motion } from "framer-motion";
import { BlurTextEffect } from '../BlurTextEffect';

const testimonials = [
    {
        text: "O Controlar+ mudou completamente a forma como lido com meu dinheiro. A clareza que tenho agora é impressionante!",
        image: "https://randomuser.me/api/portraits/men/32.jpg",
        name: "Carlos Eduardo",
        role: "Designer Gráfico",
    },
    {
        text: "Finalmente consegui organizar minhas faturas de cartão de crédito. O sistema é muito intuitivo e fácil de usar.",
        image: "https://randomuser.me/api/portraits/women/44.jpg",
        name: "Fernanda Lima",
        role: "Engenheira Civil",
    },
    {
        text: "A integração automática com os bancos me poupa horas todos os meses. Recomendo demais!",
        image: "https://randomuser.me/api/portraits/men/86.jpg",
        name: "Ricardo Souza",
        role: "Desenvolvedor",
    },
    {
        text: "Interface linda e muito fluida. Dá gosto de entrar para ver as finanças.",
        image: "https://randomuser.me/api/portraits/women/68.jpg",
        name: "Maria Antonieta",
        role: "Arquiteta",
    },
    {
        text: "O suporte é incrível e as funcionalidades de IA me ajudam a prever gastos futuros. Sensacional.",
        image: "https://randomuser.me/api/portraits/men/62.jpg",
        name: "João Pedro",
        role: "Empresário",
    },
    {
        text: "Simplesmente o melhor gerenciador financeiro que já usei. Vale cada centavo.",
        image: "https://randomuser.me/api/portraits/women/90.jpg",
        name: "Jéssica Alves",
        role: "Marketing",
    },
];

export const TestimonialsColumn = (props: {
    className?: string;
    testimonials: typeof testimonials;
    duration?: number;
}) => {
    return (
        <div className={props.className}>
            <motion.div
                animate={{
                    translateY: "-50%",
                }}
                transition={{
                    duration: props.duration || 10,
                    repeat: Infinity,
                    ease: "linear",
                    repeatType: "loop",
                }}
                className="flex flex-col gap-6 pb-6"
            >
                {[
                    ...new Array(2).fill(0).map((_, index) => (
                        <React.Fragment key={index}>
                            {props.testimonials.map(({ text, image, name, role }, i) => (
                                <div className="bg-[#30302E] rounded-2xl p-6 border border-neutral-700 flex flex-col gap-6 max-w-xs w-full" key={i}>
                                    <div className="text-[#faf9f5] leading-relaxed text-sm">{text}</div>
                                    <div className="flex items-center gap-3">
                                        <img
                                            width={40}
                                            height={40}
                                            src={image}
                                            alt={name}
                                            className="h-10 w-10 rounded-full bg-neutral-800 object-cover"
                                        />
                                        <div className="flex flex-col">
                                            <div className="font-medium tracking-tight text-[#faf9f5] leading-5 text-sm">{name}</div>
                                            <div className="leading-5 text-neutral-500 tracking-tight text-xs font-medium">{role}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </React.Fragment>
                    )),
                ]}
            </motion.div>
        </div>
    );
};

export function TestimonialsSection() {
    return (
        <section id="testimonials" className="bg-[#262624] py-20 overflow-hidden relative">

            {/* Gradient Overlay Top/Bottom for smooth fading */}
            <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-[#262624] to-transparent z-10 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-full h-20 bg-gradient-to-t from-[#262624] to-transparent z-10 pointer-events-none"></div>

            <div className="container mx-auto px-8 mb-12 text-center relative z-20">
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#faf9f5] mb-6">
                    <BlurTextEffect>O que dizem nossos usuários</BlurTextEffect>
                </h2>
                <p className="text-neutral-400 max-w-xl mx-auto text-lg">
                    Junte-se a milhares de pessoas que já transformaram sua vida financeira com o Controlar+.
                </p>
            </div>

            <div className="flex justify-center gap-6 max-h-[700px] overflow-hidden relative z-0">
                <TestimonialsColumn testimonials={testimonials.slice(0, 3)} duration={15} />
                <TestimonialsColumn testimonials={testimonials.slice(3, 6)} className="hidden md:block" duration={19} />
                <TestimonialsColumn testimonials={testimonials.slice(0, 3).reverse()} className="hidden lg:block" duration={17} />
            </div>
        </section>
    );
}
