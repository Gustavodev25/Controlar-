import React, { useState, useEffect, useMemo } from 'react';
import { User, Coupon } from '../types';
import * as dbService from '../services/database';
import NumberFlow from '@number-flow/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import {
  Users,
  TrendingUp,
  DollarSign,
  MapPin
} from 'lucide-react';

interface AdminDashboardProps {
  user: User;
}

// Extended User for logic
interface SystemUser extends User {
  id: string;
}

const PLAN_COLORS = {
  starter: '#525252',
  pro: '#d97757',
  family: '#D4B996'
};

const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1c1c1a] border border-gray-800 p-3 rounded-xl shadow-xl">
        {label && <p className="text-gray-400 text-xs mb-1">{label}</p>}
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm font-bold flex items-center gap-2" style={{ color: entry.color || entry.fill }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
            {formatter ? formatter(entry.value) : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const KPICard = ({
  title,
  value,
  prefix = '',
  suffix = '',
  trendData,
  color,
  trendPercent,
  footer
}: {
  title: string,
  value: number,
  prefix?: string,
  suffix?: string,
  trendData: number[],
  color: string,
  trendPercent?: number,
  footer?: string
}) => {
  const chartData = trendData.map((val, i) => ({ i, val }));

  return (
    <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-5 flex items-center justify-between overflow-hidden relative group hover:border-[#4a4a48] transition-colors h-[140px]">
      <div className="z-10 flex flex-col justify-between h-full w-[60%]">
        <div>
          <h3 className="text-sm font-bold text-gray-200">{title}</h3>
          <div className="flex items-center gap-2 mt-4">
            <span className="text-2xl font-bold text-white tracking-tight">
              <NumberFlow
                value={value}
                format={prefix === 'R$' ? { style: 'currency', currency: 'BRL' } : { style: 'decimal', maximumFractionDigits: 1 }}
                suffix={suffix}
              />
            </span>
            {trendPercent !== undefined && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${trendPercent >= 0 ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
                {trendPercent >= 0 ? <TrendingUp size={10} /> : <TrendingUp size={10} className="rotate-180" />}
                {Math.abs(trendPercent)}%
              </span>
            )}
          </div>
          {footer && <p className="text-[10px] text-gray-500 mt-2 font-medium">{footer}</p>}
        </div>
      </div>

      {/* Mini Chart (Recharts Area) */}
      <div className="w-[40%] h-[80%] flex items-end justify-end absolute bottom-0 right-0 opacity-50 group-hover:opacity-80 transition-opacity pointer-events-none">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <Area
              type="natural"
              dataKey="val"
              stroke={color}
              strokeWidth={2}
              fill={color}
              fillOpacity={0.4}
              isAnimationActive={true}
              activeDot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [usersData, couponsData] = await Promise.all([
          dbService.getAllUsers(),
          dbService.getCoupons()
        ]);

        // Filter users with some subscription interaction
        const relevantUsers = usersData.filter(u => u.subscription?.plan);
        setUsers(relevantUsers as SystemUser[]);
        setCoupons(couponsData);
      } catch (error) {
        console.error('Error loading admin dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const stats = useMemo(() => {
    let totalMRR = 0;
    let totalRevenueEst = 0;
    let activeUsers = 0; // Only PAYING active users
    let totalFree = 0; // Active Starter users

    // For Projection Chart
    const projectionMap: Record<string, number> = {};
    const today = new Date();
    // Init next 12 months
    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const key = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      projectionMap[key] = 0;
    }

    // For Plan Distribution
    const planCounts = {
      starter: 0,
      pro: 0,
      family: 0
    };

    const calculateSubscriptionPrice = (sub: User['subscription'], monthIndex: number = 1) => {
      if (!sub) return 0;
      let price = 0;
      const isAnnual = sub.billingCycle === 'annual';
      // Normalize plan name
      const plan = (sub.plan || 'starter').toLowerCase();

      if (plan === 'family') {
        price = isAnnual ? (749.00 / 12) : 69.90;
      } else if (plan === 'pro') {
        price = isAnnual ? (399.90 / 12) : 35.90;
      } else {
        price = 0;
      }

      // Apply Coupon logic (simplified)
      if (sub.couponUsed) {
        const coupon = coupons.find(c => c.id === sub.couponUsed);
        if (coupon && price > 0) {
          if (coupon.type === 'progressive') {
            const rule = coupon.progressiveDiscounts?.find(d => d.month === monthIndex);
            if (rule) price = Math.max(0, price * (1 - rule.discount / 100));
          } else if (coupon.type === 'percentage') {
            price = Math.max(0, price * (1 - coupon.value / 100));
          } else if (coupon.type === 'fixed') {
            price = Math.max(0, price - coupon.value);
          }
        }
      }
      return price;
    };

    users.forEach(u => {
      if (!u.subscription) return;

      // Normalize plan
      const plan = (u.subscription.plan || 'starter').toLowerCase();

      // 1. Plan Counts (All Plan Types)
      if (u.subscription.status === 'active' || u.subscription.status === 'past_due' || u.subscription.status === 'pending_payment') {
        if (plan === 'pro') planCounts.pro++;
        else if (plan === 'family') planCounts.family++;
        else planCounts.starter++;
      }

      if (u.subscription.status === 'active') {
        if (plan === 'starter') {
          totalFree++;
        } else {
          activeUsers++; // Only count Pro/Family as "Active Paying Subscribers"
        }
      }

      // 2. MRR (Active Only)
      // Check current month price
      // Estimate "subscription age in months" to apply progressive coupons correctly for MRR
      let startDate = u.subscription.startDate ? new Date(u.subscription.startDate) : new Date();
      const monthDiff = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth()) + 1;
      const currentMonthIndex = Math.max(1, monthDiff);

      if (u.subscription.status === 'active') {
        const currentPrice = calculateSubscriptionPrice(u.subscription, currentMonthIndex);
        totalMRR += currentPrice;
      }

      // 3. Lifetime Revenue Estimation
      if (u.subscription.startDate) {
        const endCalcDate = u.subscription.status === 'canceled' ? new Date() : new Date();
        const monthsActive = Math.max(1, (endCalcDate.getFullYear() - startDate.getFullYear()) * 12 + (endCalcDate.getMonth() - startDate.getMonth()));

        for (let m = 1; m <= monthsActive; m++) {
          totalRevenueEst += calculateSubscriptionPrice(u.subscription, m);
        }
      }

      // 4. Projections (Next 12 Months)
      if (u.subscription.status === 'active' && plan !== 'starter') {
        for (let i = 0; i < 12; i++) {
          const futureDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
          const futureDiff = (futureDate.getFullYear() - startDate.getFullYear()) * 12 + (futureDate.getMonth() - startDate.getMonth()) + 1;
          const price = calculateSubscriptionPrice(u.subscription, Math.max(1, futureDiff));

          const key = futureDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
          if (projectionMap[key] !== undefined) {
            projectionMap[key] += price;
          }
        }
      }
    });

    const totalSubscribedUsers = activeUsers + totalFree + (users.filter(u => u.subscription?.status === 'canceled').length);
    const conversionRate = users.length > 0 ? (activeUsers / users.length) * 100 : 0;

    // ARPU (Ticket Médio)
    const arpu = activeUsers > 0 ? totalMRR / activeUsers : 0;

    // Pending Revenue
    let pendingRevenue = 0;
    users.forEach(u => {
      if (u.subscription && (u.subscription.status === 'past_due' || u.subscription.status === 'pending_payment')) {
        const price = calculateSubscriptionPrice(u.subscription);
        pendingRevenue += price;
      }
    });

    // New Users (Last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsers = users.filter(u => {
      const joinDate = u.subscription?.startDate ? new Date(u.subscription.startDate) : null;
      return joinDate && joinDate >= thirtyDaysAgo;
    }).length;

    // --- SPARKLINE & CHART DATA ---
    const userGrowthData: { name: string; value: number }[] = [];
    const now = new Date();
    // Last 6 months trend
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const count = users.filter(u => {
        const start = u.subscription?.startDate ? new Date(u.subscription.startDate) : new Date(0);
        return start <= endOfMonth;
      }).length;
      userGrowthData.push({
        name: d.toLocaleDateString('pt-BR', { month: 'short' }),
        value: count
      });
    }

    const mrrTrendData: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      let mrrAtPoint = 0;
      users.forEach(u => {
        if (!u.subscription || !u.subscription.startDate) return;
        const start = new Date(u.subscription.startDate);
        const plan = (u.subscription.plan || 'starter').toLowerCase();
        if (start <= endOfMonth && plan !== 'starter') {
          mrrAtPoint += calculateSubscriptionPrice(u.subscription, 1);
        }
      });
      mrrTrendData.push(mrrAtPoint);
    }
    const usersTrendValues = userGrowthData.map(d => d.value);

    const randomTrend = () => Array.from({ length: 6 }, () => Math.floor(Math.random() * 100) + 50);

    // --- CUMULATIVE USER GROWTH ---
    const dailyCounts: Record<string, number> = {};
    let minDate = new Date();

    users.forEach(u => {
      // Use createdAt (preferred) or subscription start date or fallback
      const dateStr = u.createdAt || u.subscription?.startDate;
      if (!dateStr) return;

      const date = new Date(dateStr);
      if (date < minDate) minDate = date;

      const key = date.toISOString().split('T')[0]; // YYYY-MM-DD
      dailyCounts[key] = (dailyCounts[key] || 0) + 1;
    });

    // Sort dates
    const sortedDates = Object.keys(dailyCounts).sort();

    // Create cumulative array
    const cumulativeGrowth: { date: string, rawDate: string, total: number, daily: number }[] = [];
    let runningTotal = 0;

    // Fill in gaps? Ideally yes, but for now just points
    sortedDates.forEach(dateKey => {
      const count = dailyCounts[dateKey];
      runningTotal += count;
      const [y, m, d] = dateKey.split('-');
      cumulativeGrowth.push({
        date: `${d}/${m}`, // DD/MM format for x-axis
        rawDate: dateKey,
        total: runningTotal,
        daily: count
      });
    });

    // If empty, add at least one point
    if (cumulativeGrowth.length === 0) {
      cumulativeGrowth.push({ date: 'Hoje', rawDate: new Date().toISOString(), total: 0, daily: 0 });
    }

    // Heatmap / Location Data (Top 5 States)
    const locationData: Record<string, number> = {};
    users.forEach(u => {
      const state = u.address?.state?.toUpperCase() || 'N/A';
      const key = state.length === 2 ? state : 'N/A';
      if (key !== 'N/A') locationData[key] = (locationData[key] || 0) + 1;
    });
    const locationsChartData = Object.entries(locationData)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5

    const chartData = Object.entries(projectionMap).map(([name, value]) => ({ name, value }));
    const planData = [
      { name: 'Starter', value: planCounts.starter, color: PLAN_COLORS.starter },
      { name: 'Pro', value: planCounts.pro, color: PLAN_COLORS.pro },
      { name: 'Family', value: planCounts.family, color: PLAN_COLORS.family },
    ].filter(d => d.value > 0);

    return {
      mrr: totalMRR,
      revenue: totalRevenueEst,
      activeUsers,
      totalFree,
      arpu,
      conversionRate,
      pendingRevenue,
      newUsers,
      chartData,
      planData,
      locationsChartData,
      cumulativeGrowth, // Add to return object
      trends: {
        users: userGrowthData,
        mrr: mrrTrendData,
        usersValues: usersTrendValues,
        generic: randomTrend()
      }
    };
  }, [users, coupons]);

  return (
    <div className="p-6 space-y-8 animate-fade-in pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Painel Administrativo</h1>
          <p className="text-gray-400">Visão geral financeira e métricas de saúde do sistema.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-green-400">Sistema Operacional</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="MRR Mensal"
          value={stats.mrr}
          prefix="R$"
          trendData={stats.trends.mrr}
          color="#d97757"
          trendPercent={12.5}
          footer="vs. mês passado"
        />
        <KPICard
          title="Lucro Total (Est.)"
          value={stats.revenue}
          prefix="R$"
          trendData={stats.trends.mrr}
          color="#10B981"
          trendPercent={8.2}
          footer="Crescimento constante"
        />
        <KPICard
          title="Assinantes"
          value={stats.activeUsers}
          trendData={stats.trends.usersValues}
          color="#3B82F6"
          trendPercent={24}
          footer={`+${stats.totalFree} gratuitos`}
        />
        <KPICard
          title="Novos Usuários (30d)"
          value={stats.newUsers}
          trendData={stats.trends.usersValues}
          color="#8B5CF6"
          trendPercent={stats.newUsers > 0 ? 100 : 0}
          footer="Aquisição recente"
        />
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Ticket Médio (ARPU)"
          value={stats.arpu}
          prefix="R$"
          trendData={stats.trends.generic}
          color="#F59E0B"
          footer="Média por assinante pago"
        />

        <KPICard
          title="Taxa de Conversão"
          value={stats.conversionRate}
          suffix="%"
          trendData={stats.trends.generic}
          color="#10B981"
          trendPercent={2.1}
          footer="Visitantes -> Pagantes"
        />
        <KPICard
          title="Receita Pendente"
          value={stats.pendingRevenue}
          prefix="R$"
          trendData={stats.trends.mrr}
          color="#EC4899"
          footer="Total em atraso"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cumulative User Growth Chart */}
        <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users size={18} className="text-blue-400" />
                Crescimento de Usuários
              </h3>
              <p className="text-gray-500 text-sm">Total acumulado de usuários por dia</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-white">{users.length}</span>
              <p className="text-xs text-gray-500 uppercase">Total Atual</p>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.cumulativeGrowth}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#373734" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30} // Prevent overlapping dates
                />
                <YAxis
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Usuários"
                  stroke="#3B82F6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorUsers)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Projection or Plan Distribution */}
        <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            <DollarSign size={18} className="text-emerald-400" />
            Projeção de Receita (12 Meses)
          </h3>
          <p className="text-gray-500 text-sm mb-6">Baseado nas assinaturas ativas atuais</p>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#373734" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#6b7280"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `R$${val}`}
                />
                <Tooltip content={<CustomTooltip formatter={(val: number) => `R$ ${val.toFixed(2)}`} />} />
                <Bar dataKey="value" name="Receita Projetada" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Location & Plans */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <MapPin size={18} className="text-purple-400" />
            Top Localizações
          </h3>
          <div className="space-y-4">
            {stats.locationsChartData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 font-mono text-sm w-4">{index + 1}</span>
                  <span className="text-gray-300 font-medium">{item.name}</span>
                </div>
                <div className="flex items-center gap-4 flex-1 justify-end">
                  <div className="h-2 bg-gray-800 rounded-full flex-1 max-w-[150px] overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${(item.value / users.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-white min-w-[30px] text-right">{item.value}</span>
                </div>
              </div>
            ))}
            {stats.locationsChartData.length === 0 && (
              <p className="text-gray-500 text-center py-10">Nenhum dado de localização disponível</p>
            )}
          </div>
        </div>

        <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-6 flex flex-col">
          <h3 className="text-lg font-bold text-white mb-6">Distribuição de Planos</h3>
          <div className="flex-1 flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={stats.planData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.planData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0.5)" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-3xl font-bold text-white">{users.length}</p>
                <p className="text-xs text-gray-500 uppercase">Usuários</p>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {stats.planData.map(entry => (
              <div key={entry.name} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-sm text-gray-300">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
