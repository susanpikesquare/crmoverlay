/**
 * Salesforce Account Field Inspector
 *
 * This script connects to Salesforce and inspects the Account object to identify:
 * - All custom fields (ending with __c)
 * - 6sense-related fields (intent scores, buying stage, etc.)
 * - Clay-related fields (enrichment data, employee info, etc.)
 * - Priority scoring fields
 *
 * Usage: npm run inspect-fields
 */

import * as jsforce from 'jsforce';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface FieldDescription {
  name: string;
  label: string;
  type: string;
  length?: number;
  custom: boolean;
  updateable: boolean;
  calculatedFormula?: string;
}

interface FieldCategory {
  sixsense: FieldDescription[];
  clay: FieldDescription[];
  priority: FieldDescription[];
  other: FieldDescription[];
}

/**
 * Categorize fields based on their name/label
 */
function categorizeField(field: any): keyof FieldCategory | null {
  const name = field.name.toLowerCase();
  const label = field.label.toLowerCase();

  // 6sense fields
  if (
    name.includes('6sense') ||
    name.includes('sixsense') ||
    label.includes('6sense') ||
    label.includes('intent') ||
    label.includes('buying stage')
  ) {
    return 'sixsense';
  }

  // Clay fields
  if (
    name.includes('clay') ||
    label.includes('clay') ||
    label.includes('employee count') ||
    label.includes('tech stack') ||
    label.includes('enrichment')
  ) {
    return 'clay';
  }

  // Priority/scoring fields
  if (
    name.includes('priority') ||
    name.includes('score') ||
    label.includes('priority') ||
    label.includes('score')
  ) {
    return 'priority';
  }

  return 'other';
}

/**
 * Fetch and analyze Account object fields
 */
