import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../middleware/auth';
import * as SFData from '../services/salesforceData';
import * as HubData from '../services/hubData';
import { aiService } from '../services/aiService';
import { pool } from '../config/database';
import { AdminSettingsService } from '../services/adminSettings';

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
 * GET /api/branding
 * Returns current branding configuration for navigation display
 * Accessible by all authenticated users (not admin-only)
 */
router.get('/branding', isAuthenticated, async (_req: Request, res: Response) => {
  try {
    const adminSettings = new AdminSettingsService(pool);
    const branding = await adminSettings.getBrandingConfig();

    res.json({
      success: true,
      data: branding,
    });
  } catch (error: any) {
    console.error('Error fetching branding config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch branding configuration',
      message: error.message,
    });
  }
});

/**
 * GET /api/users
 * Returns all active Salesforce users for filtering
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

    // Query all active users
    const query = `
      SELECT Id, Name
      FROM User
      WHERE IsActive = true
      ORDER BY Name
      LIMIT 200
    `;

    const result = await connection.query(query);
    const users = result.records.map((user: any) => ({
      id: user.Id,
      name: user.Name,
    }));

    res.json({
      success: true,
      data: users,
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
 * GET /api/opportunities/:id/timeline
 * Returns activity timeline for a specific opportunity
 */
router.get('/opportunities/:id/timeline', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const connection = req.sfConnection;
    const { id } = req.params;

    if (!connection) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const activities = await HubData.getOpportunityTimeline(connection, id);

    res.json({
      success: true,
      data: activities,
      count: activities.length,
    });
  } catch (error: any) {
    console.error('Error fetching opportunity timeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch opportunity timeline',
      message: error.message,
    });
  }
});

/**
 * GET /api/opportunities/:id/ai-summary
 * Returns AI-generated deal summary for a specific opportunity
 */
router.get('/opportunities/:id/ai-summary', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const connection = req.sfConnection;
    const { id } = req.params;

    if (!connection) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Fetch opportunity data
    const opportunity = await SFData.getOpportunityById(connection, id);
    if (!opportunity) {
      return res.status(404).json({
        success: false,
        error: 'Opportunity not found',
      });
    }

    // Fetch activity timeline
    const activities = await HubData.getOpportunityTimeline(connection, id);

    // Set Salesforce connection for Agentforce provider
    aiService.setSalesforceConnection(connection);

    // Generate AI summary
    const summary = await aiService.generateDealSummary(opportunity, activities);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error('Error generating AI summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate AI summary',
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
 * Supports filters: dateRange, reps, minDealSize, includeAll
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

    // Parse query parameters
    const filters: any = {};

    // Date range handling
    if (req.query.dateRange) {
      filters.dateRange = req.query.dateRange as string;
    }
    if (req.query.startDate) {
      filters.startDate = req.query.startDate as string;
    }
    if (req.query.endDate) {
      filters.endDate = req.query.endDate as string;
    }

    // Team filter handling
    if (req.query.teamFilter) {
      filters.teamFilter = req.query.teamFilter as string;
    }

    if (req.query.reps) {
      filters.reps = (req.query.reps as string).split(',');
    }

    if (req.query.minDealSize) {
      filters.minDealSize = parseInt(req.query.minDealSize as string, 10);
    }

    if (req.query.includeAll === 'true') {
      filters.includeAll = true;
    }

    const data = await HubData.getSalesLeaderDashboard(connection, userId, filters, pool);

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
 * GET /api/hub/sales-leader/priorities
 * Get team priorities for Sales Leader
 */
router.get('/hub/sales-leader/priorities', isAuthenticated, async (req: Request, res: Response) => {
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

    const priorities = await HubData.getTeamPriorities(connection, userId, pool);

    res.json({
      success: true,
      data: priorities,
      count: priorities.length,
    });
  } catch (error: any) {
    console.error('Error fetching team priorities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch team priorities',
      message: error.message,
    });
  }
});

/**
 * GET /api/hub/sales-leader/pipeline-forecast
 * Get team pipeline and forecast for Sales Leader
 */
