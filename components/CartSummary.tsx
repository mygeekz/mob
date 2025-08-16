import React from 'react';
import PriceInput from './PriceInput';
import type { InvoiceFinancialSummary, CartAction } from '../types';

interface CartSummaryProps {
    summary: Omit<InvoiceFinancialSummary, 'taxPercentage' | 'taxableAmount' | 'taxAmount'>;
    globalDiscount: number;
    dispatch: React.Dispatch<CartAction>;
}

const CartSummary: React.FC<CartSummaryProps> = ({ summary, globalDiscount, dispatch }) => {
    const { subtotal, itemsDiscount, grandTotal } = summary;

    const handleGlobalDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const discount = parseFloat(e.target.value) || 0;
        dispatch({ type: 'SET_GLOBAL_DISCOUNT', payload: { discount } });
    };

    const formatPrice = (price: number) => price.toLocaleString('fa-IR');

    return (
        <div className="space-y-3 text-sm">
            <h3 className="text-lg font-bold border-b pb-2 mb-3">خلاصه فاکتور</h3>

            <div className="flex justify-between items-center">
                <span className="text-gray-600">جمع کل موارد:</span>
                <span className="font-semibold">{formatPrice(subtotal)} تومان</span>
            </div>

            {itemsDiscount > 0 && (
                <div className="flex justify-between items-center text-red-600">
                    <span className="text-gray-600">مجموع تخفیف روی اقلام:</span>
                    <span className="font-semibold">({formatPrice(itemsDiscount)}) تومان</span>
                </div>
            )}

            <div className="space-y-1">
                <label htmlFor="global-discount" className="text-gray-600">تخفیف کلی (تومان):</label>
                <PriceInput
                    id="global-discount"
                    value={String(globalDiscount)}
                    onChange={handleGlobalDiscountChange}
                    className="w-full p-2 border border-gray-300 rounded-lg shadow-sm text-left focus:ring-2 focus:ring-indigo-500"
                    placeholder="0"
                />
            </div>


            <div className="border-t pt-3 mt-3">
                <div className="flex justify-between items-center text-lg font-bold text-indigo-700">
                    <span>مبلغ نهایی قابل پرداخت:</span>
                    <span>{formatPrice(Math.round(grandTotal))} تومان</span>
                </div>
            </div>
        </div>
    );
};

export default CartSummary;
