import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MainLayout from './components/MainLayout'; // Import MainLayout
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import RepairReceipt from './pages/RepairReceipt'; // NEW
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import MobilePhones from './pages/MobilePhones';
import InstallmentSalesPage from './pages/InstallmentSalesPage';
import AddInstallmentSalePage from './pages/AddInstallmentSalePage';
import InstallmentSaleDetailPage from './pages/InstallmentSaleDetailPage';
import Customers from './pages/Customers';
import CustomerDetailPage from './pages/CustomerDetail'; 
import Partners from './pages/Partners';
import PartnerDetail from './pages/PartnerDetail';
import Reports from './pages/Reports';
import SalesReport from './pages/reports/SalesReport';
import DebtorsReport from './pages/reports/DebtorsReport';
import CreditorsReport from './pages/reports/CreditorsReport';
import TopCustomersReport from './pages/reports/TopCustomersReport';
import TopSuppliersReport from './pages/reports/TopSuppliersReport';
import AnalysisHub from './pages/reports/AnalysisHub';
import ProfitabilityReport from './pages/reports/ProfitabilityReport';
import InventoryAnalysisReport from './pages/reports/InventoryAnalysisReport';
import PurchaseSuggestionReport from './pages/reports/PurchaseSuggestionReport';
import PhoneSalesReport from './pages/reports/PhoneSalesReport'; // Added
import PhoneInstallmentSalesReport from './pages/reports/PhoneInstallmentSalesReport'; // Added
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
import SalesCartPage from './pages/SalesCartPage';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import LoginPage from './pages/Login'; // Import Login Page
import ProfilePage from './pages/ProfilePage'; // Corrected from Profile to ProfilePage
import Repairs from './pages/Repairs'; // Added
import AddRepair from './pages/AddRepair'; // Added
import RepairDetail from './pages/RepairDetail'; // Added
import Services from './pages/Services'; // Added
import CompareSales from './pages/reports/CompareSales';
import PriceInquiry from './pages/PriceInquiry';

const App: React.FC = () => {
  return (
      <Routes>
        {/* Public routes (like login) */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Protected routes (main application) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}> {/* MainLayout wraps protected pages */}
            <Route path="/" element={<Dashboard />} />
            <Route path="/profile" element={<ProfilePage />} /> {/* Corrected ProfilePage Route */}
            <Route path="/products" element={<Products />} />
            <Route path="/mobile-phones" element={<MobilePhones />} />
            <Route path="/sales" element={<SalesCartPage />} />
            <Route path="/cart-sale" element={<SalesCartPage />} />
            <Route path="/installment-sales" element={<InstallmentSalesPage />} />
            <Route path="/installment-sales/new" element={<AddInstallmentSalePage />} />
            <Route path="/installment-sales/:id" element={<InstallmentSaleDetailPage />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/partners/:id" element={<PartnerDetail />} />
            <Route path="/repairs" element={<Repairs />} />
            <Route path="/repairs/new" element={<AddRepair />} />
            <Route path="/repairs/:id" element={<RepairDetail />} />
            <Route path="/services" element={<Services />} />
			<Route path="/repairs/:id/receipt" element={<RepairReceipt />} />

            {/* Reports Section */}
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/sales-summary" element={<SalesReport />} />
            <Route path="/reports/debtors" element={<DebtorsReport />} />
            <Route path="/reports/creditors" element={<CreditorsReport />} />
            <Route path="/reports/top-customers" element={<TopCustomersReport />} />
            <Route path="/reports/top-suppliers" element={<TopSuppliersReport />} />
            <Route path="/reports/analysis" element={<AnalysisHub />} />
            <Route path="/reports/analysis/profitability" element={<ProfitabilityReport />} />
            <Route path="/reports/analysis/inventory" element={<InventoryAnalysisReport />} />
            <Route path="/reports/analysis/suggestions" element={<PurchaseSuggestionReport />} />
            <Route path="/reports/phone-sales" element={<PhoneSalesReport />} />
            <Route path="/reports/phone-installment-sales" element={<PhoneInstallmentSalesReport />} />
			<Route path="/reports/periodic-comparison" element={<CompareSales />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/:orderId" element={<InvoiceDetail />} />
            <Route path="/price-inquiry" element={<PriceInquiry />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>
        
        {/* Fallback for any unmatched routes (can be inside or outside protected layout depending on desired behavior) */}
         <Route path="*" element={<MainLayout />}> {/* Or a simpler layout for NotFound */}
            <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
  );
};

export default App;