import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../middleware/auth';
import * as SFData from '../services/salesforceData';
import * as HubData from '../services/hubData';
import * as configService from '../services/configService';
import { aiService } from '../services/aiService';
import { pool } from '../config/database';
import { AdminSettingsService } from '../services/adminSettings';

const router = Router();

type AppRole = 'executive' | 'sales-leader' | 'ae' | 'am' | 'csm' | 'unknown';

/**
 * Map Salesforce Profile to app role
 */
function mapProfileToRole(profileName: string): AppRole {
  const profile = profileName.toLowerCase();

  // 1. Check admin-configured role overrides first
  try {
    const appConfig = configService.getConfig();
    const override = appConfig.roleMapping.find(
      m => profile.includes(m.salesforceProfile.toLowerCase())
    );
    if (override) {
      if (override.appRole === 'executive') return 'executive';
      if (override.appRole === 'admin' || override.appRole === 'sales-leader') return 'sales-leader';
      return override.appRole as 'ae' | 'am' | 'csm';
    }
  } catch {
    // Config not loaded yet, fall through to pattern matching
  }

  // 2. Check for sales-specific leadership roles (before general executive)
  if (
    profile.includes('sales manager') ||
    profile.includes('vp sales') ||
    profile.includes('cro') ||
    profile.includes('sales director') ||
    profile.includes('system administrator')
  ) {
    return 'sales-leader';
  }

  // 3. Check for executive/senior leadership roles
  if (
    profile.includes('svp') ||
    profile.includes('senior vice president') ||
    profile.includes('chief') ||
    profile.includes('president') ||
    profile.includes('executive') ||
    profile.includes('director')
  ) {
    return 'executive';
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
 * GET /api/search
 * Global search across Accounts and Opportunities using Salesforce-native sharing rules.
 * No OwnerId filter — Salesforce handles visibility via the user's OAuth connection.
 */
router.get('/search', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const connection = req.sfConnection;
    const q = (req.query.q as string || '').trim();

    if (!connection) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    if (q.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search term must be at least 2 characters',
      });
    }

    // Escape single quotes for SOQL safety
    const safeTerm = q.replace(/'/g, "\\'");

    const accountQuery = `
      SELECT Id, Name, Industry, OwnerId, Owner.Name
      FROM Account
      WHERE Name LIKE '%${safeTerm}%'
      ORDER BY LastModifiedDate DESC
      LIMIT 8
    `;

    const oppQuery = `
      SELECT Id, Name, StageName, Amount, CloseDate, OwnerId, Owner.Name, AccountId, Account.Name
      FROM Opportunity
      WHERE Name LIKE '%${safeTerm}%'
      ORDER BY LastModifiedDate DESC
      LIMIT 8
    `;

    const [accountResult, oppResult] = await Promise.all([
      connection.query(accountQuery),
      connection.query(oppQuery),
    ]);

    const accounts = accountResult.records.map((a: any) => ({
      id: a.Id,
      name: a.Name,
      industry: a.Industry,
      ownerId: a.OwnerId,
      ownerName: a.Owner?.Name,
    }));

    const opportunities = oppResult.records.map((o: any) => ({
      id: o.Id,
      name: o.Name,
      stageName: o.StageName,
      amount: o.Amount,
      closeDate: o.CloseDate,
      ownerId: o.OwnerId,
      ownerName: o.Owner?.Name,
      accountId: o.AccountId,
      accountName: o.Account?.Name,
    }));

    res.json({
      success: true,
      data: { accounts, opportunities },
    });
  } catch (error: any) {
    console.error('Error in global search:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error.message,
    });
  }
});

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

    // Check user-name-based role overrides first (highest priority)
    let role: AppRole | null = null;
    try {
      const appConfig = configService.getConfig();
      const userOverrides = appConfig.userRoleOverrides || [];
      const userName = (user.Name || '').toLowerCase();
      const userEmail = (user.Email || '').toLowerCase();
      const userOverride = userOverrides.find(
        o => userName === o.userName.toLowerCase() || userEmail === o.userName.toLowerCase()
      );
      if (userOverride) {
        if (userOverride.appRole === 'admin' || userOverride.appRole === 'sales-leader') {
          role = 'sales-leader';
        } else {
          role = userOverride.appRole as AppRole;
        }
      }
    } catch { }

    if (!role) {
      role = mapProfileToRole(profileName);
    }

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

    // If includeClosed=true, also fetch closed opportunities and merge
    const { stage, atRisk, includeClosed } = req.query;

    if (includeClosed === 'true') {
      const closedOpps = await SFData.getClosedOpportunities(connection, userId);
      opportunities = [...opportunities, ...closedOpps];
    }

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

    const opportunity = await SFData.getOpportunityById(connection, id, pool);

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
    const opportunity = await SFData.getOpportunityById(connection, id, pool);
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

    const includeStagesParam = req.query.includeStages as string | undefined;
    const opportunityTypesParam = req.query.opportunityTypes as string | undefined;

    const filters = {
      dateRange: req.query.dateRange as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      teamFilter: req.query.teamFilter as string | undefined,
      minDealSize: req.query.minDealSize ? Number(req.query.minDealSize) : undefined,
      includeStages: includeStagesParam ? includeStagesParam.split(',').filter(Boolean) : undefined,
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
    const includeStagesParam = req.query.includeStages as string | undefined;
    const opportunityTypesParam = req.query.opportunityTypes as string | undefined;
    const commonFilters = {
      dateRange: req.query.dateRange as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      includeStages: includeStagesParam ? includeStagesParam.split(',').filter(Boolean) : undefined,
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

// ============================================================================
// EXECUTIVE HUB ENDPOINTS
// ============================================================================

/**
 * GET /api/hub/executive/metrics
 * Cross-org executive KPIs (no user filter — SF sharing rules apply)
 */
router.get('/hub/executive/metrics', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const connection = req.sfConnection;

    if (!connection) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const metrics = await HubData.getExecutiveMetrics(connection, pool);

    res.json({ success: true, data: metrics });
  } catch (error: any) {
    console.error('Error fetching executive metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch executive metrics',
      message: error.message,
    });
  }
});

