import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProfitabilityAnalysisItem, NotificationMessage } from '../../types';
import Notification from '../../components/Notification';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../utils/apiFetch';
import {
    createColumnHelper,
    useReactTable,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    flexRender,
    SortingState,
} from '@tanstack/react-table';

const columnHelper = createColumnHelper<ProfitabilityAnalysisItem>();

const formatPrice = (price: number) => price.toLocaleString('fa-IR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' تومان';
const formatNumber = (num: number) => num.toLocaleString('fa-IR');

const ProfitabilityReport: React.FC = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [reportData, setReportData] = useState<ProfitabilityAnalysisItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [notification, setNotification] = useState<NotificationMessage | null>(null);
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState<SortingState>([{ id: 'grossProfit', desc: true }]);

    useEffect(() => {
        if (currentUser && currentUser.roleName === 'Salesperson') {
            setNotification({ type: 'error', text: 'شما اجازه دسترسی به این صفحه را ندارید.' });
            navigate('/reports/analysis');
            return;
        }

        const fetchReport = async () => {
            setIsLoading(true);
            try {
                const response = await apiFetch('/api/analysis/profitability');
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error(result.message || 'خطا در دریافت گزارش سودآوری');
                setReportData(result.data);
            } catch (error: any) {
                setNotification({ type: 'error', text: error.message });
            } finally {
                setIsLoading(false);
            }
        };

        fetchReport();
    }, [currentUser, navigate]);

    const columns = useMemo(() => [
        columnHelper.accessor('itemName', { header: 'نام کالا/محصول', enableSorting: false }),
        columnHelper.accessor('totalQuantitySold', { header: 'تعداد فروش', cell: info => formatNumber(info.getValue()) }),
        columnHelper.accessor('totalRevenue', { header: 'درآمد کل', cell: info => formatPrice(info.getValue()) }),
        columnHelper.accessor('totalCost', { header: 'هزینه کل', cell: info => formatPrice(info.getValue()) }),
        columnHelper.accessor('grossProfit', { header: 'سود ناخالص', cell: info => <span className="font-bold text-green-700">{formatPrice(info.getValue())}</span> }),
        columnHelper.accessor('profitMargin', { header: 'حاشیه سود', cell: info => <span className="font-bold text-indigo-700">{formatNumber(info.getValue())}%</span> }),
    ], []);

    const table = useReactTable({
        data: reportData,
        columns,
        state: { sorting, globalFilter },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    });

    return (
        <div className="space-y-6 text-right" dir="rtl">
            <Notification message={notification} onClose={() => setNotification(null)} />
            <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-1">گزارش سودآوری کالاها</h2>
                <p className="text-sm text-gray-500 mb-4">تحلیل سود ناخالص و حاشیه سود برای تمام کالاهای فروخته شده.</p>
                <div className="relative mb-4">
                    <input
                        type="text"
                        placeholder="جستجو بر اساس نام کالا..."
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        className="w-full max-w-sm pr-10 pl-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <i className="fa-solid fa-search text-gray-400"></i>
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center py-10"><i className="fas fa-spinner fa-spin text-3xl text-indigo-500"></i></div>
                ) : table.getRowModel().rows.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">داده‌ای برای نمایش یافت نشد.</div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-100">
                                    {table.getHeaderGroups().map(headerGroup => (
                                        <tr key={headerGroup.id}>
                                            {headerGroup.headers.map(header => (
                                                <th key={header.id} onClick={header.column.getToggleSortingHandler()} className={`px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider ${header.column.getCanSort() ? 'cursor-pointer hover:bg-gray-200' : ''}`}>
                                                    <div className="flex items-center gap-2">
                                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                                        {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? null}
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    ))}
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {table.getRowModel().rows.map((row) => (
                                        <tr key={row.id} className="hover:bg-gray-50">
                                            {row.getVisibleCells().map(cell => (
                                                <td key={cell.id} className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
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

export default ProfitabilityReport;