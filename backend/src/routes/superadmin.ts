import { Router, Request, Response } from 'express';
import { Customer, User, AuditLog } from '../models';
import { Op } from 'sequelize';

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
    const { companyName, subdomain, salesforceInstanceUrl, subscriptionTier } = req.body;
    const session = req.session as any;

    // Validate required fields
    if (!companyName || !subdomain || !subscriptionTier) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: companyName, subdomain, subscriptionTier',
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

    // Create customer
    const customer = await Customer.create({
      companyName,
      subdomain: subdomain.toLowerCase(),
      salesforceInstanceUrl: salesforceInstanceUrl || null,
      subscriptionTier,
      subscriptionStatus: 'trial',
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

export default router;
