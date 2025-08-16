-- Migration for Price Inquiry Module

-- Table to store sources of price information (e.g., a specific website, a Telegram channel)
CREATE TABLE IF NOT EXISTS price_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT CHECK(type IN ('website', 'telegram', 'whatsapp', 'upload')) NOT NULL,
    name TEXT NOT NULL, -- e.g., "Kourosh Website", "Supplier Telegram"
    handle TEXT, -- e.g., URL for website, channel name for telegram
    meta_json TEXT, -- For any extra metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table to store documents (PDFs, images) containing price lists
CREATE TABLE IF NOT EXISTS price_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER,
    storage_path TEXT NOT NULL UNIQUE, -- Relative path to the file in `uploads/`
    original_url TEXT, -- If downloaded from a URL
    mime TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed')) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES price_sources(id)
);
CREATE INDEX IF NOT EXISTS idx_price_documents_source_id ON price_documents(source_id);
CREATE INDEX IF NOT EXISTS idx_price_documents_sha256 ON price_documents(sha256);


-- A single price list, usually corresponds to one document
CREATE TABLE IF NOT EXISTS price_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    vendor TEXT,
    currency TEXT DEFAULT 'IRR',
    effective_date DATE,
    confidence REAL, -- Confidence score for the overall list extraction
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES price_documents(id)
);
CREATE INDEX IF NOT EXISTS idx_price_lists_document_id ON price_lists(document_id);


-- Individual items within a price list
CREATE TABLE IF NOT EXISTS price_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    price_list_id INTEGER NOT NULL,
    title_raw TEXT NOT NULL, -- The exact text extracted from the document
    unit TEXT, -- e.g., 'kg', 'box', 'item'
    pack_size INTEGER DEFAULT 1,
    unit_price REAL NOT NULL,
    currency TEXT DEFAULT 'IRR',
    confidence REAL, -- Confidence score for this specific item row
    product_id INTEGER, -- Optional: link to a product in the main products table
    notes TEXT,
    FOREIGN KEY (price_list_id) REFERENCES price_lists(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE INDEX IF NOT EXISTS idx_price_items_price_list_id ON price_items(price_list_id);
CREATE INDEX IF NOT EXISTS idx_price_items_title_raw ON price_items(title_raw);
