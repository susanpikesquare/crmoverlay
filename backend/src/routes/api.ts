import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../middleware/auth';
import * as SFData from '../services/salesforceData';
import * as HubData from '../services/hubData';

const router = Router();

/**
 * Map Salesforce Profile to app role
 */
function mapProfileToRole(profileName: string): 'sales-leader' | 'ae' | 'am' | 'csm' | 'unknown' {
  const profile = profileName.toLowerCase();

  // Check for sales leadership roles first
  if (
    profile.includes('sales manager') ||
    profile.includes('vp sales') ||
    profile.includes('cro') ||
    profile.includes('chief revenue') ||
    profile.includes('sales director') ||
    profile.includes('system administrator')
  ) {
    return 'sales-leader';
  }

  if (profile.includes('sales user')) {
    return 'ae';
  } else if (profile.includes('client sales')) {
    return 'am';
  } else if (profile.includes('customer success')) {
    return 'csm';
  }

  // Default fallback - try to guess from profile name
  if (profile.includes('account executive') || profile.includes('ae')) {
    return 'ae';
  } else if (profile.includes('account manager') || profile.includes('am')) {
    return 'am';
  }

  return 'unknown';
}

/**
 * GET /api/user/me
 * Returns the current authenticated user's information from Salesforce
 * including their profile and mapped role for hub routing
 */
