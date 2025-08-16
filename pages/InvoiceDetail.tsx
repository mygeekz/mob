// src/pages/InvoiceDetail.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import moment from 'jalali-moment';

import { InvoiceData, NotificationMessage } from '../types';
import Notification from '../components/Notification';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/apiFetch';

/** استایل کاملاً خودکفا برای چاپ */
const PRINT_CSS = `
  @import url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css');
  @page { size: A5 portrait; margin: 12mm; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff !important;
    color: #222 !important;
    font-family: 'Vazirmatn', sans-serif;
    direction: rtl;
    font-size: 11px;
    line-height: 1.5;
  }
  .receipt-container { width: 100%; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 6mm; }
  .store-name { font-size: 22px; font-weight: 700; color: #2c3e50; margin-bottom: 2px; }
  .divider { width: 50px; height: 2px; background: #2980b9; margin: 6px auto 10px; }
  .store-info { font-size: 10px; color: #555; line-height: 1.4; }
  .meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8mm; font-size: 11px; color: #333; }
  .meta > div { flex: 1; }
  .meta > div:nth-child(2) { text-align: center; }
  .meta > div:nth-child(3) { text-align: left; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8mm; }
  tbody tr { page-break-inside: avoid; }
  thead th { background: #ecf0f1; color: #2c3e50; font-weight: 600; padding: 7px; border-bottom: 2px solid #bdc3c7; text-align: right; font-size: 11px; }
  thead th:nth-child(1) { width: 45%; }
  thead th:nth-child(2) { text-align: center; }
  thead th:nth-child(3) { }
  thead th:nth-child(4) { }
  thead th:nth-child(5) { }
  tbody td { padding: 6px 7px; border-bottom: 1px solid #ddd; text-align: right; color: #333; font-size: 11px; }
  tbody td:nth-child(2) { text-align: center; }
  tbody tr:nth-child(even) { background: #fafafa; }
  .summary { background: #f7f9fa; border: 1px solid #dde4ea; border-radius: 6px; padding: 8px 12px; margin-bottom: 8mm; font-size: 11px; }
  .summary-row { display: flex; justify-content: space-between; margin-bottom: 4px; padding: 2px 0;}
  .summary-row .label { font-weight: 600; color: #2c3e50; }
  .summary-row .value { color: #2c3e50; }
  .summary-row.total { font-size: 13px; font-weight: bold; border-top: 1px solid #dde4ea; margin-top: 5px; padding-top: 5px; }
  .summary-row.discount .value { color: #e74c3c; }
  .notes { font-size: 10px; font-style: italic; color: #555; margin-bottom: 10mm; padding: 5px; border-top: 1px dashed #ccc; margin-top: 5mm; }
  .signatures { display: flex; justify-content: space-between; font-size: 11px; margin-top: 15mm; }
  .sig-box { width: 45%; text-align: center; }
  .sig-line { border-top: 1px solid #333; margin-top: 12mm; }
`;

