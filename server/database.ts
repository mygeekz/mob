
import sqlite3 from 'sqlite3';
import path, { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import moment from 'jalali-moment';
import bcryptjs from 'bcryptjs';

import type { 
    ActivityItem as FrontendActivityItem, 
    InstallmentSale as FrontendInstallmentSale,
    DashboardKPIs as FrontendDashboardKPIs,
    SalesDataPoint as FrontendSalesDataPoint, // Keep this if used by getDashboardSalesChartData for its specific output
    DailySalesPoint, // Add this for clarity if not already here
    TopSellingItem, // Add this for clarity
    SalesSummaryData as FrontendSalesSummaryData,
    DebtorReportItem as FrontendDebtorReportItem,
    CreditorReportItem as FrontendCreditorReportItem,
    TopCustomerReportItem as FrontendTopCustomerReportItem,
    TopSupplierReportItem as FrontendTopSupplierReportItem,
    PhoneSaleProfitReportItem, // Added
    PhoneInstallmentSaleProfitReportItem, // Added
    InvoiceData as FrontendInvoiceData,
    Role as FrontendRole,
    UserForDisplay as FrontendUserForDisplay,
    ChangePasswordPayload,
    ProfitabilityAnalysisItem,
    VelocityItem,
    PurchaseSuggestionItem,
    NewRepairData, // Added
    RepairPart, // Added
    Repair as FrontendRepair, // Added
    FinalizeRepairPayload,
    Service, // Added
} from '../../types';

export type { ChangePasswordPayload, NewRepairData, FinalizeRepairPayload, Service };


// Shared types (could be imported from a shared types file if frontend and backend share one)
export interface ProductPayload {
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
export interface PhoneEntryPayload { // Used for POST
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
  purchaseDate?: string | null; // ISO Date string YYYY-MM-DD
  saleDate?: string | null;     // ISO Date string YYYY-MM-DD
  registerDate?: string; // ISO DateTime string
  status?: string; // e.g., "موجود در انبار", "فروخته شده"
  notes?: string | null;
  supplierId?: number | null;
}

export interface PhoneEntryUpdatePayload { // Used for PUT
  model?: string;
  color?: string | null;
  storage?: string | null;
  ram?: string | null;
  imei?: string;
  batteryHealth?: number | string | null;
  condition?: string | null;
  purchasePrice?: number | string | null;
  salePrice?: number | string | null;
  sellerName?: string | null;
  purchaseDate?: string | null; // Can be Shamsi from datepicker, needs conversion if changed
  status?: string;
  notes?: string | null;
  supplierId?: number | string | null;
}


export interface SaleDataPayload {
  itemType: 'phone' | 'inventory' | 'service';
  itemId: number;
  quantity: number;
  transactionDate: string; // Shamsi date YYYY/MM/DD from frontend
  customerId?: number | null;
  notes?: string | null;
  discount?: number;
  paymentMethod: 'cash' | 'credit'; // Added
}
export interface CustomerPayload {
  fullName: string;
  phoneNumber?: string | null;
  address?: string | null;
  notes?: string | null;
}
export interface LedgerEntryPayload {
    description: string;
    debit?: number;
    credit?: number;
    transactionDate: string; // ISO DateTime string
}
export interface PartnerPayload {
  partnerName: string;
  partnerType: string;
  contactPerson?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}
export interface SettingItem {
    key: string;
    value: string;
}
export interface OldMobilePhonePayload { // For the deprecated mobile phone structure
    purchasePrice: number;
    sellingPrice: number;
    brand: string;
    model: string;
    color?: string;
    storage?: number;
    ram?: number;
    imei: string;
}

// Types for Installment Sales - Ensure these are exported if used by server/index.ts
export type CheckStatus = "در جریان وصول" | "وصول شده" | "برگشت خورده" | "نزد مشتری" | "باطل شده";
export type InstallmentPaymentStatus = "پرداخت نشده" | "پرداخت شده" | "دیرکرد";


export interface InstallmentCheckInfo {
  id?: number; 
  checkNumber: string;
  bankName: string;
  dueDate: string; 
  amount: number;
  status: CheckStatus;
}

export interface InstallmentSalePayload { 
  customerId: number;
  phoneId: number;
  actualSalePrice: number;
  downPayment: number;
  numberOfInstallments: number;
  installmentAmount: number;
  installmentsStartDate: string; 
  checks: InstallmentCheckInfo[]; 
  notes?: string;
}

export interface UserUpdatePayload { // For updating user's role
  roleId?: number;
}

export interface UserForDb {
  id: number;
  username: string;
  passwordHash: string;
  roleId: number;
  roleName: string;
  dateAdded: string;
  avatarPath?: string | null;
}


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const DB_PATH = join(__dirname, 'kourosh_inventory.db');
const MOBILE_PHONE_CATEGORY_NAME = "گوشی‌های موبایل";
const DEFAULT_CATEGORIES = ["لوازم جانبی", "قطعات"];
// const DEFAULT_SUPPLIER_NAME = "تامین‌کننده نمونه"; // This is now removed
const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'password123'; // Default password for initial admin
const ADMIN_ROLE_NAME = 'Admin';
const SALESPERSON_ROLE_NAME = 'Salesperson';


let db: sqlite3.Database | null = null;

// Promisified DB operations
export const runAsync = (sql: string, params: any[] = []): Promise<sqlite3.RunResult> => {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized. Call getDbInstance first."));
    db.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
      if (err) return reject(err);
      resolve(this);
    });
  });
};

export const getAsync = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized. Call getDbInstance first."));
    db.get(sql, params, (err: Error | null, row: any) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

export const allAsync = (sql: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized. Call getDbInstance first."));
    db.all(sql, params, (err: Error | null, rows: any[]) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

export const execAsync = (sql: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized. Call getDbInstance first."));
    db.exec(sql, function(this: sqlite3.Statement, err: Error | null) {
      if (err) return reject(err);
      resolve();
    });
  });
};

export const fromShamsiStringToISO = (shamsiDateString?: string | null): string | undefined => {
  if (!shamsiDateString || typeof shamsiDateString !== 'string' || shamsiDateString.trim() === '') return undefined;
  const m = moment(shamsiDateString.trim(), 'jYYYY/jMM/jDD');
  return m.isValid() ? m.format('YYYY-MM-DD') : undefined;
};


const getOrCreateMobilePhoneCategory = async (): Promise<{ id: number; name: string }> => {
  let category = await getAsync("SELECT id, name FROM categories WHERE name = ?", [MOBILE_PHONE_CATEGORY_NAME]);
  if (!category) {
    const result = await runAsync("INSERT INTO categories (name) VALUES (?)", [MOBILE_PHONE_CATEGORY_NAME]);
    category = { id: result.lastID, name: MOBILE_PHONE_CATEGORY_NAME };
    console.log(`Category "${MOBILE_PHONE_CATEGORY_NAME}" created with ID: ${category.id}`);
  }
  return category;
};

const seedDefaultCategories = async (): Promise<void> => {
  for (const catName of DEFAULT_CATEGORIES) {
    const existing = await getAsync("SELECT id FROM categories WHERE name = ?", [catName]);
    if (!existing) {
      await runAsync("INSERT INTO categories (name) VALUES (?)", [catName]);
      console.log(`Default category "${catName}" created.`);
    }
  }
};

const seedInitialRolesAndAdmin = async (): Promise<void> => {
  // Ensure Admin Role
  let adminRole = await getAsync("SELECT id FROM roles WHERE name = ?", [ADMIN_ROLE_NAME]);
  if (!adminRole) {
    const adminRoleResult = await runAsync("INSERT INTO roles (name) VALUES (?)", [ADMIN_ROLE_NAME]);
    adminRole = { id: adminRoleResult.lastID };
    console.log(`Role "${ADMIN_ROLE_NAME}" created with ID: ${adminRole.id}`);
  }

  // Ensure Salesperson Role
  let salespersonRole = await getAsync("SELECT id FROM roles WHERE name = ?", [SALESPERSON_ROLE_NAME]);
  if (!salespersonRole) {
    const salespersonRoleResult = await runAsync("INSERT INTO roles (name) VALUES (?)", [SALESPERSON_ROLE_NAME]);
    salespersonRole = { id: salespersonRoleResult.lastID };
    console.log(`Role "${SALESPERSON_ROLE_NAME}" created with ID: ${salespersonRole.id}`);
  }

  // Ensure Default Admin User
  const adminUser = await getAsync("SELECT id FROM users WHERE username = ?", [DEFAULT_ADMIN_USERNAME]);
  if (!adminUser && adminRole?.id) { // check adminRole.id to ensure role was created
    const hashedPassword = await bcryptjs.hash(DEFAULT_ADMIN_PASSWORD, 10);
    await runAsync("INSERT INTO users (username, passwordHash, roleId) VALUES (?, ?, ?)", [DEFAULT_ADMIN_USERNAME, hashedPassword, adminRole.id]);
    console.log(`Default admin user "${DEFAULT_ADMIN_USERNAME}" created.`);
  } else if (!adminRole?.id) {
    console.error(`Could not create default admin user because Admin role ID is missing.`);
  }
};

const ensureDefaultBusinessSettings = async (): Promise<void> => {
  const defaultSettings: SettingItem[] = [
    { key: 'store_name', value: 'فروشگاه کوروش' },
    { key: 'store_address_line1', value: 'خیابان اصلی، پلاک ۱۲۳' },
    { key: 'store_city_state_zip', value: 'تهران، استان تهران، ۱۲۳۴۵-۶۷۸' },
    { key: 'store_phone', value: '۰۲۱-۱۲۳۴۵۶۷۸' },
    { key: 'store_email', value: 'info@kouroshstore.example.com' },
  ];

  for (const setting of defaultSettings) {
    const existing = await getAsync("SELECT value FROM settings WHERE key = ?", [setting.key]);
    if (!existing) {
      await runAsync("INSERT INTO settings (key, value) VALUES (?, ?)", [setting.key, setting.value]);
      console.log(`Default setting "${setting.key}" created.`);
    }
  }
};


const initializeDatabaseInternal = async (): Promise<void> => {
  // Non-destructive: Use CREATE TABLE IF NOT EXISTS
  try {
    await runAsync("PRAGMA foreign_keys = ON;");
    console.log("Foreign key support enabled.");

    await runAsync(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      );
    `);
    console.log("Categories table ensured.");

    await runAsync(`
      CREATE TABLE IF NOT EXISTS partners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        partnerName TEXT NOT NULL,
        partnerType TEXT NOT NULL DEFAULT 'Supplier',
        contactPerson TEXT,
        phoneNumber TEXT UNIQUE,
        email TEXT,
        address TEXT,
        notes TEXT,
        dateAdded TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now', 'utc'))
      );
    `);
    console.log("Partners table ensured.");
	await runAsync(`
	  CREATE TABLE IF NOT EXISTS installment_transactions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		installment_payment_id INTEGER NOT NULL,
		amount_paid REAL NOT NULL,
		payment_date TEXT NOT NULL,
		notes TEXT,
		FOREIGN KEY (installment_payment_id) REFERENCES installment_payments(id) ON DELETE CASCADE
	  );
	`);
	console.log("Installment_transactions table ensured.");

    await runAsync(`
      CREATE TABLE IF NOT EXISTS partner_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        partnerId INTEGER NOT NULL,
        transactionDate TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now', 'utc')),
        description TEXT NOT NULL,
        debit REAL DEFAULT 0,
        credit REAL DEFAULT 0,
        balance REAL NOT NULL,
        referenceType TEXT, -- 'phone_purchase', 'product_purchase', 'manual_payment', 'repair_fee', 'other'
        referenceId INTEGER, -- phone.id, product.id, repair.id or null
        FOREIGN KEY (partnerId) REFERENCES partners(id) ON DELETE CASCADE
      );
    `);
    console.log("Partner_ledger table ensured and enhanced with referenceType/ID.");

    await runAsync(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        purchasePrice REAL NOT NULL DEFAULT 0,
        sellingPrice REAL NOT NULL DEFAULT 0,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        saleCount INTEGER NOT NULL DEFAULT 0,
        categoryId INTEGER,
        date_added TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now', 'utc')),
        supplierId INTEGER,
        FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (supplierId) REFERENCES partners(id) ON DELETE SET NULL
      );
    `);
    console.log("Products table ensured.");

    await runAsync(`
      CREATE TABLE IF NOT EXISTS mobile_phone_details ( /* Old structure */
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productId INTEGER NOT NULL UNIQUE,
        brand TEXT NOT NULL,
        model TEXT NOT NULL,
        color TEXT,
        storage INTEGER,
        ram INTEGER,
        imei TEXT NOT NULL UNIQUE,
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
      );
    `);
    console.log("Mobile_phone_details table (old structure) ensured.");

    await runAsync(`
      CREATE TABLE IF NOT EXISTS phones ( /* New standalone */
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model TEXT NOT NULL,
        color TEXT,
        storage TEXT,
        ram TEXT,
        imei TEXT NOT NULL UNIQUE,
        batteryHealth INTEGER,
        condition TEXT,
        purchasePrice REAL NOT NULL,
        salePrice REAL,
        sellerName TEXT,
        buyerName TEXT,
        purchaseDate TEXT, /* ISO Date YYYY-MM-DD */
        saleDate TEXT,     /* ISO Date YYYY-MM-DD */
        registerDate TEXT NOT NULL, /* ISO DateTime string */
        status TEXT NOT NULL, /* e.g., "موجود در انبار", "فروخته شده", "فروخته شده (قسطی)" */
        notes TEXT,
        supplierId INTEGER,
        FOREIGN KEY (supplierId) REFERENCES partners(id) ON DELETE SET NULL
      );
    `);
    console.log("Phones table (new standalone) ensured.");

    await runAsync(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullName TEXT NOT NULL,
        phoneNumber TEXT UNIQUE,
        address TEXT,
        notes TEXT,
        dateAdded TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now', 'utc'))
      );
    `);
    console.log("Customers table ensured.");

    await runAsync(`
      CREATE TABLE IF NOT EXISTS customer_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customerId INTEGER NOT NULL,
        transactionDate TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now', 'utc')),
        description TEXT NOT NULL,
        debit REAL DEFAULT 0,
        credit REAL DEFAULT 0,
        balance REAL NOT NULL,
        FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE
      );
    `);
    console.log("Customer_ledger table ensured.");

    await runAsync(`
      CREATE TABLE IF NOT EXISTS sales_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transactionDate TEXT NOT NULL, /* ISO date string e.g., "YYYY-MM-DD" */
        itemType TEXT NOT NULL CHECK(itemType IN ('phone', 'inventory', 'service')),
        itemId INTEGER NOT NULL,
        itemName TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        pricePerItem REAL NOT NULL,
        totalPrice REAL NOT NULL, /* This is after discount */
        notes TEXT,
        customerId INTEGER,
        discount REAL DEFAULT 0,
        paymentMethod TEXT DEFAULT 'cash', /* Added paymentMethod with default 'cash' */
        FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL
        -- No direct FK to phones or products to allow deletion of products/phones if needed, or handle soft delete
      );
    `);
    console.log("Sales_transactions table ensured.");
	// --- Sales Orders (نسل جدید فاکتور فروش) ---
	await runAsync(`
	  CREATE TABLE IF NOT EXISTS sales_orders (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		customerId     INTEGER,
		paymentMethod  TEXT   NOT NULL DEFAULT 'cash',   -- 'cash' | 'credit'
		discount       REAL   DEFAULT 0,                -- تخفیف سبد
		tax            REAL   DEFAULT 0,                -- درصد مالیات (مثلاً 9)
		subtotal       REAL   NOT NULL,                 -- جمع قبل از تخفیف و مالیات
		grandTotal     REAL   NOT NULL,                 -- مبلغ نهایی پس از همه چیز
		transactionDate TEXT  NOT NULL,                 -- ISO  YYYY-MM-DD
		notes          TEXT,
		FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL
	  );
	`);
	console.log("Sales_orders table ensured.");

	await runAsync(`
	  CREATE TABLE IF NOT EXISTS sales_order_items (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		orderId        INTEGER NOT NULL,
		itemType       TEXT    NOT NULL,  -- 'phone' | 'inventory' | 'service'
		itemId         INTEGER NOT NULL,
		description    TEXT    NOT NULL,
		quantity       INTEGER NOT NULL,
		unitPrice      REAL    NOT NULL,
		discountPerItem REAL   DEFAULT 0,
		totalPrice     REAL    NOT NULL,  -- (qty*unit) - discountPerItem
		FOREIGN KEY (orderId) REFERENCES sales_orders(id) ON DELETE CASCADE
	  );
	`);
	console.log("Sales_order_items table ensured.");

    await runAsync(`
      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        price REAL NOT NULL DEFAULT 0
      );
    `);
    console.log("Services table ensured.");

    await runAsync(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT
      );
    `);
    console.log("Settings table ensured.");

    await runAsync(`
      CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      );
    `);
    console.log("Roles table ensured.");

    await runAsync(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        roleId INTEGER NOT NULL,
        dateAdded TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now', 'utc')),
        FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE RESTRICT -- Prevent role deletion if in use
      );
    `);
    console.log("Users table ensured.");

     try {
      await runAsync("ALTER TABLE users ADD COLUMN avatarPath TEXT");
      console.log("Column 'avatarPath' added to 'users' table.");
    } catch (e: any) {
      if (!e.message.includes("duplicate column name")) {
        console.error("Error adding avatarPath column to users:", e);
      }
    }

    // New Installment Sales Tables
    await runAsync(`
      CREATE TABLE IF NOT EXISTS installment_sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customerId INTEGER NOT NULL,
        phoneId INTEGER NOT NULL,
        actualSalePrice REAL NOT NULL,
        downPayment REAL NOT NULL,
        numberOfInstallments INTEGER NOT NULL,
        installmentAmount REAL NOT NULL,
        installmentsStartDate TEXT NOT NULL, -- Shamsi Date: YYYY/MM/DD
        notes TEXT,
        dateCreated TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now', 'utc')),
        FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE,
        FOREIGN KEY (phoneId) REFERENCES phones(id) ON DELETE RESTRICT -- Prevent deleting phone if in installment sale
      );
    `);
    console.log("Installment_sales table ensured.");

    await runAsync(`
      CREATE TABLE IF NOT EXISTS installment_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        saleId INTEGER NOT NULL,
        installmentNumber INTEGER NOT NULL,
        dueDate TEXT NOT NULL, -- Shamsi Date: YYYY/MM/DD
        amountDue REAL NOT NULL,
        paymentDate TEXT, -- Shamsi Date: YYYY/MM/DD
        status TEXT NOT NULL DEFAULT 'پرداخت نشده', -- ('پرداخت نشده', 'پرداخت شده')
        FOREIGN KEY (saleId) REFERENCES installment_sales(id) ON DELETE CASCADE
      );
    `);
    console.log("Installment_payments table ensured.");

    await runAsync(`
      CREATE TABLE IF NOT EXISTS installment_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        saleId INTEGER NOT NULL,
        checkNumber TEXT NOT NULL,
        bankName TEXT NOT NULL,
        dueDate TEXT NOT NULL, -- Shamsi Date: YYYY/MM/DD
        amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'نزد مشتری', 
        FOREIGN KEY (saleId) REFERENCES installment_sales(id) ON DELETE CASCADE
      );
    `);
    console.log("Installment_checks table ensured.");
	
// --- بخش ساخت جداول فاکتور ---
await runAsync(`
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoiceNumber TEXT UNIQUE, -- شماره فاکتور یکتا (برای چاپ/ارجاع)
    customerId INTEGER,
    date TEXT NOT NULL, -- ISO Date
    subtotal REAL NOT NULL,
    discountAmount REAL DEFAULT 0,
    grandTotal REAL NOT NULL,
    notes TEXT,
    FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL
  );
