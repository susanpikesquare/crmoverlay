# PostgreSQL Database Setup for FormationIQ

## Overview

FormationIQ now has a multi-tenant SaaS architecture with PostgreSQL database support. This document explains the database structure, models, and how to use them.

## Database Models

### 1. Customer Model
Represents a customer organization (tenant) in the multi-tenant system.

**Fields:**
- `id` (UUID) - Primary key
- `companyName` - Company name (e.g., "Axonify")
- `subdomain` - Unique subdomain (e.g., "axonify" for axonify.formation.pikesquare.co)
- `salesforceInstanceUrl` - Salesforce instance URL
- `salesforceClientId` - Encrypted Salesforce OAuth client ID
- `salesforceClientSecret` - Encrypted Salesforce OAuth client secret
- `subscriptionTier` - Enum: starter, professional, enterprise
- `subscriptionStatus` - Enum: trial, active, cancelled, past_due
- `trialEndsAt` - Trial expiration date (null if not on trial)
- `createdAt`, `updatedAt` - Timestamps

**Helper Methods:**
- `getDecryptedClientId()` - Returns decrypted client ID
- `getDecryptedClientSecret()` - Returns decrypted client secret
- `isTrialExpired()` - Check if trial is expired
- `isSubscriptionActive()` - Check if subscription is active

### 2. User Model
Represents individual users within a customer organization.

**Fields:**
- `id` (UUID) - Primary key
- `customerId` (UUID) - Foreign key to customers table
- `email` - User email (unique)
- `salesforceUserId` - Salesforce user ID
- `firstName`, `lastName` - User name
- `role` - Enum: ae, am, csm, admin
- `salesforceProfile` - Salesforce profile name
- `lastLoginAt` - Last login timestamp
- `createdAt`, `updatedAt` - Timestamps

**Helper Methods:**
- `getFullName()` - Returns full name
- `isAdmin()` - Check if user is admin
- `updateLastLogin()` - Update last login timestamp

### 3. CustomerConfig Model
Stores custom configuration for each customer (field mappings, risk rules, etc.).

**Fields:**
- `id` (UUID) - Primary key
- `customerId` (UUID) - Foreign key to customers table (unique)
- `fieldMappings` (JSONB) - Custom Salesforce field names
- `riskRules` (JSONB) - Risk assessment configuration
- `priorityWeights` (JSONB) - Priority scoring weights
- `createdAt`, `updatedAt` - Timestamps

**Default Risk Rules:**
```json
{
  "staleOpportunityDays": 30,
  "highRiskStages": ["Negotiation", "Proposal"],
  "lowEngagementThreshold": 3,
  "staleDealWarningDays": 14
}
```

**Default Priority Weights:**
```json
{
  "dealSize": 0.3,
  "closeProximity": 0.25,
  "riskScore": 0.25,
  "engagementLevel": 0.1,
  "strategicValue": 0.1
}
```

### 4. OAuthToken Model
Stores encrypted OAuth tokens for Salesforce API access.

**Fields:**
- `id` (UUID) - Primary key
- `userId` (UUID) - Foreign key to users table
- `customerId` (UUID) - Foreign key to customers table
- `accessToken` - Encrypted Salesforce access token
- `refreshToken` - Encrypted Salesforce refresh token
- `instanceUrl` - Salesforce instance URL
- `expiresAt` - Token expiration timestamp
- `createdAt`, `updatedAt` - Timestamps

**Helper Methods:**
- `getDecryptedAccessToken()` - Returns decrypted access token
- `getDecryptedRefreshToken()` - Returns decrypted refresh token
- `isExpired()` - Check if token is expired
- `isExpiringSoon()` - Check if token expires within 5 minutes
- `updateTokens(accessToken, refreshToken, expiresIn)` - Update tokens after refresh

## Security Features

### Encryption
All sensitive data (OAuth tokens, client secrets) are encrypted at rest using AES-256-GCM encryption.

**Encryption Key:**
- Must be a 64-character hexadecimal string (32 bytes)
- Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Set in `.env` as `ENCRYPTION_KEY`

### Data Protection
- Passwords hashed with bcrypt (10 rounds)
- OAuth tokens encrypted before storage
- Salesforce client credentials encrypted before storage
- SSL/TLS required for PostgreSQL connections in production

## Database Initialization

### Local Development

