
import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { Customer, NewCustomerData, NotificationMessage } from '../types';
import Notification from '../components/Notification';
import Modal from '../components/Modal'; // Assuming a generic Modal component exists or will be created
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
import { getAuthHeaders } from '../utils/apiUtils'; // Import getAuthHeaders

// Helper to format price/balance
const formatCurrency = (amount?: number) => {
  if (amount === undefined || amount === null) return '۰ تومان';
  const color = amount < 0 ? 'text-red-600' : (amount > 0 ? 'text-green-700' : 'text-gray-700');
  return <span className={color}>{Math.abs(amount).toLocaleString('fa-IR')} تومان {amount < 0 ? '(بدهکار)' : amount > 0 ? '(بستانکار)' : ''}</span>;
 // Swapped logic: positive balance means customer has credit (بستانکار), negative means debt (بدهکار)
 // Standard accounting: Positive balance on customer ledger means they owe us (asset for company)
 // However, for "موجودی حساب مشتری", positive often means they have credit *with* us.
 // Let's adjust: if balance > 0, customer owes us (بدهکار). if balance < 0, customer has credit (بستانکار).
 // Corrected: currentBalance from DB is asset/liability from company PoV.
 // If positive, customer owes company (بدهکار). If negative, company owes customer / customer has credit (بستانکار).
};

const CustomersPage: React.FC = () => {
  const { token } = useAuth(); // Get token
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationMessage | null>(null);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState<NewCustomerData>({
    fullName: '',
    phoneNumber: '',
    address: '',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<NewCustomerData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCustomers = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/customers', { headers: getAuthHeaders(token) });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'خطا در دریافت لیست مشتریان');
      }
      setCustomers(result.data);
      setFilteredCustomers(result.data);
    } catch (error) {
      setNotification({ type: 'error', text: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCustomers();
    }
  }, [token]);

  useEffect(() => {
    const lowerSearchTerm = searchTerm.toLowerCase().trim();
    if (!lowerSearchTerm) {
      setFilteredCustomers(customers);
      return;
    }
    const filtered = customers.filter(c =>
      c.fullName.toLowerCase().includes(lowerSearchTerm) ||
      (c.phoneNumber && c.phoneNumber.includes(lowerSearchTerm))
    );
    setFilteredCustomers(filtered);
  }, [searchTerm, customers]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewCustomer(prev => ({ ...prev, [name]: value }));
    if (formErrors[name as keyof NewCustomerData]) {
      setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Partial<NewCustomerData> = {};
    if (!newCustomer.fullName.trim()) errors.fullName = 'نام کامل الزامی است.';
    if (newCustomer.phoneNumber && !/^\d{10,15}$/.test(newCustomer.phoneNumber.trim())) {
        errors.phoneNumber = 'شماره تماس نامعتبر است (باید ۱۰ تا ۱۵ رقم باشد).';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddCustomerSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !token) return;
    setIsSubmitting(true);
    setNotification(null);
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(newCustomer),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'خطا در افزودن مشتری');
      }
      setNotification({ type: 'success', text: 'مشتری با موفقیت اضافه شد!' });
      setIsAddModalOpen(false);
      setNewCustomer({ fullName: '', phoneNumber: '', address: '', notes: '' }); // Reset form
      fetchCustomers(); // Refresh list
    } catch (error) {
      setNotification({ type: 'error', text: (error as Error).message });
       if((error as Error).message.includes('تکراری')){
         setFormErrors(prev => ({...prev, phoneNumber: (error as Error).message}));
       }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const inputClass = (fieldName: keyof NewCustomerData, isTextarea = false) => 
    `w-full p-2.5 border rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right ${formErrors[fieldName] ? 'border-red-500 ring-red-300' : 'border-gray-300'}`;
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";


  return (
    <div className="space-y-6 text-right" dir="rtl">
      <Notification message={notification} onClose={() => setNotification(null)} />

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
          <h2 className="text-xl font-semibold text-gray-800">مدیریت مشتریان</h2>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input
              type="text"
              placeholder="جستجو بر اساس نام یا شماره تماس..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pr-10 pl-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none text-right"
            />
             <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none sm:relative sm:right-auto sm:top-auto sm:transform-none">
                {/* Search icon for small screens was tricky, simplified for now */}
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors whitespace-nowrap"
            >
              <i className="fas fa-plus ml-2"></i>افزودن مشتری
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-gray-500"><i className="fas fa-spinner fa-spin text-3xl mb-3"></i><p>در حال بارگذاری لیست مشتریان...</p></div>
        ) : customers.length === 0 ? (
          <div className="p-10 text-center text-gray-500"><i className="fas fa-users-slash text-3xl text-gray-400 mb-3"></i><p>هنوز هیچ مشتری ثبت نشده است. برای شروع، یک مشتری جدید اضافه کنید.</p></div>
        ) : filteredCustomers.length === 0 && searchTerm ? (
           <div className="p-10 text-center text-gray-500"><i className="fas fa-search-minus text-3xl text-gray-400 mb-3"></i><p>مشتری با مشخصات وارد شده یافت نشد.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">نام کامل</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">شماره تماس</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">موجودی حساب</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">عملیات</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{customer.fullName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700" dir="ltr">{customer.phoneNumber || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {formatCurrency(customer.currentBalance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link to={`/customers/${customer.id}`} className="text-indigo-600 hover:text-indigo-800 transition-colors">
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
        <Modal title="افزودن مشتری جدید" onClose={() => setIsAddModalOpen(false)} widthClass="max-w-lg">
          <form onSubmit={handleAddCustomerSubmit} className="space-y-4 p-1">
            <div>
              <label htmlFor="fullName" className={labelClass}>نام کامل <span className="text-red-500">*</span></label>
              <input type="text" id="fullName" name="fullName" value={newCustomer.fullName} onChange={handleInputChange} className={inputClass('fullName')} required />
              {formErrors.fullName && <p className="mt-1 text-xs text-red-600">{formErrors.fullName}</p>}
            </div>
            <div>
              <label htmlFor="phoneNumber" className={labelClass}>شماره تماس</label>
              <input type="tel" id="phoneNumber" name="phoneNumber" value={newCustomer.phoneNumber} onChange={handleInputChange} className={inputClass('phoneNumber')} placeholder="مثال: 09123456789" />
              {formErrors.phoneNumber && <p className="mt-1 text-xs text-red-600">{formErrors.phoneNumber}</p>}
            </div>
            <div>
              <label htmlFor="address" className={labelClass}>آدرس</label>
              <textarea id="address" name="address" value={newCustomer.address} onChange={handleInputChange} rows={2} className={inputClass('address', true)}></textarea>
            </div>
            <div>
              <label htmlFor="notes" className={labelClass}>یادداشت</label>
              <textarea id="notes" name="notes" value={newCustomer.notes} onChange={handleInputChange} rows={2} className={inputClass('notes', true)}></textarea>
            </div>
            <div className="flex justify-end pt-3">
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="ml-3 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                انصراف
              </button>
              <button type="submit" disabled={isSubmitting || !token} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-400 transition-colors">
                {isSubmitting ? (<><i className="fas fa-spinner fa-spin mr-2"></i>در حال ذخیره...</>) : 'ذخیره مشتری'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default CustomersPage;
