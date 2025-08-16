// src/pages/LoginPage.tsx
import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Notification from '../components/Notification';
import { NotificationMessage } from '../types';
import LoginLogoMotionV3 from "../components/LoginLogoMotionV3";



const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [notification, setNotification] = useState<NotificationMessage | null>(null);
  const { login, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setNotification(null);

    if (!username || !password) {
      setNotification({ type: 'error', text: 'نام کاربری و کلمه عبور الزامی است.' });
      return;
    }

    try {
      const response = await login({ username, password });
      if (response.success) {
        setNotification({ type: 'success', text: 'ورود با موفقیت انجام شد. در حال انتقال...' });
        setTimeout(() => navigate('/'), 1000);
      } else {
        setNotification({ type: 'error', text: response.message || 'خطا در ورود. لطفاً دوباره تلاش کنید.' });
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      let msg = 'خطا در ورود. لطفاً دوباره تلاش کنید.';
      if (err?.message) {
        const m = err.message.toLowerCase();
        if (m.includes('failed to fetch')) msg = 'خطا در ارتباط با سرور. اتصال اینترنت خود را بررسی کنید.';
        else if (m.includes('invalid credentials') || m.includes('نام کاربری یا کلمه عبور نامعتبر است')) msg = 'نام کاربری یا کلمه عبور نامعتبر است.';
        else msg = err.message;
      }
      setNotification({ type: 'error', text: msg });
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-4 text-right"
    >
      <Notification message={notification} onClose={() => setNotification(null)} />

      {/* کارت لاگین */}
      <div className="w-full max-w-md bg-white/90 backdrop-blur-md rounded-xl shadow-2xl p-8 space-y-6 transform transition-all hover:scale-[1.01]">
        {/* هدر + انیمیشن لوگو */}
        <div className="text-center">
          <LoginLogoMotionV3/>
          <h2 className="text-3xl font-bold text-gray-800">ورود به داشبورد</h2>
          <p className="text-gray-600 mt-1">لطفاً اطلاعات کاربری خود را وارد کنید.</p>
        </div>

        {/* فرم */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              نام کاربری
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 right-0 flex items-center pr-3">
                <i className="fas fa-user text-gray-400"></i>
              </span>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="appearance-none block w-full pr-10 pl-3 py-2.5 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                placeholder="نام کاربری خود را وارد کنید"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              کلمه عبور
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 right-0 flex items-center pr-3">
                <i className="fas fa-lock text-gray-400"></i>
              </span>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none block w-full pr-10 pl-3 py-2.5 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                placeholder="کلمه عبور خود را وارد کنید"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 transition-all duration-150 ease-in-out group"
          >
            {authLoading ? (
              <>
                <i className="fas fa-spinner fa-spin ml-2" />
                در حال ورود...
              </>
            ) : (
              <>
                ورود به سیستم
                <i className="fas fa-arrow-left mr-2 transform transition-transform group-hover:-translate-x-1" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 mt-6">
          &copy; {new Date().getFullYear()} فروشگاه کوروش. تمامی حقوق محفوظ است.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
