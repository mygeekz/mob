import React from 'react';

export interface NavItem {
  id: string;
  name:string; // This will be Persian
  icon: string;
  path: string; // Paths usually remain in English
}

export interface StatCardData {
  title: string; // Persian
  value: string; // Persian
  icon: string;
  iconBgColor: string;
  iconTextColor: string;
  trendPercentage?: number; // Made optional
  trendDirection?: 'up' | 'down'; // Made optional
  trendText: string; // Persian - Can be a static description or dynamic
}

export type TransactionStatus = 'تکمیل شده' | 'در حال پردازش' | 'در انتظار';

export interface Transaction {
  id: number;
  customer: string; // Persian - This might be deprecated or re-evaluated for dashboard
  product: string; // Persian
  amount: string; // Persian
  date: string;
  status: TransactionStatus; // Persian
}

export interface SalesDataPoint {
  name: string; // e.g., 'شنبه', 'هفته ۱', 'ژانویه' (Can be Persian)
  sales: number;
}

export interface ChartTimeframe {
  key: 'weekly' | 'monthly' | 'yearly'; // Keys remain English
  label: string; // Persian
}

export interface Category {
  id: number;
  name: string;
}

// Represents items from the 'products' table, used as "inventory"
export interface Product { 
  id: number;
  name: string; 
  purchasePrice: number;
  sellingPrice: number;      // This is the sale price for inventory items
  stock_quantity: number;
  saleCount?: number;         // Tracks number of times this product type was sold
  categoryId?: number | null;
  categoryName?: string | null; 
  date_added: string;
  supplierId?: number | null; 
  supplierName?: string | null; 
}

export interface NewProduct {
  name: string;
  purchasePrice: number;
  sellingPrice: number;
  stock_quantity: number;
  categoryId?: number | string | null;
  supplierId?: number | string | null; 
}

export interface NotificationMessage {
  type: 'success' | 'error' | 'warning' | 'info';
  text: string;
}

// --- Old Mobile Phone Specific Types (related to products table & mobile_phone_details) ---
export interface MobilePhoneDetails {
  mobileDetailId: number; 
  brand: string;
  model: string;
  color?: string | null;
  storage?: number | null; 
  ram?: number | null;    
  imei: string;
}

export interface MobilePhone extends Product, MobilePhoneDetails {
  productName: string; 
}

export interface NewMobilePhoneData { // Used for frontend form for old structure, if any
  purchasePrice: number;
  sellingPrice: number;
  brand: string;
  model: string;
  color?: string;
  storage?: number | string; 
  ram?: number | string;     
  imei: string;
}

// --- New Standalone Phone Entry Types for the 'phones' table ---
export type PhoneStatus = "موجود در انبار" | "فروخته شده" | "مرجوعی" | "فروخته شده (قسطی)";

export interface PhoneEntry { // For frontend display from GET /api/phones
  id: number;
  model: string;
  color?: string | null;
  storage?: string | null; 
  ram?: string | null;     
  imei: string;
  batteryHealth?: number | null;
  condition?: string | null; 
  purchasePrice: number;
  salePrice?: number | null;    // This is the sale price for individual phones
  sellerName?: string | null; 
  buyerName?: string | null; 
  purchaseDate?: string | null; // ISO Date string YYYY-MM-DD from DB
  saleDate?: string | null;     // ISO Date string YYYY-MM-DD from DB
  registerDate: string;  // ISO DateTime string from DB
  status: PhoneStatus;
  notes?: string | null;
  supplierId?: number | null; 
  supplierName?: string | null; 
}

export interface NewPhoneEntryData { // For frontend form for new 'phones' table
  model: string;
  color?: string;
  storage?: string;
  ram?: string;
  imei: string;
  batteryHealth?: number | string; 
  condition?: string;
  purchasePrice: number | string; 
  salePrice?: number | string;   
  sellerName?: string; 
  buyerName?: string; 
  purchaseDate?: string; // Shamsi date string from DatePicker initially
  // saleDate is removed as per user request
  status?: PhoneStatus; 
  notes?: string;
  supplierId?: number | string | null; 
}

