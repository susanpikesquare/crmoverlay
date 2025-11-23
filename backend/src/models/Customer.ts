import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import { encrypt, decrypt } from '../utils/encryption';

export enum SubscriptionTier {
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

export enum SubscriptionStatus {
  TRIAL = 'trial',
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  PAST_DUE = 'past_due',
}

export interface CustomerAttributes {
  id: string;
  companyName: string;
  subdomain: string;
  salesforceInstanceUrl: string;
  salesforceClientId: string | null;
  salesforceClientSecret: string | null;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  isSuspended: boolean;
  suspendedReason: string | null;
  suspendedAt: Date | null;
  suspendedByUserId: string | null;
  trialEndsAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CustomerCreationAttributes extends Optional<CustomerAttributes, 'id' | 'createdAt' | 'updatedAt' | 'trialEndsAt' | 'isSuspended' | 'suspendedReason' | 'suspendedAt' | 'suspendedByUserId' | 'salesforceClientId' | 'salesforceClientSecret'> {}

class Customer extends Model<CustomerAttributes, CustomerCreationAttributes> implements CustomerAttributes {
  public id!: string;
  public companyName!: string;
  public subdomain!: string;
  public salesforceInstanceUrl!: string;
  public salesforceClientId!: string | null;
  public salesforceClientSecret!: string | null;
  public subscriptionTier!: SubscriptionTier;
  public subscriptionStatus!: SubscriptionStatus;
  public isSuspended!: boolean;
  public suspendedReason!: string | null;
  public suspendedAt!: Date | null;
  public suspendedByUserId!: string | null;
  public trialEndsAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Helper methods to get decrypted values
  public getDecryptedClientId(): string | null {
    return this.salesforceClientId ? decrypt(this.salesforceClientId) : null;
  }

  public getDecryptedClientSecret(): string | null {
    return this.salesforceClientSecret ? decrypt(this.salesforceClientSecret) : null;
  }

  // Helper method to check if trial is expired
  public isTrialExpired(): boolean {
    if (!this.trialEndsAt) return false;
    return new Date() > this.trialEndsAt;
  }

  // Helper method to check if subscription is active
  public isSubscriptionActive(): boolean {
    return this.subscriptionStatus === SubscriptionStatus.ACTIVE ||
           (this.subscriptionStatus === SubscriptionStatus.TRIAL && !this.isTrialExpired());
  }
}

Customer.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    companyName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'company_name',
    },
    subdomain: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        is: /^[a-z0-9-]+$/, // Only lowercase letters, numbers, and hyphens
      },
    },
    salesforceInstanceUrl: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'salesforce_instance_url',
    },
    salesforceClientId: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'salesforce_client_id',
      set(value: string) {
        // Encrypt before storing
        this.setDataValue('salesforceClientId', encrypt(value));
      },
    },
    salesforceClientSecret: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'salesforce_client_secret',
      set(value: string) {
        // Encrypt before storing
        this.setDataValue('salesforceClientSecret', encrypt(value));
      },
    },
    subscriptionTier: {
      type: DataTypes.ENUM(...Object.values(SubscriptionTier)),
      allowNull: false,
      defaultValue: SubscriptionTier.STARTER,
      field: 'subscription_tier',
    },
    subscriptionStatus: {
      type: DataTypes.ENUM(...Object.values(SubscriptionStatus)),
      allowNull: false,
      defaultValue: SubscriptionStatus.TRIAL,
      field: 'subscription_status',
    },
    isSuspended: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_suspended',
    },
    suspendedReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'suspended_reason',
    },
    suspendedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'suspended_at',
    },
    suspendedByUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'suspended_by_user_id',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    trialEndsAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'trial_ends_at',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at',
    },
  },
  {
    sequelize,
    tableName: 'customers',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['subdomain'],
      },
    ],
  }
);

export default Customer;
