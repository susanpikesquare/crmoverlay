# Salesforce Field Inspector

This utility script inspects your Salesforce Account object to identify all custom fields, with special focus on 6sense, Clay, and priority scoring fields.

## Prerequisites

1. Add your Salesforce credentials to `backend/.env`:

```bash
SF_USERNAME=your-email@axonify.com
SF_PASSWORD=your-salesforce-password
SF_SECURITY_TOKEN=your-security-token
```

**Note:** Your security token is required unless your IP is whitelisted in Salesforce.

### Getting Your Security Token

1. Log in to your Salesforce sandbox: https://axonify--fullcpy.sandbox.my.salesforce.com
2. Click your profile picture > Settings
3. In the left sidebar: My Personal Information > Reset My Security Token
4. Click "Reset Security Token"
5. Check your email for the new token
6. Add it to your `.env` file

## Running the Script

From the `backend` directory:

```bash
npm run inspect-fields
```

## What It Does

The script will:

1. Connect to your Salesforce sandbox using username/password authentication
2. Retrieve metadata for the Account object
3. Categorize all custom fields into:
   - **6sense fields**: Intent scores, buying stage, profile fit, etc.
   - **Clay fields**: Employee count, tech stack, enrichment data, etc.
   - **Priority fields**: Scoring and prioritization fields
   - **Other custom fields**: Any other custom fields on the Account object

4. Output:
   - A summary of field counts
   - Detailed information about each relevant field (name, label, type, updateable status)
   - A suggested TypeScript interface based on actual fields
   - A suggested SOQL query to retrieve the data

## Example Output

```
================================================================================
SALESFORCE ACCOUNT FIELD INSPECTOR
================================================================================

📋 Configuration:
   Salesforce URL: https://axonify--fullcpy.sandbox.my.salesforce.com
   Client ID: 3MVG9P7Pp4QrREPnFXV...

🔌 Connecting to Salesforce...
✅ Connected successfully!

🔍 Analyzing Account object fields...

📊 SUMMARY
--------------------------------------------------------------------------------
Total fields: 156
Custom fields: 42
Standard fields: 114

🎯 6SENSE FIELDS (7)
--------------------------------------------------------------------------------
   accountBuyingStage6sense__c
      Label: 6sense Buying Stage
      Type: string (255)
      Updateable: true

   accountIntentScore6sense__c
      Label: 6sense Intent Score
      Type: double
      Updateable: true

   ...

🧱 CLAY FIELDS (5)
--------------------------------------------------------------------------------
   Clay_Employee_Count__c
      Label: Employee Count (Clay)
      Type: double
      Updateable: true

   ...

💻 SUGGESTED TYPESCRIPT INTERFACE
--------------------------------------------------------------------------------
export interface Account {
  // Standard fields
  Id: string;
  Name: string;
  Industry?: string;
  OwnerId?: string;

  // 6sense fields
  accountBuyingStage6sense__c?: string; // 6sense Buying Stage
  accountIntentScore6sense__c?: number; // 6sense Intent Score
  ...
}

📝 SUGGESTED SOQL QUERY
--------------------------------------------------------------------------------
SELECT
  Id,
  Name,
  Industry,
  OwnerId,
  accountBuyingStage6sense__c,
  accountIntentScore6sense__c,
  ...
FROM Account
WHERE OwnerId = 'YOUR_USER_ID'
LIMIT 10
```

## Next Steps

After running the script:

1. Review the output to see what fields actually exist in your Salesforce
2. Update `backend/src/services/salesforceData.ts` to use the actual field names
3. Update the TypeScript interfaces to match the real fields
4. Test your queries with the suggested SOQL

## Troubleshooting

### "Missing SF_USERNAME or SF_PASSWORD"
Add these to your `backend/.env` file.

### "Authentication failed"
- Check your username and password are correct
- Ensure your security token is appended to your password
- Verify you're using the correct login URL for your sandbox

### "INVALID_FIELD" errors in queries
The script will show you exactly which fields exist, so you can update your queries accordingly.
