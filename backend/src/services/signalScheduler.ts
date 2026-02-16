/**
 * Signal Scheduler Service
 *
 * Orchestrates nightly batch analysis of Gong transcripts and news signals.
 * Uses node-cron for scheduling; configurable via admin settings.
 */

import * as cron from 'node-cron';
import { Pool } from 'pg';
import { createGongServiceFromDB, GongTranscript } from './gongService';
import { analyzeDealTranscripts, GongDealSignal } from './gongSignalService';
import { upsertSignals, clearExpiredSignals, StoredSignal } from './signalStore';
import { initializeSignalTables } from './signalStore';
import { AdminSettingsService } from './adminSettings';

let scheduledTask: ReturnType<typeof cron.schedule> | null = null;

/**
 * Initialize the scheduler — called once at server startup.
 */
export async function initializeScheduler(pool: Pool): Promise<void> {
  // Initialize signal tables
  await initializeSignalTables(pool);

  // Load schedule from admin config
  const adminSettings = new AdminSettingsService(pool);
  let schedule = '0 2 * * *'; // Default: 2 AM daily

  try {
    const config = await adminSettings.getBuyingSignalConfig();
    if (config && config.schedule) {
      schedule = config.schedule;
    }
    if (config && !config.enabled) {
      console.log('[SignalScheduler] Buying signals disabled in config — scheduler not started');
      return;
    }
  } catch {
    // Use default schedule
  }

  if (!cron.validate(schedule)) {
    console.error(`[SignalScheduler] Invalid cron expression: "${schedule}", using default`);
    schedule = '0 2 * * *';
  }

  scheduledTask = cron.schedule(schedule, async () => {
    console.log(`[SignalScheduler] Nightly batch starting at ${new Date().toISOString()}`);
    await runNightlyBatch(pool);
  });

  console.log(`[SignalScheduler] Scheduled nightly batch with cron: "${schedule}"`);
}

/**
 * Run the full nightly batch — Gong analysis + News search.
 */
export async function runNightlyBatch(pool: Pool): Promise<{ gongCount: number; newsCount: number; errors: string[] }> {
  const errors: string[] = [];
  let gongCount = 0;
  let newsCount = 0;

  // Clean up expired signals first
  try {
    const cleaned = await clearExpiredSignals(pool);
    if (cleaned > 0) {
      console.log(`[SignalScheduler] Cleaned ${cleaned} expired signals`);
    }
  } catch (error) {
    console.error('[SignalScheduler] Error cleaning expired signals:', error);
  }

  // Update last run status
  const adminSettings = new AdminSettingsService(pool);

  // Phase 1: Gong batch
  try {
    gongCount = await runGongBatch(pool);
    console.log(`[SignalScheduler] Gong batch complete: ${gongCount} deal signals stored`);
  } catch (error: any) {
    const msg = `Gong batch error: ${error.message}`;
    errors.push(msg);
    console.error(`[SignalScheduler] ${msg}`);
  }

  // Phase 2: News batch
  try {
    const { runNewsBatch } = await import('./newsSignalService');
    newsCount = await runNewsBatch(pool);
    console.log(`[SignalScheduler] News batch complete: ${newsCount} account signals stored`);
  } catch (error: any) {
    const msg = `News batch error: ${error.message}`;
    errors.push(msg);
    console.error(`[SignalScheduler] ${msg}`);
  }

  // Update run status in admin config
  try {
    const config = await adminSettings.getBuyingSignalConfig();
    await adminSettings.setBuyingSignalConfig(
      {
        ...config,
        lastRunAt: new Date().toISOString(),
        lastRunStatus: errors.length === 0 ? 'success' : 'partial',
      },
      'system'
    );
  } catch {
    // Best effort
  }

  console.log(`[SignalScheduler] Nightly batch complete. Gong: ${gongCount}, News: ${newsCount}, Errors: ${errors.length}`);
  return { gongCount, newsCount, errors };
}

/**
 * Gong batch: fetch calls, group by opportunity, analyze transcripts, store results.
 */
