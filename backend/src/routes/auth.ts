import { Router, Request, Response } from 'express';
import { createOAuth2Instance, createConnection } from '../config/salesforce';
import { isAuthenticated } from '../middleware/auth';
import { User, AuditLog } from '../models';

const router = Router();

/**
 * GET /auth/salesforce
 *
 * Initiates the Salesforce OAuth 2.0 authentication flow.
 * Redirects the user to Salesforce login page.
 */
router.get('/salesforce', (_req: Request, res: Response) => {
  try {
    const oauth2 = createOAuth2Instance();

    // Generate the authorization URL
    const authUrl = oauth2.getAuthorizationUrl({
      scope: 'full refresh_token',
    });

    console.log('Redirecting to Salesforce OAuth:', authUrl);

    // Redirect user to Salesforce login
    res.redirect(authUrl);
  } catch (error: any) {
    console.error('Error initiating Salesforce OAuth:', error);
    res.status(500).json({
      success: false,
      error: 'OAuth initialization failed',
      message: error.message,
    });
  }
});

/**
 * POST /auth/superadmin/login
 *
 * Super admin login with email and password (NOT Salesforce OAuth).
 * Requires email and password in request body.
 */
router.post('/superadmin/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    console.log('Super admin login attempt:', email);

    // Find user by email
    const user = await User.findOne({
      where: { email },
    });

    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Verify this is a super admin
    if (!user.isSuperAdminUser()) {
      console.log('User is not a super admin:', email);
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Verify password
    const isValidPassword = await user.verifyPassword(password);
    if (!isValidPassword) {
      console.log('Invalid password for:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    console.log('Super admin authenticated:', email);

    // Store user info in session
    const session = req.session as any;
    session.userId = user.id;
    session.userInfo = {
      id: user.id,
      email: user.email,
      name: user.getFullName(),
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isSuperAdmin: true,
    };
    session.isSuperAdmin = true;

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Log the super admin login
    await AuditLog.log({
      userId: user.id,
      customerId: null,
      action: 'superadmin_login',
      resourceType: 'user',
      resourceId: user.id,
      details: {
        email: user.email,
        loginMethod: 'email_password',
      },
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });

    // Save session before responding
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({
          success: false,
          error: 'Session creation failed',
        });
      }

      res.json({
        success: true,
        data: {
          user: session.userInfo,
        },
      });
    });
  } catch (error: any) {
    console.error('Super admin login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      message: error.message,
    });
  }
});

