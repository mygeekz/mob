import React from 'react';
import type { CartItem, CartAction } from '../types';
import PriceInput from './PriceInput'; // Using PriceInput for formatted currency input

interface CartTableProps {
    items: CartItem[];
    dispatch: React.Dispatch<CartAction>;
}

const CartTable: React.FC<CartTableProps> = ({ items, dispatch }) => {
    if (items.length === 0) {
        return <div className="text-center p-4 text-gray-500">سبد خرید خالی است.</div>;
    }

    const handleQuantityChange = (cartItemId: string, quantityStr: string) => {
        const quantity = parseInt(quantityStr, 10);
        if (!isNaN(quantity)) {
            dispatch({ type: 'UPDATE_QUANTITY', payload: { cartItemId, quantity } });
        }
    };

    const handleDiscountChange = (cartItemId: string, discountStr: string) => {
        const discount = parseFloat(discountStr) || 0;
        dispatch({ type: 'UPDATE_ITEM_DISCOUNT', payload: { cartItemId, discount } });
    };

    const handleRemoveItem = (cartItemId: string) => {
        dispatch({ type: 'REMOVE_ITEM', payload: { cartItemId } });
    };


    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
                <thead className="bg-gray-100 text-gray-600 sticky top-0 z-10">
                    <tr>
                        <th className="p-2 font-semibold">کالا</th>
                        <th className="p-2 font-semibold">تعداد</th>
                        <th className="p-2 font-semibold">قیمت واحد</th>
                        <th className="p-2 font-semibold">تخفیف (تومان)</th>
                        <th className="p-2 font-semibold">جمع</th>
                        <th className="p-2"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {items.map(item => (
                        <tr key={item.cartItemId} className="hover:bg-gray-50">
                            <td className="p-2 font-medium text-gray-800">{item.name}</td>
                            <td className="p-2 w-24">
                                <input
                                    type="number"
                                    value={item.quantity}
                                    onChange={(e) => handleQuantityChange(item.cartItemId, e.target.value)}
                                    className="w-full p-1.5 border border-gray-300 rounded-md shadow-sm text-center focus:ring-1 focus:ring-indigo-500"
                                    min="1"
                                    max={item.stock}
                                />
                            </td>
                            <td className="p-2 whitespace-nowrap">{item.unitPrice.toLocaleString('fa-IR')}</td>
                            <td className="p-2 w-32">
                                <PriceInput
                                    value={String(item.discountPerItem)}
                                    onChange={(e) => handleDiscountChange(item.cartItemId, e.target.value)}
                                    className="w-full p-1.5 border border-gray-300 rounded-md shadow-sm text-left focus:ring-1 focus:ring-indigo-500"
                                    placeholder="0"
                                />
                            </td>
                             <td className="p-2 whitespace-nowrap font-semibold">
                                {((item.unitPrice * item.quantity) - item.discountPerItem).toLocaleString('fa-IR')}
                             </td>
                            <td className="p-2 text-center">
                                <button onClick={() => handleRemoveItem(item.cartItemId)} className="text-red-500 hover:text-red-700 transition-colors" title="حذف">
                                    <i className="fas fa-times-circle"></i>
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default CartTable;