router.get('/user/me', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const connection = req.sfConnection;
    const session = req.session as any;
    const userId = session.userId;

    if (!connection || !userId) {
      return res.status(401).json({
        success: false,
        error: 'No Salesforce connection available',
      });
    }

    // Query user with profile information
    const query = `
      SELECT Id, Name, Email, Username, Profile.Name, Profile.Id
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
    const profileName = user.Profile?.Name || 'Unknown';
    const role = mapProfileToRole(profileName);

    // Store profile and role in session for future use
    session.userProfile = profileName;
    session.userRole = role;

    res.json({
      success: true,
      data: {
        id: user.Id,
        name: user.Name,
        email: user.Email,
        username: user.Username,
        organizationId: session.organizationId,
        profile: profileName,
        profileId: user.Profile?.Id,
        role: role,
        isImpersonating: session.isImpersonating || false,
      },
    });
  } catch (error: any) {
    console.error('Error fetching user info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user information',
      message: error.message,
    });
  }
});

/**
 * GET /api/accounts
 * Returns all accounts owned by the current user with optional filtering
 */
router.get('/accounts', isAuthenticated, async (req: Request, res: Response) => {
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

    let accounts = await SFData.getAllAccounts(connection, userId);

    // Apply client-side filters
    const { priority, search } = req.query;

    if (priority) {
      accounts = accounts.filter(acc =>
        acc.Priority_Tier__c?.includes(priority as string)
      );
    }

    if (search) {
      const searchLower = (search as string).toLowerCase();
      accounts = accounts.filter(
        acc =>
          acc.Name.toLowerCase().includes(searchLower) ||
          (acc.Industry && acc.Industry.toLowerCase().includes(searchLower))
      );
    }

    // Sort by priority score descending
    accounts.sort((a, b) => (b.Priority_Score__c || 0) - (a.Priority_Score__c || 0));

    res.json({
      success: true,
      data: accounts,
      count: accounts.length,
    });
  } catch (error: any) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch accounts',
      message: error.message,
    });
  }
});

/**
 * GET /api/accounts/high-priority
 * Returns accounts with high priority scores (85+)
 */
router.get('/accounts/high-priority', isAuthenticated, async (req: Request, res: Response) => {
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

    const accounts = await SFData.getHighPriorityAccounts(connection, userId);

    res.json({
      success: true,
      data: accounts,
      count: accounts.length,
    });
  } catch (error: any) {
    console.error('Error fetching high priority accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch high priority accounts',
      message: error.message,
    });
  }
});

/**
 * GET /api/accounts/:id
 * Returns a specific account by ID
 */
router.get('/accounts/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const connection = req.sfConnection;
    const { id } = req.params;

    if (!connection) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const account = await SFData.getAccountById(connection, id);

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
      });
    }

    res.json({
      success: true,
      data: account,
    });
  } catch (error: any) {
    console.error('Error fetching account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch account',
      message: error.message,
    });
  }
});

/**
 * GET /api/opportunities
 * Returns all opportunities owned by the current user with optional filtering
 */
router.get('/opportunities', isAuthenticated, async (req: Request, res: Response) => {
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

    let opportunities = await SFData.getAllOpportunities(connection, userId);

    // Apply client-side filters
    const { stage, atRisk } = req.query;

    if (stage) {
      opportunities = opportunities.filter(opp => opp.StageName === stage);
    }

    if (atRisk === 'true') {
      opportunities = opportunities.filter(opp => opp.IsAtRisk__c);
    }

    // Sort by close date
    opportunities.sort((a, b) => {
      const dateA = a.CloseDate ? new Date(a.CloseDate).getTime() : 0;
      const dateB = b.CloseDate ? new Date(b.CloseDate).getTime() : 0;
      return dateA - dateB;
    });

    res.json({
      success: true,
      data: opportunities,
      count: opportunities.length,
    });
  } catch (error: any) {
    console.error('Error fetching opportunities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch opportunities',
      message: error.message,
    });
  }
});

/**
 * GET /api/opportunities/at-risk
 * Returns opportunities that are at risk
 */
router.get('/opportunities/at-risk', isAuthenticated, async (req: Request, res: Response) => {
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

    const opportunities = await SFData.getAtRiskOpportunities(connection, userId);

    res.json({
      success: true,
      data: opportunities,
      count: opportunities.length,
    });
  } catch (error: any) {
    console.error('Error fetching at-risk opportunities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch at-risk opportunities',
      message: error.message,
    });
  }
});

/**
 * GET /api/opportunities/:id
 * Returns a specific opportunity by ID with full details
 */
router.get('/opportunities/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const connection = req.sfConnection;
    const { id } = req.params;

    if (!connection) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const opportunity = await SFData.getOpportunityById(connection, id);

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        error: 'Opportunity not found',
      });
    }

    res.json({
      success: true,
      data: opportunity,
    });
  } catch (error: any) {
    console.error('Error fetching opportunity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch opportunity',
      message: error.message,
    });
  }
});

/**
 * GET /api/accounts/:accountId/opportunities
 * Returns all opportunities for a specific account
 */
router.get('/accounts/:accountId/opportunities', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const connection = req.sfConnection;
    const { accountId } = req.params;

    if (!connection) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const opportunities = await SFData.getOpportunitiesByAccountId(connection, accountId);

    res.json({
      success: true,
      data: opportunities,
      count: opportunities.length,
    });
  } catch (error: any) {
    console.error('Error fetching account opportunities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch account opportunities',
      message: error.message,
    });
  }
});

/**
 * GET /api/dashboard/stats
 * Returns dashboard statistics and metrics
 */
router.get('/dashboard/stats', isAuthenticated, async (req: Request, res: Response) => {
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

    const stats = await SFData.getDashboardStats(connection, userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard stats',
      message: error.message,
    });
  }
});

/**
 * GET /api/dashboard/sales-leader
 * Returns sales leader dashboard data with team metrics
 * Only accessible by users with manager/admin profiles
 */
router.get('/dashboard/sales-leader', isAuthenticated, async (req: Request, res: Response) => {
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

    const data = await HubData.getSalesLeaderDashboard(connection, userId);

    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Error fetching sales leader dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sales leader dashboard',
      message: error.message,
    });
  }
});

/**
 * GET /api/debug/account-fields
 * Returns ALL fields from the first account to help identify 6sense field names
 */
router.get('/debug/account-fields', isAuthenticated, async (req: Request, res: Response) => {
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

    // Get first account with ALL fields using describe
    const accountDescribe = await connection.sobject('Account').describe();
    const fieldNames = accountDescribe.fields
      .filter((f: any) => f.name.toLowerCase().includes('6sense') || f.name.toLowerCase().includes('x6sense'))
      .map((f: any) => ({ name: f.name, label: f.label, type: f.type }));

    // Also get a sample account to see actual values
    const sampleQuery = `SELECT Id, Name FROM Account WHERE OwnerId = '${userId}' LIMIT 1`;
    const sampleResult = await connection.query(sampleQuery);
    const sampleAccountId = sampleResult.records[0]?.Id;

    let sampleData = null;
    if (sampleAccountId && fieldNames.length > 0) {
      const detailQuery = `SELECT ${fieldNames.map((f: any) => f.name).join(', ')} FROM Account WHERE Id = '${sampleAccountId}' LIMIT 1`;
      const detailResult = await connection.query(detailQuery);
      sampleData = detailResult.records[0];
    }

    res.json({
      success: true,
      data: {
        sixsenseFields: fieldNames,
        sampleAccount: sampleData,
        totalFieldsFound: fieldNames.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching account fields:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch account fields',
      message: error.message,
    });
  }
});

// ============================================================================
// COCKPIT ENDPOINTS
// ============================================================================

/**
 * GET /api/hub/ae/metrics
 * Get AE hub dashboard metrics
 */
router.get('/hub/ae/metrics', isAuthenticated, async (req: Request, res: Response) => {
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

    const metrics = await HubData.getAEMetrics(connection, userId);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    console.error('Error fetching AE metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch AE metrics',
      message: error.message,
    });
  }
});

/**
 * GET /api/hub/ae/priority-accounts
 * Get priority accounts for AE (high intent prospects)
 */
router.get('/hub/ae/priority-accounts', isAuthenticated, async (req: Request, res: Response) => {
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

    const accounts = await HubData.getPriorityAccounts(connection, userId);

    res.json({
      success: true,
      data: accounts,
      count: accounts.length,
    });
  } catch (error: any) {
    console.error('Error fetching priority accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch priority accounts',
      message: error.message,
    });
  }
});

/**
 * GET /api/hub/ae/at-risk-deals
 * Get at-risk deals for AE (stale or low MEDDPICC)
 */
router.get('/hub/ae/at-risk-deals', isAuthenticated, async (req: Request, res: Response) => {
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

    const deals = await HubData.getAtRiskDeals(connection, userId);

    res.json({
      success: true,
      data: deals,
      count: deals.length,
    });
  } catch (error: any) {
    console.error('Error fetching at-risk deals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch at-risk deals',
      message: error.message,
    });
  }
});

/**
 * GET /api/hub/am/metrics
 * Get AM hub dashboard metrics
 */
router.get('/hub/am/metrics', isAuthenticated, async (req: Request, res: Response) => {
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

    const metrics = await HubData.getAMMetrics(connection, userId);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    console.error('Error fetching AM metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch AM metrics',
      message: error.message,
    });
  }
});

/**
 * GET /api/hub/am/renewals
 * Get renewal accounts for AM
 */
router.get('/hub/am/renewals', isAuthenticated, async (req: Request, res: Response) => {
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

    const renewals = await HubData.getRenewalAccounts(connection, userId);

    res.json({
      success: true,
      data: renewals,
      count: renewals.length,
    });
  } catch (error: any) {
    console.error('Error fetching renewal accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch renewal accounts',
      message: error.message,
    });
  }
});

/**
 * GET /api/hub/csm/metrics
 * Get CSM hub dashboard metrics
 */
router.get('/hub/csm/metrics', isAuthenticated, async (req: Request, res: Response) => {
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

    const metrics = await HubData.getCSMMetrics(connection, userId);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    console.error('Error fetching CSM metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch CSM metrics',
      message: error.message,
    });
  }
});

export default router;
