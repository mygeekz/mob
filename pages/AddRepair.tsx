// pages/AddRepair.tsx
import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { NewRepairData, Customer, NotificationMessage } from '../types';
import Notification from '../components/Notification';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/apiFetch';

const AddRepair: React.FC = () => {
    const navigate = useNavigate();
    const { token, currentUser } = useAuth();

    // فرم اولیه
    const initialFormState: NewRepairData = {
        customerId: null,
        deviceModel: '',
        deviceColor: '',
        serialNumber: '',
        problemDescription: '',
        estimatedCost: '',
    };

    const [formData, setFormData] = useState<NewRepairData>(initialFormState);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [customerMobile, setCustomerMobile] = useState<string>(''); // ← NEW
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
    const [notification, setNotification] = useState<NotificationMessage | null>(null);
    const [formErrors, setFormErrors] = useState<Partial<NewRepairData>>({});

    useEffect(() => {
        if (currentUser && currentUser.roleName === 'Salesperson') {
            setNotification({ type: 'error', text: 'شما اجازه دسترسی به این صفحه را ندارید.' });
            navigate('/');
            return;
        }
        fetchCustomers();
    }, [currentUser, navigate, token]);

    const fetchCustomers = async () => {
        setIsLoadingCustomers(true);
        try {
            const response = await apiFetch('/api/customers');
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'خطا در دریافت لیست مشتریان');
            setCustomers(result.data || []);
        } catch (error: any) {
            setNotification({ type: 'error', text: error.message });
        } finally {
            setIsLoadingCustomers(false);
        }
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;

        // اگر مشتری عوض شد، موبایل را هم ست کن
        if (name === 'customerId') {
            const selected = customers.find(c => c.id === Number(value));
            const phone = selected?.mobile || selected?.phoneNumber || selected?.phone || '';
            setCustomerMobile(phone);
        }

        setFormData(prev => ({ ...prev, [name]: value }));

        if (formErrors[name as keyof NewRepairData]) {
            setFormErrors(prev => ({ ...prev, [name]: undefined }));
        }
    };

    const validateForm = (): boolean => {
        const errors: Partial<NewRepairData> = {};
        if (!formData.customerId) errors.customerId = "انتخاب مشتری الزامی است.";
        if (!formData.deviceModel.trim()) errors.deviceModel = "مدل دستگاه الزامی است.";
        if (!formData.problemDescription.trim()) errors.problemDescription = "شرح مشکل از زبان مشتری الزامی است.";
        if (formData.estimatedCost && (isNaN(Number(formData.estimatedCost)) || Number(formData.estimatedCost) < 0)) {
            errors.estimatedCost = "هزینه تخمینی باید یک عدد معتبر باشد.";
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;
        setIsLoading(true);
        setNotification(null);
        try {
            // اگر بک‌اند فیلد customerMobile را می‌پذیرد، این را هم بفرست (snapshot)
            const payload: any = {
                ...formData,
                customerId: Number(formData.customerId),
                estimatedCost: formData.estimatedCost ? Number(formData.estimatedCost) : null,
                customerMobile: customerMobile || null, // ← NEW
            };

            const response = await apiFetch('/api/repairs', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'خطا در ثبت پذیرش تعمیر');
            
            setNotification({ type: 'success', text: 'دستگاه با موفقیت پذیرش شد!' });
            setTimeout(() => navigate(`/repairs/${result.data.id}/receipt?autoPrint=1`), 800);

        } catch (error: any) {
            setNotification({ type: 'error', text: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const inputClass = (fieldName: keyof NewRepairData, isSelect = false) =>
        `w-full p-2.5 border rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right bg-white dark:bg-gray-700 dark:border-gray-600 ${formErrors[fieldName] ? 'border-red-500' : 'border-gray-300'}`;

    const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

    return (
        <div className="space-y-6 text-right" dir="rtl">
            <Notification message={notification} onClose={() => setNotification(null)} />
            <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 max-w-4xl mx-auto">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-6 border-b dark:border-gray-700 pb-4">پذیرش دستگاه جدید برای تعمیر</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* انتخاب مشتری */}
                    <div>
                        <label htmlFor="customerId" className={labelClass}>مشتری <span className="text-red-500">*</span></label>
                        <select
                            id="customerId"
                            name="customerId"
                            value={formData.customerId || ''}
                            onChange={handleInputChange}
                            className={inputClass('customerId', true)}
                            disabled={isLoadingCustomers}
                        >
                            <option value="">-- انتخاب مشتری --</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.fullName} ({c.mobile || c.phoneNumber || 'بدون شماره'})
                                </option>
                            ))}
                        </select>
                        {formErrors.customerId && <p className="mt-1 text-xs text-red-600">{formErrors.customerId}</p>}
                    </div>

                    {/* شماره موبایل مشتری (ReadOnly) */}
                    <div>
                        <label htmlFor="customerMobile" className={labelClass}>شماره موبایل مشتری</label>
                        <input
                            type="text"
                            id="customerMobile"
                            name="customerMobile"
                            value={customerMobile}
                            onChange={(e) => setCustomerMobile(e.target.value)} // اگر بخواهی قابل ویرایش باشد بگذار بماند
                            readOnly // اگر نمی‌خواهی ویرایش شود، این را نگه دار
                            className="w-full p-2.5 border rounded-lg shadow-sm text-sm bg-gray-50 dark:bg-gray-700 dark:border-gray-600"
                            placeholder="به‌صورت خودکار پر می‌شود"
                        />
                    </div>

                    <div>
                        <label htmlFor="deviceModel" className={labelClass}>مدل دستگاه <span className="text-red-500">*</span></label>
                        <input type="text" id="deviceModel" name="deviceModel" value={formData.deviceModel} onChange={handleInputChange} className={inputClass('deviceModel')} placeholder="مثال: iPhone 13 Pro Max" />
                        {formErrors.deviceModel && <p className="mt-1 text-xs text-red-600">{formErrors.deviceModel}</p>}
                    </div>

                    <div>
                        <label htmlFor="deviceColor" className={labelClass}>رنگ دستگاه</label>
                        <input type="text" id="deviceColor" name="deviceColor" value={formData.deviceColor || ''} onChange={handleInputChange} className={inputClass('deviceColor')} placeholder="مثال: Sierra Blue" />
                    </div>
                    
                    <div>
                        <label htmlFor="serialNumber" className={labelClass}>شماره سریال (اختیاری)</label>
                        <input type="text" id="serialNumber" name="serialNumber" value={formData.serialNumber || ''} onChange={handleInputChange} className={inputClass('serialNumber')} />
                    </div>

                    <div className="md:col-span-2">
                        <label htmlFor="problemDescription" className={labelClass}>شرح مشکل از زبان مشتری <span className="text-red-500">*</span></label>
                        <textarea id="problemDescription" name="problemDescription" value={formData.problemDescription} onChange={handleInputChange} rows={4} className={inputClass('problemDescription') as string} placeholder="مثال: صفحه نمایش شکسته، باتری زود خالی می‌شود..."></textarea>
                        {formErrors.problemDescription && <p className="mt-1 text-xs text-red-600">{formErrors.problemDescription}</p>}
                    </div>

                    <div>
                        <label htmlFor="estimatedCost" className={labelClass}>هزینه تخمینی (تومان)</label>
                        <input type="number" id="estimatedCost" name="estimatedCost" value={formData.estimatedCost || ''} onChange={handleInputChange} className={inputClass('estimatedCost')} placeholder="مثال: ۱۲۰۰۰۰۰" />
                        {formErrors.estimatedCost && <p className="mt-1 text-xs text-red-600">{formErrors.estimatedCost}</p>}
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t dark:border-gray-700 flex justify-end gap-3">
                    <button type="button" onClick={() => navigate('/repairs')} className="px-6 py-2.5 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                        انصراف
                    </button>
                    <button type="submit" disabled={isLoading || isLoadingCustomers} className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-400 transition-colors">
                        {isLoading ? 'در حال ثبت...' : 'ثبت و ایجاد قبض تعمیر'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddRepair;
