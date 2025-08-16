import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom'; 
import { useAuth } from '../contexts/AuthContext'; 
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
  pageTitle: string;
}

const Header: React.FC<HeaderProps> = ({ pageTitle }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { currentUser, logout, isLoading: authProcessLoading, authReady } = useAuth(); 

  const toggleProfileMenu = () => setIsProfileMenuOpen(!isProfileMenuOpen);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login'); 
  };

  if (authProcessLoading && !authReady) {
    return (
      <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 sticky top-0 z-10">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">{pageTitle || "بارگذاری..."}</h2>
        <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 animate-pulse"></div>
      </header>
    );
  }
  
  if (authReady && !currentUser) {
     return (
      <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 sticky top-0 z-10">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">{pageTitle || "ورود به سیستم"}</h2>
      </header>
    );
  }


  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 sticky top-0 z-10">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">{pageTitle}</h2>
      
      <div className="flex-1 max-w-lg mx-auto px-4">
        <form onSubmit={handleSearchSubmit} className="relative">
          <input
            type="text"
            placeholder="جستجو در محصولات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2 border-none rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:bg-white dark:focus:bg-gray-600 focus:ring-2 focus:ring-indigo-500 text-sm outline-none text-right"
            aria-label="جستجو در محصولات"
          />
          <button type="submit" className="absolute inset-y-0 right-0 flex items-center pr-3 focus:outline-none" aria-label="شروع جستجو">
            <i className="fa-solid fa-search text-gray-400 hover:text-indigo-500"></i>
          </button>
        </form>
      </div>
      
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <div className="relative" ref={profileMenuRef}>
          {currentUser && (
            <>
              <button 
                onClick={toggleProfileMenu}
                className="flex items-center space-x-3 space-x-reverse cursor-pointer focus:outline-none p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="true"
                aria-controls="profile-menu"
              >
                <i className={`fa-solid fa-chevron-down text-gray-400 text-xs transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''} ml-2`}></i>
                <div className="hidden md:block text-right">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{currentUser.username}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{currentUser.roleName}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm overflow-hidden">
                  {currentUser.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt={currentUser.username} className="w-full h-full object-cover" />
                  ) : (
                    <i className="fa-solid fa-user"></i>
                  )}
                </div>
              </button>
              
              {isProfileMenuOpen && (
                <div 
                  id="profile-menu"
                  className="absolute left-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl py-1 z-20 border border-gray-200 dark:border-gray-700 text-right"
                  role="menu"
                >
                  <Link to="/profile" role="menuitem" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-gray-700 hover:text-indigo-600 transition-colors">
                    <i className="fas fa-user-circle ml-2 text-indigo-500"></i>پروفایل شما
                  </Link>
                  {currentUser.roleName === 'Admin' && (
                     <Link to="/settings" role="menuitem" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-gray-700 hover:text-indigo-600 transition-colors">
                      <i className="fas fa-cog ml-2 text-indigo-500"></i>تنظیمات
                    </Link>
                  )}
                  <button 
                    onClick={handleLogout} 
                    role="menuitem" 
                    className="w-full text-right block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-500/20 hover:text-red-600 transition-colors"
                  >
                    <i className="fas fa-sign-out-alt ml-2 text-red-500"></i>خروج از حساب
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