const InvoiceDetail: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const invoicePrintRef = useRef<HTMLDivElement>(null);
  const printingRef = useRef(false);

  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationMessage | null>(null);

  useEffect(() => {
    if (!orderId) return navigate('/invoices');
    if (!token) {
      setNotification({ type: 'error', text: 'برای مشاهده فاکتور باید وارد شوید.' });
      setIsLoading(false);
      return;
    }
    (async () => {
      setIsLoading(true);
      try {
        const res = await apiFetch(`/api/sales-orders/${orderId}`);
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || 'خطا در دریافت فاکتور');

        setInvoiceData(json.data);
      } catch (err: any) {
        setNotification({ type: 'error', text: err.message });
        if (err.message.includes('یافت نشد')) setTimeout(() => navigate('/invoices'), 3000);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [orderId, token, navigate]);



  const doPrint = () => {
    if (!invoicePrintRef.current || !invoiceData) return;
    const content = invoicePrintRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) {
      alert('لطفاً اجازهٔ باز شدن پنجره چاپ را بدهید.');
      printingRef.current = false;
      return;
    }
    win.document.open();
    win.document.write(`
      <!doctype html>
      <html dir="rtl">
        <head>
          <meta charset="utf-8"/>
          <title>فاکتور ${invoiceData.invoiceMetadata.invoiceNumber}</title>
          <style>${PRINT_CSS}</style>
        </head>
        <body>
          <div class="receipt-container">
            ${content}
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.onload = () => {
      win.focus();
      win.print();
      win.close();
      printingRef.current = false;
    };
  };

  const handlePrint = () => {
    if (printingRef.current) return;
    printingRef.current = true;
    doPrint();
  };

  const handleDownloadPDF = async () => {
    if (!invoicePrintRef.current || !invoiceData) return;
    setNotification({ type: 'info', text: 'در حال ایجاد PDF، لطفاً صبر کنید...' });
    try {
      const canvas = await html2canvas(invoicePrintRef.current, {
        scale: 2, useCORS: true, logging: false,
      });
      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const props = pdf.getImageProperties(img);
      const ratio = Math.min(pw / props.width, ph / props.height);
      const w = props.width * ratio, h = props.height * ratio;
      pdf.addImage(img, 'PNG', (pw - w) / 2, (ph - h) / 2, w, h);
      pdf.save(`faktor-${invoiceData.invoiceMetadata.invoiceNumber}.pdf`);
      setNotification({ type: 'success', text: 'PDF با موفقیت دانلود شد.' });
    } catch {
      setNotification({ type: 'error', text: 'خطا در تولید PDF، دوباره تلاش کنید.' });
    }
  };

  const fmt = (n?: number | null) => (n != null ? n.toLocaleString('fa-IR') : '۰');

  if (isLoading) {
    return (
      <div className="p-10 text-center text-gray-500">
        <i className="fas fa-spinner fa-spin text-3xl mb-3" /> <p>در حال بارگذاری فاکتور...</p>
      </div>
    );
  }
  if (!invoiceData) {
    return (
      <div className="p-10 text-center text-red-500">
        <i className="fas fa-exclamation-circle text-3xl mb-3" /> <p>فاکتور یافت نشد یا خطایی رخ داد.</p>
        <button
          onClick={() => navigate('/sales/new')}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          بازگشت به صفحه فروش
        </button>
      </div>
    );
  }

  const { businessDetails, invoiceMetadata, lineItems, financialSummary, notes } = invoiceData;
  const shamsiDate = moment(invoiceMetadata.transactionDate, 'jYYYY/jMM/jDD')
    .locale('fa')
    .format('dddd، jD jMMMM jYYYY');

  return (
    <div className="text-right" dir="rtl">
      {notification && <Notification message={notification} onClose={() => setNotification(null)} />}
      <div className="mb-6 p-4 bg-white rounded-lg shadow-md flex justify-end space-x-3 print:hidden">
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
        >
          چاپ
        </button>
        <button
          onClick={handleDownloadPDF}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
        >
          PDF
        </button>
      </div>

      <div
        ref={invoicePrintRef}
        className="bg-white p-8 shadow-lg rounded-md max-w-2xl mx-auto print:border-none print:shadow-none print:m-0 print:p-0"
      >
        <div className="header">
          <div className="store-name">{businessDetails.name}</div>
          <div className="divider" />
          <div className="store-info">
            {businessDetails.addressLine1}<br />
            {businessDetails.cityStateZip}<br />
            {businessDetails.phone && `تلفن: ${businessDetails.phone}`}
          </div>
        </div>

        <div className="meta">
          <div>شماره فاکتور: <strong>{invoiceMetadata.invoiceNumber}</strong></div>
          <div>تاریخ: <strong>{shamsiDate}</strong></div>
          <div>مشتری: <strong>{invoiceData.customerDetails?.fullName ?? 'مهمان'}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>شرح کالا/خدمات</th>
              <th>تعداد</th>
              <th>قیمت واحد</th>
              <th>تخفیف</th>
              <th>مبلغ کل</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td>{fmt(item.quantity)}</td>
                <td>{fmt(item.unitPrice)}</td>
                <td>{fmt(item.discountPerItem)}</td>
                <td>{fmt(item.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="summary">
          <div className="summary-row">
            <span className="label">جمع کل موارد:</span>
            <span className="value">{fmt(financialSummary.subtotal)} تومان</span>
          </div>
          {(financialSummary.itemsDiscount > 0 || financialSummary.globalDiscount > 0) && (
            <div className="summary-row discount">
              <span className="label">مجموع تخفیف‌ها:</span>
              <span className="value">({fmt(financialSummary.itemsDiscount + financialSummary.globalDiscount)}) تومان</span>
            </div>
          )}
           <div className="summary-row">
            <span className="label">مبلغ پس از تخفیف:</span>
            <span className="value">{fmt(financialSummary.taxableAmount)} تومان</span>
          </div>
          {financialSummary.taxAmount > 0 && (
            <div className="summary-row">
              <span className="label">مالیات ({fmt(financialSummary.taxPercentage)}%):</span>
              <span className="value">{fmt(financialSummary.taxAmount)} تومان</span>
            </div>
          )}
          <div className="summary-row total">
            <span className="label">مبلغ نهایی:</span>
            <span className="value">{fmt(financialSummary.grandTotal)} تومان</span>
          </div>
        </div>

        {notes && <div className="notes"><strong>یادداشت:</strong> {notes}</div>}

        <div className="signatures">
          <div className="sig-box">
            <div className="sig-line" />
            فروشنده
          </div>
          <div className="sig-box">
            <div className="sig-line" />
            خریدار
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetail;
