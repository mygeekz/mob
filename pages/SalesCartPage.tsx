// src/pages/SalesCartPage.tsx
import React, { useState, useEffect, useReducer, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import Notification from '../components/Notification';
import SellableItemSelect from '../components/SellableItemSelect';
import CartTable from '../components/CartTable';
import CartSummary from '../components/CartSummary';
import type {
  NotificationMessage,
  SellableItem,
  Customer,
  CartItem,
  SalesOrderPayload,
} from '../types';
import { v4 as uuidv4 } from 'uuid';   // ← تنها تغییر مهم

/* ------------------------------------------------------------------ */
/* Types & Reducer                                                    */
/* ------------------------------------------------------------------ */

interface CartState {
  items: CartItem[];
  customerId: number | null;
  paymentMethod: 'cash';
  globalDiscount: number;
  notes: string;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: SellableItem }
  | { type: 'REMOVE_ITEM'; payload: { cartItemId: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { cartItemId: string; quantity: number } }
  | { type: 'UPDATE_ITEM_DISCOUNT'; payload: { cartItemId: string; discount: number } }
  | { type: 'SET_CUSTOMER'; payload: { customerId: number | null } }
  | { type: 'SET_PAYMENT_METHOD'; payload: { method: 'cash' } }
  | { type: 'SET_GLOBAL_DISCOUNT'; payload: { discount: number } }
  | { type: 'SET_NOTES'; payload: { notes: string } }
  | { type: 'CLEAR_CART' };

const initialState: CartState = {
  items: [],
  customerId: null,
  paymentMethod: 'cash',
  globalDiscount: 0,
  notes: '',
};

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    /* ──────────────── افزودن کالا ──────────────── */
    case 'ADD_ITEM': {
      const existing = state.items.find(
        i => i.itemId === action.payload.id && i.itemType === action.payload.type,
      );
      if (existing) {
        return {
          ...state,
          items: state.items.map(i =>
            i.cartItemId === existing.cartItemId
              ? { ...i, quantity: Math.min(i.quantity + 1, i.stock) }
              : i,
          ),
        };
      }
      const newItem: CartItem = {
        cartItemId: uuidv4(),              // ← جایگزین crypto.randomUUID
        itemId: action.payload.id,
        itemType: action.payload.type,
        name: action.payload.name,
        description: action.payload.name,
        quantity: 1,
        unitPrice: action.payload.price,
        discountPerItem: 0,
        stock: action.payload.type === 'service' ? Infinity : action.payload.stock,
      };
      return { ...state, items: [...state.items, newItem] };
    }

    /* ──────────────── سایر اکشن‌ها ──────────────── */
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter(i => i.cartItemId !== action.payload.cartItemId) };
    case 'UPDATE_QUANTITY':
      return {
        ...state,
        items: state.items.map(i =>
          i.cartItemId === action.payload.cartItemId
            ? { ...i, quantity: Math.max(1, Math.min(action.payload.quantity, i.stock)) }
            : i,
        ),
      };
    case 'UPDATE_ITEM_DISCOUNT':
      return {
        ...state,
        items: state.items.map(i =>
          i.cartItemId === action.payload.cartItemId
            ? { ...i, discountPerItem: Math.max(0, action.payload.discount) }
            : i,
        ),
      };
    case 'SET_CUSTOMER':
      return { ...state, customerId: action.payload.customerId };
    case 'SET_PAYMENT_METHOD':
      return { ...state, paymentMethod: action.payload.method };
    case 'SET_GLOBAL_DISCOUNT':
      return { ...state, globalDiscount: Math.max(0, action.payload.discount) };
    case 'SET_NOTES':
      return { ...state, notes: action.payload.notes };
    case 'CLEAR_CART':
      return initialState;
    default:
      return state;
  }
};

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

const SalesCartPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [notification, setNotification] = useState<NotificationMessage | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [state, dispatch] = useReducer(cartReducer, initialState);

  /* دریافت مشتریان -------------------------------------------------- */
  useEffect(() => {
    if (!token) return;
    apiFetch('/api/customers')
      .then(r => r.json())
      .then(j => j.success && setCustomers(j.data))
      .catch(() =>
        setNotification({ type: 'error', text: 'خطا در دریافت لیست مشتریان.' }),
      );
  }, [token]);

  /* افزودن کالا ----------------------------------------------------- */
  const handleAddItem = (item: SellableItem) =>
    dispatch({ type: 'ADD_ITEM', payload: item });

  /* ثبت فروش -------------------------------------------------------- */
  const handleCheckout = async () => {
    if (!state.items.length) {
      setNotification({ type: 'warning', text: 'سبد خرید خالی است.' });
      return;
    }
    setIsSubmitting(true);
    setNotification(null);

    const payload: SalesOrderPayload = {
      customerId: state.customerId,
      paymentMethod: state.paymentMethod,
      discount: state.globalDiscount,
      tax: 0,
      notes: state.notes,
      items: state.items.map(i => ({
        itemId: i.itemId,
        itemType: i.itemType,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discountPerItem: i.discountPerItem,
      })),
    };

    try {
      const res = await apiFetch('/api/sales-orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);

      setNotification({ type: 'success', text: 'فروش ثبت شد!' });
      dispatch({ type: 'CLEAR_CART' });
      setTimeout(() => navigate(`/invoices/${json.data.orderId}`), 800);
    } catch (err) {
      setNotification({
        type: 'error',
        text: err instanceof Error ? err.message : 'خطای ناشناخته.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* محاسبهٔ جمع مالی ----------------------------------------------- */
  const summary = useMemo(() => {
    const subtotal = state.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const itemsDiscount = state.items.reduce((s, i) => s + i.discountPerItem, 0);
    return { subtotal, itemsDiscount, grandTotal: subtotal - itemsDiscount - state.globalDiscount };
  }, [state.items, state.globalDiscount]);

  /* رندر ------------------------------------------------------------ */
  return (
    <div className="container mx-auto p-4" dir="rtl">
      {notification && (
        <Notification message={notification} onClose={() => setNotification(null)} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <SellableItemSelect onAddItem={handleAddItem} />
        </div>

        <div className="lg:col-span-5 space-y-6">
          {/* جدول سبد */}
          <div className="bg-white p-4 rounded-xl shadow-lg">
            <h2 className="text-xl font-bold mb-4 border-b pb-3">سبد فروش</h2>
            <div className="max-h-[40vh] overflow-y-auto">
              <CartTable items={state.items} dispatch={dispatch} />
            </div>
          </div>

          {/* خلاصه مالی */}
          <div className="bg-white p-4 rounded-xl shadow-lg">
            <CartSummary summary={summary} globalDiscount={state.globalDiscount} dispatch={dispatch} />
          </div>

          {/* انتخاب مشتری، یادداشت، دکمه‌ها */}
          <div className="bg-white p-4 rounded-xl shadow-lg space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">مشتری</label>
              <select
                value={state.customerId ?? ''}
                onChange={e =>
                  dispatch({
                    type: 'SET_CUSTOMER',
                    payload: { customerId: e.target.value ? +e.target.value : null },
                  })
                }
                className="w-full p-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">مشتری مهمان</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} - {c.phoneNumber}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">یادداشت</label>
              <textarea
                rows={3}
                value={state.notes}
                onChange={e =>
                  dispatch({ type: 'SET_NOTES', payload: { notes: e.target.value } })
                }
                className="w-full p-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500"
                placeholder="توضیحات یا شرایط فاکتور..."
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCheckout}
                disabled={isSubmitting || !state.items.length}
                className="flex-grow py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-green-400 transition-colors"
              >
                {isSubmitting ? 'در حال ثبت...' : 'ثبت نهایی و صدور فاکتور'}
              </button>
              <button
                onClick={() => dispatch({ type: 'CLEAR_CART' })}
                disabled={isSubmitting || !state.items.length}
                className="px-4 py-3 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 disabled:bg-red-300 transition-colors"
                title="پاک کردن سبد"
              >
                <i className="fas fa-trash" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesCartPage;