router.get('/hub/sales-leader/pipeline-forecast', isAuthenticated, async (req: Request, res: Response) => {
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

    const excludeStagesParam = req.query.excludeStages as string | undefined;
    const opportunityTypesParam = req.query.opportunityTypes as string | undefined;

    const filters = {
      dateRange: req.query.dateRange as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      teamFilter: req.query.teamFilter as string | undefined,
      minDealSize: req.query.minDealSize ? Number(req.query.minDealSize) : undefined,
      excludeStages: excludeStagesParam ? excludeStagesParam.split(',').filter(Boolean) : undefined,
      opportunityTypes: opportunityTypesParam ? opportunityTypesParam.split(',').filter(Boolean) : undefined,
    };

    const forecast = await HubData.getTeamPipelineForecast(connection, userId, pool, filters);

    res.json({
      success: true,
      data: forecast,
    });
  } catch (error: any) {
    console.error('Error fetching team pipeline forecast:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch team pipeline forecast',
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

/**
 * GET /api/debug/axonify-fields
 * Returns fields related to Axonify usage data (licenses, products, usage)
 */
router.get('/debug/axonify-fields', isAuthenticated, async (req: Request, res: Response) => {
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

    // Get all Account fields using describe
    const accountDescribe = await connection.sobject('Account').describe();

    // Filter for Axonify/license/usage related fields
    const axonifyKeywords = [
      'axonify', 'license', 'usage', 'product', 'subscription',
      'active_user', 'seat', 'module', 'entitlement', 'utilization'
    ];

    const axonifyFields = accountDescribe.fields
      .filter((f: any) => {
        const name = f.name.toLowerCase();
        const label = f.label.toLowerCase();
        return axonifyKeywords.some(kw => name.includes(kw) || label.includes(kw));
      })
      .map((f: any) => ({
        name: f.name,
        label: f.label,
        type: f.type,
        length: f.length,
        updateable: f.updateable,
        custom: f.custom,
      }));

    // Also get ALL custom fields for reference
    const allCustomFields = accountDescribe.fields
      .filter((f: any) => f.custom)
      .map((f: any) => ({
        name: f.name,
        label: f.label,
        type: f.type,
      }));

    // Get a sample account with any found axonify fields
    let sampleData = null;
    if (axonifyFields.length > 0) {
      const sampleQuery = `SELECT Id, Name FROM Account LIMIT 1`;
      const sampleResult = await connection.query(sampleQuery);
      const sampleAccountId = sampleResult.records[0]?.Id;

      if (sampleAccountId) {
        const fieldList = ['Id', 'Name', ...axonifyFields.map((f: any) => f.name)].join(', ');
        const detailQuery = `SELECT ${fieldList} FROM Account WHERE Id = '${sampleAccountId}' LIMIT 1`;
        const detailResult = await connection.query(detailQuery);
        sampleData = detailResult.records[0];
      }
    }

    res.json({
      success: true,
      data: {
        axonifyFields,
        allCustomFields,
        sampleAccount: sampleData,
        totalAxonifyFields: axonifyFields.length,
        totalCustomFields: allCustomFields.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching Axonify fields:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Axonify fields',
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
 * Query params: timeframe (annual|quarterly) - defaults to annual
 */
router.get('/hub/ae/metrics', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const connection = req.sfConnection;
    const session = req.session as any;
    const userId = session.userId;
    const timeframe = (req.query.timeframe as 'annual' | 'quarterly') || 'annual';

    if (!connection || !userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const metrics = await HubData.getAEMetrics(connection, userId, pool, timeframe);

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

    console.log(`[API] Fetching priority accounts for user: ${userId}`);
    const accounts = await HubData.getPriorityAccounts(connection, userId);
    console.log(`[API] getPriorityAccounts returned ${accounts.length} accounts`);

    if (accounts.length > 0) {
      const tierCounts = accounts.reduce((acc: any, account: any) => {
        acc[account.priorityTier] = (acc[account.priorityTier] || 0) + 1;
        return acc;
      }, {});
      console.log(`[API] Priority tier distribution:`, tierCounts);
    }

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

    const deals = await HubData.getAtRiskDeals(connection, userId, pool);

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
 * GET /api/hub/ae/priorities
 * Get today's priorities for AE
 */
router.get('/hub/ae/priorities', isAuthenticated, async (req: Request, res: Response) => {
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

    const priorities = await HubData.getTodaysPriorities(connection, userId);

    res.json({
      success: true,
      data: priorities,
      count: priorities.length,
    });
  } catch (error: any) {
    console.error('Error fetching priorities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch priorities',
      message: error.message,
    });
  }
});

/**
 * GET /api/hub/ae/pipeline-forecast
 * Get pipeline and forecast data for AE
 */
router.get('/hub/ae/pipeline-forecast', isAuthenticated, async (req: Request, res: Response) => {
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

    // AE pipeline forecast also supports teamFilter='me' via the team route
    const teamFilter = req.query.teamFilter as string | undefined;
    const excludeStagesParam = req.query.excludeStages as string | undefined;
    const opportunityTypesParam = req.query.opportunityTypes as string | undefined;
    const commonFilters = {
      dateRange: req.query.dateRange as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      excludeStages: excludeStagesParam ? excludeStagesParam.split(',').filter(Boolean) : undefined,
      opportunityTypes: opportunityTypesParam ? opportunityTypesParam.split(',').filter(Boolean) : undefined,
    };

    let forecast;
    if (teamFilter && teamFilter !== 'me') {
      // If a team filter is specified (other than 'me'), use team version
      forecast = await HubData.getTeamPipelineForecast(connection, userId, pool, {
        ...commonFilters,
        teamFilter,
      });
    } else {
      forecast = await HubData.getPipelineForecast(connection, userId, pool, commonFilters);
    }

    res.json({
      success: true,
      data: forecast,
    });
  } catch (error: any) {
    console.error('Error fetching pipeline forecast:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pipeline forecast',
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

/**
 * GET /api/hub/csm/at-risk
 * Get at-risk accounts for CSM (low health scores or flagged as at-risk)
 */
router.get('/hub/csm/at-risk', isAuthenticated, async (req: Request, res: Response) => {
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

    const accounts = await HubData.getAtRiskAccounts(connection, userId);

    res.json({
      success: true,
      data: accounts,
      count: accounts.length,
    });
  } catch (error: any) {
    console.error('Error fetching at-risk accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch at-risk accounts',
      message: error.message,
    });
  }
});

/**
 * GET /api/hub/csm/underutilized
 * Get accounts with underutilization risk (low license utilization)
 */
router.get('/hub/csm/underutilized', isAuthenticated, async (req: Request, res: Response) => {
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

    const threshold = req.query.threshold ? parseInt(req.query.threshold as string, 10) : 60;
    const accounts = await HubData.getUnderutilizedAccounts(connection, userId, threshold);

    res.json({
      success: true,
      data: accounts,
      count: accounts.length,
    });
  } catch (error: any) {
    console.error('Error fetching underutilized accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch underutilized accounts',
      message: error.message,
    });
  }
});

/**
 * GET /api/hub/csm/expansion-opportunities
 * Get accounts with expansion opportunities (high license utilization)
 */
router.get('/hub/csm/expansion-opportunities', isAuthenticated, async (req: Request, res: Response) => {
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

    const threshold = req.query.threshold ? parseInt(req.query.threshold as string, 10) : 80;
    const accounts = await HubData.getExpansionOpportunityAccounts(connection, userId, threshold);

    res.json({
      success: true,
      data: accounts,
      count: accounts.length,
    });
  } catch (error: any) {
    console.error('Error fetching expansion opportunity accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch expansion opportunity accounts',
      message: error.message,
    });
  }
});

/**
 * GET /api/hub/am/at-risk
 * Get at-risk accounts for AM (low health scores or flagged as at-risk)
 */
router.get('/hub/am/at-risk', isAuthenticated, async (req: Request, res: Response) => {
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

    const accounts = await HubData.getAtRiskAccounts(connection, userId);

    res.json({
      success: true,
      data: accounts,
      count: accounts.length,
    });
  } catch (error: any) {
    console.error('Error fetching at-risk accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch at-risk accounts',
      message: error.message,
    });
  }
});

/**
 * GET /api/hub/am/underutilized
 * Get accounts with underutilization risk (for AM)
 */
router.get('/hub/am/underutilized', isAuthenticated, async (req: Request, res: Response) => {
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

    const threshold = req.query.threshold ? parseInt(req.query.threshold as string, 10) : 60;
    const accounts = await HubData.getUnderutilizedAccounts(connection, userId, threshold);

    res.json({
      success: true,
      data: accounts,
      count: accounts.length,
    });
  } catch (error: any) {
    console.error('Error fetching underutilized accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch underutilized accounts',
      message: error.message,
    });
  }
});

/**
 * GET /api/hub/am/expansion-opportunities
 * Get accounts with expansion opportunities (for AM)
 */
router.get('/hub/am/expansion-opportunities', isAuthenticated, async (req: Request, res: Response) => {
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

    const threshold = req.query.threshold ? parseInt(req.query.threshold as string, 10) : 80;
    const accounts = await HubData.getExpansionOpportunityAccounts(connection, userId, threshold);

    res.json({
      success: true,
      data: accounts,
      count: accounts.length,
    });
  } catch (error: any) {
    console.error('Error fetching expansion opportunity accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch expansion opportunity accounts',
      message: error.message,
    });
  }
});

