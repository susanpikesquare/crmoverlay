import jsforce, { OAuth2, Connection } from 'jsforce';

/**
 * Salesforce OAuth2 Configuration
 *
 * This configuration is used to authenticate users via Salesforce OAuth 2.0 flow.
 * Make sure to set up a Connected App in Salesforce with the correct callback URL.
 */

export interface SalesforceOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  loginUrl: string;
}

/**
 * Get Salesforce OAuth2 configuration from environment variables
 * @returns {SalesforceOAuthConfig} The OAuth configuration object
 * @throws {Error} If required environment variables are missing
 */
export const getSalesforceConfig = (): SalesforceOAuthConfig => {
  const clientId = process.env.SF_CLIENT_ID;
  const clientSecret = process.env.SF_CLIENT_SECRET;
  const redirectUri = process.env.SF_CALLBACK_URL;
  const loginUrl = process.env.SF_LOGIN_URL || 'https://login.salesforce.com';

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Missing required Salesforce OAuth environment variables. ' +
      'Please set SF_CLIENT_ID, SF_CLIENT_SECRET, and SF_CALLBACK_URL in your .env file.'
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    loginUrl,
  };
};

/**
 * Create a new jsforce OAuth2 instance
 * @param customClientId - Optional customer-specific client ID
 * @param customClientSecret - Optional customer-specific client secret
 * @param customLoginUrl - Optional customer-specific login URL
 * @returns {OAuth2} Configured OAuth2 instance
 */
export const createOAuth2Instance = (
  customClientId?: string,
  customClientSecret?: string,
  customLoginUrl?: string
): OAuth2 => {
  const config = getSalesforceConfig();

  return new jsforce.OAuth2({
    clientId: customClientId || config.clientId,
    clientSecret: customClientSecret || config.clientSecret,
    redirectUri: config.redirectUri,
    loginUrl: customLoginUrl || config.loginUrl,
  });
};

/**
 * Create a Salesforce connection with stored tokens
 * @param {string} accessToken - The Salesforce access token
 * @param {string} instanceUrl - The Salesforce instance URL
 * @param {string} [refreshToken] - Optional refresh token for automatic refresh
 * @returns {Connection} Configured Salesforce connection
 */
export const createConnection = (
  accessToken: string,
  instanceUrl: string,
  refreshToken?: string
): Connection => {
  const oauth2 = createOAuth2Instance();

  const connection = new jsforce.Connection({
    oauth2,
    accessToken,
    instanceUrl,
    refreshToken,
  });

  return connection;
};
