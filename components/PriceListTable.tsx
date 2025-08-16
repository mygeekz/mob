import React from 'react';

// Define the type for a single price item
interface PriceItem {
  id: number;
  title_raw: string;
  unit_price: number;
  currency: string;
  confidence: number | null;
  // Add other fields from your price_items table if needed
}

interface PriceListTableProps {
  items: PriceItem[];
  isLoading?: boolean;
}

const PriceListTable: React.FC<PriceListTableProps> = ({ items, isLoading }) => {
  if (isLoading) {
    return <div className="text-center p-4">در حال بارگذاری اطلاعات...</div>;
  }

  if (!items || items.length === 0) {
    return <div className="text-center p-4 text-gray-500">هیچ موردی برای نمایش وجود ندارد.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white rounded-lg shadow-md">
        <thead className="bg-gray-200">
          <tr>
            <th className="py-2 px-4 border-b text-right">#</th>
            <th className="py-2 px-4 border-b text-right">شرح استخراج شده</th>
            <th className="py-2 px-4 border-b text-right">قیمت واحد</th>
            <th className="py-2 px-4 border-b text-right">واحد پول</th>
            <th className="py-2 px-4 border-b text-right">اطمینان</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="py-2 px-4 border-b">{index + 1}</td>
              <td className="py-2 px-4 border-b font-mono">{item.title_raw}</td>
              <td className="py-2 px-4 border-b">{item.unit_price.toLocaleString('fa-IR')}</td>
              <td className="py-2 px-4 border-b">{item.currency}</td>
              <td className="py-2 px-4 border-b">{item.confidence ? `${(item.confidence * 100).toFixed(0)}%` : 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PriceListTable;
