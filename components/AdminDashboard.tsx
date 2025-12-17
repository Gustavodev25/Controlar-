import React, { useState, useEffect, useMemo } from 'react';
import { User, Coupon } from '../types';
import * as dbService from '../services/database';
import NumberFlow from '@number-flow/react';
import { SparkLineChart } from '@mui/x-charts/SparkLineChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { axisClasses } from '@mui/x-charts/ChartsAxis';
import {
  Users,
  CreditCard,
  TrendingUp,
  Activity,
  DollarSign,
  Crown,
  MapPin
} from 'lucide-react';

interface AdminDashboardProps {
  user: User;
}

// Extended User for logic
interface SystemUser extends User {
  id: string;
}

const COLORS = ['#d97757', '#34D399', '#60A5FA', '#F87171', '#8B5CF6', '#F59E0B'];

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
}) => (
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

    {/* Mini Chart (MUI X Sparkline) */}
    <div className="w-[40%] h-[80%] flex items-end justify-end absolute bottom-2 right-2 opacity-80 group-hover:opacity-100 transition-opacity">
      <SparkLineChart
        data={trendData}
        height={80}
        width={120}
        colors={[color]}
        area
        showHighlight
        showTooltip
        sx={{
          '& .MuiAreaElement-root': {
            fillOpacity: 0.2,
          }
        }}
      />
    </div>
  </div>
);

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
        price = isAnnual ? (399.00 / 12) : 34.90;
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
    const canceledUsers = users.filter(u => u.subscription?.status === 'canceled').length;
    const churnRate = totalSubscribedUsers > 0 ? (canceledUsers / totalSubscribedUsers) * 100 : 0;

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
      { id: 0, label: 'Starter', value: planCounts.starter, color: COLORS[0] },
      { id: 1, label: 'Pro', value: planCounts.pro, color: COLORS[1] },
      { id: 2, label: 'Family', value: planCounts.family, color: COLORS[2] },
    ].filter(d => d.value > 0);

    return {
      mrr: totalMRR,
      revenue: totalRevenueEst,
      activeUsers,
      totalFree,
      arpu,
      churnRate,
      pendingRevenue,
      newUsers,
      chartData,
      planData,
      locationsChartData,
      trends: {
        users: userGrowthData,
        mrr: mrrTrendData,
        usersValues: usersTrendValues,
        generic: randomTrend()
      }
    };
  }, [users, coupons]);

  const maxUserGrowth = Math.max(...(stats.trends.users.map(d => d.value) || [0]));

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
          title="Assinantes Premium"
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
          title="Churn Rate"
          value={stats.churnRate}
          suffix="%"
          trendData={stats.trends.generic}
          color="#EF4444"
          trendPercent={-2.1}
          footer="Abaixo da média do mercado"
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

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 1. Bar Chart (User Growth) */}
        <div className="lg:col-span-2 bg-[#30302E] border border-[#373734] rounded-2xl p-6 relative">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users size={20} className="text-[#8B5CF6]" />
                Crescimento de Usuários
              </h3>
              <p className="text-sm text-gray-400">Novos usuários ativos nos últimos 6 meses</p>
            </div>
          </div>

          <div className="h-[300px] w-full mt-4">
            <BarChart
              dataset={stats.trends.users}
              xAxis={[{
                scaleType: 'band',
                dataKey: 'name',
                tickLabelStyle: { fill: '#9CA3AF' }
              }]}
              yAxis={[{
                tickLabelStyle: { fill: '#9CA3AF' }
              }]}
              series={[{
                dataKey: 'value',
                color: '#8B5CF6',
                label: 'Usuários',
                valueFormatter: (v) => `${v}`,
              }]}
              height={300}
              grid={{ horizontal: true }}
              tooltip={{ trigger: 'item' }}
              sx={{
                [`& .${axisClasses.left} .${axisClasses.label}`]: { stroke: '#fff' },
                [`& .${axisClasses.bottom} .${axisClasses.tickLabel}`]: { fill: '#9CA3AF' },
                // Hide generic legend if unnecessary or style it
                '& .MuiChartsLegend-root text': { fill: '#fff !important' }
              }}
              margin={{ top: 10, bottom: 30, left: 40, right: 10 }}
            />
          </div>
        </div>

        {/* 2. Donut Chart (Plans) */}
        <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6">Distribuição de Planos</h3>
          <div className="h-[250px] w-full flex items-center justify-center relative">
            {stats.planData.length > 0 ? (
              <PieChart
                series={[
                  {
                    data: stats.planData,
                    innerRadius: 70,
                    outerRadius: 90,
                    paddingAngle: 5,
                    cornerRadius: 5,
                    cx: 140, // adjust center X manually if container is small, or rely on auto
                    highlightScope: { faded: 'global', highlighted: 'item' },
                    faded: { innerRadius: 30, additionalRadius: -30, color: 'gray' },
                  },
                ]}
                height={250}
                slotProps={{
                  legend: {
                    direction: 'row',
                    position: { vertical: 'bottom', horizontal: 'middle' },
                    padding: 0,
                    labelStyle: { fill: '#fff' }
                  }
                }}
                tooltip={{ trigger: 'item' }}
              />
            ) : (
              <div className="text-gray-500 text-sm">Sem dados de planos</div>
            )}

            {stats.planData.length > 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8" style={{ left: '-10px', top: '-20px' }}>
                <div className="text-center">
                  <span className="text-3xl font-bold text-white block">
                    {stats.activeUsers + stats.totalFree}
                  </span>
                  <span className="text-xs text-gray-400 uppercase tracking-wider">Total</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. Horizontal Bar (Heatmap style) for Locations */}
        <div className="lg:col-span-1 bg-[#30302E] border border-[#373734] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <MapPin size={20} className="text-[#F59E0B]" />
              Top Localizações
            </h3>
          </div>

          <div className="h-[300px] w-full">
            {stats.locationsChartData.length > 0 ? (
              <BarChart
                layout="horizontal" // Switch to horizontal layout
                dataset={stats.locationsChartData}
                yAxis={[{
                  scaleType: 'band',
                  dataKey: 'name',
                  tickLabelStyle: { fill: '#fff', fontWeight: 'bold' }
                }]}
                xAxis={[{
                  hideTooltip: true,
                }]}
                series={[{
                  dataKey: 'value',
                  color: '#F59E0B',
                  label: 'Usuários'
                }]}
                height={300}
                margin={{ left: 50 }}
                tooltip={{ trigger: 'item' }}
                sx={{
                  '& .MuiChartsLegend-root text': { fill: '#fff !important' }
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-500 text-sm">
                Sem dados de localização
              </div>
            )}
          </div>
        </div>

        {/* 4. Revenue Estimated (Line/Area) */}
        <div className="lg:col-span-2 bg-[#30302E] border border-[#373734] rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <DollarSign size={20} className="text-[#10B981]" />
            Faturamento Estimado (12 Meses)
          </h3>
          <div className="h-[300px] w-full">
            <LineChart
              dataset={stats.chartData}
              xAxis={[{
                scaleType: 'point',
                dataKey: 'name',
                tickLabelStyle: { fill: '#9CA3AF' }
              }]}
              yAxis={[{
                valueFormatter: (v) => `R$${v}`,
                tickLabelStyle: { fill: '#9CA3AF' }
              }]}
              series={[{
                dataKey: 'value',
                area: true,
                color: '#10B981',
                showMark: false,
                label: 'Receita Estimada'
              }]}
              height={300}
              grid={{ horizontal: true }}
              sx={{
                '& .MuiChartsLegend-root text': { fill: '#fff !important' }
              }}
              tooltip={{ trigger: 'axis' }}
            />
          </div>
        </div>

      </div>
    </div>
  );
};
