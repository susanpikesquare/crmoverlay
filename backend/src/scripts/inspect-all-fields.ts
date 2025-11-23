/**
 * Salesforce Field Inspector - Comprehensive
 *
 * This script connects to Salesforce and inspects multiple objects to identify:
 * - Account fields: 6sense, Clay, priority, scratchpad, and AE custom fields
 * - Opportunity fields: MEDDPICC, scratchpad, risk tracking, and AE custom fields
 * - All custom fields where AEs record important data
 *
 * Usage: npm run inspect-all-fields
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
  picklistValues?: string[];
  referenceTo?: string[];
  helpText?: string;
}

interface FieldCategories {
  // Account categories
  sixsense: FieldDescription[];
  clay: FieldDescription[];
  priority: FieldDescription[];
  scratchpad: FieldDescription[];
  accountNotes: FieldDescription[];

  // Opportunity categories
  meddpicc: FieldDescription[];
  oppScratchpad: FieldDescription[];
  riskTracking: FieldDescription[];
  dealQualification: FieldDescription[];

  // General
  other: FieldDescription[];
}

/**
 * Categorize fields based on their name/label
 */
function categorizeField(field: any, objectType: 'Account' | 'Opportunity'): keyof FieldCategories | null {
  const name = field.name.toLowerCase();
  const label = field.label.toLowerCase();

  // 6sense fields (Account)
  if (
    name.includes('6sense') ||
    name.includes('sixsense') ||
    label.includes('6sense') ||
    (label.includes('intent') && !label.includes('letter')) ||
    label.includes('buying stage')
  ) {
    return 'sixsense';
  }

  // Clay fields (Account)
  if (
    name.includes('clay') ||
    label.includes('clay') ||
    label.includes('employee count') ||
    label.includes('tech stack') ||
    label.includes('enrichment')
  ) {
    return 'clay';
  }

  // Scratchpad fields (both objects)
  if (
    name.includes('scratchpad') ||
    name.includes('scratch_pad') ||
    label.includes('scratchpad') ||
    label.includes('scratch pad')
  ) {
    return objectType === 'Account' ? 'scratchpad' : 'oppScratchpad';
  }

  // Account notes/commentary fields
  if (objectType === 'Account' && (
    name.includes('note') ||
    name.includes('comment') ||
    name.includes('observation') ||
    label.includes('notes') ||
    label.includes('comments') ||
    label.includes('observations')
  )) {
    return 'accountNotes';
  }

  // MEDDPICC fields (Opportunity)
  if (
    name.includes('meddpicc') ||
    name.includes('meddic') ||
    label.includes('meddpicc') ||
    label.includes('meddic') ||
    label.includes('metrics') ||
    label.includes('economic buyer') ||
    label.includes('decision criteria') ||
    label.includes('decision process') ||
    label.includes('paper process') ||
    label.includes('champion') ||
    label.includes('competition')
  ) {
    return 'meddpicc';
  }

  // Risk tracking (Opportunity)
  if (objectType === 'Opportunity' && (
    name.includes('risk') ||
    name.includes('stale') ||
    name.includes('daysin') ||
    label.includes('at risk') ||
    label.includes('days in stage') ||
    label.includes('stale')
  )) {
    return 'riskTracking';
  }

  // Deal qualification (Opportunity)
  if (objectType === 'Opportunity' && (
    name.includes('qualified') ||
    name.includes('qualification') ||
    name.includes('discovery') ||
    label.includes('qualified') ||
    label.includes('qualification') ||
    label.includes('discovery')
  )) {
    return 'dealQualification';
  }

  // Priority/scoring fields (Account)
  if (objectType === 'Account' && (
    name.includes('priority') ||
    name.includes('score') ||
    label.includes('priority') ||
    label.includes('score')
  )) {
    return 'priority';
  }

  return 'other';
}

/**
 * Display fields in a formatted way
 */
