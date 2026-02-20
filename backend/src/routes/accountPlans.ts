import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../middleware/auth';
import { AccountPlan } from '../models';
import * as SFData from '../services/salesforceData';
import { generateWordDocument } from '../services/documentExport';
import { generateAccountPlanAI } from '../services/accountPlanAIService';

const router = Router();

/**
 * GET /api/account-plans
 * List all plans for the current user
 */
router.get('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    const userId = session.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const where: any = { salesforceUserId: userId };
    if (req.query.accountId) {
      where.salesforceAccountId = req.query.accountId as string;
    }

    const plans = await AccountPlan.findAll({
      where,
      order: [['updatedAt', 'DESC']],
      attributes: [
        'id', 'salesforceAccountId', 'planName', 'status', 'planDate',
        'lastExportedAt', 'lastExportFormat', 'createdAt', 'updatedAt',
        'accountSnapshot',
      ],
    });

    // Return plans with account name extracted from snapshot
    const plansData = plans.map(plan => ({
      id: plan.id,
      salesforceAccountId: plan.salesforceAccountId,
      planName: plan.planName,
      status: plan.status,
      planDate: plan.planDate,
      accountName: (plan.accountSnapshot as any)?.Name || 'Unknown Account',
      lastExportedAt: plan.lastExportedAt,
      lastExportFormat: plan.lastExportFormat,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    }));

    res.json({ success: true, data: plansData, count: plansData.length });
  } catch (error: any) {
    console.error('Error fetching account plans:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch account plans', message: error.message });
  }
});

/**
 * GET /api/account-plans/sf-data/:accountId
 * Fetch live Salesforce data for preview (before creating a plan)
 */
router.get('/sf-data/:accountId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const connection = req.sfConnection;
    if (!connection) {
      return res.status(401).json({ success: false, error: 'No Salesforce connection available' });
    }

    const { accountId } = req.params;
    const data = await SFData.getAccountPlanData(connection, accountId);

    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Error fetching SF data for account plan:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch Salesforce data', message: error.message });
  }
});

/**
 * GET /api/account-plans/:id
 * Get a single plan with all data
 */
router.get('/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    const userId = session.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const plan = await AccountPlan.findOne({
      where: { id: req.params.id, salesforceUserId: userId },
    });

    if (!plan) {
      return res.status(404).json({ success: false, error: 'Account plan not found' });
    }

    res.json({ success: true, data: plan });
  } catch (error: any) {
    console.error('Error fetching account plan:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch account plan', message: error.message });
  }
});

/**
 * POST /api/account-plans
 * Create a new account plan (fetches SF snapshot automatically)
 */
router.post('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const connection = req.sfConnection;
    const session = req.session as any;
    const userId = session.userId;

    if (!connection || !userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const { salesforceAccountId, planName } = req.body;

    if (!salesforceAccountId || !planName) {
      return res.status(400).json({ success: false, error: 'salesforceAccountId and planName are required' });
    }

    // Fetch SF data for the snapshot
    const sfData = await SFData.getAccountPlanData(connection, salesforceAccountId);

    const plan = await AccountPlan.create({
      salesforceAccountId,
      salesforceUserId: userId,
      planName,
      accountSnapshot: sfData.account || {},
      renewalOppsSnapshot: sfData.renewalOpps,
      expansionOppsSnapshot: sfData.expansionOpps,
      contactsSnapshot: sfData.contacts,
    });

    // Fire-and-forget: auto-generate AI analysis in the background
    generateAccountPlanAI(plan.id).catch(err => {
      console.error('Background AI generation failed:', err.message);
    });

    res.status(201).json({ success: true, data: plan });
  } catch (error: any) {
    console.error('Error creating account plan:', error);
    res.status(500).json({ success: false, error: 'Failed to create account plan', message: error.message });
  }
});

/**
 * PUT /api/account-plans/:id
 * Update strategy text fields
 */
router.put('/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    const userId = session.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const plan = await AccountPlan.findOne({
      where: { id: req.params.id, salesforceUserId: userId },
    });

    if (!plan) {
      return res.status(404).json({ success: false, error: 'Account plan not found' });
    }

    // Only allow updating strategy text and metadata fields
    const allowedFields = [
      'planName', 'status', 'planDate',
      'executiveSummary', 'retentionStrategy', 'growthStrategy',
      'keyInitiatives', 'risksAndMitigations', 'nextSteps', 'additionalNotes',
      'aiAnalysis', 'leadershipAsks', 'dayPlans', 'actionItems',
    ];

    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    await plan.update(updates);

    res.json({ success: true, data: plan });
  } catch (error: any) {
    console.error('Error updating account plan:', error);
    res.status(500).json({ success: false, error: 'Failed to update account plan', message: error.message });
  }
});

