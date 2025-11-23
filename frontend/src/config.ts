export const config = {
  apiBaseUrl: import.meta.env.PROD ? '' : 'http://localhost:3001',
  environment: import.meta.env.PROD ? 'production' : 'development'
};