/**
 * GET /auth/callback
 *
 * Handles the OAuth callback from Salesforce.
 * Exchanges the authorization code for access and refresh tokens.
 * Creates a session and redirects to the frontend.
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing authorization code',
        message: 'No authorization code received from Salesforce',
      });
    }

    console.log('Received OAuth callback with code');

    const oauth2 = createOAuth2Instance();

    // Exchange authorization code for access token
    const tokenResponse = await oauth2.requestToken(code);

    console.log('Token exchange successful');

    // Create connection to get user info
    const connection = createConnection(
      tokenResponse.access_token,
      tokenResponse.instance_url,
      tokenResponse.refresh_token
    );

    // Get user identity information
    const userInfo = await connection.identity();

    console.log('User authenticated:', userInfo.username);
    console.log('User info from Salesforce:', {
      display_name: userInfo.display_name,
      email: userInfo.email,
      username: userInfo.username,
    });

    // Query user profile to determine role
    let userProfile = 'Unknown';
    let userRole = 'unknown';
    try {
      const profileQuery = `
        SELECT Id, Name, Email, Username, Profile.Name
        FROM User
        WHERE Id = '${userInfo.user_id}'
        LIMIT 1
      `;
      const profileResult = await connection.query(profileQuery);
      if (profileResult.records && profileResult.records.length > 0) {
        const user = profileResult.records[0] as any;
        userProfile = user.Profile?.Name || 'Unknown';

        // Map profile to role
        const profile = userProfile.toLowerCase();
        console.log('DEBUG: Profile lowercase:', profile);
        console.log('DEBUG: Checking for "system administrator":', profile.includes('system administrator'));
        console.log('DEBUG: Checking for "administrator":', profile.includes('administrator'));

        const isAdmin = profile.includes('administrator');
        if (isAdmin) {
          userRole = 'admin';
        } else if (profile.includes('sales user')) {
          userRole = 'ae';
        } else if (profile.includes('client sales')) {
          userRole = 'am';
        } else if (profile.includes('customer success')) {
          userRole = 'csm';
        } else if (profile.includes('account executive') || profile.includes('ae')) {
          userRole = 'ae';
        } else if (profile.includes('account manager') || profile.includes('am')) {
          userRole = 'am';
        }

        console.log('User profile:', userProfile, '→ Role:', userRole, '→ Is Admin:', isAdmin);
      }
    } catch (profileError) {
      console.error('Error fetching user profile:', profileError);
      // Continue with login even if profile query fails
    }

    // Store tokens and user info in session
    const session = req.session as any;
    session.accessToken = tokenResponse.access_token;
    session.refreshToken = tokenResponse.refresh_token;
    session.instanceUrl = tokenResponse.instance_url;
    session.userId = userInfo.user_id;
    session.organizationId = userInfo.organization_id;
    session.userProfile = userProfile;
    session.userRole = userRole;
    session.isAdmin = userRole === 'admin';
    session.userInfo = {
      id: userInfo.user_id,
      email: userInfo.email,
      name: userInfo.display_name,
      username: userInfo.username,
      organizationId: userInfo.organization_id,
      profile: userProfile,
      role: userRole,
      isAdmin: userRole === 'admin',
    };

    console.log('Session userInfo stored:', session.userInfo);

    // Save session before redirecting
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({
          success: false,
          error: 'Session creation failed',
        });
      }

      // Redirect to appropriate cockpit based on role
      // In production, backend serves frontend so use relative paths
      // In development, redirect to frontend dev server
      const frontendUrl = process.env.NODE_ENV === 'production' ? '' : (process.env.FRONTEND_URL || 'http://localhost:3000');
      let redirectPath = '/dashboard'; // Default fallback

      if (userRole === 'ae') {
        redirectPath = '/dashboard/ae';
      } else if (userRole === 'am') {
        redirectPath = '/dashboard/am';
      } else if (userRole === 'csm') {
        redirectPath = '/dashboard/csm';
      }

      console.log(`Redirecting to ${redirectPath} for role ${userRole}`);
      res.redirect(`${frontendUrl}${redirectPath}`);
    });
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      message: error.message,
    });
  }
});

/**
 * GET /auth/user
 *
 * Returns the current authenticated user's information.
 * Requires authentication.
 */
router.get('/user', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    const connection = req.sfConnection;

    if (!connection) {
      return res.status(401).json({
        success: false,
        error: 'No Salesforce connection available',
      });
    }

    // If we have userInfo in session, use it (new session structure)
    if (session.userInfo) {
      return res.json({
        success: true,
        data: {
          user: session.userInfo,
          instanceUrl: session.instanceUrl,
        },
      });
    }

    // Otherwise, fetch fresh user info from Salesforce (old session structure or missing data)
    console.log('Fetching fresh user info from Salesforce...');
    const userInfo = await connection.identity();

    // Update session with new structure
    session.userInfo = {
      id: userInfo.user_id,
      email: userInfo.email,
      name: userInfo.display_name,
      username: userInfo.username,
      organizationId: userInfo.organization_id,
    };

    console.log('Updated session with user info:', session.userInfo);

    // Save session
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({
      success: true,
      data: {
        user: session.userInfo,
        instanceUrl: session.instanceUrl,
      },
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user information',
      message: error.message,
    });
  }
});

/**
 * POST /auth/logout
 *
 * Logs out the current user by destroying their session.
 */
router.post('/logout', (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    const username = session.userInfo?.username;

    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
        return res.status(500).json({
          success: false,
          error: 'Logout failed',
        });
      }

      console.log('User logged out:', username);

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      message: error.message,
    });
  }
});

/**
 * GET /auth/status
 *
 * Check if user is currently authenticated.
 * Does not require authentication (returns true/false).
 */
router.get('/status', (req: Request, res: Response) => {
  const session = req.session as any;
  const isAuthenticated = !!(
    session?.accessToken &&
    session?.instanceUrl
  );

  res.json({
    success: true,
    data: {
      authenticated: isAuthenticated,
      user: isAuthenticated ? session.userInfo : null,
    },
  });
});

/**
 * GET /auth/debug-session
 *
 * Debug endpoint to inspect current session data
 */
