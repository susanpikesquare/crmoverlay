import { Customer, User, CustomerConfig, SubscriptionTier, SubscriptionStatus, UserRole } from '../models';

export async function seedDatabase() {
  console.log('Starting database seeding...');

  try {
    // Check if Axonify customer already exists
    const existingCustomer = await Customer.findOne({
      where: { subdomain: 'axonify' }
    });

    if (existingCustomer) {
      console.log('✓ Axonify customer already exists, skipping seed');
      return;
    }

    // Create Axonify as the first customer
    const axonifyCustomer = await Customer.create({
      companyName: 'Axonify',
      subdomain: 'axonify',
      salesforceInstanceUrl: process.env.SF_LOGIN_URL || 'https://axonify--fullcpy.sandbox.my.salesforce.com',
      salesforceClientId: process.env.SF_CLIENT_ID || '',
      salesforceClientSecret: process.env.SF_CLIENT_SECRET || '',
      subscriptionTier: SubscriptionTier.ENTERPRISE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      trialEndsAt: null, // Active subscription, no trial
    });

    console.log(`✓ Created customer: ${axonifyCustomer.companyName} (${axonifyCustomer.subdomain})`);

    // Create customer configuration with default settings
    const axonifyConfig = await CustomerConfig.create({
      customerId: axonifyCustomer.id,
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

    console.log('✓ Created customer configuration for Axonify');

    // Create initial admin user (Susan McGovern)
    const adminUser = await User.create({
      customerId: axonifyCustomer.id,
      email: process.env.SF_USERNAME || 'smcgovern@axonify.com.fullcpy',
      salesforceUserId: '0053h000005nxlvAAA', // This will be updated on first login
      firstName: 'Susan',
      lastName: 'McGovern',
      role: UserRole.ADMIN,
      salesforceProfile: 'System Administrator',
    });

    console.log(`✓ Created admin user: ${adminUser.getFullName()} (${adminUser.email})`);

    console.log('\n✓ Database seeding completed successfully');
    console.log('\nSeeded data:');
    console.log(`  - Customer: ${axonifyCustomer.companyName}`);
    console.log(`  - Subdomain: ${axonifyCustomer.subdomain}`);
    console.log(`  - Admin: ${adminUser.getFullName()}`);

  } catch (error) {
    console.error('✗ Error seeding database:', error);
    throw error;
  }
}