`);
console.log("Invoices table ensured.");

await runAsync(`
  CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoiceId INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unitPrice REAL NOT NULL,
    totalPrice REAL NOT NULL,
    itemType TEXT, -- phone / inventory / service
    itemId INTEGER, -- ارتباط به کالای فروخته‌شده
    FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
  );
`);
console.log("Invoice_items table ensured.");


    // New Repair Center Tables
    await runAsync(`
      CREATE TABLE IF NOT EXISTS repairs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customerId INTEGER NOT NULL,
        deviceModel TEXT NOT NULL,
        deviceColor TEXT,
        serialNumber TEXT,
        problemDescription TEXT NOT NULL,
        technicianNotes TEXT,
        status TEXT NOT NULL,
        estimatedCost REAL,
        finalCost REAL,
        dateReceived TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now', 'utc')),
        dateCompleted TEXT,
        technicianId INTEGER,
        laborFee REAL,
        FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE RESTRICT,
        FOREIGN KEY (technicianId) REFERENCES partners(id) ON DELETE SET NULL
      );
    `);
    console.log("Repairs table ensured.");

     try {
      await runAsync("ALTER TABLE repairs ADD COLUMN technicianId INTEGER REFERENCES partners(id) ON DELETE SET NULL");
      console.log("Column 'technicianId' added to 'repairs' table.");
    } catch (e: any) {
      if (!e.message.includes("duplicate column name")) console.error("Error adding technicianId column to repairs:", e);
    }
    try {
      await runAsync("ALTER TABLE repairs ADD COLUMN laborFee REAL");
      console.log("Column 'laborFee' added to 'repairs' table.");
    } catch (e: any) {
      if (!e.message.includes("duplicate column name")) console.error("Error adding laborFee column to repairs:", e);
    }

    await runAsync(`
      CREATE TABLE IF NOT EXISTS repair_parts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repairId INTEGER NOT NULL,
        productId INTEGER NOT NULL,
        quantityUsed INTEGER NOT NULL,
        FOREIGN KEY (repairId) REFERENCES repairs(id) ON DELETE CASCADE,
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE RESTRICT
      );
    `);
    console.log("Repair_parts table ensured.");


  } catch(err: any) {
    console.error("Error during table creation phase:", err);
    throw new Error(`Failed during table creation: ${err.message}`);
  }

  // Seed initial data (idempotently)
  try {
    await getOrCreateMobilePhoneCategory();
    await seedDefaultCategories();
    // The call to seedDefaultSupplier() is removed from here.
    await seedInitialRolesAndAdmin();
    await ensureDefaultBusinessSettings();
    console.log("Initial data seeding completed/verified.");
  } catch (err: any) {
    console.error("Error seeding initial data:", err);
  }
};

let dbInstance: sqlite3.Database | null = null;
let dbInitializationPromise: Promise<sqlite3.Database | null> | null = null;

export const getDbInstance = (forceNew: boolean = false): Promise<sqlite3.Database | null> => {
  if (dbInstance && !forceNew) return Promise.resolve(dbInstance);
  if (dbInitializationPromise && !forceNew) return dbInitializationPromise;

  dbInitializationPromise = new Promise<sqlite3.Database | null>((resolveConnection, rejectConnection) => {
    const connect = () => {
        const newDb = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, async (err: Error | null) => {
            if (err) {
                console.error('Error opening database connection:', err);
                dbInitializationPromise = null; // Reset promise on failure
                return rejectConnection(new Error(`Failed to open DB: ${err.message}`));
            }
            console.log('Connected to the SQLite database: kourosh_inventory.db');
            db = newDb; // Crucial: assign to the module-scoped db variable
            try {
                await initializeDatabaseInternal();
                dbInstance = newDb;
                resolveConnection(dbInstance);
            } catch (initErr: any) {
                console.error("Database initialization process failed:", initErr);
                dbInitializationPromise = null; // Reset promise on failure
                if (db) {
                    db.close(); // Attempt to close the problematic connection
                    db = null;
                }
                rejectConnection(new Error(`DB init failed: ${initErr.message}`));
            }
        });
    };

    if (db && forceNew) {
        db.close((closeErr: Error | null) => {
            if (closeErr) {
                console.error('Error closing existing DB for re-initialization:', closeErr);
                // Proceed with creating new connection anyway, but log the error
            }
            db = null;
            dbInstance = null;
            console.log('Existing DB connection closed (or attempted to close) for re-initialization.');
            connect();
        });
    } else {
        connect();
    }
  });
  return dbInitializationPromise;
};

export const closeDbConnection = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (db) {
            db.close((err: Error | null) => {
                if (err) {
                    console.error('Error closing the database connection:', err);
                    return reject(new Error(`Failed to close DB: ${err.message}`));
                }
                console.log('Database connection closed.');
                db = null;
                dbInstance = null;
                dbInitializationPromise = null;
                resolve();
            });
        } else {
            resolve();
        }
    });
};
// --- Reports helpers (top-level) ---
export const getProfitPerSaleMapFromDb = async (ids:number[]) => {
  await getDbInstance();
  if(!ids.length) return new Map<number,number>();
  const ph = ids.map(()=>'?').join(',');
  const rows = await allAsync(`
    SELECT st.id AS saleId,
           SUM(st.totalPrice - CASE
             WHEN st.itemType='inventory' THEN COALESCE(p.purchasePrice,0)*st.quantity
             WHEN st.itemType='phone'     THEN COALESCE(ph.purchasePrice,0)*st.quantity
             ELSE 0 END) AS profit
    FROM sales_transactions st
    LEFT JOIN products p ON st.itemType='inventory' AND st.itemId=p.id
    LEFT JOIN phones   ph ON st.itemType='phone'     AND st.itemId=ph.id
    WHERE st.id IN (${ph})
    GROUP BY st.id
  `, ids);
  const map = new Map<number,number>();
  rows.forEach(r=>map.set(Number(r.saleId), Number(r.profit)||0));
  return map;
};


// Internal helper function for adding partner ledger entries
export const addPartnerLedgerEntryInternal = async ( // Made exportable if needed, but consider if it's truly public API
  partnerId: number,
  description: string,
  debit: number | undefined,
  credit: number | undefined,
  transactionDateISO?: string,
  referenceType?: string,
  referenceId?: number
): Promise<any> => {
  const dateToStore = transactionDateISO || new Date().toISOString();
  const prevBalanceRow = await getAsync(
    `SELECT balance FROM partner_ledger WHERE partnerId = ? ORDER BY id DESC LIMIT 1`,
    [partnerId]
  );
  const prevBalance = prevBalanceRow ? prevBalanceRow.balance : 0;
  const currentDebit = debit || 0;
  const currentCredit = credit || 0;
  const newBalance = prevBalance + currentCredit - currentDebit;

  const result = await runAsync(
    `INSERT INTO partner_ledger (partnerId, transactionDate, description, debit, credit, balance, referenceType, referenceId) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [partnerId, dateToStore, description, currentDebit, currentCredit, newBalance, referenceType, referenceId]
  );
  return await getAsync("SELECT * FROM partner_ledger WHERE id = ?", [result.lastID]);
};

// --- Services ---
export const getAllServicesFromDb = async (): Promise<Service[]> => {
    await getDbInstance();
    return await allAsync(`SELECT * FROM services ORDER BY name ASC`);
};

export const addServiceToDb = async (service: Omit<Service, 'id'>): Promise<Service> => {
    await getDbInstance();
    const { name, description, price } = service;
    try {
        const result = await runAsync(
            `INSERT INTO services (name, description, price) VALUES (?, ?, ?)`,
            [name, description, price]
        );
        return await getAsync("SELECT * FROM services WHERE id = ?", [result.lastID]);
    } catch (err: any) {
        if (err.message.includes('UNIQUE constraint failed')) {
            throw new Error('نام این خدمت تکراری است.');
        }
        throw new Error(`خطای پایگاه داده: ${err.message}`);
    }
};

export const updateServiceInDb = async (id: number, service: Omit<Service, 'id'>): Promise<Service> => {
    await getDbInstance();
    const { name, description, price } = service;
    try {
        await runAsync(
            `UPDATE services SET name = ?, description = ?, price = ? WHERE id = ?`,
            [name, description, price, id]
        );
        const updatedService = await getAsync("SELECT * FROM services WHERE id = ?", [id]);
        if (!updatedService) throw new Error("خدمت برای ویرایش یافت نشد.");
        return updatedService;
    } catch (err: any) {
        if (err.message.includes('UNIQUE constraint failed')) {
            throw new Error('نام این خدمت تکراری است.');
        }
        throw new Error(`خطای پایگاه داده: ${err.message}`);
    }
};

export const deleteServiceFromDb = async (id: number): Promise<boolean> => {
    await getDbInstance();
    const result = await runAsync(`DELETE FROM services WHERE id = ?`, [id]);
    if (result.changes === 0) {
      throw new Error("خدمت برای حذف یافت نشد.");
    }
    return result.changes > 0;
};


// --- Categories ---
export const addCategoryToDb = async (name: string): Promise<any> => {
  await getDbInstance(); // Ensure DB is initialized before any operation
  try {
    const result = await runAsync(`INSERT INTO categories (name) VALUES (?)`, [name]);
    return await getAsync("SELECT * FROM categories WHERE id = ?", [result.lastID]);
  } catch (err: any) {
    if (err.message.includes('UNIQUE constraint failed')) {
      throw new Error('نام دسته‌بندی تکراری است.');
    }
    console.error('DB Error (addCategoryToDb):', err);
    throw new Error(`خطای پایگاه داده: ${err.message}`);
  }
};

export const getAllCategoriesFromDb = async (): Promise<any[]> => {
  await getDbInstance();
  try {
    return await allAsync(`SELECT * FROM categories ORDER BY name ASC`);
  } catch (err: any) {
    console.error('DB Error (getAllCategoriesFromDb):', err);
    throw new Error(`خطای پایگاه داده: ${err.message}`);
  }
};