async function runGongBatch(pool: Pool): Promise<number> {
  let gongService;
  try {
    gongService = await createGongServiceFromDB();
  } catch {
    console.log('[SignalScheduler] Gong not configured — skipping Gong batch');
    return 0;
  }
  if (!gongService) {
    console.log('[SignalScheduler] Gong not configured — skipping Gong batch');
    return 0;
  }

  // Fetch calls from last 30 days
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);

  let allCalls: any[];
  try {
    allCalls = await gongService.getCallsPaginated(
      { fromDateTime: fromDate.toISOString() },
      2000
    );
  } catch (error) {
    console.error('[SignalScheduler] Error fetching Gong calls:', error);
    return 0;
  }

  if (allCalls.length === 0) {
    console.log('[SignalScheduler] No Gong calls found in last 30 days');
    return 0;
  }

  // Group calls by opportunity ID
  const oppCallMap = new Map<string, { calls: any[]; oppName?: string; accountId?: string; accountName?: string }>();

  for (const call of allCalls) {
    const oppIds = call.crmAssociations?.opportunityIds || [];
    const accountId = call.crmAssociations?.accountIds?.[0] || '';
    const accountName = call.crmAssociations?.accountName || '';

    for (const oppId of oppIds) {
      if (!oppCallMap.has(oppId)) {
        oppCallMap.set(oppId, { calls: [], accountId, accountName });
      }
      oppCallMap.get(oppId)!.calls.push(call);
    }
  }

  // Load admin config for limits
  const adminSettings = new AdminSettingsService(pool);
  let maxOppsPerRun = 50;
  try {
    const config = await adminSettings.getBuyingSignalConfig();
    if (config && config.maxAccountsPerRun) {
      maxOppsPerRun = config.maxAccountsPerRun;
    }
  } catch {
    // Use default
  }

  // Process each opportunity (limit per run)
  const oppEntries = Array.from(oppCallMap.entries()).slice(0, maxOppsPerRun);
  const signalsToStore: StoredSignal[] = [];
  const allCallIds: string[] = [];

  // Collect all call IDs for batch transcript fetch
  for (const [, { calls }] of oppEntries) {
    const recentCalls = calls
      .sort((a: any, b: any) => new Date(b.started).getTime() - new Date(a.started).getTime())
      .slice(0, 5);
    allCallIds.push(...recentCalls.map((c: any) => c.id));
  }

  // Batch fetch transcripts
  let transcripts: Map<string, GongTranscript>;
  try {
    transcripts = await gongService.getTranscriptsBatch(allCallIds);
  } catch (error) {
    console.error('[SignalScheduler] Error fetching transcripts:', error);
    return 0;
  }

  for (const [oppId, { calls, accountId, accountName }] of oppEntries) {
    try {
      const recentCalls = calls
        .sort((a: any, b: any) => new Date(b.started).getTime() - new Date(a.started).getTime())
        .slice(0, 5);

      const callIds = recentCalls.map((c: any) => c.id);
      const callTitles = new Map<string, string>();
      recentCalls.forEach((c: any) => callTitles.set(c.id, c.title || 'Untitled Call'));

      const oppName = recentCalls[0]?.crmAssociations?.opportunityName || oppId;

      const dealSignal = await analyzeDealTranscripts(
        oppId,
        oppName,
        accountId || '',
        accountName || 'Unknown',
        callIds,
        callTitles,
        transcripts
      );

      if (dealSignal) {
        signalsToStore.push({
          accountId: dealSignal.accountId,
          accountName: dealSignal.accountName,
          opportunityId: dealSignal.opportunityId,
          opportunityName: dealSignal.opportunityName,
          source: 'gong',
          signalData: dealSignal,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    } catch (error) {
      console.error(`[SignalScheduler] Error analyzing opp ${oppId}:`, error);
    }
  }

  // Store all results
  if (signalsToStore.length > 0) {
    await upsertSignals(pool, signalsToStore);
  }

  return signalsToStore.length;
}

/**
 * Stop the scheduler (for graceful shutdown).
 */
export function stopScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[SignalScheduler] Scheduler stopped');
  }
}
