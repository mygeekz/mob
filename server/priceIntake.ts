import { Router } from 'express';
import multer from 'multer';
import path, { dirname } from 'path';
import fs from 'fs/promises';
import { createHash } from 'crypto';
import pdf from 'pdf-parse';
import { getDbInstance, runAsync, getAsync, allAsync } from './database';
import logger from './logger';
import { priceInquiryRequestsTotal, priceInquiryParseDurationSeconds } from './metrics';

const router = Router();

// --- Feature Flag Middleware ---
const isPriceInquiryEnabled = (req: any, res: any, next: any) => {
  if (process.env.FEATURE_PRICE_INQUIRY !== 'true') {
    logger.warn({
      requestId: req.id,
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
    }, 'Price inquiry feature is disabled. Access denied.');
    return res.status(403).json({ success: false, message: 'Price inquiry feature is currently disabled.' });
  }
  next();
};

import { fileURLToPath } from 'url';

// All routes in this file will use the feature flag middleware
router.use(isPriceInquiryEnabled);


// --- Multer Setup for File Uploads ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'price-intake');
fs.mkdir(UPLOAD_DIR, { recursive: true }); // Ensure directory exists

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});
const upload = multer({ storage });


// --- Helper Functions ---

/**
 * Calculates the SHA256 hash of a file.
 * @param filePath The path to the file.
 * @returns A promise that resolves with the SHA256 hash.
 */
