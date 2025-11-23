import { DataTypes, Model, Optional, Association } from 'sequelize';
import sequelize from '../config/database';
import { encrypt, decrypt } from '../utils/encryption';
import User from './User';
import Customer from './Customer';

export interface OAuthTokenAttributes {
  id: string;
  userId: string;
  customerId: string;
  accessToken: string;
  refreshToken: string;
  instanceUrl: string;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OAuthTokenCreationAttributes extends Optional<OAuthTokenAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class OAuthToken extends Model<OAuthTokenAttributes, OAuthTokenCreationAttributes> implements OAuthTokenAttributes {
  public id!: string;
  public userId!: string;
  public customerId!: string;
  public accessToken!: string;
  public refreshToken!: string;
  public instanceUrl!: string;
  public expiresAt!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public readonly user?: User;
  public readonly customer?: Customer;

  public static associations: {
    user: Association<OAuthToken, User>;
    customer: Association<OAuthToken, Customer>;
  };

  // Helper methods to get decrypted tokens
  public getDecryptedAccessToken(): string {
    return decrypt(this.accessToken);
  }

  public getDecryptedRefreshToken(): string {
    return decrypt(this.refreshToken);
  }

  // Check if token is expired
  public isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  // Check if token is about to expire (within 5 minutes)
  public isExpiringSoon(): boolean {
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    return this.expiresAt < fiveMinutesFromNow;
  }

  // Update tokens after refresh
  public async updateTokens(accessToken: string, refreshToken: string, expiresIn: number): Promise<void> {
    this.accessToken = accessToken; // Will be encrypted by setter
    this.refreshToken = refreshToken; // Will be encrypted by setter
    this.expiresAt = new Date(Date.now() + expiresIn * 1000);
    await this.save();
  }
}

OAuthToken.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'customer_id',
      references: {
        model: 'customers',
        key: 'id',
      },
    },
    accessToken: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'access_token',
      set(value: string) {
        // Encrypt before storing
        this.setDataValue('accessToken', encrypt(value));
      },
    },
    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'refresh_token',
      set(value: string) {
        // Encrypt before storing
        this.setDataValue('refreshToken', encrypt(value));
      },
    },
    instanceUrl: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'instance_url',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
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
    tableName: 'oauth_tokens',
    underscored: true,
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['customer_id'],
      },
      {
        fields: ['expires_at'],
      },
    ],
  }
);

// Define associations
OAuthToken.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

OAuthToken.belongsTo(Customer, {
  foreignKey: 'customerId',
  as: 'customer',
});

User.hasMany(OAuthToken, {
  foreignKey: 'userId',
  as: 'oauthTokens',
});

Customer.hasMany(OAuthToken, {
  foreignKey: 'customerId',
  as: 'oauthTokens',
});

export default OAuthToken;
