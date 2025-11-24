#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import { pool } from '../config/database';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function createAITable() {
  console.log('Creating ai_api_keys table...');

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL,
        provider VARCHAR(50) NOT NULL,
        api_key TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_customer_provider UNIQUE (customer_id, provider)
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_api_keys_customer_id ON ai_api_keys(customer_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_api_keys_is_active ON ai_api_keys(is_active);
    `);

    console.log('✓ Table ai_api_keys created successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error creating table:', error);
    process.exit(1);
  }
}

// Run the migration
createAITable();
