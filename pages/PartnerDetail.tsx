// src/pages/PartnerDetailPage.tsx
import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import moment from 'jalali-moment';

import {
  PartnerDetailsPageData,
  NotificationMessage,
  NewPartnerData,
  NewLedgerEntryData,
} from '../types';
import Notification from '../components/Notification';
import Modal from '../components/Modal';
import ShamsiDatePicker from '../components/ShamsiDatePicker';
import PriceInput from '../components/PriceInput';
import { formatIsoToShamsi, formatIsoToShamsiDateTime } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import { PARTNER_TYPES } from '../constants';

/* ------------------------------------------------------------------ */
/* Helper functions                                                    */
/* ------------------------------------------------------------------ */

// فارسی -> انگلیسی برای اعداد
const fa2en = (s: string = '') =>
  s.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());

// تبدیل عمومی به عدد
const num = (v: any): number =>
  typeof v === 'string' ? Number(v.replace(/[^\d.-]/g, '')) || 0 : Number(v) || 0;

// انتخاب اولین عدد معتبر از بین چند کلید
const pickNumber = (obj: any, keys: string[]): number => {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && !isNaN(num(obj[k]))) {
      return num(obj[k]);
    }
  }
  return 0;
};

// استخراج تعداد از متن (مثال: "10 عدد کابل ...")
const extractQtyFromText = (txt?: string): number => {
  if (!txt) return 0;
  const m = fa2en(txt).match(/(\d+)\s*(?:عدد|تا|pcs?)/i);
  return m ? Number(m[1]) : 0;
};

// استخراج مبلغ کل از متن (مثال: "به ارزش کل 1,000,000")
const extractTotalFromText = (txt?: string): number => {
  if (!txt) return 0;
  const m = fa2en(txt).match(/(?:ارزش|مبلغ|جمع)\s*(?:کل)?\s*([\d,]+)/i);
  return m ? Number(m[1].replace(/,/g, '')) : 0;
};

type QtyPrice = { qty?: number; total?: number };

const QTY_KEYS = [
  'quantityPurchased',
  'quantity',
  'qty',
  'count',
  'countPurchased',
  'pieces',
  'units',
  'number',
  'amountPurchased',
  'qtyPurchased',
  'qty_buy',
];

const UNIT_KEYS = [
  'purchasePrice',
  'unitPrice',
  'purchaseUnitPrice',
  'pricePerUnit',
  'price',
  'unit_price',
  'buyPrice',
];

const TOTAL_KEYS = [
  'totalPrice',
  'total_cost',
  'total',
  'sum',
  'amount',
  'grandTotal',
  'credit',
  'lineTotal',
];

const formatPartnerLedgerCurrency = (
  amount?: number,
  type?: 'debit' | 'credit' | 'balance'
) => {
  if (amount === undefined || amount === null)
    return <span className="text-gray-700">۰ تومان</span>;

  let amountStr = Math.abs(amount).toLocaleString('fa-IR') + ' تومان';
  let color = 'text-gray-700';

  if (type === 'balance') {
    if (amount > 0) {
      color = 'text-red-600 font-semibold';
      amountStr += ' (بدهی شما به همکار)';
    } else if (amount < 0) {
      color = 'text-green-700 font-semibold';
      amountStr =
        Math.abs(amount).toLocaleString('fa-IR') + ' تومان (طلب شما از همکار)';
    } else {
      amountStr += ' (تسویه شده)';
    }
  } else if (type === 'debit' && amount > 0) {
    color = 'text-green-600';
  } else if (type === 'credit' && amount > 0) {
    color = 'text-red-500';
  }

  return <span className={color}>{amountStr}</span>;
};

