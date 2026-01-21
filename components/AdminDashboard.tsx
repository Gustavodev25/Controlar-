import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Coupon } from '../types';
import * as dbService from '../services/database';
import NumberFlow from '@number-flow/react';
import { motion, AnimatePresence } from 'framer-motion';
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
  MapPin,
  Filter,
  ChevronDown,
  Check,
  X,
  Calendar,
  ShieldAlert,
  Info,
  Clock
} from 'lucide-react';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator } from './Dropdown';
import { CustomDatePicker } from './UIComponents';
import { toLocalISODate } from '../utils/dateUtils';

import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';

const geoUrl = "https://raw.githubusercontent.com/codeforgermany/click_that_hood/master/public/data/brazil-states.geojson";


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
            {formatter ? formatter(entry.value, entry.name, entry) : entry.value}
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
  trendData?: number[],
  color: string,
  trendPercent?: number,
  footer?: string
}) => {
  const chartData = trendData ? trendData.map((val, i) => ({ i, val })) : [];

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
      {trendData && trendData.length > 0 && (
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
      )}
    </div>
  );
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'pro' | 'starter'>('all');
  const [filterFinance, setFilterFinance] = useState<'all' | 'monthly' | 'annual' | 'past_due' | 'refunded'>('all');
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    // Default: First day of current month
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return firstDay.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    // Default: Last day of current month
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return lastDay.toISOString().split('T')[0];
  });
  const [excludeAdmins, setExcludeAdmins] = useState(() => {
    const saved = localStorage.getItem('admin_dashboard_exclude_admins');
    return saved ? JSON.parse(saved) : false;
  });
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const dateFilterRef = useRef<HTMLDivElement>(null);
  const [tooltipContent, setTooltipContent] = useState("");

  // Asaas Stats from API
  const [asaasStats, setAsaasStats] = useState<{
    subscriptions: { active: number; monthly: number; yearly: number };
    revenue: { mrrGross: number; mrrNet: number; totalGross: number; totalNet: number; pending: number };
    paymentsCount: number;
    fetchedAt: string;
  } | null>(null);
  const [isLoadingAsaas, setIsLoadingAsaas] = useState(true);


  useEffect(() => {
    localStorage.setItem('admin_dashboard_exclude_admins', JSON.stringify(excludeAdmins));
  }, [excludeAdmins]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dateFilterRef.current && !dateFilterRef.current.contains(event.target as Node)) {
        // Check if click is inside a DatePicker portal (calendar popup)
        const target = event.target as HTMLElement;
        if (target.closest('[data-datepicker-portal]')) return;

        setIsDateFilterOpen(false);
      }
    };

    if (isDateFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDateFilterOpen]);



  useEffect(() => {
    const loadData = async () => {
      try {
        const [usersData, couponsData] = await Promise.all([
          dbService.getAllUsers(),
          dbService.getCoupons()
        ]);

        // Load all users initially
        setUsers(usersData as SystemUser[]);
        setCoupons(couponsData);
      } catch (error) {
        console.error('Error loading admin dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Fetch Asaas stats from API
  useEffect(() => {
    const fetchAsaasStats = async () => {
      try {
        setIsLoadingAsaas(true);
        const response = await fetch('/api/asaas/admin/stats');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setAsaasStats(data);
          }
        }
      } catch (error) {
        console.error('Error fetching Asaas stats:', error);
      } finally {
        setIsLoadingAsaas(false);
      }
    };
    fetchAsaasStats();
  }, []);

  const stats = useMemo(() => {
    let totalMRR = 0;
    let totalMRRNet = 0; // MRR after Asaas fees
    let totalRevenueEst = 0;
    let totalRevenueEstNet = 0; // Revenue after Asaas fees
    let activeUsers = 0; // Only PAYING active users
    let totalFree = 0; // Active Starter users
    let totalActiveDays = 0;
    let usersWithActiveDaysCount = 0;
    let onlineUsers = 0;

    // Asaas Fee Constants
    const ASAAS_CARD_FEE_PERCENT = 2.99; // Credit card processing fee (à vista)
    const ASAAS_ANTICIPATION_FEE_PERCENT = 1.15; // Anticipation fee per month
    const ASAAS_ANTICIPATION_MIN_VALUE = 5.00; // Minimum value for anticipation

    // Helper to calculate net value after Asaas fees
    const calculateNetValue = (grossValue: number, installments: number = 1) => {
      if (grossValue <= 0) return 0;

      // 1. Card processing fee based on installments
      let cardFeePercent = ASAAS_CARD_FEE_PERCENT; // Default: à vista 2.99%
      if (installments >= 2 && installments <= 6) {
        cardFeePercent = 3.49;
      } else if (installments >= 7 && installments <= 12) {
        cardFeePercent = 3.99;
      } else if (installments >= 13) {
        cardFeePercent = 4.29;
      }

      const cardFee = grossValue * (cardFeePercent / 100);

      // 2. Anticipation fee (only if value > R$ 5.00)
      let anticipationFee = 0;
      if (grossValue > ASAAS_ANTICIPATION_MIN_VALUE) {
        anticipationFee = grossValue * (ASAAS_ANTICIPATION_FEE_PERCENT / 100);
      }

      return grossValue - cardFee - anticipationFee;
    };

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

      // Handle Manual First Month Override
      if (monthIndex === 1 && sub.firstMonthOverridePrice !== undefined && sub.firstMonthOverridePrice !== null) {
        return sub.firstMonthOverridePrice;
      }

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
        // Robust lookup: Check by ID OR Code
        const coupon = coupons.find(c => c.id === sub.couponUsed || c.code === sub.couponUsed);

        if (coupon && price > 0) {
          // Determine effective month index for coupon
          let effectiveMonthIndex = monthIndex;

          if (sub.couponStartMonth) {
            // If coupon was applied later, calculate index relative to coupon start
            // couponStartMonth format: "YYYY-MM"
            const [cYear, cMonth] = sub.couponStartMonth.split('-').map(Number);
            const refDate = startDate ? new Date(startDate + 'T12:00:00') : new Date();
            const yearDiff = refDate.getFullYear() - cYear;
            const mDiff = refDate.getMonth() - (cMonth - 1); // Month is 1-based in string
            effectiveMonthIndex = Math.max(1, yearDiff * 12 + mDiff + 1);
          }

          if (coupon.type === 'progressive') {
            const rule = coupon.progressiveDiscounts?.find(d => d.month === effectiveMonthIndex);
            if (rule) {
              if (rule.discountType === 'fixed') {
                price = Math.max(0, price - rule.discount);
              } else {
                price = Math.max(0, price * (1 - rule.discount / 100));
              }
            }
          } else if (coupon.type === 'percentage') {
            price = Math.max(0, price * (1 - coupon.value / 100));
          } else if (coupon.type === 'fixed') {
            price = Math.max(0, price - coupon.value);
          }
        }
      }
      return price;
    };

    // Filter users based on selected mode
    const filteredUsers = users.filter((u) => {
      // 1. Date Filter
      if (startDate) {
        const start = new Date(startDate + 'T00:00:00');
        const uDate = new Date(u.createdAt || 0);
        if (uDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate + 'T23:59:59');
        const uDate = new Date(u.createdAt || 0);
        if (uDate > end) return false;
      }

      // 2. Plan Filter
      const plan = (u.subscription?.plan || 'starter').toLowerCase();
      if (filterMode !== 'all') {
        if (filterMode === 'pro') {
          // "Pro" filter includes 'pro' and 'family' (paid plans)
          if (plan !== 'pro' && plan !== 'family') return false;
        } else if (filterMode === 'starter') {
          if (plan !== 'starter') return false;
        }
      }

      // 3. Financial Filter
      if (filterFinance !== 'all') {
        const cycle = u.subscription?.billingCycle;
        const status = u.subscription?.status;

        if (filterFinance === 'monthly' && cycle !== 'monthly') return false;
        if (filterFinance === 'annual' && cycle !== 'annual') return false;
        if (filterFinance === 'past_due' && status !== 'past_due') return false;
        if (filterFinance === 'refunded' && status !== 'refunded') return false;
      }

      // 4. Admin Filter
      if (excludeAdmins && u.isAdmin) return false;

      return true;
    });

    // Separated List for MRR/Revenue (Must include ALL users active in period, not just created in period)
    const financialUsers = users.filter(u => {
      // 1. Plan Filter (Same)
      const plan = (u.subscription?.plan || 'starter').toLowerCase();
      if (filterMode !== 'all') {
        if (filterMode === 'pro') {
          if (plan !== 'pro' && plan !== 'family') return false;
        } else if (filterMode === 'starter') {
          if (plan !== 'starter') return false;
        }
      }

      // 2. Financial Filter (Same)
      if (filterFinance !== 'all') {
        const cycle = u.subscription?.billingCycle;
        const status = u.subscription?.status;
        if (filterFinance === 'monthly' && cycle !== 'monthly') return false;
        if (filterFinance === 'annual' && cycle !== 'annual') return false;
        if (filterFinance === 'past_due' && status !== 'past_due') return false;
        if (filterFinance === 'refunded' && status !== 'refunded') return false;
      }

      // 3. Admin Filter (Same)
      if (excludeAdmins && u.isAdmin) return false;

      // 4. ACTIVE FILTER INSTEAD OF CREATED FILTER
      // If we have a date range, we want users who were ACTIVE/Paying during this period.
      // Basic check: User must have subscribed BEFORE the End Date (or Today if no end date)
      // AND (User is currently active OR User canceled AFTER Start Date)

      const checkEnd = endDate ? new Date(endDate + 'T23:59:59') : new Date();
      const checkStart = startDate ? new Date(startDate + 'T00:00:00') : new Date(0); // Epoch if no start

      // Determine 'Start' of subscription for filtering purposes
      let subStart = new Date();
      if (u.subscription?.startDate) {
        subStart = new Date(u.subscription.startDate);
      } else if (u.createdAt) {
        subStart = new Date(u.createdAt);
      }

      if (subStart > checkEnd) return false; // Joined after period

      // If canceled/revoked, check if it happened BEFORE period start
      if (u.subscription?.status === 'canceled' || u.subscription?.status === 'refunded') {
        const cancelDate = u.subscription.canceledAt ? new Date(u.subscription.canceledAt) : null;
        // If they canceled BEFORE the start of the view period, they don't contribute to THIS period's MRR
        if (cancelDate && cancelDate < checkStart) return false;
      }

      // If user has no subscription object but we are here, we might skip them unless they are 'pro'
      if (!u.subscription) return false;

      return true;
    });

    filteredUsers.forEach(u => {
      // Calculate Active Days & Online Status
      if (u.createdAt) {
        const logs = u.connectionLogs;
        const lastLog = logs && logs.length > 0 ? logs[0] : null;

        // Online Check (5 mins)
        if (lastLog?.timestamp) {
          const now = new Date();
          const lastTime = new Date(lastLog.timestamp).getTime();
          if (now.getTime() - lastTime < 5 * 60 * 1000) {
            onlineUsers++;
          }
        }


        // Calculate Active Days = LAST LOGIN - created date
        const lastLoginDate = lastLog?.timestamp ? new Date(lastLog.timestamp) : new Date(u.createdAt || 0);
        const createdDate = new Date(u.createdAt);

        if (!isNaN(createdDate.getTime()) && !isNaN(lastLoginDate.getTime())) {
          const diffTime = lastLoginDate.getTime() - createdDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          totalActiveDays += Math.max(1, diffDays);
          usersWithActiveDaysCount++;
        }
      }

      // Logic continues with filteredUsers instead of all users
      // Note: Some global stats (like total plan counts) might need to be calculated on ALL users 
      // if we want to show distribution regardless of filter, but user likely wants stats for the filtered set.
      // We will perform calculations on filteredUsers for charts/MRR, 
      // but keep plan counts on ALL users if needed for the Pie chart?
      // User request implies filtering everything ("escolher entre pro e starter")

      if (!u.subscription && filterMode === 'pro') return;

      // Normalize plan
      const plan = (u.subscription?.plan || 'starter').toLowerCase();
      // Default status for users without subscription object is 'active' (free tier) if we decide to count them
      // OR we can default to undefined/null checks.
      // If subscription is missing, let's treat it as no status unless we want to assume active starter.
      // However, usually detailed stats rely on subscription object.
      // Let's use optional chaining.
      const status = u.subscription?.status;

      // 1. Plan Counts (All Plan Types)
      // If no subscription object, we assume they are Starter (if we consider them 'active' enough to count)
      // or we strictly check status.
      // Let's assume if they exist in the system, they count as Starter unless status says otherwise.
      const isActiveOrPastDue = status === 'active' || status === 'past_due' || status === 'pending_payment';

      // If no subscription object, we count as Starter (Active) ?
      // Or we can just look at the 'plan' derived above.
      // Let's trigger count if status is present OR if no subscription (defaults to starter active?)
      // Safe bet: safely check status. If missing, maybe they are just a lead.
      // But 'totalFree' logic relied on status 'active'.

      if (isActiveOrPastDue) {
        if (plan === 'pro') planCounts.pro++;
        else if (plan === 'family') planCounts.family++;
        else planCounts.starter++;
      } else if (!u.subscription || !status) {
        // User without subscription data -> assume Active Starter?
        // In original code, we filtered `u.subscription?.plan`. 
        // Since we now load ALL users, some might be raw signups.
        // Let's count them as Starter.
        planCounts.starter++;
      }

      if (status === 'active' || (!u.subscription)) {
        if (plan === 'starter') {
          totalFree++;
        } else if (status === 'active') { // Explicit active check for paid
          activeUsers++; // Only count Pro/Family as "Active Paying Subscribers"
        }
      }

      // 3. Lifetime Revenue Estimation
      if (u.subscription?.startDate) {
        const subDate = new Date(u.subscription.startDate);
        const endCalcDate = status === 'canceled' ? new Date() : new Date();
        const monthsActive = Math.max(1, (endCalcDate.getFullYear() - subDate.getFullYear()) * 12 + (endCalcDate.getMonth() - subDate.getMonth()));
        const installments = u.subscription?.installments || 1;

        for (let m = 1; m <= monthsActive; m++) {
          const monthPrice = calculateSubscriptionPrice(u.subscription, m);
          totalRevenueEst += monthPrice;
          totalRevenueEstNet += calculateNetValue(monthPrice, installments);
        }
      }

      // 4. Projections (Next 12 Months)
      if (status === 'active' && plan !== 'starter') {
        const subDate = u.subscription?.startDate ? new Date(u.subscription.startDate) : new Date();
        for (let i = 0; i < 12; i++) {
          const futureDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
          const futureDiff = (futureDate.getFullYear() - subDate.getFullYear()) * 12 + (futureDate.getMonth() - subDate.getMonth()) + 1;
          const price = calculateSubscriptionPrice(u.subscription, Math.max(1, futureDiff));

          const key = futureDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
          if (projectionMap[key] !== undefined) {
            projectionMap[key] += price;
          }
        }
      }
    });

    // Process Financial Users for MRR
    // CRITICAL: Only count users with status 'active' - matching AdminSubscriptions.calculateUserMRR logic
    financialUsers.forEach(u => {
      const status = u.subscription?.status;
      const subDate = u.subscription?.startDate ? new Date(u.subscription.startDate) : new Date();

      // MRR ONLY counts ACTIVE users - trials, past_due, pending, canceled do NOT contribute
      // This matches the logic in AdminSubscriptions.calculateUserMRR (line 746)
      // if (user.subscription?.status !== 'active') return 0;
      let shouldCount = status === 'active';

      if (shouldCount) {
        const referenceDate = startDate ? new Date(startDate + 'T12:00:00') : new Date();

        // Calculate which month of the subscription falls in the selected period
        // For accurate MRR, we want the CURRENT month index relative to subscription Start
        // This ensures progressive discounts (month 1, month 2...) are applied correctly for the *viewed* month
        const monthDiff = (referenceDate.getFullYear() - subDate.getFullYear()) * 12 + (referenceDate.getMonth() - subDate.getMonth()) + 1;
        const periodMonthIndex = Math.max(1, monthDiff);

        // Calculate price for this specific month index
        const currentPrice = calculateSubscriptionPrice(u.subscription, periodMonthIndex);
        const installments = u.subscription?.installments || 1;

        // Only add to MRR if price > 0 (Paid user) - strictly paid
        if (currentPrice > 0) {
          totalMRR += currentPrice;
          totalMRRNet += calculateNetValue(currentPrice, installments);
        }
      }
    });

    const totalSubscribedUsers = activeUsers + totalFree + (filteredUsers.filter(u => u.subscription?.status === 'canceled').length);
    // Conversion Rate: Active Paying / Total Users (Global) - or should it be filtered?
    // User asked to "show everything" and "filter between pro and starter".
    // If filtered to Pro, conversion rate is 100%? Let's keep it global if filter is 'all', 
    // but maybe just use filtered set count if specific filter.
    // Actually, "Conversion Rate" usually implies Total Visitors/Free -> Paid.
    // If filter is 'pro', showing 100% is redundant.
    // Let's stick to using `filteredUsers` for everything to reflect the "view".
    const conversionRate = filteredUsers.length > 0 ? (activeUsers / filteredUsers.length) * 100 : 0;

    // ARPU (Ticket Médio)
    const arpu = activeUsers > 0 ? totalMRR / activeUsers : 0;

    // Average Active Days
    const avgActiveDays = usersWithActiveDaysCount > 0 ? Math.round(totalActiveDays / usersWithActiveDaysCount) : 0;

    // Pending Revenue
    let pendingRevenue = 0;
    filteredUsers.forEach(u => {
      if (u.subscription && (u.subscription.status === 'past_due' || u.subscription.status === 'pending_payment')) {
        const price = calculateSubscriptionPrice(u.subscription);
        pendingRevenue += price;
      }
    });

    // New Users (Last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsers = filteredUsers.filter(u => {
      const joinDate = u.createdAt ? new Date(u.createdAt) : (u.subscription?.startDate ? new Date(u.subscription.startDate) : null);
      return joinDate && joinDate >= thirtyDaysAgo;
    }).length;

    // --- SPARKLINE & CHART DATA ---
    const userGrowthData: { name: string; value: number }[] = [];
    const now = new Date();
    // Last 6 months trend
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const count = filteredUsers.filter(u => {
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
      filteredUsers.forEach(u => {
        if (!u.subscription || !u.subscription.startDate) return;
        const start = new Date(u.subscription.startDate);
        const plan = (u.subscription.plan || 'starter').toLowerCase();

        // Strict MRR calculation matching filter logic implicitly by using filteredUsers
        // But MRR only makes sense for paid plans.
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

    const getBrazilDateKey = (dateStr: string) => {
      if (dateStr.length === 10) return dateStr;
      const date = new Date(dateStr);
      // Force Brazil Date for formatting to avoid "Yesterday" issues on tight boundaries (00:20)
      const ptBRDate = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(date);
      // ptBRDate is dd/mm/yyyy
      return ptBRDate.split('/').reverse().join('-');
    };

    filteredUsers.forEach(u => {
      // Use subscription.startDate as the source of truth since all users must subscribe to enter.
      // This ensures "New Users per Day" matches "New Subscribers per Day".
      const dateStr = u.subscription?.startDate;

      if (!dateStr) return;

      const date = new Date(dateStr);
      if (date < minDate) minDate = date;

      const key = getBrazilDateKey(dateStr);

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

    // --- DAILY NEW SUBSCRIBERS ---
    // Since all users must subscribe to enter, this now counts ALL users (not just paid)
    // to match the "New Users per Day" chart exactly.
    const dailySubCounts: Record<string, number> = {};
    let subMinDate: Date | null = null;
    let subMaxDate: Date | null = null;

    filteredUsers.forEach(u => {
      // Count ALL users since everyone must subscribe to enter
      const dateStr = u.subscription?.startDate;
      if (!dateStr) return;

      let date = new Date(dateStr);
      // Fix for min/max date calculation
      if (dateStr.length === 10) {
        date = new Date(dateStr + 'T12:00:00');
      }

      if (!subMinDate || date < subMinDate) subMinDate = date;
      if (!subMaxDate || date > subMaxDate) subMaxDate = date;

      const key = getBrazilDateKey(dateStr);

      dailySubCounts[key] = (dailySubCounts[key] || 0) + 1;
    });

    const newSubscribersGrowth: { date: string, rawDate: string, daily: number }[] = [];

    // Determine loop bounds
    // Use filter dates if available, otherwise use data bounds
    let loopStart = startDate ? new Date(startDate + 'T00:00:00') : (subMinDate ? new Date(subMinDate) : new Date());
    let loopEnd = endDate ? new Date(endDate + 'T00:00:00') : (subMaxDate ? new Date(subMaxDate) : new Date());

    // Fallback if no data and no filter (show last 30 days)
    if (!startDate && !endDate && !subMinDate) {
      loopEnd = new Date();
      loopStart = new Date();
      loopStart.setDate(loopStart.getDate() - 30);
    }

    // Just in case end is before start
    if (loopStart > loopEnd) loopStart = new Date(loopEnd);

    const currentLoop = new Date(loopStart);
    currentLoop.setHours(0, 0, 0, 0);
    const loopEndLimit = new Date(loopEnd);
    loopEndLimit.setHours(0, 0, 0, 0);

    // If we have an open timeline (no end date set), enforce 'Today' as max if data doesn't exceed it
    // This makes the chart look "up to date" instead of stopping at last sale
    if (!endDate && loopEndLimit < new Date()) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (today > loopEndLimit) {
        // Optionally extend to today for better visual? 
        // Let's stick to data max if unbounded, logic stays cleaner.
        // Actually, dashboards usually show "Trends", so empty days at the end are important info (Sales stopped).
        // So let's extend to Today if no filter is set.
        loopEndLimit.setTime(new Date().setHours(0, 0, 0, 0));
      }
    }
    // Also if specific date filter is set, we strictly honor it (already correctly set above)

    while (currentLoop <= loopEndLimit) {
      const key = currentLoop.toLocaleDateString('sv-SE');
      // format DD/MM
      const [y, m, d] = key.split('-');
      newSubscribersGrowth.push({
        date: `${d}/${m}`,
        rawDate: key,
        daily: dailySubCounts[key] || 0
      });
      currentLoop.setDate(currentLoop.getDate() + 1);
    }

    if (newSubscribersGrowth.length === 0) {
      newSubscribersGrowth.push({ date: 'Hoje', rawDate: new Date().toISOString(), daily: 0 });
    }

    // Heatmap / Location Data (Top 5 States)
    const locationData: Record<string, number> = {};
    const ageBuckets: Record<string, number> = {
      '<18': 0,
      '18-24': 0,
      '25-34': 0,
      '35-44': 0,
      '45-54': 0,
      '55+': 0,
      'N/A': 0
    };
    const activeDaysBuckets: Record<string, number> = {
      '0-7': 0,
      '8-14': 0,
      '15-21': 0,
      '22-30': 0,
      '>31': 0
    };

    filteredUsers.forEach(u => {
      // Location
      const state = u.address?.state?.toUpperCase() || 'N/A';
      const key = state.length === 2 ? state : 'N/A';
      if (key !== 'N/A') locationData[key] = (locationData[key] || 0) + 1;

      // Active Days Distribution = LAST LOGIN - created date
      if (u.createdAt) {
        const logs = u.connectionLogs;
        const lastLog = logs && logs.length > 0 ? logs[0] : null;
        const lastLoginDate = lastLog?.timestamp ? new Date(lastLog.timestamp) : new Date(u.createdAt);
        const createdDate = new Date(u.createdAt);

        if (!isNaN(createdDate.getTime()) && !isNaN(lastLoginDate.getTime())) {
          const diffTime = lastLoginDate.getTime() - createdDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const days = Math.max(1, diffDays);

          if (days <= 7) activeDaysBuckets['0-7']++;
          else if (days <= 14) activeDaysBuckets['8-14']++;
          else if (days <= 21) activeDaysBuckets['15-21']++;
          else if (days <= 30) activeDaysBuckets['22-30']++;
          else activeDaysBuckets['>31']++;
        }
      }

      // Age
      if (u.birthDate) {
        const birth = new Date(u.birthDate);
        if (!isNaN(birth.getTime())) {
          // Calculate age carefully
          let age = today.getFullYear() - birth.getFullYear();
          const m = today.getMonth() - birth.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
          }

          if (age < 0) ageBuckets['N/A']++; // Invalid date in future
          else if (age < 18) ageBuckets['<18']++;
          else if (age <= 24) ageBuckets['18-24']++;
          else if (age <= 34) ageBuckets['25-34']++;
          else if (age <= 44) ageBuckets['35-44']++;
          else if (age <= 54) ageBuckets['45-54']++;
          else ageBuckets['55+']++;
        } else {
          ageBuckets['N/A']++;
        }
      } else {
        ageBuckets['N/A']++;
      }
    });

    const locationsChartData = Object.entries(locationData)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const ageChartData = [
      { name: '< 18', value: ageBuckets['<18'] },
      { name: '18-24', value: ageBuckets['18-24'] },
      { name: '25-34', value: ageBuckets['25-34'] },
      { name: '35-44', value: ageBuckets['35-44'] },
      { name: '45-54', value: ageBuckets['45-54'] },
      { name: '55+', value: ageBuckets['55+'] },
      { name: 'N/A', value: ageBuckets['N/A'] },
    ];

    const activeDaysChartData = [
      { name: '0-7', full: '0 a 7 dias', value: activeDaysBuckets['0-7'] },
      { name: '8-14', full: '8 a 14 dias', value: activeDaysBuckets['8-14'] },
      { name: '15-21', full: '15 a 21 dias', value: activeDaysBuckets['15-21'] },
      { name: '22-30', full: '22 a 30 dias', value: activeDaysBuckets['22-30'] },
      { name: '>31', full: 'Mais de 31 dias', value: activeDaysBuckets['>31'] },
    ];



    const chartData = Object.entries(projectionMap).map(([name, value]) => ({ name, value }));
    const planData = [
      { name: 'Starter', value: planCounts.starter, color: PLAN_COLORS.starter },
      { name: 'Pro', value: planCounts.pro, color: PLAN_COLORS.pro },
      { name: 'Family', value: planCounts.family, color: PLAN_COLORS.family },
    ].filter(d => d.value > 0);

    return {
      mrr: totalMRR,
      mrrNet: totalMRRNet,
      revenue: totalRevenueEst,
      revenueNet: totalRevenueEstNet,
      activeUsers,
      totalFree,
      arpu,
      conversionRate,
      avgActiveDays, // New metric
      onlineUsers,
      pendingRevenue,
      newUsers,
      chartData,
      planData,
      locationsChartData,
      ageData: ageChartData,
      activeDaysData: activeDaysChartData, // New chart data

      cumulativeGrowth, // Add to return object
      newSubscribersGrowth, // New chart data
      filteredCount: filteredUsers.length,
      trends: {
        users: userGrowthData,
        mrr: mrrTrendData,
        usersValues: usersTrendValues,
        generic: randomTrend()
      }
    };
  }, [users, coupons, filterMode, filterFinance, startDate, endDate, excludeAdmins]);

  return (
    <div className="p-6 space-y-8 animate-fade-in pb-20">
      <style>{`
        .recharts-wrapper { outline: none !important; }
        .recharts-surface:focus { outline: none !important; }
        .recharts-layer { outline: none !important; }
      `}</style>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Painel Administrativo</h1>
          <p className="text-gray-400">Visão geral financeira e métricas de saúde do sistema.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">

          {/* Date Range Dropdown */}
          <div className="relative" ref={dateFilterRef}>
            <button
              onClick={() => setIsDateFilterOpen(!isDateFilterOpen)}
              className={`
                px-3 py-2 bg-[#30302E] border rounded-lg text-sm font-medium transition-colors flex items-center gap-2 h-11
                ${isDateFilterOpen || startDate || endDate ? 'border-[#d97757] text-white' : 'border-[#373734] text-gray-300 hover:bg-[#3d3d3b]'}
              `}
            >
              <Calendar size={14} className={startDate || endDate ? 'text-[#d97757]' : 'text-gray-400'} />
              <span>
                {startDate && endDate
                  ? `${new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR')} - ${new Date(endDate + 'T12:00:00').toLocaleDateString('pt-BR')}`
                  : (startDate
                    ? `A partir de ${new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR')}`
                    : (endDate
                      ? `Até ${new Date(endDate + 'T12:00:00').toLocaleDateString('pt-BR')}`
                      : 'Período'))
                }
              </span>
              <ChevronDown size={14} className={`text-gray-500 transition-transform ${isDateFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isDateFilterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 5, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute z-40 top-full mt-2 right-0 w-72 bg-[#30302E] border border-[#373734] rounded-xl shadow-2xl p-4 flex flex-col gap-4"
                >
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider pl-1">Data Inicial</label>
                    <CustomDatePicker
                      value={startDate}
                      onChange={setStartDate}
                      placeholder="Selecione data inicial"
                      dropdownMode="fixed"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider pl-1">Data Final</label>
                    <CustomDatePicker
                      value={endDate}
                      onChange={setEndDate}
                      placeholder="Selecione data final"
                      dropdownMode="fixed"
                    />
                  </div>

                  {(startDate || endDate) && (
                    <div className="pt-2 border-t border-[#373734] flex justify-end">
                      <button
                        onClick={() => {
                          setStartDate('');
                          setEndDate('');
                          setIsDateFilterOpen(false);
                        }}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium flex items-center gap-1"
                      >
                        <X size={12} />
                        Limpar Filtros
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Admin Filter */}
          <button
            onClick={() => setExcludeAdmins(!excludeAdmins)}
            className={`
              px-3 py-2 border rounded-lg text-sm font-medium transition-colors flex items-center gap-2 h-11
              ${excludeAdmins ? 'bg-[#d97757]/10 border-[#d97757] text-[#d97757]' : 'bg-[#30302E] border-[#373734] text-gray-400 hover:text-white hover:bg-[#3d3d3b]'}
            `}
            title={excludeAdmins ? "Admins Ocultos" : "Ocultar Admins"}
          >
            <ShieldAlert size={14} />
            <span className="hidden sm:inline">Admins</span>
            {excludeAdmins && <Check size={14} className="ml-1" />}
          </button>

          {/* Finance Filter */}
          <Dropdown>
            <DropdownTrigger className="px-3 py-2 bg-[#30302E] border border-solid border-[#373734] rounded-lg text-sm text-gray-300 font-medium hover:bg-[#3d3d3b] transition-colors flex items-center gap-2 h-11">
              <DollarSign size={14} className="text-gray-400" />
              <span>
                {filterFinance === 'all' && 'Fin: Todos'}
                {filterFinance === 'monthly' && 'Ciclo: Mensal'}
                {filterFinance === 'annual' && 'Ciclo: Anual'}
                {filterFinance === 'past_due' && 'Status: Inadimplente'}
                {filterFinance === 'refunded' && 'Status: Reembolsado'}
              </span>
              <ChevronDown size={14} className="text-gray-500" />
            </DropdownTrigger>
            <DropdownContent align="right">
              <DropdownLabel>CICLO DE COBRANÇA</DropdownLabel>
              <DropdownItem onClick={() => setFilterFinance('all')}>
                <div className="flex items-center justify-between w-full">
                  <span>Todos</span>
                  {filterFinance === 'all' && <Check size={14} className="text-emerald-400" />}
                </div>
              </DropdownItem>
              <DropdownItem onClick={() => setFilterFinance('monthly')}>
                <div className="flex items-center justify-between w-full">
                  <span>Mensal (MRR)</span>
                  {filterFinance === 'monthly' && <Check size={14} className="text-emerald-400" />}
                </div>
              </DropdownItem>
              <DropdownItem onClick={() => setFilterFinance('annual')}>
                <div className="flex items-center justify-between w-full">
                  <span>Anual (Fluxo de Caixa)</span>
                  {filterFinance === 'annual' && <Check size={14} className="text-emerald-400" />}
                </div>
              </DropdownItem>

              <DropdownSeparator />
              <DropdownLabel>STATUS FINANCEIRO</DropdownLabel>

              <DropdownItem onClick={() => setFilterFinance('past_due')}>
                <div className="flex items-center justify-between w-full">
                  <span className="text-red-400">Inadimplentes</span>
                  {filterFinance === 'past_due' && <Check size={14} className="text-emerald-400" />}
                </div>
              </DropdownItem>
              <DropdownItem onClick={() => setFilterFinance('refunded')}>
                <div className="flex items-center justify-between w-full">
                  <span className="text-orange-400">Reembolsados</span>
                  {filterFinance === 'refunded' && <Check size={14} className="text-emerald-400" />}
                </div>
              </DropdownItem>
            </DropdownContent>
          </Dropdown>

          {/* Plan Filter */}
          <Dropdown>
            <DropdownTrigger className="px-3 py-2 bg-[#30302E] border border-solid border-[#373734] rounded-lg text-sm text-gray-300 font-medium hover:bg-[#3d3d3b] transition-colors flex items-center gap-2 h-11">
              <Filter size={14} className="text-gray-400" />
              <span>
                {filterMode === 'all' && 'Plano: Todos'}
                {filterMode === 'pro' && 'Plano: Pro'}
                {filterMode === 'starter' && 'Plano: Starter'}
              </span>
              <ChevronDown size={14} className="text-gray-500" />
            </DropdownTrigger>
            <DropdownContent align="right">
              <DropdownLabel>FILTRAR POR PLANO</DropdownLabel>
              <DropdownItem onClick={() => setFilterMode('all')}>
                <div className="flex items-center justify-between w-full">
                  <span>Todos</span>
                  {filterMode === 'all' && <Check size={14} className="text-emerald-400" />}
                </div>
              </DropdownItem>
              <DropdownItem onClick={() => setFilterMode('pro')}>
                <div className="flex items-center justify-between w-full">
                  <span>Pro</span>
                  {filterMode === 'pro' && <Check size={14} className="text-emerald-400" />}
                </div>
              </DropdownItem>
              <DropdownItem onClick={() => setFilterMode('starter')}>
                <div className="flex items-center justify-between w-full">
                  <span>Starter</span>
                  {filterMode === 'starter' && <Check size={14} className="text-emerald-400" />}
                </div>
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="MRR Bruto"
          value={stats.mrr}
          prefix="R$"
          trendData={stats.trends.mrr}
          color="#d97757"
          trendPercent={12.6}
          footer={asaasStats ? `Asaas (${asaasStats.subscriptions.active} subs)` : "Receita mensal recorrente"}
        />
        <KPICard
          title="MRR Líquido"
          value={stats.mrrNet}
          prefix="R$"
          trendData={stats.trends.mrr}
          color="#10B981"
          footer={`Taxas: R$ ${(stats.mrr - stats.mrrNet).toFixed(2)}`}
        />
        <KPICard
          title="Receita Total (Bruta)"
          value={asaasStats?.revenue.totalGross ?? stats.revenue}
          prefix="R$"
          trendData={stats.trends.mrr}
          color="#3B82F6"
          footer={asaasStats ? `${asaasStats.paymentsCount} pagamentos (12m)` : "Acumulado desde o início"}
        />
        <KPICard
          title="Receita Total (Líquida)"
          value={asaasStats?.revenue.totalNet ?? stats.revenueNet}
          prefix="R$"
          trendData={stats.trends.mrr}
          color="#8B5CF6"
          footer={`Taxas: R$ ${((asaasStats?.revenue.totalGross ?? stats.revenue) - (asaasStats?.revenue.totalNet ?? stats.revenueNet)).toFixed(2)}`}
        />
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Assinantes Pagos"
          value={asaasStats?.subscriptions.active ?? stats.activeUsers}
          trendData={stats.trends.usersValues}
          color="#3B82F6"
          trendPercent={24}
          footer={asaasStats ? `${asaasStats.subscriptions.monthly} mensal | ${asaasStats.subscriptions.yearly} anual` : `+${stats.totalFree} gratuitos`}
        />
        <KPICard
          title="Novos Usuários (30d)"
          value={stats.newUsers}
          trendData={stats.trends.usersValues}
          color="#8B5CF6"
          trendPercent={stats.newUsers > 0 ? 100 : 0}
          footer="Aquisição recente"
        />
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
          value={asaasStats?.revenue.pending ?? stats.pendingRevenue}
          prefix="R$"
          trendData={stats.trends.mrr}
          color="#EC4899"
          footer={asaasStats ? "Pagtos pendentes (Asaas)" : "Total em atraso"}
        />
        <KPICard
          title="Média Dias Ativos"
          value={stats.avgActiveDays}
          color="#06b6d4"
          footer="Do cadastro até hoje"
          suffix=" dias"
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
              <span className="text-2xl font-bold text-white">{stats.filteredCount}</span>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily New Users Chart */}
        <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-400" />
            Novos Usuários por Dia
          </h3>
          <p className="text-gray-500 text-sm mb-6">Quantidade de novos usuários cadastrados diariamente</p>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.cumulativeGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#373734" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
                />
                <YAxis
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="daily"
                  name="Novos Usuários"
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                  barSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily New Subscribers Chart */}
        <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            <TrendingUp size={18} className="text-[#d97757]" />
            Novos Assinantes por Dia
          </h3>
          <p className="text-gray-500 text-sm mb-6">Quantidade de novas assinaturas iniciadas diariamente</p>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.newSubscribersGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#373734" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
                />
                <YAxis
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="daily"
                  name="Novas Assinaturas"
                  fill="#d97757"
                  radius={[4, 4, 0, 0]}
                  barSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Location & Plans */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-6 relative overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-4 z-10 relative">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <MapPin size={18} className="text-[#D97757]" />
              Top Localizações
            </h3>

            <div className="relative group">
              <div
                className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-help"
              >
                <Info size={16} />
              </div>

              {/* Hover Card */}
              <div className="absolute right-0 top-full mt-2 w-48 opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all duration-300 z-50 transform group-hover:translate-y-0 translate-y-2">
                <div className="bg-[#1c1c1a] border border-[#373734] rounded-xl shadow-xl p-3 flex flex-col gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                  <p className="text-[10px] uppercase font-bold text-gray-500 mb-1 sticky top-0 bg-[#1c1c1a] pb-1 z-10">Ranking por Estado</p>
                  {stats.locationsChartData.length > 0 ? (
                    stats.locationsChartData.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[#D97757] font-bold w-4 text-right">{index + 1}.</span>
                          <span className="text-gray-300">{item.name}</span>
                        </div>
                        <span className="font-bold text-white">{item.value}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500 text-center py-2">Sem dados</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 w-full relative min-h-[300px]">
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{
                scale: 800,
                center: [-54, -15]
              }}
              className="w-full h-full"
            >
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    // Support both TopoJSON (BR-XX) and GeoJSON (properties.sigla) formats
                    const stateCode = geo.properties?.sigla || (geo.id ? geo.id.replace('BR-', '') : 'NA');
                    const count = stats.locationsChartData.find(d => d.name === stateCode)?.value || 0;
                    // Calculate max for scale
                    const maxVal = Math.max(...stats.locationsChartData.map(d => d.value), 1);

                    const colorScale = scaleLinear<string>()
                      .domain([0, maxVal])
                      .range(["#404040", "#D97757"]);

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={count > 0 ? colorScale(count) : "#404040"}
                        stroke="#30302E"
                        strokeWidth={0.5}
                        style={{
                          default: { outline: "none", transition: "all 250ms" },
                          hover: { fill: "#F97316", outline: "none", cursor: 'pointer' },
                          pressed: { outline: "none" }
                        }}
                        onMouseEnter={() => {
                          setTooltipContent(`${geo.properties.name}: ${count} usuários`);
                        }}
                        onMouseLeave={() => {
                          setTooltipContent("");
                        }}
                      />
                    );
                  })
                }
              </Geographies>
            </ComposableMap>

            {tooltipContent && (
              <div className="absolute top-4 right-4 bg-black/80 text-white text-xs px-2 py-1 rounded pointer-events-none border border-gray-700 backdrop-blur-sm z-50">
                {tooltipContent}
              </div>
            )}
          </div>
        </div>

        {/* Plan Distribution (Shadcn Radial Stacked) */}
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
                <p className="text-3xl font-bold text-white">{stats.filteredCount}</p>
                <p className="text-xs text-gray-500 uppercase">Usuários</p>
              </div>
            </div>
            {/* Legend */}
            <div className="absolute bottom-0 w-full flex justify-center gap-4 text-xs font-medium">
              {stats.planData.map(p => (
                <div key={p.name} className="flex items-center gap-1.5 text-gray-400">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name} ({Math.round(p.value / stats.filteredCount * 100)}%)
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Age & Active Days Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Active Days Distribution Chart */}
        <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            <Clock size={18} className="text-cyan-400" />
            Tempo de Atividade
          </h3>
          <p className="text-gray-500 text-sm mb-6">Distribuição de dias ativos dos usuários</p>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.activeDaysData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#373734" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={<CustomTooltip formatter={(value: number, name: string, entry: any) => `${entry.payload.full}: ${value}`} />}
                />
                <Bar
                  dataKey="value"
                  name="Usuários"
                  fill="#06b6d4" // Cyan-500 to match KPI
                  radius={[4, 4, 0, 0]}
                  barSize={50}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Age Estimation Chart */}
        <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            <Calendar size={18} className="text-[#d97757]" />
            Estimativa de Idades
          </h3>
          <p className="text-gray-500 text-sm mb-6">Distribuição etária da base de usuários</p>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.ageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#373734" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="value"
                  name="Usuários"
                  fill="#8B5CF6"
                  radius={[4, 4, 0, 0]}
                  barSize={50}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>


    </div >
  );
};
