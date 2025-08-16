import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import moment from 'jalali-moment';

import { 
    InstallmentSaleDetailData, 
    InstallmentCheckInfo,
    NotificationMessage, 
    CheckStatus,
    InstallmentPaymentStatus,
    InstallmentPaymentRecord
} from '../types';
import Notification from '../components/Notification';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import { formatIsoToShamsi } from '../utils/dateUtils';
import ShamsiDatePicker from '../components/ShamsiDatePicker';
import PriceInput from '../components/PriceInput';

const CHECK_STATUSES_OPTIONS: CheckStatus[] = ["در جریان وصول", "وصول شده", "برگشت خورده", "نزد مشتری", "باطل شده"];

const InstallmentSaleDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { token, authReady } = useAuth(); // از authReady هم استفاده می‌کنیم

    const [saleData, setSaleData] = useState<InstallmentSaleDetailData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [notification, setNotification] = useState<NotificationMessage | null>(null);

    const [isEditCheckModalOpen, setIsEditCheckModalOpen] = useState(false);
    const [editingCheck, setEditingCheck] = useState<InstallmentCheckInfo | null>(null);
    
    // State for the new payment modal
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [currentPayment, setCurrentPayment] = useState<InstallmentPaymentRecord | null>(null);
    const [paymentAmount, setPaymentAmount] = useState<string | number>('');
    const [paymentDate, setPaymentDate] = useState<Date | null>(new Date());
    const [paymentNotes, setPaymentNotes] = useState('');
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

    const fetchInstallmentSaleDetail = async () => {
        if (!id) {
            navigate('/installment-sales');
            return;
        }
        // This check is crucial. We proceed only if the token is available.
        if (!token) {
            setIsLoading(false);
            setNotification({ type: 'error', text: "برای دسترسی به این بخش، ابتدا باید وارد سیستم شوید." });
            return;
        }
        setIsLoading(true);
        setNotification(null);
        try {
            const response = await apiFetch(`/api/installment-sales/${id}`);
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || 'خطا در دریافت جزئیات فروش اقساطی');
            }
            setSaleData(result.data);
        } catch (error: any) {
            setNotification({ type: 'error', text: error.message });
            if (error.message.includes('یافت نشد')) {
                setTimeout(() => navigate('/installment-sales'), 2000);
            }
        } finally {
            setIsLoading(false);
        }
    };

    // This useEffect hook is now correctly dependent on the token and authReady state.
    useEffect(() => {
        // It will only run when auth is ready and the token is available.
        if (authReady && token) {
            fetchInstallmentSaleDetail();
        } else if (authReady && !token) {
            // If auth is ready but there's no token, stop loading and show message.
            setIsLoading(false);
        }
    }, [id, token, authReady]); // The dependency array ensures it re-runs if the id or token/authReady changes.

    const openPaymentModal = (payment: InstallmentPaymentRecord) => {
        setCurrentPayment(payment);
        const remaining = payment.amountDue - (payment.totalPaid || 0);
        setPaymentAmount(remaining > 0 ? remaining : '');
        setPaymentDate(new Date());
        setPaymentNotes('');
        setIsPaymentModalOpen(true);
    };

    const handleSubmitPartialPayment = async (e: FormEvent) => {
        e.preventDefault();
        if (!currentPayment || !paymentAmount || Number(paymentAmount) <= 0) {
            setNotification({ type: 'error', text: "مبلغ پرداخت باید یک عدد مثبت باشد." });
            return;
        }
        setIsSubmittingPayment(true);
        try {
            const payload = {
                amount: Number(paymentAmount),
                date: moment(paymentDate).locale('fa').format('YYYY/MM/DD'),
                notes: paymentNotes
            };
            await apiFetch(`/api/installment-sales/payment/${currentPayment.id}/transaction`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            setNotification({ type: 'success', text: 'پرداخت با موفقیت ثبت شد.' });
            setIsPaymentModalOpen(false);
            fetchInstallmentSaleDetail();
        } catch (error: any) {
            setNotification({ type: 'error', text: error.message });
        } finally {
            setIsSubmittingPayment(false);
        }
    };

    const openEditCheckModal = (check: InstallmentCheckInfo) => {
        setEditingCheck({...check});
        setIsEditCheckModalOpen(true);
    };

    const handleEditCheckChange = (e: ChangeEvent<HTMLSelectElement>) => {
        if (!editingCheck) return;
        setEditingCheck(prev => prev ? ({ ...prev, status: e.target.value as CheckStatus }) : null);
    };

    const handleSaveCheckChanges = async () => {
        if (!editingCheck || !editingCheck.id) return;
        setNotification({type: 'info', text: 'در حال ذخیره تغییرات چک...'});
        try {
            await apiFetch(`/api/installment-sales/check/${editingCheck.id}`, { 
                method: 'PUT', 
                body: JSON.stringify({ status: editingCheck.status }) 
            });
            setNotification({ type: 'success', text: `وضعیت چک شماره ${editingCheck.checkNumber} به‌روز شد.`});
            setIsEditCheckModalOpen(false);
            setEditingCheck(null);
            fetchInstallmentSaleDetail();
        } catch (error: any) {
            setNotification({ type: 'error', text: `خطا در به‌روزرسانی چک: ${error.message}`});
        }
    };

    const formatPrice = (price: number | undefined | null) => {
        if (price === undefined || price === null) return '-';
        return price.toLocaleString('fa-IR') + ' تومان';
    };

    const getPaymentStatusColor = (status: InstallmentPaymentStatus, dueDate?: string): string => {
        if (status === 'پرداخت شده') return 'bg-green-100 text-green-700';
        if (status === 'پرداخت جزئی') return 'bg-blue-100 text-blue-700';
        if (status === 'پرداخت نشده' && dueDate && moment(dueDate, 'jYYYY/jMM/jDD').isBefore(moment(), 'day')) return 'bg-red-100 text-red-700';
        return 'bg-yellow-100 text-yellow-700';
    };

    const getCheckStatusColor = (status: CheckStatus): string => {
        if (status === 'وصول شده') return 'bg-green-100 text-green-700';
        if (status === 'برگشت خورده' || status === 'باطل شده') return 'bg-red-100 text-red-700';
        if (status === 'نزد مشتری') return 'bg-blue-100 text-blue-700';
        return 'bg-yellow-100 text-yellow-700';
    };

    if (isLoading) return <div className="p-6 text-center"><i className="fas fa-spinner fa-spin text-2xl text-indigo-600"></i></div>;
    if (!token && authReady) return <div className="p-6 text-center text-orange-500">برای مشاهده این صفحه، لطفاً ابتدا وارد شوید.</div>;
    if (!saleData) return <div className="p-6 text-center text-red-500">اطلاعات فروش اقساطی یافت نشد.</div>;

    return (
        <div className="space-y-6 text-right" dir="rtl">
            <Notification message={notification} onClose={() => setNotification(null)} />
            
            <div className="bg-white p-6 rounded-lg shadow">
                 <h2 className="text-xl font-semibold mb-3 border-b pb-2">خلاصه فروش اقساطی (شناسه: {saleData.id.toLocaleString('fa-IR')})</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                   <p><strong>مشتری:</strong> <Link to={`/customers/${saleData.customerId}`} className="text-indigo-600 hover:underline">{saleData.customerFullName}</Link></p>
                   <p><strong>موبایل:</strong> {saleData.phoneModel} (IMEI: {saleData.phoneImei})</p>
                   <p><strong>قیمت فروش نهایی:</strong> {formatPrice(saleData.actualSalePrice)}</p>
                   <p><strong>پیش پرداخت:</strong> {formatPrice(saleData.downPayment)}</p>
                   <p><strong>تعداد اقساط:</strong> {saleData.numberOfInstallments.toLocaleString('fa-IR')} ماه</p>
                   <p><strong>مبلغ هر قسط:</strong> {formatPrice(saleData.installmentAmount)}</p>
                   <p><strong>تاریخ شروع اقساط:</strong> {formatIsoToShamsi(saleData.installmentsStartDate)}</p>
                   <p className="font-semibold text-base"><strong>مبلغ کل پرداخت اقساطی:</strong> {formatPrice(saleData.totalInstallmentPrice)}</p>
                   <p className="font-semibold text-base"><strong>مبلغ باقیمانده:</strong> {formatPrice(saleData.remainingAmount)}</p>
                   <p><strong>وضعیت کلی:</strong> <span className={`px-2 py-0.5 text-xs rounded-full ${saleData.overallStatus === 'تکمیل شده' ? 'bg-green-500 text-white' : saleData.overallStatus === 'معوق' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'}`}>{saleData.overallStatus}</span></p>
                   {saleData.nextDueDate && saleData.overallStatus !== 'تکمیل شده' && <p><strong>تاریخ قسط بعدی:</strong> {formatIsoToShamsi(saleData.nextDueDate)}</p>}
                   {saleData.notes && <p className="md:col-span-2"><strong>یادداشت‌ها:</strong> {saleData.notes}</p>}
                 </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-3">جدول اقساط</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-2 text-right font-medium text-gray-500">#</th>
                                <th className="px-3 py-2 text-right font-medium text-gray-500">تاریخ سررسید</th>
                                <th className="px-3 py-2 text-right font-medium text-gray-500">مبلغ قسط</th>
                                <th className="px-3 py-2 text-right font-medium text-gray-500">پرداختی/وضعیت</th>
                                <th className="px-3 py-2 text-center font-medium text-gray-500">عملیات</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {saleData.payments.map((payment) => (
                                <React.Fragment key={payment.id}>
                                    <tr className={moment(payment.dueDate, 'jYYYY/jMM/jDD').isBefore(moment(), 'day') && payment.status !== 'پرداخت شده' ? 'bg-red-50' : ''}>
                                        <td className="px-3 py-2">{payment.installmentNumber.toLocaleString('fa-IR')}</td>
                                        <td className="px-3 py-2">{formatIsoToShamsi(payment.dueDate)}</td>
                                        <td className="px-3 py-2">{formatPrice(payment.amountDue)}</td>
                                        <td className="px-3 py-2">
                                            <div className='flex flex-col'>
                                                <span className={`px-2 py-0.5 text-xs rounded-full self-start ${getPaymentStatusColor(payment.status, payment.dueDate)}`}>
                                                    {payment.status === 'پرداخت نشده' && moment(payment.dueDate, 'jYYYY/jMM/jDD').isBefore(moment(), 'day') ? 'معوق' : payment.status}
                                                </span>
                                                {(payment.totalPaid ?? 0) > 0 && (
                                                    <span className="text-xs text-gray-500 mt-1">
                                                        پرداختی: {formatPrice(payment.totalPaid)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            {payment.status !== 'پرداخت شده' && (
                                                <button onClick={() => openPaymentModal(payment)} className="px-2.5 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">
                                                    ثبت پرداخت
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                    {payment.transactions && payment.transactions.length > 0 && (
                                        <tr className="bg-gray-50">
                                            <td colSpan={5} className="p-2">
                                                <div className="text-xs text-gray-600 space-y-1 pl-8">
                                                    <p className='font-semibold'>تاریخچه پرداخت این قسط:</p>
                                                    {payment.transactions.map((tx: any) => (
                                                        <div key={tx.id} className="flex justify-between">
                                                            <span>پرداخت در تاریخ {formatIsoToShamsi(tx.payment_date)}: <span className="font-semibold">{formatPrice(tx.amount_paid)}</span></span>
                                                            {tx.notes && <span className="text-gray-500 italic">({tx.notes})</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
                 <h3 className="text-lg font-semibold mb-3">چک‌های دریافتی</h3>
                 {saleData.checks.length === 0 ? <p className="text-gray-500">چکی برای این فروش ثبت نشده است.</p> : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 text-right font-medium text-gray-500">شماره چک</th>
                                    <th className="px-3 py-2 text-right font-medium text-gray-500">بانک</th>
                                    <th className="px-3 py-2 text-right font-medium text-gray-500">مبلغ</th>
                                    <th className="px-3 py-2 text-right font-medium text-gray-500">تاریخ سررسید</th>
                                    <th className="px-3 py-2 text-right font-medium text-gray-500">وضعیت</th>
                                    <th className="px-3 py-2 text-center font-medium text-gray-500">تغییر وضعیت</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {saleData.checks.map((check) => (
                                    <tr key={check.id}>
                                        <td className="px-3 py-2 whitespace-nowrap">{check.checkNumber}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{check.bankName}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{formatPrice(check.amount)}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{formatIsoToShamsi(check.dueDate)}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 text-xs rounded-full ${getCheckStatusColor(check.status)}`}>
                                                {check.status}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-center">
                                            <button onClick={() => openEditCheckModal(check)} className="px-2.5 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">
                                                ویرایش
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                 )}
            </div>
            
            {isPaymentModalOpen && currentPayment && (
                <Modal title={`ثبت پرداخت برای قسط شماره ${currentPayment.installmentNumber.toLocaleString('fa-IR')}`} onClose={() => setIsPaymentModalOpen(false)} widthClass="max-w-lg">
                    <form onSubmit={handleSubmitPartialPayment} className="space-y-4 p-2">
                        <div>
                            <p>مبلغ کل قسط: {formatPrice(currentPayment.amountDue)}</p>
                            <p>مبلغ پرداخت شده تا کنون: {formatPrice(currentPayment.totalPaid)}</p>
                            <p className="font-bold text-indigo-700">مبلغ باقیمانده قسط: {formatPrice(currentPayment.amountDue - (currentPayment.totalPaid || 0))}</p>
                        </div>
                        <hr/>
                        <div>
                            <label htmlFor="paymentAmount" className="block text-sm font-medium text-gray-700 mb-1">مبلغ پرداختی جدید (تومان)</label>
                            <PriceInput id="paymentAmount" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" required />
                        </div>
                        <div>
                             <label htmlFor="paymentDate" className="block text-sm font-medium text-gray-700 mb-1">تاریخ پرداخت</label>
                             <ShamsiDatePicker id="paymentDate" selectedDate={paymentDate} onDateChange={setPaymentDate} />
                        </div>
                        <div>
                            <label htmlFor="paymentNotes" className="block text-sm font-medium text-gray-700 mb-1">یادداشت (اختیاری)</label>
                            <input type="text" id="paymentNotes" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" placeholder="مثال: پرداخت از طریق کارت‌خوان" />
                        </div>
                        <div className="flex justify-end pt-3 gap-3">
                            <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-md">انصراف</button>
                            <button type="submit" disabled={isSubmittingPayment} className="px-4 py-2 bg-green-600 text-white rounded-md disabled:bg-green-300">
                                {isSubmittingPayment ? 'در حال ثبت...' : 'ثبت پرداخت'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
            
            {isEditCheckModalOpen && editingCheck && (
                <Modal title={`ویرایش وضعیت چک شماره: ${editingCheck.checkNumber}`} onClose={() => setIsEditCheckModalOpen(false)}>
                     <div className="p-2 space-y-3 text-sm">
                         <p><strong>بانک:</strong> {editingCheck.bankName}</p>
                         <p><strong>مبلغ:</strong> {formatPrice(editingCheck.amount)}</p>
                         <p><strong>تاریخ سررسید:</strong> {formatIsoToShamsi(editingCheck.dueDate)}</p>
                         <div>
                             <label htmlFor="checkStatus" className="block text-sm font-medium text-gray-700 mb-1">وضعیت جدید چک:</label>
                             <select id="checkStatus" name="status" value={editingCheck.status} onChange={handleEditCheckChange} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white">
                                 {CHECK_STATUSES_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
                             </select>
                         </div>
                         <div className="flex justify-end pt-3 space-x-3 space-x-reverse">
                             <button type="button" onClick={() => setIsEditCheckModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">انصراف</button>
                             <button type="button" onClick={handleSaveCheckChanges} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">ذخیره تغییرات</button>
                         </div>
                     </div>
                </Modal>
            )}
        </div>
    );
};

export default InstallmentSaleDetailPage;