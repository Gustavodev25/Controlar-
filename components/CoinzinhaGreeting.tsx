import React, { useState, useEffect, useMemo } from 'react';

const getGreeting = () => {
    const hour = new Date().getHours();
    const greetings = {
        morning: [
            "Bom dia! Vamos organizar as finanças?",
            "Cafézinho tomado? Hora de lançar!",
            "Olá! Começando o dia com o pé direito?",
            "Bom dia! Pronta para ajudar.",
            "Sol nasceu! E seus investimentos?"
        ],
        afternoon: [
            "Boa tarde! Como está seu dia?",
            "Tarde produtiva por aí?",
            "Olá! Vamos atualizar os gastos?",
            "Boa tarde! Posso ajudar em algo?",
            "Tudo certo com o orçamento?"
        ],
        night: [
            "Boa noite! Vamos fechar o dia?",
            "Hora de relaxar e conferir o saldo.",
            "Boa noite! Alguma novidade financeira?",
            "Olá! Como foi o dia de hoje?",
            "Antes de dormir, que tal um registro?"
        ]
    };

    let options = greetings.night;
    if (hour >= 5 && hour < 12) options = greetings.morning;
    else if (hour >= 12 && hour < 18) options = greetings.afternoon;

    return options[Math.floor(Math.random() * options.length)];
};

export const CoinzinhaGreeting: React.FC = () => {
    const [displayedText, setDisplayedText] = useState('');
    const fullText = useMemo(() => getGreeting(), []);

    useEffect(() => {
        let index = 0;
        const intervalId = setInterval(() => {
            setDisplayedText(fullText.slice(0, index + 1));
            index++;
            if (index > fullText.length) {
                clearInterval(intervalId);
            }
        }, 35); // Velocidade da digitação

        return () => clearInterval(intervalId);
    }, [fullText]);

    return (
        <div className="mb-2 relative inline-block animate-fade-in-up">
            <div className="bg-[#30302E] border border-gray-700 text-gray-200 px-4 py-3 rounded-2xl text-sm font-medium shadow-xl relative z-10 max-w-[240px] mx-auto text-left">
                <p className="leading-relaxed">
                    {displayedText}
                    <span className="animate-pulse inline-block ml-0.5 text-[#d97757] font-bold">|</span>
                </p>
            </div>
            {/* Speech Bubble Tail */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#30302E] border-b border-r border-gray-700 transform rotate-45 z-0"></div>
        </div>
    );
};