/**
 * GET /api/hub/executive/renewals
 * Team-wide renewal accounts for executive view
 */
router.get('/hub/executive/renewals', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const connection = req.sfConnection;

    if (!connection) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const usersResult = await connection.query('SELECT Id FROM User WHERE IsActive = true LIMIT 200');
    const allUserIds = (usersResult.records as any[]).map((u: any) => u.Id);

    const renewals = await HubData.getRenewalAccounts(connection, '', allUserIds);

    res.json({ success: true, data: renewals, count: renewals.length });
  } catch (error: any) {
    console.error('Error fetching executive renewals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch executive renewals',
      message: error.message,
    });
  }
});

/**
 * GET /api/hub/executive/priorities
 * Org-wide executive priorities (critical at-risk deals, missing info, stuck deals)
 */
router.get('/hub/executive/priorities', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const connection = req.sfConnection;

    if (!connection) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const priorities = await HubData.getExecutivePriorities(connection, pool);

    res.json({ success: true, data: priorities, count: priorities.length });
  } catch (error: any) {
    console.error('Error fetching executive priorities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch executive priorities',
      message: error.message,
    });
  }
});

/**
 * GET /api/hub/executive/at-risk-deals
 * Org-wide at-risk deals with risk signals
 */
router.get('/hub/executive/at-risk-deals', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const connection = req.sfConnection;

    if (!connection) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const deals = await HubData.getExecutiveAtRiskDeals(connection, pool);

    res.json({ success: true, data: deals, count: deals.length });
  } catch (error: any) {
    console.error('Error fetching executive at-risk deals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch executive at-risk deals',
      message: error.message,
    });
  }
});

/**
 * GET /api/hub/executive/customer-health
 * Team-wide customer health: at-risk accounts + aggregated metrics
 */
