const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { code: 'AUTH_TOKEN_MISSING', message: 'No token provided' } });
  }
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Invalid or expired token' } });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: { code: 'AUTH_INSUFFICIENT_PERMISSIONS', message: 'Admin access required' } });
  }
  next();
};

module.exports = { authenticate, requireAdmin };
