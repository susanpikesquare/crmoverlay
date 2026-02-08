import { Router, Request, Response } from 'express';
import { Customer, User, AuditLog } from '../models';
import { SubscriptionStatus } from '../models/Customer';
import { UserRole } from '../models/User';
import { Op } from 'sequelize';
import bcrypt from 'bcrypt';

const router = Router();

/**
 * Middleware to check if user is a super admin
 */
function isSuperAdmin(req: Request, res: Response, next: Function) {
  const session = req.session as any;

  console.log('Super admin middleware - Session check:', {
    hasSession: !!session,
    sessionData: session,
    isSuperAdmin: session?.isSuperAdmin,
    userId: session?.userId,
    sessionId: req.sessionID,
    cookies: req.headers.cookie,
    origin: req.headers.origin,
    referer: req.headers.referer,
  });

  if (!session?.isSuperAdmin) {
    console.log('Super admin access denied - not authenticated');
    return res.status(403).json({
      success: false,
      error: 'Super admin access required',
    });
  }

  next();
}

/**
 * POST /superadmin/customers
 *
 * Create a new customer.
 * Requires super admin authentication.
 */
router.post('/customers', isSuperAdmin, async (req: Request, res: Response) => {
  try {
    const {
      companyName,
      subdomain,
      salesforceInstanceUrl,
      salesforceClientId,
      salesforceClientSecret,
      subscriptionTier
    } = req.body;
    const session = req.session as any;

    // Validate required fields
    if (!companyName || !subdomain || !subscriptionTier || !salesforceInstanceUrl || !salesforceClientId || !salesforceClientSecret) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: companyName, subdomain, salesforceInstanceUrl, salesforceClientId, salesforceClientSecret, subscriptionTier',
      });
    }

    // Check if subdomain already exists
    const existingCustomer = await Customer.findOne({ where: { subdomain } });
    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        error: 'Subdomain already exists',
      });
    }

    // Create customer (credentials will be automatically encrypted by the model)
    const customer = await Customer.create({
      companyName,
      subdomain: subdomain.toLowerCase(),
      salesforceInstanceUrl,
      salesforceClientId,      // Will be encrypted by the model's setter
      salesforceClientSecret,  // Will be encrypted by the model's setter
      subscriptionTier,
      subscriptionStatus: SubscriptionStatus.TRIAL,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
      isSuspended: false,
    });

    // Log the action
    await AuditLog.log({
      userId: session.userId,
      customerId: customer.id,
      action: 'create_customer',
      resourceType: 'customer',
      resourceId: customer.id,
      details: {
        companyName,
        subdomain,
        subscriptionTier,
        createdBy: session.userInfo.name,
      },
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });

    res.status(201).json({
      success: true,
      data: {
        customer: customer.toJSON(),
      },
    });
  } catch (error: any) {
    console.error('Error creating customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create customer',
      message: error.message,
    });
  }
});

/**
 * GET /superadmin/customers
 *
 * Get list of all customers with pagination and search.
 * Requires super admin authentication.
 */