/**
 * DELETE /api/account-plans/:id
 * Permanently delete a plan
 */
router.delete('/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    const userId = session.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const plan = await AccountPlan.findOne({
      where: { id: req.params.id, salesforceUserId: userId },
    });

    if (!plan) {
      return res.status(404).json({ success: false, error: 'Account plan not found' });
    }

    await plan.destroy();

    res.json({ success: true, message: 'Account plan deleted' });
  } catch (error: any) {
    console.error('Error deleting account plan:', error);
    res.status(500).json({ success: false, error: 'Failed to delete account plan', message: error.message });
  }
});

/**
 * POST /api/account-plans/:id/refresh-data
 * Re-fetch Salesforce snapshots for an existing plan
 */
router.post('/:id/refresh-data', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const connection = req.sfConnection;
    const session = req.session as any;
    const userId = session.userId;

    if (!connection || !userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const plan = await AccountPlan.findOne({
      where: { id: req.params.id, salesforceUserId: userId },
    });

    if (!plan) {
      return res.status(404).json({ success: false, error: 'Account plan not found' });
    }

    // Re-fetch SF data
    const sfData = await SFData.getAccountPlanData(connection, plan.salesforceAccountId);

    await plan.update({
      accountSnapshot: sfData.account || {},
      renewalOppsSnapshot: sfData.renewalOpps,
      expansionOppsSnapshot: sfData.expansionOpps,
      contactsSnapshot: sfData.contacts,
    });

    res.json({ success: true, data: plan });
  } catch (error: any) {
    console.error('Error refreshing account plan data:', error);
    res.status(500).json({ success: false, error: 'Failed to refresh data', message: error.message });
  }
});

/**
 * POST /api/account-plans/:id/generate-ai
 * Generate AI analysis for an account plan (Gong + SF data → Claude)
 */
router.post('/:id/generate-ai', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    const userId = session.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    // Verify ownership
    const plan = await AccountPlan.findOne({
      where: { id: req.params.id, salesforceUserId: userId },
    });

    if (!plan) {
      return res.status(404).json({ success: false, error: 'Account plan not found' });
    }

    const updatedPlan = await generateAccountPlanAI(plan.id);

    res.json({ success: true, data: updatedPlan });
  } catch (error: any) {
    console.error('Error generating AI analysis:', error);
    res.status(500).json({ success: false, error: 'Failed to generate AI analysis', message: error.message });
  }
});

/**
 * POST /api/account-plans/:id/export/word
 * Export plan to Word document (.docx)
 */
router.post('/:id/export/word', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    const userId = session.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const plan = await AccountPlan.findOne({
      where: { id: req.params.id, salesforceUserId: userId },
    });

    if (!plan) {
      return res.status(404).json({ success: false, error: 'Account plan not found' });
    }

    const buffer = await generateWordDocument({
      planName: plan.planName,
      planDate: plan.planDate?.toString() || '',
      status: plan.status,
      accountSnapshot: plan.accountSnapshot,
      renewalOppsSnapshot: plan.renewalOppsSnapshot,
      expansionOppsSnapshot: plan.expansionOppsSnapshot,
      contactsSnapshot: plan.contactsSnapshot,
      executiveSummary: plan.executiveSummary,
      retentionStrategy: plan.retentionStrategy,
      growthStrategy: plan.growthStrategy,
      keyInitiatives: plan.keyInitiatives,
      risksAndMitigations: plan.risksAndMitigations,
      nextSteps: plan.nextSteps,
      additionalNotes: plan.additionalNotes,
      aiAnalysis: plan.aiAnalysis,
      leadershipAsks: plan.leadershipAsks,
      dayPlans: plan.dayPlans,
      actionItems: plan.actionItems,
    });

    // Update export tracking
    await plan.update({
      lastExportedAt: new Date(),
      lastExportFormat: 'word',
    });

    const filename = `${plan.planName.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Error exporting account plan to Word:', error);
    res.status(500).json({ success: false, error: 'Failed to export to Word', message: error.message });
  }
});

export default router;
