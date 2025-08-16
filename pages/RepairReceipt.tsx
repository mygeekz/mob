// src/pages/RepairReceipt.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import moment from 'jalali-moment';

import { RepairDetailsPageData, NotificationMessage } from '../types';
import Notification from '../components/Notification';
import { apiFetch } from '../utils/apiFetch';

/* ---------- Helpers ---------- */
const extractMobile = (d: any): string => {
  const candidates = [
    d?.customer?.phoneNumber,
    d?.customer?.mobile,
    d?.customer?.mobileNumber,
    d?.customer?.tel,
    d?.repair?.customerPhoneNumber,
    d?.repair?.customerPhone,
    d?.repair?.customer_phone,
    d?.repair?.customerMobile,
    d?.repair?.customer_mobile,
    d?.customerPhoneNumber,
    d?.customer_phone,
    d?.phoneNumber,
    d?.mobile,
  ];
  return candidates.find(Boolean) || '---';
};
const toRial = (n?: number | null) =>
  n != null ? n.toLocaleString('fa-IR') + ' تومان' : '---';
/* -------------------------------- */

/** This CSS is injected into the new print window only */
const PRINT_CSS = `
  @import url('https://cdn.jsdelivr.net/gh/rastikerdar/vazir-font@v33.003/Vazir-font-face.css');

  @page { size: A5; margin: 0; }
  html, body {
    background: #fff; color: #000;
    font-family: 'Vazir', sans-serif;
    direction: rtl; margin: 0; padding: 0;
  }
  * { box-sizing: border-box; }

  .receipt-container {
    margin: 10mm;
  }

  /* HEADER */
  .header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 8mm;
  }
  .header .logo { width: 55px; height: 55px; object-fit: contain; }
  .header .store-info {
    text-align: center;
    font-size: 14px;
  }
  .header .store-info h1 {
    margin:0; font-size:18px; font-weight:700; color:#1e40af;
  }
  .header .store-info p {
    margin:2px 0; font-size:12px; color:#555;
  }

  /* RECEIPT META */
  .meta {
    display:flex; justify-content:space-between;
    background:#f3f4f6; padding:4px 8px; border-radius:4px;
    font-size:12px; margin-bottom:6mm;
  }

  /* TABLE */
  table {
    width:100%; border-collapse:collapse; margin-bottom:6mm;
  }
  th, td {
    border:1px solid #ccc; padding:6px 8px; font-size:12px;
  }
  thead th {
    background:#e5e7eb; font-weight:600;
  }
  tbody tr:nth-child(odd) { background:#fff; }
  tbody tr:nth-child(even){ background:#f9fafb; }

  /* TERMS */
  .terms {
    font-size:10px; color:#555; line-height:1.6;
    margin-bottom:8mm;
  }

  /* SIGNATURES */
  .signatures {
    display:flex; justify-content:space-between; font-size:10px;
  }
  .signatures .sig-box {
    width:45%; text-align:center;
  }
  .signatures .sig-box .sig-line {
    border-top:1px solid #000; margin-top:12mm;
  }
`;

