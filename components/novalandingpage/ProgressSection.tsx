import React from 'react';

export function ProgressSection() {
    return (
        <div className="w-full bg-[#262624] py-20">
            <div className="container mx-auto px-8">
                {/* Header */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-12 gap-6">
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#faf9f5] max-w-xl leading-tight">
                        Acompanhe Suas Metas Financeiras com Facilidade.
                    </h2>
                    <p className="text-neutral-400 max-w-sm text-base lg:text-lg">
                        Visualize seus projetos atuais e futuros para ter uma visão clara do seu progresso financeiro.
                    </p>
                </div>

                {/* Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    {/* Card 1 - Salary Mockup */}
                    <div className="bg-[#30302E] rounded-2xl p-6 border border-neutral-700 flex items-center justify-center">
                        <img
                            src="/assets/mockup1.png"
                            alt="Mockup de salário"
                            className="w-full h-auto rounded-xl"
                        />
                    </div>

                    {/* Card 2 - Calendar */}
                    <div className="bg-[#30302E] rounded-2xl p-6 border border-neutral-700 flex flex-col">
                        {/* Inner Card - Calendar Content */}
                        <div className="bg-[#30302E] rounded-xl overflow-hidden border border-[#373734] shadow-xl shadow-black/20 p-4 flex-1 flex flex-col">
                            {/* Header */}
                            <div className="flex justify-between items-start mb-1">
                                <div>
                                    <span className="text-xs text-[#D97757] font-semibold tracking-wider">CALENDÁRIO FINANCEIRO</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <svg className="w-5 h-5 text-[#faf9f5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <h3 className="text-[#faf9f5] font-bold text-xl">Dezembro de 2025</h3>
                                    </div>
                                    <p className="text-neutral-500 text-sm mt-1">Clique em um dia para ver transações e lembretes.</p>
                                </div>
                                {/* Legend */}
                                <div className="flex items-center gap-4 text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                                        <span className="text-neutral-400">Receitas</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                                        <span className="text-neutral-400">Despesas</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                                        <span className="text-neutral-400">Lembretes</span>
                                    </div>
                                </div>
                            </div>

                            {/* Days of Week */}
                            <div className="grid grid-cols-7 gap-1 mt-4 mb-1">
                                {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'].map((day) => (
                                    <div key={day} className="text-center text-[10px] text-neutral-500 font-medium py-1">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7 gap-1 flex-1">
                                {/* Empty cells for days before month starts (December 2025 starts on Monday) */}
                                <div></div>

                                {/* Day 1 - Expense + Event */}
                                <div className="bg-[#262624] rounded p-1.5 flex flex-col justify-between border border-transparent hover:border-neutral-600 transition-colors cursor-pointer min-h-[40px]">
                                    <div className="flex justify-between items-start">
                                        <span className="text-[#faf9f5] text-xs font-medium">1</span>
                                        <svg className="w-3 h-3 text-[#D97757]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                </div>

                                {/* Day 2 */}
                                <div className="bg-[#262624] rounded p-1.5 flex flex-col justify-between border border-transparent hover:border-neutral-600 transition-colors cursor-pointer min-h-[40px]">
                                    <span className="text-[#faf9f5] text-xs font-medium">2</span>
                                </div>

                                {/* Day 3 */}
                                <div className="bg-[#262624] rounded p-1.5 flex flex-col justify-between border border-transparent hover:border-neutral-600 transition-colors cursor-pointer min-h-[40px]">
                                    <span className="text-[#faf9f5] text-xs font-medium">3</span>
                                </div>

                                {/* Day 4 */}
                                <div className="bg-[#262624] rounded p-1.5 flex flex-col justify-between border border-transparent hover:border-neutral-600 transition-colors cursor-pointer min-h-[40px]">
                                    <span className="text-[#faf9f5] text-xs font-medium">4</span>
                                </div>

                                {/* Day 5 - Receita + Event (highlighted) */}
                                <div className="bg-[#262624] rounded p-1.5 flex flex-col justify-between border border-[#D97757] cursor-pointer min-h-[40px]">
                                    <div className="flex justify-between items-start">
                                        <span className="text-[#faf9f5] text-xs font-medium">5</span>
                                        <svg className="w-3 h-3 text-[#D97757]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                </div>

                                {/* Day 6 */}
                                <div className="bg-[#262624] rounded p-1.5 flex flex-col justify-between border border-transparent hover:border-neutral-600 transition-colors cursor-pointer min-h-[40px]">
                                    <span className="text-[#faf9f5] text-xs font-medium">6</span>
                                </div>

                                {/* Day 7 - Expense + Event */}
                                <div className="bg-[#262624] rounded p-1.5 flex flex-col justify-between border border-transparent hover:border-neutral-600 transition-colors cursor-pointer min-h-[40px]">
                                    <div className="flex justify-between items-start">
                                        <span className="text-[#faf9f5] text-xs font-medium">7</span>
                                        <svg className="w-3 h-3 text-[#D97757]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                </div>

                                {/* Day 8 */}
                                <div className="bg-[#262624] rounded p-1.5 flex flex-col justify-between border border-transparent hover:border-neutral-600 transition-colors cursor-pointer min-h-[40px]">
                                    <span className="text-[#faf9f5] text-xs font-medium">8</span>
                                </div>

                                {/* Day 9 - Expense + Event */}
                                <div className="bg-[#262624] rounded p-1.5 flex flex-col justify-between border border-transparent hover:border-neutral-600 transition-colors cursor-pointer min-h-[40px]">
                                    <div className="flex justify-between items-start">
                                        <span className="text-[#faf9f5] text-xs font-medium">9</span>
                                        <svg className="w-3 h-3 text-[#D97757]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                </div>

                                {/* Days 10-13 */}
                                {[10, 11, 12, 13].map((day) => (
                                    <div key={day} className="bg-[#262624] rounded p-1.5 flex flex-col justify-between border border-transparent hover:border-neutral-600 transition-colors cursor-pointer min-h-[40px]">
                                        <span className="text-[#faf9f5] text-xs font-medium">{day}</span>
                                    </div>
                                ))}

                                {/* Days 14-19 */}
                                {[14, 15, 16, 17, 18, 19].map((day) => (
                                    <div key={day} className="bg-[#262624] rounded p-1.5 flex flex-col justify-between border border-transparent hover:border-neutral-600 transition-colors cursor-pointer min-h-[40px]">
                                        <span className="text-[#faf9f5] text-xs font-medium">{day}</span>
                                    </div>
                                ))}

                                {/* Day 20 - Expense + Event (highlighted) */}
                                <div className="bg-[#262624] rounded p-1.5 flex flex-col justify-between border border-[#D97757] cursor-pointer min-h-[40px]">
                                    <div className="flex justify-between items-start">
                                        <span className="text-[#faf9f5] text-xs font-medium">20</span>
                                        <svg className="w-3 h-3 text-[#D97757]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                </div>

                                {/* Days 21-24 */}
                                {[21, 22, 23, 24].map((day) => (
                                    <div key={day} className="bg-[#262624] rounded p-1.5 flex flex-col justify-between border border-transparent hover:border-neutral-600 transition-colors cursor-pointer min-h-[40px]">
                                        <span className="text-[#faf9f5] text-xs font-medium">{day}</span>
                                    </div>
                                ))}

                                {/* Day 25 - TODAY (highlighted) */}
                                <div className="bg-[#262624] rounded p-1.5 flex flex-col justify-between border border-[#D97757] cursor-pointer min-h-[40px]">
                                    <span className="text-[#faf9f5] text-xs font-medium">25</span>
                                    <span className="text-[#D97757] text-[8px] font-semibold">HOJE</span>
                                </div>

                                {/* Day 26-27 */}
                                {[26, 27].map((day) => (
                                    <div key={day} className="bg-[#262624] rounded p-1.5 flex flex-col justify-between border border-transparent hover:border-neutral-600 transition-colors cursor-pointer min-h-[40px]">
                                        <span className="text-[#faf9f5] text-xs font-medium">{day}</span>
                                    </div>
                                ))}

                                {/* Days 28-31 */}
                                {[28, 29, 30, 31].map((day) => (
                                    <div key={day} className="bg-[#262624] rounded p-1.5 flex flex-col justify-between border border-transparent hover:border-neutral-600 transition-colors cursor-pointer min-h-[40px]">
                                        <span className="text-[#faf9f5] text-xs font-medium">{day}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