export const updateCategoryInDb = async (id: number, name: string): Promise<any> => {
  await getDbInstance();
  try {
    const existing = await getAsync("SELECT id FROM categories WHERE id = ?", [id]);
    if (!existing) {
      throw new Error("دسته‌بندی برای بروزرسانی یافت نشد.");
    }
    await runAsync(`UPDATE categories SET name = ? WHERE id = ?`, [name, id]);
    return await getAsync("SELECT * FROM categories WHERE id = ?", [id]);
  } catch (err: any) {
    if (err.message.includes('UNIQUE constraint failed')) {
      throw new Error('این نام دسته‌بندی قبلا ثبت شده است.');
    }
    console.error('DB Error (updateCategoryInDb):', err);
    throw new Error(`خطای پایگاه داده: ${err.message}`);
  }
};

export const deleteCategoryFromDb = async (id: number): Promise<boolean> => {
  await getDbInstance();
  try {
    const result = await runAsync(`DELETE FROM categories WHERE id = ?`, [id]);
    if (result.changes === 0) {
        // This check is a bit redundant if the calling function already checks for 404,
        // but good for direct DB function calls.
        throw new Error("دسته‌بندی برای حذف یافت نشد یا قبلا حذف شده است.");
    }
    return result.changes > 0;
  } catch (err: any) {
    console.error('DB Error (deleteCategoryFromDb):', err);
    throw new Error(`خطای پایگاه داده: ${err.message}`);
  }
};


// --- Products (Inventory) ---
export const addProductToDb = async (product: ProductPayload): Promise<any> => {
  await getDbInstance();
  const { name, purchasePrice, sellingPrice, stock_quantity, categoryId, supplierId } = product;

  try {
    await execAsync("BEGIN TRANSACTION;");
    const result = await runAsync(
      `INSERT INTO products (name, purchasePrice, sellingPrice, stock_quantity, categoryId, supplierId, saleCount)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [name, purchasePrice, sellingPrice, stock_quantity, categoryId, supplierId]
    );
    const newProductId = result.lastID;

    if (supplierId && purchasePrice > 0 && stock_quantity > 0) {
      const creditAmount = purchasePrice * stock_quantity;
      const description = `دریافت کالا: ${stock_quantity} عدد ${name} (شناسه محصول: ${newProductId}) به ارزش واحد ${purchasePrice.toLocaleString('fa-IR')}`;
      await addPartnerLedgerEntryInternal(supplierId, description, 0, creditAmount, new Date().toISOString(), 'product_purchase', newProductId);
    }

    await execAsync("COMMIT;");
    return await getAsync(
      `SELECT p.*, c.name as categoryName, pa.partnerName as supplierName
       FROM products p
       LEFT JOIN categories c ON p.categoryId = c.id
       LEFT JOIN partners pa ON p.supplierId = pa.id
       WHERE p.id = ?`,
      [newProductId]
    );
  } catch (err: any) {
    await execAsync("ROLLBACK;");
    console.error('DB Error (addProductToDb):', err);
    throw new Error(`خطای پایگاه داده: ${err.message}`);
  }
};

export const getAllProductsFromDb = async (supplierIdFilter: number | null = null): Promise<any[]> => {
  await getDbInstance();
  let sql = `
    SELECT p.id, p.name, p.purchasePrice, p.sellingPrice, p.stock_quantity, p.saleCount, p.date_added,
           p.categoryId, c.name as categoryName,
           p.supplierId, pa.partnerName as supplierName
    FROM products p
    LEFT JOIN categories c ON p.categoryId = c.id
    LEFT JOIN partners pa ON p.supplierId = pa.id
  `;
  const params: any[] = [];
  if (supplierIdFilter) {
    sql += " WHERE p.supplierId = ?";
    params.push(supplierIdFilter);
  }
  sql += " ORDER BY p.date_added DESC";
  try {
    return await allAsync(sql, params);
  } catch (err: any) {
    console.error('DB Error (getAllProductsFromDb):', err);
    throw new Error(`خطای پایگاه داده: ${err.message}`);
  }
};

export const updateProductInDb = async (productId: number, productData: UpdateProductPayload): Promise<any> => {
    await getDbInstance();
    const { name, purchasePrice, sellingPrice, stock_quantity, categoryId, supplierId } = productData;

    const product = await getAsync("SELECT * FROM products WHERE id = ?", [productId]);
    if (!product) {
        throw new Error("محصول برای بروزرسانی یافت نشد.");
    }

    // Build the update query dynamically
    const fieldsToUpdate: string[] = [];
    const params: any[] = [];

    if (name !== undefined) { fieldsToUpdate.push("name = ?"); params.push(name); }
    if (purchasePrice !== undefined) { fieldsToUpdate.push("purchasePrice = ?"); params.push(purchasePrice); }
    if (sellingPrice !== undefined) { fieldsToUpdate.push("sellingPrice = ?"); params.push(sellingPrice); }
    if (stock_quantity !== undefined) { fieldsToUpdate.push("stock_quantity = ?"); params.push(stock_quantity); }
    if (categoryId !== undefined) { fieldsToUpdate.push("categoryId = ?"); params.push(categoryId); } // Handles null
    if (supplierId !== undefined) { fieldsToUpdate.push("supplierId = ?"); params.push(supplierId); } // Handles null

    if (fieldsToUpdate.length === 0) {
        return product; // No changes, return current product data
    }

    params.push(productId);
    const sql = `UPDATE products SET ${fieldsToUpdate.join(", ")} WHERE id = ?`;

    try {
        // For inventory products, direct ledger adjustment on simple edit is complex and often not standard.
        // Ledger entries are typically for acquisitions/disposals.
        // If purchase price or supplier changes AND stock_quantity changes, it could imply a new purchase or return.
        // For now, we just update the product details. Partner ledger adjustments would need more specific logic for stock changes.
        await runAsync(sql, params);
        return await getAsync(
         `SELECT p.*, c.name as categoryName, pa.partnerName as supplierName
          FROM products p
          LEFT JOIN categories c ON p.categoryId = c.id
          LEFT JOIN partners pa ON p.supplierId = pa.id
          WHERE p.id = ?`,
         [productId]
       );
    } catch (err: any) {
        console.error('DB Error (updateProductInDb):', err);
        throw new Error(`خطای پایگاه داده: ${err.message}`);
    }
};

export const deleteProductFromDb = async (productId: number): Promise<boolean> => {
    await getDbInstance();
    await execAsync("BEGIN TRANSACTION;");
    try {
        const product = await getAsync("SELECT * FROM products WHERE id = ?", [productId]);
        if (!product) {
            throw new Error("محصول برای حذف یافت نشد.");
        }

        const saleRecord = await getAsync(
            "SELECT id FROM sales_transactions WHERE itemType = 'inventory' AND itemId = ? LIMIT 1",
            [productId]
        );
        if (saleRecord) {
            throw new Error("امکان حذف محصول وجود ندارد زیرا قبلاً فروخته شده است.");
        }

        if (product.supplierId && product.purchasePrice > 0 && product.stock_quantity > 0) {
            const debitAmount = product.purchasePrice * product.stock_quantity;
            const description = `حذف/بازگشت کالا: ${product.stock_quantity} عدد ${product.name} (شناسه محصول: ${productId}) از انبار`;
            await addPartnerLedgerEntryInternal(product.supplierId, description, debitAmount, 0, new Date().toISOString(), 'product_return_on_delete', productId);
        }
        
        const result = await runAsync(`DELETE FROM products WHERE id = ?`, [productId]);
        
        await execAsync("COMMIT;");
        return result.changes > 0;
    } catch (err: any) {
        await execAsync("ROLLBACK;").catch(rbErr => console.error("Rollback failed in deleteProductFromDb:", rbErr));
        console.error('DB Error (deleteProductFromDb):', err);
        throw err; // Re-throw the original error
    }
};

// --- Standalone Phones ---
export const addPhoneEntryToDb = async (phoneData: PhoneEntryPayload): Promise<any> => {
  await getDbInstance();
  const {
    model, color, storage, ram, imei, batteryHealth, condition,
    purchasePrice, salePrice, sellerName, purchaseDate,
    supplierId // saleDate will be null/undefined on initial registration
  } = phoneData;

  const registerDate = phoneData.registerDate || new Date().toISOString();
  const status = phoneData.status || "موجود در انبار";

  try {
    const existingPhone = await getAsync("SELECT id FROM phones WHERE imei = ?", [imei]);
    if (existingPhone) {
      throw new Error('شماره IMEI تکراری است.');
    }
    await execAsync("BEGIN TRANSACTION;");
    const result = await runAsync(
      `INSERT INTO phones (model, color, storage, ram, imei, batteryHealth, condition, purchasePrice, salePrice, sellerName, purchaseDate, saleDate, registerDate, status, notes, supplierId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        model, color, storage, ram, imei, batteryHealth, condition,
        purchasePrice, salePrice, sellerName, purchaseDate,
        null, // Explicitly set saleDate to null on initial registration
        registerDate, status, phoneData.notes, supplierId
      ]
    );
    const newPhoneId = result.lastID;

    if (supplierId && purchasePrice > 0) {
      const description = `دریافت گوشی: ${model} (IMEI: ${imei}, شناسه گوشی: ${newPhoneId}) به ارزش ${Number(purchasePrice).toLocaleString('fa-IR')}`;
      await addPartnerLedgerEntryInternal(supplierId, description, 0, purchasePrice, purchaseDate || new Date().toISOString(), 'phone_purchase', newPhoneId);
    }

    await execAsync("COMMIT;");
    return await getAsync(
      `SELECT ph.*, pa.partnerName as supplierName
       FROM phones ph
       LEFT JOIN partners pa ON ph.supplierId = pa.id
       WHERE ph.id = ?`, [newPhoneId]);
  } catch (err: any) {
    await execAsync("ROLLBACK;").catch(rbErr => console.error("Rollback failed in addPhoneEntryToDb:", rbErr));
    console.error('DB Error (addPhoneEntryToDb):', err);
    if (err.message.includes('UNIQUE constraint failed: phones.imei') || err.message.includes('شماره IMEI تکراری است')) {
      throw new Error('شماره IMEI تکراری است.');
    }
    throw new Error(`خطای پایگاه داده: ${err.message}`);
  }
};

export const updatePhoneEntryInDb = async (phoneId: number, phoneData: PhoneEntryUpdatePayload): Promise<any> => {
  await getDbInstance();
  const {
    model, color, storage, ram, imei, batteryHealth, condition,
    purchasePrice, salePrice, sellerName, purchaseDate, // purchaseDate can be Shamsi from DatePicker
    status, notes, supplierId
  } = phoneData;

  const existingPhone = await getAsync("SELECT * FROM phones WHERE id = ?", [phoneId]);
  if (!existingPhone) {
    throw new Error("گوشی برای بروزرسانی یافت نشد.");
  }

  if (imei && imei !== existingPhone.imei) {
    const imeiExists = await getAsync("SELECT id FROM phones WHERE imei = ? AND id != ?", [imei, phoneId]);
    if (imeiExists) {
      throw new Error('شماره IMEI جدید تکراری است.');
    }
  }
  
  await execAsync("BEGIN TRANSACTION;");
  try {
    // Handle ledger adjustments if purchasePrice or supplierId changes
    const newPurchasePrice = purchasePrice !== undefined && purchasePrice !== null && String(purchasePrice).trim() !== '' ? Number(purchasePrice) : existingPhone.purchasePrice;
    const newSupplierId = supplierId !== undefined && supplierId !== null && String(supplierId).trim() !== '' ? Number(supplierId) : existingPhone.supplierId;
    
    //let ledgerAdjusted = false; // This variable is not used after assignment
    if ( (newPurchasePrice !== existingPhone.purchasePrice || newSupplierId !== existingPhone.supplierId) && (existingPhone.supplierId && existingPhone.purchasePrice > 0) ) {
      // Reverse old ledger entry if original supplier and price existed
      const oldLedgerDesc = `اصلاح خرید گوشی: ${existingPhone.model} (IMEI: ${existingPhone.imei}, شناسه: ${phoneId}) - برگشت خرید قبلی`;
      await addPartnerLedgerEntryInternal(existingPhone.supplierId, oldLedgerDesc, existingPhone.purchasePrice, 0, new Date().toISOString(), 'phone_purchase_reversal_on_edit', phoneId);
      // ledgerAdjusted = true;
    }
    
    if ( (newPurchasePrice !== existingPhone.purchasePrice || newSupplierId !== existingPhone.supplierId) && (newSupplierId && newPurchasePrice > 0) ) {
      // Create new ledger entry if new supplier and price exist
      const newLedgerDesc = `اصلاح خرید گوشی: ${model || existingPhone.model} (IMEI: ${imei || existingPhone.imei}, شناسه: ${phoneId}) - ثبت خرید جدید`;
      const effectivePurchaseDate = purchaseDate ? fromShamsiStringToISO(purchaseDate) || new Date().toISOString() : existingPhone.purchaseDate || new Date().toISOString();
      await addPartnerLedgerEntryInternal(newSupplierId, newLedgerDesc, 0, newPurchasePrice, effectivePurchaseDate, 'phone_purchase_edit', phoneId);
      // ledgerAdjusted = true;
    }


    const fieldsToUpdate: string[] = [];
    const params: any[] = [];

    const updateIfChanged = (field: string, newValue: any, existingValue: any, isNumericString = false, isDate = false) => {
      let finalValue = newValue;
      if (isNumericString && typeof newValue === 'string') {
        finalValue = newValue.trim() === '' ? null : Number(newValue);
      } else if (isDate && typeof newValue === 'string') {
        finalValue = fromShamsiStringToISO(newValue) || null; // Convert Shamsi date to ISO
      }

      if (finalValue !== undefined && finalValue !== existingValue) {
        fieldsToUpdate.push(`${field} = ?`);
        params.push(finalValue === '' && !isNumericString && !isDate ? null : finalValue);
      } else if (newValue === null && existingValue !== null) { // Handle explicit null setting
        fieldsToUpdate.push(`${field} = ?`);
        params.push(null);
      }
    };
    
    updateIfChanged('model', model, existingPhone.model);
    updateIfChanged('color', color, existingPhone.color);
    updateIfChanged('storage', storage, existingPhone.storage);
    updateIfChanged('ram', ram, existingPhone.ram);
    updateIfChanged('imei', imei, existingPhone.imei);
    updateIfChanged('batteryHealth', batteryHealth, existingPhone.batteryHealth, true);
    updateIfChanged('condition', condition, existingPhone.condition);
    updateIfChanged('purchasePrice', purchasePrice, existingPhone.purchasePrice, true);
    updateIfChanged('salePrice', salePrice, existingPhone.salePrice, true);
    updateIfChanged('sellerName', sellerName, existingPhone.sellerName);
    updateIfChanged('purchaseDate', purchaseDate, existingPhone.purchaseDate, false, true);
    updateIfChanged('status', status, existingPhone.status);
    updateIfChanged('notes', notes, existingPhone.notes);
    updateIfChanged('supplierId', supplierId, existingPhone.supplierId, true);

    if (fieldsToUpdate.length > 0) {
      params.push(phoneId);
      const sql = `UPDATE phones SET ${fieldsToUpdate.join(", ")} WHERE id = ?`;
      await runAsync(sql, params);
    }

    await execAsync("COMMIT;");
    return await getAsync(
      `SELECT ph.*, pa.partnerName as supplierName
       FROM phones ph
       LEFT JOIN partners pa ON ph.supplierId = pa.id
       WHERE ph.id = ?`, [phoneId]);

  } catch (err: any) {
    await execAsync("ROLLBACK;").catch(rbErr => console.error("Rollback failed in updatePhoneEntryInDb:", rbErr));
    console.error('DB Error (updatePhoneEntryInDb):', err);
    if (err.message.includes('UNIQUE constraint failed: phones.imei') || err.message.includes('شماره IMEI جدید تکراری است')) {
      throw new Error('شماره IMEI جدید تکراری است.');
    }
    throw new Error(`خطای پایگاه داده: ${err.message}`);
  }
};

