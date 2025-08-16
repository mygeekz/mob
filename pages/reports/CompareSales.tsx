import React, { useMemo, useState } from 'react';
import moment from 'jalali-moment';
import ShamsiDatePicker from '../../components/ShamsiDatePicker';
import Notification from '../../components/Notification';
import Modal from '../../components/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../utils/apiFetch';
import { formatIsoToShamsi } from '../../utils/dateUtils';

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import {
  VAZIR_FAMILY,
  VAZIR_REGULAR_FILE,
  VAZIR_BOLD_FILE,
  vazirRegularB64,
  vazirBoldB64
} from '../../utils/vazirFont';

type Baseline = 'prev' | 'last_year';

type CompareApiResponse = {
  success: boolean;
  data?: {
    currentAmount: number;
    previousAmount: number;
    percentageChange: number | null;
    currentRange: { from: string; to: string };
    previousRange: { from: string; to: string };
    baseline: Baseline;
  };
  message?: string;
};

type SaleRow = {
  id: number;
  transactionDate: string; // ISO
  customerFullName?: string | null;
  totalPrice?: number | null;
  profit?: number | null;
};

const price = (n: number | null | undefined) =>
  (Number(n || 0)).toLocaleString('fa-IR') + ' تومان';

export default function CompareSalesPage() {
  const { token } = useAuth();
  const [notification, setNotification] = useState<{type:'success'|'error'|'warning', text:string} | null>(null);

  // فیلترهای صفحه
  const [startDate, setStartDate] = useState<Date | null>(moment().startOf('jMonth').toDate());
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [baseline, setBaseline] = useState<Baseline>('prev');

  // نتیجه مقایسه
  const [data, setData] = useState<CompareApiResponse['data'] | null>(null);
  const [loading, setLoading] = useState(false);

  // Modal جزئیات
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTitle, setDetailsTitle] = useState('');
  const [detailsRows, setDetailsRows] = useState<SaleRow[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const currentRangeLabel = useMemo(() => {
    if (!data) return '—';
    return `${data.currentRange.from} تا ${data.currentRange.to}`;
  }, [data]);

  const previousRangeLabel = useMemo(() => {
    if (!data) return '—';
    return `${data.previousRange.from} تا ${data.previousRange.to}`;
  }, [data]);

  const fetchCompare = async () => {
    if (!startDate || !endDate) {
      setNotification({ type: 'warning', text: 'لطفاً تاریخ شروع و پایان را انتخاب کنید.' });
      return;
    }
    const fromDate = moment(startDate).locale('fa').format('jYYYY/jMM/jDD');
    const toDate = moment(endDate).locale('fa').format('jYYYY/jMM/jDD');

    try {
      setLoading(true);
      setNotification(null);
      const res = await apiFetch(
        `/api/reports/compare-sales?fromDate=${fromDate}&toDate=${toDate}&baseline=${baseline}`
      );
      const json: CompareApiResponse = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message || 'خطا در دریافت گزارش مقایسه‌ای');
      }
      setData(json.data);
    } catch (e:any) {
      setData(null);
      setNotification({ type: 'error', text: e.message || 'خطای نامشخص رخ داد' });
    } finally {
      setLoading(false);
    }
  };

  // پیش‌تنظیم بازه‌ها + سوییچ مبنا
  const preset = (key: 'this_week'|'last_7'|'this_month'|'last_30'|'this_year', base?: Baseline) => {
    const now = moment();
    let s = now.clone(), e = now.clone();

    switch (key) {
      case 'this_week':
        s = now.clone().startOf('week'); e = now.clone().endOf('week'); break;
      case 'last_7':
        s = now.clone().subtract(6, 'day'); e = now; break;
      case 'this_month':
        s = now.clone().startOf('jMonth'); e = now; break;
      case 'last_30':
        s = now.clone().subtract(29, 'day'); e = now; break;
      case 'this_year':
        s = now.clone().startOf('jYear'); e = now; break;
    }
    setStartDate(s.toDate());
    setEndDate(e.toDate());
    if (base) setBaseline(base);
  };

  // دریافت جزئیات فروش و فیلتر در فرانت
  const openDetails = async (kind: 'current' | 'previous') => {
    if (!data) return;

    const range = kind === 'current' ? data.currentRange : data.previousRange;
    setDetailsTitle(kind === 'current' ? `جزئیات دوره فعلی (${range.from} تا ${range.to})` :
                                         `جزئیات دوره مبنا (${range.from} تا ${range.to})`);
    setDetailsRows([]);
    setDetailsOpen(true);
    setDetailsLoading(true);

    try {
      const res = await apiFetch('/api/sales');
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'خطا در دریافت لیست فروش');
      }
      const all: SaleRow[] = json.data || [];

      const fromISO = moment(range.from, 'jYYYY/jMM/jDD').startOf('day');
      const toISO   = moment(range.to, 'jYYYY/jMM/jDD').endOf('day');

      const rows = all.filter((row) => {
        const m = moment(row.transactionDate);
        return m.isValid() && (m.isSameOrAfter(fromISO) && m.isSameOrBefore(toISO));
      });

      rows.sort((a, b) => (a.transactionDate < b.transactionDate ? 1 : -1));
      setDetailsRows(rows);
    } catch (e:any) {
      setNotification({ type: 'error', text: e.message || 'خطا در بارگذاری جزئیات' });
    } finally {
      setDetailsLoading(false);
    }
  };

  // KPI های مودال جزئیات
  const kpi = useMemo(() => {
    const count = detailsRows.length;
    const total = detailsRows.reduce((s, r) => s + Number(r.totalPrice || 0), 0);
    const profit = detailsRows.reduce((s, r) => s + Number(r.profit || 0), 0);
    const avg = count ? total / count : 0;
    return { count, total, profit, avg };
  }, [detailsRows]);

  // -------------------- Export: Excel --------------------
  const exportExcel = () => {
    if (!detailsRows.length) return;

    const wsData = [
      ['شناسه', 'تاریخ', 'مشتری', 'مبلغ', 'سود'],
      ...detailsRows.map(r => ([
        r.id,
        formatIsoToShamsi(r.transactionDate),
        r.customerFullName || 'مهمان',
        Number(r.totalPrice || 0),
        Number(r.profit || 0),
      ])),
      [],
      ['تعداد فاکتور', kpi.count],
      ['مجموع فروش', kpi.total],
      ['مجموع سود', kpi.profit],
      ['میانگین فروش', kpi.avg],
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'جزئیات فروش');

    const fileName = (detailsTitle || 'report') + '.xlsx';
    XLSX.writeFile(wb, fileName);
  };

  // رجیستر کردن فونت وزیر روی نمونه doc
  const ensureVazirFont = (doc: jsPDF) => {
    // Regular (اختیاری)
    if (vazirRegularB64 && vazirRegularB64.length > 0) {
      doc.addFileToVFS(VAZIR_REGULAR_FILE, vazirRegularB64);
      doc.addFont(VAZIR_REGULAR_FILE, VAZIR_FAMILY, 'normal');
    }
    // Bold
    if (vazirBoldB64 && vazirBoldB64.length > 0) {
      doc.addFileToVFS(VAZIR_BOLD_FILE, vazirBoldB64);
      doc.addFont(VAZIR_BOLD_FILE, VAZIR_FAMILY, 'bold');
    }
  };

  // -------------------- Export: PDF --------------------
  const exportPDF = () => {
  if (!detailsRows.length) return;

  const doc = new jsPDF({ orientation: 'p', unit: 'pt' });
  ensureVazirFont(doc);

  const hasRegular = !!(vazirRegularB64 && vazirRegularB64.length);
  doc.setFont(VAZIR_FAMILY, hasRegular ? 'normal' : 'bold');
  doc.setFontSize(12);

  // عنوان – راست‌چین
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  const title = detailsTitle || 'جزئیات فروش';
  doc.text(title, pageWidth - marginX, 40, { align: 'right' });

  // ساخت داده‌های جدول
  const head = [['شناسه', 'تاریخ', 'مشتری', 'مبلغ', 'سود']];
  const body = detailsRows.map(r => ([
    String(r.id),
    formatIsoToShamsi(r.transactionDate),
    r.customerFullName || 'مهمان',
    Number(r.totalPrice || 0).toLocaleString('fa-IR'),
    Number(r.profit || 0).toLocaleString('fa-IR'),
  ]));

  // جدول راست‌چین و خوش‌استایل
  autoTable(doc, {
    head,
    body,
    startY: 60,
    theme: 'grid',
    styles: {
      font: VAZIR_FAMILY,
      fontSize: 10,
      halign: 'right',          // پیش‌فرض همه راست‌چین
      cellPadding: { top: 6, right: 6, bottom: 6, left: 6 },
      lineColor: [220, 220, 220],
      lineWidth: 0.5,
      textColor: [40, 40, 40],
    },
    headStyles: {
      font: VAZIR_FAMILY,
      fontStyle: 'bold',
      fillColor: [245, 245, 245],
      textColor: [30, 30, 30],
      halign: 'center',
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    // ترازبندی اختصاصی ستون‌ها
    columnStyles: {
      0: { halign: 'center', cellWidth: 60 }, // شناسه
      1: { halign: 'center', cellWidth: 95 }, // تاریخ
      2: { halign: 'right',  cellWidth: 180 },// مشتری
      3: { halign: 'right',  cellWidth: 110 },// مبلغ
      4: { halign: 'right',  cellWidth: 90 }, // سود
    },
    margin: { left: marginX, right: marginX },
    didDrawPage: ({ pageNumber }) => {
      // فوتر: شماره صفحه راست‌چین
      const footer = `صفحه ${pageNumber}`;
      doc.setFont(VAZIR_FAMILY, hasRegular ? 'normal' : 'bold');
      doc.setFontSize(9);
      doc.text(footer, pageWidth - marginX, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
    },
  });

  // خلاصه KPI زیر جدول (راست‌چین)
  const lastY = (doc as any).lastAutoTable?.finalY || 60;
  const y = lastY + 18;

  doc.setFont(VAZIR_FAMILY, 'bold');
  doc.text('خلاصه:', pageWidth - marginX, y, { align: 'right' });
  doc.setFont(VAZIR_FAMILY, hasRegular ? 'normal' : 'bold');
  doc.text(`تعداد فاکتور: ${kpi.count.toLocaleString('fa-IR')}`, pageWidth - marginX, y + 18, { align: 'right' });
  doc.text(`مجموع فروش: ${kpi.total.toLocaleString('fa-IR')} تومان`, pageWidth - marginX, y + 36, { align: 'right' });
  doc.text(`مجموع سود: ${kpi.profit.toLocaleString('fa-IR')} تومان`, pageWidth - marginX, y + 54, { align: 'right' });
  doc.text(`میانگین فروش: ${kpi.avg.toLocaleString('fa-IR')} تومان`, pageWidth - marginX, y + 72, { align: 'right' });

  const fileName = (detailsTitle || 'report') + '.pdf';
  doc.save(fileName);
};


  const posNegClass = (val: number | null) => {
    if (val === null) return 'text-gray-500';
    return val >= 0 ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <Notification message={notification} onClose={() => setNotification(null)} />

      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-3">
          گزارش مقایسه‌ای فروش
        </h2>

        {/* فیلترها */}
        <div className="flex flex-col md:flex-row items-end gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">از تاریخ:</label>
            <ShamsiDatePicker
              selectedDate={startDate}
              onDateChange={setStartDate}
              inputClassName="w-56 p-2.5 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">تا تاریخ:</label>
            <ShamsiDatePicker
              selectedDate={endDate}
              onDateChange={setEndDate}
              inputClassName="w-56 p-2.5 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">مبنای مقایسه:</label>
            <select
              value={baseline}
              onChange={(e) => setBaseline(e.target.value as Baseline)}
              className="p-2.5 border border-gray-300 rounded-lg bg-white"
            >
              <option value="prev">دوره قبلیِ هم‌طول</option>
              <option value="last_year">همین بازه در سال قبل</option>
            </select>
          </div>

          <button
            onClick={fetchCompare}
            disabled={loading || !token}
            className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400"
          >
            {loading ? 'در حال محاسبه...' : 'محاسبه'}
          </button>
        </div>

        {/* میانبرها */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-xs text-gray-500">میان‌بُرها:</span>
          <button onClick={() => preset('this_week')} className="px-2 py-1 text-xs border rounded-md">هفته جاری</button>
          <button onClick={() => preset('this_month')} className="px-2 py-1 text-xs border rounded-md">ماه جاری</button>
          <button onClick={() => preset('last_7')} className="px-2 py-1 text-xs border rounded-md">۷ روز گذشته</button>
          <button onClick={() => preset('last_30')} className="px-2 py-1 text-xs border rounded-md">۳۰ روز گذشته</button>
          <button onClick={() => preset('this_year')} className="px-2 py-1 text-xs border rounded-md">سال جاری</button>
          <span className="mx-2 h-4 w-px bg-gray-300" />
          <button onClick={() => preset('this_month','prev')} className="px-2 py-1 text-xs border rounded-md">ماه جاری + دوره قبلی</button>
          <button onClick={() => preset('this_month','last_year')} className="px-2 py-1 text-xs border rounded-md">ماه جاری + سال قبل</button>
        </div>

        {/* کارت نتیجه */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-indigo-50 rounded-lg p-4">
              <div className="text-sm text-indigo-800 mb-1">فروش دوره فعلی</div>
              <div className="text-2xl font-extrabold text-indigo-700">
                {price(data.currentAmount)}
              </div>
              <div className="text-xs text-gray-600 mt-1">{currentRangeLabel}</div>
              <button
                onClick={() => openDetails('current')}
                className="mt-3 text-xs text-indigo-700 hover:underline"
              >
                مشاهده جزئیات
              </button>
            </div>

            <div className="bg-sky-50 rounded-lg p-4">
              <div className="text-sm text-sky-800 mb-1">فروش دوره مبنا</div>
              <div className="text-2xl font-extrabold text-sky-700">
                {price(data.previousAmount)}
              </div>
              <div className="text-xs text-gray-600 mt-1">{previousRangeLabel}</div>
              <button
                onClick={() => openDetails('previous')}
                className="mt-3 text-xs text-sky-700 hover:underline"
              >
                مشاهده جزئیات
              </button>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-green-800 mb-1">درصد تغییر</div>
              <div className={`text-2xl font-extrabold ${posNegClass(data.percentageChange)}`}>
                {data.percentageChange === null ? '—' : `${data.percentageChange.toFixed(2)}%`}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                مبنا: {data.baseline === 'last_year' ? 'سال قبل' : 'دوره قبلی هم‌طول'}
              </div>
            </div>
          </div>
        )}

        {!data && !loading && (
          <div className="text-sm text-gray-500 mt-2">
            بازه و مبنا را انتخاب کنید و روی «محاسبه» بزنید.
          </div>
        )}
      </div>

      {/* Modal جزئیات */}
      {detailsOpen && (
        <Modal title={detailsTitle} onClose={() => setDetailsOpen(false)} widthClass="max-w-3xl">
          {detailsLoading ? (
            <div className="p-8 text-center text-gray-500">
              <i className="fas fa-spinner fa-spin text-2xl"></i>
            </div>
          ) : detailsRows.length === 0 ? (
            <div className="p-6 text-center text-gray-500">موردی یافت نشد.</div>
          ) : (
            <>
              {/* خلاصه + خروجی‌ها */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="bg-gray-50 border rounded p-2">
                    <div className="text-gray-500">تعداد فاکتور</div>
                    <div className="font-bold">{kpi.count.toLocaleString('fa-IR')}</div>
                  </div>
                  <div className="bg-gray-50 border rounded p-2">
                    <div className="text-gray-500">مجموع فروش</div>
                    <div className="font-bold">{kpi.total.toLocaleString('fa-IR')} تومان</div>
                  </div>
                  <div className="bg-gray-50 border rounded p-2">
                    <div className="text-gray-500">مجموع سود</div>
                    <div className="font-bold">{kpi.profit.toLocaleString('fa-IR')} تومان</div>
                  </div>
                  <div className="bg-gray-50 border rounded p-2">
                    <div className="text-gray-500">میانگین فروش</div>
                    <div className="font-bold">{kpi.avg.toLocaleString('fa-IR')} تومان</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={exportExcel} className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700">
                    خروجی Excel
                  </button>
                  <button onClick={exportPDF} className="px-3 py-1.5 text-xs bg-rose-600 text-white rounded hover:bg-rose-700">
                    خروجی PDF
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">تاریخ</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">مشتری</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">مبلغ</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">سود</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {detailsRows.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{formatIsoToShamsi(r.transactionDate)}</td>
                        <td className="px-3 py-2">{r.customerFullName || 'مهمان'}</td>
                        <td className="px-3 py-2">{price(r.totalPrice)}</td>
                        <td className="px-3 py-2">
                          <span className={posNegClass((r.profit ?? 0))}>
                            {price(r.profit ?? 0)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-left">
                          <a
                            className="text-indigo-600 hover:underline"
                            href={`#/invoices/${r.id}`}
                            title="مشاهده فاکتور"
                          >
                            فاکتور
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
