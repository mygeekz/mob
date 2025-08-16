import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PurchaseSuggestionItem, NotificationMessage } from '../../types';
import Notification from '../../components/Notification';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../utils/apiFetch';
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';

const columnHelper = createColumnHelper<PurchaseSuggestionItem>();

const formatNumber = (num: number, digits: number = 0) => num.toLocaleString('fa-IR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const PurchaseSuggestionReport: React.FC = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [suggestions, setSuggestions] = useState<PurchaseSuggestionItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [notification, setNotification] = useState<NotificationMessage | null>(null);

    useEffect(() => {
        if (currentUser && currentUser.roleName === 'Salesperson') {
            setNotification({ type: 'error', text: 'شما اجازه دسترسی به این صفحه را ندارید.' });
            navigate('/reports/analysis');
            return;
        }

        const fetchSuggestions = async () => {
            setIsLoading(true);
            try {
                const response = await apiFetch('/api/analysis/purchase-suggestions');
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error(result.message || 'خطا در دریافت پیشنهادهای خرید');
                setSuggestions(result.data);
            } catch (error: any) {
                setNotification({ type: 'error', text: error.message });
            } finally {
                setIsLoading(false);
            }
        };

        fetchSuggestions();
    }, [currentUser, navigate]);

    const getDaysLeftColor = (days: number) => {
        if (days < 7) return 'text-red-600 font-bold';
        if (days < 15) return 'text-yellow-600 font-semibold';
        return 'text-gray-700';
    }

    const columns = useMemo(() => [
        columnHelper.accessor('itemName', { header: 'نام کالا/محصول' }),
        columnHelper.accessor('currentStock', { header: 'موجودی فعلی', cell: info => formatNumber(info.getValue()) }),
        columnHelper.accessor('salesPerDay', { header: 'نرخ فروش (روزانه)', cell: info => formatNumber(info.getValue(), 2) }),
        columnHelper.accessor('daysOfStockLeft', { header: 'موجودی برای چند روز؟', cell: info => <span className={getDaysLeftColor(info.getValue())}>{isFinite(info.getValue()) ? `${formatNumber(info.getValue(), 1)} روز` : '∞'}</span> }),
        columnHelper.accessor('suggestedPurchaseQuantity', { header: 'تعداد پیشنهادی خرید', cell: info => <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">{formatNumber(info.getValue())} عدد</span> }),
    ], []);

    const table = useReactTable({
        data: suggestions,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    });

    return (
        <div className="space-y-6 text-right" dir="rtl">
            <Notification message={notification} onClose={() => setNotification(null)} />
            <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-1">پیشنهادهای هوشمند خرید</h2>
                <p className="text-sm text-gray-500 mb-6">این لیست شامل کالاهایی است که بر اساس نرخ فروش فعلی، موجودی آن‌ها به زودی تمام می‌شود. (پیش‌فرض: پیشنهاد خرید برای پوشش ۳۰ روز آینده)</p>

                {isLoading ? (
                    <div className="text-center py-10"><i className="fas fa-spinner fa-spin text-3xl text-indigo-500"></i></div>
                ) : suggestions.length === 0 ? (
                    <div className="p-10 text-center text-gray-500">
                        <i className="fas fa-check-circle text-3xl text-green-500 mb-3"></i>
                        <p>در حال حاضر هیچ کالایی نیاز فوری به سفارش مجدد ندارد. وضعیت انبار مطلوب است.</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-100">
                                    {table.getHeaderGroups().map(headerGroup => (
                                        <tr key={headerGroup.id}>
                                            {headerGroup.headers.map(header => <th key={header.id} className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">{flexRender(header.column.columnDef.header, header.getContext())}</th>)}
                                        </tr>
                                    ))}
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {table.getRowModel().rows.map((row) => (
                                        <tr key={row.id} className="hover:bg-gray-50">
                                           {row.getVisibleCells().map(cell => <td key={cell.id} className="px-4 py-4 whitespace-nowrap text-sm">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
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

export default PurchaseSuggestionReport;