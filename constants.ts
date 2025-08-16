import { NavItem, ChartTimeframe, PhoneStatus, RepairStatus } from './types'; // Removed StatCardData, Transaction, SalesDataPoint

export const SIDEBAR_ITEMS: NavItem[] = [
  { name: 'داشبورد', icon: 'fa-solid fa-chart-line', id: 'dashboard', path: '/' },
  { name: 'محصولات', icon: 'fa-solid fa-cube', id: 'products', path: '/products' },
  { name: 'گوشی‌های موبایل', icon: 'fa-solid fa-mobile-screen', id: 'mobile-phones', path: '/mobile-phones' },
  { name: 'مرکز تعمیرات', icon: 'fa-solid fa-screwdriver-wrench', id: 'repairs', path: '/repairs' },
  { name: 'خدمات', icon: 'fa-solid fa-bell-concierge', id: 'services', path: '/services' },
  { name: 'فروش‌ها', icon: 'fa-solid fa-cart-shopping', id: 'sales', path: '/sales' },
  { name: 'فروش اقساطی', icon: 'fa-solid fa-file-invoice-dollar', id: 'installment-sales', path: '/installment-sales' },
  { name: 'مشتریان', icon: 'fa-solid fa-users', id: 'customers', path: '/customers' },
  { name: 'همکاران', icon: 'fa-solid fa-building', id: 'partners', path: '/partners' },
  { name: 'گزارشات', icon: 'fa-solid fa-chart-pie', id: 'reports', path: '/reports' },
  { name: 'تحلیل هوشمند', icon: 'fa-solid fa-brain', id: 'smart-analysis', path: '/reports/analysis' },
  { name: 'فاکتورها', icon: 'fa-solid fa-file-invoice', id: 'invoices', path: '/invoices' },
  { id:'price-inquiry', name:'استعلام قیمت', path:'/price-inquiry', icon:'fa-solid fa-magnifying-glass-dollar' },
  { name: 'تنظیمات', icon: 'fa-solid fa-gear', id: 'settings', path: '/settings' },
];

// DASHBOARD_STATS_DATA is now fetched dynamically
// RECENT_TRANSACTIONS_DATA is now fetched dynamically as "Recent Activities"
// SALES_CHART_DATA_WEEKLY, SALES_CHART_DATA_MONTHLY, SALES_CHART_DATA_YEARLY are now fetched dynamically

export const CHART_TIMEFRAMES: ChartTimeframe[] = [
  { key: 'weekly', label: 'هفتگی' },
  { key: 'monthly', label: 'ماهانه' },
  { key: 'yearly', label: 'سالانه' },
];

// USER_PROFILE constant is removed. User info will come from AuthContext.

export const PARTNER_TYPES: { value: string; label: string }[] = [
  { value: 'Supplier', label: 'تامین‌کننده' },
  { value: 'Service Provider', label: 'ارائه‌دهنده خدمات' },
  { value: 'Technician', label: 'تعمیرکار' },
  { value: 'Other', label: 'سایر' },
];

export const PHONE_RAM_OPTIONS: string[] = ["1 GB", "2 GB", "4 GB", "6 GB", "8 GB", "12 GB", "16 GB"];
export const PHONE_STORAGE_OPTIONS: string[] = ["64 GB", "128 GB", "256 GB", "512 GB", "1 TB"];

export const PHONE_CONDITIONS: string[] = ["نو (آکبند)", "در حد نو", "کارکرده", "معیوب"];
export const PHONE_STATUSES: PhoneStatus[] = ["موجود در انبار", "فروخته شده", "مرجوعی", "فروخته شده (قسطی)"];

export const REPAIR_STATUSES: RepairStatus[] = ["پذیرش شده", "در حال بررسی", "منتظر قطعه", "در حال تعمیر", "آماده تحویل", "تحویل داده شده", "تعمیر نشد", "مرجوع شد"];