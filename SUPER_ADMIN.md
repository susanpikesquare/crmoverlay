# Super Admin Capabilities

## Overview

FormationIQ now includes super admin capabilities for platform-level administration. Super admins are special users who don't belong to any customer and have platform-wide access.

## Super Admin Features

### 1. Authentication
- **Login Method:** Email + Password (NOT Salesforce OAuth)
- **Email:** susan@pikesquare.co
- **Password:** Generated securely during initial database seeding (24 random characters)

### 2. Permissions
Super admins can:
- View all customers and their data
- Impersonate any customer
- Suspend/unsuspend customer accounts
- View all users across all customers
- Access platform-wide analytics
- Manage subscriptions and billing

### 3. User Model Changes

**New Fields:**
```typescript
{
  customerId: null,              // Super admins don't belong to any customer
  salesforceUserId: null,        // No Salesforce integration
  salesforceProfile: null,       // No Salesforce profile
  role: UserRole.SUPER_ADMIN,   // Special super_admin role
  isSuperAdmin: true,            // Flag for quick identification
  passwordHash: string,          // Bcrypt hashed password
  superAdminNotes: string,       // Internal notes about this admin
}
```

**Helper Methods:**
```typescript
// Check if user is super admin
user.isSuperAdminUser() → boolean

// Verify password
await user.verifyPassword(password) → boolean

// Set new password
await user.setPassword(newPassword) → void
```

## Customer Suspension

Super admins can suspend customer accounts.

**New Customer Fields:**
```typescript
{
  isSuspended: boolean,           // Suspension status
  suspendedReason: string,        // Reason for suspension
  suspendedAt: Date,              // When suspended
  suspendedByUserId: string,      // Which super admin suspended
}
```

**Use Cases:**
- Non-payment
- Terms of service violations
- Security concerns
- Account migration

## Audit Logging

All super admin actions are logged for compliance and security.

### AuditLog Model

```typescript
{
  id: UUID,
  userId: UUID,                    // Who performed the action
  customerId: UUID | null,         // Which customer was affected (if any)
  action: string,                  // e.g., "impersonate_customer", "suspend_account"
  resourceType: string,            // e.g., "customer", "user", "subscription"
  resourceId: UUID | null,         // ID of affected resource
  details: JSONB,                  // Additional context
  ipAddress: string,               // Request IP
  userAgent: string,               // Browser/client info
  createdAt: Date,                 // When the action occurred
}
```

### Common Actions Logged

- `impersonate_customer` - When super admin logs in as a customer
- `suspend_account` - Customer account suspended
- `unsuspend_account` - Customer account reactivated
- `view_customer_data` - Viewing sensitive customer information
- `update_subscription` - Changing subscription tier/status
- `create_customer` - New customer onboarded
- `delete_customer` - Customer removed from platform
- `update_user_role` - Changing user permissions
- `reset_password` - Password reset for any user

### Using Audit Logs

```typescript
// Log an action
await AuditLog.log({
  userId: superAdmin.id,
  customerId: customer.id,
  action: 'suspend_account',
  resourceType: 'customer',
  resourceId: customer.id,
  details: {
    reason: 'Non-payment',
    previousStatus: 'active',
    newStatus: 'suspended',
  },
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});

// Query audit logs
const logs = await AuditLog.findAll({
  where: {
    userId: superAdmin.id,
    action: 'impersonate_customer',
  },
  order: [['createdAt', 'DESC']],
  limit: 100,
});
```

## Database Schema Changes

### Users Table
```sql
ALTER TABLE users
  ALTER COLUMN customer_id DROP NOT NULL,
  ALTER COLUMN salesforce_user_id DROP NOT NULL,
  ALTER COLUMN salesforce_profile DROP NOT NULL,
  ADD COLUMN is_super_admin BOOLEAN DEFAULT false,
  ADD COLUMN password_hash VARCHAR(255),
  ADD COLUMN super_admin_notes TEXT;

-- Add SUPER_ADMIN to role enum
ALTER TYPE user_role ADD VALUE 'super_admin';
```

### Customers Table
```sql
ALTER TABLE customers
  ADD COLUMN is_suspended BOOLEAN DEFAULT false,
  ADD COLUMN suspended_reason TEXT,
  ADD COLUMN suspended_at TIMESTAMP,
  ADD COLUMN suspended_by_user_id UUID REFERENCES users(id);
```

