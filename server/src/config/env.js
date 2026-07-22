const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

module.exports = {
  port: process.env.PORT || 4000,
  databaseUrl: process.env.DATABASE_URL,
  dbSsl: process.env.DB_SSL === 'true',
  termMergeThresholdDefault: parseFloat(process.env.TERM_MERGE_THRESHOLD || '0.85'),
  googleSearchApiKey: process.env.GOOGLE_SEARCH_API_KEY || null,
  googleSearchCx: process.env.GOOGLE_SEARCH_CX || null,
};
