import React, { useState, useEffect, FormEvent, ChangeEvent, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BusinessInformationSettings, NotificationMessage, Role, UserForDisplay, NewUserFormData, EditUserFormData } from '../types';
import Notification from '../components/Notification';
import Modal from '../components/Modal';
import { formatIsoToShamsiDateTime } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/apiFetch';


const Settings: React.FC = () => {
  const { currentUser, token } = useAuth();
  const navigate = useNavigate();

  const [businessInfo, setBusinessInfo] = useState<BusinessInformationSettings>({});
  const [initialBusinessInfo, setInitialBusinessInfo] = useState<BusinessInformationSettings>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [notification, setNotification] = useState<NotificationMessage | null>(null);

  const [dbFile, setDbFile] = useState<File | null>(null);
  const [isRestoringDb, setIsRestoringDb] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const dbFileInputRef = useRef<HTMLInputElement>(null);

  // User Management State
  const [users, setUsers] = useState<UserForDisplay[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const initialNewUserState: NewUserFormData = { username: '', password: '', confirmPassword: '', roleId: '' };
  const [newUser, setNewUser] = useState<NewUserFormData>(initialNewUserState);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [addUserFormErrors, setAddUserFormErrors] = useState<Partial<NewUserFormData>>({});

  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<EditUserFormData | null>(null);
  const [editUserFormErrors, setEditUserFormErrors] = useState<Partial<EditUserFormData>>({});
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [resettingUser, setResettingUser] = useState<UserForDisplay | null>(null);
  const [resetPasswordData, setResetPasswordData] = useState({ password: '', confirmPassword: '' });
  const [resetPasswordErrors, setResetPasswordErrors] = useState<Partial<typeof resetPasswordData>>({});
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  const [isDeleteUserModalOpen, setIsDeleteUserModalOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserForDisplay | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  useEffect(() => {
    if (currentUser && currentUser.roleName !== 'Admin') {
      setNotification({ type: 'error', text: 'شما اجازه دسترسی به این صفحه را ندارید.' });
      navigate('/');
    } else {
      fetchData();
    }
  }, [currentUser, navigate]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [settingsRes, usersRes, rolesRes] = await Promise.all([
        apiFetch('/api/settings'),
        apiFetch('/api/users'),
        apiFetch('/api/roles')
      ]);

      const settingsResult = await settingsRes.json();
      if (!settingsRes.ok || !settingsResult.success) throw new Error(settingsResult.message || 'خطا در دریافت تنظیمات');
      setBusinessInfo(settingsResult.data);
      setInitialBusinessInfo(settingsResult.data);
      if (settingsResult.data.store_logo_path) {
        setLogoPreview(`/uploads/${settingsResult.data.store_logo_path}?t=${new Date().getTime()}`);
      }

      const usersResult = await usersRes.json();
      if (!usersRes.ok || !usersResult.success) throw new Error(usersResult.message || 'خطا در دریافت کاربران');
      setUsers(usersResult.data);

      const rolesResult = await rolesRes.json();
      if (!rolesRes.ok || !rolesResult.success) throw new Error(rolesResult.message || 'خطا در دریافت نقش‌ها');
      const sortedRoles = rolesResult.data.sort((a: Role, b: Role) => a.name === 'Admin' ? -1 : 1);
      setRoles(sortedRoles);
      if (sortedRoles.length > 0 && newUser.roleId === '') {
        setNewUser(prev => ({ ...prev, roleId: sortedRoles[0].id }));
      }
    } catch (error: any) {
      setNotification({ type: 'error', text: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBusinessInfoChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setBusinessInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleBusinessInfoSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setNotification(null);
    try {
      const response = await apiFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify(businessInfo),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'خطا در ذخیره اطلاعات');
      setNotification({ type: 'success', text: 'تنظیمات با موفقیت ذخیره شد.' });
      setInitialBusinessInfo(businessInfo);
    } catch (error: any) {
      setNotification({ type: 'error', text: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  // --- All other handlers for Logo, Backup/Restore, User Management ---
    const handleLogoFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 2 * 1024 * 1024) { setNotification({ type: 'error', text: 'حجم فایل لوگو نباید بیشتر از 2 مگابایت باشد.' }); return; }
            if (!['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'].includes(file.type)) { setNotification({ type: 'error', text: 'فرمت فایل لوگو نامعتبر است. (مجاز: JPG, PNG, GIF, SVG, WebP)' }); return; }
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleLogoUpload = async () => {
        if (!logoFile) return;
        setIsUploadingLogo(true);
        const formData = new FormData();
        formData.append('logo', logoFile);
        try {
            const response = await apiFetch('/api/settings/upload-logo', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message);
            setNotification({ type: 'success', text: 'لوگو با موفقیت آپلود شد.' });
            setBusinessInfo(prev => ({ ...prev, store_logo_path: result.data.filePath.replace('/uploads/', '') }));
            setLogoFile(null);
        } catch (error: any) {
            setNotification({ type: 'error', text: error.message });
        } finally {
            setIsUploadingLogo(false);
        }
    };
    
    const handleBackup = async () => {
        setNotification({ type: 'info', text: 'در حال آماده‌سازی فایل پشتیبان...' });
        try {
            const response = await apiFetch('/api/settings/backup');
            if (!response.ok) throw new Error((await response.json()).message || 'خطا در دانلود');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `kourosh_dashboard_backup_${new Date().toISOString().split('T')[0]}.db`;
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            setNotification({ type: 'success', text: 'فایل پشتیبان با موفقیت دانلود شد.' });
        } catch (error: any) {
            setNotification({ type: 'error', text: error.message });
        }
    };

    const handleDbFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.name.split('.').pop()?.toLowerCase() !== 'db') {
                setNotification({ type: 'error', text: 'فایل انتخاب شده باید با فرمت .db باشد.' });
                if (dbFileInputRef.current) dbFileInputRef.current.value = "";
                setDbFile(null);
                return;
            }
            setDbFile(file);
            setIsRestoreModalOpen(true);
        }
    };

    const handleRestore = async () => {
        if (!dbFile) return;
        setIsRestoreModalOpen(false);
        setIsRestoringDb(true);
        const formData = new FormData();
        formData.append('dbfile', dbFile);
        try {
            const response = await apiFetch('/api/settings/restore', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message);
            setNotification({ type: 'success', text: result.message + " لطفاً برای اعمال تغییرات، برنامه را ببندید و مجدداً باز کنید." });
        } catch (error: any) {
            setNotification({ type: 'error', text: error.message });
        } finally {
            setIsRestoringDb(false);
            setDbFile(null);
            if (dbFileInputRef.current) dbFileInputRef.current.value = "";
        }
    };
    
    // User management handlers...
    const openAddUserModal = () => { setAddUserFormErrors({}); setNewUser(initialNewUserState); setIsAddUserModalOpen(true); };
    const handleNewUserChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setNewUser(prev => ({ ...prev, [e.target.name]: e.target.value })); };
    const handleNewUserSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const errors: Partial<NewUserFormData> = {};
        if (!newUser.username.trim()) errors.username = "نام کاربری الزامی است.";
        if (!newUser.password) errors.password = "کلمه عبور الزامی است.";
        else if (newUser.password.length < 6) errors.password = "کلمه عبور باید حداقل ۶ کاراکتر باشد.";
        if (newUser.password !== newUser.confirmPassword) errors.confirmPassword = "کلمه عبور و تکرار آن یکسان نیستند.";
        if (Object.keys(errors).length > 0) { setAddUserFormErrors(errors); return; }

        setIsSavingUser(true);
        try {
            await apiFetch('/api/users', { method: 'POST', body: JSON.stringify(newUser) });
            setNotification({ type: 'success', text: 'کاربر با موفقیت ایجاد شد.' });
            setIsAddUserModalOpen(false);
            fetchData();
        } catch (error: any) {
            setNotification({ type: 'error', text: error.message });
        } finally {
            setIsSavingUser(false);
        }
    };

    const openEditUserModal = (user: UserForDisplay) => { setEditingUser({ id: user.id, username: user.username, roleId: user.roleId }); setEditUserFormErrors({}); setIsEditUserModalOpen(true); };
    const handleEditUserChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { if(editingUser) setEditingUser(prev => prev ? ({ ...prev, [e.target.name]: e.target.value }) : null); };
    const handleEditUserSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        setIsUpdatingUser(true);
        try {
            await apiFetch(`/api/users/${editingUser.id}`, { method: 'PUT', body: JSON.stringify({ roleId: Number(editingUser.roleId) }) });
            setNotification({ type: 'success', text: 'نقش کاربر ویرایش شد.' });
            setIsEditUserModalOpen(false);
            fetchData();
        } catch (error: any) {
            setNotification({ type: 'error', text: error.message });
        } finally {
            setIsUpdatingUser(false);
        }
    };
    
    const openResetPasswordModal = (user: UserForDisplay) => { setResettingUser(user); setResetPasswordData({ password: '', confirmPassword: '' }); setResetPasswordErrors({}); setIsResetPasswordModalOpen(true); };
    const handleResetPasswordSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!resettingUser) return;
        if (resetPasswordData.password.length < 6) { setResetPasswordErrors({ password: "کلمه عبور باید حداقل ۶ کاراکتر باشد." }); return; }
        if (resetPasswordData.password !== resetPasswordData.confirmPassword) { setResetPasswordErrors({ confirmPassword: "کلمه‌های عبور یکسان نیستند." }); return; }
        
        setIsSubmittingReset(true);
        try {
            await apiFetch(`/api/users/${resettingUser.id}/reset-password`, { method: 'POST', body: JSON.stringify({ password: resetPasswordData.password }) });
            setNotification({ type: 'success', text: `کلمه عبور کاربر ${resettingUser.username} بازنشانی شد.` });
            setIsResetPasswordModalOpen(false);
        } catch (error: any) {
            setNotification({ type: 'error', text: error.message });
        } finally {
            setIsSubmittingReset(false);
        }
    };

    const openDeleteUserModal = (user: UserForDisplay) => { setDeletingUser(user); setIsDeleteUserModalOpen(true); };
    const handleDeleteUser = async () => {
        if (!deletingUser) return;
        setIsDeletingUser(true);
        try {
            await apiFetch(`/api/users/${deletingUser.id}`, { method: 'DELETE' });
            setNotification({ type: 'success', text: `کاربر ${deletingUser.username} حذف شد.` });
            setIsDeleteUserModalOpen(false);
            fetchData();
        } catch (error: any) {
            setNotification({ type: 'error', text: error.message });
        } finally {
            setIsDeletingUser(false);
        }
    };


  const infoChanged = JSON.stringify(businessInfo) !== JSON.stringify(initialBusinessInfo);
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2";
  const inputClass = "w-full p-2 border border-gray-300 rounded-md dark:bg-gray-900/50 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500";
  const fieldsetLegendClass = "px-2 text-base font-semibold text-gray-800 dark:text-gray-200";
  const fieldsetClass = "border border-gray-200 dark:border-gray-700 rounded-lg p-4 mt-6";


  if (isLoading) {
      return <div className="p-10 text-center text-gray-500"><i className="fas fa-spinner fa-spin text-3xl mb-3"></i><p>در حال بارگذاری تنظیمات...</p></div>
  }
  
  if (currentUser && currentUser.roleName !== 'Admin') {
    return <div className="p-6 text-center text-red-500 bg-red-50 rounded-lg"><i className="fas fa-exclamation-triangle text-3xl mb-3"></i><p>شما اجازه دسترسی به صفحه تنظیمات را ندارید.</p></div>
  }

  return (
    <div className="space-y-8 text-right" dir="rtl">
        <Notification message={notification} onClose={() => setNotification(null)} />
        
        <div className="relative pb-24">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* --- Left Column: Main Settings Card --- */}
                <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg">
                        <form id="settings-form" onSubmit={handleBusinessInfoSubmit}>
                            <div className="p-6 lg:p-8">
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">تنظیمات اصلی و پنل پیامک</h2>
                                
                                <fieldset className={fieldsetClass}>
                                    <legend className={fieldsetLegendClass}>اطلاعات کسب‌وکار</legend>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                        <div><label htmlFor="store_name" className={labelClass}>نام فروشگاه</label><input type="text" id="store_name" name="store_name" value={businessInfo.store_name || ''} onChange={handleBusinessInfoChange} className={inputClass} /></div>
                                        <div><label htmlFor="store_phone" className={labelClass}>تلفن فروشگاه</label><input type="text" id="store_phone" name="store_phone" value={businessInfo.store_phone || ''} onChange={handleBusinessInfoChange} className={inputClass} dir="ltr" /></div>
                                        <div><label htmlFor="store_email" className={labelClass}>ایمیل فروشگاه</label><input type="email" id="store_email" name="store_email" value={businessInfo.store_email || ''} onChange={handleBusinessInfoChange} className={inputClass} dir="ltr" /></div>
                                        <div><label htmlFor="store_address_line1" className={labelClass}>آدرس - خط ۱</label><input type="text" id="store_address_line1" name="store_address_line1" value={businessInfo.store_address_line1 || ''} onChange={handleBusinessInfoChange} className={inputClass} /></div>
                                        <div><label htmlFor="store_address_line2" className={labelClass}>آدرس - خط ۲</label><input type="text" id="store_address_line2" name="store_address_line2" value={businessInfo.store_address_line2 || ''} onChange={handleBusinessInfoChange} className={inputClass} /></div>
                                        <div><label htmlFor="store_city_state_zip" className={labelClass}>شهر، استان، کدپستی</label><input type="text" id="store_city_state_zip" name="store_city_state_zip" value={businessInfo.store_city_state_zip || ''} onChange={handleBusinessInfoChange} className={inputClass} /></div>
                                        <div className="md:col-span-2"><label className={labelClass}>لوگوی فروشگاه</label>
                                            <div className="flex items-center gap-4">
                                                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center overflow-hidden border dark:border-gray-600"><img src={logoPreview || ''} alt=" " className="w-full h-full object-contain" /></div>
                                                <input type="file" ref={logoInputRef} onChange={handleLogoFileChange} accept="image/*" className="hidden" />
                                                <button type="button" onClick={() => logoInputRef.current?.click()} className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">انتخاب فایل</button>
                                                {logoFile && <button type="button" onClick={handleLogoUpload} disabled={isUploadingLogo} className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-green-300">{isUploadingLogo ? 'درحال آپلود...' : 'آپلود'}</button>}
                                            </div>
                                        </div>
                                    </div>
                                </fieldset>

                                <hr className="my-8 border-gray-200 dark:border-gray-700" />
                                
                                {/* ─────────────── تنظیمات پنل پیامک ─────────────── */}
								<fieldset className={fieldsetClass}>
								  <legend className={fieldsetLegendClass}>تنظیمات پنل پیامک</legend>

								  {/* نام کاربری / رمز عبور */}
								  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
									<div>
									  <label htmlFor="meli_payamak_username" className={labelClass}>
										نام کاربری ملی پیامک
									  </label>
									  <input
										type="text"
										id="meli_payamak_username"
										name="meli_payamak_username"
										value={businessInfo.meli_payamak_username || ''}
										onChange={handleBusinessInfoChange}
										className={inputClass}
										dir="ltr"
									  />
									</div>

									<div>
									  <label htmlFor="meli_payamak_password" className={labelClass}>
										کلمه عبور ملی پیامک
									  </label>
									  <input
										type="password"
										id="meli_payamak_password"
										name="meli_payamak_password"
										value={businessInfo.meli_payamak_password || ''}
										onChange={handleBusinessInfoChange}
										className={inputClass}
										dir="ltr"
									  />
									</div>
								  </div>

								  {/* الگوها */}
								  <details className="mt-4 text-sm text-gray-600 dark:text-gray-400 open:pb-2">
									<summary className="cursor-pointer font-medium">مشاهده الگوهای پیامک</summary>

									<div className="space-y-6 pt-4">
									  {/* الگوهای فروش اقساطی (کامل) */}
								<div className="p-4 border rounded-md dark:border-gray-600">
								  <h4 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">
									الگوهای فروش اقساطی
								  </h4>

								  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									{/* 1) خوشامدِ ثبت قرارداد */}
									<div>
									  <label
										htmlFor="meli_payamak_installment_welcome_pattern_id"
										className={labelClass}
									  >
										ثبت قرارداد | خوشامد
									  </label>
									  <input
										type="number"
										id="meli_payamak_installment_welcome_pattern_id"
										name="meli_payamak_installment_welcome_pattern_id"
										value={businessInfo.meli_payamak_installment_welcome_pattern_id || ''}
										onChange={handleBusinessInfoChange}
										className={inputClass}
										dir="ltr"
									  />
									  <p className="text-xs text-gray-500 mt-1">
										متغیرها: <code>name</code>، <code>total</code>، <code>firstDue</code>
									  </p>
									</div>

									{/* 2) یادآوری ۳ روز قبل */}
									<div>
									  <label
										htmlFor="meli_payamak_installment_pre_due_pattern_id"
										className={labelClass}
									  >
										یادآوری ۳ روز قبل
									  </label>
									  <input
										type="number"
										id="meli_payamak_installment_pre_due_pattern_id"
										name="meli_payamak_installment_pre_due_pattern_id"
										value={businessInfo.meli_payamak_installment_pre_due_pattern_id || ''}
										onChange={handleBusinessInfoChange}
										className={inputClass}
										dir="ltr"
									  />
									  <p className="text-xs text-gray-500 mt-1">
										متغیرها: <code>name</code>، <code>amount</code>، <code>due</code>
									  </p>
									</div>

									{/* 3) یادآوری روز سررسید */}
									<div>
									  <label
										htmlFor="meli_payamak_installment_due_day_pattern_id"
										className={labelClass}
									  >
										یادآوری روز سررسید
									  </label>
									  <input
										type="number"
										id="meli_payamak_installment_due_day_pattern_id"
										name="meli_payamak_installment_due_day_pattern_id"
										value={businessInfo.meli_payamak_installment_due_day_pattern_id || ''}
										onChange={handleBusinessInfoChange}
										className={inputClass}
										dir="ltr"
									  />
									  <p className="text-xs text-gray-500 mt-1">
										متغیرها: <code>name</code>، <code>amount</code>، <code>due</code>
									  </p>
									</div>

									{/* 4) تأیید دریافت وجه (قبلاً وجود داشت) */}
									<div>
									  <label
										htmlFor="meli_payamak_payment_confirmation_pattern_id"
										className={labelClass}
									  >
										تأیید دریافت وجه
									  </label>
									  <input
										type="number"
										id="meli_payamak_payment_confirmation_pattern_id"
										name="meli_payamak_payment_confirmation_pattern_id"
										value={businessInfo.meli_payamak_payment_confirmation_pattern_id || ''}
										onChange={handleBusinessInfoChange}
										className={inputClass}
										dir="ltr"
									  />
									  <p className="text-xs text-gray-500 mt-1">
										متغیرها: <code>name</code>، <code>amount</code>, <code>paidDate</code>
									  </p>
									</div>

									{/* 5) هشدار تأخیر ۲ روز پس از سررسید */}
									<div>
									  <label
										htmlFor="meli_payamak_installment_late_alert_pattern_id"
										className={labelClass}
									  >
										هشدار تأخیر (۲ روز)
									  </label>
									  <input
										type="number"
										id="meli_payamak_installment_late_alert_pattern_id"
										name="meli_payamak_installment_late_alert_pattern_id"
										value={businessInfo.meli_payamak_installment_late_alert_pattern_id || ''}
										onChange={handleBusinessInfoChange}
										className={inputClass}
										dir="ltr"
									  />
									  <p className="text-xs text-gray-500 mt-1">
										متغیرها: <code>name</code>، <code>amount</code>، <code>daysLate</code>
									  </p>
									</div>

									{/* 6) تبریک تسویه کامل */}
									<div>
									  <label
										htmlFor="meli_payamak_installment_settled_pattern_id"
										className={labelClass}
									  >
										تبریک پایان بدهی
									  </label>
									  <input
										type="number"
										id="meli_payamak_installment_settled_pattern_id"
										name="meli_payamak_installment_settled_pattern_id"
										value={businessInfo.meli_payamak_installment_settled_pattern_id || ''}
										onChange={handleBusinessInfoChange}
										className={inputClass}
										dir="ltr"
									  />
									  <p className="text-xs text-gray-500 mt-1">
										متغیرها: <code>name</code>، <code>date</code>
									  </p>
									</div>
								  </div>
								</div>


									  {/* تعمیرات */}
									  <div className="p-4 border rounded-md dark:border-gray-600">
										<h4 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">
										  الگوهای ماژول تعمیرات
										</h4>

										<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
										  <div>
											<label
											  htmlFor="meli_payamak_repair_received_pattern_id"
											  className={labelClass}
											>
											  الگوی تأیید پذیرش
											</label>
											<input
											  type="number"
											  id="meli_payamak_repair_received_pattern_id"
											  name="meli_payamak_repair_received_pattern_id"
											  value={businessInfo.meli_payamak_repair_received_pattern_id || ''}
											  onChange={handleBusinessInfoChange}
											  className={inputClass}
											  dir="ltr"
											/>
										  </div>

										  <div>
											<label
											  htmlFor="meli_payamak_repair_cost_estimated_pattern_id"
											  className={labelClass}
											>
											  الگوی اعلام هزینه
											</label>
											<input
											  type="number"
											  id="meli_payamak_repair_cost_estimated_pattern_id"
											  name="meli_payamak_repair_cost_estimated_pattern_id"
											  value={businessInfo.meli_payamak_repair_cost_estimated_pattern_id || ''}
											  onChange={handleBusinessInfoChange}
											  className={inputClass}
											  dir="ltr"
											/>
										  </div>

										  <div>
											<label
											  htmlFor="meli_payamak_repair_ready_pattern_id"
											  className={labelClass}
											>
											  الگوی آماده تحویل
											</label>
											<input
											  type="number"
											  id="meli_payamak_repair_ready_pattern_id"
											  name="meli_payamak_repair_ready_pattern_id"
											  value={businessInfo.meli_payamak_repair_ready_pattern_id || ''}
											  onChange={handleBusinessInfoChange}
											  className={inputClass}
											  dir="ltr"
											/>
										  </div>
										</div>
									  </div>
									</div>
								  </details>
								</fieldset>
                            </div>
                        </form>
                    </div>
                </div>

                {/* --- Right Column: User & Data Cards --- */}
                <div className="space-y-8">
                    {/* Card 2: User Management */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                        <div className="flex justify-between items-center mb-4 pb-4 border-b dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">مدیریت کاربران</h3>
                            <button onClick={openAddUserModal} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"><i className="fas fa-plus ml-2"></i>افزودن کاربر</button>
                        </div>
                        <div className="overflow-x-auto">
                           <table className="min-w-full text-sm">
                                <thead className="text-gray-600 dark:text-gray-400"><tr><th className="py-2 text-right">نام کاربری</th><th className="py-2 text-right">نقش</th><th className="py-2 text-center">عملیات</th></tr></thead>
                                <tbody className="divide-y dark:divide-gray-700">
                                    {users.map(user => (
                                        <tr key={user.id}>
                                            <td className="py-3">{user.username}</td>
                                            <td className="py-3">{user.roleName}</td>
                                            <td className="py-3 text-center space-x-1 space-x-reverse">
                                                <button onClick={() => openEditUserModal(user)} className="p-2 text-blue-500 hover:bg-blue-100 rounded-full" title="ویرایش نقش"><i className="fas fa-edit"></i></button>
                                                <button onClick={() => openResetPasswordModal(user)} className="p-2 text-yellow-500 hover:bg-yellow-100 rounded-full" title="بازنشانی رمز عبور"><i className="fas fa-key"></i></button>
                                                {user.username !== 'admin' && <button onClick={() => openDeleteUserModal(user)} className="p-2 text-red-500 hover:bg-red-100 rounded-full" title="حذف کاربر"><i className="fas fa-trash"></i></button>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                           </table>
                        </div>
                    </div>

                    {/* Card 3: Data Management */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-t-4 border-red-500">
                        <h3 className="text-lg font-semibold text-red-500 flex items-center mb-4"><i className="fas fa-database ml-2"></i>مدیریت داده‌ها</h3>
                        <div className="space-y-6">
                            <div>
                                <h4 className="font-medium text-gray-800 dark:text-gray-200">پشتیبان‌گیری</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">از کل پایگاه داده یک فایل پشتیبان تهیه کنید تا در مواقع ضروری از آن استفاده کنید.</p>
                                <button onClick={handleBackup} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"><i className="fas fa-download ml-2"></i>دانلود فایل پشتیبان</button>
                            </div>
                            <hr className="dark:border-gray-700"/>
                            <div>
                                <h4 className="font-medium text-gray-800 dark:text-gray-200">بازیابی اطلاعات</h4>
                                <div className="text-xs p-2 my-2 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-300 border-r-2 border-red-500"><b>هشدار:</b> این عمل تمام اطلاعات فعلی شما را با اطلاعات فایل پشتیبان جایگزین می‌کند و غیرقابل بازگشت است.</div>
                                <input type="file" ref={dbFileInputRef} onChange={handleDbFileChange} accept=".db" className="hidden" />
                                <button onClick={() => dbFileInputRef.current?.click()} disabled={isRestoringDb} className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-400">
                                  {isRestoringDb ? <><i className="fas fa-spinner fa-spin ml-2"></i>در حال بازیابی...</> : <><i className="fas fa-upload ml-2"></i>بازیابی از فایل</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky Save Footer */}
            <div className="fixed bottom-0 right-0 lg:mr-72 left-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-4 border-t dark:border-gray-700 z-40 print:hidden">
                <div className="max-w-7xl mx-auto flex justify-end">
                    <button type="submit" form="settings-form" disabled={!infoChanged || isSaving} className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors shadow-lg">
                        {isSaving ? 'در حال ذخیره...' : 'ذخیره تمام تنظیمات'}
                    </button>
                </div>
            </div>
        </div>

        {/* --- ALL MODALS --- */}
        {isRestoreModalOpen && (
            <Modal title="تایید بازیابی اطلاعات" onClose={() => setIsRestoreModalOpen(false)}>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">آیا از بازیابی اطلاعات از فایل <b>{dbFile?.name}</b> مطمئن هستید؟ این عمل غیرقابل بازگشت است.</p>
                <div className="flex justify-end pt-3 gap-3">
                    <button onClick={() => setIsRestoreModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200">انصراف</button>
                    <button onClick={handleRestore} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">تایید و بازیابی</button>
                </div>
            </Modal>
        )}
        {isAddUserModalOpen && (
            <Modal title="افزودن کاربر جدید" onClose={() => setIsAddUserModalOpen(false)}>
                <form onSubmit={handleNewUserSubmit} className="space-y-4">
                    <div><label className={labelClass}>نام کاربری</label><input type="text" name="username" value={newUser.username} onChange={handleNewUserChange} className={inputClass}/>{addUserFormErrors.username && <p className="text-xs text-red-500 mt-1">{addUserFormErrors.username}</p>}</div>
                    <div><label className={labelClass}>کلمه عبور</label><input type="password" name="password" value={newUser.password} onChange={handleNewUserChange} className={inputClass}/>{addUserFormErrors.password && <p className="text-xs text-red-500 mt-1">{addUserFormErrors.password}</p>}</div>
                    <div><label className={labelClass}>تکرار کلمه عبور</label><input type="password" name="confirmPassword" value={newUser.confirmPassword} onChange={handleNewUserChange} className={inputClass}/>{addUserFormErrors.confirmPassword && <p className="text-xs text-red-500 mt-1">{addUserFormErrors.confirmPassword}</p>}</div>
                    <div><label className={labelClass}>نقش</label><select name="roleId" value={newUser.roleId} onChange={handleNewUserChange} className={inputClass}><option value="" disabled>-- انتخاب نقش --</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
                    <div className="flex justify-end pt-2 gap-3"><button type="button" onClick={() => setIsAddUserModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded-md">انصراف</button><button type="submit" disabled={isSavingUser} className="px-4 py-2 bg-indigo-600 text-white rounded-md">{isSavingUser ? 'در حال ذخیره...' : 'افزودن'}</button></div>
                </form>
            </Modal>
        )}
        {isEditUserModalOpen && editingUser && (
            <Modal title={`ویرایش کاربر: ${editingUser.username}`} onClose={() => setIsEditUserModalOpen(false)}>
                <form onSubmit={handleEditUserSubmit} className="space-y-4">
                    <div><label className={labelClass}>نام کاربری</label><input type="text" value={editingUser.username} disabled className={`${inputClass} bg-gray-100 dark:bg-gray-800`} /></div>
                    <div><label className={labelClass}>نقش</label><select name="roleId" value={editingUser.roleId} onChange={handleEditUserChange} className={inputClass}><option value="" disabled>-- انتخاب نقش --</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
                    <div className="flex justify-end pt-2 gap-3"><button type="button" onClick={() => setIsEditUserModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded-md">انصراف</button><button type="submit" disabled={isUpdatingUser} className="px-4 py-2 bg-indigo-600 text-white rounded-md">{isUpdatingUser ? 'در حال ذخیره...' : 'ذخیره'}</button></div>
                </form>
            </Modal>
        )}
        {isResetPasswordModalOpen && resettingUser && (
            <Modal title={`بازنشانی رمز عبور برای: ${resettingUser.username}`} onClose={() => setIsResetPasswordModalOpen(false)}>
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                    <div><label className={labelClass}>کلمه عبور جدید</label><input type="password" value={resetPasswordData.password} onChange={e => setResetPasswordData(p => ({...p, password: e.target.value}))} className={inputClass}/>{resetPasswordErrors.password && <p className="text-xs text-red-500 mt-1">{resetPasswordErrors.password}</p>}</div>
                    <div><label className={labelClass}>تکرار کلمه عبور</label><input type="password" value={resetPasswordData.confirmPassword} onChange={e => setResetPasswordData(p => ({...p, confirmPassword: e.target.value}))} className={inputClass}/>{resetPasswordErrors.confirmPassword && <p className="text-xs text-red-500 mt-1">{resetPasswordErrors.confirmPassword}</p>}</div>
                    <div className="flex justify-end pt-2 gap-3"><button type="button" onClick={() => setIsResetPasswordModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded-md">انصراف</button><button type="submit" disabled={isSubmittingReset} className="px-4 py-2 bg-yellow-500 text-white rounded-md">{isSubmittingReset ? 'در حال ذخیره...' : 'بازنشانی'}</button></div>
                </form>
            </Modal>
        )}
        {isDeleteUserModalOpen && deletingUser && (
            <Modal title={`تایید حذف کاربر: ${deletingUser.username}`} onClose={() => setIsDeleteUserModalOpen(false)}>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">آیا از حذف این کاربر مطمئن هستید؟ این عمل قابل بازگشت نیست.</p>
                <div className="flex justify-end pt-3 gap-3"><button type="button" onClick={() => setIsDeleteUserModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded-md">انصراف</button><button onClick={handleDeleteUser} disabled={isDeletingUser} className="px-4 py-2 bg-red-600 text-white rounded-md">{isDeletingUser ? 'در حال حذف...' : 'حذف'}</button></div>
            </Modal>
        )}
    </div>
  );
};

export default Settings;