const RepairReceipt: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const receiptRef = useRef<HTMLDivElement>(null);
  const isPrintingRef = useRef(false);

  const [data, setData] = useState<RepairDetailsPageData | null>(null);
  const [mobile, setMobile] = useState<string>('---');
  const [loading, setLoading] = useState(true);
  const [notif, setNotif] = useState<NotificationMessage | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`/api/repairs/${id}`);
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || 'خطا در دریافت اطلاعات');
        setData(json.data);

        // extract mobile or fallback fetch customer
        let m = extractMobile(json.data);
        if (m === '---' && json.data.repair?.customerId) {
          const cr = await apiFetch(`/api/customers/${json.data.repair.customerId}`);
          const cj = await cr.json();
          if (cr.ok && cj.success) m = extractMobile({ customer: cj.data });
        }
        setMobile(m);
      } catch (e: any) {
        setNotif({ type: 'error', text: e.message });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // auto‐print on `?autoPrint=1`
  useEffect(() => {
    if (searchParams.get('autoPrint') === '1' && data) {
      setTimeout(doPrint, 500);
    }
  }, [searchParams, data]);

  const doPrint = () => {
    if (!receiptRef.current) return;
    const html = `<div class="receipt-container">${receiptRef.current.innerHTML}</div>`;
    const win = window.open('', '_blank', 'width=850,height=600');
    if (!win) {
      alert('لطفاً اجازه باز شدن پنجره چاپ را بدهید.');
      return;
    }
    win.document.open();
    win.document.write(`
      <!doctype html><html dir="rtl"><head>
        <meta charset="utf-8"/><title>رسید پذیرش تعمیر ${id}</title>
        <style>${PRINT_CSS}</style>
      </head><body>${html}</body></html>
    `);
    win.document.close();
    const finalize = () => { win.focus(); win.print(); win.close(); };
    setTimeout(finalize, 300);
    win.onload = finalize;
  };

  const handlePrint = () => {
    if (isPrintingRef.current) return;
    isPrintingRef.current = true;
    doPrint();
    setTimeout(() => { isPrintingRef.current = false; }, 1000);
  };

  if (loading) return <div className="p-6">در حال بارگذاری...</div>;
  if (!data) return <div className="p-6 text-red-600">اطلاعاتی یافت نشد</div>;

  const { repair, customer, storeName, storeAddress, storePhone, storeLogoUrl } = data;
  const customerName = customer?.fullName ?? repair.customerFullName ?? '---';
  const shamsiDate = moment(repair.dateReceived).locale('fa').format('YYYY/MM/DD HH:mm');

  return (
    <div className="p-4" dir="rtl">
      {notif && <Notification message={notif} onClose={() => setNotif(null)} />}

      {/* ACTION BUTTONS (hide on print) */}
      <div className="flex gap-2 mb-4 print:hidden">
        <button onClick={handlePrint}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          چاپ
        </button>
        <button onClick={() => navigate(-1)}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
          بازگشت
        </button>
      </div>

      {/* RECEIPT CONTENT */}
      <div ref={receiptRef} className="bg-white p-6 max-w-2xl mx-auto border rounded shadow">
        {/* HEADER */}
        <div className="header">
          {storeLogoUrl
            ? <img src={storeLogoUrl} alt="لوگو" className="logo" />
            : <div style={{ width: 55 }} />}
          <div className="store-info">
            <h1>{storeName || 'فروشگاه موبایل کوروش'}</h1>
            <p>{storeAddress || 'تهران، خیابان مثال ۱۲'} | تلفن: {storePhone || '۰۹۱۲۳۴۵۶۷۸۹'}</p>
          </div>
          <div style={{ width: 55 }} />
        </div>

        {/* META */}
        <div className="meta">
          <div>شماره رسید: <strong>{repair.id}</strong></div>
          <div>تاریخ پذیرش: <strong>{shamsiDate}</strong></div>
        </div>

        {/* DETAILS TABLE */}
        <table>
          <thead>
            <tr>
              <th className="text-right">شرح</th>
              <th className="text-right">مقدار / توضیحات</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['نام مشتری', customerName],
              ['موبایل', mobile],
              ['مدل دستگاه', repair.deviceModel],
              ['رنگ', repair.deviceColor || '---'],
              ['سریال / IMEI', repair.serialNumber || '---'],
              ['شرح مشکل', repair.problemDescription],
              ['هزینه تخمینی', toRial(repair.estimatedCost)]
            ].map(([label,value])=>(
              <tr key={label}>
                <td className="px-2 py-1 font-medium text-right">{label}</td>
                <td className="px-2 py-1 text-right">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* TERMS */}
        <hr className="border-gray-300 my-4"/>
        <div className="terms">
          - دستگاه پس از ۳۰ روز از اعلام آماده بودن، مشمول هزینه انبارداری می‌شود.<br/>
          - مسئولیت اطلاعات داخل دستگاه با مشتری است؛ لطفاً پشتیبان تهیه کنید.<br/>
          - قطعات مصرفی و هزینهٔ نهایی پس از بررسی تکنسین مشخص می‌گردد.
        </div>

        {/* SIGNATURES */}
        <div className="signatures">
          <div className="sig-box">
            <div className="sig-line"></div>
            <div>امضای دریافت‌کننده</div>
          </div>
          <div className="sig-box">
            <div className="sig-line"></div>
            <div>امضای مشتری</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RepairReceipt;