function displayFields(title: string, fields: FieldDescription[], showAll: boolean = true) {
  console.log(`\n${title} (${fields.length})`);
  console.log('-'.repeat(80));

  if (fields.length === 0) {
    console.log('   No fields found in this category');
    return;
  }

  const displayFields = showAll ? fields : fields.slice(0, 30);

  displayFields.forEach(field => {
    console.log(`\n   ${field.name}`);
    console.log(`      Label: ${field.label}`);
    console.log(`      Type: ${field.type}${field.length ? ` (max ${field.length})` : ''}`);
    console.log(`      Updateable: ${field.updateable ? 'Yes' : 'No'}`);

    if (field.helpText) {
      console.log(`      Help: ${field.helpText}`);
    }

    if (field.calculatedFormula) {
      console.log(`      Formula: ${field.calculatedFormula.substring(0, 100)}${field.calculatedFormula.length > 100 ? '...' : ''}`);
    }

    if (field.picklistValues && field.picklistValues.length > 0) {
      console.log(`      Values: ${field.picklistValues.join(', ')}`);
    }

    if (field.referenceTo && field.referenceTo.length > 0) {
      console.log(`      References: ${field.referenceTo.join(', ')}`);
    }
  });

  if (!showAll && fields.length > 30) {
    console.log(`\n   ... and ${fields.length - 30} more fields`);
    console.log('   (These are likely standard/system fields not used by AEs)');
  }
}

/**
 * Inspect an object and categorize its fields
 */
async function inspectObject(
  connection: jsforce.Connection,
  objectName: 'Account' | 'Opportunity'
): Promise<FieldCategories> {
  console.log(`\n🔍 Analyzing ${objectName} object fields...`);

  const metadata = await connection.sobject(objectName).describe();

  const categories: FieldCategories = {
    sixsense: [],
    clay: [],
    priority: [],
    scratchpad: [],
    accountNotes: [],
    meddpicc: [],
    oppScratchpad: [],
    riskTracking: [],
    dealQualification: [],
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
      helpText: field.inlineHelpText,
      referenceTo: field.referenceTo,
    };

    // Extract picklist values if applicable
    if (field.picklistValues && field.picklistValues.length > 0) {
      fieldDesc.picklistValues = field.picklistValues
        .filter((pv: any) => pv.active)
        .map((pv: any) => pv.value);
    }

    if (field.custom) {
      customFields++;
      const category = categorizeField(field, objectName);
      if (category) {
        categories[category].push(fieldDesc);
      }
    }
  });

  console.log(`   Total fields: ${totalFields}`);
  console.log(`   Custom fields: ${customFields}`);
  console.log(`   Standard fields: ${totalFields - customFields}`);

  return categories;
}

/**
 * Generate TypeScript interface from fields
 */
function generateTypeScriptInterface(
  objectName: string,
  categories: FieldCategories,
  relevantCategories: (keyof FieldCategories)[]
): void {
  console.log(`\n💻 SUGGESTED TYPESCRIPT INTERFACE FOR ${objectName.toUpperCase()}`);
  console.log('-'.repeat(80));
  console.log(`export interface ${objectName} {`);
  console.log('  // Standard fields');
  console.log('  Id: string;');
  console.log('  Name: string;');

  if (objectName === 'Account') {
    console.log('  Industry?: string;');
    console.log('  OwnerId?: string;');
  } else {
    console.log('  AccountId?: string;');
    console.log('  Amount?: number;');
    console.log('  StageName?: string;');
    console.log('  CloseDate?: string;');
  }

  relevantCategories.forEach(category => {
    const fields = categories[category];
    if (fields.length > 0) {
      console.log(`\n  // ${category.charAt(0).toUpperCase() + category.slice(1)} fields`);
      fields.forEach(field => {
        const tsType = field.type === 'double' || field.type === 'int' || field.type === 'percent' || field.type === 'currency'
          ? 'number'
          : field.type === 'boolean'
          ? 'boolean'
          : field.type === 'date' || field.type === 'datetime'
          ? 'string'
          : 'string';
        console.log(`  ${field.name}?: ${tsType}; // ${field.label}`);
      });
    }
  });

  console.log('}');
}

/**
 * Generate SOQL query
 */
function generateSOQLQuery(
  objectName: string,
  categories: FieldCategories,
  relevantCategories: (keyof FieldCategories)[]
): void {
  console.log(`\n📝 SUGGESTED SOQL QUERY FOR ${objectName.toUpperCase()}`);
  console.log('-'.repeat(80));

  const standardFields = objectName === 'Account'
    ? ['Id', 'Name', 'Industry', 'OwnerId', 'CreatedDate', 'LastModifiedDate']
    : ['Id', 'Name', 'AccountId', 'Account.Name', 'Amount', 'StageName', 'CloseDate', 'Probability', 'OwnerId', 'CreatedDate', 'LastModifiedDate'];

  const customFieldNames: string[] = [];
  relevantCategories.forEach(category => {
    categories[category].forEach(field => {
      customFieldNames.push(field.name);
    });
  });

  const allFields = [...standardFields, ...customFieldNames];

  console.log('SELECT');
  console.log('  ' + allFields.join(',\n  '));
  console.log(`FROM ${objectName}`);
  console.log("WHERE OwnerId = 'YOUR_USER_ID'");
  console.log('LIMIT 10');
}