router.get('/debug-session', (req: Request, res: Response) => {
  const session = req.session as any;
  res.json({
    success: true,
    data: {
      hasAccessToken: !!session?.accessToken,
      hasRefreshToken: !!session?.refreshToken,
      hasInstanceUrl: !!session?.instanceUrl,
      hasUserId: !!session?.userId,
      hasOrganizationId: !!session?.organizationId,
      hasUserInfo: !!session?.userInfo,
      userInfo: session?.userInfo,
      sessionKeys: Object.keys(session || {}),
    },
  });
});

/**
 * GET /auth/current-user-profile
 *
 * Get current user's full profile including profile name.
 * Used to determine if user is admin for impersonation feature.
 * Requires authentication.
 */
router.get('/current-user-profile', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const connection = req.sfConnection;
    const session = req.session as any;
    const userId = session.userId;

    if (!connection || !userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Query current user with profile information
    const query = `
      SELECT Id, Name, Email, Username, Profile.Name
      FROM User
      WHERE Id = '${userId}'
      LIMIT 1
    `;

    const result = await connection.query(query);

    if (!result.records || result.records.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = result.records[0] as any;

    res.json({
      success: true,
      data: {
        id: user.Id,
        name: user.Name,
        email: user.Email,
        username: user.Username,
        profileName: user.Profile?.Name,
      },
    });
  } catch (error: any) {
    console.error('Error fetching current user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile',
      message: error.message,
    });
  }
});

/**
 * GET /auth/users
 *
 * Get list of active users that can be impersonated.
 * Returns users with Account Executive or similar sales roles.
 * Requires authentication.
 */
router.get('/users', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const connection = req.sfConnection;
    if (!connection) {
      return res.status(401).json({
        success: false,
        error: 'No Salesforce connection available',
      });
    }

    // Query for active users
    // You can adjust the WHERE clause to filter by specific profiles or roles
    const query = `
      SELECT Id, Name, Email, Username, Profile.Name
      FROM User
      WHERE IsActive = true
      ORDER BY Name
    `;

    const result = await connection.query(query);

    const users = result.records.map((user: any) => ({
      id: user.Id,
      name: user.Name,
      email: user.Email,
      username: user.Username,
      profileName: user.Profile?.Name,
    }));

    res.json({
      success: true,
      data: users,
      count: users.length,
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
      message: error.message,
    });
  }
});

/**
 * POST /auth/impersonate
 *
 * Start impersonating another user.
 * Stores the original userId and switches to the target user.
 * Requires authentication.
 */
router.post('/impersonate', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
    }

    // Store original user ID if not already impersonating
    if (!session.originalUserId) {
      session.originalUserId = session.userId;
      session.originalUserInfo = session.userInfo;
    }

    // Fetch the target user's info
    const connection = req.sfConnection;
    if (!connection) {
      return res.status(401).json({
        success: false,
        error: 'No Salesforce connection available',
      });
    }

    const userQuery = `SELECT Id, Name, Email, Username FROM User WHERE Id = '${userId}' LIMIT 1`;
    const userResult = await connection.query(userQuery);

    if (!userResult.records || userResult.records.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const targetUser = userResult.records[0] as any;

    // Update session to impersonate the target user
    session.userId = userId;
    session.userInfo = {
      id: targetUser.Id,
      name: targetUser.Name,
      email: targetUser.Email,
      username: targetUser.Username,
      organizationId: session.organizationId, // Keep the same org
    };
    session.isImpersonating = true;

    // Save session
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log(`User ${session.originalUserInfo.name} is now impersonating ${targetUser.Name}`);

    res.json({
      success: true,
      data: {
        impersonatedUser: session.userInfo,
        originalUser: session.originalUserInfo,
      },
    });
  } catch (error: any) {
    console.error('Error starting impersonation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start impersonation',
      message: error.message,
    });
  }
});

/**
 * POST /auth/stop-impersonation
 *
 * Stop impersonating and return to original user.
 * Requires authentication.
 */
router.post('/stop-impersonation', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const session = req.session as any;

    if (!session.isImpersonating || !session.originalUserId) {
      return res.status(400).json({
        success: false,
        error: 'Not currently impersonating',
      });
    }

    console.log(`Stopping impersonation, returning to ${session.originalUserInfo.name}`);

    // Restore original user
    session.userId = session.originalUserId;
    session.userInfo = session.originalUserInfo;
    session.isImpersonating = false;
    delete session.originalUserId;
    delete session.originalUserInfo;

    // Save session
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({
      success: true,
      data: {
        user: session.userInfo,
      },
    });
  } catch (error: any) {
    console.error('Error stopping impersonation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop impersonation',
      message: error.message,
    });
  }
});

export default router;