async function sha256File(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  return createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Normalizes Persian/Arabic digits to English digits.
 * @param str The string to normalize.
 * @returns The normalized string.
 */
function normalizeDigits(str: string): string {
  if (!str) return '';
  return str.replace(/[\u06F0-\u06F9\u0660-\u0669]/g, c => String(c.charCodeAt(0) & 0x0F));
}

/**
 * A simple regex-based function to extract price rows from text.
 * This is a placeholder and will likely need to be much more sophisticated.
 * @param text The text content from the PDF.
 * @returns An array of extracted item rows.
 */
function extractPriceRowsFromText(text: string): any[] {
    const lines = text.split('\n');
    const items = [];
    // This regex is a simple example. It looks for lines that seem to have a price.
    // It might need to be adjusted for different formats.
    const priceRegex = /(\d{1,3}(,\d{3})*(\.\d+)?|\d+(\.\d+)?)\s*$/;

    for (const line of lines) {
        const normalizedLine = normalizeDigits(line.trim());
        if (priceRegex.test(normalizedLine)) {
            // A very basic split. This assumes the price is the last part of the line.
            const parts = normalizedLine.split(/\s+/);
            const price = parseFloat(parts[parts.length - 1].replace(/,/g, ''));
            const title = parts.slice(0, parts.length - 1).join(' ');
            if (title && !isNaN(price)) {
                items.push({
                    title_raw: line.trim(), // Keep original line
                    unit_price: price,
                    currency: 'IRR', // Assuming IRR
                    confidence: 0.7, // Assign a default confidence
                });
            }
        }
    }
    return items;
}


// --- Database Helper Functions ---

async function ensurePriceSource(type: 'upload' | 'url', name: string, handle?: string): Promise<number> {
    const db = await getDbInstance();
    const source = await getAsync("SELECT id FROM price_sources WHERE type = ? AND name = ?", [type, name]);
    if (source) {
        return source.id;
    }
    const result = await runAsync("INSERT INTO price_sources (type, name, handle) VALUES (?, ?, ?)", [type, name, handle || null]);
    return result.lastID;
}

async function insertPriceDocument(data: { source_id: number, storage_path: string, original_url?: string, mime: string, sha256: string, status: string, error_message?: string }): Promise<number> {
    const db = await getDbInstance();
    const result = await runAsync(
        "INSERT INTO price_documents (source_id, storage_path, original_url, mime, sha256, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [data.source_id, data.storage_path, data.original_url, data.mime, data.sha256, data.status, data.error_message]
    );
    return result.lastID;
}

async function updateDocumentStatus(documentId: number, status: 'completed' | 'failed', errorMessage?: string) {
    const db = await getDbInstance();
    await runAsync(
        "UPDATE price_documents SET status = ?, error_message = ? WHERE id = ?",
        [status, errorMessage || null, documentId]
    );
}

async function insertPriceListAndItems(documentId: number, items: any[]): Promise<{ priceListId: number, itemsCount: number }> {
    const db = await getDbInstance();
    await runAsync("BEGIN TRANSACTION");
    try {
        const listResult = await runAsync(
            "INSERT INTO price_lists (document_id, vendor, currency, confidence) VALUES (?, ?, ?, ?)",
            [documentId, 'Unknown', 'IRR', 0.8] // Placeholder values
        );
        const priceListId = listResult.lastID;

        if (items.length > 0) {
            const stmt = await db!.prepare("INSERT INTO price_items (price_list_id, title_raw, unit_price, currency, confidence) VALUES (?, ?, ?, ?, ?)");
            for (const item of items) {
                await new Promise<void>((resolve, reject) => {
                    stmt.run([priceListId, item.title_raw, item.unit_price, item.currency, item.confidence], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }
            await new Promise<void>((resolve, reject) => {
                stmt.finalize(err => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }

        await runAsync("COMMIT");
        return { priceListId, itemsCount: items.length };
    } catch (error: any) {
        await runAsync("ROLLBACK");
        logger.error({ error: error.message }, "Failed to insert price list and items.");
        throw error;
    }
}


// --- Core Processing Logic ---

async function processAndStorePriceFile(filePath: string, originalName: string, mimeType: string, source_type: 'upload' | 'url', url?: string): Promise<{ documentId: number, itemsCount: number, isDuplicate?: boolean, duplicateId?: number }> {
    const end = priceInquiryParseDurationSeconds.startTimer({ source_type });
    let documentId: number | null = null;
    try {
        const fileHash = await sha256File(filePath);

        const existingDoc = await getAsync("SELECT id FROM price_documents WHERE sha256 = ?", [fileHash]);
        if (existingDoc) {
            logger.info({ sha256: fileHash, existingId: existingDoc.id }, "Duplicate file detected. Skipping processing.");
            return { documentId: existingDoc.id, itemsCount: 0, isDuplicate: true, duplicateId: existingDoc.id };
        }

        const sourceId = await ensurePriceSource(source_type, source_type === 'upload' ? originalName : new URL(url!).hostname);

        // Insert initial document record
        documentId = await insertPriceDocument({
            source_id: sourceId,
            storage_path: path.basename(filePath),
            original_url: url,
            mime: mimeType,
            sha256: fileHash,
            status: 'processing',
        });

        let items: any[] = [];
        if (mimeType === 'application/pdf') {
            const dataBuffer = await fs.readFile(filePath);
            const pdfData = await pdf(dataBuffer);
            items = extractPriceRowsFromText(pdfData.text);
        } else {
            // For images or other types, we just store the document but don't parse.
            logger.info({ documentId, mimeType }, "Document is not a PDF, storing without parsing items.");
        }

        const { itemsCount } = await insertPriceListAndItems(documentId, items);

        await updateDocumentStatus(documentId, 'completed');
        logger.info({ documentId, itemsCount, source: originalName }, "Successfully processed and stored price document.");
        end(); // Stop the timer on success
        return { documentId, itemsCount };

    } catch (error: any) {
        logger.error({ error: error.message, documentId }, "Error processing price file.");
        if (documentId) {
            await updateDocumentStatus(documentId, 'failed', error.message);
        }
        end(); // Stop the timer on failure as well
        throw error;
    }
}

// --- API Routes ---

router.post('/upload', upload.single('priceFile'), async (req: any, res: any) => {
    const requestId = req.id || 'unknown';
    logger.info({ requestId, file: req.file }, "Received price file upload.");

    if (!req.file) {
        priceInquiryRequestsTotal.inc({ method: 'POST', route: '/api/price-intake/upload', status_code: 400 });
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    try {
        const result = await processAndStorePriceFile(req.file.path, req.file.originalname, req.file.mimetype, 'upload');

        if (result.isDuplicate) {
            priceInquiryRequestsTotal.inc({ method: 'POST', route: '/api/price-intake/upload', status_code: 409 });
            logger.info({ metric: 'price_inquiry_requests_total' }, "Metric incremented for duplicate upload.");
            // The file is a duplicate, so we don't need the newly uploaded one.
            await fs.unlink(req.file.path).catch(err => logger.error({ error: err.message }, "Failed to delete duplicate temp file."));
            return res.status(409).json({
                success: false,
                isDuplicate: true,
                duplicateId: result.duplicateId,
                message: `این فایل قبلاً با شناسه ${result.duplicateId} ثبت شده است.`
            });
        }

        priceInquiryRequestsTotal.inc({ method: 'POST', route: '/api/price-intake/upload', status_code: 201 });
        res.status(201).json({ success: true, documentId: result.documentId, itemsCount: result.itemsCount, message: 'File processed successfully.' });

    } catch (error: any) {
        priceInquiryRequestsTotal.inc({ method: 'POST', route: '/api/price-intake/upload', status_code: 500 });
        // Clean up the uploaded file on a processing failure
        await fs.unlink(req.file.path).catch(err => logger.error({ error: err.message }, "Failed to delete temp file on error."));
        res.status(500).json({ success: false, message: error.message || 'Failed to process file.' });
    }
});


router.post('/ingest-url', async (req, res) => {
    // This is a placeholder for the URL ingestion logic.
    // In a real implementation, you would:
    // 1. Validate the URL.
    // 2. Download the file from the URL.
    // 3. Determine the mime type.
    // 4. Save it to a temporary file in the UPLOAD_DIR.
    // 5. Call processAndStorePriceFile with the downloaded file path.
    priceInquiryRequestsTotal.inc({ method: 'POST', route: '/api/price-intake/ingest-url', status_code: 501 });
    res.status(501).json({ success: false, message: 'URL ingestion is not yet implemented.' });
});

router.get('/documents', async (req, res) => {
    try {
        const documents = await allAsync(
            "SELECT id, storage_path, original_url, status, created_at FROM price_documents ORDER BY created_at DESC LIMIT 50"
        );
        priceInquiryRequestsTotal.inc({ method: 'GET', route: '/api/price-intake/documents', status_code: 200 });
        res.json({ success: true, data: documents });
    } catch (error: any) {
        priceInquiryRequestsTotal.inc({ method: 'GET', route: '/api/price-intake/documents', status_code: 500 });
        logger.error({ error: error.message }, "Failed to fetch price documents.");
        res.status(500).json({ success: false, message: 'Failed to fetch documents.' });
    }
});

router.get('/documents/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const document = await getAsync("SELECT * FROM price_documents WHERE id = ?", [id]);
        if (!document) {
            priceInquiryRequestsTotal.inc({ method: 'GET', route: '/api/price-intake/documents/:id', status_code: 404 });
            return res.status(404).json({ success: false, message: 'Document not found.' });
        }

        const priceList = await getAsync("SELECT * FROM price_lists WHERE document_id = ?", [id]);
        let items = [];
        if (priceList) {
            items = await allAsync("SELECT * FROM price_items WHERE price_list_id = ? ORDER BY id ASC", [priceList.id]);
        }
        priceInquiryRequestsTotal.inc({ method: 'GET', route: '/api/price-intake/documents/:id', status_code: 200 });
        res.json({ success: true, data: { document, priceList, items } });

    } catch (error: any) {
        priceInquiryRequestsTotal.inc({ method: 'GET', route: '/api/price-intake/documents/:id', status_code: 500 });
        logger.error({ error: error.message, documentId: id }, "Failed to fetch document details.");
        res.status(500).json({ success: false, message: 'Failed to fetch document details.' });
    }
});


export default router;
