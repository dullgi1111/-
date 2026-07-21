const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsRoot = path.join(__dirname, '../../uploads');

// Busboy (multer's underlying parser) decodes the multipart filename field as
// latin1 by default, even though browsers send it as raw UTF-8 bytes — this
// mangles any non-ASCII filename (Korean, etc.) into mojibake. Re-decode it.
function fixFilenameEncoding(name) {
  const fixed = Buffer.from(name, 'latin1').toString('utf8');
  return fixed.includes('�') ? name : fixed;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadsRoot, 'tmp');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const ALLOWED_EXT = new Set(['.xlsx', '.xls', '.csv']);

function fileFilter(req, file, cb) {
  file.originalname = fixFilenameEncoding(file.originalname);
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return cb(new Error('지원하지 않는 파일 형식입니다 (.xlsx, .xls, .csv만 허용)'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

const DICTIONARY_ALLOWED_EXT = new Set(['.pdf', '.docx', '.xlsx', '.xls', '.csv']);

function dictionaryFileFilter(req, file, cb) {
  file.originalname = fixFilenameEncoding(file.originalname);
  const ext = path.extname(file.originalname).toLowerCase();
  if (!DICTIONARY_ALLOWED_EXT.has(ext)) {
    return cb(new Error('지원하지 않는 파일 형식입니다 (.pdf, .docx, .xlsx, .xls, .csv만 허용)'));
  }
  cb(null, true);
}

const uploadDictionaryFile = multer({
  storage,
  fileFilter: dictionaryFileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

module.exports = { upload, uploadDictionaryFile, uploadsRoot };