// Payload for POSTing a new phone to backend
export interface PhoneEntryPayload {
  model: string;
  color?: string | null;
  storage?: string | null;
  ram?: string | null;
  imei: string;
  batteryHealth?: number | null;
  condition?: string | null;
  purchasePrice: number;
  salePrice?: number | null;
  sellerName?: string | null;
  purchaseDate?: string | null; // Expected as ISO Date string (YYYY-MM-DD) by backend
  saleDate?: string | null;     // Expected as ISO Date string (YYYY-MM-DD) by backend, now always null/undefined from form
  registerDate?: string; // ISO DateTime string (usually set by backend)
  status?: PhoneStatus | string; // Allow string for flexibility from form
  notes?: string | null;
  supplierId?: number | null;
}

// Payload for PUTting an existing phone to backend (all fields optional for partial updates)
export interface PhoneEntryUpdatePayload {
  model?: string;
  color?: string | null;
  storage?: string | null;
  ram?: string | null;
  imei?: string;
  batteryHealth?: number | string | null; // Allow string for form input, then parse
  condition?: string | null;
  purchasePrice?: number | string | null; // Allow string for form input, then parse
  salePrice?: number | string | null;     // Allow string for form input, then parse
  sellerName?: string | null;
  purchaseDate?: string | null; // Shamsi from DatePicker or ISO if not changed from existing
  status?: PhoneStatus | string;
  notes?: string | null;
  supplierId?: number | string | null; // Allow string for form input, then parse
}


// --- Types for Sales Section ---
export interface SellablePhoneItem {
  id: number;           // Phone ID from 'phones' table
  type: 'phone';
  name: string;         // e.g., "iPhone 13 Pro (IMEI: 123...)"
  price: number;        // salePrice from 'phones' table
  stock: 1;             // Always 1 for individual phones
  imei: string;         // To display and potentially use
}

export interface SellableInventoryItem { // "inventory" refers to items from the "products" table
  id: number;           // Product ID from 'products' table
  type: 'inventory';
  name: string;         // name from 'products' table
  price: number;        // sellingPrice from 'products' table
  stock: number;        // stock_quantity from 'products' table
}

// A service can also be sold.
export interface SellableServiceItem {
  id: number;
  type: 'service';
  name: string;
  price: number;
  stock: Infinity;
}

export type SellableItem = SellablePhoneItem | SellableInventoryItem | SellableServiceItem;

export interface SellableItemsResponse {
  phones: SellablePhoneItem[];
  inventory: SellableInventoryItem[];
  services: Service[];
}

export interface SalesTransactionEntry {
  id: number;
  transactionDate: string; // ISO date string YYYY-MM-DD as stored/returned by DB
  itemType: 'phone' | 'inventory' | 'service'; // Added 'service'
  itemId: number;
  itemName: string;        // Name of the item at the time of sale
  quantity: number;
  pricePerItem: number;
  discount?: number;       // Discount amount applied
  totalPrice: number;      // Final price after discount
  notes?: string | null;
  customerId?: number | null; 
  customerFullName?: string | null; 
  paymentMethod?: 'cash' | 'credit'; // Added
}

export interface NewSaleData { // For frontend form
  itemType: 'phone' | 'inventory' | 'service'; // Added 'service'
  itemId: number;
  quantity: number;
  transactionDate: string; // Shamsi date string YYYY/MM/DD from form
  notes?: string;
  discount?: number | string; // Allow string for input
  customerId?: number | string | null; // Allow string for form
  paymentMethod: 'cash' | 'credit'; // Added
}

// --- Types for the new Sales Cart ---
export interface CartItem {
    cartItemId: string; // A client-side-only ID for React keys
    itemId: number;
    itemType: 'phone' | 'inventory' | 'service';
    name: string; // For display in the cart
    description: string; // For the invoice
    quantity: number;
    unitPrice: number;
    discountPerItem: number;
    stock: number; // To check against when updating quantity
}