router.get('/customers', isSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, search = '', status = '' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Build where clause
    const where: any = {};

    if (search) {
      where[Op.or] = [
        { companyName: { [Op.iLike]: `%${search}%` } },
        { subdomain: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (status === 'suspended') {
      where.isSuspended = true;
    } else if (status === 'active') {
      where.isSuspended = false;
    }

    const { count, rows: customers } = await Customer.findAndCountAll({
      where,
      limit: Number(limit),
      offset,
      order: [['createdAt', 'DESC']],
      attributes: [
        'id',
        'companyName',
        'subdomain',
        'salesforceInstanceUrl',
        'subscriptionTier',
        'subscriptionStatus',
        'isSuspended',
        'suspendedReason',
        'suspendedAt',
        'trialEndsAt',
        'createdAt',
        'updatedAt',
      ],
    });

    // Get user counts for each customer
    const customerData = await Promise.all(
      customers.map(async (customer) => {
        const userCount = await User.count({
          where: { customerId: customer.id },
        });

        return {
          ...customer.toJSON(),
          userCount,
        };
      })
    );

    res.json({
      success: true,
      data: {
        customers: customerData,
        pagination: {
          total: count,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(count / Number(limit)),
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customers',
      message: error.message,
    });
  }
});

/**
 * GET /superadmin/customers/:id
 *
 * Get detailed information about a specific customer.
 * Requires super admin authentication.
 */
router.get('/customers/:id', isSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findByPk(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    // Get users for this customer
    const users = await User.findAll({
      where: { customerId: customer.id },
      attributes: ['id', 'email', 'firstName', 'lastName', 'role', 'salesforceProfile', 'lastLoginAt', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });

    // Get audit logs for this customer
    const auditLogs = await AuditLog.findAll({
      where: { customerId: customer.id },
      limit: 50,
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      data: {
        customer: customer.toJSON(),
        users,
        auditLogs,
      },
    });
  } catch (error: any) {
    console.error('Error fetching customer details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer details',
      message: error.message,
    });
  }
});

/**
 * PUT /superadmin/customers/:id
 *
 * Update a customer's settings.
 * Requires super admin authentication.
 */
router.put('/customers/:id', isSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = req.session as any;
    const {
      companyName,
      subdomain,
      salesforceInstanceUrl,
      salesforceClientId,
      salesforceClientSecret,
      subscriptionTier,
      subscriptionStatus,
    } = req.body;

    const customer = await Customer.findByPk(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    // If subdomain is being changed, check uniqueness
    if (subdomain && subdomain !== customer.subdomain) {
      const existing = await Customer.findOne({ where: { subdomain } });
      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'Subdomain already exists',
        });
      }
    }

    // Track what changed for audit log
    const changes: Record<string, { from: any; to: any }> = {};

    if (companyName !== undefined && companyName !== customer.companyName) {
      changes.companyName = { from: customer.companyName, to: companyName };
      customer.companyName = companyName;
    }
    if (subdomain !== undefined && subdomain !== customer.subdomain) {
      changes.subdomain = { from: customer.subdomain, to: subdomain };
      customer.subdomain = subdomain.toLowerCase();
    }
    if (salesforceInstanceUrl !== undefined && salesforceInstanceUrl !== customer.salesforceInstanceUrl) {
      changes.salesforceInstanceUrl = { from: customer.salesforceInstanceUrl, to: salesforceInstanceUrl };
      customer.salesforceInstanceUrl = salesforceInstanceUrl;
    }
    if (salesforceClientId !== undefined) {
      changes.salesforceClientId = { from: '(encrypted)', to: '(encrypted)' };
      customer.salesforceClientId = salesforceClientId;
    }
    if (salesforceClientSecret !== undefined) {
      changes.salesforceClientSecret = { from: '(encrypted)', to: '(encrypted)' };
      customer.salesforceClientSecret = salesforceClientSecret;
    }
    if (subscriptionTier !== undefined && subscriptionTier !== customer.subscriptionTier) {
      changes.subscriptionTier = { from: customer.subscriptionTier, to: subscriptionTier };
      customer.subscriptionTier = subscriptionTier;
    }
    if (subscriptionStatus !== undefined && subscriptionStatus !== customer.subscriptionStatus) {
      changes.subscriptionStatus = { from: customer.subscriptionStatus, to: subscriptionStatus };
      customer.subscriptionStatus = subscriptionStatus;
    }

    if (Object.keys(changes).length === 0) {
      return res.json({
        success: true,
        data: { customer: customer.toJSON() },
        message: 'No changes detected',
      });
    }

    await customer.save();

    // Log the action
    await AuditLog.log({
      userId: session.userId,
      customerId: customer.id,
      action: 'update_customer',
      resourceType: 'customer',
      resourceId: customer.id,
      details: {
        changes,
        updatedBy: session.userInfo.name,
      },
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });

    res.json({
      success: true,
      data: {
        customer: customer.toJSON(),
      },
    });
  } catch (error: any) {
    console.error('Error updating customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update customer',
      message: error.message,
    });
  }
});

/**
 * POST /superadmin/customers/:id/suspend
 *
 * Suspend a customer account.
 * Requires super admin authentication.
 */
router.post('/customers/:id/suspend', isSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const session = req.session as any;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Suspension reason is required',
      });
    }

    const customer = await Customer.findByPk(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    if (customer.isSuspended) {
      return res.status(400).json({
        success: false,
        error: 'Customer is already suspended',
      });
    }

    // Suspend the customer
    customer.isSuspended = true;
    customer.suspendedReason = reason;
    customer.suspendedAt = new Date();
    customer.suspendedByUserId = session.userId;
    await customer.save();

    // Log the action
    await AuditLog.log({
      userId: session.userId,
      customerId: customer.id,
      action: 'suspend_account',
      resourceType: 'customer',
      resourceId: customer.id,
      details: {
        reason,
        previousStatus: 'active',
        suspendedBy: session.userInfo.name,
      },
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });

    res.json({
      success: true,
      data: {
        customer: customer.toJSON(),
      },
    });
  } catch (error: any) {
    console.error('Error suspending customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to suspend customer',
      message: error.message,
    });
  }
});

/**
 * POST /superadmin/customers/:id/unsuspend
 *
 * Unsuspend a customer account.
 * Requires super admin authentication.
 */