router.get('/hub/executive/customer-health', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const connection = req.sfConnection;

    if (!connection) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const usersResult = await connection.query('SELECT Id FROM User WHERE IsActive = true LIMIT 200');
    const allUserIds = (usersResult.records as any[]).map((u: any) => u.Id);

    const [atRiskAccounts, metrics] = await Promise.all([
      HubData.getAtRiskAccounts(connection, '', allUserIds),
      HubData.getCSMMetrics(connection, '', allUserIds),
    ]);

    res.json({
      success: true,
      data: { atRiskAccounts, metrics },
    });
  } catch (error: any) {
    console.error('Error fetching executive customer health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch executive customer health',
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

    // Helper: try enriched query first, fall back to standard fields on query errors
    async function safeQuery<T>(label: string, primaryQuery: string, fallbackQuery: string): Promise<T[]> {
      try {
        const result = await connection!.query<T>(primaryQuery);
        console.log(`[AI Ask] ${label} enriched query returned ${result.records?.length ?? 0} records`);
        return result.records || [];
      } catch (error: any) {
        console.warn(`[AI Ask] ${label} enriched query failed (${error.errorCode || 'unknown'}): ${error.message}`);
        try {
          const result = await connection!.query<T>(fallbackQuery);
          console.log(`[AI Ask] ${label} fallback query returned ${result.records?.length ?? 0} records`);
          return result.records || [];
        } catch (fallbackError: any) {
          console.error(`[AI Ask] ${label} fallback query also failed: ${fallbackError.message}`);
          return [];
        }
      }
    }

    // Determine owner filter based on role — leaders/execs see all visible opps
    const userRole = (req.session as any)?.userRole || 'ae';
    let ownerFilter = `OwnerId = '${userInfo.user_id}'`;
    console.log(`[AI Ask] User: ${userName}, userId: ${userInfo.user_id}, role: ${userRole}`);

    if (userRole === 'sales-leader' || userRole === 'executive') {
      // For leaders/execs, remove OwnerId filter entirely — Salesforce sharing
      // rules will automatically limit visibility to what this user can see
      ownerFilter = '';
      console.log(`[AI Ask] Role ${userRole}: querying all visible opps (no OwnerId filter)`);
    }

    // Get opportunities — enriched with custom fields
    const ownerWhere = ownerFilter ? `${ownerFilter} AND` : '';
    const enrichedOppQuery = `
      SELECT Id, Name, AccountId, Account.Name, StageName, Amount, CloseDate,
             Probability, LastModifiedDate, CreatedDate, OwnerId, Owner.Name,
             COM_Metrics__c, MEDDPICCR_Economic_Buyer__c, Economic_Buyer_Name__c,
             Economic_Buyer_Title__c, MEDDPICCR_Decision_Criteria__c,
             MEDDPICCR_Decision_Process__c, MEDDPICCR_Paper_Process__c,
             MEDDPICCR_Implicate_Pain__c, MEDDPICCR_Champion__c,
             MEDDPICCR_Competition__c, MEDDPICCR_Risks__c,
             Command_Why_Do_Anything__c, Command_Why_Now__c, Command_Why_Us__c,
             Command_Overall_Score__c,
             Risk__c, Unresolved_Risks__c, ARR__c, Total_Contract_Value__c,
             License_Seats__c, NextStep, Description, Type,
             DaysInStage__c, IsAtRisk__c, MEDDPICC_Overall_Score__c, Milestone__c,
             Gong_Call_Count__c, Gong_Last_Call_Date__c, Gong_Sentiment__c,
             Gong_Competitor_Mentions__c
      FROM Opportunity
      WHERE ${ownerWhere} IsClosed = false
      ORDER BY CloseDate ASC
      LIMIT 25
    `;
    const fallbackOppQuery = `
      SELECT Id, Name, AccountId, Account.Name, StageName, Amount, CloseDate,
             Probability, LastModifiedDate, CreatedDate, OwnerId, Owner.Name
      FROM Opportunity
      WHERE ${ownerWhere} IsClosed = false
      ORDER BY CloseDate ASC
      LIMIT 25
    `;
    const opportunities = await safeQuery<any>('Opportunities', enrichedOppQuery, fallbackOppQuery);

    // Get unique account IDs from opportunities for account enrichment
    const accountIds = [...new Set(opportunities.map((o: any) => o.AccountId).filter(Boolean))] as string[];

    // Get account data with custom fields
    let accounts: any[] = [];
    if (accountIds.length > 0) {
      const idList = accountIds.map(id => `'${id}'`).join(',');
      const enrichedAcctQuery = `
        SELECT Id, Name,
               accountBuyingStage6sense__c, accountIntentScore6sense__c,
               accountProfileFit6sense__c,
               Clay_Employee_Count__c, Clay_Revenue__c, Clay_Industry__c,
               Customer_Stage__c, Risk__c, Total_ARR__c, Current_Gainsight_Score__c,
               Agreement_Expiry_Date__c, Last_QBR__c, Last_Exec_Check_In__c,
               Contract_Total_License_Seats__c, Total_Active_Users__c,
               License_Utilization_Max__c, License_Utilization_Learn__c,
               License_Utilization_Comms__c, License_Utilization_Tasks__c,
               Max_Usage_Trend__c
        FROM Account
        WHERE Id IN (${idList})
      `;
      const fallbackAcctQuery = `
        SELECT Id, Name
        FROM Account
        WHERE Id IN (${idList})
      `;
      accounts = await safeQuery<any>('Accounts', enrichedAcctQuery, fallbackAcctQuery);
    }

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

    // Gather Gong data across all opportunities (not just first)
    let gongCalls: any[] = [];
    let gongEmails: any[] = [];
    try {
      const { createGongServiceFromDB } = await import('../services/gongService');
      const gongService = await createGongServiceFromDB();
      if (gongService) {
        // Fetch calls for all opportunities, collect up to 10 most recent
        const allCalls: any[] = [];
        for (const opp of opportunities.slice(0, 10)) {
          try {
            const calls = await gongService.getCallsForOpportunity(opp.Id);
            allCalls.push(...calls.map((c: any) => ({ ...c, opportunityName: opp.Name, accountName: opp.Account?.Name })));
          } catch { /* skip individual opp errors */ }
        }
        // Sort by date descending, take 10 most recent
        gongCalls = allCalls
          .sort((a: any, b: any) => new Date(b.started || 0).getTime() - new Date(a.started || 0).getTime())
          .slice(0, 10);

        // Fetch email activity (last 30 days, capped at 20)
        try {
          const fromDateTime = new Date(Date.now() - 30 * 86400000).toISOString();
          const emails = await gongService.getEmailActivity({ fromDateTime });
          gongEmails = emails.slice(0, 20);
        } catch { /* email activity not available */ }
      }
    } catch {
      // Gong not configured — continue without it
    }

    console.log(`[AI Ask] Data gathered — Opps: ${opportunities.length}, Accounts: ${accounts.length}, Tasks: ${taskResult.records.length}, Gong calls: ${gongCalls.length}, Gong emails: ${gongEmails.length}`);
    if (opportunities.length > 0) {
      console.log(`[AI Ask] First opp: ${(opportunities[0] as any).Name} (${(opportunities[0] as any).StageName})`);
    }

    const userData = {
      userName,
      userRole: (req.session as any)?.userRole || 'User',
      opportunities,
      accounts,
      tasks: taskResult.records.map((task: any) => ({
        subject: task.Subject,
        dueDate: task.ActivityDate,
        priority: task.Priority,
        status: task.Status,
      })),
      gongCalls,
      gongEmails,
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

/**
 * GET /api/ai/status
 * Diagnostic endpoint to check AI service configuration
 */
router.get('/ai/status', isAuthenticated, async (_req: Request, res: Response) => {
  try {
    const status = await aiService.getProviderStatus();
    res.json({
      success: true,
      data: {
        ...status,
        isConfigured: status.primaryProvider !== 'none',
        message: status.primaryProvider !== 'none'
          ? `AI is configured with ${status.primaryProvider}`
          : 'No AI provider configured. Go to Admin > AI Configuration to add an API key.',
      },
    });
  } catch (error: any) {
    res.json({
      success: false,
      data: {
        primaryProvider: 'none',
        isConfigured: false,
        message: `AI service error: ${error.message}`,
      },
    });
  }
});

// ==========================================
// Gong Integration Routes
// ==========================================

/**
 * GET /api/gong/calls
 * Get Gong calls for an opportunity or account
 * Query params: opportunityId, accountId
 */
router.get('/gong/calls', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { createGongServiceFromDB } = await import('../services/gongService');
    const gongService = await createGongServiceFromDB();

    if (!gongService) {
      return res.json({
        success: true,
        data: [],
        message: 'Gong integration not configured',
      });
    }

    const { opportunityId, accountId } = req.query;

    let calls;
    if (opportunityId) {
      calls = await gongService.getCallsForOpportunity(String(opportunityId));
    } else if (accountId) {
      calls = await gongService.getCallsForAccount(String(accountId));
    } else {
      // Get recent calls (last 30 days)
      const fromDateTime = new Date(Date.now() - 30 * 86400000).toISOString();
      calls = await gongService.getCalls({ fromDateTime });
    }

    res.json({
      success: true,
      data: calls,
      count: calls.length,
    });
  } catch (error: any) {
    console.error('Error fetching Gong calls:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Gong calls',
      message: error.message,
    });
  }
});

