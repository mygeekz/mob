import React, { useState, useEffect, FormEvent, useMemo } from 'react';
import { Service, NewServiceData, NotificationMessage } from '../types';
import Notification from '../components/Notification';
import Modal from '../components/Modal';
import PriceInput from '../components/PriceInput';
import { apiFetch } from '../utils/apiFetch';
import { useAuth } from '../contexts/AuthContext';
import {
    createColumnHelper,
    useReactTable,
    getCoreRowModel,
    getPaginationRowModel,
    flexRender,
} from '@tanstack/react-table';

const columnHelper = createColumnHelper<Service>();

const ServicesPage: React.FC = () => {
    const { token, currentUser } = useAuth();
    const [services, setServices] = useState<Service[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [notification, setNotification] = useState<NotificationMessage | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [currentService, setCurrentService] = useState<Partial<NewServiceData & { id?: number }>>({});
    const [formErrors, setFormErrors] = useState<Partial<Record<keyof NewServiceData, string>>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [itemToDelete, setItemToDelete] = useState<Service | null>(null);

    const fetchServices = async () => {
        setIsLoading(true);
        try {
            const response = await apiFetch('/api/services');
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || 'خطا در دریافت لیست خدمات');
            }
            setServices(result.data);
        } catch (error: any) {
            setNotification({ type: 'error', text: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchServices();
        } else {
            setIsLoading(false);
        }
    }, [token]);

    const openModal = (mode: 'add' | 'edit', service: Service | null = null) => {
        setModalMode(mode);
        setFormErrors({});
        if (mode === 'edit' && service) {
            setCurrentService({ ...service, price: String(service.price) });
        } else {
            setCurrentService({ name: '', description: '', price: '' });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setCurrentService({});
        setFormErrors({});
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { name: string, value: string } }) => {
        const { name, value } = e.target;
        setCurrentService(prev => ({ ...prev, [name]: value }));
        if (formErrors[name as keyof NewServiceData]) {
            setFormErrors(prev => ({ ...prev, [name]: undefined }));
        }
    };

    const validateForm = (): boolean => {
        const errors: Partial<Record<keyof NewServiceData, string>> = {};
        if (!currentService.name?.trim()) {
            errors.name = 'نام خدمت الزامی است.';
        }
        const priceNum = Number(currentService.price);
        if (isNaN(priceNum) || priceNum <= 0) {
            errors.price = 'قیمت باید عددی مثبت باشد.';
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;
        setIsSubmitting(true);
        setNotification(null);

        const url = modalMode === 'add' ? '/api/services' : `/api/services/${currentService.id}`;
        const method = modalMode === 'add' ? 'POST' : 'PUT';
        const payload = {
            name: currentService.name || '',
            description: currentService.description || '',
            price: Number(currentService.price),
        };

        try {
            const response = await apiFetch(url, {
                method: method,
                body: JSON.stringify(payload),
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message);
            }
            setNotification({ type: 'success', text: result.message });
            closeModal();
            fetchServices();
        } catch (error: any) {
            setNotification({ type: 'error', text: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDelete = async () => {
        if (!itemToDelete) return;
        setIsSubmitting(true);
        try {
            const response = await apiFetch(`/api/services/${itemToDelete.id}`, { method: 'DELETE' });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message);
            }
            setNotification({ type: 'success', text: result.message });
            setItemToDelete(null);
            fetchServices();
        } catch (error: any) {
             setNotification({ type: 'error', text: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const formatPrice = (price: number) => price.toLocaleString('fa-IR') + ' تومان';

    const columns = useMemo(() => [
        columnHelper.accessor('name', { header: 'نام خدمت' }),
        columnHelper.accessor('description', { header: 'توضیحات', cell: info => info.getValue() || '-' }),
        columnHelper.accessor('price', { header: 'قیمت', cell: info => formatPrice(info.getValue()) }),
        ...(currentUser?.roleName === 'Admin' ? [columnHelper.display({
            id: 'actions',
            header: 'عملیات',
            cell: ({ row }) => (
                <div className="flex items-center justify-center gap-2">
                    <button onClick={() => openModal('edit', row.original)} className="text-blue-600 hover:text-blue-800 p-1.5" title="ویرایش"><i className="fas fa-edit"></i></button>
                    <button onClick={() => setItemToDelete(row.original)} className="text-red-600 hover:text-red-800 p-1.5" title="حذف"><i className="fas fa-trash"></i></button>
                </div>
            )
        })] : [])
    ], [currentUser]);

    const table = useReactTable({
        data: services,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    });

    return (
        <div className="space-y-6 text-right" dir="rtl">
            <Notification message={notification} onClose={() => setNotification(null)} />
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4 border-b dark:border-gray-700 pb-4">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">مدیریت خدمات</h2>
                    {currentUser?.roleName === 'Admin' && (
                        <button onClick={() => openModal('add')} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 whitespace-nowrap text-sm">
                            <i className="fas fa-plus ml-2"></i>افزودن خدمت جدید
                        </button>
                    )}
                </div>

                {isLoading ? (
                    <div className="text-center py-10"><i className="fas fa-spinner fa-spin text-3xl text-indigo-500"></i></div>
                ) : services.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">هیچ خدمتی تعریف نشده است.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                {table.getHeaderGroups().map(headerGroup => (
                                    <tr key={headerGroup.id}>
                                        {headerGroup.headers.map(header => (
                                            <th key={header.id} className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                            </th>
                                        ))}
                                    </tr>
                                ))}
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {table.getRowModel().rows.map(row => (
                                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        {row.getVisibleCells().map(cell => (
                                            <td key={cell.id} className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            
            {isModalOpen && (
                <Modal title={modalMode === 'add' ? 'افزودن خدمت جدید' : 'ویرایش خدمت'} onClose={closeModal}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">نام خدمت</label>
                            <input type="text" name="name" value={currentService.name || ''} onChange={handleInputChange} className={`w-full p-2 border rounded ${formErrors.name ? 'border-red-500' : 'border-gray-300'}`} />
                            {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">توضیحات (اختیاری)</label>
                            <textarea name="description" value={currentService.description || ''} onChange={handleInputChange} rows={3} className="w-full p-2 border rounded border-gray-300"></textarea>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">قیمت (تومان)</label>
                            <PriceInput name="price" value={String(currentService.price || '')} onChange={handleInputChange} className={`w-full p-2 border rounded text-left ${formErrors.price ? 'border-red-500' : 'border-gray-300'}`} />
                            {formErrors.price && <p className="text-xs text-red-500 mt-1">{formErrors.price}</p>}
                        </div>
                        <div className="flex justify-end gap-3 pt-3">
                            <button type="button" onClick={closeModal} className="px-4 py-2 bg-gray-200 rounded-md">انصراف</button>
                            <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-indigo-600 text-white rounded-md disabled:bg-indigo-400">
                                {isSubmitting ? 'در حال ذخیره...' : 'ذخیره'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {itemToDelete && (
                 <Modal title={`تایید حذف "${itemToDelete.name}"`} onClose={() => setItemToDelete(null)}>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">آیا از حذف این خدمت مطمئن هستید؟ این عمل قابل بازگشت نیست.</p>
                    <div className="flex justify-end pt-3 space-x-3 space-x-reverse">
                        <button onClick={() => setItemToDelete(null)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg">انصراف</button>
                        <button onClick={handleDelete} disabled={isSubmitting} className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:bg-red-400">
                            {isSubmitting ? 'در حال حذف...' : 'تایید و حذف'}
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default ServicesPage;