// The complete payload sent from frontend to create a new sales order
export interface SalesOrderPayload {
    customerId: number | null;
    paymentMethod: 'cash' | 'credit' | 'installment';
    discount: number; // Global discount amount
    tax: number; // Global tax percentage (e.g., 9 for 9%)
    notes?: string;
    items: Omit<CartItem, 'cartItemId' | 'name' | 'stock'>[]; // Backend only needs the core data for invoice_items
}


// --- Types for Customer Management ---
export interface Customer {
  id: number;
  fullName: string;
  phoneNumber: string | null;
  address: string | null;
  notes: string | null;
  dateAdded: string; // ISO date string
  currentBalance?: number; 
}

export interface NewCustomerData { // For frontend form
  fullName: string;
  phoneNumber?: string;
  address?: string;
  notes?: string;
}

export interface CustomerLedgerEntry {
  id: number;
  customerId: number;
  transactionDate: string; // ISO date string from DB
  description: string;
  debit: number;  
  credit: number; 
  balance: number; 
}

export interface NewLedgerEntryData { // Used for both customer and partner manual ledger entries (frontend form)
  description: string;
  debit?: number | string;  // Allow string for input
  credit?: number | string; // Allow string for input
  transactionDate?: string; // Shamsi from DatePicker, converted to ISO before backend for ledgers.
}

export interface CustomerDetailsPageData {
  profile: Customer;
  ledger: CustomerLedgerEntry[];
  purchaseHistory: SalesTransactionEntry[];
}

// --- Types for Partner (Supplier) Management ---
export type PartnerType = "Supplier" | "Service Provider" | "Technician" | "Other"; // Added Technician

export interface Partner {
  id: number;
  partnerName: string;
  partnerType: PartnerType | string; // Allow string for flexibility, but define common types
  contactPerson?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  dateAdded: string; // ISO date string
  currentBalance?: number; // Calculated: positive means we owe them.
}

export interface NewPartnerData { // For frontend form
  partnerName: string;
  partnerType: PartnerType | string;
  contactPerson?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface PartnerLedgerEntry {
  id: number;
  partnerId: number;
  transactionDate: string; // ISO date string from DB
  description: string;
  debit: number;  // We paid the partner (reduces what we owe)
  credit: number; // We received goods/services from partner (increases what we owe)
  balance: number; // Running balance: positive means we owe partner.
}

// Interface for items purchased from a partner, for display in partner detail
export interface PurchasedItemFromPartner {
  id: number; // product.id or phone.id
  type: 'product' | 'phone'; // Distinguish between general products and phones
  name: string; // product.name or phone.model
  identifier?: string; // e.g., phone.imei
  quantityPurchased?: number; // For products (batch stock_quantity at time of purchase)
  purchasePrice: number;
  purchaseDate: string; // date_added for products, purchaseDate for phones if available, or transactionDate from ledger
}

export interface PartnerDetailsPageData {
  profile: Partner;
  ledger: PartnerLedgerEntry[];
  purchaseHistory: PurchasedItemFromPartner[]; // List of products/phones bought from this partner
}


// --- Types for Reporting Section ---
export interface ReportCardItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  path: string;
}

export interface DailySalesPoint {
  date: string; // ISO date YYYY-MM-DD (from backend after change)
  totalSales: number;
}

export interface TopSellingItem {
  id: number; // itemId
  itemType: 'phone' | 'inventory';
  itemName: string;
  totalRevenue: number;
  quantitySold: number;
}

export interface SalesSummaryData {
  totalRevenue: number;
  grossProfit: number;
  totalTransactions: number;
  averageSaleValue: number;
  dailySales: DailySalesPoint[];
  topSellingItems: TopSellingItem[];
}

export interface DebtorReportItem {
  id: number; // customerId
  fullName: string;
  phoneNumber: string | null;
  balance: number; // Positive value, amount customer owes
}

export interface CreditorReportItem {
  id: number; // partnerId
  partnerName: string;
  partnerType: string;
  balance: number; // Positive value, amount we owe partner
}

export interface TopCustomerReportItem {
  customerId: number;
  fullName: string;
  totalSpent: number;
  transactionCount: number;
}

export interface TopSupplierReportItem {
  partnerId: number;
  partnerName: string;
  totalPurchaseValue: number; // Total value of goods/services received from them
  transactionCount: number;
}