/**
 * GET /api/gong/transcript/:callId
 * Get full transcript for a specific Gong call
 */
router.get('/gong/transcript/:callId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { createGongServiceFromDB } = await import('../services/gongService');
    const gongService = await createGongServiceFromDB();

    if (!gongService) {
      return res.status(404).json({
        success: false,
        error: 'Gong integration not configured',
      });
    }

    const transcript = await gongService.getTranscript(req.params.callId);

    res.json({
      success: true,
      data: transcript,
    });
  } catch (error: any) {
    console.error('Error fetching Gong transcript:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Gong transcript',
      message: error.message,
    });
  }
});

/**
 * GET /api/gong/emails
 * Get Gong Engage email activity
 * Query params: accountId
 */
router.get('/gong/emails', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { createGongServiceFromDB } = await import('../services/gongService');
    const gongService = await createGongServiceFromDB();

    if (!gongService) {
      return res.json({
        success: true,
        data: [],
        message: 'Gong integration not configured',
      });
    }

    const fromDateTime = new Date(Date.now() - 90 * 86400000).toISOString();
    const emails = await gongService.getEmailActivity({ fromDateTime });

    // Filter by account if specified
    const { accountId } = req.query;
    const filtered = accountId
      ? emails.filter(e => e.accountId === String(accountId))
      : emails;

    res.json({
      success: true,
      data: filtered,
      count: filtered.length,
    });
  } catch (error: any) {
    console.error('Error fetching Gong emails:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Gong emails',
      message: error.message,
    });
  }
});

