import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to check if user is an administrator
 * Must be used after isAuthenticated middleware
 */
export function isAdmin(req: Request, res: Response, next: NextFunction) {
  const session = req.session as any;

  if (!session || !session.userInfo) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'You must be logged in to access this resource',
    });
  }

  if (!session.isAdmin && session.userRole !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'You must be an administrator to access this resource',
    });
  }

  // User is admin, continue
  next();
}