export const deletePhoneEntryFromDb = async (phoneId: number): Promise<boolean> => {
  await getDbInstance();
  const phone = await getAsync("SELECT * FROM phones WHERE id = ?", [phoneId]);
  if (!phone) {
    throw new Error("گوشی برای حذف یافت نشد.");
  }

  // Check if phone is part of an installment sale (critical check due to ON DELETE RESTRICT)
  const installmentSale = await getAsync("SELECT id FROM installment_sales WHERE phoneId = ?", [phoneId]);
  if (installmentSale) {
    throw new Error(`امکان حذف گوشی وجود ندارد. این گوشی در فروش اقساطی شماره ${installmentSale.id} ثبت شده است.`);
  }
  
  // Check if phone is part of a regular sale
  const regularSale = await getAsync("SELECT id FROM sales_transactions WHERE itemType = 'phone' AND itemId = ?", [phoneId]);
  if (regularSale) {
    throw new Error(`امکان حذف گوشی وجود ندارد. این گوشی در فروش نقدی/اعتباری شماره ${regularSale.id} ثبت شده است.`);
  }


  await execAsync("BEGIN TRANSACTION;");
  try {
    // If phone was purchased from a supplier, reverse the ledger entry
    if (phone.supplierId && phone.purchasePrice > 0) {
      const description = `حذف گوشی: ${phone.model} (IMEI: ${phone.imei}, شناسه: ${phoneId}) - بازگشت مبلغ خرید اولیه`;
      await addPartnerLedgerEntryInternal(phone.supplierId, description, phone.purchasePrice, 0, new Date().toISOString(), 'phone_delete', phoneId);
    }

    const result = await runAsync(`DELETE FROM phones WHERE id = ?`, [phoneId]);
    await execAsync("COMMIT;");
    return result.changes > 0;
  } catch (err: any) {
    await execAsync("ROLLBACK;").catch(rbErr => console.error("Rollback failed in deletePhoneEntryFromDb:", rbErr));
    console.error('DB Error (deletePhoneEntryFromDb):', err);
    throw err; 
  }
};


export const getAllPhoneEntriesFromDb = async (supplierIdFilter: number | null = null, statusFilter?: string, phoneId?: number): Promise<any[]> => {
  await getDbInstance();
  let sql = `
    SELECT ph.*, pa.partnerName as supplierName
    FROM phones ph
    LEFT JOIN partners pa ON ph.supplierId = pa.id
  `;
  const params: any[] = [];
  const conditions: string[] = [];

  if (phoneId) { // If specific phoneId is requested
    conditions.push("ph.id = ?");
    params.push(phoneId);
  } else { // Apply filters if not fetching a specific phone
    if (supplierIdFilter) {
      conditions.push("ph.supplierId = ?");
      params.push(supplierIdFilter);
    }
    if (statusFilter) {
      conditions.push("ph.status = ?");
      params.push(statusFilter);
    }
  }


  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  
  sql += " ORDER BY ph.registerDate DESC";
  try {
    return await allAsync(sql, params);
  } catch (err: any) {
    console.error('DB Error (getAllPhoneEntriesFromDb):', err);
    throw new Error(`خطای پایگاه داده: ${err.message}`);
  }
};


// --- Sales ---
export const getSellableItemsFromDb = async (): Promise<{ phones: any[], inventory: any[] }> => {
  await getDbInstance();
  try {
    const phones = await allAsync(`
      SELECT id, model, imei, salePrice as price, 1 as stock
      FROM phones
      WHERE status = 'موجود در انبار' AND salePrice IS NOT NULL AND salePrice > 0
    `);

    const inventory = await allAsync(`
      SELECT id, name, sellingPrice as price, stock_quantity as stock
      FROM products
      WHERE stock_quantity > 0 AND sellingPrice IS NOT NULL AND sellingPrice > 0
    `);

    return {
      phones: phones.map(p => ({
        ...p,
        type: 'phone',
        name: `${p.model} (IMEI: ${p.imei})`
      })),
      inventory: inventory.map(i => ({
        ...i,
        type: 'inventory'
      }))
    };
  } catch (err: any) {
    console.error('DB Error (getSellableItemsFromDb):', err);
    throw new Error(`خطای پایگاه داده: ${err.message}`);
  }
};

export const getAllSalesTransactionsFromDb = async (customerIdFilter: number | null = null): Promise<any[]> => {
  await getDbInstance();
  let sql = `
    SELECT st.*, c.fullName as customerFullName
    FROM sales_transactions st
    LEFT JOIN customers c ON st.customerId = c.id
  `;
  const params: any[] = [];
  if (customerIdFilter) {
    sql += " WHERE st.customerId = ?";
    params.push(customerIdFilter);
  }
  sql += " ORDER BY st.id DESC";

  try {
    return await allAsync(sql, params);
  } catch (err: any) {
    console.error('DB Error (getAllSalesTransactionsFromDb):', err);
    throw new Error(`خطای پایگاه داده: ${err.message}`);
  }
};
/* فهرست خلاصهٔ همهٔ سفارش‌های فروش برای صفحهٔ «فاکتورها» */
export const getAllSalesOrdersFromDb = async (): Promise<any[]> => {
  await getDbInstance();
  return await allAsync(`
    SELECT
        so.id,
        so.transactionDate,
        so.grandTotal            AS totalPrice,
        c.fullName               AS customerFullName,
        COALESCE(
          (SELECT description
             FROM sales_order_items
            WHERE orderId = so.id
            LIMIT 1),
          '—'
        )                        AS itemName
    FROM   sales_orders  AS so
    LEFT  JOIN customers  AS c  ON c.id = so.customerId
    ORDER BY so.id DESC
  `);
};

export const addCustomerLedgerEntryToDb = async (customerId: number, entryData: LedgerEntryPayload): Promise<any> => {
  await getDbInstance();
  const { description, debit, credit, transactionDate } = entryData;
  return await addCustomerLedgerEntryInternal(customerId, description, debit, credit, transactionDate);
};


export const addCustomerLedgerEntryInternal = async ( // Made exportable if needed
  customerId: number,
  description: string,
  debit: number | undefined,
  credit: number | undefined,
  transactionDateISO?: string
): Promise<any> => {
  const dateToStore = transactionDateISO || new Date().toISOString();
  const prevBalanceRow = await getAsync(
    `SELECT balance FROM customer_ledger WHERE customerId = ? ORDER BY id DESC LIMIT 1`,
    [customerId]
  );
  const prevBalance = prevBalanceRow ? prevBalanceRow.balance : 0;
  const currentDebit = debit || 0;
  const currentCredit = credit || 0;
  const newBalance = prevBalance + currentDebit - currentCredit;

  const result = await runAsync(
    `INSERT INTO customer_ledger (customerId, transactionDate, description, debit, credit, balance) VALUES (?, ?, ?, ?, ?, ?)`,
    [customerId, dateToStore, description, currentDebit, currentCredit, newBalance]
  );
  return await getAsync("SELECT * FROM customer_ledger WHERE id = ?", [result.lastID]);
};

