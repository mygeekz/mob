import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';

import { InventoryVelocityAnalysis, NotificationMessage, VelocityItem } from '../../types';
import Notification from '../../components/Notification';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../utils/apiFetch';

const formatNumber = (num: number, digits: number = 2) => num.toLocaleString('fa-IR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const columnHelper = createColumnHelper<VelocityItem>();

const VelocityTable: React.FC<{ data: VelocityItem[], title: string, icon: string, color: string }> = ({ data, title, icon, color }) => {
    const columns = useMemo(() => [
        columnHelper.accessor('itemName', { header: 'نام کالا' }),
        columnHelper.accessor('salesPerDay', { header: 'نرخ فروش (روزانه)', cell: info => formatNumber(info.getValue()) }),
    ], []);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    });

    return (
        <div>
            <div className={`flex items-center mb-4 text-${color}-700`}>
                <i className={`${icon} text-2xl text-${color}-500 ml-3`}></i>
                <h3 className="text-lg font-bold">{title}</h3>
            </div>
            {data.length === 0 ? (
                <p className="text-sm text-gray-500">موردی یافت نشد.</p>
            ) : (
                <>
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                {table.getHeaderGroups().map(headerGroup => (
                                    <tr key={headerGroup.id}>
                                        {headerGroup.headers.map(header => <th key={header.id} className="px-4 py-2 text-right text-xs font-semibold text-gray-600">{flexRender(header.column.columnDef.header, header.getContext())}</th>)}
                                    </tr>
                                ))}
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {table.getRowModel().rows.map(row => (
                                    <tr key={row.id}>
                                        {row.getVisibleCells().map(cell => <td key={cell.id} className="px-4 py-3 text-sm text-gray-700">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {table.getPageCount() > 1 && (
                        <div className="flex items-center justify-between pt-2 text-xs">
                            <div className="flex items-center gap-1"><button onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>«</button><button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>‹</button><button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>›</button><button onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>»</button></div>
                            <span>صفحه {table.getState().pagination.pageIndex + 1} از {table.getPageCount()}</span>
                            <select value={table.getState().pagination.pageSize} onChange={e => table.setPageSize(Number(e.target.value))} className="p-1 border rounded"><option value="5">5</option><option value="10">10</option><option value="20">20</option></select>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};


const InventoryAnalysisReport: React.FC = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [reportData, setReportData] = useState<InventoryVelocityAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [notification, setNotification] = useState<NotificationMessage | null>(null);

    useEffect(() => {
        if (currentUser && currentUser.roleName === 'Salesperson') {
            setNotification({ type: 'error', text: 'شما اجازه دسترسی به این صفحه را ندارید.' });
            navigate('/reports/analysis');
            return;
        }

        const fetchReport = async () => {
            setIsLoading(true);
            try {
                const response = await apiFetch('/api/analysis/inventory-velocity');
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error(result.message || 'خطا در دریافت گزارش تحلیل انبار');
                setReportData(result.data);
            } catch (error: any) {
                setNotification({ type: 'error', text: error.message });
            } finally {
                setIsLoading(false);
            }
        };

        fetchReport();
    }, [currentUser, navigate]);


    return (
        <div className="space-y-6 text-right" dir="rtl">
            <Notification message={notification} onClose={() => setNotification(null)} />
            <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-1">تحلیل وضعیت انبار</h2>
                <p className="text-sm text-gray-500 mb-6">شناسایی کالاهای پرفروش برای تمرکز بر تأمین و کالاهای راکد برای برنامه‌ریزی فروش ویژه.</p>

                {isLoading ? (
                    <div className="text-center py-10"><i className="fas fa-spinner fa-spin text-3xl text-indigo-500"></i></div>
                ) : !reportData || (reportData.hotItems.length === 0 && reportData.staleItems.length === 0 && reportData.normalItems.length === 0) ? (
                    <div className="text-center py-10 text-gray-500">داده‌ای برای تحلیل یافت نشد.</div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <VelocityTable data={reportData.hotItems} title="کالاهای پرفروش (داغ)" icon="fas fa-fire-alt" color="green" />
                        <VelocityTable data={reportData.staleItems} title="کالاهای کم‌فروش (راکد)" icon="fas fa-snowflake" color="red" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default InventoryAnalysisReport;