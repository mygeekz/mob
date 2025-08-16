
import express, { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import moment from 'jalali-moment';
import multer, { FileFilterCallback } from 'multer';
import fs from 'fs';
import path, { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import bcryptjs from 'bcryptjs';
import crypto from 'crypto';
import bwipjs from 'bwip-js';
import pinoHttp from 'pino-http';

import logger from './logger';
import metricsRegister from './metrics';
import priceIntakeRouter from './priceIntake';

import {
  addProductToDb,
  getAllProductsFromDb,
  updateProductInDb,
  deleteProductFromDb,
  addCategoryToDb,
  getAllCategoriesFromDb,
  updateCategoryInDb,
  deleteCategoryFromDb,
  addPhoneEntryToDb,
  updatePhoneEntryInDb,
  deletePhoneEntryFromDb,
  getAllPhoneEntriesFromDb,
  getSellableItemsFromDb,
  getAllSalesTransactionsFromDb,
  recordSaleTransactionInDb,
  getDbInstance,
  DB_PATH,
  closeDbConnection,
  addCustomerToDb,
  getAllCustomersWithBalanceFromDb,
  getCustomerByIdFromDb,
  updateCustomerInDb,
  deleteCustomerFromDb,
  addCustomerLedgerEntryToDb,
  getLedgerForCustomerFromDb,
  addPartnerToDb,
  getAllPartnersWithBalanceFromDb,
  getPartnerByIdFromDb,
  updatePartnerInDb,
  deletePartnerFromDb,
  addPartnerLedgerEntryToDb,
  getLedgerForPartnerFromDb,
  getPurchasedItemsFromPartnerDb,
  getSalesSummaryAndProfit,
  getDebtorsList,
  getCreditorsList,
  getTopCustomersBySales,
  getTopSuppliersByPurchaseValue,
  getPhoneSalesReport, // Added
  getPhoneInstallmentSalesReport, // Added
  getInvoiceDataById,
  getAllSettingsAsObject,
  updateMultipleSettings,
  updateSetting,
  getAllRoles,
  addUserToDb,
  updateUserInDb,
  deleteUserFromDb,
  getAllUsersWithRoles,
  findUserByUsername,
  getAsync,
  getDashboardKPIs,
  getDashboardSalesChartData,
  getDashboardRecentActivities,
  addInstallmentSaleToDb,
  getAllInstallmentSalesFromDb,
  getInstallmentSaleByIdFromDb,
  updateInstallmentPaymentStatusInDb,
  updateCheckStatusInDb,
  getInstallmentPaymentDetailsForSms,
  changePasswordInDb,
  resetUserPasswordInDb,
  updateAvatarPathInDb,
  createRepairInDb, // Added
  getAllRepairsFromDb, // Added
  getRepairByIdFromDb, // Added
  updateRepairInDb, // Added
  finalizeRepairInDb, // Added
  addPartToRepairInDb, // Added
  deletePartFromRepairInDb, // Added
  getRepairDetailsForSms, // Added
  getOverdueInstallmentsFromDb, // Added for Action Center
  getRepairsReadyForPickupFromDb, // Added for Action Center
  ProductPayload,
  UpdateProductPayload,
  PhoneEntryPayload,
  PhoneEntryUpdatePayload,
  SaleDataPayload,
  CustomerPayload,
  LedgerEntryPayload,
  PartnerPayload,
  SettingItem,
  fromShamsiStringToISO,
  InstallmentSalePayload,
  CheckStatus,
  UserUpdatePayload,
  ChangePasswordPayload,
  NewRepairData, // Added
  FinalizeRepairPayload, // Added
  Service, // Added
  getAllServicesFromDb, // Added
  addServiceToDb, // Added
  updateServiceInDb, // Added
  deleteServiceFromDb, // Added
  addInstallmentTransactionToDb,
  getProfitPerSaleMapFromDb,
  getInvoiceDataForSaleIds,
} from './database';
import {
  createSalesOrder,
  getSalesOrderForInvoice,
  getAllSalesOrdersFromDb   // 🆕
} from './salesOrders';

import { analyzeProfitability, analyzeInventoryVelocity, generatePurchaseSuggestions } from './analysis';
import { sendPatternSms } from './smsService';
import { ActionItem, SalesOrderPayload } from '../types';

// --- Helpers for purchase history enrichment ---
const QTY_REGEX = /(\d+)\s*(?:عدد|تا|Qty|x)\b/; // اگر تعداد در شرح آمده باشد

type PurchaseRow = {
  id: number;
  type: 'product' | 'phone';
  name: string;
  identifier?: string | null;
  purchasePrice?: number | null;
  purchaseDate?: string | null;
  quantityPurchased?: number | null; // ممکن است از DB بیاید یا نیاید
  description?: string;              // اگر از ledger آمده باشد
};

const enrichPurchaseHistory = (rows: PurchaseRow[]) => {
  return rows.map((r) => {
    let qty = Number(r.quantityPurchased ?? 0);

    // اگر qty از DB نیامد و نوع product است، از شرح استخراج کن
    if (!qty && r.type === 'product' && r.description) {
      const m = r.description.match(QTY_REGEX);
      if (m) qty = Number(m[1]);
    }

    // برای گوشی‌ها معمولاً qty = 1
    if (!qty && r.type === 'phone') qty = 1;

    const unit = Number(r.purchasePrice ?? 0);
    const total = qty && unit ? qty * unit : 0;

    return {
      ...r,
      quantityPurchased: qty,
      totalPrice: total,
    };
  });
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3001;

// --- Middlewares ---

// Add request ID
app.use((req: any, res, next) => {
  req.id = crypto.randomUUID();
  next();
});

// Add Pino logger
app.use(pinoHttp({ logger }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


const uploadsDir = join(__dirname, '..', 'uploads');
const avatarsDir = join(uploadsDir, 'avatars');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

app.use('/uploads', express.static(uploadsDir));


const shamsiToISOForAPI = (shamsiDateString?: string, endOfDay: boolean = false): string | undefined => {
  if (!shamsiDateString || typeof shamsiDateString !== 'string') return undefined;
  try {
    let m = moment(shamsiDateString.trim(), 'jYYYY/jMM/jDD');
    if (!m.isValid()) {
        console.warn(`Invalid Shamsi date for ISO conversion: ${shamsiDateString}`);
        return undefined;
    }
    if (endOfDay) {
      return m.endOf('day').toISOString();
    }
    return m.startOf('day').toISOString();
  } catch (e) {
    console.warn(`Error converting Shamsi date to ISO: ${shamsiDateString}`, e);
    return undefined;
  }
};

const formatPriceForSms = (price: number): string => {
    if (typeof price !== 'number') return '0';
    return price.toLocaleString('fa-IR');
};

// --- Authentication ---
interface ActiveSession {
  userId: number;
  username: string;
  roleName: string;
  avatarUrl?: string | null;
  expires: number;
}
const activeSessions: Record<string, ActiveSession> = {};

const generateToken = () => crypto.randomBytes(32).toString('hex');
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; username: string; roleName: string; avatarUrl?: string | null };
    }
  }
}

const CHECK_STATUSES_OPTIONS_SERVER: CheckStatus[] = ["در جریان وصول", "وصول شده", "برگشت خورده", "نزد مشتری", "باطل شده"];


const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'توکن دسترسی ارائه نشده است.' });
  }

  const session = activeSessions[token];
  if (!session || session.expires < Date.now()) {
    if (session) delete activeSessions[token];
    return res.status(403).json({ success: false, message: 'توکن نامعتبر یا منقضی شده است.' });
  }

  session.expires = Date.now() + SESSION_DURATION_MS;
  req.user = { id: session.userId, username: session.username, roleName: session.roleName, avatarUrl: session.avatarUrl };
  next();
};

const authorizeRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.roleName || !allowedRoles.includes(req.user.roleName)) {
      return res.status(403).json({ success: false, message: 'عدم دسترسی مجاز. شما نقش مورد نیاز ('+ allowedRoles.join(' یا ') +') را ندارید.' });
    }
    next();
  };
};

// --- Public Routes (No Auth Required) ---
app.post('/api/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'نام کاربری و کلمه عبور الزامی هستند.' });
    }

    const user = await findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ success: false, message: 'نام کاربری یا کلمه عبور نامعتبر است.' });
    }

    const isMatch = await bcryptjs.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'نام کاربری یا کلمه عبور نامعتبر است.' });
    }
    
    const avatarUrl = user.avatarPath ? `/uploads/avatars/${user.avatarPath}` : null;
    const token = generateToken();
    activeSessions[token] = {
      userId: user.id,
      username: user.username,
      roleName: user.roleName,
      avatarUrl: avatarUrl,
      expires: Date.now() + SESSION_DURATION_MS,
    };

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        roleName: user.roleName,
        dateAdded: user.dateAdded,
        avatarUrl: avatarUrl
      },
    });
  } catch (error) {
    next(error);
  }
});

// Barcode generation routes (public)
app.get('/api/barcode/product/:id', async (req: Request, res: Response) => {
    try {
        const product = await getAsync("SELECT id FROM products WHERE id = ?", [req.params.id]);
        if (!product) return res.status(404).send('Product not found');
        const barcodeValue = `product-${product.id}`;
        bwipjs.toBuffer({
            bcid: 'code128',
            text: barcodeValue,
            scale: 3,
            height: 10,
            includetext: true,
            textxalign: 'center',
        }, (err, png) => {
            if (err) {
                console.error("Barcode generation error:", err);
                return res.status(500).send('Error generating barcode');
            }
            res.writeHead(200, { 'Content-Type': 'image/png' });
            res.end(png);
        });
    } catch (error) {
        console.error("Barcode route error:", error);
        res.status(500).send('Server error');
    }
});

app.get('/api/barcode/phone/:id', async (req: Request, res: Response) => {
    try {
        const phone = await getAsync("SELECT id FROM phones WHERE id = ?", [req.params.id]);
        if (!phone) return res.status(404).send('Phone not found');
        const barcodeValue = `phone-${phone.id}`;
        bwipjs.toBuffer({
            bcid: 'code128',
            text: barcodeValue,
            scale: 3,
            height: 10,
            includetext: true,
            textxalign: 'center',
        }, (err, png) => {
            if (err) {
                console.error("Barcode generation error:", err);
                return res.status(500).send('Error generating barcode');
            }
            res.writeHead(200, { 'Content-Type': 'image/png' });
            res.end(png);
        });
    } catch (error) {
        console.error("Barcode route error:", error);
        res.status(500).send('Server error');
    }
});


// --- Metrics Endpoint ---
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metricsRegister.contentType);
    res.end(await metricsRegister.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

// --- Price Intake API ---
// Check for env variable at startup
if (process.env.FEATURE_PRICE_INQUIRY !== 'true') {
    logger.warn("FEATURE_PRICE_INQUIRY is not 'true'. The Price Inquiry API will be disabled.");
}
app.use('/api/price-intake', priceIntakeRouter);


// All subsequent routes require authentication
app.use(authenticateToken);

// --- Logout ---
app.post('/api/logout', (req: Request, res: Response) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token && activeSessions[token]) {
        delete activeSessions[token];
    }
    res.json({ success: true, message: 'خروج با موفقیت انجام شد.' });
});

// --- Get current user ---
app.get('/api/me', (req: Request, res: Response) => {
    if (req.user) {
        res.json({ success: true, user: req.user });
    } else {
        res.status(404).json({ success: false, message: "کاربر یافت نشد."})
    }
});

// --- Change Password ---
app.post('/api/me/change-password', async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) return res.status(401).json({ success: false, message: 'Unauthenticated' });
        const { oldPassword, newPassword } = req.body as ChangePasswordPayload;
        if (!oldPassword || !newPassword || newPassword.length < 6) {
             return res.status(400).json({ success: false, message: 'اطلاعات ارائه شده برای تغییر رمز عبور نامعتبر است.' });
        }
        await changePasswordInDb(req.user.id, { oldPassword, newPassword });
        res.json({ success: true, message: "کلمه عبور با موفقیت تغییر کرد." });
    } catch(error) {
        next(error);
    }
});

// --- Multer setup for avatar uploads ---
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, avatarsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + req.user!.id + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const avatarUpload = multer({
    storage: avatarStorage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req: Request, file: NonNullable<Request['file']>, cb: FileFilterCallback) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = allowedTypes.test(file.mimetype);
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('فرمت فایل آواتار نامعتبر است.'));
    }
});

app.post('/api/me/upload-avatar', avatarUpload.single('avatar'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "هیچ فایلی برای آپلود انتخاب نشده است." });
        }
        if (!req.user) return res.status(401).json({ success: false, message: 'Unauthenticated' });
        
        // Delete old avatar if it exists
        const user = await getAsync("SELECT avatarPath FROM users WHERE id = ?", [req.user.id]);
        if(user && user.avatarPath){
            const oldAvatarFullPath = join(avatarsDir, user.avatarPath);
            fs.unlink(oldAvatarFullPath, (err) => {
                if (err) console.error("Error deleting old avatar:", oldAvatarFullPath, err);
            });
        }
        
        const avatarPath = req.file.filename;
        const updatedUser = await updateAvatarPathInDb(req.user.id, avatarPath);
        
        res.json({
            success: true,
            message: "آواتار با موفقیت آپلود شد.",
            data: { avatarUrl: `/uploads/avatars/${updatedUser.avatarPath}` }
        });
    } catch (error) {
        next(error);
    }
});


