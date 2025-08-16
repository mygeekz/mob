import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import moment from 'jalali-moment';
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';

import { TopSupplierReportItem, NotificationMessage } from '../../types';
import Notification from '../../components/Notification';
import ShamsiDatePicker from '../../components/ShamsiDatePicker'; 
import { useAuth } from '../../contexts/AuthContext'; // Import useAuth
import { getAuthHeaders } from '../../utils/apiUtils'; // Import getAuthHeaders

const formatPrice = (price: number) => {
  return price.toLocaleString('fa-IR') + ' تومان';
};

const columnHelper = createColumnHelper<TopSupplierReportItem>();

const TopSuppliersReportPage: React.FC = () => {
  const { token } = useAuth(); // Get token
  const [topSuppliers, setTopSuppliers] = useState<TopSupplierReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<NotificationMessage | null>(null);
  
  const [startDate, setStartDate] = useState<Date | null>(moment().subtract(30, 'days').toDate());
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [globalFilter, setGlobalFilter] = useState('');


  const fetchTopSuppliers = async () => {
    if (!startDate || !endDate || !token) {
      setNotification({ type: 'error', text: 'لطفاً تاریخ شروع و پایان را انتخاب کنید و از ورود خود مطمئن شوید.' });
      return;
    }
    setIsLoading(true);
    setNotification(null);
    setTopSuppliers([]);

    const fromDateShamsi = moment(startDate).locale('fa').format('YYYY/MM/DD');
    const toDateShamsi = moment(endDate).locale('fa').format('YYYY/MM/DD');

    try {
      // Note: API expects shamsi dates, conversion happens in server/index.ts for this route
      const response = await fetch(`/api/reports/top-suppliers?fromDate=${fromDateShamsi}&toDate=${toDateShamsi}`, { headers: getAuthHeaders(token) });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'خطا در دریافت گزارش تامین‌کنندگان برتر');
      }
      setTopSuppliers(result.data);
    } catch (error) {
      setNotification({ type: 'error', text: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (token) {
      fetchTopSuppliers();
    }
  }, [token]); // Initial fetch on token availability

  const columns = useMemo(() => [
      columnHelper.accessor('partnerName', { header: 'نام تامین‌کننده' }),
      columnHelper.accessor('totalPurchaseValue', { header: 'مجموع ارزش خرید کالا', cell: info => <span className="font-semibold text-green-700">{formatPrice(info.getValue())}</span> }),
      columnHelper.accessor('transactionCount', { header: 'تعداد تراکنش‌ها', cell: info => info.getValue().toLocaleString('fa-IR') }),
      columnHelper.accessor('partnerId', {
          header: 'مشاهده پروفایل',
          cell: info => <Link to={`/partners/${info.getValue()}`} className="text-teal-600 hover:text-teal-800 transition-colors">مشاهده جزئیات</Link>
      }),
  ], []);

  const table = useReactTable({
      data: topSuppliers,
      columns,
      state: { globalFilter },
      onGlobalFilterChange: setGlobalFilter,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <Notification message={notification} onClose={() => setNotification(null)} />

      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-3">گزارش تامین‌کنندگان برتر (بر اساس ارزش خرید کالا)</h2>
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
          <div className="w-full sm:w-auto">
            <label htmlFor="startDatePicker" className="block text-sm font-medium text-gray-700 mb-1">از تاریخ:</label>
            <ShamsiDatePicker
              id="startDatePicker"
              selectedDate={startDate}
              onDateChange={setStartDate}
              inputClassName="w-full p-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>
          <div className="w-full sm:w-auto">
            <label htmlFor="endDatePicker" className="block text-sm font-medium text-gray-700 mb-1">تا تاریخ:</label>
            <ShamsiDatePicker
              id="endDatePicker"
              selectedDate={endDate}
              onDateChange={(date) => {
                if (startDate && date && date < startDate) {
                  setEndDate(startDate);
                } else {
                  setEndDate(date);
                }
              }}
              inputClassName="w-full p-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>
          <button
            onClick={fetchTopSuppliers}
            disabled={isLoading || !token}
            className="w-full sm:w-auto mt-3 sm:mt-0 self-end px-5 py-2.5 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:bg-teal-400 transition-colors"
          >
            {isLoading ? 'درحال بارگذاری...' : 'اعمال فیلتر'}
          </button>
        </div>
        
        {isLoading && topSuppliers.length === 0 && (
          <div className="p-10 text-center text-gray-500"><i className="fas fa-spinner fa-spin text-3xl mb-3"></i><p>در حال بارگذاری گزارش...</p></div>
        )}
        {!isLoading && topSuppliers.length === 0 && (
          <div className="p-10 text-center text-gray-500"><i className="fas fa-truck text-3xl text-gray-400 mb-3"></i><p>تامین‌کننده برتری در بازه زمانی انتخاب شده یافت نشد یا هنوز داده‌ای برای نمایش وجود ندارد.</p></div>
        )}
        
        {topSuppliers.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                   {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                       {headerGroup.headers.map((header, index) => (
                        <th key={header.id} className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          {index === 0 ? 'رتبه' : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {table.getRowModel().rows.map((row, index) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                       <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">{(table.getState().pagination.pageIndex * table.getState().pagination.pageSize) + index + 1}</td>
                       {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {table.getPageCount() > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-gray-200 text-sm">
                    <div className="flex items-center gap-2"><button onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>«</button><button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>‹</button><button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>›</button><button onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>»</button></div>
                    <div className="flex items-center gap-2"><span>صفحه</span><strong>{table.getState().pagination.pageIndex + 1} از {table.getPageCount()}</strong></div>
                    <select value={table.getState().pagination.pageSize} onChange={e => table.setPageSize(Number(e.target.value))} className="p-1 border rounded"><option value="10">نمایش 10</option><option value="20">نمایش 20</option><option value="50">نمایش 50</option></select>
                </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TopSuppliersReportPage;