1. **Install PostgreSQL** (if not already installed):
```bash
brew install postgresql@14  # macOS
brew services start postgresql@14
```

2. **Create local database**:
```bash
createdb formation_dev
```

3. **Initialize database** (create tables and seed data):
```bash
cd backend
npm run db:init
```

This will:
- Test database connection
- Create all tables with proper schema
- Seed Axonify as the first customer
- Create admin user (Susan McGovern)

4. **Reset database** (drop all tables and recreate):
```bash
npm run db:init:force
```

### Heroku Production

The Heroku PostgreSQL addon has been added to your app. The database will be automatically initialized on first deployment.

**Environment Variables to Set:**
```bash
heroku config:set ENCRYPTION_KEY=<your-64-char-hex-key> --app formation-production
```

## Using the Database Models

### Example: Query Customer
```typescript
import { Customer } from './models';

// Find customer by subdomain
const customer = await Customer.findOne({
  where: { subdomain: 'axonify' }
});

// Get decrypted credentials
const clientId = customer.getDecryptedClientId();
const clientSecret = customer.getDecryptedClientSecret();
```

### Example: Create User
```typescript
import { User, UserRole } from './models';

const user = await User.create({
  customerId: customer.id,
  email: 'john@example.com',
  salesforceUserId: 'sfUserId123',
  firstName: 'John',
  lastName: 'Doe',
  role: UserRole.AE,
  salesforceProfile: 'Sales User',
});
```

### Example: Store OAuth Token
```typescript
import { OAuthToken } from './models';

const token = await OAuthToken.create({
  userId: user.id,
  customerId: customer.id,
  accessToken: sfResponse.access_token, // Will be automatically encrypted
  refreshToken: sfResponse.refresh_token, // Will be automatically encrypted
  instanceUrl: sfResponse.instance_url,
  expiresAt: new Date(Date.now() + 7200 * 1000), // 2 hours
});

// Later, retrieve and use the token
const decryptedToken = token.getDecryptedAccessToken();
```

### Example: Update Customer Config
```typescript
import { CustomerConfig } from './models';

const config = await CustomerConfig.findOne({
  where: { customerId: customer.id }
});

// Update a field mapping
config.updateFieldMapping('customField', 'Custom_Field__c');
await config.save();
```

## Next Steps

1. **Update Authentication Routes** - Integrate database models into auth.ts routes
2. **Multi-Tenant Support** - Add subdomain detection and routing
3. **Token Refresh Logic** - Implement automatic OAuth token refresh
4. **Admin Dashboard** - Build UI for managing customers and configurations
5. **Subscription Management** - Add Stripe integration for billing

## Database Schema Diagram

```
┌─────────────┐
│  customers  │
│             │
│ • id (PK)   │────┐
│ • subdomain │    │
│ • company   │    │
│ • sf_creds  │    │
└─────────────┘    │
                   │
       ┌───────────┴──────────────┬────────────────┐
       │                          │                │
       ▼                          ▼                ▼
┌─────────────┐          ┌──────────────┐  ┌──────────────┐
│    users    │          │   configs    │  │oauth_tokens  │
│             │          │              │  │              │
│ • id (PK)   │          │ • id (PK)    │  │ • id (PK)    │
│ • customer  │◄─────────│ • customer   │  │ • user_id    │
│ • email     │          │ • mappings   │  │ • customer   │
│ • role      │          │ • rules      │  │ • tokens     │
└─────────────┘          └──────────────┘  └──────────────┘
```

## Seeded Data

The database is seeded with:

**Customer:**
- Company: Axonify
- Subdomain: axonify
- Tier: Enterprise
- Status: Active

**Admin User:**
- Name: Susan McGovern
- Email: smcgovern@axonify.com.fullcpy
- Role: Admin

## Troubleshooting

### Connection Issues
If you get connection errors:
1. Check PostgreSQL is running: `brew services list`
2. Verify DATABASE_URL in .env
3. Check database exists: `psql -l`

### Encryption Errors
If you get encryption/decryption errors:
1. Verify ENCRYPTION_KEY is set in .env
2. Ensure it's a 64-character hex string
3. Don't change the key after data is encrypted

### Migration Issues
If tables aren't created:
1. Run `npm run db:init:force` to reset
2. Check PostgreSQL logs for errors
3. Verify user has CREATE TABLE permissions