// --- Dashboard Routes ---
app.get('/api/dashboard/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = req.query.period as string || 'monthly';
    const [kpis, salesChartData, recentActivities] = await Promise.all([
        getDashboardKPIs(),
        getDashboardSalesChartData(period),
        getDashboardRecentActivities()
    ]);
    res.json({ success: true, data: { kpis, salesChartData, recentActivities } });
  } catch(error) {
    next(error);
  }
});

app.get('/api/dashboard/action-center', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const actionItems: ActionItem[] = [];

        // 1. Get purchase suggestions (stock alerts)
        const suggestions = await generatePurchaseSuggestions();
        suggestions.forEach(item => {
            actionItems.push({
                id: `stock-alert-${item.itemId}`,
                type: 'StockAlert',
                priority: 'High',
                title: `موجودی کم: ${item.itemName}`,
                description: `موجودی فعلی: ${item.currentStock.toLocaleString('fa-IR')}. موجودی برای ${item.daysOfStockLeft.toLocaleString('fa-IR')} روز آینده کافیست.`,
                actionText: 'بررسی پیشنهاد خرید',
                actionLink: '/reports/analysis/suggestions'
            });
        });

        // 2. Get overdue installments
        const allUnpaidInstallments = await getOverdueInstallmentsFromDb();
        const overdueInstallments = allUnpaidInstallments.filter(p => moment(p.dueDate, 'jYYYY/jMM/jDD').isBefore(moment(), 'day'));
        overdueInstallments.slice(0, 5).forEach(item => { // Limit to 5 for brevity
            actionItems.push({
                id: `overdue-payment-${item.id}`,
                type: 'OverdueInstallment',
                priority: 'High',
                title: `قسط معوق: ${item.customerFullName}`,
                description: `قسط به مبلغ ${item.amountDue.toLocaleString('fa-IR')} تومان با سررسید ${item.dueDate} پرداخت نشده است.`,
                actionText: 'مشاهده پرونده',
                actionLink: `/installment-sales/${item.saleId}`
            });
        });
        
        // 3. Get repairs ready for pickup
        const readyRepairs = await getRepairsReadyForPickupFromDb();
        readyRepairs.slice(0, 5).forEach(item => { // Limit to 5
             actionItems.push({
                id: `repair-ready-${item.id}`,
                type: 'RepairReady',
                priority: 'Medium',
                title: `تعمیر آماده تحویل: ${item.deviceModel}`,
                description: `دستگاه آقای/خانم ${item.customerFullName} به مبلغ نهایی ${item.finalCost.toLocaleString('fa-IR')} تومان آماده تحویل است.`,
                actionText: 'مشاهده جزئیات',
                actionLink: `/repairs/${item.id}`
            });
        })

        res.json({ success: true, data: actionItems });
    } catch (error) {
        next(error);
    }
});


// --- Product Routes ---
app.post('/api/products', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productData = req.body as ProductPayload;
    const newProduct = await addProductToDb(productData);
    res.status(201).json({ success: true, data: newProduct });
  } catch (error) {
    next(error);
  }
});

app.get('/api/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await getAllProductsFromDb();
    res.json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
});

app.put('/api/products/:id', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productId = parseInt(req.params.id, 10);
    const productData = req.body as UpdateProductPayload;
    const updatedProduct = await updateProductInDb(productId, productData);
    res.json({ success: true, data: updatedProduct });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/products/:id', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productId = parseInt(req.params.id, 10);
    const success = await deleteProductFromDb(productId);
    if (!success) {
      return res.status(404).json({ success: false, message: 'محصول برای حذف یافت نشد.' });
    }
    res.json({ success: true, message: 'محصول با موفقیت حذف شد.' });
  } catch (error) {
    next(error);
  }
});


// --- Category Routes ---
app.post('/api/categories', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'نام دسته‌بندی الزامی است.' });
    }
    const newCategory = await addCategoryToDb(name.trim());
    res.status(201).json({ success: true, data: newCategory });
  } catch (error) {
    next(error);
  }
});

app.get('/api/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await getAllCategoriesFromDb();
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
});

app.put('/api/categories/:id', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categoryId = parseInt(req.params.id, 10);
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'نام دسته‌بندی الزامی است.' });
    }
    const updatedCategory = await updateCategoryInDb(categoryId, name.trim());
    res.json({ success: true, data: updatedCategory });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/categories/:id', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categoryId = parseInt(req.params.id, 10);
    const success = await deleteCategoryFromDb(categoryId);
    if (!success) {
        return res.status(404).json({ success: false, message: 'دسته‌بندی برای حذف یافت نشد.' });
    }
    res.json({ success: true, message: 'دسته‌بندی با موفقیت حذف شد.' });
  } catch (error) {
    next(error);
  }
});

// --- Standalone Phone Routes ---
app.post('/api/phones', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phoneData = req.body as PhoneEntryPayload;
    if (!phoneData.imei || !phoneData.model || phoneData.purchasePrice === undefined || phoneData.purchasePrice === null) {
        return res.status(400).json({ success: false, message: 'فیلدهای مدل، IMEI و قیمت خرید الزامی هستند.' });
    }
    const newPhone = await addPhoneEntryToDb(phoneData);
    res.status(201).json({ success: true, data: newPhone });
  } catch (error) {
    next(error);
  }
});

app.get('/api/phones', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { status, id } = req.query;
        const phoneId = id ? parseInt(id as string, 10) : undefined;
        const phones = await getAllPhoneEntriesFromDb(null, status as string, phoneId);
        res.json({ success: true, data: phones });
    } catch (error) {
        next(error);
    }
});

app.put('/api/phones/:id', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phoneId = parseInt(req.params.id, 10);
    const phoneData = req.body as PhoneEntryUpdatePayload;
    const updatedPhone = await updatePhoneEntryInDb(phoneId, phoneData);
    res.json({ success: true, data: updatedPhone, message: "گوشی با موفقیت ویرایش شد." });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/phones/:id', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phoneId = parseInt(req.params.id, 10);
    const success = await deletePhoneEntryFromDb(phoneId);
     if (!success) {
        return res.status(404).json({ success: false, message: 'گوشی برای حذف یافت نشد.' });
    }
    res.json({ success: true, message: 'گوشی با موفقیت حذف شد.' });
  } catch (error) {
    next(error);
  }
});

// --- Sales Routes ---
app.get('/api/sellable-items', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const items = await getSellableItemsFromDb();
        res.json({ success: true, data: items });
    } catch(error) {
        next(error);
    }
});
// ====== Helpers: robust profit calc + normalizer ======
type AnyRow = Record<string, any>;

