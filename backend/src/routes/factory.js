const router = require('express').Router();
const { getSettings, updateSettings } = require('../controllers/factoryController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

router.get('/', authenticate, getSettings);
router.put('/', authenticate, requireAdmin, upload.single('logo'), updateSettings);

module.exports = router;