/**
 * PATCH /api/sobjects/:objectType/:id
 * Updates a Salesforce record with field-level security checks
 * Respects user's Salesforce permissions - only allows updates to fields the user can edit
 */
router.patch('/sobjects/:objectType/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const connection = req.sfConnection;
    const { objectType, id } = req.params;
    const updates = req.body;

    if (!connection) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Validate object type
    const allowedObjects = ['Account', 'Opportunity', 'Contact', 'Lead', 'Case'];
    if (!allowedObjects.includes(objectType)) {
      return res.status(400).json({
        success: false,
        error: `Object type ${objectType} is not allowed for updates`,
      });
    }

    // Get field metadata to check permissions
    const describe = await connection.sobject(objectType).describe();
    const fieldMap = new Map(describe.fields.map(f => [f.name, f]));

    // Check each field for updateable permission
    const notUpdateableFields: string[] = [];
    const validUpdates: any = { Id: id };

    for (const [fieldName, value] of Object.entries(updates)) {
      if (fieldName === 'Id') continue; // Skip Id field

      const fieldMeta = fieldMap.get(fieldName);

      if (!fieldMeta) {
        return res.status(400).json({
          success: false,
          error: `Field ${fieldName} does not exist on ${objectType}`,
        });
      }

      // Check if user has permission to update this field
      if (!fieldMeta.updateable) {
        notUpdateableFields.push(fieldName);
      } else {
        validUpdates[fieldName] = value;
      }
    }

    // If any fields are not updateable, return error
    if (notUpdateableFields.length > 0) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied',
        message: `You do not have permission to update the following fields: ${notUpdateableFields.join(', ')}`,
        notUpdateableFields,
      });
    }

    // If no valid updates after removing Id, return error
    if (Object.keys(validUpdates).length === 1) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update',
      });
    }

    // Perform the update
    const result: any = await connection.sobject(objectType).update(validUpdates);

    // Check if update was successful
    const updateResult = Array.isArray(result) ? result[0] : result;
    if (!updateResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Update failed',
        message: updateResult.errors?.map((e: any) => e.message).join(', ') || 'Unknown error',
      });
    }

    // Fetch and return the updated record
    let updatedRecord;
    if (objectType === 'Account') {
      updatedRecord = await SFData.getAccountById(connection, id);
    } else if (objectType === 'Opportunity') {
      updatedRecord = await SFData.getOpportunityById(connection, id);
    } else {
      // For other object types, do a basic query
      const query = `SELECT Id, Name FROM ${objectType} WHERE Id = '${id}'`;
      const queryResult = await connection.query(query);
      updatedRecord = queryResult.records[0];
    }

    res.json({
      success: true,
      data: updatedRecord,
      updated: Object.keys(validUpdates).filter(k => k !== 'Id'),
    });
  } catch (error: any) {
    console.error('Error updating record:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update record',
      message: error.message,
    });
  }
});