const readNum = (o: AnyRow, keys: string[], def = 0) => {
  for (const k of keys) {
    const v = o?.[k];
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return def;
};

const calcInvoiceProfit = (items: AnyRow[]): number => {
  if (!Array.isArray(items) || !items.length) return 0;

  let revenue = 0;
  let cost = 0;

  for (const it of items) {
    // try many common aliases
    const qty = readNum(it, ['quantity','qty','count','quantitySold','qty_sold'], 1);

    const unitSale = readNum(it, ['unitPrice','unit_price','price','salePrice','unitSalePrice']);
    const lineSale = readNum(it, ['totalPrice','lineTotal','total','line_total','sum'], unitSale * qty);

    const unitCost = readNum(it, ['purchasePrice','buyPrice','cost','purchase_price','unitCost','unit_cost'], 0);

    revenue += lineSale;
    cost    += unitCost * qty;
  }
  return revenue - cost;
};

// خروجی‌های ممکن:
// 1) [{ saleId, items:[...] }, ...]
// 2) [{ saleId, <fields of item> }, { saleId, ...}, ...]  ← فلت
const buildProfitMap = async (saleIds: number[]) => {
  const map = new Map<number, number>();
  if (!saleIds.length) return map;

  const raw = await getInvoiceDataForSaleIds(saleIds);

  if (Array.isArray(raw) && raw.length) {
    const first = raw[0];

    // حالت ۱: گروه‌بندی‌شده
    if (first && 'items' in first) {
      for (const row of raw as AnyRow[]) {
        const sid = readNum(row, ['saleId','sale_id','id']);
        const profit = calcInvoiceProfit(row.items || []);
        map.set(sid, profit);
      }
    } else {
      // حالت ۲: فلت → گروه‌بندی با saleId
      const bySale: Record<number, AnyRow[]> = {};
      for (const r of raw as AnyRow[]) {
        const sid = readNum(r, ['saleId','sale_id','id']);
        if (!sid) continue;
        (bySale[sid] ||= []).push(r);
      }
      Object.entries(bySale).forEach(([sid, items]) => {
        map.set(Number(sid), calcInvoiceProfit(items));
      });
    }
  }
  return map;
};


app.get('/api/sales', async (req, res, next) => {
  try {
    const rows: any[] = await getAllSalesTransactionsFromDb();
    const ids = rows.map(r => Number(r.id ?? r.saleId ?? r.sale_id)).filter(Boolean);

    const profitMap = await getProfitPerSaleMapFromDb(ids);


    const enriched = rows.map(r => {
      const sid = Number(r.id ?? r.saleId ?? r.sale_id);
      return {
        ...r,
        // هميشه سود محاسبه‌شده را اعمال کن (even if DB has 0)
        profit: profitMap.get(sid) ?? 0
      };
    });

    res.json({ success: true, data: enriched });
  } catch (e) { next(e); }
});


// --- New Sales Order Routes ---
app.post('/api/sales-orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderPayload = req.body as SalesOrderPayload;
    // Basic validation
    if (!orderPayload.items || !Array.isArray(orderPayload.items) || orderPayload.items.length === 0) {
        return res.status(400).json({ success: false, message: 'سبد خرید نمی‌تواند خالی باشد.' });
    }
    const result = await createSalesOrder(orderPayload);
    res.status(201).json({ success: true, message: 'سفارش با موفقیت ثبت شد.', data: result });
  } catch (error) {
    next(error);
  }
});

// --- Sales-Order LIST -------------------------------
app.get('/api/sales-orders', async (_req, res, next) => {
  try {
    const rows: any[] = await getAllSalesOrdersFromDb();
    const ids = rows.map(r => Number(r.id ?? r.saleId ?? r.sale_id)).filter(Boolean);

    const getItemsFromInvoice = (inv: any): any[] => {
      if (!inv) return [];
      // رایج‌ترین کلیدهای آرایه آیتم‌ها
      const candidates = [
        inv.items, inv.orderItems, inv.lines, inv.details, inv.itemsData,
        inv.items_list, inv.invoiceItems, inv.rows
      ].filter(Array.isArray);
      if (candidates.length) return candidates[0];

      // گاهی آیتم‌ها زیر آبجکت‌های مختلف پخش‌اند (مثلاً inv.itemsByType)
      if (inv.itemsByType && typeof inv.itemsByType === 'object') {
        return Object.values(inv.itemsByType).flat().filter(Boolean) as any[];
      }
      return [];
    };

    const nameFromItem = (it: any): string => {
      // مستقیم
      const direct =
        it?.itemName ?? it?.name ?? it?.title ?? it?.productName ??
        it?.serviceName ?? it?.model ?? it?.description ?? it?.label;
      if (direct && String(direct).trim()) return String(direct).trim();

      // تو در تو
      const nested =
        it?.product?.name ?? it?.product?.title ??
        it?.service?.name ?? it?.service?.title ??
        it?.phone?.model ?? it?.device?.model ??
        it?.goods?.name;
      if (nested && String(nested).trim()) return String(nested).trim();

      // حداقل‌گرا
      const type = it?.itemType ?? it?.type ?? '';
      const code = it?.sku ?? it?.code ?? it?.imei ?? '';
      return [type || 'آیتم', code].filter(Boolean).join(' ');
    };

    const summarize = (names: string[]) => {
      const n = names.map(s => String(s || '').trim()).filter(Boolean);
      if (!n.length) return '—';
      return n.length > 3 ? n.slice(0, 3).join('، ') + '، …' : n.join('، ');
    };

    const descMap = new Map<number, string>();
    await Promise.all(ids.map(async (id) => {
      try {
        const inv: any = await getSalesOrderForInvoice(id);
        const items = getItemsFromInvoice(inv);
        const names = items.map(nameFromItem);
        const desc = summarize(names);
        descMap.set(id, desc);

        // دیباگ: اگر چیزی پیدا نشد، یک بار لاگ بگیر
        if (desc === '—') {
          console.warn('No item names for order', id, 'invoice keys:', inv ? Object.keys(inv) : inv);
        }
      } catch (e) {
        console.warn('desc build failed for order', id, e);
      }
    }));

    const enriched = rows.map(r => {
      const sid = Number(r.id ?? r.saleId ?? r.sale_id);
      return { ...r, description: descMap.get(sid) ?? r.itemName ?? '—' };
    });

    res.json({ success: true, data: enriched });
  } catch (e) {
    console.error('GET /api/sales-orders failed:', e);
    next(e);
  }
});



// --- Sales-Order DETAIL (برای صفحه چاپ فاکتور) -----
app.get('/api/sales-orders/:id', async (req, res, next) => {
  const orderId = Number(req.params.id);
  if (Number.isNaN(orderId))
    return res.status(400).json({ success:false, message:'شناسه نامعتبر است.' });

  try {
    const invoice = await getSalesOrderForInvoice(orderId);
    console.log('🧾 GET /sales-orders/:id →', invoice ? 'FOUND' : 'NOT FOUND');

    if (!invoice)
      return res.status(404).json({ success:false, message:'فاکتور یافت نشد.' });

    res.json({ success:true, data:invoice });
  } catch (e) { next(e); }
});