/**
 * POST /api/gong/ai-search
 * AI-powered search across Gong call transcripts, emails, and Salesforce data
 */
router.post('/gong/ai-search', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { query, scope, accountId, opportunityId, accountName, opportunityName } = req.body;

    // Validate inputs
    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 3 characters',
      });
    }

    const validScopes = ['account', 'opportunity', 'global'];
    if (!scope || !validScopes.includes(scope)) {
      return res.status(400).json({
        success: false,
        error: 'Scope must be one of: account, opportunity, global',
      });
    }

    // Get Gong service
    const { createGongServiceFromDB } = await import('../services/gongService');
    const gongService = await createGongServiceFromDB();

    if (!gongService) {
      return res.json({
        success: true,
        data: {
          answer: 'Gong integration is not configured. Please ask your administrator to set up Gong API credentials in Admin Settings.',
          sources: [],
          metadata: {
            callsAnalyzed: 0,
            transcriptsFetched: 0,
            emailsAnalyzed: 0,
            lookbackDays: 0,
            generatedAt: new Date().toISOString(),
          },
        },
      });
    }

    // Get Salesforce connection if available
    const session = req.session as any;
    let sfConnection: any = undefined;
    if (session?.accessToken && session?.instanceUrl) {
      const jsforce = await import('jsforce');
      sfConnection = new jsforce.Connection({
        instanceUrl: session.instanceUrl,
        accessToken: session.accessToken,
      });
    }

    // Run the search
    const { GongAISearchService } = await import('../services/gongAISearchService');
    const searchService = new GongAISearchService(gongService, sfConnection);

    const result = await searchService.search({
      scope,
      query: query.trim(),
      accountId,
      opportunityId,
      accountName,
      opportunityName,
    });

    console.log(`[Gong AI Search] Complete: ${result.metadata.callsAnalyzed} calls, ${result.metadata.transcriptsFetched} transcripts, ${result.metadata.emailsAnalyzed} emails`);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[Gong AI Search] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process Gong AI search',
      message: error.message,
    });
  }
});

export default router;
