import React, { useEffect, useState, useRef, ChangeEvent, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AuthUser, NotificationMessage, ChangePasswordPayload } from '../types';
import Notification from '../components/Notification';
import Modal from '../components/Modal';
import { formatIsoToShamsiDateTime } from '../utils/dateUtils';
import { apiFetch } from '../utils/apiFetch';

const ProfilePage: React.FC = () => {
  const { currentUser: contextUser, isLoading: authProcessLoading, authReady, updateCurrentUser } = useAuth();
  
  const [profileData, setProfileData] = useState<AuthUser | null>(contextUser);
  const [notification, setNotification] = useState<NotificationMessage | null>(null);

  // Avatar states
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(contextUser?.avatarUrl || null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  // Password Change states
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ oldPassword: '', newPassword: '', confirmNewPassword: '' });
  const [passwordErrors, setPasswordErrors] = useState<Partial<typeof passwordData>>({});


  useEffect(() => {
    // This effect ensures the local profile data and avatar preview are
    // synchronized with the authentication context.
    if (contextUser) {
      setProfileData(contextUser);
      setAvatarPreview(contextUser.avatarUrl || null);
    }
  }, [contextUser]);

  const handleAvatarFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        setNotification({ type: 'error', text: 'حجم فایل آواتار نباید بیشتر از 2 مگابایت باشد.' });
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
        setNotification({ type: 'error', text: 'فرمت فایل آواتار نامعتبر است. (مجاز: JPG, PNG, GIF)' });
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;
    setIsUploadingAvatar(true);
    setNotification(null);
    const formData = new FormData();
    formData.append('avatar', avatarFile);

    try {
      const response = await apiFetch('/api/me/upload-avatar', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'خطا در آپلود آواتار');
      
      setNotification({ type: 'success', text: 'آواتار با موفقیت به‌روزرسانی شد.' });
      updateCurrentUser({ avatarUrl: result.data.avatarUrl }); // Update context
      setAvatarFile(null); // Clear the file selection
    } catch (error: any) {
      setNotification({ type: 'error', text: error.message });
      setAvatarPreview(profileData?.avatarUrl || null); // Revert preview on error
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handlePasswordInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({...prev, [name]: value}));
    if (passwordErrors[name as keyof typeof passwordErrors]) {
        setPasswordErrors(prev => ({...prev, [name]: undefined}));
    }
  };

  const validatePasswordForm = (): boolean => {
    const errors: Partial<typeof passwordData> = {};
    if (!passwordData.oldPassword) errors.oldPassword = "کلمه عبور فعلی الزامی است.";
    if (!passwordData.newPassword) errors.newPassword = "کلمه عبور جدید الزامی است.";
    else if (passwordData.newPassword.length < 6) errors.newPassword = "کلمه عبور جدید باید حداقل ۶ کاراکتر باشد.";
    if (passwordData.newPassword !== passwordData.confirmNewPassword) errors.confirmNewPassword = "کلمه عبور جدید و تکرار آن یکسان نیستند.";
    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!validatePasswordForm()) return;
    setIsChangingPassword(true);
    setNotification(null);
    try {
        const payload: ChangePasswordPayload = {
            oldPassword: passwordData.oldPassword,
            newPassword: passwordData.newPassword,
        };
        const response = await apiFetch('/api/me/change-password', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'خطا در تغییر کلمه عبور');

        setNotification({ type: 'success', text: 'کلمه عبور با موفقیت تغییر کرد.'});
        setIsPasswordModalOpen(false);
        setPasswordData({ oldPassword: '', newPassword: '', confirmNewPassword: '' });

    } catch (error: any) {
        if (error.message.toLowerCase().includes('فعلی نامعتبر')) {
            setPasswordErrors(prev => ({...prev, oldPassword: error.message}));
        } else {
            setNotification({ type: 'error', text: error.message});
        }
    } finally {
        setIsChangingPassword(false);
    }
  };

  if (!authReady || authProcessLoading) {
    return <div className="p-6 text-center text-gray-500"><i className="fas fa-spinner fa-spin text-2xl mr-2"></i> در حال بارگذاری اطلاعات پروفایل...</div>;
  }
  if (!profileData) {
    return <div className="p-6 text-center text-red-500">اطلاعات پروفایل کاربر یافت نشد. لطفاً دوباره وارد شوید.</div>;
  }

  const inputClass = (hasError?: boolean) => `w-full p-2.5 border rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right ${hasError ? 'border-red-500' : 'border-gray-300'}`;
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <Notification message={notification} onClose={() => setNotification(null)} />
      
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 pb-4 border-b">پروفایل کاربری</h1>

        {/* Avatar Section */}
        <div className="flex flex-col items-center space-y-4 mb-8">
            <div className="relative group">
                <div 
                    className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-5xl shadow-md overflow-hidden cursor-pointer"
                    onClick={() => avatarInputRef.current?.click()}
                    title="تغییر آواتار"
                >
                    {avatarPreview ? (
                        <img src={avatarPreview} alt="آواتار" className="w-full h-full object-cover" />
                    ) : (
                        <i className="fas fa-user"></i>
                    )}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 flex items-center justify-center transition-all duration-300">
                        <i className="fas fa-camera text-white text-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></i>
                    </div>
                </div>
                <input type="file" accept="image/png, image/jpeg, image/gif" ref={avatarInputRef} onChange={handleAvatarFileChange} hidden/>
            </div>
            {avatarFile && (
                <button 
                    onClick={handleAvatarUpload}
                    disabled={isUploadingAvatar}
                    className="px-4 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 disabled:bg-green-300 transition-colors"
                >
                    {isUploadingAvatar ? (<><i className="fas fa-spinner fa-spin mr-2"></i>در حال آپلود...</>) : 'ذخیره آواتار جدید'}
                </button>
            )}
        </div>


        {/* Profile Info Section */}
        <div className="space-y-4 text-gray-700 mb-8">
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

        {/* Change Password Section */}
        <div className="mt-10 pt-6 border-t border-gray-200">
            <button 
                type="button"
                onClick={() => setIsPasswordModalOpen(true)}
                className="w-full px-6 py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-colors"
            >
                <i className="fas fa-key ml-2"></i>
                تغییر کلمه عبور
            </button>
        </div>
      </div>

      {isPasswordModalOpen && (
        <Modal title="تغییر کلمه عبور" onClose={() => setIsPasswordModalOpen(false)} widthClass="max-w-md">
            <form onSubmit={handleChangePassword} className="space-y-4 p-1">
                <div>
                    <label htmlFor="oldPassword" className={labelClass}>کلمه عبور فعلی</label>
                    <input type="password" id="oldPassword" name="oldPassword" value={passwordData.oldPassword} onChange={handlePasswordInputChange} className={inputClass(!!passwordErrors.oldPassword)} required />
                    {passwordErrors.oldPassword && <p className="text-xs text-red-600 mt-1">{passwordErrors.oldPassword}</p>}
                </div>
                 <div>
                    <label htmlFor="newPassword" className={labelClass}>کلمه عبور جدید</label>
                    <input type="password" id="newPassword" name="newPassword" value={passwordData.newPassword} onChange={handlePasswordInputChange} className={inputClass(!!passwordErrors.newPassword)} required />
                    {passwordErrors.newPassword && <p className="text-xs text-red-600 mt-1">{passwordErrors.newPassword}</p>}
                </div>
                 <div>
                    <label htmlFor="confirmNewPassword" className={labelClass}>تکرار کلمه عبور جدید</label>
                    <input type="password" id="confirmNewPassword" name="confirmNewPassword" value={passwordData.confirmNewPassword} onChange={handlePasswordInputChange} className={inputClass(!!passwordErrors.confirmNewPassword)} required />
                    {passwordErrors.confirmNewPassword && <p className="text-xs text-red-600 mt-1">{passwordErrors.confirmNewPassword}</p>}
                </div>
                <div className="flex justify-end pt-3 space-x-3 space-x-reverse border-t mt-4">
                    <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">انصراف</button>
                    <button type="submit" disabled={isChangingPassword} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400">
                        {isChangingPassword ? (<><i className="fas fa-spinner fa-spin mr-2"></i>در حال تغییر...</>) : 'ثبت تغییرات'}
                    </button>
                </div>
            </form>
        </Modal>
      )}
    </div>
  );
};

export default ProfilePage;
