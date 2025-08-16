import React, { useState, useEffect, useMemo } from 'react';
import moment from 'jalali-moment';
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';

import { PhoneSaleProfitReportItem, NotificationMessage } from '../../types';
import Notification from '../../components/Notification';
import ShamsiDatePicker from '../../components/ShamsiDatePicker';
import { formatIsoToShamsi } from '../../utils/dateUtils';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../utils/apiFetch';

const columnHelper = createColumnHelper<PhoneSaleProfitReportItem>();

const formatPrice = (price: number) => {
    const color = price > 0 ? 'text-green-600' : price < 0 ? 'text-red-600' : 'text-gray-700';
    return <span className={`font-semibold ${color}`}>{price.toLocaleString('fa-IR')} تومان</span>;
};
const formatSimplePrice = (price: number) => `${price.toLocaleString('fa-IR')} تومان`;


const PhoneSalesReportPage: React.FC = () => {
    const { token } = useAuth();
    const [reportData, setReportData] = useState<PhoneSaleProfitReportItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [notification, setNotification] = useState<NotificationMessage | null>(null);

    const [startDate, setStartDate] = useState<Date | null>(moment().subtract(30, 'days').toDate());
    const [endDate, setEndDate] = useState<Date | null>(new Date());
    
    const [globalFilter, setGlobalFilter] = useState('');

    const fetchReport = async () => {
        if (!startDate || !endDate || !token) {
            setNotification({ type: 'error', text: 'لطفاً تاریخ شروع و پایان را انتخاب کنید.' });
            return;
        }
        setIsLoading(true);
        setNotification(null);
        setReportData([]);

        const fromDateShamsi = moment(startDate).locale('fa').format('YYYY/MM/DD');
        const toDateShamsi = moment(endDate).locale('fa').format('YYYY/MM/DD');

        try {
            const response = await apiFetch(`/api/reports/phone-sales?fromDate=${fromDateShamsi}&toDate=${toDateShamsi}`);
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || 'خطا در دریافت گزارش فروش موبایل');
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
            fetchReport();
        }
    }, [token]);
    
    const columns = useMemo(() => [
        columnHelper.accessor('transactionDate', { header: 'تاریخ فروش', cell: info => formatIsoToShamsi(info.getValue(), 'jD jMMMM jYYYY') }),
        columnHelper.accessor('customerFullName', { header: 'مشتری', cell: info => info.getValue() || 'مهمان' }),
        columnHelper.accessor('phoneModel', { header: 'مدل گوشی و IMEI', cell: info => <div><p>{info.getValue()}</p><p className="text-xs text-gray-500 dir-ltr">{info.row.original.imei}</p></div> }),
        columnHelper.accessor('purchasePrice', { header: 'قیمت خرید', cell: info => formatSimplePrice(info.getValue()) }),
        columnHelper.accessor('totalPrice', { header: 'قیمت فروش', cell: info => formatSimplePrice(info.getValue()) }),
        columnHelper.accessor('profit', { header: 'سود', cell: info => formatPrice(info.getValue()) }),
    ], []);

    const table = useReactTable({
        data: reportData,
        columns,
        state: { globalFilter },
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    });
    
    const totalProfit = table.getFilteredRowModel().rows.reduce((sum, row) => sum + row.original.profit, 0);
    const totalRevenue = table.getFilteredRowModel().rows.reduce((sum, row) => sum + row.original.totalPrice, 0);

    return (
        <div className="space-y-6 text-right" dir="rtl">
            <Notification message={notification} onClose={() => setNotification(null)} />

            <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-3">گزارش فروش نقدی و اعتباری موبایل</h2>
                <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                    <div className="w-full sm:w-auto">
                        <label className="block text-sm font-medium text-gray-700 mb-1">از تاریخ:</label>
                        <ShamsiDatePicker selectedDate={startDate} onDateChange={setStartDate} inputClassName="w-full p-2.5 border border-gray-300 rounded-lg"/>
                    </div>
                    <div className="w-full sm:w-auto">
                        <label className="block text-sm font-medium text-gray-700 mb-1">تا تاریخ:</label>
                        <ShamsiDatePicker selectedDate={endDate} onDateChange={setEndDate} inputClassName="w-full p-2.5 border border-gray-300 rounded-lg"/>
                    </div>
                    <button onClick={fetchReport} disabled={isLoading || !token} className="w-full sm:w-auto self-end px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400">
                        {isLoading ? 'درحال بارگذاری...' : 'اعمال فیلتر'}
                    </button>
                </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-green-50 p-4 rounded-lg text-center">
                        <p className="text-sm text-green-800">مجموع سود (برای نتایج فیلتر شده)</p>
                        <p className="text-2xl font-bold text-green-700">{formatPrice(totalProfit)}</p>
                    </div>
                     <div className="bg-sky-50 p-4 rounded-lg text-center">
                        <p className="text-sm text-sky-800">مجموع درآمد (برای نتایج فیلتر شده)</p>
                        <p className="text-2xl font-bold text-sky-700">{formatSimplePrice(totalRevenue)}</p>
                    </div>
                </div>

                <div className="relative mb-4">
                    <input type="text" placeholder="جستجو در نتایج (مدل، IMEI، مشتری)..." value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)}
                        className="w-full max-w-lg pr-10 pl-3 py-2 border border-gray-300 rounded-lg"/>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"><i className="fa-solid fa-search text-gray-400"></i></div>
                </div>


                {isLoading ? (
                    <div className="p-10 text-center"><i className="fas fa-spinner fa-spin text-3xl text-indigo-500"></i></div>
                ) : table.getRowModel().rows.length === 0 ? (
                    <div className="p-10 text-center text-gray-500">گزارشی برای نمایش در این بازه زمانی یافت نشد.</div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-100">
                                    {table.getHeaderGroups().map(headerGroup => (
                                        <tr key={headerGroup.id}>{headerGroup.headers.map(header => <th key={header.id} className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>
                                    ))}
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {table.getRowModel().rows.map(row => (
                                        <tr key={row.id} className="hover:bg-gray-50">
                                            {row.getVisibleCells().map(cell => <td key={cell.id} className="px-4 py-3 text-sm text-gray-700">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
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

export default PhoneSalesReportPage;