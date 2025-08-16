
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Product, NewProduct, Category, NotificationMessage, Partner } from '../types';
import Notification from '../components/Notification';
import Modal from '../components/Modal';
import { formatIsoToShamsi } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import PriceInput from '../components/PriceInput';
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

const columnHelper = createColumnHelper<Product>();

const Products: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { token, authReady } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [suppliers, setSuppliers] = useState<Partner[]>([]);
    const [allPartners, setAllPartners] = useState<Partner[]>([]);

    // Table State
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState<SortingState>([]);
    
    // UI State
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isManagementModalOpen, setIsManagementModalOpen] = useState(false);
    const [activeMgmtTab, setActiveMgmtTab] = useState<'categories' | 'suppliers'>('categories');
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');

    // Form & Modal State
    const initialNewProductState: NewProduct = { name: '', purchasePrice: 0, sellingPrice: 0, stock_quantity: 0, categoryId: '', supplierId: '' };
    const [newProduct, setNewProduct] = useState<NewProduct>(initialNewProductState);
    const [editingProduct, setEditingProduct] = useState<Partial<Product>>({});
    const [formErrors, setFormErrors] = useState<Partial<Record<keyof Product, string>>>({});

    // Category/Supplier Management State
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newSupplierName, setNewSupplierName] = useState('');
    const [categoryFormError, setCategoryFormError] = useState<string | null>(null);
    const [supplierFormError, setSupplierFormError] = useState<string | null>(null);
    const [editingItem, setEditingItem] = useState<{ id: number; name: string; type: 'category' | 'supplier' } | null>(null);
    const [editItemName, setEditItemName] = useState('');

    // Loading & Notification State
    const [isFetching, setIsFetching] = useState(true);
    const [notification, setNotification] = useState<NotificationMessage | null>(null);

    // Submission State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);
    const [isSubmittingSupplier, setIsSubmittingSupplier] = useState(false);
    const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
    
    // Delete Modal State
    const [deletingItem, setDeletingItem] = useState<{ id: number; name: string; type: 'category' | 'supplier' | 'product' } | null>(null);
    const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

    // Barcode State
    const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
    const [selectedProductForBarcode, setSelectedProductForBarcode] = useState<Product | null>(null);

    // --- Data Fetching ---
    const fetchData = async () => {
        setIsFetching(true);
        try {
            const [productsRes, categoriesRes, partnersRes] = await Promise.all([
                apiFetch('/api/products'),
                apiFetch('/api/categories'),
                apiFetch('/api/partners')
            ]);
            
            const productsResult = await productsRes.json();
            if (!productsRes.ok || !productsResult.success) throw new Error(productsResult.message || 'خطا در دریافت محصولات');
            setProducts(productsResult.data);

            const categoriesResult = await categoriesRes.json();
            if (!categoriesRes.ok || !categoriesResult.success) throw new Error(categoriesResult.message || 'خطا در دریافت دسته‌بندی‌ها');
            setCategories(categoriesResult.data);

            const partnersResult = await partnersRes.json();
            if (!partnersRes.ok || !partnersResult.success) throw new Error(partnersResult.message || 'خطا در دریافت همکاران');
            setAllPartners(partnersResult.data);
            setSuppliers(partnersResult.data.filter((p: Partner) => p.partnerType === 'Supplier'));

        } catch (error) {
            displayError(error, 'خطا در دریافت اطلاعات اولیه صفحه.');
        } finally {
            setIsFetching(false);
        }
    };
    
    useEffect(() => {
        if (!authReady) return;
        if (!token) {
            setIsFetching(false);
            setNotification({ type: 'info', text: 'برای مشاهده اطلاعات، لطفاً ابتدا وارد شوید.' });
            return;
        }
        fetchData();
    }, [authReady, token]);

    useEffect(() => {
        const searchFromUrl = searchParams.get('search') || '';
        if (searchFromUrl !== globalFilter) {
            setGlobalFilter(searchFromUrl);
        }
    }, [searchParams]);
    
    // --- Util & Formatting ---
    const handleSellProduct = (product: Product) => {
        if (product.stock_quantity <= 0) {
            setNotification({ type: 'warning', text: 'موجودی محصول برای فروش کافی نیست.' });
            return;
        }
        if (!product.sellingPrice || product.sellingPrice <= 0) {
            setNotification({ type: 'warning', text: 'این محصول قیمت فروش معتبر ندارد و قابل فروش نیست.' });
            return;
        }
        navigate(`/sales?type=inventory&id=${product.id}`);
    };
    
    const displayError = (error: any, defaultMessage: string) => {
        console.error(`Error:`, error);
        let displayMessage = defaultMessage;
        if (error.message) {
             if (error.message.toLowerCase().includes('failed to fetch')) displayMessage = 'خطا در ارتباط با سرور.';
             else displayMessage = error.message; 
        }
        setNotification({ type: 'error', text: displayMessage });
    };

    // ✅✅✅ تابع زیر برای جلوگیری از خطا در صورت null بودن قیمت، اصلاح شد ✅✅✅
    const formatPrice = (price: number | null) => {
        return (price ?? 0).toLocaleString('fa-IR') + ' تومان';
    };

    const openBarcodeModal = (product: Product) => {
        setSelectedProductForBarcode(product);
        setIsBarcodeModalOpen(true);
    };

    // --- Product Modal Logic ---
    const openProductModal = (mode: 'add' | 'edit', product: Product | null = null) => {
        setModalMode(mode);
        setFormErrors({});
        if (mode === 'edit' && product) {
            setEditingProduct({ ...product });
        } else {
            setNewProduct(initialNewProductState);
        }
        setIsProductModalOpen(true);
    };

    const closeProductModal = () => {
        setIsProductModalOpen(false);
        setNewProduct(initialNewProductState);
        setEditingProduct({});
        setFormErrors({});
    };

    const handleProductFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string, value: string } }) => {
        const { name, value } = e.target;
        const isNumeric = ['purchasePrice', 'sellingPrice', 'stock_quantity'].includes(name);
        
        const processedValue = isNumeric ? (value === '' ? '' : Number(value)) : value;
        
        if(modalMode === 'add') {
            setNewProduct(prev => ({ ...prev, [name]: processedValue }));
        } else {
            setEditingProduct(prev => ({ ...prev, [name]: processedValue }));
        }
        if (formErrors[name as keyof typeof formErrors]) setFormErrors(prev => ({ ...prev, [name]: undefined }));
    };
    
    const validateProductForm = (productData: NewProduct | Partial<Product>): boolean => {
        const errors: Partial<Record<keyof Product, string>> = {};
        if (!productData.name?.trim()) errors.name = 'نام محصول نمی‌تواند خالی باشد.';
        if (typeof productData.purchasePrice !== 'number' || productData.purchasePrice < 0) errors.purchasePrice = 'قیمت خرید باید عددی غیرمنفی باشد.';
        if (productData.purchasePrice > 0 && !productData.supplierId) errors.supplierId = 'برای ثبت قیمت خرید، انتخاب تامین‌کننده الزامی است.';
        if (typeof productData.sellingPrice !== 'number' || productData.sellingPrice <= 0) errors.sellingPrice = 'قیمت فروش باید عددی بزرگتر از صفر باشد.';
        if (typeof productData.stock_quantity !== 'number' || productData.stock_quantity < 0 || !Number.isInteger(productData.stock_quantity)) errors.stock_quantity = 'تعداد موجودی باید یک عدد صحیح و غیرمنفی باشد.';
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };
    
    const handleProductFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const productData = modalMode === 'add' ? newProduct : editingProduct;
        if (!validateProductForm(productData)) return;

        setIsSubmitting(true);
        setNotification(null);
        
        try {
            const url = modalMode === 'add' ? '/api/products' : `/api/products/${editingProduct.id}`;
            const method = modalMode === 'add' ? 'POST' : 'PUT';
            const payload = { 
                ...productData, 
                categoryId: productData.categoryId || null,
                supplierId: productData.supplierId || null
            };
            
            await apiFetch(url, { method, body: JSON.stringify(payload) });
            setNotification({ type: 'success', text: `محصول با موفقیت ${modalMode === 'add' ? 'اضافه' : 'ویرایش'} شد!` });
            closeProductModal();
            await fetchData();
        } catch (error) {
            displayError(error, `یک خطای ناشناخته در هنگام ${modalMode === 'add' ? 'افزودن' : 'ویرایش'} محصول رخ داد.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Table Definition ---
    const columns = useMemo(() => [
        columnHelper.accessor('name', { header: 'نام محصول' }),
        columnHelper.accessor('categoryName', { header: 'دسته‌بندی', cell: info => info.getValue() || '-' }),
        columnHelper.accessor('supplierName', { header: 'تامین‌کننده', cell: info => info.getValue() || '-' }),
        columnHelper.accessor('purchasePrice', { header: 'قیمت خرید', cell: info => formatPrice(info.getValue()) }),
        columnHelper.accessor('sellingPrice', { header: 'قیمت فروش', cell: info => formatPrice(info.getValue()) }),
        columnHelper.accessor('stock_quantity', {
            header: 'موجودی',
            cell: info => {
                const stock = info.getValue();
                const color = stock <= 5 ? 'text-red-500' : stock <= 20 ? 'text-yellow-500' : 'text-green-500';
                return <span className={`font-semibold ${color}`}>{stock.toLocaleString('fa-IR')}</span>;
            }
        }),
        columnHelper.accessor('date_added', { header: 'تاریخ ثبت', cell: info => formatIsoToShamsi(info.getValue()) }),
        columnHelper.display({
            id: 'actions',
            header: 'عملیات',
            cell: ({ row }) => (
                <div className="flex items-center justify-center gap-1">
                    <button
                        onClick={() => handleSellProduct(row.original)}
                        disabled={row.original.stock_quantity <= 0}
                        className="text-green-600 dark:text-green-400 hover:text-green-800 p-1.5 rounded-full hover:bg-green-100 dark:hover:bg-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="فروش محصول"
                    >
                        <i className="fas fa-cash-register"></i>
                    </button>
                    <button onClick={() => openBarcodeModal(row.original)} className="text-gray-600 dark:text-gray-400 hover:text-gray-800 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900/50" title="چاپ بارکد"><i className="fas fa-barcode"></i></button>
                    <button onClick={() => openProductModal('edit', row.original)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 p-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50" title="ویرایش محصول"><i className="fas fa-edit"></i></button>
                    <button onClick={() => setDeletingItem({ id: row.original.id, name: row.original.name, type: 'product' })} className="text-red-600 dark:text-red-400 hover:text-red-800 p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50" title="حذف محصول"><i className="fas fa-trash"></i></button>
                </div>
            )
        })
    ], [suppliers, categories]);

    const table = useReactTable({
        data: products,
        columns,
        state: { sorting, globalFilter },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    });

    // --- Other Handlers (Category, Supplier, Delete) ---
    const handleCategorySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategoryName.trim()) { setCategoryFormError('نام دسته‌بندی نمی‌تواند خالی باشد.'); return; }
        setIsSubmittingCategory(true);
        try {
            await apiFetch('/api/categories', { method: 'POST', body: JSON.stringify({ name: newCategoryName.trim() }) });
            setNotification({ type: 'success', text: 'دسته‌بندی با موفقیت اضافه شد!' });
            setNewCategoryName(''); setCategoryFormError(null);
            await fetchData();
        } catch (error) { displayError(error, 'خطا در ثبت دسته‌بندی.'); }
        finally { setIsSubmittingCategory(false); }
    };
    
    const handleSupplierSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSupplierName.trim()) { setSupplierFormError('نام تامین‌کننده نمی‌تواند خالی باشد.'); return; }
        setIsSubmittingSupplier(true);
        try {
            await apiFetch('/api/partners', { method: 'POST', body: JSON.stringify({ partnerName: newSupplierName.trim(), partnerType: 'Supplier' }) });
            setNotification({ type: 'success', text: 'تامین‌کننده با موفقیت اضافه شد!' });
            setNewSupplierName(''); setSupplierFormError(null);
            await fetchData();
        } catch (error) { displayError(error, 'خطا در ثبت تامین‌کننده.'); }
        finally { setIsSubmittingSupplier(false); }
    };

    const handleStartEdit = (item: {id: number, name: string}, type: 'category' | 'supplier') => {
        setEditingItem({ id: item.id, name: item.name, type });
        setEditItemName(item.name);
    };

    const handleCancelEdit = () => {
        setEditingItem(null);
        setEditItemName('');
    };

    const handleUpdateItem = async () => {
        if (!editingItem || !editItemName.trim()) {
            setNotification({ type: 'warning', text: 'نام آیتم نمی‌تواند خالی باشد.' });
            return;
        }
        setIsSubmittingEdit(true);
        setNotification(null);
        try {
            let url = '';
            let payload: any = {};
            
            if (editingItem.type === 'category') {
                url = `/api/categories/${editingItem.id}`;
                payload = { name: editItemName.trim() };
            } else { // 'supplier'
                url = `/api/partners/${editingItem.id}`;
                const partnerToUpdate = allPartners.find(p => p.id === editingItem.id);
                if (!partnerToUpdate) {
                    throw new Error("تامین‌کننده برای ویرایش یافت نشد.");
                }
                payload = {
                    partnerName: editItemName.trim(),
                    partnerType: partnerToUpdate.partnerType,
                    contactPerson: partnerToUpdate.contactPerson || '',
                    phoneNumber: partnerToUpdate.phoneNumber || '',
                    email: partnerToUpdate.email || '',
                    address: partnerToUpdate.address || '',
                    notes: partnerToUpdate.notes || '',
                }
            }
            
            await apiFetch(url, { method: 'PUT', body: JSON.stringify(payload) });
            
            setNotification({ type: 'success', text: `"${editingItem.name}" با موفقیت ویرایش شد.` });
            handleCancelEdit();
            await fetchData();
        } catch (error) {
            displayError(error, `خطا در ویرایش آیتم.`);
        } finally {
            setIsSubmittingEdit(false);
        }
    };
    
    const handleConfirmDelete = async () => {
        if (!deletingItem) return;
        setIsSubmittingDelete(true);
        try {
            const url = deletingItem.type === 'product' ? `/api/products/${deletingItem.id}` : deletingItem.type === 'category' ? `/api/categories/${deletingItem.id}` : `/api/partners/${deletingItem.id}`;
            await apiFetch(url, { method: 'DELETE' });
            setNotification({ type: 'success', text: `"${deletingItem.name}" با موفقیت حذف شد.` });
            setDeletingItem(null);
            await fetchData();
        } catch (error) { displayError(error, `خطا در حذف "${deletingItem.name}".`); }
        finally { setIsSubmittingDelete(false); }
    };

    return (
        <div className="space-y-6 text-right" dir="rtl">
            <Notification message={notification} onClose={() => setNotification(null)} />

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg">
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 gap-3">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">لیست محصولات انبار</h3>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative flex-grow">
                            <input type="text" placeholder="جستجو در محصولات..." value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)}
                                className="w-full pr-10 pl-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none bg-white dark:bg-gray-700" />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"><i className="fa-solid fa-search text-gray-400"></i></div>
                        </div>
                         <button onClick={() => setIsManagementModalOpen(true)} className="px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 whitespace-nowrap text-sm">
                            <i className="fas fa-cogs ml-2"></i>مدیریت دسته‌بندی/تامین‌کننده
                        </button>
                        <button onClick={() => openProductModal('add')} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 whitespace-nowrap text-sm">
                            <i className="fas fa-plus ml-2"></i>افزودن محصول
                        </button>
                    </div>
                </div>
                {isFetching ? (
                    <div className="p-10 text-center text-gray-500 dark:text-gray-400"><i className="fas fa-spinner fa-spin text-3xl mb-3"></i><p>در حال بارگذاری...</p></div>
                ) : !token ? (
                     <div className="p-10 text-center text-gray-500 dark:text-gray-400"><i className="fas fa-lock text-3xl mb-3"></i><p>برای مشاهده، ابتدا وارد شوید.</p></div>
                ) : table.getRowModel().rows.length === 0 ? (
                    <div className="p-10 text-center text-gray-500 dark:text-gray-400"><i className="fas fa-box-open text-3xl mb-3"></i><p>هیچ محصولی یافت نشد.</p></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                            <thead className="bg-gray-100 dark:bg-gray-700">
                                {table.getHeaderGroups().map(headerGroup => (<tr key={headerGroup.id}>
                                    {headerGroup.headers.map(header => (<th key={header.id} className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                                        <div {...{ className: header.column.getCanSort() ? 'cursor-pointer select-none flex items-center gap-2' : '', onClick: header.column.getToggleSortingHandler(),}}>
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                            {{ asc: ' ↑', desc: ' ↓'}[header.column.getIsSorted() as string] ?? null}
                                        </div>
                                    </th>))}</tr>))}
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {table.getRowModel().rows.map(row => (<tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    {row.getVisibleCells().map(cell => (<td key={cell.id} className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>))}</tr>))}
                            </tbody>
                        </table>
                    </div>
                )}
                 <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 text-sm">
                    <div className="flex items-center gap-2">
                        <button onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} className="p-1.5 rounded disabled:opacity-50 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">«</button>
                        <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="p-1.5 rounded disabled:opacity-50 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">‹</button>
                        <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="p-1.5 rounded disabled:opacity-50 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">›</button>
                        <button onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} className="p-1.5 rounded disabled:opacity-50 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">»</button>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400"><span>صفحه</span><strong>{table.getState().pagination.pageIndex + 1} از {table.getPageCount().toLocaleString('fa')}</strong></div>
                    <select value={table.getState().pagination.pageSize} onChange={e => table.setPageSize(Number(e.target.value))} className="p-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                        {[10, 20, 30, 40, 50].map(pageSize => (<option key={pageSize} value={pageSize}>نمایش {pageSize}</option>))}
                    </select>
                </div>
            </div>

            {isProductModalOpen && (
                <Modal title={modalMode === 'add' ? 'ثبت محصول جدید در انبار' : `ویرایش محصول: ${editingProduct.name}`} onClose={closeProductModal} widthClass="max-w-3xl">
                    <form onSubmit={handleProductFormSubmit} className="space-y-4 p-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نام محصول</label>
                                <input type="text" name="name" value={modalMode === 'add' ? newProduct.name : editingProduct.name || ''} onChange={handleProductFormChange} className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 ${formErrors.name ? 'border-red-500' : 'border-gray-300'}`} />
                                {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">تعداد موجودی</label>
                                <input type="number" name="stock_quantity" value={modalMode === 'add' ? newProduct.stock_quantity : editingProduct.stock_quantity || 0} onChange={handleProductFormChange} className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 ${formErrors.stock_quantity ? 'border-red-500' : 'border-gray-300'}`} />
                                {formErrors.stock_quantity && <p className="text-xs text-red-500 mt-1">{formErrors.stock_quantity}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">قیمت خرید (تومان)</label>
                                <PriceInput name="purchasePrice" value={modalMode === 'add' ? String(newProduct.purchasePrice) : String(editingProduct.purchasePrice || '')} onChange={handleProductFormChange} className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-left ${formErrors.purchasePrice ? 'border-red-500' : 'border-gray-300'}`} />
                                {formErrors.purchasePrice && <p className="text-xs text-red-500 mt-1">{formErrors.purchasePrice}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">قیمت فروش (تومان)</label>
                                <PriceInput name="sellingPrice" value={modalMode === 'add' ? String(newProduct.sellingPrice) : String(editingProduct.sellingPrice || '')} onChange={handleProductFormChange} className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-left ${formErrors.sellingPrice ? 'border-red-500' : 'border-gray-300'}`} />
                                {formErrors.sellingPrice && <p className="text-xs text-red-500 mt-1">{formErrors.sellingPrice}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">دسته‌بندی</label>
                                <select name="categoryId" value={modalMode === 'add' ? newProduct.categoryId || '' : editingProduct.categoryId || ''} onChange={handleProductFormChange} className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 ${formErrors.categoryId ? 'border-red-500' : 'border-gray-300'}`}>
                                    <option value="">-- بدون دسته‌بندی --</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                {formErrors.categoryId && <p className="text-xs text-red-500 mt-1">{formErrors.categoryId}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">تامین‌کننده</label>
                                <select name="supplierId" value={modalMode === 'add' ? newProduct.supplierId || '' : editingProduct.supplierId || ''} onChange={handleProductFormChange} className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 ${formErrors.supplierId ? 'border-red-500' : 'border-gray-300'}`}>
                                    <option value="">-- بدون تامین‌کننده --</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.partnerName}</option>)}
                                </select>
                                {formErrors.supplierId && <p className="text-xs text-red-500 mt-1">{formErrors.supplierId}</p>}
                            </div>
                        </div>
                        <div className="flex justify-end pt-4 mt-4 border-t dark:border-gray-700">
                            <button type="button" onClick={closeProductModal} className="ml-3 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 dark:bg-gray-600 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500">انصراف</button>
                            <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400">
                                {isSubmitting ? 'در حال ذخیره...' : (modalMode === 'add' ? 'افزودن محصول' : 'ذخیره تغییرات')}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
            
            {isManagementModalOpen && (
                <Modal title="مدیریت دسته‌بندی و تامین‌کنندگان" onClose={() => setIsManagementModalOpen(false)} widthClass="max-w-4xl">
                    <div className="flex border-b border-gray-200 dark:border-gray-700">
                        <button onClick={() => setActiveMgmtTab('categories')} className={`px-4 py-3 text-sm font-medium ${activeMgmtTab === 'categories' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                            دسته‌بندی‌ها
                        </button>
                        <button onClick={() => setActiveMgmtTab('suppliers')} className={`px-4 py-3 text-sm font-medium ${activeMgmtTab === 'suppliers' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                            تامین‌کنندگان
                        </button>
                    </div>
                    <div className="p-4">
                        {activeMgmtTab === 'categories' && (
                            <div className="space-y-4">
                                <form onSubmit={handleCategorySubmit} className="space-y-3 p-3 border dark:border-gray-600 rounded-lg">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">افزودن دسته‌بندی جدید</label>
                                    <div className="flex gap-2">
                                        <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" placeholder="نام دسته‌بندی" />
                                        <button type="submit" disabled={isSubmittingCategory} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-300 whitespace-nowrap">افزودن</button>
                                    </div>
                                    {categoryFormError && <p className="text-xs text-red-500">{categoryFormError}</p>}
                                </form>
                                <div className="border dark:border-gray-600 rounded-lg">
                                    <h4 className="text-sm font-semibold p-3 border-b dark:border-gray-600">دسته‌بندی‌های موجود</h4>
                                    <ul className="divide-y dark:divide-gray-600 max-h-60 overflow-y-auto">
                                        {categories.map(cat => (
                                            <li key={cat.id} className="p-2 flex items-center justify-between text-sm">
                                                {editingItem?.id === cat.id && editingItem?.type === 'category' ? (
                                                    <div className="flex-grow flex items-center gap-2">
                                                        <input type="text" value={editItemName} onChange={e => setEditItemName(e.target.value)} className="w-full p-1 border rounded-md dark:bg-gray-700 dark:border-gray-600" autoFocus />
                                                        <button onClick={handleUpdateItem} disabled={isSubmittingEdit} className="text-green-500 p-1"><i className="fas fa-check"></i></button>
                                                        <button onClick={handleCancelEdit} className="text-red-500 p-1"><i className="fas fa-times"></i></button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <span className="text-gray-700 dark:text-gray-300">{cat.name}</span>
                                                        <div className="flex items-center gap-2">
                                                            <button onClick={() => handleStartEdit(cat, 'category')} className="text-blue-500 hover:text-blue-700 p-1"><i className="fas fa-edit"></i></button>
                                                            <button onClick={() => setDeletingItem({id: cat.id, name: cat.name, type: 'category'})} className="text-red-500 hover:text-red-700 p-1"><i className="fas fa-trash"></i></button>
                                                        </div>
                                                    </>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                        {activeMgmtTab === 'suppliers' && (
                             <div className="space-y-4">
                                <form onSubmit={handleSupplierSubmit} className="space-y-3 p-3 border dark:border-gray-600 rounded-lg">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">افزودن تامین‌کننده جدید</label>
                                    <div className="flex gap-2">
                                        <input type="text" value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" placeholder="نام تامین‌کننده"/>
                                        <button type="submit" disabled={isSubmittingSupplier} className="px-4 py-2 bg-teal-500 text-white rounded-md hover:bg-teal-600 disabled:bg-teal-300 whitespace-nowrap">افزودن</button>
                                    </div>
                                    {supplierFormError && <p className="text-xs text-red-500">{supplierFormError}</p>}
                                </form>
                                <div className="border dark:border-gray-600 rounded-lg">
                                    <h4 className="text-sm font-semibold p-3 border-b dark:border-gray-600">تامین‌کنندگان موجود</h4>
                                    <ul className="divide-y dark:divide-gray-600 max-h-60 overflow-y-auto">
                                        {suppliers.map(sup => (
                                            <li key={sup.id} className="p-2 flex items-center justify-between text-sm">
                                                {editingItem?.id === sup.id && editingItem?.type === 'supplier' ? (
                                                    <div className="flex-grow flex items-center gap-2">
                                                        <input type="text" value={editItemName} onChange={e => setEditItemName(e.target.value)} className="w-full p-1 border rounded-md dark:bg-gray-700 dark:border-gray-600" autoFocus />
                                                        <button onClick={handleUpdateItem} disabled={isSubmittingEdit} className="text-green-500 p-1"><i className="fas fa-check"></i></button>
                                                        <button onClick={handleCancelEdit} className="text-red-500 p-1"><i className="fas fa-times"></i></button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <span className="text-gray-700 dark:text-gray-300">{sup.partnerName}</span>
                                                        <div className="flex items-center gap-2">
                                                            <button onClick={() => handleStartEdit({id: sup.id, name: sup.partnerName}, 'supplier')} className="text-blue-500 hover:text-blue-700 p-1"><i className="fas fa-edit"></i></button>
                                                            <button onClick={() => setDeletingItem({id: sup.id, name: sup.partnerName, type: 'supplier'})} className="text-red-500 hover:text-red-700 p-1"><i className="fas fa-trash"></i></button>
                                                        </div>
                                                    </>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {deletingItem && (
                <Modal title={`تایید حذف "${deletingItem.name}"`} onClose={() => setDeletingItem(null)}>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">آیا از حذف این آیتم مطمئن هستید؟ این عمل قابل بازگشت نیست.</p>
                    <div className="flex justify-end pt-3 space-x-3 space-x-reverse">
                        <button onClick={() => setDeletingItem(null)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200">انصراف</button>
                        <button onClick={handleConfirmDelete} disabled={isSubmittingDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400">
                            {isSubmittingDelete ? 'در حال حذف...' : 'تایید و حذف'}
                        </button>
                    </div>
                </Modal>
            )}

            {isBarcodeModalOpen && selectedProductForBarcode && (
                <Modal 
                  title={`بارکد برای: ${selectedProductForBarcode.name}`} 
                  onClose={() => setIsBarcodeModalOpen(false)}
                  widthClass="max-w-sm"
                  wrapperClassName="printable-area"
                >
                    <div id="barcode-label-content" className="text-center p-4">
                        <img 
                            src={`/api/barcode/product/${selectedProductForBarcode.id}`} 
                            alt={`Barcode for ${selectedProductForBarcode.name}`}
                            className="mx-auto"
                        />
                        <p className="mt-2 font-semibold text-lg">{selectedProductForBarcode.name}</p>
                        <p className="text-md text-gray-600">{formatPrice(selectedProductForBarcode.sellingPrice)}</p>
                    </div>
                    <div className="flex justify-end pt-4 mt-4 border-t dark:border-gray-700 print:hidden">
                        <button 
                            type="button" 
                            onClick={() => window.print()}
                            className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700"
                        >
                            <i className="fas fa-print ml-2"></i>چاپ برچسب
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default Products;
