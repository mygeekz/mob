import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CreditorReportItem, NotificationMessage } from '../../types';
import Notification from '../../components/Notification';
import { useAuth } from '../../contexts/AuthContext'; // Import useAuth
import { getAuthHeaders } from '../../utils/apiUtils'; // Import getAuthHeaders
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';

const formatBalance = (balance: number) => {
  // Creditors always have a positive balance (we owe them)
  return <span className="text-red-600 font-semibold">{balance.toLocaleString('fa-IR')} تومان (بدهی به همکار)</span>;
};

const columnHelper = createColumnHelper<CreditorReportItem>();

const CreditorsReportPage: React.FC = () => {
  const { token } = useAuth(); // Get token
  const [creditors, setCreditors] = useState<CreditorReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationMessage | null>(null);
  const [globalFilter, setGlobalFilter] = useState('');

  const fetchCreditors = async () => {
    if (!token) return;
    setIsLoading(true);
    setNotification(null);
    try {
      const response = await fetch('/api/reports/creditors', { headers: getAuthHeaders(token) });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'خطا در دریافت لیست بستانکاران');
      }
      setCreditors(result.data);
    } catch (error) {
      setNotification({ type: 'error', text: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCreditors();
    }
  }, [token]);

  const columns = useMemo(() => [
    columnHelper.accessor('partnerName', { header: 'نام همکار' }),
    columnHelper.accessor('partnerType', { header: 'نوع همکار' }),
    columnHelper.accessor('balance', { header: 'مبلغ بستانکاری (بدهی ما)', cell: info => formatBalance(info.getValue()) }),
    columnHelper.accessor('id', {
        header: 'عملیات',
        cell: info => <Link to={`/partners/${info.getValue()}`} className="text-teal-600 hover:text-teal-800 transition-colors">مشاهده جزئیات حساب</Link>
    }),
  ], []);

  const table = useReactTable({
      data: creditors,
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
        <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-3 border-b pb-4">
            <h2 className="text-xl font-semibold text-gray-800">گزارش همکاران بستانکار (طلبکار از ما)</h2>
            <div className="flex items-center gap-3">
              <input type="text" placeholder="جستجو..." value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} className="p-2 border rounded-md text-sm"/>
              <button
                  onClick={fetchCreditors}
                  disabled={isLoading || !token}
                  className="px-4 py-2 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:bg-teal-400 transition-colors text-sm"
              >
                  <i className={`fas fa-sync-alt ml-2 ${isLoading ? 'fa-spin' : ''}`}></i>
                  به‌روزرسانی لیست
              </button>
            </div>
        </div>
        
        {isLoading ? (
          <div className="p-10 text-center text-gray-500"><i className="fas fa-spinner fa-spin text-3xl mb-3"></i><p>در حال بارگذاری لیست بستانکاران...</p></div>
        ) : creditors.length === 0 ? (
          <div className="p-10 text-center text-gray-500"><i className="fas fa-check-circle text-3xl text-green-500 mb-3"></i><p>در حال حاضر هیچ همکار بستانکاری (که ما به او بدهکار باشیم) وجود ندارد.</p></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th key={header.id} className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {table.getRowModel().rows.map(row => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm">
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

export default CreditorsReportPage;