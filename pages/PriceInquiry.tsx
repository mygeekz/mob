import React, { useState, useEffect, useCallback } from 'react';
import React, { useState, useEffect, useCallback } from 'react';
import PriceListTable from '../components/PriceListTable';
import { apiJson } from '../utils/apiFetch';

// --- Types ---
interface PriceDocument {
  id: number;
  storage_path: string;
  original_url: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
}

interface PriceItem {
  id: number;
  title_raw: string;
  unit_price: number;
  currency: string;
  confidence: number | null;
}

interface DocumentDetails {
  document: PriceDocument;
  priceList: any; // Define more strictly if needed
  items: PriceItem[];
}


// --- Main Component ---
const PriceInquiry: React.FC = () => {
  // --- State ---
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [featureDisabled, setFeatureDisabled] = useState(false);

  const [recentDocuments, setRecentDocuments] = useState<PriceDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentDetails | null>(null);
  const [isDocLoading, setIsDocLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{ documentId: number; itemsCount: number } | null>(null);

  // --- Functions ---
  const fetchRecentDocuments = useCallback(async () => {
    try {
      const data = await apiJson('/api/price-intake/documents');
      setRecentDocuments(data.data);
    } catch (err: any) {
      setError(err.message || 'خطا در دریافت لیست اسناد');
      if (err.status === 403) {
        setFeatureDisabled(true);
      }
    }
  }, []);

  const fetchDocumentDetails = async (docId: number) => {
    setIsDocLoading(true);
    setSelectedDocument(null);
    setError(null);
    try {
        const data = await apiJson(`/api/price-intake/documents/${docId}`);
        setSelectedDocument(data.data);
    } catch (err: any) {
        setError(err.message || `خطا در دریافت جزئیات سند ${docId}`);
    } finally {
        setIsDocLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentDocuments();
  }, [fetchRecentDocuments]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('لطفاً یک فایل را انتخاب کنید.');
      return;
    }
    setIsUploading(true);
    setError(null);
    setLastResult(null);

    const formData = new FormData();
    formData.append('priceFile', file);

    try {
      const result = await apiJson('/api/price-intake/upload', {
        method: 'POST',
        body: formData,
      });

      setLastResult({ documentId: result.documentId, itemsCount: result.itemsCount });
      fetchRecentDocuments(); // Refresh the list
      fetchDocumentDetails(result.documentId); // Show the new document
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleIngestUrl = async () => {
    if (!url) {
      setError('لطفاً یک آدرس اینترنتی وارد کنید.');
      return;
    }
    // Placeholder as per instructions
    setError("در MVP، استخراج از URL پیاده‌سازی نشده است.");
  };

  // --- Render ---

  if (featureDisabled) {
    return (
      <div className="p-6 bg-red-100 border-r-4 border-red-500 text-red-700 rounded-md shadow-lg">
        <h2 className="text-xl font-bold mb-2">ویژگی غیرفعال است</h2>
        <p>متاسفانه ویژگی استعلام قیمت در حال حاضر در دسترس نیست. لطفاً با مدیر سیستم تماس بگیرید.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">ماژول استعلام قیمت</h1>

      {error && <div className="p-3 bg-red-100 text-red-700 rounded-md">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side: Inputs */}
        <div className="md:col-span-2 space-y-6">
          {/* URL Card */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-3">۱. استخراج از آدرس اینترنتی (URL)</h2>
            <div className="flex items-center space-x-2 space-x-reverse">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/pricelist.pdf"
                className="flex-grow p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                dir="ltr"
              />
              <button
                onClick={handleIngestUrl}
                disabled={isIngesting}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-300"
              >
                {isIngesting ? 'در حال پردازش...' : 'استخراج از URL'}
              </button>
            </div>
             <p className="text-sm text-gray-500 mt-2">توجه: در نسخه فعلی (MVP)، استخراج از URL پیاده‌سازی نشده است.</p>
          </div>

          {/* Upload Card */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-3">۲. بارگذاری فایل (PDF یا تصویر)</h2>
            <div className="flex items-center space-x-2 space-x-reverse">
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.png,.jpg,.jpeg"
                className="flex-grow p-2 border rounded-md"
              />
              <button
                onClick={handleUpload}
                disabled={isUploading || !file}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-green-300"
              >
                {isUploading ? 'در حال آپلود...' : 'آپلود و استخراج'}
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-2">توجه: در نسخه فعلی (MVP)، فقط فایل‌های PDF پردازش می‌شوند و تصاویر فقط ذخیره می‌گردند (بدون OCR).</p>
          </div>

          {/* Result Display */}
          {lastResult && (
            <div className="bg-yellow-100 p-4 rounded-md border-yellow-400 border">
              <h3 className="font-semibold">نتیجه آخرین عملیات:</h3>
              <p>سند با شناسه <span className="font-mono">{lastResult.documentId}</span> ایجاد شد.</p>
              <p>تعداد <span className="font-semibold">{lastResult.itemsCount}</span> مورد استخراج شد.</p>
            </div>
          )}

        </div>

        {/* Right Side: Recent Docs */}
        <div className="bg-gray-50 p-4 rounded-lg shadow-inner">
          <h3 className="font-semibold mb-3 border-b pb-2">آخرین اسناد بارگذاری شده</h3>
          {recentDocuments.length === 0 ? (
            <p className="text-gray-500">سندی یافت نشد.</p>
          ) : (
            <ul className="space-y-2">
              {recentDocuments.map(doc => (
                <li key={doc.id}
                  onClick={() => fetchDocumentDetails(doc.id)}
                  className="p-2 rounded-md hover:bg-blue-100 cursor-pointer flex justify-between items-center"
                >
                  <div>
                    <span className="font-mono text-sm">Doc #{doc.id}</span>
                    <span className={`text-xs ml-2 px-2 py-0.5 rounded-full ${
                      doc.status === 'completed' ? 'bg-green-200 text-green-800' :
                      doc.status === 'failed' ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'
                    }`}>{doc.status}</span>
                  </div>
                  <span className="text-xs text-gray-500">{new Date(doc.created_at).toLocaleDateString('fa-IR')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Bottom Section: Item Table */}
      <div className="bg-white p-6 rounded-lg shadow-md mt-6">
          <h2 className="text-xl font-bold mb-4">
            {selectedDocument ? `اقلام استخراج شده از سند #${selectedDocument.document.id}` : 'جدول اقلام'}
          </h2>
          <PriceListTable items={selectedDocument?.items || []} isLoading={isDocLoading} />
      </div>

    </div>
  );
};

export default PriceInquiry;