export interface PhoneSaleProfitReportItem {
  transactionId: number;
  transactionDate: string;
  customerFullName: string | null;
  phoneModel: string;
  imei: string;
  purchasePrice: number;
  totalPrice: number; // Final sale price from sales_transactions
  profit: number;
}

export interface PhoneInstallmentSaleProfitReportItem {
  saleId: number;
  dateCreated: string;
  customerFullName: string;
  phoneModel: string;
  imei: string;
  purchasePrice: number;
  actualSalePrice: number; // Final sale price from installment_sales
  totalProfit: number;
}

// --- Types for Invoice Generation ---
export interface BusinessDetails {
  name: string;
  addressLine1: string;
  addressLine2?: string;
  cityStateZip: string;
  phone?: string;
  email?: string;
  logoUrl?: string; 
}

export interface InvoiceLineItem {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPerItem: number; // New
  totalPrice: number; // This is (qty * unitPrice) - discountPerItem
}

export interface InvoiceFinancialSummary {
  subtotal: number; // Sum of (quantity * unitPrice) for all items
  itemsDiscount: number; // Sum of all discountPerItem
  globalDiscount: number; // The overall discount on the order
  taxableAmount: number; // subtotal - itemsDiscount - globalDiscount
  taxAmount: number; // (taxableAmount * tax%) / 100
  taxPercentage: number; // The tax rate that was applied
  grandTotal: number; // taxableAmount + taxAmount
}

export interface InvoiceData {
  businessDetails: BusinessDetails; // Now dynamic
  customerDetails: Partial<Customer> | null; 
  invoiceMetadata: {
    invoiceNumber: string; 
    transactionDate: string; // Shamsi date YYYY/MM/DD (formatted for display from ISO)
    dueDate?: string; 
  };
  lineItems: InvoiceLineItem[]; 
  financialSummary: InvoiceFinancialSummary;
  notes?: string | null; 
}

// --- Types for Settings ---
export interface SettingItem {
  key: string;
  value: string;
}

export interface BusinessInformationSettings {
  store_name?: string;
  store_address_line1?: string;
  store_address_line2?: string;
  store_city_state_zip?: string;
  store_phone?: string;
  store_email?: string;
  store_logo_path?: string;
  meli_payamak_username?: string;
  meli_payamak_password?: string;
  // Refactored SMS Pattern IDs
  meli_payamak_installment_reminder_pattern_id?: string;
  meli_payamak_payment_confirmation_pattern_id?: string;
  meli_payamak_overdue_notice_pattern_id?: string;
  meli_payamak_completion_congrats_pattern_id?: string;
  // New Repair Module SMS Pattern IDs
  meli_payamak_repair_received_pattern_id?: string;
  meli_payamak_repair_cost_estimated_pattern_id?: string;
  meli_payamak_repair_ready_pattern_id?: string;
}

export interface Role {
  id: number;
  name: string;
}

export interface UserForDisplay {
  id: number;
  username: string;
  roleId: number;
  roleName: string;
  dateAdded: string;
  avatarUrl?: string | null;
}

export interface NewUserFormData {
  username: string;
  password?: string; 
  confirmPassword?: string;
  roleId: number | string; 
}

export interface EditUserFormData {
  id: number;
  username: string;
  roleId: number | string;
}


// --- Backend specific Payloads ---
export interface ProductPayload { // For POST/PUT /api/products
  name: string;
  purchasePrice: number;
  sellingPrice: number;
  stock_quantity: number;
  categoryId: number | null;
  supplierId: number | null;
}

export interface UpdateProductPayload { // For PUT /api/products/:id
  name?: string;
  purchasePrice?: number;
  sellingPrice?: number;
  stock_quantity?: number;
  categoryId?: number | null;
  supplierId?: number | null;
}


export interface SaleDataPayload { // For POST /api/sales
  itemType: 'phone' | 'inventory' | 'service'; // Added 'service'
  itemId: number;
  quantity: number;
  transactionDate: string; // Shamsi date YYYY/MM/DD from frontend, will be converted to ISO by backend
  customerId?: number | null;
  notes?: string | null;
  discount?: number;
  paymentMethod: 'cash' | 'credit'; // Added
}

