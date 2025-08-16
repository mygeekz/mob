import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Repair, NotificationMessage, RepairStatus } from '../types';
import Notification from '../components/Notification';
import { formatIsoToShamsiDateTime } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import { REPAIR_STATUSES } from '../constants';

const Repairs: React.FC = () => {
    const { currentUser, token } = useAuth();
    const navigate = useNavigate();
    const [repairs, setRepairs] = useState<Repair[]>([]);
    const [filteredRepairs, setFilteredRepairs] = useState<Repair[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [notification, setNotification] = useState<NotificationMessage | null>(null);

    const [statusFilter, setStatusFilter] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');

    useEffect(() => {
        if (currentUser && currentUser.roleName === 'Salesperson') {
            setNotification({ type: 'error', text: 'شما اجازه دسترسی به این صفحه را ندارید.' });
            navigate('/');
            return;
        }
        fetchRepairs();
    }, [currentUser, navigate, token]);
    
    useEffect(() => {
        let data = [...repairs];
        if (statusFilter) {
            data = data.filter(r => r.status === statusFilter);
        }
        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            data = data.filter(r => 
                r.customerFullName?.toLowerCase().includes(lowerSearchTerm) ||
                r.deviceModel.toLowerCase().includes(lowerSearchTerm) ||
                String(r.id).includes(lowerSearchTerm)
            );
        }
        setFilteredRepairs(data);
    }, [repairs, statusFilter, searchTerm]);

    const fetchRepairs = async () => {
        setIsLoading(true);
        try {
            const response = await apiFetch('/api/repairs');
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'خطا در دریافت لیست تعمیرات');
            setRepairs(result.data);
        } catch (error: any) {
            setNotification({ type: 'error', text: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusColor = (status: RepairStatus) => {
        switch (status) {
            case 'پذیرش شده': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
            case 'در حال بررسی': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300';
            case 'منتظر قطعه': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
            case 'در حال تعمیر': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300';
            case 'آماده تحویل': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300';
            case 'تحویل داده شده': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
        }
    };
    
    return (
        <div className="space-y-6 text-right" dir="rtl">
            <Notification message={notification} onClose={() => setNotification(null)} />

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4 border-b dark:border-gray-700 pb-4">
                    <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">مرکز تعمیرات</h2>
                    <button onClick={() => navigate('/repairs/new')} className="px-5 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors whitespace-nowrap">
                        <i className="fas fa-plus ml-2"></i>پذیرش دستگاه جدید
                    </button>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
                    <div className="relative w-full sm:w-72">
                         <input
                            type="text"
                            placeholder="جستجو (شناسه, مشتری, مدل)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pr-10 pl-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none bg-white dark:bg-gray-700"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <i className="fa-solid fa-search text-gray-400"></i>
                        </div>
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full sm:w-auto p-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    >
                        <option value="">همه وضعیت‌ها</option>
                        {REPAIR_STATUSES.map(status => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                </div>

                {isLoading ? (
                    <div className="p-10 text-center text-gray-500 dark:text-gray-400"><i className="fas fa-spinner fa-spin text-3xl mb-3"></i><p>در حال بارگذاری تعمیرات...</p></div>
                ) : filteredRepairs.length === 0 ? (
                    <div className="p-10 text-center text-gray-500 dark:text-gray-400"><i className="fas fa-tools text-3xl text-gray-400 mb-3"></i><p>هیچ تعمیراتی یافت نشد.</p></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">شناسه</th>
                                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">مشتری</th>
                                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">دستگاه</th>
                                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">تاریخ پذیرش</th>
                                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">وضعیت</th>
                                    <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-300">عملیات</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {filteredRepairs.map(repair => (
                                    <tr key={repair.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{repair.id}</td>
                                        <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{repair.customerFullName}</td>
                                        <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{repair.deviceModel}</td>
                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatIsoToShamsiDateTime(repair.dateReceived)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusColor(repair.status)}`}>
                                                {repair.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Link to={`/repairs/${repair.id}`} className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium">مشاهده جزئیات</Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Repairs;
