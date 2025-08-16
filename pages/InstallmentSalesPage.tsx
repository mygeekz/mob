
import React, { useState, useEffect, ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { InstallmentSale, NotificationMessage, OverallInstallmentStatus } from '../types';
import Notification from '../components/Notification';
import { formatIsoToShamsi } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
import { getAuthHeaders } from '../utils/apiUtils'; // Import getAuthHeaders

const InstallmentSalesPage: React.FC = () => {
  const { token } = useAuth(); // Get token
  const [installmentSales, setInstallmentSales] = useState<InstallmentSale[]>([]);
  const [filteredSales, setFilteredSales] = useState<InstallmentSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationMessage | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const fetchInstallmentSales = async () => {
    if (!token) return;
    setIsLoading(true);
    setNotification(null);
    try {
      const response = await fetch('/api/installment-sales', { headers: getAuthHeaders(token) });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'خطا در دریافت لیست فروش‌های اقساطی');
      }
      setInstallmentSales(result.data);
      setFilteredSales(result.data);
    } catch (error: any) {
      setNotification({ type: 'error', text: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchInstallmentSales();
    }
  }, [token]);

  useEffect(() => {
    const lowerSearchTerm = searchTerm.toLowerCase().trim();
    if (!lowerSearchTerm) {
      setFilteredSales(installmentSales);
      return;
    }
    const filtered = installmentSales.filter(sale =>
      String(sale.id).includes(lowerSearchTerm) ||
      (sale.customerFullName && sale.customerFullName.toLowerCase().includes(lowerSearchTerm)) ||
      (sale.phoneModel && sale.phoneModel.toLowerCase().includes(lowerSearchTerm)) ||
      (sale.phoneImei && sale.phoneImei.includes(lowerSearchTerm))
    );
    setFilteredSales(filtered);
  }, [searchTerm, installmentSales]);

  const getStatusColor = (status: OverallInstallmentStatus): string => {
    switch (status) {
      case 'تکمیل شده': return 'bg-green-100 text-green-800';
      case 'معوق': return 'bg-yellow-100 text-yellow-800';
      case 'در حال پرداخت':
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };
  
  const formatPrice = (price: number | undefined | null) => {
    if (price === undefined || price === null) return '-';
    return price.toLocaleString('fa-IR') + ' تومان';
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <Notification message={notification} onClose={() => setNotification(null)} />

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
          <h2 className="text-xl font-semibold text-gray-800">فروش‌های اقساطی موبایل</h2>
          <div className="flex items-center gap-3 w-full sm:w-auto">
             <div className="relative w-full sm:w-64 md:w-72">
                <input
                type="text"
                placeholder="جستجو (مشتری، مدل، سریال فروش)..."
                value={searchTerm}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none text-right"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <i className="fa-solid fa-search text-gray-400"></i>
                </div>
            </div>
            <button
              onClick={() => navigate('/installment-sales/new')}
              className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors whitespace-nowrap text-sm"
            >
              <i className="fas fa-plus ml-2"></i>ثبت فروش اقساطی جدید
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-gray-500"><i className="fas fa-spinner fa-spin text-3xl mb-3"></i><p>در حال بارگذاری لیست فروش‌های اقساطی...</p></div>
        ) : installmentSales.length === 0 ? (
          <div className="p-10 text-center text-gray-500"><i className="fas fa-file-invoice-dollar text-3xl text-gray-400 mb-3"></i><p>هنوز هیچ فروش اقساطی ثبت نشده است.</p></div>
        ) : filteredSales.length === 0 && searchTerm ? (
           <div className="p-10 text-center text-gray-500"><i className="fas fa-search-minus text-3xl text-gray-400 mb-3"></i><p>موردی با مشخصات وارد شده یافت نشد.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">شناسه</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">مشتری</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">موبایل</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">مبلغ کل</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">قسط بعدی/وضعیت</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">وضعیت کلی</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">عملیات</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSales.map(sale => (
                  <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 whitespace-nowrap font-medium text-gray-900">{sale.id ? sale.id.toLocaleString('fa-IR') : '-'}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-800">{sale.customerFullName}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-700">{sale.phoneModel} ({sale.phoneImei})</td>
                    <td className="px-4 py-2 whitespace-nowrap text-indigo-700 font-semibold">{formatPrice(sale.totalInstallmentPrice)}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-600">
					{sale.overallStatus === 'تکمیل شده' ? 'تکمیل شده' : formatIsoToShamsi(sale.nextDueDate)}
					</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusColor(sale.overallStatus)}`}>
                            {sale.overallStatus}
                        </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap font-medium">
                      <Link 
                        to={`/installment-sales/${sale.id}`} 
                        className="text-indigo-600 hover:text-indigo-800 transition-colors"
                      >
                        مشاهده جزئیات
                      </Link>
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

export default InstallmentSalesPage;
