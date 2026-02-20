/**
 * Signal Store Service
 *
 * Persistent storage for buying signal results (Gong + News)
 * and account name cache for nightly batch processing.
 */

import { Pool } from 'pg';

// --- Types ---

export interface StoredSignal {
  id?: number;
  accountId: string;
  accountName: string;
  opportunityId?: string;
  opportunityName?: string;
  source: 'gong' | 'news';
  signalData: any;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string;
}

export interface CachedAccountName {
  accountId: string;
  accountName: string;
  ownerId?: string;
  updatedAt?: string;
}

// --- Table Initialization ---

export async function initializeSignalTables(pool: Pool): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS buying_signals (
        id SERIAL PRIMARY KEY,
        account_id VARCHAR(18),
        account_name TEXT,
        opportunity_id VARCHAR(18),
        opportunity_name TEXT,
        source VARCHAR(20) NOT NULL,
        signal_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP
      );
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_bs_opp ON buying_signals(opportunity_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_bs_acct ON buying_signals(account_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_bs_expires ON buying_signals(expires_at);`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS account_name_cache (
        account_id VARCHAR(18) PRIMARY KEY,
        account_name TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Migration: add owner_id column to account_name_cache
    await pool.query(`
      ALTER TABLE account_name_cache ADD COLUMN IF NOT EXISTS owner_id VARCHAR(18);
    `);

    console.log('[SignalStore] Tables initialized successfully');
  } catch (error) {
    console.error('[SignalStore] Error initializing tables:', error);
  }
}

// --- Signal CRUD ---

export async function upsertSignals(pool: Pool, signals: StoredSignal[]): Promise<void> {
  if (signals.length === 0) return;

  for (const signal of signals) {
    const expiresAt = signal.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    if (signal.opportunityId && signal.source === 'gong') {
      // Upsert by opportunity_id + source for Gong signals
      await pool.query(
        `INSERT INTO buying_signals (account_id, account_name, opportunity_id, opportunity_name, source, signal_data, updated_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
         ON CONFLICT DO NOTHING`,
        [signal.accountId, signal.accountName, signal.opportunityId, signal.opportunityName, signal.source, JSON.stringify(signal.signalData), expiresAt]
      );
      // Delete old and insert fresh — simpler than complex upsert for SERIAL PK
      await pool.query(
        `DELETE FROM buying_signals WHERE opportunity_id = $1 AND source = $2 AND id NOT IN (
           SELECT id FROM buying_signals WHERE opportunity_id = $1 AND source = $2 ORDER BY updated_at DESC LIMIT 1
         )`,
        [signal.opportunityId, signal.source]
      );
    } else if (signal.accountId && signal.source === 'news') {
      // For news signals, replace existing news signals for this account
      await pool.query(
        `DELETE FROM buying_signals WHERE account_id = $1 AND source = 'news'`,
        [signal.accountId]
      );
      await pool.query(
        `INSERT INTO buying_signals (account_id, account_name, opportunity_id, opportunity_name, source, signal_data, updated_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)`,
        [signal.accountId, signal.accountName, signal.opportunityId || null, signal.opportunityName || null, signal.source, JSON.stringify(signal.signalData), expiresAt]
      );
    } else {
      await pool.query(
        `INSERT INTO buying_signals (account_id, account_name, opportunity_id, opportunity_name, source, signal_data, updated_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)`,
        [signal.accountId, signal.accountName, signal.opportunityId || null, signal.opportunityName || null, signal.source, JSON.stringify(signal.signalData), expiresAt]
      );
    }
  }
}

export async function getSignalsForOpportunities(pool: Pool, oppIds: string[]): Promise<StoredSignal[]> {
  if (oppIds.length === 0) return [];

  const placeholders = oppIds.map((_, i) => `$${i + 1}`).join(',');
  const result = await pool.query(
    `SELECT id, account_id, account_name, opportunity_id, opportunity_name, source, signal_data, created_at, updated_at, expires_at
     FROM buying_signals
     WHERE opportunity_id IN (${placeholders})
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY updated_at DESC`,
    oppIds
  );

  return result.rows.map(mapRow);
}

export async function getSignalsForAccounts(pool: Pool, accountIds: string[]): Promise<StoredSignal[]> {
  if (accountIds.length === 0) return [];

  const placeholders = accountIds.map((_, i) => `$${i + 1}`).join(',');
  const result = await pool.query(
    `SELECT id, account_id, account_name, opportunity_id, opportunity_name, source, signal_data, created_at, updated_at, expires_at
     FROM buying_signals
     WHERE account_id IN (${placeholders})
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY updated_at DESC`,
    accountIds
  );

  return result.rows.map(mapRow);
}

export async function getAllFreshSignals(pool: Pool, source?: 'gong' | 'news'): Promise<StoredSignal[]> {
  let query = `SELECT id, account_id, account_name, opportunity_id, opportunity_name, source, signal_data, created_at, updated_at, expires_at
     FROM buying_signals
     WHERE (expires_at IS NULL OR expires_at > NOW())`;
  const params: any[] = [];

  if (source) {
    query += ` AND source = $1`;
    params.push(source);
  }

  query += ` ORDER BY updated_at DESC`;

  const result = await pool.query(query, params);
  return result.rows.map(mapRow);
}

export async function clearSignals(pool: Pool, source: 'gong' | 'news', oppId?: string): Promise<void> {
  if (oppId) {
    await pool.query(
      `DELETE FROM buying_signals WHERE source = $1 AND opportunity_id = $2`,
      [source, oppId]
    );
  } else {
    await pool.query(
      `DELETE FROM buying_signals WHERE source = $1`,
      [source]
    );
  }
}

export async function clearExpiredSignals(pool: Pool): Promise<number> {
  const result = await pool.query(
    `DELETE FROM buying_signals WHERE expires_at IS NOT NULL AND expires_at < NOW()`
  );
  return result.rowCount || 0;
}

// --- Account Name Cache ---

export async function cacheAccountNames(pool: Pool, accounts: CachedAccountName[]): Promise<void> {
  if (accounts.length === 0) return;

  for (const account of accounts) {
    await pool.query(
      `INSERT INTO account_name_cache (account_id, account_name, owner_id, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (account_id)
       DO UPDATE SET account_name = $2, owner_id = COALESCE($3, account_name_cache.owner_id), updated_at = NOW()`,
      [account.accountId, account.accountName, account.ownerId || null]
    );
  }
}

export async function getAccountNameCache(pool: Pool, options?: { ownedOnly?: boolean }): Promise<CachedAccountName[]> {
  let query = `SELECT account_id, account_name, owner_id, updated_at FROM account_name_cache`;
  if (options?.ownedOnly) {
    query += ` WHERE owner_id IS NOT NULL`;
  }
  query += ` ORDER BY updated_at DESC`;

  const result = await pool.query(query);

  return result.rows.map(row => ({
    accountId: row.account_id,
    accountName: row.account_name,
    ownerId: row.owner_id,
    updatedAt: row.updated_at,
  }));
}

// --- Helpers ---

function mapRow(row: any): StoredSignal {
  return {
    id: row.id,
    accountId: row.account_id,
    accountName: row.account_name,
    opportunityId: row.opportunity_id,
    opportunityName: row.opportunity_name,
    source: row.source,
    signalData: row.signal_data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}