// DEPRECATED: This endpoint is for the old single-item sales page.
// It will be kept for historical purposes but new sales should use /api/sales-orders.
app.post('/api/sales', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const saleData = req.body as SaleDataPayload;
        const newSale = await recordSaleTransactionInDb(saleData);
        res.status(201).json({ success: true, data: newSale });
    } catch (error) {
        next(error);
    }
});

// --- Customer Routes ---
app.post('/api/customers', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const customerData = req.body as CustomerPayload;
        const newCustomer = await addCustomerToDb(customerData);
        res.status(201).json({ success: true, data: newCustomer });
    } catch (error) {
        next(error);
    }
});

app.get('/api/customers', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const customers = await getAllCustomersWithBalanceFromDb();
        res.json({ success: true, data: customers });
    } catch(error) {
        next(error);
    }
});

app.get('/api/customers/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const customerId = parseInt(req.params.id, 10);
        const profile = await getCustomerByIdFromDb(customerId);
        if (!profile) return res.status(404).json({ success: false, message: 'مشتری یافت نشد.'});
        const ledger = await getLedgerForCustomerFromDb(customerId);
        const purchaseHistory = await getAllSalesTransactionsFromDb(customerId);
        res.json({ success: true, data: { profile, ledger, purchaseHistory }});
    } catch (error) {
        next(error);
    }
});

app.put('/api/customers/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const customerId = parseInt(req.params.id, 10);
        const customerData = req.body as CustomerPayload;
        const updatedCustomer = await updateCustomerInDb(customerId, customerData);
        res.json({ success: true, data: updatedCustomer });
    } catch (error) {
        next(error);
    }
});

app.post('/api/customers/:id/ledger', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const customerId = parseInt(req.params.id, 10);
        const ledgerData = req.body as LedgerEntryPayload;
        const newEntry = await addCustomerLedgerEntryToDb(customerId, ledgerData);
        res.status(201).json({ success: true, data: newEntry });
    } catch (error) {
        next(error);
    }
});

// --- Partner Routes ---
app.post('/api/partners', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const partnerData = req.body as PartnerPayload;
        const newPartner = await addPartnerToDb(partnerData);
        res.status(201).json({ success: true, data: newPartner });
    } catch (error) {
        next(error);
    }
});

app.get('/api/partners', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const partnerType = req.query.partnerType as string | undefined;
        const partners = await getAllPartnersWithBalanceFromDb(partnerType);
        res.json({ success: true, data: partners });
    } catch(error) {
        next(error);
    }
});

app.get('/api/partners/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = parseInt(req.params.id, 10);

    const profile = await getPartnerByIdFromDb(partnerId);
    if (!profile) return res.status(404).json({ success: false, message: 'همکار یافت نشد.' });

    const ledger = await getLedgerForPartnerFromDb(partnerId);

    // قبلی
    const rawPurchaseHistory = await getPurchasedItemsFromPartnerDb(partnerId);

    // جدید: نرمال‌سازی و محاسبه تعداد/مبلغ کل
    const purchaseHistory = enrichPurchaseHistory(rawPurchaseHistory);

    res.json({ success: true, data: { profile, ledger, purchaseHistory } });
  } catch (error) {
    next(error);
  }
});


app.put('/api/partners/:id', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const partnerId = parseInt(req.params.id, 10);
        const partnerData = req.body as PartnerPayload;
        const updatedPartner = await updatePartnerInDb(partnerId, partnerData);
        res.json({ success: true, data: updatedPartner });
    } catch (error) {
        next(error);
    }
});

app.post('/api/partners/:id/ledger', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const partnerId = parseInt(req.params.id, 10);
        const ledgerData = req.body as LedgerEntryPayload;
        const newEntry = await addPartnerLedgerEntryToDb(partnerId, ledgerData);
        res.status(201).json({ success: true, data: newEntry });
    } catch (error) {
        next(error);
    }
});

// --- Reports ---
app.get('/api/reports/sales-summary', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { fromDate, toDate } = req.query;
        if (!fromDate || !toDate) return res.status(400).json({ success: false, message: 'بازه زمانی الزامی است.' });
        const data = await getSalesSummaryAndProfit(fromDate as string, toDate as string);
        res.json({ success: true, data });
    } catch(error) {
        next(error);
    }
});

