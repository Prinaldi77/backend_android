const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Gunakan folder /tmp di Vercel, jika di lokal gunakan folder uploads
const isVercel = process.env.VERCEL || process.env.NOW_BUILDER;
const uploadDir = isVercel ? '/tmp' : path.join(__dirname, '../../uploads');

if (!isVercel) {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}

// Konfigurasi Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Filter untuk tipe file
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();
  
  if (allowedTypes.test(ext) || allowedTypes.test(mime)) {
    cb(null, true);
  } else {
    cb(new Error('Tipe file tidak didukung!'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

module.exports = upload;
