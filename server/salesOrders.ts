/* ------------------------------------------------------------------
   salesOrders.ts  –  CRUD برای فروشِ چند‌قلمی + دادهٔ فاکتور
-------------------------------------------------------------------*/
import moment from 'jalali-moment';
import {
  getDbInstance,
  runAsync,
  getAsync,
  allAsync,
  execAsync,
  addCustomerLedgerEntryInternal
} from './database.ts';

import type {
  SalesOrderPayload,
  FrontendInvoiceData,
  BusinessDetails,
  Customer,
  InvoiceLineItem,
  InvoiceFinancialSummary
} from '../types';

/* ---------- ثبت یک سفارش فروش ---------- */
export const createSalesOrder = async (
  orderPayload: SalesOrderPayload
): Promise<{ orderId: number }> => {

  await getDbInstance();

  const { customerId, paymentMethod, discount, tax, notes, items } = orderPayload;
  if (!items?.length) throw new Error('سبد خرید خالی است.');

  await execAsync('BEGIN TRANSACTION;');
  try {
    /* 1) محاسبات عددی */
    const subtotal          = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    const itemsDiscount     = items.reduce((s, it) => s + it.discountPerItem, 0);
    const taxableAmount     = subtotal - itemsDiscount - discount;
    const taxAmount         = taxableAmount > 0 ? (taxableAmount * tax) / 100 : 0;
    const grandTotal        = taxableAmount + taxAmount;
    const isoTransactionDate = moment().format('YYYY-MM-DD');

    /* 2) درج رکورد سفارش */
    const { lastID: orderId } = await runAsync(
      `INSERT INTO sales_orders
        (customerId, paymentMethod, discount, tax, subtotal, grandTotal, transactionDate, notes)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        customerId ?? null,
        paymentMethod,
        discount,
        tax,
        subtotal,
        grandTotal,
        isoTransactionDate,
        notes
      ]
    );
    console.log('🆕  createSalesOrder → orderId =', orderId);

    /* 3) درج خط‌-آیتم‌ها + به‌روزرسانی انبار */
    for (const it of items) {
      if (it.itemType === 'phone') {
        const phone = await getAsync('SELECT status FROM phones WHERE id = ?', [it.itemId]);
        if (!phone || phone.status !== 'موجود در انبار')
          throw new Error(`گوشی ${it.itemId} برای فروش موجود نیست.`);
        await runAsync("UPDATE phones SET status='فروخته شده', saleDate=? WHERE id=?",
                       [isoTransactionDate, it.itemId]);
      } else if (it.itemType === 'inventory') {
        const pr = await getAsync('SELECT stock_quantity FROM products WHERE id=?', [it.itemId]);
        if (!pr || pr.stock_quantity < it.quantity)
          throw new Error(`موجودی کالای ${it.itemId} کافی نیست.`);
        await runAsync('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
                       [it.quantity, it.itemId]);
      }
      const lineTotal = it.quantity * it.unitPrice - it.discountPerItem;
      await runAsync(
        `INSERT INTO sales_order_items
          (orderId,itemType,itemId,description,quantity,unitPrice,discountPerItem,totalPrice)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          orderId,
          it.itemType,
          it.itemId,
          it.description,
          it.quantity,
          it.unitPrice,
          it.discountPerItem,
          lineTotal
        ]
      );
    }

    /* 4) دفتر معین مشتری در فروش اعتباری */
    if (customerId && paymentMethod === 'credit' && grandTotal > 0) {
      await addCustomerLedgerEntryInternal(
        customerId,
        `فاکتور فروش اعتباری شماره ${orderId}`,
        grandTotal,
        0,
        new Date().toISOString()
      );
    }

    await execAsync('COMMIT;');
    return { orderId };
  } catch (err) {
    await execAsync('ROLLBACK;');
    console.error('❌  createSalesOrder failed →', err);
    throw err;
  }
};

/* ---------- یک فاکتور کامل برای چاپ ---------- */
export const getSalesOrderForInvoice = async (
  orderId: number
): Promise<FrontendInvoiceData | null> => {

  await getDbInstance();
  console.log('➡️  getSalesOrderForInvoice  id =', orderId);

  const order = await getAsync(
    `SELECT so.*, c.fullName AS fullName, c.phoneNumber AS phoneNumber
       FROM sales_orders so
       LEFT JOIN customers c ON c.id = so.customerId
      WHERE so.id = ?`,
    [orderId]
  );
  console.log('   ↳ order row =', order);
  if (!order) return null;

  const items = await allAsync(
    'SELECT * FROM sales_order_items WHERE orderId = ? ORDER BY id',
    [orderId]
  );
  console.log('   ↳ items len =', items.length);

  /* تنظیمات سربرگ */
  const settingsRows = await allAsync('SELECT key,value FROM settings');
  const settings = Object.fromEntries(settingsRows.map((r: any) => [r.key, r.value]));

  const businessDetails: BusinessDetails = {
    name:           settings.store_name            ?? 'فروشگاه',
    addressLine1:   settings.store_address_line1   ?? '',
    cityStateZip:   settings.store_city_state_zip  ?? '',
    phone:          settings.store_phone           ?? '',
    email:          settings.store_email           ?? '',
    logoUrl:        settings.store_logo_path
                      ? `/uploads/${settings.store_logo_path}` : undefined
  };

  const customerDetails: Partial<Customer> | null = order.customerId
    ? { id: order.customerId, fullName: order.fullName, phoneNumber: order.phoneNumber }
    : null;

  const lineItems: InvoiceLineItem[] = items.map((it: any) => ({
    id: it.id,
    description: it.description,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    discountPerItem: it.discountPerItem,
    totalPrice: it.totalPrice
  }));

  const itemsDiscount = lineItems.reduce((s, li) => s + li.discountPerItem, 0);

  const financialSummary: InvoiceFinancialSummary = {
    subtotal:        order.subtotal,
    itemsDiscount,
    globalDiscount:  order.discount,
    taxableAmount:   order.subtotal - itemsDiscount - order.discount,
    taxPercentage:   order.tax,
    taxAmount:       order.grandTotal - (order.subtotal - itemsDiscount - order.discount),
    grandTotal:      order.grandTotal
  };

  const invoice: FrontendInvoiceData = {
    businessDetails,
    customerDetails,
    invoiceMetadata: {
      invoiceNumber: String(order.id),
      transactionDate: moment(order.transactionDate, 'YYYY-MM-DD')
                         .locale('fa')
                         .format('jYYYY/jMM/jDD')
    },
    lineItems,
    financialSummary,
    notes: order.notes
  };

  console.log('   ↳ invoice done.');
  return invoice;
};

/* ---------- لیست تمام فاکتورها (برای صفحهٔ جدول) ---------- */
export const getAllSalesOrdersFromDb = async () => {
  await getDbInstance();
  return await allAsync(`
    SELECT so.id,
           so.transactionDate,
           so.grandTotal,
           COALESCE(c.fullName,'مهمان') AS customerName
      FROM sales_orders so
      LEFT JOIN customers c ON c.id = so.customerId
     ORDER BY so.id DESC`
  );
};
