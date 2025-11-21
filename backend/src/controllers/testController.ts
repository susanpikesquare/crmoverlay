import { Request, Response } from 'express';
import { ApiResponse } from '../types';

// Health check endpoint
export const healthCheck = (_req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    message: 'Server is running',
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }
  };

  res.json(response);
};

// Test endpoint
export const testEndpoint = (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    message: 'API is working',
    data: {
      receivedBody: req.body,
      timestamp: new Date().toISOString(),
    }
  };

  res.json(response);
};