app.get('/api/reports/debtors', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await getDebtorsList();
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

app.get('/api/reports/creditors', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await getCreditorsList();
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

app.get('/api/reports/top-customers', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { fromDate, toDate } = req.query;
        if (!fromDate || !toDate) return res.status(400).json({ success: false, message: 'بازه زمانی الزامی است.' });
        const data = await getTopCustomersBySales(fromDate as string, toDate as string);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

app.get('/api/reports/top-suppliers', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { fromDate, toDate } = req.query;
        if (!fromDate || !toDate) return res.status(400).json({ success: false, message: 'بازه زمانی الزامی است.' });
        const fromDateISO = fromShamsiStringToISO(fromDate as string);
        const toDateISO = fromShamsiStringToISO(toDate as string);
        if (!fromDateISO || !toDateISO) return res.status(400).json({ success: false, message: 'فرمت تاریخ نامعتبر است.' });
        
        const data = await getTopSuppliersByPurchaseValue(fromDateISO, toDateISO);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

app.get('/api/reports/phone-sales', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { fromDate, toDate } = req.query;
        if (!fromDate || !toDate) return res.status(400).json({ success: false, message: 'بازه زمانی الزامی است.' });
        const fromDateISO = fromShamsiStringToISO(fromDate as string);
        const toDateISO = fromShamsiStringToISO(toDate as string);
        if (!fromDateISO || !toDateISO) return res.status(400).json({ success: false, message: 'فرمت تاریخ نامعتبر است.' });

        const data = await getPhoneSalesReport(fromDateISO, toDateISO);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

app.get('/api/reports/phone-installment-sales', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { fromDate, toDate } = req.query;
        if (!fromDate || !toDate) return res.status(400).json({ success: false, message: 'بازه زمانی الزامی است.' });
        const fromDateISO = fromShamsiStringToISO(fromDate as string);
        const toDateISO = fromShamsiStringToISO(toDate as string);
        if (!fromDateISO || !toDateISO) return res.status(400).json({ success: false, message: 'فرمت تاریخ نامعتبر است.' });

        const data = await getPhoneInstallmentSalesReport(fromDateISO, toDateISO);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});
// helper بالا یا قبل از روت‌ها
function sanitizeJalali(input: unknown): string {
  const s = String(input ?? '').trim();
  // فقط ارقام فارسی/انگلیسی و اسلش را نگه می‌داریم
  return s.replace(/[^0-9\u06F0-\u06F9/]/g, '');
}

// --- Periodic Comparison Report ---
app.get('/api/reports/compare-sales', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ورودی‌ها را بگیریم و نویزگیری کنیم
    const rawFrom = (req.query as any)?.fromDate;
    const rawTo   = (req.query as any)?.toDate;
    const baseline = (req.query as any)?.baseline as 'prev' | 'last_year' | undefined;

    const fromDate = sanitizeJalali(rawFrom);
    const toDate   = sanitizeJalali(rawTo);

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'بازه زمانی (از/تا) الزامی است.' });
    }

    const mFrom = moment(fromDate, 'jYYYY/jMM/jDD', true);
    const mTo   = moment(toDate,   'jYYYY/jMM/jDD', true);

    if (!mFrom.isValid() || !mTo.isValid() || mTo.isBefore(mFrom, 'day')) {
      return res.status(400).json({ success: false, message: 'فرمت تاریخ نامعتبر است.' });
    }

    // تعیین بازه مبنا
    let prevFrom = mFrom.clone();
    let prevTo   = mTo.clone();

    if (baseline === 'last_year') {
      prevFrom = mFrom.clone().subtract(1, 'jYear');
      prevTo   = mTo.clone().subtract(1, 'jYear');
    } else {
      const days = mTo.diff(mFrom, 'days') + 1; // طول بازه فعلی
      prevTo   = mFrom.clone().subtract(1, 'day');
      prevFrom = prevTo.clone().subtract(days - 1, 'days');
    }

    // گرفتن خلاصه فروش برای بازه فعلی و مبنا (تابع موجود پروژه)
    const currentSummary  = await getSalesSummaryAndProfit(mFrom.format('jYYYY/jMM/jDD'), mTo.format('jYYYY/jMM/jDD'));
    const previousSummary = await getSalesSummaryAndProfit(prevFrom.format('jYYYY/jMM/jDD'), prevTo.format('jYYYY/jMM/jDD'));

    // استخراج رقم فروش/درآمد
    const pickAmount = (obj: any): number => {
      if (!obj) return 0;
      const keys = ['totalRevenue','revenue','totalSales','salesAmount','total','sum'];
      for (const k of keys) if (typeof obj?.[k] === 'number') return obj[k];
      if (Array.isArray(obj) && obj.length) {
        for (const k of keys) if (typeof obj[0]?.[k] === 'number') return obj[0][k];
      }
      return 0;
    };
	const currentProfit  = typeof currentSummary?.grossProfit === 'number' ? currentSummary.grossProfit : 0;
	const previousProfit = typeof previousSummary?.grossProfit === 'number' ? previousSummary.grossProfit : 0;
	const profitChange   = previousProfit === 0 ? null : ((currentProfit - previousProfit) / previousProfit) * 100;

    const currentAmount  = pickAmount(currentSummary);
    const previousAmount = pickAmount(previousSummary);

    const percentageChange = previousAmount === 0 ? null
      : ((currentAmount - previousAmount) / previousAmount) * 100;

    res.json({
      success: true,
      data: {
        currentAmount,
		currentProfit,
		previousProfit,
		profitChange,
        previousAmount,
        percentageChange,
        currentRange:  { from: mFrom.format('jYYYY/jMM/jDD'),  to: mTo.format('jYYYY/jMM/jDD') },
        previousRange: { from: prevFrom.format('jYYYY/jMM/jDD'), to: prevTo.format('jYYYY/jMM/jDD') },
        baseline: baseline === 'last_year' ? 'last_year' : 'prev'
      }
    });
  } catch (err) {
    next(err);
  }
});


// --- Invoice ---

// 1) فاکتورِ تکی  (برای سازگاری قبلی)
app.get(
  '/api/invoice-data/:saleId(\\d+)',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const saleId = parseInt(req.params.saleId, 10);
      const data = await getInvoiceDataById(saleId);

      if (!data) {
        return res
          .status(404)
          .json({ success: false, message: 'فاکتور برای این فروش یافت نشد.' });
      }
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

// 2) فاکتورِ چندتایی  (۱۲,۱۳,۱۴ → [12,13,14])
app.get(
  '/api/invoice-data/:saleIds',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const saleIds = req.params.saleIds
        .split(',')
        .map(id => parseInt(id, 10))
        .filter(Boolean); // حذف NaN و صفر

      if (saleIds.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: 'شناسهٔ فروش نامعتبر است.' });
      }

      const data = await getInvoiceDataForSaleIds(saleIds);

      if (!data) {
        return res
          .status(404)
          .json({ success: false, message: 'فاکتور برای فروش‌های خواسته‌شده یافت نشد.' });
      }

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);


// --- Settings ---
app.get('/api/settings', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const settings = await getAllSettingsAsObject();
        res.json({ success: true, data: settings });
    } catch(error) {
        next(error);
    }
});

app.post('/api/settings', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const settingsData = req.body;
        const settingsArray: SettingItem[] = Object.keys(settingsData).map(key => ({
            key, value: settingsData[key]
        }));
        await updateMultipleSettings(settingsArray);
        res.json({ success: true, message: "تنظیمات با موفقیت ذخیره شد." });
    } catch (error) {
        next(error);
    }
});

// Multer setup for logo uploads
const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, 'logo' + ext); // Overwrite existing logo
    }
});
const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req: Request, file: NonNullable<Request['file']>, cb: FileFilterCallback) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg\+xml|webp/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('فرمت فایل لوگو نامعتبر است.'));
  }
});

app.post('/api/settings/upload-logo', authorizeRole(['Admin']), logoUpload.single('logo'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "هیچ فایلی برای آپلود انتخاب نشده است."});
        }
        const filePath = req.file.filename;
        await updateSetting('store_logo_path', filePath);
        res.json({ success: true, message: 'لوگو با موفقیت آپلود شد.', data: { filePath }});
    } catch (error) {
        next(error);
    }
});

app.get('/api/settings/backup', authorizeRole(['Admin']), (req: Request, res: Response) => {
    res.download(DB_PATH, `kourosh_dashboard_backup_${new Date().toISOString().split('T')[0]}.db`, (err) => {
        if (err) {
            console.error("Backup download error:", err);
            res.status(500).json({ success: false, message: 'خطا در دانلود فایل پشتیبان.'});
        }
    });
});

const dbUpload = multer({
  storage: multer.memoryStorage(), // Use memory storage for restore
  fileFilter: (req: Request, file: NonNullable<Request['file']>, cb: FileFilterCallback) => {
    const allowedExt = /.db$/;
    if (allowedExt.test(file.originalname)) {
        cb(null, true);
    } else {
        cb(new Error("فایل پشتیبان باید با فرمت .db باشد."));
    }
  }
});

app.post('/api/settings/restore', authorizeRole(['Admin']), dbUpload.single('dbfile'), async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'فایل پشتیبان انتخاب نشده است.' });
    }
    try {
        console.log("Starting DB restore process...");
        await closeDbConnection(); // Close current connection
        fs.writeFileSync(DB_PATH, req.file.buffer);
        console.log("DB file overwritten successfully.");
        await getDbInstance(true); // Re-initialize DB from the new file
        console.log("DB re-initialized successfully.");
        res.json({ success: true, message: 'پایگاه داده با موفقیت بازیابی شد.' });
    } catch (error) {
        next(error);
    }
});

