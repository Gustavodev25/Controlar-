import React, { useEffect, useMemo, useState } from 'react';
import { Flame, TrendingUp, Target, Calendar, DollarSign, Percent, Wallet, Info, HelpCircle, Sparkles, Lock } from 'lucide-react';
import { Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import NumberFlow from '@number-flow/react';

interface FireCalculatorProps {
    netWorth: number;
    averageMonthlyExpense: number;
    averageMonthlySavings: number;
    userPlan?: 'starter' | 'pro' | 'family';
    onUpgradeClick?: () => void;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export const FireCalculator: React.FC<FireCalculatorProps> = ({
    netWorth,
    averageMonthlyExpense,
    averageMonthlySavings,
    userPlan = 'starter',
    onUpgradeClick
}) => {
    const [currentNetWorth, setCurrentNetWorth] = useState(Math.max(netWorth, 0));
    const [monthlyContribution, setMonthlyContribution] = useState(Math.max(averageMonthlySavings, 0));
    const [monthlyExpense, setMonthlyExpense] = useState(Math.max(averageMonthlyExpense, 0));
    const [annualRate, setAnnualRate] = useState(8);
    const [showGuide, setShowGuide] = useState(false);

    useEffect(() => setCurrentNetWorth(Math.max(netWorth, 0)), [netWorth]);
    useEffect(() => setMonthlyContribution(Math.max(averageMonthlySavings, 0)), [averageMonthlySavings]);
    useEffect(() => setMonthlyExpense(Math.max(averageMonthlyExpense, 0)), [averageMonthlyExpense]);

    const fireTarget = useMemo(() => Math.max(monthlyExpense, 0) * 12 * 25, [monthlyExpense]);

    const projection = useMemo(() => {
        const monthlyRate = Math.max(annualRate, 0) / 100 / 12;
        const data: { label: string; patrimony: number; target: number }[] = [];
        let balance = Math.max(currentNetWorth, 0);
        const start = new Date();
        const formatLabel = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        const target = fireTarget;
        let reachedAt: number | null = target === 0 || balance >= target ? 0 : null;

        data.push({ label: formatLabel(start), patrimony: balance, target });

        const maxMonths = 50 * 12;
        for (let i = 1; i <= maxMonths; i++) {
            balance = balance * (1 + monthlyRate) + monthlyContribution;
            const pointDate = new Date(start.getFullYear(), start.getMonth() + i, 1);
            data.push({ label: formatLabel(pointDate), patrimony: balance, target });

            if (reachedAt === null && balance >= target) {
                reachedAt = i;
            }
            if (reachedAt !== null && i > reachedAt + 12) {
                break;
            }
        }
        return { data, reachedAt };
    }, [annualRate, currentNetWorth, fireTarget, monthlyContribution]);

    const freedomDate = useMemo(() => {
        if (projection.reachedAt === null) return null;
        const d = new Date();
        d.setMonth(d.getMonth() + projection.reachedAt);
        return d;
    }, [projection.reachedAt]);

    const timelineMonths = projection.reachedAt ?? Math.max(projection.data.length - 1, 0);
    const years = Math.floor(timelineMonths / 12);
    const months = timelineMonths % 12;
    const formattedFreedomDate = freedomDate
        ? freedomDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        : null;

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;
        return (
            <div className="bg-gray-950/90 border border-gray-800 rounded-xl p-4 shadow-2xl backdrop-blur-md">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2">{label}</p>
                {payload.map((entry: any) => (
                    <div key={entry.name} className="flex items-center gap-3 mb-1 last:mb-0">
                        <div className={`w-2 h-2 rounded-full ${entry.name === 'Patrimônio' ? 'bg-[#d97757]' : 'bg-gray-600'}`} />
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 uppercase font-bold">{entry.name}</span>
                            <span className={`font-mono font-bold ${entry.name === 'Patrimônio' ? 'text-white' : 'text-gray-400'}`}>
                                {formatCurrency(entry.value)}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const handleNumberChange = (value: string, setter: (val: number) => void) => {
        const parsed = parseFloat(value.replace(',', '.'));
        setter(isNaN(parsed) ? 0 : Math.max(parsed, 0));
    };

    if (userPlan === 'starter') {
        return (
            <div className="w-full min-h-[600px] bg-gray-950 border border-gray-800 rounded-3xl flex flex-col items-center justify-center p-8 md:p-12 relative overflow-hidden group">
                {/* Animated Background Gradient */}
                <div className="absolute inset-0 opacity-30">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#d97757]/10 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                </div>

                {/* Grid Pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(217,119,87,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(217,119,87,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black,transparent)]"></div>

                <div className="relative z-10 text-center max-w-xl space-y-8">
                    {/* Icon with Glow */}
                    <div className="relative inline-flex">
                        <div className="absolute inset-0 bg-[#d97757]/20 rounded-3xl blur-2xl"></div>
                        <div className="relative w-28 h-28 bg-gradient-to-br from-gray-900 to-gray-950 rounded-3xl flex items-center justify-center shadow-2xl border border-gray-800">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#d97757]/10 to-transparent rounded-3xl"></div>
                            <Lock size={48} className="text-[#d97757] relative z-10" />
                        </div>
                    </div>

                    {/* Title & Description */}
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#d97757]/10 border border-[#d97757]/20 rounded-full">
                            <Flame size={16} className="text-[#d97757]" />
                            <span className="text-xs font-bold text-[#d97757] uppercase tracking-wider">Recurso Premium</span>
                        </div>

                        <h2 className="text-4xl md:text-5xl font-bold text-white">
                            Calculadora <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d97757] to-orange-500">FIRE</span>
                        </h2>

                        <p className="text-gray-400 text-base leading-relaxed max-w-lg mx-auto">
                            Descubra quando você poderá se aposentar com <strong className="text-white">Independência Financeira</strong>. Projete seu patrimônio, visualize gráficos detalhados e planeje sua liberdade financeira.
                        </p>
                    </div>

                    {/* Features List */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                        <div className="flex items-start gap-3 p-4 bg-gray-900/30 border border-gray-800 rounded-xl">
                            <div className="p-2 bg-[#d97757]/10 rounded-lg">
                                <TrendingUp size={18} className="text-[#d97757]" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white">Projeções</p>
                                <p className="text-xs text-gray-500">Gráficos avançados</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-4 bg-gray-900/30 border border-gray-800 rounded-xl">
                            <div className="p-2 bg-[#d97757]/10 rounded-lg">
                                <Target size={18} className="text-[#d97757]" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white">Meta FIRE</p>
                                <p className="text-xs text-gray-500">Cálculo automático</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-4 bg-gray-900/30 border border-gray-800 rounded-xl">
                            <div className="p-2 bg-[#d97757]/10 rounded-lg">
                                <Calendar size={18} className="text-[#d97757]" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white">Data Exata</p>
                                <p className="text-xs text-gray-500">Sua liberdade</p>
                            </div>
                        </div>
                    </div>

                    {/* CTA Button */}
                    <button
                        onClick={onUpgradeClick}
                        className="group/btn relative px-10 py-5 bg-gradient-to-r from-[#d97757] to-[#c56a4d] hover:from-[#c56a4d] hover:to-[#b55a3d] text-white rounded-2xl font-bold text-lg transition-all shadow-xl shadow-[#d97757]/30 hover:shadow-[#d97757]/50 hover:-translate-y-1 flex items-center justify-center gap-3 mx-auto overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000"></div>
                        <Sparkles size={20} className="relative z-10" />
                        <span className="relative z-10">Desbloquear FIRE Premium</span>
                    </button>

                    <p className="text-xs text-gray-600">
                        Disponível nos planos <span className="text-[#d97757] font-bold">Pro</span> e <span className="text-[#d97757] font-bold">Family</span>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full space-y-8 animate-fade-in font-sans pb-10">

            {/* HEADER */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Simulador FIRE</h2>
                    <p className="text-gray-400 text-sm mt-1">Planejamento de Independência Financeira</p>
                </div>

                <button
                    onClick={() => setShowGuide(!showGuide)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 border ${showGuide ? 'bg-[#d97757]/10 text-[#d97757] border-[#d97757]/20' : 'bg-gray-900 text-gray-400 border-gray-800 hover:text-white'}`}
                >
                    <HelpCircle size={16} /> {showGuide ? 'Ocultar Guia' : 'Entenda o cálculo'}
                </button>
            </div>

            {/* ÁREA DE CONTEÚDO */}
            <div className="grid gap-6 md:grid-cols-12">

                {/* COLUNA ESQUERDA: PARÂMETROS */}
                <div className="md:col-span-4 space-y-6">
                    <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-xl flex flex-col relative group">
                        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-16 -mt-16 opacity-5 bg-[#d97757] pointer-events-none"></div>

                        <div className="bg-gray-950/80 backdrop-blur-sm p-5 border-b border-gray-800 flex items-center gap-3 relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-[#d97757] shadow-inner">
                                <DollarSign size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Configuração</p>
                                <h4 className="text-base font-bold text-white">Parâmetros</h4>
                            </div>
                        </div>

                        <div className="p-5 space-y-5 relative z-10">
                            {/* Input: Net Worth */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1 flex justify-between">
                                    <span>Patrimônio Atual</span>
                                    <Info size={12} className="text-gray-600 cursor-help hover:text-[#d97757] transition-colors" title="Soma de todos os seus investimentos hoje." />
                                </label>
                                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3 flex items-center gap-3 focus-within:border-[#d97757] focus-within:ring-1 focus-within:ring-[#d97757]/50 transition-all group/input">
                                    <div className="p-2 bg-gray-950 rounded-lg text-[#d97757] border border-gray-800 group-focus-within/input:border-[#d97757]/30 transition-colors">
                                        <Wallet size={18} />
                                    </div>
                                    <input
                                        type="number"
                                        value={currentNetWorth || ''}
                                        onChange={(e) => handleNumberChange(e.target.value, setCurrentNetWorth)}
                                        className="w-full bg-transparent text-lg font-bold text-white outline-none font-mono placeholder-gray-700"
                                        placeholder="0,00"
                                    />
                                </div>
                            </div>

                            {/* Input: Expenses */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Gasto Mensal Estimado</label>
                                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3 flex items-center gap-3 focus-within:border-[#d97757] focus-within:ring-1 focus-within:ring-[#d97757]/50 transition-all group/input">
                                    <div className="p-2 bg-gray-950 rounded-lg text-amber-500 border border-gray-800 group-focus-within/input:border-amber-500/30 transition-colors">
                                        <Target size={18} />
                                    </div>
                                    <input
                                        type="number"
                                        value={monthlyExpense || ''}
                                        onChange={(e) => handleNumberChange(e.target.value, setMonthlyExpense)}
                                        className="w-full bg-transparent text-lg font-bold text-white outline-none font-mono placeholder-gray-700"
                                        placeholder="0,00"
                                    />
                                </div>
                            </div>

                            {/* Input: Savings */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Aporte Mensal</label>
                                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3 flex items-center gap-3 focus-within:border-[#d97757] focus-within:ring-1 focus-within:ring-[#d97757]/50 transition-all group/input">
                                    <div className="p-2 bg-gray-950 rounded-lg text-emerald-500 border border-gray-800 group-focus-within/input:border-emerald-500/30 transition-colors">
                                        <TrendingUp size={18} />
                                    </div>
                                    <input
                                        type="number"
                                        value={monthlyContribution || ''}
                                        onChange={(e) => handleNumberChange(e.target.value, setMonthlyContribution)}
                                        className="w-full bg-transparent text-lg font-bold text-white outline-none font-mono placeholder-gray-700"
                                        placeholder="0,00"
                                    />
                                </div>
                            </div>

                            {/* Input: Rate */}
                            <div className="space-y-3 pt-2 border-t border-gray-800">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1 flex items-center gap-2">
                                        <Percent size={12} /> Rentabilidade Anual
                                    </label>
                                    <span className="text-xs font-bold text-[#d97757] bg-[#d97757]/10 px-2 py-0.5 rounded border border-[#d97757]/20 font-mono">{annualRate}%</span>
                                </div>

                                <input
                                    type="range"
                                    min={2}
                                    max={15}
                                    step={0.5}
                                    value={annualRate}
                                    onChange={(e) => setAnnualRate(parseFloat(e.target.value))}
                                    className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#d97757]"
                                />
                                <div className="flex justify-between text-[9px] text-gray-600 uppercase font-bold tracking-wider">
                                    <span>Conservador (2%)</span>
                                    <span>Agressivo (15%)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Informações Extras */}
                    <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-4 flex items-start gap-4 hover:bg-gray-900/50 transition-colors">
                        <div className="mt-1 p-2 bg-[#d97757]/10 rounded-lg text-[#d97757] border border-[#d97757]/20">
                            <Sparkles size={16} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Regra dos 4%</p>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                Para cobrir <span className="text-white font-bold"><NumberFlow value={monthlyExpense} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" /></span> mensais sem consumir o principal, sua meta FIRE é acumular <span className="text-[#d97757] font-bold font-mono"><NumberFlow value={fireTarget} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" /></span>.
                            </p>
                        </div>
                    </div>
                </div>

                {/* COLUNA DIREITA: RESULTADOS E GRÁFICO */}
                <div className="md:col-span-8 space-y-6">

                    {/* Cards de Métricas */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {/* Card Meta */}
                        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden group shadow-xl">
                            <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 opacity-5 bg-[#d97757] pointer-events-none transition-opacity group-hover:opacity-10"></div>

                            <div className="flex justify-between items-start mb-4 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-gray-900 border border-gray-800 rounded-xl text-[#d97757] shadow-sm">
                                        <Target size={20} />
                                    </div>
                                    <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Meta FIRE</span>
                                </div>
                            </div>
                            <div className="relative z-10">
                                <p className="text-3xl font-mono font-bold text-white tracking-tight">
                                    <NumberFlow value={fireTarget} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" />
                                </p>
                                <p className="text-xs text-gray-500 mt-1">Patrimônio necessário</p>
                            </div>
                        </div>

                        {/* Card Tempo */}
                        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden group shadow-xl">
                            <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 opacity-5 bg-emerald-500 pointer-events-none transition-opacity group-hover:opacity-10"></div>

                            <div className="flex justify-between items-start mb-4 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-gray-900 border border-gray-800 rounded-xl text-emerald-500 shadow-sm">
                                        <Calendar size={20} />
                                    </div>
                                    <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Liberdade em</span>
                                </div>
                            </div>
                            <div className="relative z-10">
                                <p className="text-3xl font-bold text-white tracking-tight">{projection.reachedAt === null ? '---' : `${years}a ${months}m`}</p>
                                <p className="text-xs text-gray-500 mt-1 font-mono">
                                    {formattedFreedomDate ? `Previsão: ${formattedFreedomDate}` : 'Continue aportando'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Guia de Ajuda */}
                    {showGuide && (
                        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 animate-fade-in shadow-xl">
                            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-800">
                                <HelpCircle size={18} className="text-[#d97757]" />
                                <span className="text-sm font-bold text-white uppercase tracking-wide">Como interpretar os dados</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-[#d97757] uppercase tracking-wider">1. Preencha</p>
                                    <p className="text-xs text-gray-400 leading-relaxed">Insira seu patrimônio atual, quanto você gasta por mês e quanto consegue investir mensalmente na coluna da esquerda.</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-[#d97757] uppercase tracking-wider">2. Analise</p>
                                    <p className="text-xs text-gray-400 leading-relaxed">A linha sólida laranja mostra o crescimento do seu dinheiro. A linha pontilhada cinza é sua Meta FIRE.</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-[#d97757] uppercase tracking-wider">3. Planeje</p>
                                    <p className="text-xs text-gray-400 leading-relaxed">O ponto onde as linhas se cruzam marca a data estimada da sua independência financeira.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Gráfico Principal */}
                    <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-xl flex flex-col h-[450px] relative group">
                        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -mr-20 -mt-20 opacity-5 bg-[#d97757] pointer-events-none transition-opacity group-hover:opacity-10"></div>

                        <div className="bg-gray-950/80 backdrop-blur-sm p-5 border-b border-gray-800 flex items-center justify-between z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-[#d97757] shadow-inner">
                                    <TrendingUp size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Visualização</p>
                                    <h4 className="text-base font-bold text-white">Projeção Patrimonial</h4>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 bg-gray-900/50 px-3 py-1.5 rounded-lg border border-gray-800">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-[#d97757] shadow shadow-[#d97757]/50"></div>
                                    <span className="text-[10px] font-bold text-gray-300 uppercase">Patrimônio</span>
                                </div>
                                <div className="w-px h-3 bg-gray-700"></div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-gray-600"></div>
                                    <span className="text-[10px] font-bold text-gray-500 uppercase">Meta</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 p-5 w-full z-10">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={projection.data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                    <XAxis
                                        dataKey="label"
                                        tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 600 }}
                                        axisLine={false}
                                        tickLine={false}
                                        minTickGap={40}
                                        dy={15}
                                    />
                                    <YAxis
                                        tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 600 }}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={(v) => `R$ ${(v / 1000000).toFixed(1)}M`}
                                        width={50}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#374151', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                    <ReferenceLine y={fireTarget} stroke="#4b5563" strokeDasharray="3 3" />
                                    <Line
                                        type="monotone"
                                        dataKey="patrimony"
                                        stroke="#d97757"
                                        strokeWidth={3}
                                        dot={false}
                                        activeDot={{ r: 6, fill: '#d97757', stroke: '#000', strokeWidth: 3 }}
                                        name="Patrimônio"
                                        animationDuration={1500}
                                    />
                                    <Line
                                        type="linear"
                                        dataKey="target"
                                        stroke="#4b5563"
                                        strokeWidth={2}
                                        strokeDasharray="6 6"
                                        dot={false}
                                        name="Meta"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};