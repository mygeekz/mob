import { Registry, Counter, Histogram } from 'prom-client';

// Create a Registry which registers the metrics
const register = new Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'kourosh-inventory-backend'
});

// Enable the collection of default metrics
// collectDefaultMetrics({ register });

// --- Metrics for Price Inquiry Feature ---

export const priceInquiryRequestsTotal = new Counter({
  name: 'price_inquiry_requests_total',
  help: 'Total number of requests to the price inquiry API',
  labelNames: ['method', 'route', 'status_code'],
});

export const priceInquiryParseDurationSeconds = new Histogram({
  name: 'price_inquiry_parse_duration_seconds',
  help: 'Histogram of PDF/URL parsing duration in seconds',
  labelNames: ['source_type'], // e.g., 'upload', 'url'
  // Buckets for response time from 0.1s to 30s
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});


// Register the metrics
register.registerMetric(priceInquiryRequestsTotal);
register.registerMetric(priceInquiryParseDurationSeconds);

export default register;