// --- User & Role Routes ---
app.get('/api/roles', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const roles = await getAllRoles();
        res.json({ success: true, data: roles });
    } catch(error) {
        next(error);
    }
});
app.get('/api/users', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const users = await getAllUsersWithRoles();
        res.json({ success: true, data: users });
    } catch(error) {
        next(error);
    }
});
app.post('/api/users', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { username, password, roleId } = req.body;
        if(!username || !password || !roleId) return res.status(400).json({ success: false, message: 'اطلاعات کاربر ناقص است.' });
        const newUser = await addUserToDb(username, password, roleId);
        res.status(201).json({ success: true, data: newUser });
    } catch (error) {
        next(error);
    }
});
app.put('/api/users/:id', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const data = req.body as UserUpdatePayload;
        const updatedUser = await updateUserInDb(userId, data);
        res.json({ success: true, data: updatedUser });
    } catch (error) {
        next(error);
    }
});
app.delete('/api/users/:id', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = parseInt(req.params.id, 10);
        await deleteUserFromDb(userId);
        res.json({ success: true, message: 'کاربر با موفقیت حذف شد.' });
    } catch (error) {
        next(error);
    }
});
app.post('/api/users/:id/reset-password', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const { password } = req.body;
        if (!password || password.length < 6) return res.status(400).json({ success: false, message: 'کلمه عبور جدید باید حداقل ۶ کاراکتر باشد.' });
        await resetUserPasswordInDb(userId, password);
        res.json({ success: true, message: 'کلمه عبور با موفقیت بازنشانی شد.'});
    } catch(error) {
        next(error);
    }
});


// --- Installment Sales Routes ---
app.post('/api/installment-sales', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const saleData = req.body as InstallmentSalePayload;
        const newSale = await addInstallmentSaleToDb(saleData);
        res.status(201).json({ success: true, data: newSale });
    } catch (error) {
        next(error);
    }
});

app.get('/api/installment-sales', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sales = await getAllInstallmentSalesFromDb();
        res.json({ success: true, data: sales });
    } catch (error) {
        next(error);
    }
});

app.get('/api/installment-sales/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const saleId = parseInt(req.params.id, 10);
        const saleDetails = await getInstallmentSaleByIdFromDb(saleId);
        if (!saleDetails) {
            return res.status(404).json({ success: false, message: 'فروش اقساطی یافت نشد.' });
        }
        res.json({ success: true, data: saleDetails });
    } catch (error) {
        next(error);
    }
});

app.put('/api/installment-sales/payment/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const paymentId = parseInt(req.params.id, 10);
        const { paid, paymentDate } = req.body;
        const success = await updateInstallmentPaymentStatusInDb(paymentId, paid, paymentDate);
        res.json({ success, message: 'وضعیت قسط بروزرسانی شد.' });
    } catch (error) {
        next(error);
    }
});

app.put('/api/installment-sales/check/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const checkId = parseInt(req.params.id, 10);
        const { status } = req.body;
         if (!CHECK_STATUSES_OPTIONS_SERVER.includes(status)) {
            return res.status(400).json({ success: false, message: "وضعیت چک نامعتبر است." });
        }
        const success = await updateCheckStatusInDb(checkId, status);
        res.json({ success, message: 'وضعیت چک بروزرسانی شد.' });
    } catch (error) {
        next(error);
    }
});
app.post('/api/installment-sales/payment/:paymentId/transaction', authorizeRole(['Admin']), async (req, res, next) => {
    try {
        const { paymentId } = req.params;
        const { amount, date, notes } = req.body;

        if (!amount || !date || Number(amount) <= 0) {
            return res.status(400).json({ success: false, message: 'مبلغ و تاریخ پرداخت الزامی است.' });
        }
        
        // Convert Shamsi date from frontend to ISO for DB
        const isoDate = moment(date, 'jYYYY/jMM/jDD').format('YYYY-MM-DD');
        if (!moment(isoDate).isValid()) {
            return res.status(400).json({ success: false, message: 'فرمت تاریخ نامعتبر است.' });
        }
        
        const newTransaction = await addInstallmentTransactionToDb(Number(paymentId), Number(amount), isoDate, notes);
        res.status(201).json({ success: true, data: newTransaction, message: 'پرداخت با موفقیت ثبت شد.' });
    } catch (error) {
        next(error);
    }
});

