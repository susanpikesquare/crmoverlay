#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import { testConnection, syncDatabase } from '../models';
import { seedDatabase } from '../seeds/seedData';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function initDatabase() {
  console.log('=================================');
  console.log('Database Initialization');
  console.log('=================================\n');

  try {
    // Step 1: Test database connection
    console.log('Step 1: Testing database connection...');
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Failed to connect to database');
    }
    console.log('');

    // Step 2: Sync database schema
    console.log('Step 2: Synchronizing database schema...');
    const force = process.argv.includes('--force');
    if (force) {
      console.log('⚠️  WARNING: --force flag detected. All existing data will be deleted!');
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise<string>((resolve) => {
        readline.question('Are you sure you want to continue? (yes/no): ', resolve);
      });
      readline.close();

      if (answer.toLowerCase() !== 'yes') {
        console.log('Aborted.');
        process.exit(0);
      }
    }

    await syncDatabase(force);
    console.log('');

    // Step 3: Seed initial data
    console.log('Step 3: Seeding initial data...');
    await seedDatabase();
    console.log('');

    console.log('=================================');
    console.log('✓ Database initialization complete!');
    console.log('=================================\n');

    console.log('Next steps:');
    console.log('  1. Start the backend server: npm run dev');
    console.log('  2. Start the frontend server: npm run dev (in frontend directory)');
    console.log('  3. Navigate to http://localhost:3000');
    console.log('  4. Login with your Salesforce credentials\n');

    process.exit(0);
  } catch (error) {
    console.error('\n=================================');
    console.error('✗ Database initialization failed');
    console.error('=================================\n');
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the initialization
initDatabase();
