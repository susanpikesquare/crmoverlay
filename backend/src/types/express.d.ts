import { Connection } from 'jsforce';

declare global {
  namespace Express {
    interface Request {
      sfConnection?: Connection;
    }
  }
}

// Extend express-session with our custom session properties
declare module 'express-session' {
  interface SessionData {
    accessToken?: string;
    refreshToken?: string;
    instanceUrl?: string;
    userId?: string;
    organizationId?: string;
    userProfile?: string;
    userRole?: string;
    isAdmin?: boolean;
    userInfo?: {
      id: string;
      email: string;
      name: string;
      username?: string;
      organizationId?: string;
      profile?: string;
      role?: string;
      isAdmin?: boolean;
      isSuperAdmin?: boolean;
      firstName?: string;
      lastName?: string;
    };
    isImpersonating?: boolean;
    originalUserId?: string;
    originalUserInfo?: any;
    isSuperAdmin?: boolean;
    oauthCustomerId?: string;
  }
}
