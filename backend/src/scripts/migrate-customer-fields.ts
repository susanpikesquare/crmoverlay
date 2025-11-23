import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';
const connectionString = DATABASE_URL.replace(/^postgres:\/\//, 'postgresql://');

async function migrate() {
  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false,
    } : false,
  });

  try {
    console.log('=================================');
    console.log('Customer Fields Migration');
    console.log('=================================\n');

    console.log('Connecting to database...');
    const client = await pool.connect();
    console.log('✓ Connected\n');

    console.log('Making salesforce_client_id and salesforce_client_secret nullable...');
    await client.query(`
      ALTER TABLE customers
      ALTER COLUMN salesforce_client_id DROP NOT NULL,
      ALTER COLUMN salesforce_client_secret DROP NOT NULL;
    `);
    console.log('✓ Migration completed successfully\n');

    client.release();
    await pool.end();

    console.log('=================================');
    console.log('Migration Complete!');
    console.log('=================================');
  } catch (error: any) {
    console.error('✗ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migrate();