export const recordSaleTransactionInDb = async (saleData: SaleDataPayload): Promise<any> => {
  await getDbInstance();
  // transactionDate is expected as Shamsi 'YYYY/MM/DD' from frontend
  const { itemType, itemId, quantity, transactionDate: shamsiTransactionDate, customerId, notes, discount = 0, paymentMethod } = saleData; 
  
  // Convert Shamsi date to ISO YYYY-MM-DD for storage and for phone's saleDate
  const isoTransactionDate = moment(shamsiTransactionDate, 'jYYYY/jMM/jDD').format('YYYY-MM-DD');
  if (!moment(isoTransactionDate, 'YYYY-MM-DD', true).isValid()) {
    throw new Error('تاریخ تراکنش ارائه شده پس از تبدیل به میلادی، نامعتبر است.');
  }
  

  try {
    await execAsync("BEGIN TRANSACTION;");
    let itemName: string;
    let pricePerItem: number;
    let purchasePriceOfItem = 0; // For profit calculation

    if (itemType === 'phone') {
      if (quantity !== 1) throw new Error('تعداد برای فروش گوشی باید ۱ باشد.');
      const phone = await getAsync("SELECT model, imei, salePrice, purchasePrice, status FROM phones WHERE id = ?", [itemId]);
      if (!phone) throw new Error('گوشی مورد نظر برای فروش یافت نشد.');
      if (phone.status !== 'موجود در انبار') throw new Error(`گوشی "${phone.model} (IMEI: ${phone.imei})" در وضعیت "${phone.status}" قرار دارد و قابل فروش نیست.`);
      if (phone.salePrice === null || typeof phone.salePrice !== 'number' || phone.salePrice <= 0) throw new Error(`قیمت فروش برای گوشی "${phone.model} (IMEI: ${phone.imei})" مشخص نشده یا نامعتبر است.`);

      itemName = `${phone.model} (IMEI: ${phone.imei})`;
      pricePerItem = phone.salePrice;
      purchasePriceOfItem = phone.purchasePrice;
      await runAsync("UPDATE phones SET status = 'فروخته شده', saleDate = ? WHERE id = ?", [isoTransactionDate, itemId]);
    } else if (itemType === 'inventory') {
      const product = await getAsync("SELECT name, sellingPrice, purchasePrice, stock_quantity FROM products WHERE id = ?", [itemId]);
      if (!product) throw new Error('کالای مورد نظر در انبار یافت نشد.');
      if (product.stock_quantity < quantity) throw new Error(`موجودی کالا (${product.name}: ${product.stock_quantity} عدد) برای فروش کافی نیست (درخواست: ${quantity} عدد).`);
      if (product.sellingPrice === null || typeof product.sellingPrice !== 'number' || product.sellingPrice <= 0) throw new Error(`قیمت فروش برای کالا "${product.name}" مشخص نشده یا نامعتبر است.`);

      itemName = product.name;
      pricePerItem = product.sellingPrice;
      purchasePriceOfItem = product.purchasePrice;
      await runAsync("UPDATE products SET stock_quantity = stock_quantity - ?, saleCount = saleCount + ? WHERE id = ?", [quantity, quantity, itemId]);
    } else if (itemType === 'service') {
        const service = await getAsync("SELECT name, price FROM services WHERE id = ?", [itemId]);
        if (!service) throw new Error('خدمت مورد نظر یافت نشد.');
        if (quantity !== 1) throw new Error('تعداد برای فروش خدمت باید ۱ باشد.');
        
        itemName = service.name;
        pricePerItem = service.price;
        // No stock update, no purchase price for services
    } else {
      throw new Error('نوع کالای نامعتبر برای فروش.');
    }

    const subTotal = quantity * pricePerItem;
    if (discount > subTotal) throw new Error('مبلغ تخفیف نمی‌تواند بیشتر از قیمت کل کالا باشد.');
    const totalPrice = subTotal - discount;
    if (totalPrice < 0) throw new Error('قیمت نهایی پس از تخفیف نمی‌تواند منفی باشد.');

    const saleResult = await runAsync(
      `INSERT INTO sales_transactions (transactionDate, itemType, itemId, itemName, quantity, pricePerItem, totalPrice, notes, customerId, discount, paymentMethod)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [isoTransactionDate, itemType, itemId, itemName, quantity, pricePerItem, totalPrice, notes, customerId, discount, paymentMethod]
    );

    if (customerId && paymentMethod === 'credit' && totalPrice > 0) {
      const ledgerDescription = `خرید اعتباری: ${itemName} (شناسه فروش: ${saleResult.lastID})`;
      // For customer ledger: debit means customer owes more (asset for company)
      await addCustomerLedgerEntryInternal(customerId, ledgerDescription, totalPrice, 0, new Date().toISOString());
    }

    await execAsync("COMMIT;");
    return await getAsync("SELECT * FROM sales_transactions WHERE id = ?", [saleResult.lastID]);
  } catch (err: any) {
    await execAsync("ROLLBACK;");
    console.error('DB Error (recordSaleTransactionInDb):', err);
    throw err;
  }
};

// --- Customers ---
export const addCustomerToDb = async (customerData: CustomerPayload): Promise<any> => {
  await getDbInstance();
  const { fullName, phoneNumber, address, notes } = customerData;
  try {
    const result = await runAsync(
      `INSERT INTO customers (fullName, phoneNumber, address, notes) VALUES (?, ?, ?, ?)`,
      [fullName, phoneNumber || null, address || null, notes || null]
    );
    return await getAsync("SELECT * FROM customers WHERE id = ?", [result.lastID]);
  } catch (err: any) {
    if (err.message.includes('UNIQUE constraint failed: customers.phoneNumber')) {
      throw new Error('این شماره تماس قبلا برای مشتری دیگری ثبت شده است.');
    }
    throw new Error(`خطای پایگاه داده: ${err.message}`);
  }
};

export const getAllCustomersWithBalanceFromDb = async (): Promise<any[]> => {
  await getDbInstance();
  return await allAsync(`
    SELECT c.*, COALESCE(cl.balance, 0) as currentBalance
    FROM customers c
    LEFT JOIN (
      SELECT customerId, balance
      FROM customer_ledger
      ORDER BY id DESC
    ) cl ON c.id = cl.customerId
    GROUP BY c.id
    ORDER BY c.fullName ASC
  `);
};

export const getCustomerByIdFromDb = async (customerId: number): Promise<any> => {
  await getDbInstance();
  const customer = await getAsync(`
    SELECT c.*, COALESCE(cl.balance, 0) as currentBalance
    FROM customers c
    LEFT JOIN (
      SELECT customerId, balance
      FROM customer_ledger
      WHERE customerId = ?
      ORDER BY id DESC
      LIMIT 1
    ) cl ON c.id = cl.customerId
    WHERE c.id = ?
  `, [customerId, customerId]);
  return customer;
};

export const updateCustomerInDb = async (customerId: number, customerData: CustomerPayload): Promise<any> => {
  await getDbInstance();
  const { fullName, phoneNumber, address, notes } = customerData;
  try {
    await runAsync(
      `UPDATE customers SET fullName = ?, phoneNumber = ?, address = ?, notes = ? WHERE id = ?`,
      [fullName, phoneNumber || null, address || null, notes || null, customerId]
    );
    return await getCustomerByIdFromDb(customerId);
  } catch (err: any) {
    if (err.message.includes('UNIQUE constraint failed: customers.phoneNumber')) {
      throw new Error('این شماره تماس قبلا برای مشتری دیگری ثبت شده است.');
    }
    throw new Error(`خطای پایگاه داده: ${err.message}`);
  }
};

export const deleteCustomerFromDb = async (customerId: number): Promise<boolean> => {
  await getDbInstance();
  const result = await runAsync(`DELETE FROM customers WHERE id = ?`, [customerId]);
  return result.changes > 0;
};

export const getLedgerForCustomerFromDb = async (customerId: number): Promise<any[]> => {
  await getDbInstance();
  return await allAsync(
    `SELECT * FROM customer_ledger WHERE customerId = ? ORDER BY transactionDate ASC, id ASC`,
    [customerId]
  );
};

// --- Partners ---
export const addPartnerToDb = async (partnerData: PartnerPayload): Promise<any> => {
  await getDbInstance();
  const { partnerName, partnerType, contactPerson, phoneNumber, email, address, notes } = partnerData;
  try {
    const result = await runAsync(
      `INSERT INTO partners (partnerName, partnerType, contactPerson, phoneNumber, email, address, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [partnerName, partnerType, contactPerson || null, phoneNumber || null, email || null, address || null, notes || null]
    );
    return await getAsync("SELECT * FROM partners WHERE id = ?", [result.lastID]);
  } catch (err: any) {
    if (err.message.includes('UNIQUE constraint failed: partners.phoneNumber')) {
      throw new Error('این شماره تماس قبلا برای همکار دیگری ثبت شده است.');
    }
    throw new Error(`خطای پایگاه داده: ${err.message}`);
  }
};

export const getAllPartnersWithBalanceFromDb = async (partnerType?: string): Promise<any[]> => {
  await getDbInstance();
  let sql = `
    SELECT p.*, COALESCE(pl.balance, 0) as currentBalance
    FROM partners p
    LEFT JOIN (
      SELECT partnerId, balance
      FROM partner_ledger
      ORDER BY id DESC
    ) pl ON p.id = pl.partnerId
    GROUP BY p.id
  `;
  const params: any[] = [];
  if (partnerType) {
    sql += " HAVING p.partnerType = ?";
    params.push(partnerType);
  }
  sql += " ORDER BY p.partnerName ASC";

  return await allAsync(sql, params);
};

export const getPartnerByIdFromDb = async (partnerId: number): Promise<any> => {
  await getDbInstance();
  return await getAsync(`
    SELECT p.*, COALESCE(pl.balance, 0) as currentBalance
    FROM partners p
    LEFT JOIN (
      SELECT partnerId, balance
      FROM partner_ledger
      WHERE partnerId = ?
      ORDER BY id DESC
      LIMIT 1
    ) pl ON p.id = pl.partnerId
    WHERE p.id = ?
  `, [partnerId, partnerId]);
};

export const updatePartnerInDb = async (partnerId: number, partnerData: PartnerPayload): Promise<any> => {
  await getDbInstance();
  const { partnerName, partnerType, contactPerson, phoneNumber, email, address, notes } = partnerData;
   try {
    await runAsync(
      `UPDATE partners SET partnerName = ?, partnerType = ?, contactPerson = ?, phoneNumber = ?, email = ?, address = ?, notes = ? 
       WHERE id = ?`,
      [partnerName, partnerType, contactPerson || null, phoneNumber || null, email || null, address || null, notes || null, partnerId]
    );
    return await getPartnerByIdFromDb(partnerId);
  } catch (err: any) {
    if (err.message.includes('UNIQUE constraint failed: partners.phoneNumber')) {
      throw new Error('این شماره تماس قبلا برای همکار دیگری ثبت شده است.');
    }
     if (err.message.includes('NOT NULL constraint failed: partners.partnerName') || err.message.includes('NOT NULL constraint failed: partners.partnerType')) {
      throw new Error('نام همکار و نوع همکار نمی‌توانند خالی باشند.');
    }
    throw new Error(`خطای پایگاه داده: ${err.message}`);
  }
};

export const deletePartnerFromDb = async (partnerId: number): Promise<boolean> => {
  await getDbInstance();
  const result = await runAsync(`DELETE FROM partners WHERE id = ?`, [partnerId]);
  return result.changes > 0;
};

export const addPartnerLedgerEntryToDb = async (partnerId: number, entryData: LedgerEntryPayload): Promise<any> => {
  await getDbInstance();
  const { description, debit, credit, transactionDate } = entryData;
  return await addPartnerLedgerEntryInternal(partnerId, description, debit, credit, transactionDate);
};

export const getLedgerForPartnerFromDb = async (partnerId: number): Promise<any[]> => {
  await getDbInstance();
  return await allAsync(
    `SELECT * FROM partner_ledger WHERE partnerId = ? ORDER BY transactionDate ASC, id ASC`,
    [partnerId]
  );
};

export const getPurchasedItemsFromPartnerDb = async (partnerId: number): Promise<any[]> => {
    await getDbInstance();
    const products = await allAsync(
      `SELECT id, name, purchasePrice, date_added as purchaseDate, 'product' as type 
       FROM products 
       WHERE supplierId = ?`, [partnerId]
    );
    const phones = await allAsync(
      `SELECT id, model as name, imei as identifier, purchasePrice, purchaseDate, 'phone' as type 
       FROM phones 
       WHERE supplierId = ?`, [partnerId]
    );
    return [...products, ...phones].sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
};

// --- Reports ---
export const getSalesSummaryAndProfit = async (fromDateShamsi: string, toDateShamsi: string): Promise<FrontendSalesSummaryData> => {
  await getDbInstance();
  const fromDateISO = moment(fromDateShamsi, 'jYYYY/jMM/jDD').format('YYYY-MM-DD');
  const toDateISO = moment(toDateShamsi, 'jYYYY/jMM/jDD').format('YYYY-MM-DD');

  const sales = await allAsync(
    `SELECT st.totalPrice, st.quantity, st.itemId, st.itemType, st.transactionDate,
            p.purchasePrice as productPurchasePrice, ph.purchasePrice as phonePurchasePrice
     FROM sales_transactions st
     LEFT JOIN products p ON st.itemType = 'inventory' AND st.itemId = p.id
     LEFT JOIN phones ph ON st.itemType = 'phone' AND st.itemId = ph.id
     WHERE st.transactionDate BETWEEN ? AND ?`,
    [fromDateISO, toDateISO]
  );

  let totalRevenue = 0;
  let totalCostOfGoodsSold = 0;

  sales.forEach(sale => {
    totalRevenue += sale.totalPrice;
    if (sale.itemType === 'inventory' && sale.productPurchasePrice !== null) {
      totalCostOfGoodsSold += sale.productPurchasePrice * sale.quantity;
    } else if (sale.itemType === 'phone' && sale.phonePurchasePrice !== null) {
      totalCostOfGoodsSold += sale.phonePurchasePrice * sale.quantity; // Quantity is always 1 for phones here
    }
  });

  const grossProfit = totalRevenue - totalCostOfGoodsSold;
  const totalTransactions = sales.length;
  const averageSaleValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  // Daily sales data
  const dailySalesQuery = `
    SELECT transactionDate as date, SUM(totalPrice) as totalSales
    FROM sales_transactions
    WHERE transactionDate BETWEEN ? AND ?
    GROUP BY transactionDate
    ORDER BY transactionDate ASC
  `;
  const dailySales: DailySalesPoint[] = await allAsync(dailySalesQuery, [fromDateISO, toDateISO]);


  // Top selling items (by revenue)
  const topItemsQuery = `
    SELECT itemId, itemType, itemName, SUM(totalPrice) as totalRevenue, SUM(quantity) as quantitySold
    FROM sales_transactions
    WHERE transactionDate BETWEEN ? AND ?
    GROUP BY itemId, itemType, itemName
    ORDER BY totalRevenue DESC
    
  `;
  const topItemsRaw = await allAsync(topItemsQuery, [fromDateISO, toDateISO]);
  const topSellingItems: TopSellingItem[] = topItemsRaw.map(item => ({
    id: item.itemId,
    itemType: item.itemType,
    itemName: item.itemName,
    totalRevenue: item.totalRevenue,
    quantitySold: item.quantitySold,
  }));


  return { totalRevenue, grossProfit, totalTransactions, averageSaleValue, dailySales, topSellingItems };
};

export const getDebtorsList = async (): Promise<FrontendDebtorReportItem[]> => {
  await getDbInstance();
  return await allAsync(`
    SELECT c.id, c.fullName, c.phoneNumber, cl.balance
    FROM customers c
    JOIN (
      SELECT customerId, balance, ROW_NUMBER() OVER (PARTITION BY customerId ORDER BY id DESC) as rn
      FROM customer_ledger
    ) cl ON c.id = cl.customerId AND cl.rn = 1
    WHERE cl.balance > 0
    ORDER BY cl.balance DESC
  `);
};

export const getCreditorsList = async (): Promise<FrontendCreditorReportItem[]> => {
  await getDbInstance();
  return await allAsync(`
    SELECT p.id, p.partnerName, p.partnerType, pl.balance
    FROM partners p
    JOIN (
      SELECT partnerId, balance, ROW_NUMBER() OVER (PARTITION BY partnerId ORDER BY id DESC) as rn
      FROM partner_ledger
    ) pl ON p.id = pl.partnerId AND pl.rn = 1
    WHERE pl.balance > 0 
    ORDER BY pl.balance DESC
  `);
};

export const getTopCustomersBySales = async (fromDateShamsi: string, toDateShamsi: string): Promise<FrontendTopCustomerReportItem[]> => {
  await getDbInstance();
  const fromDateISO = moment(fromDateShamsi, 'jYYYY/jMM/jDD').format('YYYY-MM-DD');
  const toDateISO = moment(toDateShamsi, 'jYYYY/jMM/jDD').format('YYYY-MM-DD');
  return await allAsync(`
    SELECT st.customerId, c.fullName, SUM(st.totalPrice) as totalSpent, COUNT(st.id) as transactionCount
    FROM sales_transactions st
    JOIN customers c ON st.customerId = c.id
    WHERE st.transactionDate BETWEEN ? AND ? AND st.customerId IS NOT NULL
    GROUP BY st.customerId, c.fullName
    ORDER BY totalSpent DESC
    LIMIT 20
  `, [fromDateISO, toDateISO]);
};

export const getTopSuppliersByPurchaseValue = async (fromDateISO: string, toDateISO: string): Promise<FrontendTopSupplierReportItem[]> => {
  await getDbInstance();
  // This query sums purchase prices from 'products' and 'phones' tables based on date_added/purchaseDate.
  // It's a simplified approach. A more accurate way would be to sum actual ledger entries (credits to supplier)
  // for purchases, but that requires ledger entries to consistently reference product/phone IDs.
  // The current ledger entry system for purchases is good, so we can leverage that.
  
  const query = `
    SELECT
        p.id as partnerId,
        p.partnerName,
        SUM(pl.credit) as totalPurchaseValue,
        COUNT(DISTINCT pl.id) as transactionCount -- Count ledger entries representing purchases
    FROM partners p
    JOIN partner_ledger pl ON p.id = pl.partnerId
    WHERE p.partnerType = 'Supplier'
      AND pl.credit > 0 -- Considering credit entries as value received from supplier
      AND (pl.referenceType = 'product_purchase' OR pl.referenceType = 'phone_purchase' OR pl.referenceType = 'product_purchase_edit' OR pl.referenceType = 'phone_purchase_edit')
      AND DATE(pl.transactionDate) BETWEEN DATE(?) AND DATE(?)
    GROUP BY p.id, p.partnerName
    ORDER BY totalPurchaseValue DESC
    LIMIT 20;
  `;
  return await allAsync(query, [fromDateISO, toDateISO]);
};

export const getPhoneSalesReport = async (fromDateISO: string, toDateISO: string): Promise<PhoneSaleProfitReportItem[]> => {
  await getDbInstance();
  const query = `
    SELECT
        st.id as transactionId,
        st.transactionDate,
        c.fullName as customerFullName,
        ph.model as phoneModel,
        ph.imei,
        ph.purchasePrice,
        st.totalPrice,
        (st.totalPrice - ph.purchasePrice) as profit
    FROM sales_transactions st
    JOIN phones ph ON st.itemId = ph.id AND st.itemType = 'phone'
    LEFT JOIN customers c ON st.customerId = c.id
    WHERE st.transactionDate BETWEEN ? AND ?
    ORDER BY st.transactionDate DESC;
  `;
  return await allAsync(query, [fromDateISO, toDateISO]);
};

export const getPhoneInstallmentSalesReport = async (fromDateISO: string, toDateISO: string): Promise<PhoneInstallmentSaleProfitReportItem[]> => {
    await getDbInstance();
    const query = `
        SELECT
            isale.id as saleId,
            isale.dateCreated,
            c.fullName as customerFullName,
            ph.model as phoneModel,
            ph.imei,
            ph.purchasePrice,
            isale.actualSalePrice,
            (isale.actualSalePrice - ph.purchasePrice) as totalProfit
        FROM installment_sales isale
        JOIN phones ph ON isale.phoneId = ph.id
        JOIN customers c ON isale.customerId = c.id
        WHERE DATE(isale.dateCreated) BETWEEN ? AND ?
        ORDER BY isale.dateCreated DESC;
    `;
    return await allAsync(query, [fromDateISO, toDateISO]);
};
// ---------- Invoice (تک فروش) ----------
export const getInvoiceDataById = async (
  saleId: number
): Promise<FrontendInvoiceData | null> => {
  await getDbInstance();

  const sale = await getAsync(
    `SELECT st.*, c.fullName  as customerFullName,
            c.phoneNumber    as customerPhone,
            c.address        as customerAddress
       FROM sales_transactions st
       LEFT JOIN customers c ON st.customerId = c.id
      WHERE st.id = ?`,
    [saleId]
  );
  if (!sale) return null;

  /* تنظیمات فروشگاه */
  const settings = await getAllSettingsAsObject();
  const businessDetails = {
    name: settings.store_name || "فروشگاه شما",
    addressLine1: settings.store_address_line1 || "",
    addressLine2: settings.store_address_line2 || "",
    cityStateZip: settings.store_city_state_zip || "",
    phone: settings.store_phone || "",
    email: settings.store_email || "",
    logoUrl: settings.store_logo_path ? `/uploads/${settings.store_logo_path}` : undefined,
  };

  /* مشخصات مشتری */
  const customerDetails = sale.customerId
    ? {
        id: sale.customerId,
        fullName: sale.customerFullName,
        phoneNumber: sale.customerPhone,
        address: sale.customerAddress,
      }
    : null;

  /* قلم فاکتور (totalPrice is net price for the line) */
  const lineItems = [
    {
      id: 1,
      description: sale.itemName,
      quantity: sale.quantity,
      unitPrice: sale.pricePerItem,
      totalPrice: sale.totalPrice, // Net price from DB: (qty * price) - discount
    },
  ];

  /* محاسبات برای خلاصه فاکتور */
  // Subtotal is the sum of gross prices (before discount)
  const subtotal       = sale.quantity * sale.pricePerItem;
  const discountAmount = sale.discount ?? 0;
  // Grand total is the final net price
  const grandTotal     = subtotal - discountAmount;

  // Sanity check: grandTotal should equal the net price from the database
  if (grandTotal !== sale.totalPrice) {
      console.warn(`Invoice ${sale.id} grandTotal mismatch! Calculated: ${grandTotal}, DB: ${sale.totalPrice}`);
  }


  return {
    businessDetails,
    customerDetails,
    invoiceMetadata: {
      invoiceNumber: String(sale.id),
      transactionDate: moment(sale.transactionDate, "YYYY-MM-DD")
        .locale("fa")
        .format("jYYYY/jMM/jDD"),
    },
    lineItems,
    financialSummary: { subtotal, discountAmount, grandTotal },
    notes: sale.notes,
  };
};


// ---------- Invoice (چند فروش در یک فاکتور) ----------
export const getInvoiceDataForSaleIds = async (
  saleIds: number[]
): Promise<FrontendInvoiceData | null> => {
  await getDbInstance();
  if (saleIds.length === 0) return null;

  const placeholders = saleIds.map(() => "?").join(",");
  const sales = await allAsync(
    `SELECT st.*, c.fullName  as customerFullName,
            c.phoneNumber    as customerPhone,
            c.address        as customerAddress
       FROM sales_transactions st
       LEFT JOIN customers c ON st.customerId = c.id
      WHERE st.id IN (${placeholders})
      ORDER BY st.id ASC`, // Consistent ordering
    saleIds
  );
  if (sales.length === 0) return null;

  /* تنظیمات فروشگاه */
  const settings = await getAllSettingsAsObject();
  const businessDetails = {
    name: settings.store_name || "فروشگاه شما",
    addressLine1: settings.store_address_line1 || "",
    cityStateZip: settings.store_city_state_zip || "",
    phone: settings.store_phone || "",
    email: settings.store_email || "",
    logoUrl: settings.store_logo_path ? `/uploads/${settings.store_logo_path}` : undefined,
  };

  /* مشخصات مشتری (از اولین فروش) */
  const firstSale = sales[0];
  const customerDetails = firstSale.customerId
    ? {
        id: firstSale.customerId,
        fullName: firstSale.customerFullName,
        phoneNumber: firstSale.customerPhone,
        address: firstSale.customerAddress,
      }
    : null;

  /* اقلام فاکتور (totalPrice is net price for the line) */
  const lineItems = sales.map((s, idx) => ({
    id: idx + 1,
    description: s.itemName,
    quantity: s.quantity,
    unitPrice: s.pricePerItem,
    totalPrice: s.totalPrice, // Net price from DB: (qty * price) - discount
  }));

  /* محاسبات برای خلاصه فاکتور */
  // Subtotal is the sum of gross prices (before discount)
  const subtotal = sales.reduce((sum, s) => sum + s.quantity * s.pricePerItem, 0);
  // Discount is the sum of all individual discounts
  const discountAmount = sales.reduce((sum, s) => sum + (s.discount || 0), 0);
  // Grand total is the final net price
  const grandTotal = subtotal - discountAmount;

  // Sanity check: grandTotal should equal the sum of net prices from the database
  const grandTotalCheck = sales.reduce((sum, s) => sum + s.totalPrice, 0);
  if (Math.abs(grandTotal - grandTotalCheck) > 0.001) { // Use tolerance for float comparison
      console.warn(`Invoice ${saleIds.join(',')} grandTotal mismatch! Calculated: ${grandTotal}, DB Sum: ${grandTotalCheck}`);
  }

  // Use notes from all sales, combined.
  const notes = sales.map(s => s.notes).filter(Boolean).join('\n---\n');

  return {
    businessDetails,
    customerDetails,
    invoiceMetadata: {
      invoiceNumber: saleIds.join(", "), // «مرجع» فاکتور
      transactionDate: moment(firstSale.transactionDate, "YYYY-MM-DD")
        .locale("fa")
        .format("jYYYY/jMM/jDD"),
    },
    lineItems,
    financialSummary: { subtotal, discountAmount, grandTotal },
    notes: notes,
  };
};


export async function createInvoice(invoiceData: any): Promise<number> {
  await getDbInstance(); // اطمینان از اتصال
  const subtotal = invoiceData.lineItems.reduce(
    (sum: number, item: any) => sum + (item.unitPrice || 0) * (item.quantity || 0),
    0
  );
  const discount = invoiceData.financialSummary?.discountAmount || 0;
  const grandTotal = subtotal - discount;

  const result = await runAsync(
    `INSERT INTO invoices 
      (invoiceNumber, customerId, date, subtotal, discountAmount, grandTotal, notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      invoiceData.invoiceNumber || `INV-${Date.now()}`, // شماره فاکتور یکتا
      invoiceData.customerId || null,
      invoiceData.date,
      subtotal,
      discount,
      grandTotal,
      invoiceData.notes || '',
    ]
  );

  const invoiceId = result.lastID;

  for (const item of invoiceData.lineItems) {
    await runAsync(
      `INSERT INTO invoice_items 
        (invoiceId, description, quantity, unitPrice, totalPrice, itemType, itemId) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceId,
        item.description,
        item.quantity,
        item.unitPrice,
        (item.unitPrice || 0) * (item.quantity || 0),
        item.itemType || null,
        item.itemId || null
      ]
    );
  }

  return invoiceId;
}

