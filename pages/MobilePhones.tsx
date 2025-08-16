



import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import moment from 'jalali-moment';
import { useNavigate } from 'react-router-dom';

import { PhoneEntry, NewPhoneEntryData, NotificationMessage, PhoneStatus, Partner, PhoneEntryPayload, PhoneEntryUpdatePayload } from '../types';
import Notification from '../components/Notification';
import ShamsiDatePicker from '../components/ShamsiDatePicker';
import Modal from '../components/Modal';
import PriceInput from '../components/PriceInput'; // Import the new component
import { PHONE_RAM_OPTIONS, PHONE_STORAGE_OPTIONS, PHONE_CONDITIONS, PHONE_STATUSES } from '../constants';
import { formatIsoToShamsi, formatIsoToShamsiDateTime } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
import { getAuthHeaders } from '../utils/apiUtils'; // Import getAuthHeaders

// Converts Date object from DatePicker to ISO YYYY-MM-DD string
const fromDatePickerToISO_YYYY_MM_DD = (date: Date | null): string | undefined => {
  if (!date) return undefined;
  return moment(date).format('YYYY-MM-DD'); 
};

const MobilePhonesPage: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useAuth(); // Get token
  const [phones, setPhones] = useState<PhoneEntry[]>([]);
  const [filteredPhones, setFilteredPhones] = useState<PhoneEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [partners, setPartners] = useState<Partner[]>([]);

  const initialNewPhoneState: NewPhoneEntryData = {
    model: '', color: '', storage: PHONE_STORAGE_OPTIONS[0], ram: PHONE_RAM_OPTIONS[0], imei: '',
    batteryHealth: '', condition: PHONE_CONDITIONS[0], purchasePrice: '', salePrice: '',
    status: PHONE_STATUSES[0], notes: '', supplierId: ''
  };
  const [newPhone, setNewPhone] = useState<NewPhoneEntryData>(initialNewPhoneState);
  const [purchaseDateSelected, setPurchaseDateSelected] = useState<Date | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof NewPhoneEntryData | 'purchaseDate', string>>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isFetchingPartners, setIsFetchingPartners] = useState(true);
  const [notification, setNotification] = useState<NotificationMessage | null>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPhone, setEditingPhone] = useState<Partial<PhoneEntry>>({}); // Use PhoneEntry for existing data structure
  const [editPurchaseDateSelected, setEditPurchaseDateSelected] = useState<Date | null>(null);
  const [editFormErrors, setEditFormErrors] = useState<Partial<Record<keyof PhoneEntryUpdatePayload | 'purchaseDate', string>>>({});
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingPhoneId, setDeletingPhoneId] = useState<number | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // Barcode State
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [selectedPhoneForBarcode, setSelectedPhoneForBarcode] = useState<PhoneEntry | null>(null);

  const fetchPhones = async () => {
    if (!token) return;
    setIsFetching(true); setNotification(null);
    try {
      const response = await fetch('/api/phones', { headers: getAuthHeaders(token) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'خطا در دریافت لیست گوشی‌ها');
      setPhones(result.data); setFilteredPhones(result.data);
    } catch (error: any) { setNotification({ type: 'error', text: error.message || 'یک خطای ناشناخته هنگام دریافت گوشی‌ها رخ داد.' });
    } finally { setIsFetching(false); }
  };

  const fetchPartners = async () => {
    if (!token) return;
    setIsFetchingPartners(true);
    try {
      // Assuming partnerType filter is supported, otherwise fetch all and filter client-side
      const response = await fetch('/api/partners?partnerType=Supplier', { headers: getAuthHeaders(token) }); 
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'خطا در دریافت لیست تامین‌کنندگان');
      setPartners(result.data.filter((p: Partner) => p.partnerType === 'Supplier'));
    } catch (error: any) { setNotification({ type: 'error', text: error.message || 'یک خطای ناشناخته هنگام دریافت تامین‌کنندگان رخ داد.' });
    } finally { setIsFetchingPartners(false); }
  };

  useEffect(() => { 
    if(token) {
        fetchPhones(); 
        fetchPartners(); 
    }
  }, [token]);

  useEffect(() => {
    const lowerSearchTerm = searchTerm.toLowerCase().trim();
    if (!lowerSearchTerm) { setFilteredPhones(phones); return; }
    const filtered = phones.filter(p =>
      p.model.toLowerCase().includes(lowerSearchTerm) ||
      p.imei.toLowerCase().includes(lowerSearchTerm) ||
      (p.color && p.color.toLowerCase().includes(lowerSearchTerm)) ||
      (p.status && p.status.toLowerCase().includes(lowerSearchTerm)) ||
      (p.supplierName && p.supplierName.toLowerCase().includes(lowerSearchTerm))
    );
    setFilteredPhones(filtered);
  }, [searchTerm, phones]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | { target: { name: string, value: string } }) => {
    const { name, value } = e.target;
    setNewPhone(prev => ({ ...prev, [name]: value }));
    if (formErrors[name as keyof NewPhoneEntryData]) {
      setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (data: NewPhoneEntryData | PhoneEntryUpdatePayload, isEdit = false): boolean => {
    const errors: Partial<Record<keyof NewPhoneEntryData | 'purchaseDate' | keyof PhoneEntryUpdatePayload, string>> = {};
    if (!data.model?.trim() && !isEdit) errors.model = 'مدل الزامی است.';
    if (data.model && data.model.trim() === '') errors.model = 'مدل نمی‌تواند خالی باشد.';

    if (!data.imei?.trim() && !isEdit) errors.imei = 'IMEI الزامی است.';
    else if (data.imei && !/^\d{15,16}$/.test(data.imei.trim())) errors.imei = 'IMEI باید ۱۵ یا ۱۶ رقم باشد.';

    const purchasePriceStr = String(data.purchasePrice);
    if ((!purchasePriceStr.trim() && !isEdit) || (purchasePriceStr.trim() && (isNaN(parseFloat(purchasePriceStr)) || parseFloat(purchasePriceStr) < 0))) {
      errors.purchasePrice = 'قیمت خرید باید عددی غیرمنفی باشد.';
    } else if (parseFloat(purchasePriceStr) > 0 && !data.supplierId) {
        errors.supplierId = 'برای ثبت قیمت خرید، انتخاب تامین‌کننده الزامی است.';
    }
    
    const salePriceStr = String(data.salePrice);
    if (data.salePrice && salePriceStr.trim() && (isNaN(parseFloat(salePriceStr)) || parseFloat(salePriceStr) < 0)) {
      errors.salePrice = 'قیمت فروش (در صورت وجود) باید عددی غیرمنفی باشد.';
    }

    const batteryHealthStr = String(data.batteryHealth);
    if (data.batteryHealth && batteryHealthStr.trim() && (isNaN(parseInt(batteryHealthStr, 10)) || parseInt(batteryHealthStr, 10) < 0 || parseInt(batteryHealthStr, 10) > 100)) {
      errors.batteryHealth = 'سلامت باتری باید عددی بین ۰ تا ۱۰۰ باشد.';
    }
    if (!data.status && !isEdit) errors.status = 'وضعیت الزامی است.';

    if (isEdit) setEditFormErrors(errors); else setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm(newPhone) || !token) return;
    setIsLoading(true); setNotification(null);
    const dataToSubmit: PhoneEntryPayload = {
      model: newPhone.model, color: newPhone.color || undefined, storage: newPhone.storage || undefined, ram: newPhone.ram || undefined,
      imei: newPhone.imei, batteryHealth: newPhone.batteryHealth ? parseInt(String(newPhone.batteryHealth), 10) : undefined,
      condition: newPhone.condition || undefined, purchasePrice: parseFloat(String(newPhone.purchasePrice)),
      salePrice: newPhone.salePrice ? parseFloat(String(newPhone.salePrice)) : undefined,
      sellerName: newPhone.sellerName || undefined, purchaseDate: fromDatePickerToISO_YYYY_MM_DD(purchaseDateSelected),
      saleDate: undefined, status: newPhone.status || PHONE_STATUSES[0], notes: newPhone.notes || undefined,
      supplierId: newPhone.supplierId ? parseInt(String(newPhone.supplierId), 10) : null, registerDate: new Date().toISOString()
    };
    try {
      const response = await fetch('/api/phones', { method: 'POST', headers: getAuthHeaders(token), body: JSON.stringify(dataToSubmit) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'خطا در افزودن گوشی');
      setNewPhone(initialNewPhoneState); setPurchaseDateSelected(null); setFormErrors({});
      setNotification({ type: 'success', text: 'گوشی با موفقیت اضافه شد!' });
      await fetchPhones();
    } catch (error: any) {
      const errorMessage = error.message || 'یک خطای ناشناخته هنگام افزودن گوشی رخ داد.';
      setNotification({ type: 'error', text: errorMessage });
      if (errorMessage.includes('IMEI تکراری')) setFormErrors(prev => ({ ...prev, imei: 'این شماره IMEI قبلا ثبت شده است.' }));
    } finally { setIsLoading(false); }
  };

  // Edit Functions
  const openEditModal = (phone: PhoneEntry) => {
    setEditingPhone({ ...phone }); // Copy to avoid direct state mutation
    setEditPurchaseDateSelected(phone.purchaseDate ? moment(phone.purchaseDate, 'YYYY-MM-DD').toDate() : null);
    setEditFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleEditInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | { target: { name: string, value: string } }) => {
    const { name, value } = e.target;
    setEditingPhone(prev => ({ ...prev, [name]: value }));
    if (editFormErrors[name as keyof PhoneEntryUpdatePayload]) {
      setEditFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };
  
  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingPhone.id || !validateForm(editingPhone as PhoneEntryUpdatePayload, true) || !token) return;
    setIsSubmittingEdit(true); setNotification(null);

    const payload: PhoneEntryUpdatePayload = {
        model: editingPhone.model,
        color: editingPhone.color,
        storage: editingPhone.storage,
        ram: editingPhone.ram,
        imei: editingPhone.imei,
        batteryHealth: editingPhone.batteryHealth ? String(editingPhone.batteryHealth) : undefined,
        condition: editingPhone.condition,
        purchasePrice: editingPhone.purchasePrice ? String(editingPhone.purchasePrice) : undefined,
        salePrice: editingPhone.salePrice ? String(editingPhone.salePrice) : undefined,
        sellerName: editingPhone.sellerName,
        purchaseDate: fromDatePickerToISO_YYYY_MM_DD(editPurchaseDateSelected), // Convert selected Shamsi date to ISO
        status: editingPhone.status,
        notes: editingPhone.notes,
        supplierId: editingPhone.supplierId ? String(editingPhone.supplierId) : undefined,
    };

    try {
      const response = await fetch(`/api/phones/${editingPhone.id}`, { method: 'PUT', headers: getAuthHeaders(token), body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'خطا در به‌روزرسانی گوشی');
      setNotification({ type: 'success', text: result.message || 'گوشی با موفقیت به‌روزرسانی شد!'});
      setIsEditModalOpen(false); setEditingPhone({});
      await fetchPhones();
    } catch (error: any) {
      const errorMessage = error.message || 'یک خطای ناشناخته رخ داد.';
      setNotification({ type: 'error', text: errorMessage });
      if (errorMessage.includes('IMEI تکراری')) setEditFormErrors(prev => ({ ...prev, imei: 'این شماره IMEI قبلا برای گوشی دیگری ثبت شده است.' }));
    } finally { setIsSubmittingEdit(false); }
  };

  // Delete Functions
  const openDeleteModal = (phoneId: number) => { setDeletingPhoneId(phoneId); setIsDeleteModalOpen(true); };
  const handleConfirmDelete = async () => {
    if (!deletingPhoneId || !token) return;
    setIsSubmittingDelete(true); setNotification(null);
    try {
      const response = await fetch(`/api/phones/${deletingPhoneId}`, { method: 'DELETE', headers: getAuthHeaders(token) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'خطا در حذف گوشی');
      setNotification({ type: 'success', text: result.message || 'گوشی با موفقیت حذف شد.' });
      setIsDeleteModalOpen(false); setDeletingPhoneId(null);
      await fetchPhones();
    } catch (error: any) {
      setNotification({ type: 'error', text: error.message || 'خطا در حذف گوشی.'});
    } finally { setIsSubmittingDelete(false); }
  };
  
  // Sell Function
  const handleSellPhone = (phone: PhoneEntry) => {
    if (phone.status !== "موجود در انبار") {
        setNotification({ type: 'warning', text: `گوشی در وضعیت "${phone.status}" قرار دارد و قابل فروش نیست.` });
        return;
    }
    if (!phone.salePrice || phone.salePrice <= 0) {
        setNotification({ type: 'warning', text: 'قیمت فروش برای این گوشی مشخص نشده یا نامعتبر است.' });
        return;
    }
    // Navigate to Sales page with pre-filled data for this phone
    navigate(`/sales?type=phone&id=${phone.id}`);
  };

  const openBarcodeModal = (phone: PhoneEntry) => {
      setSelectedPhoneForBarcode(phone);
      setIsBarcodeModalOpen(true);
  };

  const formatPrice = (price: number | undefined | null) => {
    if (price === undefined || price === null) return '-';
    return price.toLocaleString('fa-IR') + ' تومان';
  };

  const getStatusColor = (status: PhoneStatus): string => {
    switch (status) {
      case "موجود در انبار": return "bg-green-100 text-green-800";
      case "فروخته شده": return "bg-red-100 text-red-800";
      case "فروخته شده (قسطی)": return "bg-orange-100 text-orange-800";
      case "مرجوعی": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const inputClass = (fieldName?: keyof NewPhoneEntryData | 'purchaseDate' | keyof PhoneEntryUpdatePayload, isSelect = false, errorsObject?: any) => {
    const currentErrors = errorsObject || formErrors;
    return `w-full p-2.5 border rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right ${isSelect ? 'bg-white ' : ''}${fieldName && currentErrors[fieldName] ? 'border-red-500 ring-red-300' : 'border-gray-300'}`;
  }
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <Notification message={notification} onClose={() => setNotification(null)} />

      {/* Add New Phone Form */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-6 border-b pb-4">افزودن گوشی موبایل جدید</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Form fields for adding a new phone (same as before) */}
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="model" className={labelClass}>مدل <span className="text-red-500">*</span></label>
              <input type="text" id="model" name="model" value={newPhone.model} onChange={handleInputChange} className={inputClass('model')} placeholder="مثال: iPhone 15 Pro"/>
              {formErrors.model && <p className="mt-1 text-xs text-red-600">{formErrors.model}</p>}
            </div>
            <div>
              <label htmlFor="imei" className={labelClass}>IMEI <span className="text-red-500">*</span></label>
              <input type="text" id="imei" name="imei" value={newPhone.imei} onChange={handleInputChange} className={inputClass('imei')} placeholder="۱۵ یا ۱۶ رقم سریال"/>
              {formErrors.imei && <p className="mt-1 text-xs text-red-600">{formErrors.imei}</p>}
            </div>
             <div>
              <label htmlFor="condition" className={labelClass}>وضعیت ظاهری</label>
              <select id="condition" name="condition" value={newPhone.condition} onChange={handleInputChange} className={inputClass('condition', true)}>
                {PHONE_CONDITIONS.map(cond => <option key={cond} value={cond}>{cond}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="color" className={labelClass}>رنگ</label>
              <input type="text" id="color" name="color" value={newPhone.color || ''} onChange={handleInputChange} className={inputClass('color')} placeholder="مثال: آبی تیتانیوم"/>
            </div>
            <div>
              <label htmlFor="storage" className={labelClass}>حافظه داخلی</label>
              <select id="storage" name="storage" value={newPhone.storage} onChange={handleInputChange} className={inputClass('storage', true)}>
                {PHONE_STORAGE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ram" className={labelClass}>رَم</label>
              <select id="ram" name="ram" value={newPhone.ram} onChange={handleInputChange} className={inputClass('ram', true)}>
                {PHONE_RAM_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="purchasePrice" className={labelClass}>قیمت خرید (تومان) <span className="text-red-500">*</span></label>
              <PriceInput id="purchasePrice" name="purchasePrice" value={String(newPhone.purchasePrice)} onChange={handleInputChange} className={`${inputClass('purchasePrice')} text-left`} placeholder="مثال: ۳۵۰۰۰۰۰۰" />
              {formErrors.purchasePrice && <p className="mt-1 text-xs text-red-600">{formErrors.purchasePrice}</p>}
            </div>
            <div>
              <label htmlFor="supplierId" className={labelClass}>تامین‌کننده</label>
              <select
                id="supplierId" name="supplierId" value={newPhone.supplierId || ''}
                onChange={handleInputChange} className={inputClass('supplierId', true)}
                disabled={isFetchingPartners}
              >
                <option value="">-- انتخاب تامین‌کننده --</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.partnerName}</option>)}
              </select>
              {isFetchingPartners && <p className="text-xs text-gray-500 mt-1">درحال بارگذاری تامین‌کنندگان...</p>}
              {formErrors.supplierId && <p className="mt-1 text-xs text-red-600">{formErrors.supplierId}</p>}
            </div>
             <div>
              <label htmlFor="batteryHealth" className={labelClass}>سلامت باتری (٪)</label>
              <input type="number" id="batteryHealth" name="batteryHealth" value={newPhone.batteryHealth} onChange={handleInputChange} className={inputClass('batteryHealth')} placeholder="مثال: ۹۵" min="0" max="100"/>
               {formErrors.batteryHealth && <p className="mt-1 text-xs text-red-600">{formErrors.batteryHealth}</p>}
            </div>
             <div>
              <label htmlFor="purchaseDatePicker" className={labelClass}>تاریخ خرید</label>
              <ShamsiDatePicker
                id="purchaseDatePicker"
                selectedDate={purchaseDateSelected}
                onDateChange={setPurchaseDateSelected}
                inputClassName={inputClass(formErrors.purchaseDate ? 'purchaseDate' : undefined)}
              />
              {formErrors.purchaseDate && <p className="mt-1 text-xs text-red-600">{formErrors.purchaseDate}</p>}
            </div>
             <div className="space-y-1">
              <label htmlFor="salePrice" className={labelClass}>قیمت فروش (تومان)</label>
              <PriceInput id="salePrice" name="salePrice" value={String(newPhone.salePrice || '')} onChange={handleInputChange} className={`${inputClass('salePrice')} text-left`} placeholder="مثال: ۳۸۵۰۰۰۰۰" />
              {formErrors.salePrice && <p className="mt-1 text-xs text-red-600">{formErrors.salePrice}</p>}
            </div>
             <div>
              <label htmlFor="status" className={labelClass}>وضعیت <span className="text-red-500">*</span></label>
              <select id="status" name="status" value={newPhone.status} onChange={handleInputChange} className={inputClass('status', true)}>
                {PHONE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {formErrors.status && <p className="mt-1 text-xs text-red-600">{formErrors.status}</p>}
            </div>
          </div>
          <div className="md:col-span-2 lg:col-span-3">
            <label htmlFor="notes" className={labelClass}>یادداشت‌ها</label>
            <textarea id="notes" name="notes" value={newPhone.notes || ''} onChange={handleInputChange} rows={3} className={inputClass('notes')}></textarea>
          </div>

          <button type="submit" disabled={isLoading || isFetching || isFetchingPartners || !token}
            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-400 transition-colors">
            {isLoading ? (<><i className="fas fa-spinner fa-spin ml-2"></i>در حال افزودن...</>) : 'افزودن گوشی'}
          </button>
        </form>
      </div>

      {/* Phone List */}
      <div className="bg-white rounded-xl shadow-lg">
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 border-b border-gray-200 gap-3">
          <h3 className="text-lg font-semibold text-gray-800">لیست گوشی‌های ثبت شده</h3>
          <div className="relative w-full sm:w-64 md:w-80">
            <input type="text" placeholder="جستجو بر اساس مدل، IMEI، تامین‌کننده..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none text-right"/>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"><i className="fa-solid fa-search text-gray-400"></i></div>
          </div>
        </div>
        {isFetching ? ( <div className="p-10 text-center text-gray-500"><i className="fas fa-spinner fa-spin text-3xl mb-3"></i><p>در حال بارگذاری گوشی‌ها...</p></div>
        ) : phones.length === 0 ? ( <div className="p-10 text-center text-gray-500"><i className="fas fa-mobile-alt text-3xl text-gray-400 mb-3"></i><p>هنوز هیچ گوشی ثبت نشده است.</p></div>
        ) : filteredPhones.length === 0 && searchTerm ? ( <div className="p-10 text-center text-gray-500"><i className="fas fa-search-minus text-3xl text-gray-400 mb-3"></i><p>موردی با عبارت جستجو شده یافت نشد.</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 p-4 sm:p-6">
            {filteredPhones.map((phone) => (
              <div key={phone.id} className="bg-gray-50 rounded-lg shadow-md p-4 border border-gray-200 hover:shadow-lg transition-shadow duration-200 flex flex-col justify-between">
                <div>
                    <div className="flex justify-between items-start mb-2">
                    <h4 className="text-md font-bold text-indigo-700">{phone.model}</h4>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusColor(phone.status)}`}>{phone.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2" dir="ltr">IMEI: {phone.imei}</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-3">
                        {/* Details */}
                        <p><strong className="text-gray-600">رنگ:</strong> {phone.color || '-'}</p>
                        <p><strong className="text-gray-600">حافظه:</strong> {phone.storage || '-'}</p>
                        <p><strong className="text-gray-600">رم:</strong> {phone.ram || '-'}</p>
                        <p><strong className="text-gray-600">وضعیت:</strong> {phone.condition || '-'}</p>
                        {phone.batteryHealth !== null && <p><strong className="text-gray-600">باتری:</strong> {phone.batteryHealth}%</p>}
                        {phone.supplierName && <p><strong className="text-gray-600">تامین‌کننده:</strong> {phone.supplierName}</p>}
                    </div>
                    <div className="border-t pt-2 mt-2 text-xs space-y-1">
                        <p><strong className="text-gray-600">قیمت خرید:</strong> {formatPrice(phone.purchasePrice)}</p>
                        {phone.salePrice !== null && <p><strong className="text-gray-600">قیمت فروش فعلی:</strong> {formatPrice(phone.salePrice)}</p>}
                        <p><strong className="text-gray-600">تاریخ ثبت سیستمی:</strong> {formatIsoToShamsiDateTime(phone.registerDate)}</p>
                        {phone.purchaseDate && <p><strong className="text-gray-600">تاریخ خرید:</strong> {formatIsoToShamsi(phone.purchaseDate)}</p>}
                        {phone.saleDate && (phone.status === "فروخته شده" || phone.status === "فروخته شده (قسطی)") && <p><strong className="text-gray-600">تاریخ فروش:</strong> {formatIsoToShamsi(phone.saleDate)}</p>}
                    </div>
                    {phone.notes && <div className="border-t pt-2 mt-2"><p className="text-xs text-gray-700"><strong className="text-gray-600">یادداشت:</strong> {phone.notes}</p></div>}
                </div>
                <div className="flex justify-end items-center mt-4 pt-3 border-t border-gray-200 space-x-2 space-x-reverse">
                    <button onClick={() => openBarcodeModal(phone)} className="p-2 text-sm text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-100" title="چاپ بارکد"><i className="fas fa-barcode"></i></button>
                    <button onClick={() => handleSellPhone(phone)} className="px-3 py-1.5 text-xs bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-300" disabled={phone.status !== "موجود در انبار"} title="فروش این گوشی"><i className="fas fa-cash-register ml-1"></i> فروش</button>
                    <button onClick={() => openEditModal(phone)} className="p-2 text-sm text-blue-600 hover:text-blue-800 rounded-md hover:bg-blue-50" title="ویرایش"><i className="fas fa-edit"></i></button>
                    <button onClick={() => openDeleteModal(phone.id)} className="p-2 text-sm text-red-600 hover:text-red-800 rounded-md hover:bg-red-50" title="حذف"><i className="fas fa-trash"></i></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Phone Modal */}
      {isEditModalOpen && editingPhone.id && (
        <Modal title={`ویرایش گوشی: ${editingPhone.model} (IMEI: ${editingPhone.imei})`} onClose={() => setIsEditModalOpen(false)} widthClass="max-w-2xl">
          <form onSubmit={handleEditSubmit} className="space-y-4 p-2 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Model, IMEI, Condition */}
                <div><label htmlFor="edit_model" className={labelClass}>مدل</label><input type="text" id="edit_model" name="model" value={editingPhone.model || ''} onChange={handleEditInputChange} className={inputClass('model', false, editFormErrors)} />{editFormErrors.model && <p className="text-xs text-red-500">{editFormErrors.model}</p>}</div>
                <div><label htmlFor="edit_imei" className={labelClass}>IMEI</label><input type="text" id="edit_imei" name="imei" value={editingPhone.imei || ''} onChange={handleEditInputChange} className={inputClass('imei', false, editFormErrors)} />{editFormErrors.imei && <p className="text-xs text-red-500">{editFormErrors.imei}</p>}</div>
                <div><label htmlFor="edit_condition" className={labelClass}>وضعیت ظاهری</label><select id="edit_condition" name="condition" value={editingPhone.condition || ''} onChange={handleEditInputChange} className={inputClass('condition', true, editFormErrors)}>{PHONE_CONDITIONS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                {/* Color, Storage, RAM */}
                <div><label htmlFor="edit_color" className={labelClass}>رنگ</label><input type="text" id="edit_color" name="color" value={editingPhone.color || ''} onChange={handleEditInputChange} className={inputClass('color', false, editFormErrors)} /></div>
                <div><label htmlFor="edit_storage" className={labelClass}>حافظه</label><select id="edit_storage" name="storage" value={editingPhone.storage || ''} onChange={handleEditInputChange} className={inputClass('storage', true, editFormErrors)}>{PHONE_STORAGE_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                <div><label htmlFor="edit_ram" className={labelClass}>رم</label><select id="edit_ram" name="ram" value={editingPhone.ram || ''} onChange={handleEditInputChange} className={inputClass('ram', true, editFormErrors)}>{PHONE_RAM_OPTIONS.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
                {/* Purchase Price, Supplier, Battery Health */}
                <div className="space-y-1"><label htmlFor="edit_purchasePrice" className={labelClass}>قیمت خرید</label><PriceInput id="edit_purchasePrice" name="purchasePrice" value={String(editingPhone.purchasePrice || '')} onChange={handleEditInputChange} className={`${inputClass('purchasePrice', false, editFormErrors)} text-left`} />{editFormErrors.purchasePrice && <p className="text-xs text-red-500">{editFormErrors.purchasePrice}</p>}</div>
                <div><label htmlFor="edit_supplierId" className={labelClass}>تامین‌کننده</label><select id="edit_supplierId" name="supplierId" value={editingPhone.supplierId || ''} onChange={handleEditInputChange} className={inputClass('supplierId', true, editFormErrors)} disabled={isFetchingPartners}><option value="">-- انتخاب --</option>{partners.map(p=><option key={p.id} value={p.id}>{p.partnerName}</option>)}</select>{editFormErrors.supplierId && <p className="text-xs text-red-500">{editFormErrors.supplierId}</p>}</div>
                <div><label htmlFor="edit_batteryHealth" className={labelClass}>سلامت باتری (٪)</label><input type="number" id="edit_batteryHealth" name="batteryHealth" value={editingPhone.batteryHealth || ''} onChange={handleEditInputChange} className={inputClass('batteryHealth', false, editFormErrors)} />{editFormErrors.batteryHealth && <p className="text-xs text-red-500">{editFormErrors.batteryHealth}</p>}</div>
                {/* Purchase Date, Sale Price, Status */}
                <div><label htmlFor="edit_purchaseDate" className={labelClass}>تاریخ خرید</label><ShamsiDatePicker id="edit_purchaseDate" selectedDate={editPurchaseDateSelected} onDateChange={setEditPurchaseDateSelected} inputClassName={inputClass('purchaseDate', false, editFormErrors)} />{editFormErrors.purchaseDate && <p className="text-xs text-red-500">{editFormErrors.purchaseDate}</p>}</div>
                <div className="space-y-1"><label htmlFor="edit_salePrice" className={labelClass}>قیمت فروش</label><PriceInput id="edit_salePrice" name="salePrice" value={String(editingPhone.salePrice || '')} onChange={handleEditInputChange} className={`${inputClass('salePrice', false, editFormErrors)} text-left`} />{editFormErrors.salePrice && <p className="text-xs text-red-500">{editFormErrors.salePrice}</p>}</div>
                <div><label htmlFor="edit_status" className={labelClass}>وضعیت</label><select id="edit_status" name="status" value={editingPhone.status || ''} onChange={handleEditInputChange} className={inputClass('status', true, editFormErrors)}>{PHONE_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
            </div>
            <div className="md:col-span-full"><label htmlFor="edit_notes" className={labelClass}>یادداشت</label><textarea id="edit_notes" name="notes" value={editingPhone.notes || ''} onChange={handleEditInputChange} rows={2} className={inputClass('notes', false, editFormErrors)}></textarea></div>
            <div className="flex justify-end pt-4 space-x-3 space-x-reverse border-t">
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">انصراف</button>
              <button type="submit" disabled={isSubmittingEdit || !token} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400">
                {isSubmittingEdit ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Phone Modal */}
      {isDeleteModalOpen && deletingPhoneId !== null && (
        <Modal title="تایید حذف گوشی" onClose={() => setIsDeleteModalOpen(false)}>
          <p className="text-sm text-gray-700 mb-4">آیا از حذف این گوشی موبایل مطمئن هستید؟ این عمل قابل بازگشت نیست و در صورت وجود سوابق خرید، در دفتر حساب تامین‌کننده معکوس خواهد شد.</p>
          <div className="flex justify-end pt-3 space-x-3 space-x-reverse">
            <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">انصراف</button>
            <button onClick={handleConfirmDelete} disabled={isSubmittingDelete || !token} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400">
              {isSubmittingDelete ? 'در حال حذف...' : 'تایید و حذف'}
            </button>
          </div>
        </Modal>
      )}

       {isBarcodeModalOpen && selectedPhoneForBarcode && (
          <Modal 
            title={`بارکد برای: ${selectedPhoneForBarcode.model}`} 
            onClose={() => setIsBarcodeModalOpen(false)}
            widthClass="max-w-sm"
            wrapperClassName="printable-area"
          >
              <div id="barcode-label-content" className="text-center p-4">
                  <img 
                      src={`/api/barcode/phone/${selectedPhoneForBarcode.id}`} 
                      alt={`Barcode for ${selectedPhoneForBarcode.model}`}
                      className="mx-auto"
                  />
                  <p className="mt-2 font-semibold text-lg">{selectedPhoneForBarcode.model}</p>
                  <p className="text-md text-gray-600">IMEI: {selectedPhoneForBarcode.imei}</p>
                  <p className="text-md text-gray-600">{formatPrice(selectedPhoneForBarcode.salePrice)}</p>
              </div>
              <div className="flex justify-end pt-4 mt-4 border-t dark:border-gray-700 print:hidden">
                  <button 
                      type="button" 
                      onClick={() => window.print()}
                      className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700"
                  >
                      <i className="fas fa-print ml-2"></i>چاپ برچسب
                  </button>
              </div>
          </Modal>
      )}
    </div>
  );
};

export default MobilePhonesPage;