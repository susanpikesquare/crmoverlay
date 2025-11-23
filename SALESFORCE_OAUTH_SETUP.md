# Salesforce OAuth 2.0 Setup Guide

This guide will help you set up Salesforce OAuth 2.0 authentication for the Revenue Intelligence CRM Overlay.

## Prerequisites

- Salesforce Developer Account or Salesforce org with admin access
- Access to create Connected Apps in Salesforce

## Step 1: Create a Salesforce Connected App

1. **Log in to Salesforce** (production or sandbox)

2. **Navigate to Setup:**
   - Click the gear icon ⚙️ in the top right
   - Select **Setup**

3. **Create the Connected App:**
   - In the Quick Find box, search for "App Manager"
   - Click **App Manager**
   - Click **New Connected App** button

4. **Fill in Basic Information:**
   - **Connected App Name:** Revenue Intelligence CRM Overlay
   - **API Name:** Revenue_Intelligence_CRM_Overlay (auto-filled)
   - **Contact Email:** Your email address

5. **Enable OAuth Settings:**
   - Check **Enable OAuth Settings**
   - **Callback URL:** `http://localhost:3001/auth/callback`
     - For production, add your production domain callback URL
   - **Selected OAuth Scopes:** Add these scopes:
     - `Access and manage your data (api)`
     - `Perform requests on your behalf at any time (refresh_token, offline_access)`
     - `Access your basic information (id)`
     - `Access unique user identifiers (openid)`

6. **Save the Connected App:**
   - Click **Save**
   - Click **Continue**

7. **Get Your Credentials:**
   - After saving, you'll see your app's details
   - Click **Manage Consumer Details**
   - **Verify your identity** (you may need to enter a verification code sent to your email)
   - Copy the **Consumer Key** (this is your `SF_CLIENT_ID`)
   - Copy the **Consumer Secret** (this is your `SF_CLIENT_SECRET`)

## Step 2: Configure Environment Variables

1. **Create a `.env` file** in the `/backend` directory:
   ```bash
   cd backend
   cp ../.env.example .env
   ```

2. **Edit the `.env` file** and add your Salesforce credentials:
   ```env
   # Server Configuration
   PORT=3001
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000

   # Session Secret - generate a random string
   SESSION_SECRET=your-generated-secret-key-here

   # Salesforce OAuth 2.0 Configuration
   SF_CLIENT_ID=your_consumer_key_from_step_7
   SF_CLIENT_SECRET=your_consumer_secret_from_step_7
   SF_CALLBACK_URL=http://localhost:3001/auth/callback

   # For Sandbox use: https://test.salesforce.com
   # For Production use: https://login.salesforce.com
   SF_LOGIN_URL=https://login.salesforce.com
   ```

3. **Generate a Session Secret:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Copy the output and use it as your `SESSION_SECRET`

## Step 3: Test the OAuth Flow

1. **Start the backend server:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Initiate OAuth flow:**
   - Open your browser
   - Go to: `http://localhost:3001/auth/salesforce`
   - You'll be redirected to Salesforce login

3. **Log in to Salesforce:**
   - Enter your Salesforce credentials
   - Click **Allow** to grant access

4. **Verify success:**
   - You'll be redirected back to `http://localhost:3000/dashboard`
   - Your session should now contain Salesforce tokens

5. **Test the auth status:**
   - In a new tab, go to: `http://localhost:3001/auth/status`
   - You should see `{"success": true, "data": {"authenticated": true, ...}}`

## Available Auth Endpoints

Once configured, your backend will have the following OAuth endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/salesforce` | GET | Initiates OAuth flow, redirects to Salesforce login |
| `/auth/callback` | GET | Handles OAuth callback from Salesforce |
| `/auth/user` | GET | Returns current user info (requires authentication) |
| `/auth/status` | GET | Check if user is authenticated |
| `/auth/logout` | POST | Logs out user and destroys session |

## OAuth Flow Diagram

```
User clicks "Login with Salesforce"
        ↓
GET /auth/salesforce
        ↓
Redirect to Salesforce login page
        ↓
User enters credentials and approves
        ↓
Salesforce redirects back with authorization code
        ↓
GET /auth/callback?code=...
        ↓
Exchange code for access_token & refresh_token
        ↓
Store tokens in session
        ↓
Redirect to frontend dashboard
```

## Troubleshooting

### Error: "redirect_uri_mismatch"
- Ensure the callback URL in your .env matches exactly what's in your Connected App settings
- Check for http vs https
- Check for trailing slashes

### Error: "invalid_client_id"
- Verify your `SF_CLIENT_ID` is correct
- Make sure you copied the Consumer Key, not the Consumer Secret

### Error: "Session expired"
- The access token has expired
- The middleware will automatically attempt to refresh using the refresh_token
- If refresh fails, user needs to log in again

### Error: "CORS errors"
- Make sure `FRONTEND_URL` in .env matches your frontend URL
- Ensure the backend CORS settings allow your frontend origin

## Security Best Practices

1. **Never commit `.env` file** - It's in `.gitignore` by default
2. **Use HTTPS in production** - Update callback URLs and SF_LOGIN_URL accordingly
3. **Rotate secrets regularly** - Update SESSION_SECRET and Connected App credentials periodically
4. **Limit OAuth scopes** - Only request the minimum scopes needed
5. **Use sandbox for testing** - Test with `https://test.salesforce.com` before production

## Next Steps

Once OAuth is working:
1. Create frontend login UI
2. Add protected routes that require authentication
3. Implement Salesforce data fetching (Accounts, Opportunities, etc.)
4. Add Clay and 6sense integrations
5. Build the revenue intelligence dashboard

## Resources

- [Salesforce OAuth 2.0 Documentation](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_web_server_flow.htm)
- [jsforce OAuth Documentation](https://jsforce.github.io/document/#oauth2)
- [Express Session Documentation](https://github.com/expressjs/session)
