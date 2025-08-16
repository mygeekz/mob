import React, { useState, useEffect, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import moment from 'jalali-moment';
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';

import { SalesSummaryData, NotificationMessage, TopSellingItem } from '../../types';
import Notification from '../../components/Notification';
import ShamsiDatePicker from '../../components/ShamsiDatePicker'; 
import { formatIsoToShamsi } from '../../utils/dateUtils';
import { useAuth } from '../../contexts/AuthContext'; // Import useAuth
import { getAuthHeaders } from '../../utils/apiUtils'; // Import getAuthHeaders

const formatPrice = (price: number) => {
  return price.toLocaleString('fa-IR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' تومان';
};

const columnHelper = createColumnHelper<TopSellingItem>();

const SalesReportPage: React.FC = () => {
  const { token } = useAuth(); // Get token
  const [reportData, setReportData] = useState<SalesSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<NotificationMessage | null>(null);
  
  const [startDate, setStartDate] = useState<Date | null>(moment().subtract(30, 'days').toDate());
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  
  const [globalFilter, setGlobalFilter] = useState('');

  const fetchSalesReport = async () => {
    if (!startDate || !endDate || !token) {
      setNotification({ type: 'error', text: 'لطفاً تاریخ شروع و پایان را انتخاب کنید و از ورود خود مطمئن شوید.' });
      return;
    }
    setIsLoading(true);
    setNotification(null);
    setReportData(null);

    const fromDateShamsi = moment(startDate).locale('fa').format('YYYY/MM/DD');
    const toDateShamsi = moment(endDate).locale('fa').format('YYYY/MM/DD');

    try {
      const response = await fetch(`/api/reports/sales-summary?fromDate=${fromDateShamsi}&toDate=${toDateShamsi}`, { headers: getAuthHeaders(token) });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'خطا در دریافت گزارش فروش و سود');
      }
      setReportData(result.data);
    } catch (error) {
      setNotification({ type: 'error', text: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchSalesReport();
    }
  }, [token]); // Initial fetch on token availability

  const StatCardReport: React.FC<{ title: string; value: string | number; icon: string; bgColor?: string; textColor?: string }> = ({ title, value, icon, bgColor = "bg-indigo-100", textColor = "text-indigo-600" }) => (
    <div className="bg-white rounded-xl shadow p-5 text-right">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-xl lg:text-2xl font-bold text-gray-900 mt-1">
            {typeof value === 'number' ? formatPrice(value) : value}
          </p>
        </div>
        <div className={`w-10 h-10 lg:w-12 lg:h-12 ${bgColor} rounded-lg flex items-center justify-center`}>
          <i className={`${icon} ${textColor} text-lg lg:text-xl`}></i>
        </div>
      </div>
    </div>
  );

  const columns = useMemo(() => [
      columnHelper.accessor('itemName', { header: 'نام کالا/محصول' }),
      columnHelper.accessor('itemType', { header: 'نوع', cell: info => info.getValue() === 'phone' ? 'گوشی موبایل' : 'کالای انبار' }),
      columnHelper.accessor('quantitySold', { header: 'تعداد فروخته شده', cell: info => info.getValue().toLocaleString('fa-IR') }),
      columnHelper.accessor('totalRevenue', { header: 'مجموع درآمد', cell: info => <span className="font-semibold text-indigo-700">{formatPrice(info.getValue())}</span> }),
  ], []);

  const table = useReactTable({
      data: reportData?.topSellingItems || [],
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
        <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-3">گزارش فروش و سود</h2>
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
            onClick={fetchSalesReport}
            disabled={isLoading || !token}
            className="w-full sm:w-auto mt-3 sm:mt-0 self-end px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-400 transition-colors"
          >
            {isLoading ? (<><i className="fas fa-spinner fa-spin ml-2"></i>درحال بارگذاری...</>) : 'اعمال فیلتر و مشاهده گزارش'}
          </button>
        </div>

        {isLoading && !reportData && (
          <div className="p-10 text-center text-gray-500"><i className="fas fa-spinner fa-spin text-3xl mb-3"></i><p>در حال بارگذاری گزارش...</p></div>
        )}

        {!isLoading && !reportData && (
           <div className="p-10 text-center text-gray-500"><i className="fas fa-info-circle text-3xl mb-3 text-gray-400"></i><p>گزارشی برای نمایش وجود ندارد. لطفاً بازه زمانی را انتخاب و دکمه "اعمال فیلتر" را بزنید.</p></div>
        )}
        
        {reportData && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCardReport title="مجموع درآمد" value={reportData.totalRevenue} icon="fa-solid fa-sack-dollar" bgColor="bg-green-100" textColor="text-green-600" />
              <StatCardReport title="سود ناخالص" value={reportData.grossProfit} icon="fa-solid fa-hand-holding-dollar" bgColor="bg-sky-100" textColor="text-sky-600" />
              <StatCardReport title="تعداد تراکنش‌ها" value={reportData.totalTransactions.toLocaleString('fa-IR')} icon="fa-solid fa-receipt" bgColor="bg-yellow-100" textColor="text-yellow-600" />
              <StatCardReport title="میانگین ارزش فروش" value={reportData.averageSaleValue} icon="fa-solid fa-calculator" bgColor="bg-purple-100" textColor="text-purple-600" />
            </div>

            {reportData.dailySales && reportData.dailySales.length > 0 && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">روند فروش روزانه</h3>
                <div className="w-full h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={reportData.dailySales} margin={{ top: 5, right: 0, left: 20, bottom: 20 }}>
                       <defs>
                        <linearGradient id="salesReportGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.05}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false}/>
                      <XAxis 
                        dataKey="date" // This is expected to be an ISO YYYY-MM-DD date from backend now
                        tickFormatter={(tick) => formatIsoToShamsi(tick)} // Format for display
                        tick={{ fontSize: 11, fill: '#6B7280' }} 
                        axisLine={{ stroke: '#e0e0e0' }} 
                        tickLine={{ stroke: '#e0e0e0' }}
                        angle={-30}
                        textAnchor="end"
                        height={50}
                        interval={Math.floor(reportData.dailySales.length / 10)}
                       />
                      <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} orientation="right" tickFormatter={(value) => value.toLocaleString('fa-IR')} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', direction: 'rtl', border: '1px solid #e0e0e0' }}
                        itemStyle={{ color: '#4F46E5' }}
                        labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                        formatter={(value: number) => [formatPrice(value), 'فروش روز']}
                        labelFormatter={(label: string) => `تاریخ: ${formatIsoToShamsi(label)}`}
                      />
                      <Legend wrapperStyle={{fontSize: "13px", direction: "rtl"}}/>
                      <Line type="monotone" dataKey="totalSales" stroke="#4F46E5" fill="url(#salesReportGradient)" strokeWidth={2} activeDot={{ r: 6 }} name="مجموع فروش روزانه" dot={{r:3}}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            
             {reportData.topSellingItems && (
              <div className="bg-white rounded-xl shadow">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-800">محصولات/کالاهای پرفروش (بر اساس درآمد)</h3>
                  <input type="text" placeholder="جستجو..." value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} className="p-2 border rounded-md text-sm w-1/3"/>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-right">
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
                        <tr key={row.id} className="hover:bg-gray-50">
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
                        <select value={table.getState().pagination.pageSize} onChange={e => table.setPageSize(Number(e.target.value))} className="p-1 border rounded"><option value="10">نمایش 10</option><option value="20">نمایش 20</option></select>
                    </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesReportPage;