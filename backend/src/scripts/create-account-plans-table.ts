#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import { pool } from '../config/database';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function createAccountPlansTable() {
  console.log('Creating account_plans table...');

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS account_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        salesforce_account_id VARCHAR(18) NOT NULL,
        salesforce_user_id VARCHAR(18) NOT NULL,
        plan_name VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        plan_date DATE NOT NULL DEFAULT CURRENT_DATE,

        -- JSONB snapshot columns (point-in-time Salesforce data)
        account_snapshot JSONB DEFAULT '{}',
        renewal_opps_snapshot JSONB DEFAULT '[]',
        expansion_opps_snapshot JSONB DEFAULT '[]',
        contacts_snapshot JSONB DEFAULT '[]',

        -- User-authored strategy text
        executive_summary TEXT DEFAULT '',
        retention_strategy TEXT DEFAULT '',
        growth_strategy TEXT DEFAULT '',
        key_initiatives TEXT DEFAULT '',
        risks_and_mitigations TEXT DEFAULT '',
        next_steps TEXT DEFAULT '',
        additional_notes TEXT DEFAULT '',

        -- Export tracking
        last_exported_at TIMESTAMP,
        last_export_format VARCHAR(50),
        google_doc_id VARCHAR(255),
        google_slides_id VARCHAR(255),

        -- Timestamps
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_account_plans_sf_account ON account_plans(salesforce_account_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_account_plans_sf_user ON account_plans(salesforce_user_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_account_plans_status ON account_plans(status);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_account_plans_user_account ON account_plans(salesforce_user_id, salesforce_account_id);
    `);

    console.log('✓ Table account_plans created successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error creating table:', error);
    process.exit(1);
  }
}

// Run the migration
createAccountPlansTable();
