import { Request, Response, NextFunction } from 'express';
import { createConnection } from '../config/salesforce';

/**
 * Authentication middleware that checks if user has a valid Salesforce session
 *
 * This middleware:
 * 1. Checks if the user has an active session with Salesforce tokens
 * 2. Creates a Salesforce connection and attaches it to the request
 * 3. Handles automatic token refresh if the access token has expired
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export const isAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const session = req.session as any;
    // Check if session exists and has required tokens
    if (!req.session || !session.accessToken || !session.instanceUrl) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated',
        message: 'Please log in with Salesforce to access this resource',
      });
      return;
    }

    const { accessToken, instanceUrl, refreshToken } = session;

    // Create Salesforce connection with session tokens
    const connection = createConnection(accessToken, instanceUrl, refreshToken);

    // Attach connection to request for use in route handlers
    req.sfConnection = connection;

    // Optional: Verify the connection is valid by making a lightweight API call
    try {
      await connection.identity();
    } catch (error: any) {
      // If identity check fails, the token might be expired
      // If we have a refresh token, jsforce will automatically refresh
      if (error.name === 'INVALID_SESSION_ID' && refreshToken) {
        console.log('Access token expired, attempting refresh...');

        // Try to refresh the connection
        try {
          // The connection should auto-refresh with the refresh token
          const newAccessToken = connection.accessToken;

          // Update session with new token
          if (newAccessToken && newAccessToken !== accessToken) {
            session.accessToken = newAccessToken;
            console.log('Token refreshed successfully');
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          res.status(401).json({
            success: false,
            error: 'Session expired',
            message: 'Your session has expired. Please log in again.',
          });
          return;
        }
      } else {
        // No refresh token or other error
        console.error('Authentication error:', error);
        res.status(401).json({
          success: false,
          error: 'Authentication failed',
          message: 'Unable to verify your Salesforce session. Please log in again.',
        });
        return;
      }
    }

    // If we got here, authentication is successful
    next();
  } catch (error: any) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An error occurred during authentication',
    });
  }
};

/**
 * Optional authentication middleware
 *
 * Similar to isAuthenticated, but doesn't return an error if user is not authenticated.
 * Instead, it just attaches the connection if available and continues.
 * Useful for routes that have optional authentication.
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const session = req.session as any;
    if (session?.accessToken && session?.instanceUrl) {
      const { accessToken, instanceUrl, refreshToken } = session;
      req.sfConnection = createConnection(accessToken, instanceUrl, refreshToken);
    }
    next();
  } catch (error) {
    // Continue even if there's an error setting up the connection
    console.error('Optional auth error:', error);
    next();
  }
};
