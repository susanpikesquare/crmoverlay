/**
 * Database Migration: Create filter_presets table
 *
 * Stores saved filter combinations (presets) that users can create,
 * share, and reuse across list views.
 */

import { Pool } from 'pg';

export async function createFilterPresetsTable(pool: Pool): Promise<void> {
  const query = `
    CREATE TABLE IF NOT EXISTS filter_presets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      object_type VARCHAR(50) NOT NULL,
      scope VARCHAR(20) DEFAULT 'my',
      filters JSONB NOT NULL DEFAULT '[]',
      created_by VARCHAR(18) NOT NULL,
      organization_id VARCHAR(18) NOT NULL,
      is_shared BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_filter_presets_object_type
      ON filter_presets(object_type);

    CREATE INDEX IF NOT EXISTS idx_filter_presets_created_by
      ON filter_presets(created_by);

    CREATE INDEX IF NOT EXISTS idx_filter_presets_org_id
      ON filter_presets(organization_id);
  `;

  try {
    await pool.query(query);
    console.log('filter_presets table created successfully');
  } catch (error: any) {
    console.error('Error creating filter_presets table:', error.message);
    throw error;
  }
}

// Run directly if executed as a script
if (require.main === module) {
  const dotenv = require('dotenv');
  dotenv.config();

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  createFilterPresetsTable(pool)
    .then(() => {
      console.log('Migration complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