// --- Smart Analysis ---
app.get('/api/analysis/profitability', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await analyzeProfitability();
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});
app.get('/api/analysis/inventory-velocity', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await analyzeInventoryVelocity();
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});
app.get('/api/analysis/purchase-suggestions', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await generatePurchaseSuggestions();
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

// --- SMS Service ---
app.post('/api/sms/trigger-event', authorizeRole(['Admin']), async (req, res, next) => {
    try {
        const { targetId, eventType } = req.body;
        console.log('1. درخواست ارسال پیامک دریافت شد:', req.body); // <-- کد ردیابی ۱
        if (!targetId || isNaN(Number(targetId))) {
            return res.status(400).json({ success: false, message: 'شناسه هدف (مانند شناسه تعمیر یا قسط) نامعتبر یا ارائه نشده است.' });
        }

        const settings = await getAllSettingsAsObject();
        const { meli_payamak_username, meli_payamak_password } = settings;
		console.log('2. تنظیمات پنل پیامک خوانده شد.');
        if (!meli_payamak_username || !meli_payamak_password) {
            throw new Error('اطلاعات پنل پیامک در تنظیمات ثبت نشده است.');
        }

        let bodyId: number;
        let smsText = '';
        let recipientNumber = '';
		console.log('3. در حال پردازش رویداد:', eventType, 'برای شناسه:', targetId);

        if (eventType === 'INSTALLMENT_REMINDER') {
            bodyId = Number(settings.meli_payamak_installment_reminder_pattern_id);
            if (!bodyId) throw new Error("کد الگوی یادآوری قسط در تنظیمات تعریف نشده.");
            
            const paymentDetails = await getInstallmentPaymentDetailsForSms(targetId);
            if (!paymentDetails) throw new Error("اطلاعات قسط یافت نشد.");
            
            recipientNumber = paymentDetails.customerPhoneNumber;
            // The dueDate is already Shamsi from the DB, so no conversion needed here
            smsText = `${paymentDetails.customerFullName};${formatPriceForSms(paymentDetails.amountDue)};${paymentDetails.dueDate}`;

        } else if (eventType === 'REPAIR_RECEIVED') {
            bodyId = Number(settings.meli_payamak_repair_received_pattern_id);
            if (!bodyId) throw new Error("کد الگوی تایید پذیرش در تنظیمات تعریف نشده.");

            const repairDetails = await getRepairDetailsForSms(targetId);
            if (!repairDetails) throw new Error("اطلاعات تعمیر یافت نشد.");

            recipientNumber = repairDetails.customerPhoneNumber;
            smsText = `${repairDetails.customerFullName};${repairDetails.deviceModel};${repairDetails.id}`;

        } else if (eventType === 'REPAIR_COST_ESTIMATED') {
            bodyId = Number(settings.meli_payamak_repair_cost_estimated_pattern_id);
            if (!bodyId) throw new Error("کد الگوی اعلام هزینه در تنظیمات تعریف نشده.");
            
            const repairDetails = await getRepairDetailsForSms(targetId);
            if (!repairDetails || !repairDetails.estimatedCost) throw new Error("اطلاعات تعمیر یا هزینه تخمینی یافت نشد.");
            
            recipientNumber = repairDetails.customerPhoneNumber;
            smsText = `${repairDetails.customerFullName};${repairDetails.deviceModel};${formatPriceForSms(repairDetails.estimatedCost)}`;

        } else if (eventType === 'REPAIR_READY_FOR_PICKUP') {
            bodyId = Number(settings.meli_payamak_repair_ready_pattern_id);
            if (!bodyId) throw new Error("کد الگوی آماده تحویل در تنظیمات تعریف نشده.");

            const repairDetails = await getRepairDetailsForSms(targetId);
            if (!repairDetails || !repairDetails.finalCost) throw new Error("اطلاعات تعمیر یا هزینه نهایی یافت نشد.");

            recipientNumber = repairDetails.customerPhoneNumber;
            smsText = `${repairDetails.customerFullName};${repairDetails.deviceModel};${formatPriceForSms(repairDetails.finalCost)}`;

        } else {
            throw new Error('نوع رویداد نامعتبر است.');
        }

        if (!recipientNumber) throw new Error("شماره تماس گیرنده یافت نشد.");
		console.log('4. آماده برای ارسال نهایی به سرویس پیامک:', { to: recipientNumber, bodyId, text: smsText });

        // **این بخش کلیدی اصلاح شده است**
        const smsResult = await sendPatternSms(recipientNumber, bodyId, smsText, meli_payamak_username, meli_payamak_password);
        
        // بر اساس پاسخ سرویس پیامک، یک پاسخ مناسب به کلاینت ارسال می‌کنیم
        if (smsResult.success) {
            res.status(200).json({ success: true, message: 'پیامک با موفقیت برای ارسال، زمان‌بندی شد.', data: smsResult });
        } else {
            // اگر سرویس پیامک خطا داد، آن را به عنوان خطای سرور به کلاینت گزارش می‌دهیم
            res.status(500).json({ success: false, message: `خطا از سرویس پیامک: ${smsResult.message}`, data: smsResult });
        }

    } catch (error) {
        next(error);
    }
});


// --- Repair Center Routes ---
app.post('/api/repairs', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = req.body as NewRepairData;
        const newRepair = await createRepairInDb(data);
        res.status(201).json({ success: true, data: newRepair });
    } catch (error) {
        next(error);
    }
});

app.get('/api/repairs', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const statusFilter = req.query.status as string | undefined;
        const repairs = await getAllRepairsFromDb(statusFilter);
        res.json({ success: true, data: repairs });
    } catch (error) {
        next(error);
    }
});

app.get('/api/repairs/:id', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const repairId = parseInt(req.params.id, 10);
        const details = await getRepairByIdFromDb(repairId);
        if (!details) return res.status(404).json({ success: false, message: 'تعمیر یافت نشد.'});
        res.json({ success: true, data: details });
    } catch (error) {
        next(error);
    }
});

app.put('/api/repairs/:id', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const repairId = parseInt(req.params.id, 10);
        const data = req.body;
        const updatedRepair = await updateRepairInDb(repairId, data);
        res.json({ success: true, data: updatedRepair });
    } catch (error) {
        next(error);
    }
});

app.post('/api/repairs/:id/finalize', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const repairId = parseInt(req.params.id, 10);
        const data = req.body as FinalizeRepairPayload;
        const finalizedRepair = await finalizeRepairInDb(repairId, data);
        res.json({ success: true, data: finalizedRepair });
    } catch (error) {
        next(error);
    }
});


app.post('/api/repairs/:id/parts', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const repairId = parseInt(req.params.id, 10);
        const { productId, quantityUsed } = req.body;
        const newPart = await addPartToRepairInDb(repairId, productId, quantityUsed);
        res.status(201).json({ success: true, data: newPart });
    } catch (error) {
        next(error);
    }
});

app.delete('/api/repairs/:id/parts/:partId', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const partId = parseInt(req.params.partId, 10);
        const success = await deletePartFromRepairInDb(partId);
        res.json({ success, message: 'قطعه با موفقیت حذف شد.'});
    } catch (error) {
        next(error);
    }
});


// --- Services Routes ---
app.get('/api/services', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const services = await getAllServicesFromDb();
        res.json({ success: true, data: services });
    } catch(error) {
        next(error);
    }
});

app.post('/api/services', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const serviceData = req.body as Omit<Service, 'id'>;
        const newService = await addServiceToDb(serviceData);
        res.status(201).json({ success: true, data: newService, message: 'خدمت با موفقیت اضافه شد.' });
    } catch(error) {
        next(error);
    }
});

app.put('/api/services/:id', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const serviceId = parseInt(req.params.id, 10);
        const serviceData = req.body as Omit<Service, 'id'>;
        const updatedService = await updateServiceInDb(serviceId, serviceData);
        res.json({ success: true, data: updatedService, message: 'خدمت با موفقیت ویرایش شد.' });
    } catch(error) {
        next(error);
    }
});

app.delete('/api/services/:id', authorizeRole(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const serviceId = parseInt(req.params.id, 10);
        await deleteServiceFromDb(serviceId);
        res.json({ success: true, message: 'خدمت با موفقیت حذف شد.' });
    } catch(error) {
        next(error);
    }
});

// Final catch-all for 404
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'مسیر API مورد نظر یافت نشد.' });
});

// Error handling middleware
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error("An error occurred:", err);
  // If the error has a status code, use it, otherwise default to 500
  const statusCode = err.statusCode || 500;
  // Send a generic error message
  const message = err.message || 'خطای داخلی سرور';
  res.status(statusCode).json({
    success: false,
    message: message
  });
};
app.use(errorHandler);

// Connect to DB and start server
getDbInstance().then(db => {
  if (db) {
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  } else {
    console.error("Failed to get DB instance, server not started.");
    (process as any).exit(1);
  }
}).catch(err => {
  console.error("Failed to initialize database:", err);
  (process as any).exit(1);
});

// Graceful shutdown
const cleanup = async () => {
  console.log('Closing database connection...');
  await closeDbConnection();
  console.log('Exiting process.');
  (process as any).exit();
};

(process as any).on('SIGINT', cleanup);
(process as any).on('SIGTERM', cleanup);