async function inspectAccountFields(): Promise<void> {
  console.log('='.repeat(80));
  console.log('SALESFORCE ACCOUNT FIELD INSPECTOR');
  console.log('='.repeat(80));
  console.log();

  // Validate environment variables
  const requiredVars = ['SF_CLIENT_ID', 'SF_CLIENT_SECRET', 'SF_LOGIN_URL'];
  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => console.error(`   - ${varName}`));
    process.exit(1);
  }

  console.log('📋 Configuration:');
  console.log(`   Salesforce URL: ${process.env.SF_LOGIN_URL}`);
  console.log(`   Client ID: ${process.env.SF_CLIENT_ID?.substring(0, 20)}...`);
  console.log();

  // Connect to Salesforce using OAuth2
  const oauth2 = new jsforce.OAuth2({
    loginUrl: process.env.SF_LOGIN_URL!,
    clientId: process.env.SF_CLIENT_ID!,
    clientSecret: process.env.SF_CLIENT_SECRET!,
  });

  console.log('🔐 To authenticate, you need an access token.');
  console.log('   1. Log in to Salesforce');
  console.log('   2. Go to Setup > Apps > App Manager');
  console.log('   3. Find your Connected App and click "View"');
  console.log('   4. Or use the OAuth flow via the web app');
  console.log();
  console.log('   For this script, we\'ll use username/password + security token');
  console.log();

  // Alternative: Use username/password authentication for scripts
  const connection = new jsforce.Connection({
    loginUrl: process.env.SF_LOGIN_URL!,
  });

  try {
    // Check if we have username/password in env
    const username = process.env.SF_USERNAME;
    const password = process.env.SF_PASSWORD;
    const securityToken = process.env.SF_SECURITY_TOKEN || '';

    if (!username || !password) {
      console.error('❌ Missing SF_USERNAME or SF_PASSWORD in .env file');
      console.log();
      console.log('Please add these to your backend/.env file:');
      console.log('   SF_USERNAME=your-salesforce-username');
      console.log('   SF_PASSWORD=your-salesforce-password');
      console.log('   SF_SECURITY_TOKEN=your-security-token (if required)');
      console.log();
      console.log('To get your security token:');
      console.log('   1. Log in to Salesforce');
      console.log('   2. Go to Settings > My Personal Information > Reset My Security Token');
      console.log('   3. Check your email for the new token');
      process.exit(1);
    }

    console.log('🔌 Connecting to Salesforce...');
    await connection.login(username, password + securityToken);
    console.log('✅ Connected successfully!\n');

    // Describe the Account object
    console.log('🔍 Analyzing Account object fields...\n');
    const metadata = await connection.sobject('Account').describe();

    // Categorize fields
    const categories: FieldCategory = {
      sixsense: [],
      clay: [],
      priority: [],
      other: [],
    };

    let totalFields = 0;
    let customFields = 0;

    metadata.fields.forEach((field: any) => {
      totalFields++;

      const fieldDesc: FieldDescription = {
        name: field.name,
        label: field.label,
        type: field.type,
        length: field.length,
        custom: field.custom,
        updateable: field.updateable,
        calculatedFormula: field.calculatedFormula,
      };

      if (field.custom) {
        customFields++;
        const category = categorizeField(field);
        if (category) {
          categories[category].push(fieldDesc);
        }
      }
    });

    // Display results
    console.log('📊 SUMMARY');
    console.log('-'.repeat(80));
    console.log(`Total fields: ${totalFields}`);
    console.log(`Custom fields: ${customFields}`);
    console.log(`Standard fields: ${totalFields - customFields}`);
    console.log();

    // Display categorized custom fields
    console.log('🎯 6SENSE FIELDS (' + categories.sixsense.length + ')');
    console.log('-'.repeat(80));
    if (categories.sixsense.length === 0) {
      console.log('   No 6sense fields found');
    } else {
      categories.sixsense.forEach(field => {
        console.log(`   ${field.name}`);
        console.log(`      Label: ${field.label}`);
        console.log(`      Type: ${field.type}${field.length ? ` (${field.length})` : ''}`);
        console.log(`      Updateable: ${field.updateable}`);
        if (field.calculatedFormula) {
          console.log(`      Formula: ${field.calculatedFormula}`);
        }
        console.log();
      });
    }

    console.log('🧱 CLAY FIELDS (' + categories.clay.length + ')');
    console.log('-'.repeat(80));
    if (categories.clay.length === 0) {
      console.log('   No Clay fields found');
    } else {
      categories.clay.forEach(field => {
        console.log(`   ${field.name}`);
        console.log(`      Label: ${field.label}`);
        console.log(`      Type: ${field.type}${field.length ? ` (${field.length})` : ''}`);
        console.log(`      Updateable: ${field.updateable}`);
        if (field.calculatedFormula) {
          console.log(`      Formula: ${field.calculatedFormula}`);
        }
        console.log();
      });
    }

    console.log('⭐ PRIORITY/SCORING FIELDS (' + categories.priority.length + ')');
    console.log('-'.repeat(80));
    if (categories.priority.length === 0) {
      console.log('   No priority/scoring fields found');
    } else {
      categories.priority.forEach(field => {
        console.log(`   ${field.name}`);
        console.log(`      Label: ${field.label}`);
        console.log(`      Type: ${field.type}${field.length ? ` (${field.length})` : ''}`);
        console.log(`      Updateable: ${field.updateable}`);
        if (field.calculatedFormula) {
          console.log(`      Formula: ${field.calculatedFormula}`);
        }
        console.log();
      });
    }

    console.log('📦 OTHER CUSTOM FIELDS (' + categories.other.length + ')');
    console.log('-'.repeat(80));
    if (categories.other.length === 0) {
      console.log('   No other custom fields found');
    } else {
      // Only show first 20 to avoid cluttering output
      const displayFields = categories.other.slice(0, 20);
      displayFields.forEach(field => {
        console.log(`   ${field.name} (${field.label}) - ${field.type}`);
      });
      if (categories.other.length > 20) {
        console.log(`   ... and ${categories.other.length - 20} more`);
      }
    }
    console.log();

    // Generate TypeScript interface suggestion
    console.log('💻 SUGGESTED TYPESCRIPT INTERFACE');
    console.log('-'.repeat(80));
    console.log('export interface Account {');
    console.log('  // Standard fields');
    console.log('  Id: string;');
    console.log('  Name: string;');
    console.log('  Industry?: string;');
    console.log('  OwnerId?: string;');
    console.log();

    if (categories.sixsense.length > 0) {
      console.log('  // 6sense fields');
      categories.sixsense.forEach(field => {
        const tsType = field.type === 'double' || field.type === 'int' || field.type === 'percent'
          ? 'number'
          : field.type === 'boolean'
          ? 'boolean'
          : field.type === 'date' || field.type === 'datetime'
          ? 'string'
          : 'string';
        console.log(`  ${field.name}?: ${tsType}; // ${field.label}`);
      });
      console.log();
    }

    if (categories.clay.length > 0) {
      console.log('  // Clay fields');
      categories.clay.forEach(field => {
        const tsType = field.type === 'double' || field.type === 'int' || field.type === 'percent'
          ? 'number'
          : field.type === 'boolean'
          ? 'boolean'
          : field.type === 'date' || field.type === 'datetime'
          ? 'string'
          : 'string';
        console.log(`  ${field.name}?: ${tsType}; // ${field.label}`);
      });
      console.log();
    }

    if (categories.priority.length > 0) {
      console.log('  // Priority/scoring fields');
      categories.priority.forEach(field => {
        const tsType = field.type === 'double' || field.type === 'int' || field.type === 'percent'
          ? 'number'
          : field.type === 'boolean'
          ? 'boolean'
          : field.type === 'date' || field.type === 'datetime'
          ? 'string'
          : 'string';
        console.log(`  ${field.name}?: ${tsType}; // ${field.label}`);
      });
    }

    console.log('}');
    console.log();

    // Generate SOQL query suggestion
    console.log('📝 SUGGESTED SOQL QUERY');
    console.log('-'.repeat(80));
    const allRelevantFields = [
      'Id',
      'Name',
      'Industry',
      'OwnerId',
      ...categories.sixsense.map(f => f.name),
      ...categories.clay.map(f => f.name),
      ...categories.priority.map(f => f.name),
    ];

    console.log('SELECT');
    console.log('  ' + allRelevantFields.join(',\n  '));
    console.log('FROM Account');
    console.log('WHERE OwnerId = \'YOUR_USER_ID\'');
    console.log('LIMIT 10');
    console.log();

    console.log('✅ Inspection complete!');
    console.log('='.repeat(80));

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.errorCode === 'INVALID_LOGIN') {
      console.log();
      console.log('Authentication failed. Please check:');
      console.log('   1. SF_USERNAME is correct');
      console.log('   2. SF_PASSWORD is correct');
      console.log('   3. SF_SECURITY_TOKEN is appended to password (if required)');
      console.log('   4. Your IP is whitelisted in Salesforce (or security token is used)');
    }
    process.exit(1);
  }
}

// Run the script
inspectAccountFields().catch(console.error);
