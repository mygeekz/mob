import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ActionItem } from '../types';
import { apiFetch } from '../utils/apiFetch';

const ActionCenterWidget: React.FC = () => {
    const [actionItems, setActionItems] = useState<ActionItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchActionItems = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await apiFetch('/api/dashboard/action-center');
                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result.message || 'خطا در دریافت اطلاعات مرکز عملیات');
                }
                const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
                const sortedData = result.data.sort((a: ActionItem, b: ActionItem) => 
                    priorityOrder[a.priority] - priorityOrder[b.priority]
                );
                setActionItems(sortedData);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchActionItems();
    }, []);

    const getItemAppearance = (type: ActionItem['type']): { icon: string; color: string } => {
        switch (type) {
            case 'StockAlert':
                return { icon: 'fa-solid fa-boxes-stacked', color: 'border-red-500' };
            case 'OverdueInstallment':
                return { icon: 'fa-solid fa-calendar-times', color: 'border-red-500' };
            case 'StagnantStock':
                return { icon: 'fa-solid fa-snowflake', color: 'border-yellow-500' };
            case 'RepairReady':
                return { icon: 'fa-solid fa-check-circle', color: 'border-blue-500' };
            default:
                return { icon: 'fa-solid fa-bell', color: 'border-gray-500' };
        }
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                    <i className="fas fa-spinner fa-spin text-xl mr-2"></i> در حال بررسی کارهای روز...
                </div>
            );
        }

        if (error) {
            return <div className="p-6 text-center text-red-500">{error}</div>;
        }

        if (actionItems.length === 0) {
            return (
                <div className="p-6 text-center text-green-600 dark:text-green-400">
                    <i className="fas fa-check-circle text-2xl mb-2"></i>
                    <p>همه چیز مرتب است! کار ضروری برای امروز وجود ندارد.</p>
                </div>
            );
        }

        return (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[400px] overflow-y-auto">
                {actionItems.map(item => {
                    const { icon, color } = getItemAppearance(item.type);
                    return (
                        <li key={item.id} className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-r-4 ${color}`}>
                            <div className="flex items-start space-x-3 space-x-reverse">
                                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                                    <i className={`${icon} text-lg text-gray-500 dark:text-gray-400`}></i>
                                </div>
                                <div className="flex-1 min-w-0 text-right">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{item.description}</p>
                                </div>
                                <div className="flex-shrink-0">
                                    <Link
                                        to={item.actionLink}
                                        className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                                    >
                                        {item.actionText}
                                    </Link>
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        );
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 text-right">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">مرکز عملیات و کارهای روز</h3>
                {!isLoading && actionItems.length > 0 && (
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                )}
            </div>
            {renderContent()}
        </div>
    );
};

export default ActionCenterWidget;
