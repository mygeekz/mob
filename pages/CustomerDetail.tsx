

import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import moment from 'jalali-moment';

import {
  CustomerDetailsPageData,
  NotificationMessage,
  NewCustomerData,
  NewLedgerEntryData,
} from '../types';
import Notification from '../components/Notification';
import Modal from '../components/Modal';
import ShamsiDatePicker from '../components/ShamsiDatePicker';
import PriceInput from '../components/PriceInput'; // Import the new component
import { formatIsoToShamsi, formatIsoToShamsiDateTime } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
import { getAuthHeaders } from '../utils/apiUtils'; // Import getAuthHeaders


const formatLedgerCurrency = (amount?: number, type?: 'debit' | 'credit' | 'balance') => {
  if (amount === undefined || amount === null) return '۰ تومان';

  let amountStr = Math.abs(amount).toLocaleString('fa-IR') + ' تومان';
  let color = 'text-gray-700';

  if (type === 'balance') {
    if (amount > 0) {
      color = 'text-red-600';
      amountStr += ' (بدهکار)';
    } else if (amount < 0) {
      color = 'text-green-700';
      amountStr = Math.abs(amount).toLocaleString('fa-IR') + ' تومان (بستانکار)';
    } else {
        amountStr += ' (تسویه)';
    }
  } else if (type === 'debit' && amount > 0) {
    color = 'text-red-500';
  } else if (type === 'credit' && amount > 0) {
    color = 'text-green-600';
  }

  return <span className={color}>{amountStr}</span>;
};