// --- Settings ---
export const getAllSettingsAsObject = async (): Promise<Record<string, string>> => {
  await getDbInstance();
  const settingsArray = await allAsync("SELECT key, value FROM settings");
  return settingsArray.reduce((obj, item) => {
    obj[item.key] = item.value;
    return obj;
  }, {});
};

export const updateMultipleSettings = async (settings: SettingItem[]): Promise<void> => {
  await getDbInstance();
  await execAsync("BEGIN TRANSACTION;");
  try {
    for (const setting of settings) {
      await runAsync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        [setting.key, setting.value]
      );
    }
    await execAsync("COMMIT;");
  } catch (err: any) {
    await execAsync("ROLLBACK;");
    throw new Error(`خطای پایگاه داده در به‌روزرسانی تنظیمات: ${err.message}`);
  }
};

export const updateSetting = async (key: string, value: string): Promise<void> => {
    await getDbInstance();
    await runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value]);
};

// --- Users and Roles ---
export const getAllRoles = async (): Promise<FrontendRole[]> => {
  await getDbInstance();
  return await allAsync("SELECT * FROM roles ORDER BY name ASC");
};

export const addUserToDb = async (username: string, passwordPlain: string, roleId: number): Promise<Omit<UserForDb, 'passwordHash' | 'roleName'>> => {
  await getDbInstance();
  const existingUser = await getAsync("SELECT id FROM users WHERE username = ?", [username]);
  if (existingUser) throw new Error("نام کاربری قبلا استفاده شده است.");
  
  const passwordHash = await bcryptjs.hash(passwordPlain, 10);
  const result = await runAsync(
    "INSERT INTO users (username, passwordHash, roleId) VALUES (?, ?, ?)",
    [username, passwordHash, roleId]
  );
  return { id: result.lastID, username, roleId, dateAdded: new Date().toISOString() };
};

export const updateUserInDb = async (userId: number, data: UserUpdatePayload): Promise<Omit<UserForDb, 'passwordHash'>> => {
  await getDbInstance();
  const user = await getAsync("SELECT * FROM users WHERE id = ?", [userId]);
  if (!user) throw new Error("کاربر یافت نشد.");
  if (user.username === 'admin' && data.roleId && (await getAsync("SELECT name FROM roles WHERE id = ?", [data.roleId]))?.name !== ADMIN_ROLE_NAME) {
      throw new Error("نقش کاربر مدیر اصلی (admin) قابل تغییر نیست مگر به نقش مدیر دیگری.");
  }

  const fieldsToUpdate: string[] = [];
  const params: any[] = [];

  if (data.roleId !== undefined) {
    fieldsToUpdate.push("roleId = ?");
    params.push(data.roleId);
  }

  if (fieldsToUpdate.length === 0) {
    const role = await getAsync("SELECT name FROM roles WHERE id = ?", [user.roleId]);
    return { id: user.id, username: user.username, roleId: user.roleId, roleName: role.name, dateAdded: user.dateAdded, avatarPath: user.avatarPath };
  }

  params.push(userId);
  await runAsync(`UPDATE users SET ${fieldsToUpdate.join(", ")} WHERE id = ?`, params);
  const updatedUser = await getAsync("SELECT id, username, roleId, dateAdded, avatarPath FROM users WHERE id = ?", [userId]);
  const role = await getAsync("SELECT name FROM roles WHERE id = ?", [updatedUser.roleId]);
  return { ...updatedUser, roleName: role.name };
};

export const deleteUserFromDb = async (userId: number): Promise<boolean> => {
  await getDbInstance();
  const user = await getAsync("SELECT username FROM users WHERE id = ?", [userId]);
  if (!user) throw new Error("کاربر یافت نشد.");
  if (user.username === 'admin') throw new Error("امکان حذف کاربر مدیر اصلی (admin) وجود ندارد.");
  
  const result = await runAsync("DELETE FROM users WHERE id = ?", [userId]);
  return result.changes > 0;
};

export const getAllUsersWithRoles = async (): Promise<FrontendUserForDisplay[]> => {
  await getDbInstance();
  const usersFromDb = await allAsync(`
    SELECT u.id, u.username, u.roleId, r.name as roleName, u.dateAdded, u.avatarPath
    FROM users u
    JOIN roles r ON u.roleId = r.id
    ORDER BY u.username ASC
  `);
  return usersFromDb.map(user => ({
      id: user.id,
      username: user.username,
      roleId: user.roleId,
      roleName: user.roleName,
      dateAdded: user.dateAdded,
      avatarUrl: user.avatarPath ? `/uploads/avatars/${user.avatarPath}` : null,
  }));
};

export const findUserByUsername = async (username: string): Promise<UserForDb | null> => {
  await getDbInstance();
  const userRow = await getAsync(
    `SELECT u.id, u.username, u.passwordHash, u.roleId, r.name as roleName, u.dateAdded, u.avatarPath
     FROM users u
     JOIN roles r ON u.roleId = r.id
     WHERE u.username = ?`, [username]
  );
  return userRow || null;
};

export const changePasswordInDb = async (userId: number, { oldPassword, newPassword }: ChangePasswordPayload): Promise<boolean> => {
    await getDbInstance();
    const user = await getAsync("SELECT passwordHash FROM users WHERE id = ?", [userId]);
    if (!user) throw new Error("کاربر یافت نشد.");

    const isMatch = await bcryptjs.compare(oldPassword, user.passwordHash);
    if (!isMatch) throw new Error("کلمه عبور فعلی نامعتبر است.");

    const newPasswordHash = await bcryptjs.hash(newPassword, 10);
    const result = await runAsync("UPDATE users SET passwordHash = ? WHERE id = ?", [newPasswordHash, userId]);
    return result.changes > 0;
};

export const resetUserPasswordInDb = async (userId: number, newPasswordPlain: string): Promise<boolean> => {
    await getDbInstance();
    const user = await getAsync("SELECT id, username FROM users WHERE id = ?", [userId]);
    if (!user) throw new Error("کاربر برای تغییر رمز عبور یافت نشد.");
   

    const newPasswordHash = await bcryptjs.hash(newPasswordPlain, 10);
    const result = await runAsync("UPDATE users SET passwordHash = ? WHERE id = ?", [newPasswordHash, userId]);
    return result.changes > 0;
};


export const updateAvatarPathInDb = async (userId: number, avatarPath: string): Promise<UserForDb> => {
    await getDbInstance();
    await runAsync("UPDATE users SET avatarPath = ? WHERE id = ?", [avatarPath, userId]);
    const updatedUser = await getAsync("SELECT * FROM users WHERE id = ?", [userId]);
    const role = await getAsync("SELECT name FROM roles WHERE id = ?", [updatedUser.roleId]);
    return { ...updatedUser, roleName: role.name };
};

/// --- Dashboard ---
export const getDashboardKPIs = async (): Promise<FrontendDashboardKPIs> => {
  await getDbInstance();

  // تاریخ‌ها با جلالی و مقایسه‌ی ایمن در SQLite
  const todayISO = moment().format('YYYY-MM-DD');
  const firstDayOfMonthISO = moment().startOf('jMonth').format('YYYY-MM-DD');
  const lastDayOfMonthISO  = moment().endOf('jMonth').format('YYYY-MM-DD');

  // فروش ماهانه: تراکنش‌های نقدی + سفارش‌ها
  const monthCash = await getAsync(
    "SELECT COALESCE(SUM(totalPrice),0) AS total FROM sales_transactions WHERE date(transactionDate) BETWEEN date(?) AND date(?)",
    [firstDayOfMonthISO, lastDayOfMonthISO]
  );
  const monthOrders = await getAsync(
    "SELECT COALESCE(SUM(grandTotal),0) AS total FROM sales_orders WHERE date(transactionDate) BETWEEN date(?) AND date(?)",
    [firstDayOfMonthISO, lastDayOfMonthISO]
  );

  // فروش امروز: تراکنش‌های نقدی + سفارش‌ها
  const todayCash = await getAsync(
    "SELECT COALESCE(SUM(totalPrice),0) AS total FROM sales_transactions WHERE date(transactionDate)=date(?)",
    [todayISO]
  );
  const todayOrders = await getAsync(
    "SELECT COALESCE(SUM(grandTotal),0) AS total FROM sales_orders WHERE date(transactionDate)=date(?)",
    [todayISO]
  );

  // شمارش‌ها
  const activeProductsCountRes = await getAsync(
    "SELECT COALESCE(COUNT(id),0) AS count FROM products WHERE stock_quantity > 0"
  );
  const activePhonesCountRes = await getAsync(
    "SELECT COALESCE(COUNT(id),0) AS count FROM phones WHERE status = 'موجود در انبار'"
  );
  const totalCustomersCountRes = await getAsync(
    "SELECT COALESCE(COUNT(id),0) AS count FROM customers"
  );

  // مجموع کل تاریخ (نقد + اقساط + سفارش‌ها)
  const totalCashSalesRes        = await getAsync("SELECT COALESCE(SUM(totalPrice),0) AS total FROM sales_transactions");
  const totalInstallmentSalesRes = await getAsync("SELECT COALESCE(SUM(actualSalePrice),0) AS total FROM installment_sales");
  const totalOrdersRes           = await getAsync("SELECT COALESCE(SUM(grandTotal),0) AS total FROM sales_orders");
  const totalSalesAllTime =
    (totalCashSalesRes?.total || 0) +
    (totalInstallmentSalesRes?.total || 0) +
    (totalOrdersRes?.total || 0);

  return {
    totalSalesMonth: (monthCash?.total || 0) + (monthOrders?.total || 0),
    revenueToday:    (todayCash?.total || 0) + (todayOrders?.total || 0),
    activeProductsCount: (activeProductsCountRes?.count || 0) + (activePhonesCountRes?.count || 0),
    totalCustomersCount: totalCustomersCountRes?.count || 0,
    totalSalesAllTime
  };
};


