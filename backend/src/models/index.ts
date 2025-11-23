// Import models in dependency order
import Customer from './Customer';
import User from './User';
import CustomerConfig from './CustomerConfig';
import OAuthToken from './OAuthToken';
import AuditLog from './AuditLog';

// Export all models
export {
  Customer,
  User,
  CustomerConfig,
  OAuthToken,
  AuditLog,
};

// Export types
export { SubscriptionTier, SubscriptionStatus } from './Customer';
export { UserRole } from './User';
export type { CustomerAttributes, CustomerCreationAttributes } from './Customer';
export type { UserAttributes, UserCreationAttributes } from './User';
export type { CustomerConfigAttributes, CustomerConfigCreationAttributes, FieldMappings, RiskRules, PriorityWeights } from './CustomerConfig';
export type { OAuthTokenAttributes, OAuthTokenCreationAttributes } from './OAuthToken';
export type { AuditLogAttributes, AuditLogCreationAttributes } from './AuditLog';

// Export database connection and utilities
export { default as sequelize, testConnection, syncDatabase } from '../config/database';
