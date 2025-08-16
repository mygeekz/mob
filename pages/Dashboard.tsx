import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import moment from 'jalali-moment';
import StatCard from '../components/StatCard';
import { CHART_TIMEFRAMES } from '../constants';
import { SalesDataPoint, ChartTimeframe, ActivityItem, DashboardAPIData, StatCardData, NotificationMessage } from '../types';
import Notification from '../components/Notification';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { apiFetch } from '../utils/apiFetch'; 
import ActionCenterWidget from '../components/ActionCenterWidget';

const formatPriceForStats = (value: number): string => {
  if (value === undefined || value === null) return '۰ تومان';
  return value.toLocaleString('fa-IR') + ' تومان';
};
const formatNumberForStats = (value: number): string => {
  if (value === undefined || value === null) return '۰';
  return value.toLocaleString('fa-IR');
};

const Dashboard: React.FC = () => {
  const [activeTimeframe, setActiveTimeframe] = useState<ChartTimeframe['key']>('monthly');
  const [dashboardData, setDashboardData] = useState<DashboardAPIData | null>(null);
  const [localIsLoading, setLocalIsLoading] = useState(true); 
  const [notification, setNotification] = useState<NotificationMessage | null>(null);
  const [statCards, setStatCards] = useState<StatCardData[]>([]);
  const { token, authReady, isLoading: authProcessLoading, logout } = useAuth(); 
  const { theme } = useTheme();

  const fetchDashboardData = async (currentPeriod: ChartTimeframe['key']) => {
    console.log("Dashboard: fetchDashboardData called. Period:", currentPeriod, "Token present:", !!token);
    
    setLocalIsLoading(true);
    setNotification(null);
    try {
      const response = await apiFetch(`/api/dashboard/summary?period=${currentPeriod}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'خطا در دریافت اطلاعات داشبورد');
      }
      setDashboardData(result.data);

      const kpis = result.data.kpis;
      setStatCards([
        {
          title: 'فروش کل (از ابتدا)',
          value: formatPriceForStats(kpis.totalSalesAllTime),
          icon: 'fa-solid fa-globe',
          iconBgColor: 'bg-orange-100 dark:bg-orange-900/50',
          iconTextColor: 'text-orange-600 dark:text-orange-300',
          trendText: 'مجموع فروش نقدی، قسطی و خدمات',
        },
        {
          title: 'فروش کل ماه جاری',
          value: formatPriceForStats(kpis.totalSalesMonth),
          icon: 'fa-solid fa-dollar-sign',
          iconBgColor: 'bg-indigo-100 dark:bg-indigo-900/50',
          iconTextColor: 'text-indigo-600 dark:text-indigo-300',
          trendText: 'در ماه شمسی جاری',
        },
        {
          title: "درآمد امروز",
          value: formatPriceForStats(kpis.revenueToday),
          icon: 'fa-solid fa-sack-dollar',
          iconBgColor: 'bg-green-100 dark:bg-green-900/50',
          iconTextColor: 'text-green-600 dark:text-green-300',
          trendText: 'برای امروز شمسی',
        },
        {
          title: 'محصولات و گوشی‌های فعال',
          value: formatNumberForStats(kpis.activeProductsCount),
          icon: 'fa-solid fa-box-open',
          iconBgColor: 'bg-blue-100 dark:bg-blue-900/50',
          iconTextColor: 'text-blue-600 dark:text-blue-300',
          trendText: 'مجموع کالاهای موجود در انبار و گوشی‌ها',
        },
        {
          title: 'مجموع مشتریان',
          value: formatNumberForStats(kpis.totalCustomersCount),
          icon: 'fa-solid fa-users',
          iconBgColor: 'bg-purple-100 dark:bg-purple-900/50',
          iconTextColor: 'text-purple-600 dark:text-purple-300',
          trendText: 'تعداد کل مشتریان ثبت شده',
        },
      ]);

    } catch (error: any) {
      console.error("Dashboard data fetch failed:", error);
      let displayMessage = "یک خطای پیش‌بینی نشده در دریافت اطلاعات داشبورد رخ داد.";
      if (error.message) {
        if (error.message.includes('۴۰۳') || error.message.includes('توکن')) {
            displayMessage = 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.';
            logout(); // **مهم: خروج خودکار کاربر**
        } else if (error.message.toLowerCase().includes('failed to fetch')) {
            displayMessage = 'خطا در ارتباط با سرور. اتصال اینترنت خود را بررسی کنید.';
        } else {
            displayMessage = error.message; 
        }
      }
      setNotification({ type: 'error', text: displayMessage });
      setDashboardData(null); 
    } finally {
      setLocalIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (authReady && token) {
      fetchDashboardData(activeTimeframe);
    } else if (authReady && !token) {
        setLocalIsLoading(false);
        setDashboardData(null);
        setStatCards([]);
    }
  }, [activeTimeframe, token, authReady]); 

  const handleTimeframeChange = (timeframeKey: ChartTimeframe['key']) => {
    setActiveTimeframe(timeframeKey);
  };
  
  const formatActivityTimestamp = (isoTimestamp: string) => {
    return moment(isoTimestamp).locale('fa').fromNow();
  };

  const showLoadingSkeletons = authProcessLoading || (!authReady && !token) || (localIsLoading && authReady && token);
  const chartTickColor = theme === 'dark' ? '#9ca3af' : '#6B7280';
  const chartGridColor = theme === 'dark' ? '#374151' : '#e0e0e0';
  const chartTooltipBg = theme === 'dark' ? '#1f2937' : 'white';
  const chartTooltipText = theme === 'dark' ? '#d1d5db' : '#374151';

  return (
    <div className="space-y-6">
      <Notification message={notification} onClose={() => setNotification(null)} />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {showLoadingSkeletons ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/2 mb-4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            </div>
          ))
        ) : (
          statCards.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))
        )}
      </div>
      
      <div className="mt-8">
        <ActionCenterWidget />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 text-right">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 sm:mb-0">نمای کلی فروش</h3>
          <div className="flex space-x-2 space-x-reverse">
            {CHART_TIMEFRAMES.map((timeframe) => (
              <button
                key={timeframe.key}
                onClick={() => handleTimeframeChange(timeframe.key)}
                disabled={!!showLoadingSkeletons}
                className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-colors ${
                  activeTimeframe === timeframe.key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:bg-gray-200 dark:disabled:bg-gray-600'
                }`}
              >
                {timeframe.label}
              </button>
            ))}
          </div>
        </div>
        <div className="w-full h-80">
          {showLoadingSkeletons ? (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <i className="fas fa-spinner fa-spin text-2xl mr-2"></i> در حال بارگذاری نمودار...
            </div>
          ) : dashboardData?.salesChartData && dashboardData.salesChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboardData.salesChartData} margin={{ top: 5, right: 0, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false}/>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: chartTickColor }} axisLine={{ stroke: chartGridColor }} tickLine={{ stroke: chartGridColor }} />
                <YAxis tick={{ fontSize: 12, fill: chartTickColor }} axisLine={false} tickLine={false} orientation="right" tickFormatter={(value) => value.toLocaleString('fa-IR')} />
                <Tooltip
                  contentStyle={{ backgroundColor: chartTooltipBg, borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)', direction: 'rtl', border: `1px solid ${chartGridColor}` }}
                  itemStyle={{ color: '#818cf8' }}
                  labelStyle={{ color: chartTooltipText, fontWeight: 'bold' }}
                  formatter={(value: number) => [formatPriceForStats(value), 'فروش']}
                />
                <Legend wrapperStyle={{fontSize: "14px", direction: "rtl", color: chartTickColor}}/>
                <Area type="monotone" dataKey="sales" stroke="#4F46E5" fillOpacity={1} fill="url(#salesGradient)" strokeWidth={2} activeDot={{ r: 6 }} name="فروش"/>
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                {!token && authReady ? 'برای مشاهده اطلاعات، لطفاً ابتدا وارد شوید.' : 'داده‌ای برای نمایش در نمودار برای بازه انتخاب شده وجود ندارد.'}
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 text-right">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">فعالیت‌های اخیر</h3>
        </div>
        {showLoadingSkeletons ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              <i className="fas fa-spinner fa-spin text-xl mr-2"></i> در حال بارگذاری فعالیت‌ها...
            </div>
        ) : dashboardData?.recentActivities && dashboardData.recentActivities.length > 0 ? (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {dashboardData.recentActivities.map((activity: ActivityItem) => (
              <li key={activity.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center space-x-3 space-x-reverse">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${activity.color || 'bg-gray-200'}`}>
                    <i className={`${activity.icon} text-white text-lg`}></i>
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{activity.typeDescription}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{activity.details}</p>
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {formatActivityTimestamp(activity.timestamp)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
             <div className="p-6 text-center text-gray-500 dark:text-gray-400">{!token && authReady ? 'برای مشاهده فعالیت‌ها، لطفاً ابتدا وارد شوید.' : 'فعالیت اخیری برای نمایش وجود ندارد.'}</div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;