export const getDashboardSalesChartData = async (period: string): Promise<FrontendSalesDataPoint[]> => {
    await getDbInstance();
    let groupByFormat: string;
    let dateModifier: string;
    let dateFormatFn: (date: string) => string;

    switch (period) {
        case 'weekly':
            // Last 7 days, including today
            dateModifier = '-6 days'; // Go back 6 days to get a total of 7 days (including today)
            groupByFormat = '%Y-%m-%d'; // Group by day
            dateFormatFn = (dateISO: string) => moment(dateISO).locale('fa').format('dddd'); // Shamsi day name
            break;
        case 'yearly':
            // Last 12 months, including current month
            dateModifier = '-11 months'; // Go back 11 months for 12 total months
            groupByFormat = '%Y-%m'; // Group by month
            dateFormatFn = (dateYearMonth: string) => moment(dateYearMonth + "-01").locale('fa').format('jMMMM'); // Shamsi month name
            break;
        case 'monthly':
        default:
            // Current Shamsi month, daily
            const startOfMonthShamsi = moment().startOf('jMonth');
            const endOfMonthShamsi = moment().endOf('jMonth');
             const sales = await allAsync(
                `SELECT strftime('%Y-%m-%d', transactionDate) as date_group, SUM(totalPrice) as sales
                 FROM sales_transactions
                 WHERE transactionDate BETWEEN ? AND ?
                 GROUP BY date_group
                 ORDER BY date_group ASC`,
                 [startOfMonthShamsi.format('YYYY-MM-DD'), endOfMonthShamsi.format('YYYY-MM-DD')]
            );
            return sales.map(s => ({ name: moment(s.date_group).locale('fa').format('jD'), sales: s.sales }));
    }

    const sales = await allAsync(
        `SELECT strftime('${groupByFormat}', transactionDate) as date_group, SUM(totalPrice) as sales
         FROM sales_transactions
         WHERE transactionDate >= date('now', '${dateModifier}') 
         GROUP BY date_group
         ORDER BY date_group ASC`
    );
    return sales.map(s => ({ name: dateFormatFn(s.date_group), sales: s.sales }));
};


export const getDashboardRecentActivities = async (): Promise<FrontendActivityItem[]> => {
    await getDbInstance();
    const sales = await allAsync(
        `SELECT st.id, st.itemName, st.totalPrice, st.transactionDate, c.fullName as customerName 
         FROM sales_transactions st 
         LEFT JOIN customers c ON st.customerId = c.id
         ORDER BY st.id DESC LIMIT 3`
    );
    const newProducts = await allAsync("SELECT id, name, date_added FROM products ORDER BY id DESC LIMIT 2");
    const newPhones = await allAsync("SELECT id, model, registerDate FROM phones ORDER BY id DESC LIMIT 2");

    const activities: FrontendActivityItem[] = [];
    sales.forEach(s => activities.push({
        id: `sale-${s.id}`,
        typeDescription: "فروش جدید",
        details: `${s.itemName} به ${s.customerName || 'مهمان'} به ارزش ${s.totalPrice.toLocaleString('fa-IR')} تومان`,
        timestamp: moment(s.transactionDate).toISOString(), 
        icon: "fa-solid fa-cash-register",
        color: "bg-green-500",
        link: `/invoices/${s.id}`
    }));
    newProducts.forEach(p => activities.push({
        id: `product-${p.id}`,
        typeDescription: "محصول جدید",
        details: `${p.name} اضافه شد`,
        timestamp: p.date_added,
        icon: "fa-solid fa-box",
        color: "bg-blue-500",
        link: `/products` 
    }));
     newPhones.forEach(ph => activities.push({
        id: `phone-${ph.id}`,
        typeDescription: "گوشی جدید",
        details: `${ph.model} اضافه شد`,
        timestamp: ph.registerDate,
        icon: "fa-solid fa-mobile-screen",
        color: "bg-purple-500",
        link: `/mobile-phones`
    }));

    return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);
};


// --- Installment Sales ---
export const addInstallmentSaleToDb = async (saleData: InstallmentSalePayload): Promise<any> => {
  await getDbInstance();
  const { customerId, phoneId, actualSalePrice, downPayment, numberOfInstallments, installmentAmount, installmentsStartDate, checks, notes } = saleData;

  try {
    await execAsync("BEGIN TRANSACTION;");

    const phone = await getAsync("SELECT status FROM phones WHERE id = ?", [phoneId]);
    if (!phone) throw new Error('گوشی مورد نظر یافت نشد.');
    if (phone.status !== 'موجود در انبار') throw new Error('این گوشی قبلاً فروخته شده یا در دسترس نیست.');
    
    const saleResult = await runAsync(
      `INSERT INTO installment_sales (customerId, phoneId, actualSalePrice, downPayment, numberOfInstallments, installmentAmount, installmentsStartDate, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [customerId, phoneId, actualSalePrice, downPayment, numberOfInstallments, installmentAmount, installmentsStartDate, notes]
    );
    const saleId = saleResult.lastID;

    // Create payment records
    let currentDueDate = moment(installmentsStartDate, 'jYYYY/jMM/DD');
    for (let i = 0; i < numberOfInstallments; i++) {
      await runAsync(
        `INSERT INTO installment_payments (saleId, installmentNumber, dueDate, amountDue) VALUES (?, ?, ?, ?)`,
        [saleId, i + 1, currentDueDate.locale('fa').format('YYYY/MM/DD'), installmentAmount]
      );
      currentDueDate.add(1, 'jMonth');
    }

    // Add checks
    for (const check of checks) {
      await runAsync(
        `INSERT INTO installment_checks (saleId, checkNumber, bankName, dueDate, amount, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [saleId, check.checkNumber, check.bankName, check.dueDate, check.amount, check.status || 'نزد مشتری']
      );
    }
    
    // Update phone status and saleDate
    const saleDateISO = moment(installmentsStartDate, 'jYYYY/jMM/jDD').format('YYYY-MM-DD'); // Use start date as sale date for phone record
    await runAsync("UPDATE phones SET status = 'فروخته شده (قسطی)', saleDate = ? WHERE id = ?", [saleDateISO, phoneId]);

    // Add ledger entry for customer if downPayment > 0 or total debt > 0
    const totalDebt = actualSalePrice - downPayment;
    if (totalDebt > 0) {
        const ledgerDescription = `خرید اقساطی موبایل (شناسه فروش: ${saleId}), مبلغ کل: ${actualSalePrice.toLocaleString('fa-IR')}, پیش پرداخت: ${downPayment.toLocaleString('fa-IR')}`;
        await addCustomerLedgerEntryInternal(customerId, ledgerDescription, totalDebt, 0, new Date().toISOString());
    } else if (downPayment > 0 && totalDebt <= 0) { // Paid in full with downpayment (though unlikely for installment)
         const ledgerDescription = `خرید موبایل (شناسه فروش اقساطی: ${saleId}), پرداخت کامل با پیش پرداخت`;
         await addCustomerLedgerEntryInternal(customerId, ledgerDescription, actualSalePrice, actualSalePrice, new Date().toISOString()); // Debit and Credit same
    }


    await execAsync("COMMIT;");
    return await getInstallmentSaleByIdFromDb(saleId); // Fetch the newly created sale with all details

  } catch (err: any) {
    await execAsync("ROLLBACK;");
    console.error('DB Error (addInstallmentSaleToDb):', err);
    throw err;
  }
};

export const getAllInstallmentSalesFromDb = async (): Promise<FrontendInstallmentSale[]> => {
  await getDbInstance();
  const salesFromDb = await allAsync(`
    SELECT 
        isale.*, 
        c.fullName as customerFullName, 
        p.model as phoneModel, 
        p.imei as phoneImei,
        (isale.numberOfInstallments * isale.installmentAmount) + isale.downPayment as totalInstallmentPrice
    FROM installment_sales isale
    JOIN customers c ON isale.customerId = c.id
    JOIN phones p ON isale.phoneId = p.id
    ORDER BY isale.dateCreated DESC
  `);
  
  // برای هر فروش، وضعیت کلی و تاریخ قسط بعدی را محاسبه می‌کنیم
  const sales: FrontendInstallmentSale[] = [];
  for (const saleDb of salesFromDb) {
    const payments = await allAsync("SELECT * FROM installment_payments WHERE saleId = ? ORDER BY installmentNumber ASC", [saleDb.id]);
    let remainingAmount = saleDb.totalInstallmentPrice - saleDb.downPayment;
    let nextDueDate: string | null = null;
    let overallStatus: FrontendInstallmentSale["overallStatus"] = "در حال پرداخت";
    let allPaid = true;
    let hasOverdue = false;

    for (const payment of payments) {
      if (payment.status !== 'پرداخت شده') {
        allPaid = false;
        if (!nextDueDate) {
          nextDueDate = payment.dueDate; // اولین قسط پرداخت نشده
        }
        if (moment(payment.dueDate, 'jYYYY/jMM/jDD').isBefore(moment(), 'day')) {
          hasOverdue = true;
        }
      }
      
      // برای محاسبه مبلغ باقیمانده، مجموع پرداخت‌های جزئی را کم می‌کنیم
      const sumResult = await getAsync(
        `SELECT SUM(amount_paid) as totalPaid FROM installment_transactions WHERE installment_payment_id = ?`,
        [payment.id]
      );
      const totalPaidForInstallment = sumResult.totalPaid || 0;
      remainingAmount -= totalPaidForInstallment;
    }
    
    if (allPaid) {
      overallStatus = 'تکمیل شده';
    } else if (hasOverdue) {
      overallStatus = 'معوق';
    }
    
    sales.push({
        ...saleDb,
        payments: [], // در نمای لیست، نیازی به ارسال جزئیات پرداخت‌ها نیست
        checks: [],   // در نمای لیست، نیازی به ارسال جزئیات چک‌ها نیست
        remainingAmount: remainingAmount < 0 ? 0 : remainingAmount,
        nextDueDate,
        overallStatus,
    });
  }
  return sales;
};


export const getInstallmentSaleByIdFromDb = async (saleId: number): Promise<FrontendInstallmentSale | null> => {
  await getDbInstance();
  const saleDb = await getAsync(`
    SELECT 
        isale.*, 
        c.fullName as customerFullName, 
        p.model as phoneModel, 
        p.imei as phoneImei,
        (isale.numberOfInstallments * isale.installmentAmount) + isale.downPayment as totalInstallmentPrice
    FROM installment_sales isale
    JOIN customers c ON isale.customerId = c.id
    JOIN phones p ON isale.phoneId = p.id
    WHERE isale.id = ?
  `, [saleId]);

  if (!saleDb) return null;

  const payments = await allAsync("SELECT * FROM installment_payments WHERE saleId = ? ORDER BY installmentNumber ASC", [saleDb.id]);
  const checks = await allAsync("SELECT * FROM installment_checks WHERE saleId = ? ORDER BY dueDate ASC", [saleDb.id]);

  let remainingAmount = saleDb.totalInstallmentPrice - saleDb.downPayment;
  let nextDueDate: string | null = null;
  let overallStatus: FrontendInstallmentSale["overallStatus"] = "در حال پرداخت";
  let allPaid = true;
  let hasOverdue = false;

  for (const payment of payments) {
    if (payment.status !== 'پرداخت شده') {
      allPaid = false;
      if (!nextDueDate) nextDueDate = payment.dueDate;
      if (moment(payment.dueDate, 'jYYYY/jMM/jDD').isBefore(moment(), 'day')) {
        hasOverdue = true;
      }
    } else {
        remainingAmount -= payment.amountDue;
    }
  }
  if (allPaid) overallStatus = 'تکمیل شده';
  else if (hasOverdue) overallStatus = 'معوق';

  return {
      ...saleDb,
      payments,
      checks,
      remainingAmount: remainingAmount < 0 ? 0 : remainingAmount,
      nextDueDate,
      overallStatus,
  };
};

export const updateInstallmentPaymentStatusInDb = async (paymentId: number, paid: boolean, paymentDateShamsi?: string): Promise<boolean> => {
  await getDbInstance();
  const status = paid ? 'پرداخت شده' : 'پرداخت نشده';
  const paymentDate = paid && paymentDateShamsi ? paymentDateShamsi : null;

  const result = await runAsync(
    "UPDATE installment_payments SET status = ?, paymentDate = ? WHERE id = ?",
    [status, paymentDate, paymentId]
  );
  return result.changes > 0;
};

export const updateCheckStatusInDb = async (checkId: number, status: CheckStatus): Promise<boolean> => {
  await getDbInstance();
  const result = await runAsync(
    "UPDATE installment_checks SET status = ? WHERE id = ?",
    [status, checkId]
  );
  return result.changes > 0;
};

export const getInstallmentPaymentDetailsForSms = async (paymentId: number): Promise<any> => {
    await getDbInstance();
    // این تابع، تاریخ را که به صورت شمسی در دیتابیس ذخیره شده، مستقیما می‌خواند.
    // بنابراین نیازی به تبدیل مجدد نیست و تاریخ صحیح است.
    const query = `
        SELECT
            ip.id as paymentId,
            ip.dueDate,
            ip.amountDue,
            c.fullName as customerFullName,
            c.phoneNumber as customerPhoneNumber
        FROM installment_payments ip
        JOIN installment_sales isale ON ip.saleId = isale.id
        JOIN customers c ON isale.customerId = c.id
        WHERE ip.id = ?
    `;
    return await getAsync(query, [paymentId]);
};


