import pino from 'pino';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOG_DIR = path.join(__dirname, '..', 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });
const logFile = path.join(LOG_DIR, 'server.log');

// Create a Pino logger instance
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
}, pino.destination(logFile));

export default logger;
