import { Customer, User, CustomerConfig, SubscriptionTier, SubscriptionStatus, UserRole } from '../models';
import crypto from 'crypto';

// Generate a secure random password
function generateSecurePassword(length: number = 20): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
  let password = '';
  const randomBytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }

  return password;
}

export async function seedDatabase() {
  console.log('Starting database seeding...');

  try {
    // Check if super admin already exists
    let existingSuperAdmin = await User.findOne({
      where: { email: 'susan@pikesquare.co' }
    });

    // Super admin password should be set via environment variable for security
    // Generate a random password if not provided
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || generateSecurePassword(32);

    if (!existingSuperAdmin) {
      // Create super admin user
      const superAdmin = await User.create({
        customerId: null, // Super admins don't belong to any customer
        email: 'susan@pikesquare.co',
        salesforceUserId: null,
        firstName: 'Susan',
        lastName: 'Bamberger',
        role: UserRole.SUPER_ADMIN,
        salesforceProfile: null,
        isSuperAdmin: true,
        superAdminNotes: 'Platform owner and super admin',
      });

      // Set password
      await superAdmin.setPassword(superAdminPassword);
      await superAdmin.save();

      console.log('✓ Created super admin user: Susan Bamberger (susan@pikesquare.co)');
    } else {
      // Update existing super admin password
      await existingSuperAdmin.setPassword(superAdminPassword);
      await existingSuperAdmin.save();
      console.log('✓ Super admin user already exists, password updated');
    }

    // Check if the seed customer already exists. Identifies by the
    // subdomain env var (defaults to 'demo' for fresh installs).
    const seedSubdomain = process.env.SEED_CUSTOMER_SUBDOMAIN || 'demo';
    const seedCompanyName = process.env.SEED_CUSTOMER_NAME || 'Demo Tenant';
    const existingCustomer = await Customer.findOne({
      where: { subdomain: seedSubdomain }
    });

    if (existingCustomer) {
      console.log(`✓ Seed customer "${seedSubdomain}" already exists, skipping seed`);
      return;
    }

    // Create the seed customer (first/default tenant).
    const seedCustomer = await Customer.create({
      companyName: seedCompanyName,
      subdomain: seedSubdomain,
      salesforceInstanceUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com',
      salesforceClientId: process.env.SF_CLIENT_ID || '',
      salesforceClientSecret: process.env.SF_CLIENT_SECRET || '',
      subscriptionTier: SubscriptionTier.ENTERPRISE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      trialEndsAt: null,
    });

    console.log(`✓ Created customer: ${seedCustomer.companyName} (${seedCustomer.subdomain})`);

    // Create customer configuration with default settings
    const seedConfig = await CustomerConfig.create({
      customerId: seedCustomer.id,
      fieldMappings: {
        // Account field mappings
        accountOwner: 'OwnerId',
        industry: 'Industry',
        accountType: 'Type',
        clayTechnologies: 'Clay_Technologies__c',
        claySeniority: 'Clay_Seniority__c',
        sixSenseProfile: 'X6sense_Profile__c',
        sixSenseReach: 'X6sense_Reach__c',

        // Opportunity field mappings
        amount: 'Amount',
        closeDate: 'CloseDate',
        stage: 'StageName',
        probability: 'Probability',
        nextStep: 'NextStep',
      },
      riskRules: {
        staleOpportunityDays: 30,
        highRiskStages: ['Negotiation', 'Proposal/Price Quote'],
        lowEngagementThreshold: 3,
        staleDealWarningDays: 14,
      },
      priorityWeights: {
        dealSize: 0.3,
        closeProximity: 0.25,
        riskScore: 0.25,
        engagementLevel: 0.1,
        strategicValue: 0.1,
      },
    });

    console.log(`✓ Created customer configuration for ${seedCustomer.companyName}`);

    // Create the initial admin user. Email + name come from env vars so
    // operators can seed their own admin without code changes.
    const adminEmail = process.env.SEED_ADMIN_EMAIL || process.env.SF_USERNAME || 'admin@example.com';
    const adminFirstName = process.env.SEED_ADMIN_FIRST_NAME || 'Admin';
    const adminLastName = process.env.SEED_ADMIN_LAST_NAME || 'User';
    const adminUser = await User.create({
      customerId: seedCustomer.id,
      email: adminEmail,
      salesforceUserId: process.env.SEED_ADMIN_SF_USER_ID || '',
      firstName: adminFirstName,
      lastName: adminLastName,
      role: UserRole.ADMIN,
      salesforceProfile: 'System Administrator',
    });

    console.log(`✓ Created admin user: ${adminUser.getFullName()} (${adminUser.email})`);

    console.log('\n✓ Database seeding completed successfully');
    console.log('\nSeeded data:');
    console.log(`  - Customer: ${seedCustomer.companyName}`);
    console.log(`  - Subdomain: ${seedCustomer.subdomain}`);
    console.log(`  - Admin: ${adminUser.getFullName()}`);

  } catch (error) {
    console.error('✗ Error seeding database:', error);
    throw error;
  }
}
