// pages/InvoiceForm.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import moment from 'jalali-moment';
import { getAuthHeaders } from '../utils/apiUtils';
import { useAuth } from '../contexts/AuthContext';
import Notification from '../components/Notification';
import type { NotificationMessage } from '../types';

interface SellableItem {
  id: number;
  type: 'phone' | 'inventory' | 'service';
  name: string;
  price: number;
}
interface LineItem {
  itemId: number | '';
  itemType: 'phone' | 'inventory' | 'service' | '';
  quantity: number;
  unitPrice: number;
}

export default function InvoiceForm() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [itemsList, setItemsList] = useState<SellableItem[]>([]);
  const [customersList, setCustomersList] = useState<{ id: number; fullName: string }[]>([]);
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { itemId: '', itemType: '', quantity: 1, unitPrice: 0 }
  ]);
  const [discount, setDiscount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<NotificationMessage | null>(null);

  const totalAmount = lineItems.reduce(
    (sum, li) => sum + (li.quantity * li.unitPrice),
    0
  );
  const finalAmount = Math.max(0, totalAmount - discount);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch('/api/sellable-items', { headers: getAuthHeaders(token) }).then(r => r.json()),
      fetch('/api/customers', { headers: getAuthHeaders(token) }).then(r => r.json())
    ])
      .then(([itemsJson, custJson]) => {
        if (itemsJson.success) {
          const inv = itemsJson.data.inventory.map((i: any) => ({ ...i, type: 'inventory', name: i.name }));
          const phones = itemsJson.data.phones.map((p: any) => ({ ...p, type: 'phone', name: p.name }));
          setItemsList([...inv, ...phones]);
        } else {
          setNotification({ type: 'error', text: itemsJson.message });
        }
        if (custJson.success) {
          setCustomersList(custJson.data);
        } else {
          setNotification({ type: 'error', text: custJson.message });
        }
      })
      .catch(err => setNotification({ type: 'error', text: err.message }))
      .finally(() => setLoading(false));
  }, [token]);

  const updateItem = (idx: number, field: keyof LineItem, value: any) => {
    const list = [...lineItems];
    if (field === 'itemId') {
      const id = Number(value);
      const sel = itemsList.find(it => it.id === id);
      list[idx] = {
        itemId: id,
        itemType: sel?.type || '',
        quantity: list[idx].quantity,
        unitPrice: sel?.price || 0
      };
    } else {
      (list[idx] as any)[field] = value;
    }
    setLineItems(list);
  };

  const addItem = () => setLineItems([...lineItems, { itemId: '', itemType: '', quantity: 1, unitPrice: 0 }]);
  const removeItem = (idx: number) => setLineItems(li => li.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    // اعتبارسنجی ساده
    if (!customerId) {
      setNotification({ type: 'error', text: 'لطفاً مشتری را انتخاب کنید.' });
      return;
    }

    if (lineItems.length === 0 || lineItems.some(li => !li.itemId)) {
      setNotification({ type: 'error', text: 'حداقل یک قلم کالا/خدمت انتخاب کنید.' });
      return;
    }

    setLoading(true);
    const date = moment().format('jYYYY/jMM/jDD');
    let saleIds: number[] = [];

    try {
      for (const li of lineItems) {
        const item = itemsList.find(i => i.id === li.itemId);
        const payload = {
          itemType: li.itemType,
          itemId: li.itemId,
          itemName: item?.name || 'کالا',
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          totalPrice: li.unitPrice * li.quantity,
          transactionDate: date,
          customerId: customerId || null,
          notes: null,
          discount,
          paymentMethod: 'cash'
        };

        const res = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders(token) },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || 'خطا در ثبت یک قلم فاکتور');
        }
        saleIds.push(json.data.id);
      }

      // ذخیره در localStorage برای InvoiceDetail
      localStorage.setItem(
        'lastInvoiceItems',
        JSON.stringify(
          lineItems.map(li => {
            const item = itemsList.find(i => i.id === li.itemId);
            const price = item?.price || li.unitPrice || 0;
            return {
              ...li,
              description: item?.name || 'کالا/خدمت',
              unitPrice: price,
              totalPrice: price * li.quantity
            };
          })
        )
      );

      navigate(`/invoices/${saleIds.join(',')}`);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p className="text-center p-4">در حال بارگذاری...</p>;

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6 bg-white shadow-lg rounded-lg space-y-6 text-right" dir="rtl">
      {notification && <Notification message={notification} onClose={() => setNotification(null)} />}

      <div>
        <label className="block mb-2 font-medium">انتخاب مشتری</label>
        <select
          value={customerId}
          onChange={e => setCustomerId(+e.target.value)}
          className="w-full border rounded-md px-3 py-2 focus:ring focus:ring-indigo-200"
          required
        >
          <option value="">انتخاب کنید</option>
          {customersList.map(c => (
            <option key={c.id} value={c.id}>
              {c.fullName}
            </option>
          ))}
        </select>
      </div>

      {lineItems.map((item, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-4 items-end">
          <div className="col-span-6">
            <label className="block mb-1">شرح کالا/خدمت</label>
            <select
              value={item.itemId}
              onChange={e => updateItem(idx, 'itemId', +e.target.value)}
              className="w-full border rounded-md px-3 py-2"
              required
            >
              <option value="">انتخاب یا جستجو...</option>
              {itemsList.map(it => (
                <option key={`${it.type}-${it.id}`} value={it.id}>
                  {it.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block mb-1">تعداد</label>
            <input
              type="number"
              min={1}
              value={item.quantity}
              onChange={e => updateItem(idx, 'quantity', +e.target.value)}
              className="w-full border rounded-md px-2 py-1"
            />
          </div>
          <div className="col-span-3">
            <label className="block mb-1">قیمت واحد</label>
            <input type="number" readOnly value={item.unitPrice} className="w-full border rounded-md px-2 py-1 bg-gray-100" />
          </div>
          {lineItems.length > 1 && (
            <button
              type="button"
              onClick={() => removeItem(idx)}
              className="col-span-1 bg-red-500 text-white rounded-md p-2 hover:bg-red-600"
            >
              −
            </button>
          )}
        </div>
      ))}

      <button type="button" onClick={addItem} className="text-indigo-600 hover:underline">
        + افزودن قلم
      </button>

      <div>
        <label className="block mb-1">تخفیف</label>
        <input
          type="number"
          value={discount}
          onChange={e => setDiscount(+e.target.value)}
          className="w-32 border rounded-md px-2 py-1"
        />
      </div>

      <div className="text-right space-y-2 mt-4">
        <div>جمع کل اقلام: <span className="font-semibold">{totalAmount.toLocaleString()} تومان</span></div>
        <div>تخفیف: <span className="font-semibold">{discount.toLocaleString()} تومان</span></div>
        <div>مبلغ قابل پرداخت: <span className="font-bold text-lg">{finalAmount.toLocaleString()} تومان</span></div>
      </div>

      <button
        type="submit"
        className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition"
      >
        ثبت فاکتور
      </button>
    </form>
  );
}