/**
 * GET /api/sobjects/:objectType/:id/permissions
 * Returns field-level permissions for a specific record
 * Used by frontend to determine which fields can be edited
 */
router.get('/sobjects/:objectType/:id/permissions', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const connection = req.sfConnection;
    const { objectType } = req.params;

    if (!connection) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Get field metadata
    const describe = await connection.sobject(objectType).describe();

    // Build permissions map
    const permissions: Record<string, { updateable: boolean; type: string; label: string }> = {};

    for (const field of describe.fields) {
      permissions[field.name] = {
        updateable: field.updateable,
        type: field.type,
        label: field.label,
      };
    }

    res.json({
      success: true,
      data: {
        objectUpdateable: describe.updateable,
        fields: permissions,
      },
    });
  } catch (error: any) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch permissions',
      message: error.message,
    });
  }
});

/**
 * POST /api/ai/ask
 * AI Assistant - Answer user questions with context
 */
router.post('/ai/ask', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const connection = req.sfConnection;
    const { question } = req.body;

    if (!connection) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ success: false, error: 'Question is required' });
    }

    // Get current user info
    const userInfo = await connection.identity();
    const userName = userInfo.display_name || userInfo.username;

    // Get user's opportunities (using only standard fields)
    const oppResult = await connection.query(`
      SELECT Id, Name, AccountId, Account.Name, StageName, Amount, CloseDate,
             Probability, LastModifiedDate, CreatedDate
      FROM Opportunity
      WHERE OwnerId = '${userInfo.user_id}'
        AND IsClosed = false
      ORDER BY CloseDate ASC
      LIMIT 10
    `);

    // Get user's tasks
    const taskResult = await connection.query(`
      SELECT Id, Subject, ActivityDate, Priority, Status
      FROM Task
      WHERE OwnerId = '${userInfo.user_id}'
        AND IsClosed = false
        AND ActivityDate >= TODAY
      ORDER BY ActivityDate ASC
      LIMIT 10
    `);

    const userData = {
      userName,
      userRole: (req.session as any)?.userRole || 'User',
      opportunities: oppResult.records,
      tasks: taskResult.records.map((task: any) => ({
        subject: task.Subject,
        dueDate: task.ActivityDate,
        priority: task.Priority,
        status: task.Status,
      })),
    };

    // Set Salesforce connection for Agentforce provider
    aiService.setSalesforceConnection(connection);

    const answer = await aiService.askQuestion(question, userData);

    res.json({
      success: true,
      data: {
        question,
        answer,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error asking AI:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI response',
      message: error.message,
    });
  }
});

export default router;
