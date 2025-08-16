
import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { Partner, NewPartnerData, NotificationMessage, PartnerType } from '../types';
import Notification from '../components/Notification';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
import { apiFetch } from '../utils/apiFetch';
import { PARTNER_TYPES } from '../constants'; // Import localized partner types

// Helper to format partner balance
const formatPartnerBalance = (amount?: number) => {
  if (amount === undefined || amount === null) return <span className="text-gray-700">۰ تومان (تسویه)</span>;
  
  const absAmountStr = Math.abs(amount).toLocaleString('fa-IR') + ' تومان';
  
  if (amount > 0) { // We owe the partner
    return <span className="text-red-600 font-semibold">{absAmountStr} (بدهی شما به همکار)</span>;
  } else if (amount < 0) { // Partner owes us / We have credit
    return <span className="text-green-700 font-semibold">{absAmountStr} (طلب شما از همکار)</span>;
  } else { // amount is 0
    return <span className="text-gray-700">{absAmountStr} (تسویه شده)</span>;
  }
};

const PartnersPage: React.FC = () => {
  const { token } = useAuth(); // Get token
  const [partners, setPartners] = useState<Partner[]>([]);
  const [filteredPartners, setFilteredPartners] = useState<Partner[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationMessage | null>(null);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const initialNewPartnerState: NewPartnerData = {
    partnerName: '',
    partnerType: 'Supplier', // Default to Supplier
    contactPerson: '',
    phoneNumber: '',
    email: '',
    address: '',
    notes: '',
  };
  const [newPartner, setNewPartner] = useState<NewPartnerData>(initialNewPartnerState);
  const [formErrors, setFormErrors] = useState<Partial<NewPartnerData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPartners = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await apiFetch('/api/partners');
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'خطا در دریافت لیست همکاران');
      }
      setPartners(result.data);
      setFilteredPartners(result.data);
    } catch (error) {
      setNotification({ type: 'error', text: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPartners();
    }
  }, [token]);

  useEffect(() => {
    const lowerSearchTerm = searchTerm.toLowerCase().trim();
    if (!lowerSearchTerm) {
      setFilteredPartners(partners);
      return;
    }
    const filtered = partners.filter(p =>
      p.partnerName.toLowerCase().includes(lowerSearchTerm) ||
      (PARTNER_TYPES.find(pt => pt.value === p.partnerType)?.label.toLowerCase().includes(lowerSearchTerm)) ||
      (p.phoneNumber && p.phoneNumber.includes(lowerSearchTerm)) ||
      (p.contactPerson && p.contactPerson.toLowerCase().includes(lowerSearchTerm))
    );
    setFilteredPartners(filtered);
  }, [searchTerm, partners]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewPartner(prev => ({ ...prev, [name]: value }));
    if (formErrors[name as keyof NewPartnerData]) {
      setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Partial<NewPartnerData> = {};
    if (!newPartner.partnerName.trim()) errors.partnerName = 'نام همکار الزامی است.';
    if (!newPartner.partnerType.trim()) errors.partnerType = 'نوع همکار الزامی است.';
    if (newPartner.phoneNumber && !/^\d{10,15}$/.test(newPartner.phoneNumber.trim())) {
        errors.phoneNumber = 'شماره تماس نامعتبر است (باید ۱۰ تا ۱۵ رقم باشد).';
    }
    if (newPartner.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newPartner.email.trim())) {
        errors.email = 'ایمیل نامعتبر است.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddPartnerSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !token) return;
    setIsSubmitting(true);
    setNotification(null);
    try {
      const response = await apiFetch('/api/partners', {
        method: 'POST',
        body: JSON.stringify(newPartner),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'خطا در افزودن همکار');
      }
      setNotification({ type: 'success', text: 'همکار با موفقیت اضافه شد!' });
      setIsAddModalOpen(false);
      setNewPartner(initialNewPartnerState); // Reset form
      fetchPartners(); // Refresh list
    } catch (error) {
      setNotification({ type: 'error', text: (error as Error).message });
       if((error as Error).message.toLowerCase().includes('تکراری') || (error as Error).message.toLowerCase().includes('unique constraint')){
         // A more robust check for unique phone number error might be needed if backend message changes
         setFormErrors(prev => ({...prev, phoneNumber: 'این شماره تماس قبلا ثبت شده است.'}));
       }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const inputClass = (fieldName: keyof NewPartnerData, isTextarea = false, isSelect = false) => 
    `w-full p-2.5 border rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right bg-white dark:bg-gray-800 dark:border-gray-600 ${formErrors[fieldName] ? 'border-red-500' : 'border-gray-300'}`;
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";


  return (
    <div className="space-y-6 text-right" dir="rtl">
      <Notification message={notification} onClose={() => setNotification(null)} />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">مدیریت همکاران (تامین‌کنندگان و ...)</h2>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
                <input
                type="text"
                placeholder="جستجو بر اساس نام، نوع، شماره..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <i className="fa-solid fa-search text-gray-400"></i>
                </div>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors whitespace-nowrap"
            >
              <i className="fas fa-user-plus ml-2"></i>افزودن همکار
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-gray-500 dark:text-gray-400"><i className="fas fa-spinner fa-spin text-3xl mb-3"></i><p>در حال بارگذاری لیست همکاران...</p></div>
        ) : partners.length === 0 ? (
          <div className="p-10 text-center text-gray-500 dark:text-gray-400"><i className="fas fa-users-slash text-3xl text-gray-400 mb-3"></i><p>هنوز هیچ همکاری ثبت نشده است. برای شروع، یک همکار جدید اضافه کنید.</p></div>
        ) : filteredPartners.length === 0 && searchTerm ? (
           <div className="p-10 text-center text-gray-500 dark:text-gray-400"><i className="fas fa-search-minus text-3xl text-gray-400 mb-3"></i><p>همکاری با مشخصات وارد شده یافت نشد.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">نام همکار</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">نوع همکار</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">شماره تماس</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">موجودی حساب</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">عملیات</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredPartners.map(partner => (
                  <tr key={partner.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{partner.partnerName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{PARTNER_TYPES.find(p => p.value === partner.partnerType)?.label || partner.partnerType}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300" dir="ltr">{partner.phoneNumber || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {formatPartnerBalance(partner.currentBalance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link to={`/partners/${partner.id}`} className="text-teal-600 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300 transition-colors">
                        مشاهده جزئیات
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isAddModalOpen && (
        <Modal title="افزودن همکار جدید" onClose={() => setIsAddModalOpen(false)} widthClass="max-w-lg">
          <form onSubmit={handleAddPartnerSubmit} className="space-y-4 p-1">
            <div>
              <label htmlFor="partnerName" className={labelClass}>نام همکار <span className="text-red-500">*</span></label>
              <input type="text" id="partnerName" name="partnerName" value={newPartner.partnerName} onChange={handleInputChange} className={inputClass('partnerName')} required />
              {formErrors.partnerName && <p className="mt-1 text-xs text-red-600">{formErrors.partnerName}</p>}
            </div>
             <div>
              <label htmlFor="partnerType" className={labelClass}>نوع همکار <span className="text-red-500">*</span></label>
              <select id="partnerType" name="partnerType" value={newPartner.partnerType} onChange={handleInputChange} className={inputClass('partnerType', false, true)} required>
                {PARTNER_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
              {formErrors.partnerType && <p className="mt-1 text-xs text-red-600">{formErrors.partnerType}</p>}
            </div>
            <div>
              <label htmlFor="contactPerson" className={labelClass}>فرد رابط</label>
              <input type="text" id="contactPerson" name="contactPerson" value={newPartner.contactPerson} onChange={handleInputChange} className={inputClass('contactPerson')} />
            </div>
            <div>
              <label htmlFor="phoneNumber" className={labelClass}>شماره تماس</label>
              <input type="tel" id="phoneNumber" name="phoneNumber" value={newPartner.phoneNumber} onChange={handleInputChange} className={inputClass('phoneNumber')} placeholder="مثال: 09123456789" />
              {formErrors.phoneNumber && <p className="mt-1 text-xs text-red-600">{formErrors.phoneNumber}</p>}
            </div>
            <div>
              <label htmlFor="email" className={labelClass}>ایمیل</label>
              <input type="email" id="email" name="email" value={newPartner.email} onChange={handleInputChange} className={inputClass('email')} placeholder="example@domain.com" />
              {formErrors.email && <p className="mt-1 text-xs text-red-600">{formErrors.email}</p>}
            </div>
            <div>
              <label htmlFor="address" className={labelClass}>آدرس</label>
              <textarea id="address" name="address" value={newPartner.address} onChange={handleInputChange} rows={2} className={inputClass('address', true)}></textarea>
            </div>
            <div>
              <label htmlFor="notes" className={labelClass}>یادداشت</label>
              <textarea id="notes" name="notes" value={newPartner.notes} onChange={handleInputChange} rows={2} className={inputClass('notes', true)}></textarea>
            </div>
            <div className="flex justify-end pt-3">
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="ml-3 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200 rounded-lg hover:bg-gray-200 transition-colors">
                انصراف
              </button>
              <button type="submit" disabled={isSubmitting || !token} className="px-4 py-2 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:bg-teal-400 transition-colors">
                {isSubmitting ? (<><i className="fas fa-spinner fa-spin mr-2"></i>در حال ذخیره...</>) : 'ذخیره همکار'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default PartnersPage;