router.post('/customers/:id/unsuspend', isSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = req.session as any;

    const customer = await Customer.findByPk(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    if (!customer.isSuspended) {
      return res.status(400).json({
        success: false,
        error: 'Customer is not suspended',
      });
    }

    const previousReason = customer.suspendedReason;

    // Unsuspend the customer
    customer.isSuspended = false;
    customer.suspendedReason = null;
    customer.suspendedAt = null;
    customer.suspendedByUserId = null;
    await customer.save();

    // Log the action
    await AuditLog.log({
      userId: session.userId,
      customerId: customer.id,
      action: 'unsuspend_account',
      resourceType: 'customer',
      resourceId: customer.id,
      details: {
        previousReason,
        unsuspendedBy: session.userInfo.name,
      },
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });

    res.json({
      success: true,
      data: {
        customer: customer.toJSON(),
      },
    });
  } catch (error: any) {
    console.error('Error unsuspending customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unsuspend customer',
      message: error.message,
    });
  }
});

/**
 * GET /superadmin/audit-logs
 *
 * Get audit logs with filtering and pagination.
 * Requires super admin authentication.
 */
router.get('/audit-logs', isSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, action = '', customerId = '', userId = '' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Build where clause
    const where: any = {};

    if (action) {
      where.action = action;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (userId) {
      where.userId = userId;
    }

    const { count, rows: auditLogs } = await AuditLog.findAndCountAll({
      where,
      limit: Number(limit),
      offset,
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      data: {
        auditLogs,
        pagination: {
          total: count,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(count / Number(limit)),
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs',
      message: error.message,
    });
  }
});

/**
 * GET /superadmin/stats
 *
 * Get platform-wide statistics.
 * Requires super admin authentication.
 */
router.get('/stats', isSuperAdmin, async (req: Request, res: Response) => {
  try {
    // Get customer counts
    const totalCustomers = await Customer.count();
    const activeCustomers = await Customer.count({ where: { isSuspended: false } });
    const suspendedCustomers = await Customer.count({ where: { isSuspended: true } });

    // Get user counts
    const totalUsers = await User.count({ where: { isSuperAdmin: false } });
    const superAdmins = await User.count({ where: { isSuperAdmin: true } });

    // Get users by role
    const usersByRole = await User.findAll({
      where: { isSuperAdmin: false },
      attributes: [
        'role',
        [Customer.sequelize!.fn('COUNT', Customer.sequelize!.col('id')), 'count'],
      ],
      group: ['role'],
      raw: true,
    });

    res.json({
      success: true,
      data: {
        customers: {
          total: totalCustomers,
          active: activeCustomers,
          suspended: suspendedCustomers,
        },
        users: {
          total: totalUsers,
          superAdmins,
          byRole: usersByRole,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message,
    });
  }
});

/**
 * POST /superadmin/users
 *
 * Create a new super admin user.
 * Requires super admin authentication.
 */
router.post('/users', isSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    const session = req.session as any;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, password, firstName, lastName',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
    }

    // Validate password length
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'A user with this email already exists',
      });
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create super admin user (no customerId, isSuperAdmin = true)
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash: hashedPassword,
      firstName,
      lastName,
      isSuperAdmin: true,
      role: UserRole.SUPER_ADMIN,
      // No customerId - super admins are not associated with any customer
    });

    // Log the action
    await AuditLog.log({
      userId: session.userId,
      customerId: null,
      action: 'create_super_admin',
      resourceType: 'user',
      resourceId: user.id,
      details: {
        email: user.email,
        firstName,
        lastName,
        createdBy: session.userInfo.name,
      },
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isSuperAdmin: user.isSuperAdmin,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error: any) {
    console.error('Error creating super admin user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create super admin user',
      message: error.message,
    });
  }
});

/**
 * POST /superadmin/customers/:id/users
 *
 * Create an admin user for a specific customer.
 * Requires super admin authentication.
 */
router.post('/customers/:id/users', isSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id: customerId } = req.params;
    const { email, password, firstName, lastName } = req.body;
    const session = req.session as any;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, password, firstName, lastName',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
    }

    // Validate password length
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
      });
    }

    // Verify customer exists
    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'A user with this email already exists',
      });
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create admin user for the customer
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash: hashedPassword,
      firstName,
      lastName,
      customerId,
      role: UserRole.ADMIN,
      isSuperAdmin: false,
    });

    // Log the action
    await AuditLog.log({
      userId: session.userId,
      customerId,
      action: 'create_admin_user',
      resourceType: 'user',
      resourceId: user.id,
      details: {
        email: user.email,
        firstName,
        lastName,
        customerName: customer.companyName,
        createdBy: session.userInfo.name,
      },
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          customerId: user.customerId,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error: any) {
    console.error('Error creating admin user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create admin user',
      message: error.message,
    });
  }
});

export default router;
