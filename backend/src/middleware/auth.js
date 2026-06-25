import jwt from 'jsonwebtoken';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify the JWT token locally
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
    }

    // Attach user object containing organisation_id to the request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      organisation_id: decoded.organisation_id
    };
    
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Internal server error during auth verification' });
  }
};
