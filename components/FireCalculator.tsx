import React, { useEffect, useMemo, useState } from 'react';
import { Flame, TrendingUp, Target, Calendar } from 'lucide-react';
import { Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

interface FireCalculatorProps {
  netWorth: number;
  averageMonthlyExpense: number;
  averageMonthlySavings: number;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export const FireCalculator: React.FC<FireCalculatorProps> = ({
  netWorth,
  averageMonthlyExpense,
  averageMonthlySavings
}) => {
  const [currentNetWorth, setCurrentNetWorth] = useState(Math.max(netWorth, 0));
  const [monthlyContribution, setMonthlyContribution] = useState(Math.max(averageMonthlySavings, 0));
  const [monthlyExpense, setMonthlyExpense] = useState(Math.max(averageMonthlyExpense, 0));
  const [annualRate, setAnnualRate] = useState(8); // faixa sugerida 6% - 10%

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
        break; // mostra 12 meses depois da meta
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
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 shadow-lg">
        <p className="text-xs text-gray-400 mb-1">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.name} className="text-sm text-gray-200">
            {entry.name}: <span className="font-semibold">{formatCurrency(entry.value)}</span>
          </p>
        ))}
      </div>
    );
  };

  const handleNumberChange = (value: string, setter: (val: number) => void) => {
    const parsed = parseFloat(value.replace(',', '.'));
    setter(isNaN(parsed) ? 0 : Math.max(parsed, 0));
  };

  const goalDescription = projection.reachedAt === null
    ? 'Ajuste aporte, gasto ou taxa para alcançar a liberdade.'
    : `Em ${years} ano(s) e ${months} mês(es)${formattedFreedomDate ? ` (${formattedFreedomDate})` : ''}`;

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-2xl p-5 shadow-lg shadow-[#d97757]/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#d97757] flex items-center gap-1">
              <Flame size={14} /> Independência Financeira
            </p>
            <h3 className="text-2xl font-bold text-white">Calculadora FIRE</h3>
            <p className="text-sm text-gray-400">Baseada no gasto médio, aporte e regra dos 4%.</p>
          </div>
          <div className="px-3 py-2 bg-[#d97757]/15 text-[#d97757] border border-[#d97757]/30 rounded-lg text-xs font-bold">
            Meta = Gasto Mensal x 300
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider">Meta FIRE</p>
            <p className="text-lg font-bold text-white">{formatCurrency(fireTarget)}</p>
          </div>
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider flex items-center gap-1"><Target size={12} /> Tempo estimado</p>
            <p className="text-lg font-bold text-white">{projection.reachedAt === null ? '---' : `${years}a ${months}m`}</p>
            {formattedFreedomDate && <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Calendar size={12} />{formattedFreedomDate}</p>}
          </div>
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider flex items-center gap-1"><TrendingUp size={12} /> Patrimônio atual</p>
            <p className="text-lg font-bold text-white">{formatCurrency(currentNetWorth)}</p>
          </div>
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider">Juros compostos</p>
            <p className="text-lg font-bold text-white">{annualRate.toFixed(1)}% a.a.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-400 flex justify-between">
                Patrimônio Atual
                <span className="text-[10px] text-gray-500">puxado das caixinhas</span>
              </label>
              <input
                type="number"
                min={0}
                value={currentNetWorth}
                onChange={(e) => handleNumberChange(e.target.value, setCurrentNetWorth)}
                className="w-full mt-1 p-3 bg-gray-900 border border-gray-800 rounded-xl text-white focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 flex justify-between">
                Gasto Mensal Médio
                <span className="text-[10px] text-gray-500">baseado nas despesas</span>
              </label>
              <input
                type="number"
                min={0}
                value={monthlyExpense}
                onChange={(e) => handleNumberChange(e.target.value, setMonthlyExpense)}
                className="w-full mt-1 p-3 bg-gray-900 border border-gray-800 rounded-xl text-white focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 flex justify-between">
                Aporte Mensal
                <span className="text-[10px] text-gray-500">média do monthlySavings</span>
              </label>
              <input
                type="number"
                min={0}
                value={monthlyContribution}
                onChange={(e) => handleNumberChange(e.target.value, setMonthlyContribution)}
                className="w-full mt-1 p-3 bg-gray-900 border border-gray-800 rounded-xl text-white focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 flex justify-between">
                Taxa de Juros Anual
                <span className="text-[10px] text-gray-500">6% - 10% sugerido</span>
              </label>
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="range"
                  min={2}
                  max={15}
                  step={0.5}
                  value={annualRate}
                  onChange={(e) => setAnnualRate(parseFloat(e.target.value))}
                  className="flex-1 accent-[#d97757]"
                />
                <input
                  type="number"
                  min={0}
                  max={30}
                  step={0.5}
                  value={annualRate}
                  onChange={(e) => setAnnualRate(parseFloat(e.target.value) || 0)}
                  className="w-20 p-2 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm"
                />
                <span className="text-sm text-gray-400">%</span>
              </div>
            </div>

            <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-3 text-sm text-gray-300">
              <p className="font-semibold text-white mb-1">Regra dos 4%</p>
              <p className="text-gray-400 leading-relaxed">
                {`Precisamos de ${formatCurrency(fireTarget)} para gerar ${formatCurrency(monthlyExpense * 12 * 0.04)} anuais (~4%) e cobrir seu custo médio.`}
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 bg-gray-900/60 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[11px] text-gray-500 uppercase tracking-wider">Projeção com juros compostos</p>
                <p className="text-sm text-white font-semibold">{goalDescription}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-[#d97757] rounded-full"></span> Patrimônio</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-500 rounded-full"></span> Meta FIRE</span>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projection.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                  <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={fireTarget} stroke="#6b7280" strokeDasharray="4 4" label={{ value: 'Meta FIRE', fill: '#9ca3af', position: 'insideTopRight', fontSize: 11 }} />
                  <Line type="monotone" dataKey="patrimony" stroke="#d97757" strokeWidth={3} dot={false} name="Patrimônio" />
                  <Line type="linear" dataKey="target" stroke="#6b7280" strokeWidth={2} dot={false} name="Meta" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
