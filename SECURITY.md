# Security Policy

## Reporting Security Issues

If you discover a security vulnerability, please email susan@pikesquare.co with details. Do not create a public GitHub issue.

## Security Best Practices

### Environment Variables

**NEVER** commit the following to the repository:
- `.env` files with real credentials
- API keys or secrets in source code
- Passwords or tokens
- Database credentials
- OAuth client secrets

All sensitive configuration must be stored in:
- `.env` files (which are gitignored)
- Heroku Config Vars for production
- Environment variables

### Required Environment Variables

The following environment variables MUST be set:

1. **SESSION_SECRET** - Random string for session encryption
2. **ENCRYPTION_KEY** - 64-character hex string for data encryption
3. **SUPER_ADMIN_PASSWORD** - Strong password for super admin account
4. **SF_CLIENT_ID** - Salesforce OAuth client ID
5. **SF_CLIENT_SECRET** - Salesforce OAuth client secret
6. **DATABASE_URL** - PostgreSQL connection string (auto-set by Heroku)

### Generating Secure Values

```bash
# Generate SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate SUPER_ADMIN_PASSWORD
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Password Policy

- Minimum length: 12 characters
- Use strong, unique passwords for each environment
- Never reuse passwords across systems
- Rotate passwords regularly
- Use a password manager

### Git History

If credentials are accidentally committed:

1. **Immediately** rotate all affected credentials
2. Update production environment variables
3. Clean git history using git-filter-repo or BFG Repo Cleaner
4. Force push the cleaned history
5. Notify all team members to re-clone the repository

### Access Control

- Limit super admin access to essential personnel only
- Use role-based access control (RBAC) for all users
- Review access permissions quarterly
- Remove access immediately when team members leave

## Security Updates

- Keep all dependencies up to date
- Monitor GitHub security alerts
- Run `npm audit` regularly
- Apply security patches promptly

## Compliance

- All user data is encrypted at rest and in transit
- Session data uses secure, HTTP-only cookies
- Salesforce OAuth tokens are encrypted in the database
- PII (Personally Identifiable Information) is handled according to GDPR/CCPA requirements