// --- Smart Analysis (SQL-based) ---
export const getProfitabilityReportFromDb = async (): Promise<ProfitabilityAnalysisItem[]> => {
    await getDbInstance();
    const query = `
        SELECT
            st.itemId,
            st.itemType,
            st.itemName,
            SUM(st.quantity) as totalQuantitySold,
            SUM(st.totalPrice) as totalRevenue,
            SUM(
                CASE
                    WHEN st.itemType = 'inventory' THEN p.purchasePrice * st.quantity
                    WHEN st.itemType = 'phone' THEN ph.purchasePrice * st.quantity
                    ELSE 0
                END
            ) as totalCost,
            (SUM(st.totalPrice) - SUM(
                CASE
                    WHEN st.itemType = 'inventory' THEN p.purchasePrice * st.quantity
                    WHEN st.itemType = 'phone' THEN ph.purchasePrice * st.quantity
                    ELSE 0
                END
            )) as grossProfit,
            CASE
                WHEN SUM(st.totalPrice) = 0 THEN 0
                ELSE ((SUM(st.totalPrice) - SUM(
                    CASE
                        WHEN st.itemType = 'inventory' THEN p.purchasePrice * st.quantity
                        WHEN st.itemType = 'phone' THEN ph.purchasePrice * st.quantity
                        ELSE 0
                    END
                )) * 100.0 / SUM(st.totalPrice))
            END as profitMargin
        FROM sales_transactions st
        LEFT JOIN products p ON st.itemType = 'inventory' AND st.itemId = p.id
        LEFT JOIN phones ph ON st.itemType = 'phone' AND st.itemId = ph.id
        GROUP BY st.itemId, st.itemType, st.itemName
        ORDER BY grossProfit DESC;
    `;
    const result: ProfitabilityAnalysisItem[] = await allAsync(query);
    return result.map(item => ({
        ...item,
        profitMargin: parseFloat(Number(item.profitMargin).toFixed(2))
    }));
};

export const getInventoryVelocityReportFromDb = async (): Promise<VelocityItem[]> => {
    await getDbInstance();
    const query = `
        WITH ItemSales AS (
            SELECT
                itemId,
                itemType,
                SUM(quantity) as totalQuantitySold
            FROM sales_transactions
            GROUP BY itemId, itemType
        ),
        AllItems AS (
            SELECT
                id as itemId,
                'inventory' as itemType,
                name as itemName,
                date_added as registrationDate
            FROM products
            UNION ALL
            SELECT
                id as itemId,
                'phone' as itemType,
                model || ' (IMEI: ' || imei || ')' as itemName,
                registerDate as registrationDate
            FROM phones
        )
        SELECT
            ai.itemId,
            ai.itemType,
            ai.itemName,
            (COALESCE(s.totalQuantitySold, 0) * 1.0 / (MAX(1, (julianday('now') - julianday(ai.registrationDate))))) as salesPerDay,
            CASE
                WHEN (COALESCE(s.totalQuantitySold, 0) * 1.0 / (MAX(1, (julianday('now') - julianday(ai.registrationDate))))) > 0.5 THEN 'پرفروش (داغ)'
                WHEN (COALESCE(s.totalQuantitySold, 0) > 0) OR ((julianday('now') - julianday(ai.registrationDate)) <= 60) THEN 'عادی'
                ELSE 'کم‌فروش (راکد)'
            END as classification
        FROM AllItems ai
        LEFT JOIN ItemSales s ON ai.itemId = s.itemId AND ai.itemType = s.itemType
        ORDER BY salesPerDay DESC;
    `;
    return await allAsync(query);
};

export const getPurchaseSuggestionsReportFromDb = async (): Promise<Omit<PurchaseSuggestionItem, 'suggestedPurchaseQuantity'>[]> => {
    await getDbInstance();
    const query = `
        WITH ItemVelocity AS (
            SELECT
                ai.itemId,
                ai.itemType,
                (COALESCE(s.totalQuantitySold, 0) * 1.0 / (MAX(1, (julianday('now') - julianday(ai.registrationDate))))) as salesPerDay
            FROM (
                SELECT id as itemId, 'inventory' as itemType, date_added as registrationDate FROM products
                UNION ALL
                SELECT id as itemId, 'phone' as itemType, registerDate as registrationDate FROM phones
            ) ai
            LEFT JOIN (
                SELECT itemId, itemType, SUM(quantity) as totalQuantitySold FROM sales_transactions GROUP BY itemId, itemType
            ) s ON ai.itemId = s.itemId AND ai.itemType = s.itemType
            WHERE salesPerDay > 0
        ),
        StockLevels AS (
            SELECT id as itemId, 'inventory' as itemType, name as itemName, stock_quantity as currentStock FROM products WHERE stock_quantity > 0
            UNION ALL
            SELECT id as itemId, 'phone' as itemType, model || ' (IMEI: ' || imei || ')' as itemName, 1 as currentStock FROM phones WHERE status = 'موجود در انبار'
        )
        SELECT
            sl.itemId,
            iv.itemType,
            sl.itemName,
            sl.currentStock,
            iv.salesPerDay,
            (sl.currentStock / iv.salesPerDay) as daysOfStockLeft
        FROM StockLevels sl
        JOIN ItemVelocity iv ON sl.itemId = iv.itemId AND sl.itemType = iv.itemType
        WHERE (sl.currentStock / iv.salesPerDay) < 30 -- Reorder threshold: 30 days
        ORDER BY daysOfStockLeft ASC;
    `;
    return await allAsync(query);
};


// --- Repair Center ---
export const createRepairInDb = async (data: NewRepairData): Promise<any> => {
  await getDbInstance();
  const { customerId, deviceModel, deviceColor, serialNumber, problemDescription, estimatedCost } = data;
  const result = await runAsync(
    `INSERT INTO repairs (customerId, deviceModel, deviceColor, serialNumber, problemDescription, estimatedCost, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [customerId, deviceModel, deviceColor || null, serialNumber || null, problemDescription, estimatedCost || null, 'پذیرش شده']
  );
  return await getRepairByIdFromDb(result.lastID);
};

export const getAllRepairsFromDb = async (statusFilter?: string): Promise<FrontendRepair[]> => {
  await getDbInstance();
  let sql = `
    SELECT r.*, c.fullName as customerFullName, t.partnerName as technicianName
    FROM repairs r
    JOIN customers c ON r.customerId = c.id
    LEFT JOIN partners t ON r.technicianId = t.id
  `;
  const params = [];
  if (statusFilter) {
    sql += ' WHERE r.status = ?';
    params.push(statusFilter);
  }
  sql += ' ORDER BY r.dateReceived DESC';
  return await allAsync(sql, params);
};

export const getRepairByIdFromDb = async (repairId: number): Promise<any> => {
    await getDbInstance();
    const repair = await getAsync(
        `SELECT r.*, c.fullName as customerFullName, c.phoneNumber as customerPhoneNumber, t.partnerName as technicianName 
        FROM repairs r 
        JOIN customers c ON r.customerId = c.id 
        LEFT JOIN partners t ON r.technicianId = t.id
        WHERE r.id = ?`,
        [repairId]
    );
    if (!repair) return null;

    const parts = await allAsync(
        `SELECT rp.*, p.name as productName, p.sellingPrice as pricePerItem
         FROM repair_parts rp
         JOIN products p ON rp.productId = p.id
         WHERE rp.repairId = ?`,
        [repairId]
    );
    
    return { repair, parts };
};

export const updateRepairInDb = async (repairId: number, data: Partial<FrontendRepair>): Promise<any> => {
    await getDbInstance();
    const { status, technicianNotes, finalCost, technicianId, laborFee } = data;
    
    const existingRepair = await getAsync("SELECT * FROM repairs WHERE id = ?", [repairId]);
    if (!existingRepair) throw new Error("Repair not found");

    const fieldsToUpdate: string[] = [];
    const params: any[] = [];
    
    if (status) { fieldsToUpdate.push("status = ?"); params.push(status); }
    if (technicianNotes !== undefined) { fieldsToUpdate.push("technicianNotes = ?"); params.push(technicianNotes); }
    if (finalCost !== undefined) { fieldsToUpdate.push("finalCost = ?"); params.push(finalCost); }
    if (technicianId !== undefined) { fieldsToUpdate.push("technicianId = ?"); params.push(technicianId); }
    if (laborFee !== undefined) { fieldsToUpdate.push("laborFee = ?"); params.push(laborFee); }


    if (fieldsToUpdate.length === 0) return existingRepair;

    if (status === 'تحویل داده شده') {
        fieldsToUpdate.push("dateCompleted = ?");
        params.push(new Date().toISOString());
    }

    params.push(repairId);
    
    await runAsync(`UPDATE repairs SET ${fieldsToUpdate.join(', ')} WHERE id = ?`, params);
    return await getRepairByIdFromDb(repairId);
};

export const finalizeRepairInDb = async (repairId: number, data: FinalizeRepairPayload): Promise<any> => {
  await execAsync("BEGIN TRANSACTION;");
  try {
    const repair = await getAsync("SELECT * FROM repairs WHERE id = ?", [repairId]);
    if (!repair) throw new Error("تعمیر برای نهایی‌سازی یافت نشد.");
    if (repair.status === 'تحویل داده شده') throw new Error("این تعمیر قبلا نهایی شده است.");
    if (!data.technicianId) throw new Error("قبل از نهایی‌سازی، باید یک تعمیرکار به این تعمیر اختصاص داده شود.");

    const newStatus = "تحویل داده شده";
    await runAsync(
      `UPDATE repairs SET status = ?, finalCost = ?, laborFee = ?, dateCompleted = ?, technicianId = ? WHERE id = ?`,
      [newStatus, data.finalCost, data.laborFee, new Date().toISOString(), data.technicianId, repairId]
    );

    // Debit customer account for the final cost
    if (data.finalCost > 0) {
      const customerLedgerDesc = `هزینه تعمیر دستگاه: ${repair.deviceModel} (شناسه تعمیر: ${repairId})`;
      await addCustomerLedgerEntryInternal(repair.customerId, customerLedgerDesc, data.finalCost, 0, new Date().toISOString());
    }

    // Credit technician's account for the labor fee
    if (data.laborFee > 0) {
      const techLedgerDesc = `اجرت تعمیر دستگاه: ${repair.deviceModel} (شناسه تعمیر: ${repairId})`;
      await addPartnerLedgerEntryInternal(data.technicianId, techLedgerDesc, 0, data.laborFee, new Date().toISOString(), 'repair_fee', repairId);
    }

    await execAsync("COMMIT;");
    return await getRepairByIdFromDb(repairId);
  } catch(err: any) {
    await execAsync("ROLLBACK;");
    console.error('DB Error (finalizeRepairInDb):', err);
    throw err;
  }
};


export const addPartToRepairInDb = async (repairId: number, productId: number, quantityUsed: number): Promise<RepairPart> => {
    await getDbInstance();
    await execAsync("BEGIN TRANSACTION;");
    try {
        const product = await getAsync("SELECT stock_quantity FROM products WHERE id = ?", [productId]);
        if (!product) throw new Error("محصول یافت نشد.");
        if (product.stock_quantity < quantityUsed) throw new Error("موجودی محصول در انبار کافی نیست.");

        await runAsync("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?", [quantityUsed, productId]);
        const result = await runAsync(
            `INSERT INTO repair_parts (repairId, productId, quantityUsed) VALUES (?, ?, ?)`,
            [repairId, productId, quantityUsed]
        );

        await execAsync("COMMIT;");
        return await getAsync("SELECT rp.*, p.name as productName, p.sellingPrice as pricePerItem FROM repair_parts rp JOIN products p ON rp.productId = p.id WHERE rp.id = ?", [result.lastID]);
    } catch (err: any) {
        await execAsync("ROLLBACK;");
        throw err;
    }
};

export const deletePartFromRepairInDb = async (partId: number): Promise<boolean> => {
    await getDbInstance();
    await execAsync("BEGIN TRANSACTION;");
    try {
        const part = await getAsync("SELECT productId, quantityUsed FROM repair_parts WHERE id = ?", [partId]);
        if (!part) throw new Error("قطعه مصرفی یافت نشد.");

        await runAsync("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?", [part.quantityUsed, part.productId]);
        const result = await runAsync("DELETE FROM repair_parts WHERE id = ?", [partId]);

        await execAsync("COMMIT;");
        return result.changes > 0;
    } catch (err: any) {
        await execAsync("ROLLBACK;");
        throw err;
    }
};

export const getRepairDetailsForSms = async (repairId: number): Promise<any> => {
    await getDbInstance();
    return await getAsync(
      `SELECT r.id, r.deviceModel, r.finalCost, r.estimatedCost, c.fullName as customerFullName, c.phoneNumber as customerPhoneNumber 
       FROM repairs r JOIN customers c ON r.customerId = c.id WHERE r.id = ?`,
      [repairId]
    );
};


export const getOverdueInstallmentsFromDb = async (): Promise<any[]> => {
    await getDbInstance();
    // This function fetches all unpaid installments. The caller will filter by date
    // as date logic in JS with moment.js is easier and more reliable than in SQLite.
    const query = `
        SELECT
            ip.id,
            ip.saleId,
            ip.dueDate,
            ip.amountDue,
            c.fullName as customerFullName
        FROM installment_payments ip
        JOIN installment_sales isale ON ip.saleId = isale.id
        JOIN customers c ON isale.customerId = c.id
        WHERE ip.status = 'پرداخت نشده'
        ORDER BY ip.dueDate ASC
    `;
    return await allAsync(query);
};

export const getRepairsReadyForPickupFromDb = async (): Promise<any[]> => {
    await getDbInstance();
    const query = `
        SELECT
            r.id,
            r.deviceModel,
            r.finalCost,
            c.fullName as customerFullName
        FROM repairs r
        JOIN customers c on r.customerId = c.id
        WHERE r.status = 'آماده تحویل'
        ORDER BY r.dateCompleted DESC
    `;
    return await allAsync(query);
};
export const addInstallmentTransactionToDb = async (paymentId: number, amount: number, isoDate: string, notes?: string) => {
  await execAsync("BEGIN TRANSACTION;");
  try {
    const payment = await getAsync("SELECT * FROM installment_payments WHERE id = ?", [paymentId]);
    if (!payment) {
      throw new Error("قسط مورد نظر برای ثبت پرداخت یافت نشد.");
    }

    // 1. Insert the partial payment transaction
    const result = await runAsync(
      `INSERT INTO installment_transactions (installment_payment_id, amount_paid, payment_date, notes) VALUES (?, ?, ?, ?)`,
      [paymentId, amount, isoDate, notes]
    );

    // 2. Get sum of all payments for this installment
    const sumResult = await getAsync(
      `SELECT SUM(amount_paid) as totalPaid FROM installment_transactions WHERE installment_payment_id = ?`,
      [paymentId]
    );
    const totalPaid = sumResult.totalPaid || 0;

    // 3. Update the parent installment's status based on the total paid amount
    let newStatus: InstallmentPaymentStatus = payment.status;
    if (totalPaid >= payment.amountDue) {
      newStatus = 'پرداخت شده';
    } else if (totalPaid > 0) {
      newStatus = 'پرداخت جزئی'; // New status for partially paid installments
    } else {
      newStatus = 'پرداخت نشده';
    }

    // Only update paymentDate if the status is changing to a form of paid
    const dateToUpdate = (newStatus === 'پرداخت شده' || newStatus === 'پرداخت جزئی') ? isoDate : null;

    await runAsync(
      `UPDATE installment_payments SET status = ?, paymentDate = ? WHERE id = ?`,
      [newStatus, dateToUpdate, paymentId]
    );

    await execAsync("COMMIT;");
    return await getAsync("SELECT * FROM installment_transactions WHERE id = ?", [result.lastID]);
  } catch (error) {
    await execAsync("ROLLBACK;");
    throw error;
  }
};

