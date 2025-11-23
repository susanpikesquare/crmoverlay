# Heroku Deployment Guide

This guide walks you through deploying the CRM Overlay application to Heroku.

## Prerequisites

1. **Heroku Account**: Sign up at https://heroku.com
2. **Heroku CLI**: Install from https://devcenter.heroku.com/articles/heroku-cli
3. **Git**: Ensure your project is a git repository

## Step 1: Login to Heroku

```bash
heroku login
```

## Step 2: Create a Heroku App

```bash
cd "/Users/susanbamberger/Development/Applications/CRM Overlay"
heroku create YOUR-APP-NAME
```

Replace `YOUR-APP-NAME` with your desired app name (or omit to auto-generate).

## Step 3: Configure Salesforce Connected App

1. Go to Salesforce Setup → App Manager → New Connected App
2. Set the callback URL to: `https://YOUR-APP-NAME.herokuapp.com/auth/callback`
3. Enable OAuth Settings with scopes: `full` and `refresh_token`
4. Copy the Consumer Key (Client ID) and Consumer Secret

## Step 4: Set Environment Variables

Set all required environment variables in Heroku:

```bash
# Required: Session secret (generate a random string)
heroku config:set SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Required: Salesforce OAuth credentials
heroku config:set SF_CLIENT_ID="your-salesforce-consumer-key"
heroku config:set SF_CLIENT_SECRET="your-salesforce-consumer-secret"
heroku config:set SF_CALLBACK_URL="https://YOUR-APP-NAME.herokuapp.com/auth/callback"
heroku config:set SF_LOGIN_URL="https://login.salesforce.com"

# Required: Node environment
heroku config:set NODE_ENV="production"

# Optional: Salesforce credentials for scripts (if needed)
heroku config:set SF_USERNAME="your-username@example.com"
heroku config:set SF_PASSWORD="your-password"
heroku config:set SF_SECURITY_TOKEN="your-security-token"

# Optional: Third-party API keys
heroku config:set CLAY_API_KEY="your-clay-api-key"
heroku config:set SIXSENSE_API_KEY="your-6sense-api-key"
```

## Step 5: Deploy to Heroku

```bash
# Add Heroku remote (if not already added)
git remote add heroku https://git.heroku.com/YOUR-APP-NAME.git

# Commit any pending changes
git add .
git commit -m "Prepare for Heroku deployment"

# Push to Heroku
git push heroku main
```

If your main branch is named differently (e.g., `master`), use:
```bash
git push heroku master
```

## Step 6: Open Your Application

```bash
heroku open
```

Your application should now be running at `https://YOUR-APP-NAME.herokuapp.com`

## Troubleshooting

### View Logs
```bash
heroku logs --tail
```

### Check Build Status
```bash
heroku builds
```

### Restart the App
```bash
heroku restart
```

### Verify Config Vars
```bash
heroku config
```

### Run Build Manually
If you need to debug the build process:
```bash
heroku run bash
npm run build
```

## Post-Deployment

1. **Test OAuth Flow**: Visit your app and click "Login with Salesforce"
2. **Update Salesforce Connected App**: Ensure the callback URL matches your Heroku URL
3. **Monitor Application**: Check Heroku dashboard for dyno status and logs

## Updating the Application

To deploy updates:

```bash
git add .
git commit -m "Your update message"
git push heroku main
```

Heroku will automatically rebuild and restart your application.

## Additional Configuration

### Custom Domain (Optional)
```bash
heroku domains:add www.yourdomain.com
```

### SSL Certificate (Automatic)
Heroku provides automatic SSL for all `*.herokuapp.com` domains.

### Scale Dynos (if needed)
```bash
# View current dyno status
heroku ps

# Scale to more dynos (requires paid plan)
heroku ps:scale web=2
```

## Important Notes

1. **Node Version**: The app specifies Node 18.x in `package.json`. Heroku will use this version.
2. **Build Process**: Heroku runs `npm install` and `npm run build` automatically via `heroku-postbuild` script.
3. **Port Configuration**: Heroku sets the `PORT` environment variable automatically. The app reads from `process.env.PORT`.
4. **Static Files**: The backend serves the built frontend files from `frontend/dist` in production.

## Support

For issues related to:
- Heroku deployment: https://devcenter.heroku.com
- Salesforce OAuth: Refer to `SALESFORCE_OAUTH_SETUP.md`
- Application bugs: Check application logs with `heroku logs --tail`