const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth(); // Get token

  const [customerData, setCustomerData] = useState<CustomerDetailsPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationMessage | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Partial<NewCustomerData>>({});
  const [editFormErrors, setEditFormErrors] = useState<Partial<NewCustomerData>>({});
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const initialLedgerEntry: NewLedgerEntryData = { description: '', debit: 0, credit: 0 }; 
  const [newLedgerEntry, setNewLedgerEntry] = useState<NewLedgerEntryData>(initialLedgerEntry);
  const [ledgerDateSelected, setLedgerDateSelected] = useState<Date|null>(new Date());
  const [ledgerFormErrors, setLedgerFormErrors] = useState<Partial<NewLedgerEntryData & { amountType?: string, transactionDate?: string }>>({});
  const [isSubmittingLedger, setIsSubmittingLedger] = useState(false);
  const [transactionType, setTransactionType] = useState<'debit' | 'credit'>('credit');

  const fetchCustomerDetails = async () => {
    if (!id || !token) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/customers/${id}`, { headers: getAuthHeaders(token) });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'خطا در دریافت اطلاعات مشتری');
      }
      setCustomerData(result.data);
    } catch (error: any) {
      setNotification({ type: 'error', text: error.message });
      if (error.message.includes('یافت نشد')) {
        setTimeout(() => navigate('/customers'), 2000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
        fetchCustomerDetails();
    }
  }, [id, navigate, token]);


  const openEditModal = () => {
    if (customerData?.profile) {
      setEditingCustomer({
        fullName: customerData.profile.fullName,
        phoneNumber: customerData.profile.phoneNumber || '',
        address: customerData.profile.address || '',
        notes: customerData.profile.notes || '',
      });
      setEditFormErrors({});
      setIsEditModalOpen(true);
    }
  };

  const handleEditInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditingCustomer(prev => ({ ...prev, [name]: value }));
    if (editFormErrors[name as keyof NewCustomerData]) {
      setEditFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateEditForm = (): boolean => {
    const errors: Partial<NewCustomerData> = {};
    if (!editingCustomer.fullName?.trim()) errors.fullName = 'نام کامل الزامی است.';
    if (editingCustomer.phoneNumber && !/^\d{10,15}$/.test(editingCustomer.phoneNumber.trim())) {
        errors.phoneNumber = 'شماره تماس نامعتبر است (باید ۱۰ تا ۱۵ رقم باشد).';
    }
    setEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateEditForm() || !id || !token) return;
    setIsSubmittingEdit(true);
    setNotification(null);
    try {
      const response = await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify(editingCustomer),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'خطا در به‌روزرسانی اطلاعات مشتری');
      }
      setNotification({ type: 'success', text: 'اطلاعات مشتری با موفقیت به‌روزرسانی شد!' });
      setIsEditModalOpen(false);
      fetchCustomerDetails();
    } catch (error: any) {
      setNotification({ type: 'error', text: error.message });
      if(error.message.includes('تکراری')){
         setEditFormErrors(prev => ({...prev, phoneNumber: error.message}));
       }
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const openLedgerModal = () => {
    setNewLedgerEntry(initialLedgerEntry);
    setLedgerDateSelected(new Date()); 
    setTransactionType('credit'); 
    setLedgerFormErrors({});
    setIsLedgerModalOpen(true);
  };

  const handleLedgerInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { name: string, value: string } }) => {
    const { name, value } = e.target;
     if (name === 'amount') {
        const amountValue = parseFloat(value);
        if (transactionType === 'credit') {
            setNewLedgerEntry(prev => ({ ...prev, credit: isNaN(amountValue) ? '' : value, debit: 0 }));
        } else {
            setNewLedgerEntry(prev => ({ ...prev, debit: isNaN(amountValue) ? '' : value, credit: 0 }));
        }
    } else {
        setNewLedgerEntry(prev => ({ ...prev, [name]: value }));
    }
    if (ledgerFormErrors[name as keyof NewLedgerEntryData] || ledgerFormErrors.amountType) {
      setLedgerFormErrors(prev => ({ ...prev, [name]: undefined, amountType: undefined, transactionDate: undefined }));
    }
  };

  const handleTransactionTypeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const type = e.target.value as 'debit' | 'credit';
    setTransactionType(type);
    const currentAmount = type === 'credit' ? (newLedgerEntry.credit || 0) : (newLedgerEntry.debit || 0);
    if (type === 'credit') {
        setNewLedgerEntry(prev => ({ ...prev, credit: currentAmount, debit: 0 }));
    } else {
        setNewLedgerEntry(prev => ({ ...prev, debit: currentAmount, credit: 0 }));
    }
  };

  const validateLedgerForm = (): boolean => {
    const errors: Partial<NewLedgerEntryData & { amountType?: string, transactionDate?: string }> = {};
    if (!newLedgerEntry.description?.trim()) errors.description = 'شرح تراکنش الزامی است.';

    const amount = transactionType === 'credit' ? newLedgerEntry.credit : newLedgerEntry.debit;
    if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) <= 0) {
        errors.amountType = 'مبلغ تراکنش باید عددی مثبت باشد.';
    }
    if (!ledgerDateSelected) { 
        errors.transactionDate = "تاریخ تراکنش الزامی است.";
    }
    setLedgerFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLedgerSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateLedgerForm() || !id || !ledgerDateSelected || !token) return;
    setIsSubmittingLedger(true);
    setNotification(null);

    const payload: NewLedgerEntryData = {
        description: newLedgerEntry.description || '',
        debit: transactionType === 'debit' ? Number(newLedgerEntry.debit) : 0,
        credit: transactionType === 'credit' ? Number(newLedgerEntry.credit) : 0,
        transactionDate: moment(ledgerDateSelected).toISOString() // Send as full ISO DateTime
    };

    try {
      const response = await fetch(`/api/customers/${id}/ledger`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'خطا در ثبت تراکنش در دفتر حساب');
      }
      setNotification({ type: 'success', text: 'تراکنش با موفقیت ثبت شد!' });
      setIsLedgerModalOpen(false);
      fetchCustomerDetails();
    } catch (error: any) {
      setNotification({ type: 'error', text: error.message });
    } finally {
      setIsSubmittingLedger(false);
    }
  };

  const formatPrice = (price: number | undefined | null) => {
    if (price === undefined || price === null) return '-';
    return price.toLocaleString('fa-IR') + ' تومان';
  };

  const inputClass = (hasError: boolean, isTextarea = false) =>
    `w-full p-2.5 border rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right ${isTextarea ? '' : ''}${hasError ? 'border-red-500 ring-red-300' : 'border-gray-300'}`;
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  if (isLoading) {
    return <div className="p-10 text-center text-gray-500"><i className="fas fa-spinner fa-spin text-3xl mb-3"></i><p>در حال بارگذاری اطلاعات مشتری...</p></div>;
  }

  if (!customerData) {
    return <div className="p-10 text-center text-red-500"><i className="fas fa-exclamation-circle text-3xl mb-3"></i><p>اطلاعات مشتری یافت نشد یا خطایی رخ داده است.</p></div>;
  }

  const { profile, ledger, purchaseHistory } = customerData;

  return (
    <div className="space-y-8 text-right" dir="rtl">
      <Notification message={notification} onClose={() => setNotification(null)} />

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-4 border-b pb-4">
          <h2 className="text-2xl font-semibold text-gray-800">
            پروفایل مشتری: {profile.fullName}
          </h2>
          <button
            onClick={openEditModal}
            className="px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors text-sm"
          >
            <i className="fas fa-edit ml-2"></i>ویرایش پروفایل
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <p><strong>شناسه مشتری:</strong> {profile.id.toLocaleString('fa-IR')}</p>
          <p><strong>تاریخ ثبت نام:</strong> {formatIsoToShamsi(profile.dateAdded)}</p>
          <p><strong>شماره تماس:</strong> <span dir="ltr">{profile.phoneNumber || '-'}</span></p>
          <p><strong>آدرس:</strong> {profile.address || '-'}</p>
          <p className="md:col-span-2"><strong>یادداشت‌ها:</strong> {profile.notes || '-'}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-4 border-b pb-4">
          <h2 className="text-xl font-semibold text-gray-800">دفتر حساب مشتری (حساب دفتری)</h2>
           <button
            onClick={openLedgerModal}
            className="px-4 py-2 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 transition-colors text-sm"
          >
            <i className="fas fa-plus ml-2"></i>ثبت تراکنش جدید
          </button>
        </div>
        <div className="mb-4 p-4 bg-indigo-50 rounded-lg">
          <p className="text-lg font-bold text-indigo-700">
            موجودی نهایی حساب: {formatLedgerCurrency(profile.currentBalance, 'balance')}
          </p>
        </div>
        {ledger.length === 0 ? (
          <p className="text-gray-500">هیچ تراکنشی در دفتر حساب این مشتری ثبت نشده است.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">تاریخ</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">شرح</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">بدهکار (تومان)</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">بستانکار (تومان)</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">مانده (تومان)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {ledger.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap">{formatIsoToShamsiDateTime(entry.transactionDate)}</td>
                    <td className="px-4 py-2">{entry.description}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatLedgerCurrency(entry.debit, 'debit')}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatLedgerCurrency(entry.credit, 'credit')}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatLedgerCurrency(entry.balance, 'balance')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-4">تاریخچه خرید مشتری</h2>
        {purchaseHistory.length === 0 ? (
          <p className="text-gray-500">این مشتری هنوز خریدی ثبت نکرده است.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">تاریخ فروش</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">نام کالا</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">تعداد</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">قیمت واحد</th>
                   <th className="px-4 py-2 text-right font-semibold text-gray-600">تخفیف</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">قیمت کل نهایی</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {purchaseHistory.map(sale => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap">{formatIsoToShamsi(sale.transactionDate)}</td>
                    <td className="px-4 py-2">{sale.itemName}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{sale.quantity.toLocaleString('fa-IR')}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatPrice(sale.pricePerItem)}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-red-600">{formatPrice(sale.discount)}</td>
                    <td className="px-4 py-2 whitespace-nowrap font-semibold text-indigo-700">{formatPrice(sale.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isEditModalOpen && (
        <Modal title="ویرایش اطلاعات مشتری" onClose={() => setIsEditModalOpen(false)} widthClass="max-w-lg">
          <form onSubmit={handleEditSubmit} className="space-y-4 p-1">
            <div>
              <label htmlFor="editFullName" className={labelClass}>نام کامل <span className="text-red-500">*</span></label>
              <input type="text" id="editFullName" name="fullName" value={editingCustomer.fullName || ''} onChange={handleEditInputChange} className={inputClass(!!editFormErrors.fullName)} required />
              {editFormErrors.fullName && <p className="mt-1 text-xs text-red-600">{editFormErrors.fullName}</p>}
            </div>
            <div>
              <label htmlFor="editPhoneNumber" className={labelClass}>شماره تماس</label>
              <input type="tel" id="editPhoneNumber" name="phoneNumber" value={editingCustomer.phoneNumber || ''} onChange={handleEditInputChange} className={inputClass(!!editFormErrors.phoneNumber)} placeholder="مثال: 09123456789" />
              {editFormErrors.phoneNumber && <p className="mt-1 text-xs text-red-600">{editFormErrors.phoneNumber}</p>}
            </div>
            <div>
              <label htmlFor="editAddress" className={labelClass}>آدرس</label>
              <textarea id="editAddress" name="address" value={editingCustomer.address || ''} onChange={handleEditInputChange} rows={2} className={inputClass(!!editFormErrors.address, true)}></textarea>
            </div>
            <div>
              <label htmlFor="editNotes" className={labelClass}>یادداشت</label>
              <textarea id="editNotes" name="notes" value={editingCustomer.notes || ''} onChange={handleEditInputChange} rows={2} className={inputClass(!!editFormErrors.notes, true)}></textarea>
            </div>
            <div className="flex justify-end pt-3">
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="ml-3 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                انصراف
              </button>
              <button type="submit" disabled={isSubmittingEdit || !token} className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400 transition-colors">
                {isSubmittingEdit ? (<><i className="fas fa-spinner fa-spin mr-2"></i>در حال ذخیره...</>) : 'ذخیره تغییرات'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      
      {isLedgerModalOpen && (
        <Modal title={`ثبت تراکنش برای ${profile.fullName}`} onClose={() => setIsLedgerModalOpen(false)} widthClass="max-w-lg">
          <form onSubmit={handleLedgerSubmit} className="space-y-4 p-1">
            <div className="flex space-x-4 space-x-reverse mb-3">
                <label className="flex items-center cursor-pointer">
                    <input type="radio" name="transactionType" value="credit" checked={transactionType === 'credit'} onChange={handleTransactionTypeChange} className="form-radio h-4 w-4 text-indigo-600 ml-2" />
                    <span className="text-sm text-gray-700">دریافت از مشتری (بستانکار کردن مشتری)</span>
                </label>
                <label className="flex items-center cursor-pointer">
                    <input type="radio" name="transactionType" value="debit" checked={transactionType === 'debit'} onChange={handleTransactionTypeChange} className="form-radio h-4 w-4 text-indigo-600 ml-2" />
                    <span className="text-sm text-gray-700">شارژ حساب مشتری (بدهکار کردن مشتری)</span>
                </label>
            </div>
            <div>
              <label htmlFor="ledgerAmount" className={labelClass}>مبلغ تراکنش (تومان) <span className="text-red-500">*</span></label>
              <PriceInput 
                id="ledgerAmount" 
                name="amount"
                value={transactionType === 'credit' ? String(newLedgerEntry.credit || '') : String(newLedgerEntry.debit || '')}
                onChange={handleLedgerInputChange} 
                className={inputClass(!!ledgerFormErrors.amountType)}
                placeholder="مثال: ۵۰۰۰۰"
              />
              {ledgerFormErrors.amountType && <p className="mt-1 text-xs text-red-600">{ledgerFormErrors.amountType}</p>}
            </div>
             <div>
              <label htmlFor="ledgerDescription" className={labelClass}>شرح تراکنش <span className="text-red-500">*</span></label>
              <textarea id="ledgerDescription" name="description" value={newLedgerEntry.description || ''} onChange={handleLedgerInputChange} rows={2} className={inputClass(!!ledgerFormErrors.description, true)} required placeholder="مثال: پرداخت بدهی / شارژ حساب"/>
              {ledgerFormErrors.description && <p className="mt-1 text-xs text-red-600">{ledgerFormErrors.description}</p>}
            </div>
            <div>
              <label htmlFor="ledgerDatePicker" className={labelClass}>تاریخ تراکنش <span className="text-red-500">*</span></label>
              <ShamsiDatePicker
                  id="ledgerDatePicker"
                  selectedDate={ledgerDateSelected}
                  onDateChange={setLedgerDateSelected}
                  inputClassName={inputClass(!!ledgerFormErrors.transactionDate)}
              />
              {ledgerFormErrors.transactionDate && <p className="mt-1 text-xs text-red-600">{ledgerFormErrors.transactionDate}</p>}
            </div>
            <div className="flex justify-end pt-3">
              <button type="button" onClick={() => setIsLedgerModalOpen(false)} className="ml-3 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                انصراف
              </button>
              <button type="submit" disabled={isSubmittingLedger || !token} className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-green-400">
			  				ذخیره تغییرات 
			  </button> 
			</div>
			</form>
        </Modal>
      )}
    </div>
  );
};

export default CustomerDetailPage;