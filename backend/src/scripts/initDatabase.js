#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { testConnection, syncDatabase } = require('../models');
const { seedDatabase } = require('../seeds/seedData');
const readline = require('readline');

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
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise((resolve) => {
        rl.question('Are you sure you want to continue? (yes/no): ', resolve);
      });
      rl.close();

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
    console.log('  1. The database is ready for use');
    console.log('  2. Navigate to your application URL');
    console.log('  3. Login with your Salesforce credentials\n');

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