### New Audit Logs Table
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  customer_id UUID REFERENCES customers(id),
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(255) NOT NULL,
  resource_id UUID,
  details JSONB NOT NULL DEFAULT '{}',
  ip_address VARCHAR(255) NOT NULL,
  user_agent VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_customer_id ON audit_logs(customer_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_user_action ON audit_logs(user_id, action);
CREATE INDEX idx_audit_logs_customer_action ON audit_logs(customer_id, action);
```

## Initial Setup

When you run `npm run db:init` for the first time, the super admin user is created automatically.

**Output:**
```
✓ Created super admin user: Susan Bamberger (susan@pikesquare.co)

========================================
SUPER ADMIN CREDENTIALS
========================================
Email: susan@pikesquare.co
Password: Xk9#mP2$nQ4&vL8@hT6*rW
========================================
⚠️  SAVE THESE CREDENTIALS SECURELY!
⚠️  Password will not be shown again.
========================================
```

**IMPORTANT:** Save these credentials immediately. The password is only shown once during initial setup.

## Security Considerations

1. **Password Complexity:** Super admin passwords are 24 characters long with mixed case, numbers, and symbols
2. **Password Hashing:** Bcrypt with 10 rounds
3. **Audit Trail:** All actions logged with IP and user agent
4. **Role Separation:** Super admins are clearly distinguished from regular admins
5. **No Salesforce Dependency:** Super admin login works even if Salesforce OAuth is down

## Super Admin Dashboard (Future)

Planned features for super admin interface:

- **Customer Management**
  - List all customers
  - View customer details
  - Suspend/unsuspend accounts
  - Update subscription tiers
  - Impersonate customer view

- **User Management**
  - List all users across all customers
  - Search users by email/name
  - Reset user passwords
  - Change user roles
  - Deactivate users

- **Platform Analytics**
  - Total customers (active/suspended/trial)
  - Total users by role
  - Revenue metrics
  - Usage statistics
  - Churn analytics

- **Audit Log Viewer**
  - Search logs by user, action, date
  - Export logs for compliance
  - Alert on suspicious activity

- **System Health**
  - Database statistics
  - API performance metrics
  - Error rates
  - Uptime monitoring

## API Endpoints (To Be Implemented)

```
POST   /auth/superadmin/login          - Super admin email/password login
GET    /admin/customers                - List all customers
GET    /admin/customers/:id            - View customer details
POST   /admin/customers/:id/suspend    - Suspend customer account
POST   /admin/customers/:id/unsuspend  - Unsuspend customer account
POST   /admin/impersonate/:customerId  - Impersonate customer
GET    /admin/users                    - List all users
GET    /admin/audit-logs               - View audit logs
POST   /admin/audit-logs/export        - Export audit logs
GET    /admin/analytics                - Platform-wide analytics
```

## Migration Path

For existing installations:

1. **Backup Database:** Always backup before running migrations
2. **Run Migration:** `npm run db:init:force` (⚠️ WARNING: Drops all data)
3. **Alternative:** Write custom migration script to preserve existing data
4. **Save Credentials:** Note the super admin password from console output
5. **Test Login:** Verify super admin can log in with email/password
6. **Verify Audit Logs:** Check that actions are being logged

## Best Practices

1. **Limit Super Admins:** Only create super admin accounts for trusted platform administrators
2. **Use Audit Logs:** Regularly review audit logs for unusual activity
3. **Rotate Passwords:** Change super admin passwords periodically
4. **Document Actions:** Use the `superAdminNotes` field to document why actions were taken
5. **Suspension Reasons:** Always provide clear reasons when suspending customers
6. **Compliance:** Export audit logs regularly for compliance requirements

## Example: Suspending a Customer

```typescript
import { Customer, User, AuditLog } from './models';

async function suspendCustomer(
  superAdmin: User,
  customerId: string,
  reason: string,
  req: Request
) {
  // Find customer
  const customer = await Customer.findByPk(customerId);
  if (!customer) throw new Error('Customer not found');

  // Update customer
  customer.isSuspended = true;
  customer.suspendedReason = reason;
  customer.suspendedAt = new Date();
  customer.suspendedByUserId = superAdmin.id;
  await customer.save();

  // Log the action
  await AuditLog.log({
    userId: superAdmin.id,
    customerId: customer.id,
    action: 'suspend_account',
    resourceType: 'customer',
    resourceId: customer.id,
    details: {
      reason,
      previousStatus: 'active',
      suspendedBy: superAdmin.getFullName(),
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return customer;
}
```

## Troubleshooting

**Can't log in as super admin:**
- Check email is exactly: susan@pikesquare.co
- Verify password from initial setup output
- Check database: `SELECT * FROM users WHERE is_super_admin = true`

**Password lost:**
- Reset via database:
  ```typescript
  const superAdmin = await User.findOne({ where: { email: 'susan@pikesquare.co' }});
  await superAdmin.setPassword('new-secure-password');
  await superAdmin.save();
  ```

**Audit logs not working:**
- Check AuditLog model is imported
- Verify audit_logs table exists
- Check foreign key constraints
- Review error logs for issues
