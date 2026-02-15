// Load environment variables BEFORE any other imports
// (encryption.ts reads ENCRYPTION_KEY at module load time)
import dotenv from 'dotenv';
dotenv.config();

import express, { Express } from 'express';
import cors from 'cors';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import path from 'path';
import { Pool } from 'pg';
import routes from './routes';
import authRoutes from './routes/auth';
import apiRoutes from './routes/api';
import adminRoutes from './routes/admin';
import superadminRoutes from './routes/superadmin';
import accountPlanRoutes from './routes/accountPlans';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Create Express app
const app: Express = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration - use PostgreSQL in production, memory store for local dev
const PgSession = connectPgSimple(session);

// Parse DATABASE_URL for session store (handle Heroku's postgres:// protocol)
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/formation_dev';
const sessionConnectionString = DATABASE_URL.replace(/^postgres:\/\//, 'postgresql://');

// Determine if we should use PostgreSQL or in-memory sessions
const usePostgres = process.env.NODE_ENV === 'production' || process.env.USE_POSTGRES_SESSIONS === 'true';

// Session configuration options
const sessionConfig: session.SessionOptions = {
  secret: process.env.SESSION_SECRET || 'revenue-intelligence-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
  proxy: process.env.NODE_ENV === 'production',
};

if (usePostgres) {
  // Create PostgreSQL pool with SSL configuration for production
  const sessionPool = new Pool({
    connectionString: sessionConnectionString,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false,
    } : false,
  });

  sessionConfig.store = new PgSession({
    pool: sessionPool,
    tableName: 'session',
    createTableIfMissing: true,
  });
  console.log('Using PostgreSQL session store');
} else {
  // Use default in-memory session store for local development
  console.log('Using in-memory session store (PostgreSQL not configured)');
}

app.use(session(sessionConfig));

// Request logging middleware
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/auth', authRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/account-plans', accountPlanRoutes);
app.use('/api', apiRoutes);
app.use('/', routes);

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist');

  // Serve static files
  app.use(express.static(frontendPath));

  // All non-API routes serve index.html (for React Router)
  app.get('*', (req, res) => {
    // Skip API routes
    if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// 404 handler (for non-production or API routes not found)
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log('=================================');
  console.log('Formation by PikeSquare');
  console.log('=================================');
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log('=================================');
});

export default app;
