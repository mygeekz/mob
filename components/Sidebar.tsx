// Sidebar.tsx
import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { NavItem } from '../types';
import { SIDEBAR_ITEMS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import anime from 'animejs/lib/anime.es.js';

const Sidebar: React.FC = () => {
  const { currentUser, token, authReady } = useAuth();
  const location = useLocation();
  const [storeName, setStoreName] = useState('فروشگاه کوروش');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [visibleSidebarItems, setVisibleSidebarItems] = useState<NavItem[]>(SIDEBAR_ITEMS);
  const isReportSubPage = location.pathname.startsWith('/reports/');

  // refs برای مدیریت DOM آیتم‌ها و ایندیکیتورها
  const navRootRef = useRef<HTMLUListElement | null>(null);

  // فیلتر آیتم‌ها بر اساس نقش
  useEffect(() => {
    if (!authReady) return;
    if (currentUser) {
      if (currentUser.roleName === 'Salesperson') {
        const forbiddenIds = ['reports', 'smart-analysis', 'settings'];
        setVisibleSidebarItems(SIDEBAR_ITEMS.filter(item => !forbiddenIds.includes(item.id)));
      } else {
        setVisibleSidebarItems(SIDEBAR_ITEMS);
      }
    } else {
      const forbiddenIds = ['reports', 'smart-analysis', 'settings'];
      setVisibleSidebarItems(SIDEBAR_ITEMS.filter(item => !forbiddenIds.includes(item.id)));
    }
  }, [currentUser, authReady]);

  // تنظیمات فروشگاه (لوگو/نام)
  useEffect(() => {
    const fetchStoreSettings = async () => {
      if (!authReady || !currentUser || currentUser.roleName !== 'Admin' || !token) {
        setIsLoadingSettings(false);
        return;
      }
      setIsLoadingSettings(true);
      try {
        const response = await apiFetch('/api/settings');
        if (!response.ok) throw new Error(`پاسخ شبکه صحیح نبود (${response.status})`);
        const result = await response.json();
        if (result.success && result.data) {
          setStoreName(result.data.store_name || 'فروشگاه کوروش');
          setLogoUrl(result.data.store_logo_path ? `/uploads/${result.data.store_logo_path}?t=${Date.now()}` : null);
        } else {
          throw new Error(result.message || 'خطا در قالب پاسخ تنظیمات');
        }
      } catch (error) {
        console.error("خطا در دریافت تنظیمات فروشگاه برای سایدبار:", error);
        setStoreName('فروشگاه کوروش');
        setLogoUrl(null);
      } finally {
        setIsLoadingSettings(false);
      }
    };
    fetchStoreSettings();
  }, [token, currentUser, authReady]);

  // انیمیشن ورود آیتم‌های ناوبری
  useEffect(() => {
    if (!navRootRef.current) return;
    const items = navRootRef.current.querySelectorAll('.nav-item');
    anime.remove(items);
    anime({
      targets: items,
      opacity: [0, 1],
      translateY: [8, 0],
      duration: 420,
      delay: anime.stagger(40),
      easing: 'easeOutQuad'
    });
  }, [visibleSidebarItems.length]);

  // انیمیشن نشانگر فعال + هندل هاور
  useEffect(() => {
    if (!navRootRef.current) return;

    const allLinks = Array.from(navRootRef.current.querySelectorAll<HTMLAnchorElement>('.nav-item'));
    const cleanups: Array<() => void> = [];

    // helper: ایندیکیتور یک لینک را به عرض دلخواه انیمیت کن
    const animateIndicatorTo = (el: HTMLElement, widthPx: number, immediate = false) => {
      const ind = el.querySelector<HTMLElement>('.nav-indicator');
      if (!ind) return;
      anime.remove(ind);
      anime({
        targets: ind,
        width: widthPx,
        duration: immediate ? 0 : 300,
        easing: immediate ? 'linear' : 'easeOutCubic'
      });
    };

    // همهٔ ایندیکیتورها را ریست کن
    allLinks.forEach(link => animateIndicatorTo(link, 0, true));

    // فعال را پیدا کن و ایندیکیتورش را پر کن
    const active = allLinks.find(a => a.classList.contains('nav-active') || a.getAttribute('aria-current') === 'page');
    if (active) {
      // طول را تا عرض متن انیمیت کن
      const label = active.querySelector('.nav-label') as HTMLElement | null;
      const targetWidth = Math.min((label?.offsetWidth || 0), active.clientWidth - 24);
      animateIndicatorTo(active, targetWidth);
    }

    // هاور: ایندیکیتور را پر/خالی کن، مستقل از فعال
    allLinks.forEach(link => {
      const onEnter = () => {
        const label = link.querySelector('.nav-label') as HTMLElement | null;
        const targetWidth = Math.min((label?.offsetWidth || 0), link.clientWidth - 24);
        animateIndicatorTo(link, targetWidth);
      };
      const onLeave = () => {
        // اگر لینک فعال نیست، برگردان به 0
        const isActive = link.classList.contains('nav-active') || link.getAttribute('aria-current') === 'page';
        if (!isActive) animateIndicatorTo(link, 0);
      };
      link.addEventListener('mouseenter', onEnter);
      link.addEventListener('mouseleave', onLeave);
      cleanups.push(() => {
        link.removeEventListener('mouseenter', onEnter);
        link.removeEventListener('mouseleave', onLeave);
      });
    });

    return () => {
      cleanups.forEach(fn => fn());
      anime.remove(allLinks.map(a => a.querySelector('.nav-indicator')).filter(Boolean) as Element[]);
    };
  }, [location.pathname]);

  return (
    <div className="w-72 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col fixed h-full right-0 print:hidden">
      <div className="h-16 flex items-center justify-start px-4 border-b border-gray-200 dark:border-gray-700 gap-3">
        {isLoadingSettings ? (
          <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-md" />
        ) : logoUrl ? (
          <img src={logoUrl} alt="لوگو" className="h-10 w-10 object-contain rounded-md" />
        ) : (
          <div className="h-10 w-10 bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center rounded-md">
            <i className="fa-solid fa-store text-indigo-600 text-xl" />
          </div>
        )}
        <h1 className="text-xl font-bold text-indigo-600">{storeName}</h1>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul ref={navRootRef} className="space-y-1 px-3">
          {visibleSidebarItems.map((item: NavItem) => (
            <li key={item.id}>
              <NavLink
                to={item.path}
                className={({ isActive }) => {
                  const isParentActive =
                    (item.id === 'reports' && location.pathname.startsWith('/reports/') && !location.pathname.startsWith('/reports/analysis')) ||
                    (item.id === 'smart-analysis' && location.pathname.startsWith('/reports/analysis'));

                  const active = isActive || isParentActive;
                  return [
                    'nav-item relative flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg whitespace-nowrap cursor-pointer text-right overflow-hidden',
                    active
                      ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 nav-active'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                  ].join(' ');
                }}
              >
                <i className={`${item.icon} w-5 h-5 ml-3 text-base`} />
                <span className="nav-label">{item.name}</span>

                {/* ایندیکیتور پایین هر آیتم */}
                <span
                  className="nav-indicator absolute bottom-1 right-4 h-[2px] bg-indigo-500 dark:bg-indigo-300 rounded-full"
                  style={{ width: 0 }}
                />
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="bg-indigo-50 dark:bg-indigo-900/50 p-4 rounded-lg text-right">
          <h3 className="text-sm font-medium text-indigo-800 dark:text-indigo-200">نیاز به کمک دارید؟</h3>
          <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">با تیم پشتیبانی ما تماس بگیرید</p>
          <a
            href="tel:09361583838"
            className="mt-3 w-full block text-center bg-indigo-600 text-white py-2 px-4 text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            تماس با پشتیبانی (۰۹۳۶۱۵۸۳۸۳۸)
          </a>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