const formatPrice = (price?: number | null) =>
  price == null ? '-' : price.toLocaleString('fa-IR') + ' تومان';

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const PartnerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [partnerData, setPartnerData] = useState<PartnerDetailsPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationMessage | null>(null);

  // Edit partner modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partial<NewPartnerData>>({});
  const [editFormErrors, setEditFormErrors] = useState<Partial<NewPartnerData>>({});
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Ledger modal
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const initialLedgerEntry: NewLedgerEntryData = { description: '', debit: 0, credit: 0 };
  const [newLedgerEntry, setNewLedgerEntry] =
    useState<NewLedgerEntryData>(initialLedgerEntry);
  const [ledgerDateSelected, setLedgerDateSelected] = useState<Date | null>(new Date());
  const [ledgerFormErrors, setLedgerFormErrors] = useState<
    Partial<NewLedgerEntryData & { amount?: string; transactionDate?: string }>
  >({});
  const [isSubmittingLedger, setIsSubmittingLedger] = useState(false);

  // Map استخراج شده از دفتر حساب
  const [ledgerMap, setLedgerMap] = useState<Record<string, QtyPrice>>({});

  /* ---------------- Fetch ---------------- */
  const fetchPartnerDetails = async () => {
    if (!id || !token) return;
    setIsLoading(true);
    try {
      const response = await apiFetch(`/api/partners/${id}`);
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.message || 'خطا در دریافت اطلاعات همکار');

      const data: PartnerDetailsPageData = result.data;
      setPartnerData(data);

      // Build ledger map
      const map: Record<string, QtyPrice> = {};
      data.ledger.forEach((l) => {
        if (!l.description) return;
        const descFa = l.description;
        const descEN = fa2en(descFa);

        const prodIdMatch = descEN.match(/شناسه\s*(?:محصول|کالا)\s*:?(\d+)/i);
        const prodId = prodIdMatch ? prodIdMatch[1] : undefined;

        const qty = extractQtyFromText(descFa);
        const total = extractTotalFromText(descFa) || (l.credit ? Number(l.credit) : 0);

        if (!qty && !total) return;

        if (prodId) {
          map[`id_${prodId}`] = {
            qty: qty || map[`id_${prodId}`]?.qty,
            total: total || map[`id_${prodId}`]?.total,
          };
        }

        // Backup by name (rough match)
        const nameMatch = descFa.match(/عدد\s+(.+?)(?:\(|به|،|$)/);
        if (nameMatch) {
          const n = nameMatch[1].trim();
          map[`name_${n}`] = {
            qty: qty || map[`name_${n}`]?.qty,
            total: total || map[`name_${n}`]?.total,
          };
        }
      });

      setLedgerMap(map);
    } catch (error: any) {
      setNotification({ type: 'error', text: error.message });
      if (error.message.includes('یافت نشد')) {
        setTimeout(() => navigate('/partners'), 2000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchPartnerDetails();
  }, [id, token]);

  /* ---------------- Edit Partner ---------------- */
  const openEditModal = () => {
    if (!partnerData?.profile) return;
    const p = partnerData.profile;
    setEditingPartner({
      partnerName: p.partnerName,
      partnerType: p.partnerType,
      contactPerson: p.contactPerson || '',
      phoneNumber: p.phoneNumber || '',
      email: p.email || '',
      address: p.address || '',
      notes: p.notes || '',
    });
    setEditFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleEditInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setEditingPartner((prev) => ({ ...prev, [name]: value }));
    if (editFormErrors[name as keyof NewPartnerData]) {
      setEditFormErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateEditForm = (): boolean => {
    const errors: Partial<NewPartnerData> = {};
    if (!editingPartner.partnerName?.trim())
      errors.partnerName = 'نام همکار الزامی است.';
    if (!editingPartner.partnerType?.trim())
      errors.partnerType = 'نوع همکار الزامی است.';
    if (editingPartner.phoneNumber && !/^\d{10,15}$/.test(editingPartner.phoneNumber.trim()))
      errors.phoneNumber = 'شماره تماس نامعتبر است (۱۰ تا ۱۵ رقم).';
    if (editingPartner.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editingPartner.email.trim()))
      errors.email = 'ایمیل نامعتبر است.';
    setEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateEditForm() || !id || !token) return;
    setIsSubmittingEdit(true);
    setNotification(null);
    try {
      const response = await apiFetch(`/api/partners/${id}`, {
        method: 'PUT',
        body: JSON.stringify(editingPartner),
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.message || 'خطا در به‌روزرسانی اطلاعات همکار');

      setNotification({ type: 'success', text: 'اطلاعات همکار با موفقیت به‌روزرسانی شد!' });
      setIsEditModalOpen(false);
      fetchPartnerDetails();
    } catch (error: any) {
      setNotification({ type: 'error', text: error.message });
      if (
        error.message.toLowerCase().includes('تکراری') ||
        error.message.toLowerCase().includes('unique constraint')
      ) {
        setEditFormErrors((prev) => ({
          ...prev,
          phoneNumber: 'این شماره تماس قبلاً برای همکار دیگری ثبت شده است.',
        }));
      }
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  /* ---------------- Ledger ---------------- */
  const openLedgerModal = () => {
    setNewLedgerEntry({ ...initialLedgerEntry, debit: 0 });
    setLedgerDateSelected(new Date());
    setLedgerFormErrors({});
    setIsLedgerModalOpen(true);
  };

  const handleLedgerInputChange = (
    e:
      | ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      | { target: { name: string; value: string } }
  ) => {
    const { name, value } = e.target;
    if (name === 'amount') {
      const amountValue = num(value);
      setNewLedgerEntry((prev) => ({ ...prev, debit: amountValue, credit: 0 }));
    } else {
      setNewLedgerEntry((prev) => ({ ...prev, [name]: value }));
    }
    if (ledgerFormErrors[name as keyof NewLedgerEntryData] || ledgerFormErrors.amount) {
      setLedgerFormErrors((prev) => ({
        ...prev,
        [name]: undefined,
        amount: undefined,
        transactionDate: undefined,
      }));
    }
  };

  const validateLedgerForm = (): boolean => {
    const errors: Partial<NewLedgerEntryData & { amount?: string; transactionDate?: string }> =
      {};
    if (!newLedgerEntry.description?.trim())
      errors.description = 'شرح تراکنش (پرداخت) الزامی است.';
    const amount = newLedgerEntry.debit;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
      errors.amount = 'مبلغ پرداخت باید عددی مثبت باشد.';
    if (!ledgerDateSelected) errors.transactionDate = 'تاریخ پرداخت الزامی است.';
    setLedgerFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLedgerSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateLedgerForm() || !id || !ledgerDateSelected || !token) return;
    setIsSubmittingLedger(true);
    setNotification(null);

    const payload: NewLedgerEntryData = {
      description: newLedgerEntry.description!,
      debit: Number(newLedgerEntry.debit),
      credit: 0,
      transactionDate: moment(ledgerDateSelected).toISOString(),
    };

    try {
      const response = await apiFetch(`/api/partners/${id}/ledger`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.message || 'خطا در ثبت پرداخت به همکار');

      setNotification({ type: 'success', text: 'پرداخت با موفقیت ثبت شد!' });
      setIsLedgerModalOpen(false);
      fetchPartnerDetails();
    } catch (error: any) {
      setNotification({ type: 'error', text: error.message });
    } finally {
      setIsSubmittingLedger(false);
    }
  };

  /* ---------------- UI helpers ---------------- */
  const inputClass = (hasError: boolean, _isTextarea = false, isSelect = false) =>
    `w-full p-2.5 border rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right bg-white dark:bg-gray-800 dark:border-gray-600 ${
      isSelect ? 'bg-white ' : ''
    }${hasError ? 'border-red-500' : 'border-gray-300'}`;
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  /* ---------------- Render ---------------- */
  if (isLoading) {
    return (
      <div className="p-10 text-center text-gray-500">
        <i className="fas fa-spinner fa-spin text-3xl mb-3"></i>
        <p>در حال بارگذاری اطلاعات همکار...</p>
      </div>
    );
  }

  if (!partnerData) {
    return (
      <div className="p-10 text-center text-red-500">
        <i className="fas fa-exclamation-circle text-3xl mb-3"></i>
        <p>اطلاعات همکار یافت نشد یا خطایی رخ داده است.</p>
      </div>
    );
  }

  const { profile, ledger, purchaseHistory } = partnerData;
  const partnerTypeLabel =
    PARTNER_TYPES.find((p) => p.value === profile.partnerType)?.label ||
    profile.partnerType;

  return (
    <div className="space-y-8 text-right" dir="rtl">
      <Notification message={notification} onClose={() => setNotification(null)} />

      {/* Profile */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-4 border-b dark:border-gray-700 pb-4">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
            پروفایل همکار: {profile.partnerName} ({partnerTypeLabel})
          </h2>
          <button
            onClick={openEditModal}
            className="px-4 py-2 bg-sky-500 text-white font-medium rounded-lg hover:bg-sky-600 transition-colors text-sm"
          >
            <i className="fas fa-edit ml-2"></i>ویرایش پروفایل
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <p>
            <strong>شناسه همکار:</strong> {profile.id.toLocaleString('fa-IR')}
          </p>
          <p>
            <strong>تاریخ ثبت:</strong> {formatIsoToShamsi(profile.dateAdded)}
          </p>
          <p>
            <strong>فرد رابط:</strong> {profile.contactPerson || '-'}
          </p>
          <p>
            <strong>شماره تماس:</strong>{' '}
            <span dir="ltr">{profile.phoneNumber || '-'}</span>
          </p>
          <p>
            <strong>ایمیل:</strong> {profile.email || '-'}
          </p>
          <p className="md:col-span-2">
            <strong>آدرس:</strong> {profile.address || '-'}
          </p>
          <p className="md:col-span-2">
            <strong>یادداشت‌ها:</strong> {profile.notes || '-'}
          </p>
        </div>
      </div>

      {/* Ledger */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-4 border-b dark:border-gray-700 pb-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            دفتر حساب همکار
          </h2>
          <button
            onClick={openLedgerModal}
            className="px-4 py-2 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 transition-colors text-sm"
          >
            <i className="fas fa-money-bill-wave ml-2"></i>ثبت پرداخت به همکار
          </button>
        </div>

        <div className="mb-4 p-4 bg-teal-50 dark:bg-teal-900/50 rounded-lg">
          <p className="text-lg font-bold text-teal-700 dark:text-teal-300">
            موجودی نهایی حساب:{' '}
            {formatPartnerLedgerCurrency(profile.currentBalance, 'balance')}
          </p>
        </div>

        {ledger.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            هیچ تراکنشی در دفتر حساب این همکار ثبت نشده است.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-2 text-right font-semibold">تاریخ</th>
                  <th className="px-4 py-2 text-right font-semibold">شرح</th>
                  <th className="px-4 py-2 text-right font-semibold">
                    پرداختی شما (بدهکار)
                  </th>
                  <th className="px-4 py-2 text-right font-semibold">
                    دریافتی شما/ارزش کالا (بستانکار)
                  </th>
                  <th className="px-4 py-2 text-right font-semibold">مانده</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {ledger.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-2 whitespace-nowrap">
                      {formatIsoToShamsiDateTime(entry.transactionDate)}
                    </td>
                    <td className="px-4 py-2">{entry.description}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {formatPartnerLedgerCurrency(entry.debit, 'debit')}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {formatPartnerLedgerCurrency(entry.credit, 'credit')}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {formatPartnerLedgerCurrency(entry.balance, 'balance')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Purchase History */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4 border-b dark:border-gray-700 pb-4">
          تاریخچه خرید از این همکار
        </h2>

        {purchaseHistory.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            هنوز کالایی از این همکار خریداری نشده است.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-2 text-right font-semibold">
                    تاریخ خرید/ثبت
                  </th>
                  <th className="px-4 py-2 text-right font-semibold">نوع کالا</th>
                  <th className="px-4 py-2 text-right font-semibold">نام/مدل کالا</th>
                  <th className="px-4 py-2 text-right font-semibold">شناسه (IMEI)</th>
                  <th className="px-4 py-2 text-right font-semibold">
                    تعداد خریداری شده
                  </th>
                  <th className="px-4 py-2 text-right font-semibold">
                    قیمت خرید واحد
                  </th>
                  <th className="px-4 py-2 text-right font-semibold">
                    مبلغ کل (تومان)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {purchaseHistory.map((item) => {
                  // 1) مقادیر مستقیم از آیتم
                  let qty = pickNumber(item, QTY_KEYS);
                  let unit = pickNumber(item, UNIT_KEYS);
                  let total = pickNumber(item, TOTAL_KEYS);

                  // 2) اگر نیامده بود، از Map لجر براساس id یا name
                  if (!qty || !total) {
                    const byId = ledgerMap[`id_${item.id}`];
                    const byName = ledgerMap[`name_${item.name}`];
                    const fromLedger = byId || byName;
                    if (fromLedger) {
                      qty = qty || fromLedger.qty || 0;
                      total = total || fromLedger.total || 0;
                    }
                  }

                  // 3) Fallback نهایی
                  if (!qty && item.type === 'phone') qty = 1;
                  if (!total && qty && unit) total = qty * unit;
                  if (!unit && qty && total) unit = Math.round(total / qty);

                  return (
                    <tr
                      key={`${item.type}-${item.id}`}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-4 py-2 whitespace-nowrap">
                        {formatIsoToShamsi(item.purchaseDate)}
                      </td>
                      <td className="px-4 py-2">
                        {item.type === 'product' ? 'کالای انبار' : 'گوشی موبایل'}
                      </td>
                      <td className="px-4 py-2">{item.name}</td>
                      <td className="px-4 py-2">{item.identifier || '-'}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {qty ? qty.toLocaleString('fa-IR') : '-'}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {unit ? unit.toLocaleString('fa-IR') + ' تومان' : '-'}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap font-semibold">
                        {total ? total.toLocaleString('fa-IR') + ' تومان' : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Partner Modal */}
      {isEditModalOpen && (
        <Modal
          title="ویرایش اطلاعات همکار"
          onClose={() => setIsEditModalOpen(false)}
          widthClass="max-w-lg"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4 p-1">
            <div>
              <label htmlFor="editPartnerName" className={labelClass}>
                نام همکار <span className="text-red-500">*</span>
              </label>
              <input
                id="editPartnerName"
                name="partnerName"
                value={editingPartner.partnerName || ''}
                onChange={handleEditInputChange}
                className={inputClass(!!editFormErrors.partnerName)}
                required
              />
              {editFormErrors.partnerName && (
                <p className="mt-1 text-xs text-red-600">
                  {editFormErrors.partnerName}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="editPartnerType" className={labelClass}>
                نوع همکار <span className="text-red-500">*</span>
              </label>
              <select
                id="editPartnerType"
                name="partnerType"
                value={editingPartner.partnerType || ''}
                onChange={handleEditInputChange}
                className={inputClass(!!editFormErrors.partnerType, false, true)}
                required
              >
                {PARTNER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {editFormErrors.partnerType && (
                <p className="mt-1 text-xs text-red-600">
                  {editFormErrors.partnerType}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="editContactPerson" className={labelClass}>
                فرد رابط
              </label>
              <input
                id="editContactPerson"
                name="contactPerson"
                value={editingPartner.contactPerson || ''}
                onChange={handleEditInputChange}
                className={inputClass(!!editFormErrors.contactPerson)}
              />
            </div>

            <div>
              <label htmlFor="editPhoneNumber" className={labelClass}>
                شماره تماس
              </label>
              <input
                id="editPhoneNumber"
                name="phoneNumber"
                value={editingPartner.phoneNumber || ''}
                onChange={handleEditInputChange}
                className={inputClass(!!editFormErrors.phoneNumber)}
                placeholder="مثال: 09123456789"
              />
              {editFormErrors.phoneNumber && (
                <p className="mt-1 text-xs text-red-600">
                  {editFormErrors.phoneNumber}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="editEmail" className={labelClass}>
                ایمیل
              </label>
              <input
                id="editEmail"
                name="email"
                value={editingPartner.email || ''}
                onChange={handleEditInputChange}
                className={inputClass(!!editFormErrors.email)}
              />
              {editFormErrors.email && (
                <p className="mt-1 text-xs text-red-600">
                  {editFormErrors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="editAddress" className={labelClass}>
                آدرس
              </label>
              <textarea
                id="editAddress"
                name="address"
                value={editingPartner.address || ''}
                onChange={handleEditInputChange}
                rows={2}
                className={inputClass(!!editFormErrors.address, true)}
              ></textarea>
            </div>

            <div>
              <label htmlFor="editNotes" className={labelClass}>
                یادداشت
              </label>
              <textarea
                id="editNotes"
                name="notes"
                value={editingPartner.notes || ''}
                onChange={handleEditInputChange}
                rows={2}
                className={inputClass(!!editFormErrors.notes, true)}
              ></textarea>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="ml-3 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 dark:bg-gray-600 dark:hover:bg-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={isSubmittingEdit || !token}
                className="px-4 py-2 bg-sky-600 text-white font-medium rounded-lg hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:bg-sky-400 transition-colors"
              >
                {isSubmittingEdit ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>در حال ذخیره...
                  </>
                ) : (
                  'ذخیره تغییرات'
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Ledger Modal */}
      {isLedgerModalOpen && (
        <Modal
          title={`ثبت پرداخت به ${profile.partnerName}`}
          onClose={() => setIsLedgerModalOpen(false)}
          widthClass="max-w-lg"
        >
          <form onSubmit={handleLedgerSubmit} className="space-y-4 p-1">
            <div>
              <label htmlFor="ledgerAmount" className={labelClass}>
                مبلغ پرداختی (تومان) <span className="text-red-500">*</span>
              </label>
              <PriceInput
                id="ledgerAmount"
                name="amount"
                value={String(newLedgerEntry.debit || '')}
                onChange={handleLedgerInputChange}
                className={inputClass(!!ledgerFormErrors.amount)}
                placeholder="مثال: ۵۰۰۰۰"
              />
              {ledgerFormErrors.amount && (
                <p className="mt-1 text-xs text-red-600">{ledgerFormErrors.amount}</p>
              )}
            </div>
            <div>
              <label htmlFor="ledgerDescription" className={labelClass}>
                شرح پرداخت <span className="text-red-500">*</span>
              </label>
              <textarea
                id="ledgerDescription"
                name="description"
                value={newLedgerEntry.description}
                onChange={handleLedgerInputChange}
                rows={2}
                className={inputClass(!!ledgerFormErrors.description, true)}
                required
                placeholder="مثال: پرداخت بابت فاکتور ۱۲۳"
              />
              {ledgerFormErrors.description && (
                <p className="mt-1 text-xs text-red-600">
                  {ledgerFormErrors.description}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="ledgerTransactionDate" className={labelClass}>
                تاریخ پرداخت <span className="text-red-500">*</span>
              </label>
              <ShamsiDatePicker
                id="ledgerTransactionDate"
                selectedDate={ledgerDateSelected}
                onDateChange={(date) => setLedgerDateSelected(date)}
                inputClassName={inputClass(!!ledgerFormErrors.transactionDate)}
              />
              {ledgerFormErrors.transactionDate && (
                <p className="mt-1 text-xs text-red-600">
                  {ledgerFormErrors.transactionDate}
                </p>
              )}
            </div>
            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={() => setIsLedgerModalOpen(false)}
                className="ml-3 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 dark:bg-gray-600 dark:hover:bg-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={isSubmittingLedger || !token}
                className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-green-400 transition-colors"
              >
                {isSubmittingLedger ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>در حال ثبت...
                  </>
                ) : (
                  'ثبت پرداخت'
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default PartnerDetailPage;