/**
 * Main inspection function
 */
async function inspectAllFields(): Promise<void> {
  console.log('='.repeat(80));
  console.log('SALESFORCE COMPREHENSIVE FIELD INSPECTOR');
  console.log('Account & Opportunity Fields for AEs');
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

  // Connect to Salesforce
  const connection = new jsforce.Connection({
    loginUrl: process.env.SF_LOGIN_URL!,
  });

  try {
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
      process.exit(1);
    }

    console.log('🔌 Connecting to Salesforce...');
    await connection.login(username, password + securityToken);
    console.log('✅ Connected successfully!');

    // ===== INSPECT ACCOUNT OBJECT =====
    console.log('\n' + '='.repeat(80));
    console.log('ACCOUNT OBJECT ANALYSIS');
    console.log('='.repeat(80));

    const accountCategories = await inspectObject(connection, 'Account');

    // Display Account fields
    displayFields('🎯 6SENSE FIELDS', accountCategories.sixsense);
    displayFields('🧱 CLAY FIELDS', accountCategories.clay);
    displayFields('⭐ PRIORITY/SCORING FIELDS', accountCategories.priority);
    displayFields('📝 SCRATCHPAD FIELDS', accountCategories.scratchpad);
    displayFields('💬 NOTES/COMMENTARY FIELDS', accountCategories.accountNotes);
    displayFields('📦 OTHER CUSTOM FIELDS', accountCategories.other, false);

    generateTypeScriptInterface('Account', accountCategories, [
      'sixsense', 'clay', 'priority', 'scratchpad', 'accountNotes'
    ]);

    generateSOQLQuery('Account', accountCategories, [
      'sixsense', 'clay', 'priority', 'scratchpad', 'accountNotes'
    ]);

    // ===== INSPECT OPPORTUNITY OBJECT =====
    console.log('\n\n' + '='.repeat(80));
    console.log('OPPORTUNITY OBJECT ANALYSIS');
    console.log('='.repeat(80));

    const oppCategories = await inspectObject(connection, 'Opportunity');

    // Display Opportunity fields
    displayFields('🎯 MEDDPICC FIELDS', oppCategories.meddpicc);
    displayFields('⚠️  RISK TRACKING FIELDS', oppCategories.riskTracking);
    displayFields('✅ DEAL QUALIFICATION FIELDS', oppCategories.dealQualification);
    displayFields('📝 SCRATCHPAD FIELDS', oppCategories.oppScratchpad);
    displayFields('📦 OTHER CUSTOM FIELDS', oppCategories.other, false);

    generateTypeScriptInterface('Opportunity', oppCategories, [
      'meddpicc', 'riskTracking', 'dealQualification', 'oppScratchpad'
    ]);

    generateSOQLQuery('Opportunity', oppCategories, [
      'meddpicc', 'riskTracking', 'dealQualification', 'oppScratchpad'
    ]);

    // ===== SUMMARY =====
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log('\nAccount Object:');
    console.log(`   6sense fields: ${accountCategories.sixsense.length}`);
    console.log(`   Clay fields: ${accountCategories.clay.length}`);
    console.log(`   Priority/Scoring: ${accountCategories.priority.length}`);
    console.log(`   Scratchpad: ${accountCategories.scratchpad.length}`);
    console.log(`   Notes/Commentary: ${accountCategories.accountNotes.length}`);
    console.log(`   Other custom: ${accountCategories.other.length}`);

    console.log('\nOpportunity Object:');
    console.log(`   MEDDPICC fields: ${oppCategories.meddpicc.length}`);
    console.log(`   Risk tracking: ${oppCategories.riskTracking.length}`);
    console.log(`   Deal qualification: ${oppCategories.dealQualification.length}`);
    console.log(`   Scratchpad: ${oppCategories.oppScratchpad.length}`);
    console.log(`   Other custom: ${oppCategories.other.length}`);

    console.log('\n✅ Inspection complete!');
    console.log('='.repeat(80));

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
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
inspectAllFields().catch(console.error);
