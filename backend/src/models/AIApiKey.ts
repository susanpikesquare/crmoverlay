import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import { encrypt, decrypt } from '../utils/encryption';

export enum AIProvider {
  ANTHROPIC = 'anthropic',
  OPENAI = 'openai',
  GOOGLE = 'google',
}

export interface AIApiKeyAttributes {
  id: string;
  customerId: string;
  provider: AIProvider;
  apiKey: string;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AIApiKeyCreationAttributes extends Optional<AIApiKeyAttributes, 'id' | 'createdAt' | 'updatedAt' | 'isActive' | 'lastUsedAt'> {}

class AIApiKey extends Model<AIApiKeyAttributes, AIApiKeyCreationAttributes> implements AIApiKeyAttributes {
  public id!: string;
  public customerId!: string;
  public provider!: AIProvider;
  public apiKey!: string;
  public isActive!: boolean;
  public lastUsedAt!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Helper method to get decrypted API key
  public getDecryptedApiKey(): string {
    return decrypt(this.apiKey);
  }

  // Helper method to update last used timestamp
  public async markAsUsed(): Promise<void> {
    this.lastUsedAt = new Date();
    await this.save();
  }
}

AIApiKey.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'customer_id',
      references: {
        model: 'customers',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    provider: {
      type: DataTypes.ENUM(...Object.values(AIProvider)),
      allowNull: false,
    },
    apiKey: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'api_key',
      set(value: string) {
        // Encrypt before storing
        this.setDataValue('apiKey', encrypt(value));
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_used_at',
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
    tableName: 'ai_api_keys',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['customer_id', 'provider'],
        name: 'unique_customer_provider',
      },
      {
        fields: ['customer_id'],
      },
      {
        fields: ['is_active'],
      },
    ],
  }
);

export default AIApiKey;
