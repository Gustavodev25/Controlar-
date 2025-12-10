import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Transaction } from '../types';
import { getCategoryIcon } from './Icons';

interface ChartsProps {
  transactions: Transaction[];
  isLoading?: boolean;
}

// Updated Palette: Primarily Orange/Terracotta shades, then complementary neutral/warm tones
const COLORS = ['#d97757', '#e68e70', '#c56a4d', '#b55a3d', '#767775', '#4a4b49'];

export const DashboardCharts: React.FC<ChartsProps> = ({ transactions, isLoading = false }) => {
  // Process data for Category Pie Chart
  const categoryData = React.useMemo(() => {
    // Robust check: explicit 'expense' type OR negative amount
    const expenses = transactions.filter(t => t.type === 'expense' || t.amount < 0);
    const grouped = expenses.reduce((acc, curr) => {
      // Always use absolute amount for visualization
      const val = Math.abs(curr.amount);
      acc[curr.category] = (acc[curr.category] || 0) + val;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => (b.value as number) - (a.value as number))
      .slice(0, 6); // Top 6 categories
  }, [transactions]);

  // Process data for Monthly Bar Chart (Comparison: Income vs Expenses)
  const monthlyData = React.useMemo(() => {
    // In a real app, this would be grouped by month, but here we do Total Aggregate as per request
    let income = 0;
    let expense = 0;
    
    transactions.forEach(t => {
      // Income: explicit type 'income' AND positive amount (excludes refunds labeled as income but negative?)
      // Actually simpler: Income is positive, Expense is negative or explicit expense.
      
      if (t.type === 'income' && t.amount > 0) {
        income += t.amount;
      } else if (t.type === 'expense' || t.amount < 0) {
        expense += Math.abs(t.amount);
      }
    });
    
    return [
      { name: 'Receitas', value: income, fill: '#10b981' }, // Keep green for income logic
      { name: 'Despesas', value: expense, fill: '#ef4444' }, // Keep red for expense logic
    ];
  }, [transactions]);

  // Custom Legend for Pie Chart to include Icons
  const CustomLegend = ({ payload }: any) => {
    return (
      <ul className="space-y-2">
        {payload.map((entry: any, index: number) => (
          <li key={`item-${index}`} className="flex items-center gap-2 text-xs text-gray-300">
            <div className="flex items-center justify-center w-5 h-5 rounded bg-gray-800 text-gray-400">
              {getCategoryIcon(entry.payload.name, 12)}
            </div>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
            <span className="flex-1 text-gray-200">{entry.value}</span>
          </li>
        ))}
      </ul>
    );
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 animate-pulse">
        <div className="bg-[#30302E] p-4 lg:p-6 rounded-xl shadow-sm border border-gray-800 h-72 lg:h-80 flex flex-col gap-4">
           <div className="h-4 lg:h-5 w-32 lg:w-40 bg-gray-800 rounded"></div>
           <div className="flex-1 bg-gray-800/50 rounded-full w-40 h-40 lg:w-48 lg:h-48 mx-auto"></div>
        </div>
        <div className="bg-[#30302E] p-4 lg:p-6 rounded-xl shadow-sm border border-gray-800 h-72 lg:h-80 flex flex-col gap-4">
           <div className="h-4 lg:h-5 w-40 lg:w-52 bg-gray-800 rounded"></div>
           <div className="flex-1 flex items-end gap-4 px-4 lg:px-8">
             <div className="w-1/2 h-1/2 bg-gray-800 rounded-t"></div>
             <div className="w-1/2 h-3/4 bg-gray-800 rounded-t"></div>
           </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 animate-fade-in">
      {/* Pie Chart - Categories */}
      <div className="bg-[#30302E] p-4 lg:p-6 rounded-xl shadow-sm border border-gray-800 h-72 lg:h-80 flex flex-col">
        <h3 className="text-xs lg:text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 lg:mb-4">Despesas por Categoria</h3>
        <div className="flex-1 min-h-0 flex items-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={75}
                fill="#d97757"
                paddingAngle={4}
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="#262624" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)} 
                contentStyle={{ backgroundColor: '#1a1a19', borderColor: '#4a4b49', color: '#faf9f5', borderRadius: '8px', fontSize: '12px' }}
                itemStyle={{ color: '#faf9f5' }}
              />
              <Legend 
                content={<CustomLegend />}
                layout="vertical" 
                verticalAlign="middle" 
                align="right"
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bar Chart - Income vs Expense */}
      <div className="bg-[#30302E] p-4 lg:p-6 rounded-xl shadow-sm border border-gray-800 h-72 lg:h-80 flex flex-col">
        <h3 className="text-xs lg:text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 lg:mb-4">Comparativo: Receitas vs Despesas</h3>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={monthlyData}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#4a4b49" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#9a9b99', fontSize: 12}} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tickFormatter={(v) => `R$${v/1000}k`} 
                tick={{fill: '#9a9b99', fontSize: 11}} 
              />
              <Tooltip 
                cursor={{ fill: '#4a4b49' }}
                formatter={(value: number) => [new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value), 'Total']}
                contentStyle={{ backgroundColor: '#1a1a19', borderColor: '#4a4b49', color: '#faf9f5', borderRadius: '8px', fontSize: '12px' }}
                itemStyle={{ color: '#faf9f5' }}
              />
              <Bar 
                dataKey="value" 
                radius={[6, 6, 0, 0]} 
                barSize={50}
                animationDuration={1500}
              >
                 {monthlyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                 ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};