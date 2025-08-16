import React, { useState, useEffect, useMemo } from 'react';
import Select, { OnChangeValue, CSSObjectWithLabel } from 'react-select';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import type { SellableItem, SellableItemsResponse, SellableInventoryItem, SellablePhoneItem, Service } from '../types';

interface SellableItemSelectProps {
    onAddItem: (item: SellableItem) => void;
}

interface SelectOption {
    label: string;
    value: SellableItem;
}

const SellableItemSelect: React.FC<SellableItemSelectProps> = ({ onAddItem }) => {
    const { token } = useAuth();
    const [allItems, setAllItems] = useState<SellableItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;
        setLoading(true);
        setError(null);

        apiFetch('/api/sellable-items')
            .then(res => {
                if (!res.ok) throw new Error('Network response was not ok');
                return res.json() as Promise<{ success: boolean; data: SellableItemsResponse; message?: string }>;
            })
            .then(json => {
                if (json.success) {
                    const inventory = json.data.inventory.map((i: SellableInventoryItem) => ({ ...i, type: 'inventory' as const }));
                    const phones = json.data.phones.map((p: SellablePhoneItem) => ({ ...p, type: 'phone' as const }));
                    const services = (json.data.services ?? []).map(
					    (s: Service) => ({ ...s, type: 'service' as const, stock: Infinity })
						);
                    setAllItems([...inventory, ...phones, ...services]);
                } else {
                    throw new Error(json.message || 'Failed to parse sellable items');
                }
            })
            .catch(err => {
                console.error("Failed to fetch sellable items:", err);
                setError('خطا در بارگذاری اقلام قابل فروش.');
            })
            .finally(() => setLoading(false));
    }, [token]);

    const selectOptions = useMemo<SelectOption[]>(() => {
        // Guard against allItems being null or undefined during an error state.
        return (allItems ?? []).map(item => ({
            value: item,
            label: `${item.name} (${item.price.toLocaleString('fa-IR')} تومان) - موجودی: ${item.stock?.toLocaleString('fa-IR') ?? '∞'}`
        }));
    }, [allItems]);

    const handleChange = (selectedOption: OnChangeValue<SelectOption, false>) => {
        if (selectedOption) {
            onAddItem(selectedOption.value);
        }
    };

    const customStyles: { menu: (provided: CSSObjectWithLabel) => CSSObjectWithLabel } = {
        menu: (provided: CSSObjectWithLabel) => ({ ...provided, zIndex: 50 }),
    };

    if (error) {
        return <div className="text-center p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>;
    }

    return (
        <div className="bg-white p-4 rounded-xl shadow-lg" dir="rtl">
            <label htmlFor="item-search-select" className="block text-lg font-bold mb-3 text-gray-800">
                افزودن کالا به سبد خرید
            </label>
            <Select
                id="item-search-select"
                options={selectOptions}
                onChange={handleChange}
                value={null} // Reset selection after choosing
                placeholder="جستجو و انتخاب کالا یا خدمات..."
                isLoading={loading}
                isSearchable
                noOptionsMessage={() => 'موردی یافت نشد'}
                loadingMessage={() => 'در حال بارگذاری...'}
                styles={customStyles}
                theme={(theme) => ({
                    ...theme,
                    borderRadius: 8,
                    colors: {
                        ...theme.colors,
                        primary: '#4f46e5', // indigo-600
                        primary75: '#6d6afe',
                        primary50: '#a5b4fc',
                        primary25: '#e0e7ff',
                    },
                })}
            />
        </div>
    );
};

export default SellableItemSelect;