import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { NotificationMessage } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import Notification from '../../components/Notification';

interface AnalysisCardItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  path: string;
  color: 'indigo' | 'green' | 'red' | 'sky' | 'purple';
}

const analysisItems: AnalysisCardItem[] = [
  {
    id: 'profitability',
    title: 'سودآوری کالاها',
    description: 'تحلیل دقیق سود ناخالص و حاشیه سود برای هر کالا بر اساس تاریخچه فروش.',
    icon: 'fa-solid fa-sack-dollar',
    path: '/reports/analysis/profitability',
    color: 'indigo',
  },
  {
    id: 'inventory',
    title: 'تحلیل وضعیت انبار',
    description: 'شناسایی کالاهای پرفروش (داغ) و کم‌فروش (راکد) بر اساس سرعت فروش.',
    icon: 'fa-solid fa-boxes-stacked',
    path: '/reports/analysis/inventory',
    color: 'green',
  },
  {
    id: 'suggestions',
    title: 'پیشنهادهای هوشمند خرید',
    description: 'دریافت لیست کالاهایی که موجودی آن‌ها رو به اتمام است به همراه تعداد پیشنهادی برای خرید.',
    icon: 'fa-solid fa-lightbulb',
    path: '/reports/analysis/suggestions',
    color: 'red',
  },
  {
    id: 'phone-sales',
    title: 'گزارش فروش نقدی موبایل',
    description: 'گزارش مالی کامل از خرید، فروش و سود گوشی‌های موبایل در فروش‌های عادی (نقدی و اعتباری).',
    icon: 'fa-solid fa-cash-register',
    path: '/reports/phone-sales',
    color: 'sky',
  },
  {
    id: 'phone-installment-sales',
    title: 'گزارش فروش اقساطی موبایل',
    description: 'گزارش مالی گوشی‌های فروخته شده در طرح‌های اقساطی به همراه سود کل هر معامله.',
    icon: 'fa-solid fa-file-invoice-dollar',
    path: '/reports/phone-installment-sales',
    color: 'purple',
  },
];

const getColorClasses = (color: 'indigo' | 'green' | 'red' | 'sky' | 'purple') => {
    switch (color) {
        case 'green':
            return {
                bg: 'bg-green-50', iconBg: 'bg-green-100', iconText: 'text-green-600',
                hoverBorder: 'hover:border-green-300', hoverText: 'group-hover:text-green-700', arrowText: 'text-green-600'
            };
        case 'red':
             return {
                bg: 'bg-red-50', iconBg: 'bg-red-100', iconText: 'text-red-600',
                hoverBorder: 'hover:border-red-300', hoverText: 'group-hover:text-red-700', arrowText: 'text-red-600'
            };
        case 'sky':
             return {
                bg: 'bg-sky-50', iconBg: 'bg-sky-100', iconText: 'text-sky-600',
                hoverBorder: 'hover:border-sky-300', hoverText: 'group-hover:text-sky-700', arrowText: 'text-sky-600'
            };
        case 'purple':
             return {
                bg: 'bg-purple-50', iconBg: 'bg-purple-100', iconText: 'text-purple-600',
                hoverBorder: 'hover:border-purple-300', hoverText: 'group-hover:text-purple-700', arrowText: 'text-purple-600'
            };
        case 'indigo':
        default:
            return {
                bg: 'bg-indigo-50', iconBg: 'bg-indigo-100', iconText: 'text-indigo-600',
                hoverBorder: 'hover:border-indigo-300', hoverText: 'group-hover:text-indigo-700', arrowText: 'text-indigo-600'
            };
    }
}


const AnalysisHub: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [notification, setNotification] = useState<NotificationMessage | null>(null);

  useEffect(() => {
    if (currentUser && currentUser.roleName === 'Salesperson') {
      setNotification({ type: 'error', text: 'شما اجازه دسترسی به این صفحه را ندارید.' });
      navigate('/');
    }
  }, [currentUser, navigate]);

  if (currentUser && currentUser.roleName === 'Salesperson') {
    return null;
  }

  return (
    <div className="space-y-8 text-right" dir="rtl">
      <Notification message={notification} onClose={() => setNotification(null)} />
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-4">مرکز تحلیل هوشمند</h2>
        <p className="text-gray-600 mb-8">
          با استفاده از قدرت تحلیل داده‌ها، دیدگاه‌های جدیدی در مورد کسب‌وکار خود کسب کنید. این گزارش‌ها به شما در تصمیم‌گیری‌های استراتژیک برای افزایش سود و بهینه‌سازی انبار کمک می‌کنند.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {analysisItems.map((item) => {
            const colors = getColorClasses(item.color);
            return (
                <Link
                key={item.id}
                to={item.path}
                className={`block ${colors.bg} p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 ease-in-out border border-gray-200 ${colors.hoverBorder} group`}
                >
                <div className="flex items-center mb-3">
                    <div className={`p-3 ${colors.iconBg} rounded-full mr-4 group-hover:bg-opacity-80 transition-colors`}>
                    <i className={`${item.icon} text-2xl ${colors.iconText} transition-colors`}></i>
                    </div>
                    <h3 className={`text-lg font-semibold text-gray-800 ${colors.hoverText} transition-colors`}>{item.title}</h3>
                </div>
                <p className="text-sm text-gray-600 group-hover:text-gray-700 transition-colors">{item.description}</p>
                <div className={`mt-4 ${colors.arrowText} font-medium text-sm transition-colors`}>
                    مشاهده تحلیل <i className="fas fa-arrow-left mr-2"></i>
                </div>
                </Link>
            )
          })}
        </div>
      </div>
    </div>
  );
};

export default AnalysisHub;