import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../contexts/AuthContext'; // To get page title based on auth
import { SIDEBAR_ITEMS } from '../constants';
import { useLocation } from 'react-router-dom';


const MainLayout: React.FC = () => {
  const location = useLocation();
  const { currentUser } = useAuth(); // Get current user from AuthContext

  // This function is moved from App.tsx to MainLayout.tsx
  const getCurrentPageTitle = () => {
    if (!currentUser) return 'ورود به سیستم'; // Or some default for non-authed states if MainLayout was used there

    const customerDetailMatch = location.pathname.match(/^\/customers\/(\d+)$/);
    if (customerDetailMatch) return 'جزئیات مشتری';
    
    const partnerDetailMatch = location.pathname.match(/^\/partners\/(\d+)$/);
    if (partnerDetailMatch) return 'جزئیات همکار';
    
    const invoiceDetailMatch = location.pathname.match(/^\/invoices\/(\d+)$/);
    if (invoiceDetailMatch && invoiceDetailMatch[1]) return `فاکتور فروش شماره ${Number(invoiceDetailMatch[1]).toLocaleString('fa-IR')}`;
    
    const installmentSaleDetailMatch = location.pathname.match(/^\/installment-sales\/(\d+)$/);
    if (installmentSaleDetailMatch) return 'جزئیات فروش اقساطی';
    
    if (location.pathname === '/installment-sales/new') return 'ثبت فروش اقساطی جدید';
    if (location.pathname === '/profile') return 'پروفایل کاربر';


    // Report and Analysis Titles
    if (location.pathname === '/reports/sales-summary') return 'گزارش فروش و سود';
    if (location.pathname === '/reports/debtors') return 'گزارش بدهکاران';
    if (location.pathname === '/reports/creditors') return 'گزارش بستانکاران';
    if (location.pathname === '/reports/top-customers') return 'مشتریان برتر';
    if (location.pathname === '/reports/top-suppliers') return 'تامین کنندگان برتر';
    if (location.pathname === '/reports/analysis') return 'تحلیل هوشمند';
    if (location.pathname === '/reports/analysis/profitability') return 'گزارش سودآوری کالاها';
    if (location.pathname === '/reports/analysis/inventory') return 'تحلیل وضعیت انبار';
    if (location.pathname === '/reports/analysis/suggestions') return 'پیشنهادهای هوشمند خرید';
    
    if (location.pathname === '/') return SIDEBAR_ITEMS.find(item => item.id === 'dashboard')?.name || 'داشبورد';
    
    const currentNavItem = SIDEBAR_ITEMS.find(item => item.path !== '/' && location.pathname.startsWith(item.path));
    if (currentNavItem) return currentNavItem.name;

    const pathParts = location.pathname.substring(1).split('/');
    const title = pathParts.map(part => part.charAt(0).toUpperCase() + part.slice(1).replace('-', ' ')).join(' - ');
    return title || 'داشبورد کوروش';
  };


  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 mr-72 flex flex-col transition-all duration-300 ease-in-out">
        <Header pageTitle={getCurrentPageTitle()} />
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900 print:p-0 print:bg-white">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