export interface CustomerPayload { // For POST/PUT /api/customers
  fullName: string;
  phoneNumber?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface LedgerEntryPayload { // For POST /api/customers/:id/ledger and /api/partners/:id/ledger
    description: string;
    debit?: number;
    credit?: number;
    transactionDate: string; // ISO DateTime string
}
export interface PartnerPayload { // For POST/PUT /api/partners
  partnerName: string;
  partnerType: string;
  contactPerson?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface OldMobilePhonePayload { // For old endpoint, if used
    purchasePrice: number;
    sellingPrice: number;
    brand: string;
    model: string;
    color?: string;
    storage?: number;
    ram?: number;
    imei: string;
}

// --- Types for Installment Sales ---
export type CheckStatus = "در جریان وصول" | "وصول شده" | "برگشت خورده" | "نزد مشتری" | "باطل شده";
export type InstallmentPaymentStatus = "پرداخت نشده" | "پرداخت شده" | "دیرکرد";
export type OverallInstallmentStatus = "در حال پرداخت" | "تکمیل شده" | "معوق";

export interface InstallmentCheckInfo {
  id?: number; // Optional for new checks before saving
  checkNumber: string;
  bankName: string;
  dueDate: string; // Shamsi Date YYYY/MM/DD from DatePicker, stored as Shamsi
  amount: number;
  status: CheckStatus;
}

export interface InstallmentPaymentRecord {
  id?: number; // Optional
  installmentNumber: number;
  dueDate: string; // Shamsi Date YYYY/MM/DD
  amountDue: number;
  paymentDate?: string | null; // Shamsi Date YYYY/MM/DD
  status: InstallmentPaymentStatus;
}

export interface InstallmentSale {
  id: number;
  customerId: number;
  customerFullName?: string; // For display in list
  phoneId: number;
  phoneModel?: string; // For display
  phoneImei?: string;  // For display
  actualSalePrice: number;
  downPayment: number;
  numberOfInstallments: number;
  installmentAmount: number;
  installmentsStartDate: string; // Shamsi Date YYYY/MM/DD
  totalInstallmentPrice?: number; // Calculated: (numberOfInstallments * installmentAmount) + downPayment
  remainingAmount?: number;
  checks: InstallmentCheckInfo[];
  payments: InstallmentPaymentRecord[];
  overallStatus: OverallInstallmentStatus;
  nextDueDate?: string | null; // Shamsi Date YYYY/MM/DD or null if completed
  notes?: string | null;
  dateCreated: string; // ISO Date
}

export interface NewInstallmentSaleData { // For frontend form
  customerId: number | string | null;
  phoneId: number | string | null;
  actualSalePrice: number | string;
  downPayment: number | string;
  numberOfInstallments: number | string;
  installmentAmount: number | string;
  installmentsStartDate: string; // Shamsi date string from form
  checks: Omit<InstallmentCheckInfo, 'id' | 'status'>[]; // Checks start without ID and default status
  notes?: string;
}

// Payload for POSTing a new installment sale
export interface InstallmentSalePayload extends Omit<NewInstallmentSaleData, 'customerId' | 'phoneId' | 'actualSalePrice' | 'downPayment' | 'numberOfInstallments' | 'installmentAmount' | 'checks'> {
  customerId: number;
  phoneId: number;
  actualSalePrice: number;
  downPayment: number;
  numberOfInstallments: number;
  installmentAmount: number;
  checks: InstallmentCheckInfo[]; // Submitted checks will have status 'در جریان وصول' or 'نزد مشتری' initially
}

export interface InstallmentSaleDetailData extends InstallmentSale {
  // any additional fields for detail view if needed
}

// --- Types for Dashboard ---
export interface DashboardKPIs {
  totalSalesMonth: number;
  revenueToday: number;
  activeProductsCount: number;
  totalCustomersCount: number;
  totalSalesAllTime?: number;
}

export interface ActivityItem {
  id: string; // Unique ID, e.g., "sale-123", "product-45"
  typeDescription: string; // e.g., "فروش جدید", "محصول جدید"
  details: string; // e.g., "آیفون ۱۴ به علی رضایی", "کابل شارژ USB-C اضافه شد"
  timestamp: string; // ISO date string
  icon: string; // FontAwesome icon class
  color?: string; // Tailwind background color class, e.g., "bg-green-500"
  link?: string; // Optional path for navigation
}

export interface DashboardAPIData {
  kpis: DashboardKPIs;
  salesChartData: SalesDataPoint[];
  recentActivities: ActivityItem[];
}

// --- Authentication Types ---
export interface AuthUser {
  id: number;
  username: string;
  roleName: string;
  dateAdded?: string; // Only for profile page display
  avatarUrl?: string | null; // For user avatar
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: AuthUser;
  message?: string;
}

export interface LoginFormData {
  username: string;
  password?: string; // Password might be handled separately from form for security, but included for type
}

export interface ChangePasswordPayload {
    oldPassword: string;
    newPassword: string;
}

// --- Smart Analysis Types ---
export interface ProfitabilityAnalysisItem {
  itemId: number;
  itemType: 'phone' | 'inventory';
  itemName: string;
  totalQuantitySold: number;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  profitMargin: number;
}

export type ItemClassification = 'پرفروش (داغ)' | 'عادی' | 'کم‌فروش (راکد)';

export interface VelocityItem {
  itemId: number;
  itemType: 'phone' | 'inventory';
  itemName: string;
  salesPerDay: number;
  classification: ItemClassification;
}

export interface InventoryVelocityAnalysis {
  hotItems: VelocityItem[];
  staleItems: VelocityItem[];
  normalItems: VelocityItem[];
}

export interface PurchaseSuggestionItem {
  itemId: number;
  itemType: 'phone' | 'inventory';
  itemName: string;
  currentStock: number;
  salesPerDay: number;
  daysOfStockLeft: number;
  suggestedPurchaseQuantity: number;
}


// --- Repair Center Types ---
export type RepairStatus = "پذیرش شده" | "در حال بررسی" | "منتظر قطعه" | "در حال تعمیر" | "آماده تحویل" | "تحویل داده شده" | "تعمیر نشد" | "مرجوع شد";export interface RepairPart {
    id: number;
    repairId: number;
    productId: number;
    productName: string;
    quantityUsed: number;
    pricePerItem?: number; // Fetched for display
}

export interface Repair {
    id: number;
    customerId: number;
    customerFullName?: string;
    deviceModel: string;
    deviceColor?: string | null;
    serialNumber?: string | null;
    problemDescription: string;
    technicianNotes?: string | null;
    status: RepairStatus;
    estimatedCost?: number | null;
    finalCost?: number | null;
    dateReceived: string; // ISO DateTime
    dateCompleted?: string | null; // ISO DateTime
    technicianId?: number | null;
    technicianName?: string | null;
    laborFee?: number | null;
}

export interface NewRepairData { // For frontend form
    customerId: number | string | null;
    deviceModel: string;
    deviceColor?: string;
    serialNumber?: string;
    problemDescription: string;
    estimatedCost?: number | string;
}

export interface RepairDetailsPageData {
    repair: Repair;
    parts: RepairPart[];
}

export interface FinalizeRepairPayload {
    finalCost: number;
    laborFee: number;
    technicianId: number;
}

// --- Types for Action Center ---
export interface ActionItem {
  id: string; // e.g., 'stock-alert-12' or 'overdue-payment-5'
  type: 'StockAlert' | 'StagnantStock' | 'OverdueInstallment' | 'RepairReady';
  priority: 'High' | 'Medium' | 'Low';
  title: string;
  description: string;
  actionText: string;
  actionLink: string;
  timestamp?: string; // Optional timestamp for sorting within priorities
}

export type ActionCenterData = ActionItem[];

// --- Services Module Types ---
export interface Service {
  id: number;
  name: string;
  description: string | null;
  price: number;
}

export interface NewServiceData {
  name: string;
  description?: string;
  price: number | string;
}
