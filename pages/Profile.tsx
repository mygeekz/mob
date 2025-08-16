import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AuthUser, NotificationMessage } from '../types';
import Notification from '../components/Notification';
import { formatIsoToShamsiDateTime } from '../utils/dateUtils'; // Ensure this utility exists

const ProfilePage: React.FC = () => {
  const { currentUser: contextUser, token } = useAuth();
  const [profileData, setProfileData] = useState<AuthUser | null>(contextUser);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<NotificationMessage | null>(null);

  useEffect(() => {
    if (!contextUser && token) { // If contextUser is null but token exists, try fetching
      const fetchProfile = async () => {
        setIsLoading(true);
        setNotification(null);
        try {
          const response = await fetch('/api/me', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const result = await response.json();
          if (!response.ok || !result.success) {
            throw new Error(result.message || 'خطا در دریافت اطلاعات پروفایل');
          }
          setProfileData(result.user);
        } catch (error: any) {
          setNotification({ type: 'error', text: error.message });
        } finally {
          setIsLoading(false);
        }
      };
      fetchProfile();
    } else {
      setProfileData(contextUser); // Use user from context if available
    }
  }, [contextUser, token]);

  if (isLoading) {
    return <div className="p-6 text-center text-gray-500"><i className="fas fa-spinner fa-spin text-2xl mr-2"></i> در حال بارگذاری اطلاعات پروفایل...</div>;
  }

  if (!profileData) {
    return <div className="p-6 text-center text-red-500">اطلاعات پروفایل کاربر یافت نشد. لطفاً دوباره وارد شوید.</div>;
  }

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <Notification message={notification} onClose={() => setNotification(null)} />
      
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl mx-auto">
        <div className="flex items-center space-x-6 space-x-reverse mb-8 pb-6 border-b border-gray-200">
          <div className="w-24 h-24 rounded-full bg-indigo-500 flex items-center justify-center text-white text-4xl shadow-md">
            <i className="fas fa-user"></i>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{profileData.username}</h1>
            <p className="text-md text-indigo-600">{profileData.roleName}</p>
          </div>
        </div>

        <div className="space-y-4 text-gray-700">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="font-medium">شناسه کاربر:</span>
            <span className="text-gray-900">{profileData.id.toLocaleString('fa-IR')}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="font-medium">نام کاربری:</span>
            <span className="text-gray-900">{profileData.username}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="font-medium">نقش:</span>
            <span className="text-gray-900">{profileData.roleName}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="font-medium">تاریخ عضویت:</span>
            <span className="text-gray-900">{profileData.dateAdded ? formatIsoToShamsiDateTime(profileData.dateAdded) : 'نامشخص'}</span>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200">
            {/* Placeholder for password change - Functionality can be added later */}
            <button 
                type="button"
                className="w-full px-6 py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-colors disabled:opacity-50"
                disabled // Remove disabled when implementing
            >
                <i className="fas fa-key ml-2"></i>
                تغییر کلمه عبور (به زودی)
            </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
