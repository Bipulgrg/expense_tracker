import { verifyToken } from '../lib/auth.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [type, token] = header.split(' ');

  if (type !== 'Bearer' || !token) {
    return res.status(401).json({
      error: {
        message: 'Unauthorized',
      },
    });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({
      error: {
        message: 'Invalid token',
      },
    });
  }
}
