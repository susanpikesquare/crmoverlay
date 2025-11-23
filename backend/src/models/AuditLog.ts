import { DataTypes, Model, Optional, Association } from 'sequelize';
import sequelize from '../config/database';
import User from './User';
import Customer from './Customer';

export interface AuditLogAttributes {
  id: string;
  userId: string;
  customerId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  createdAt?: Date;
}

export interface AuditLogCreationAttributes extends Optional<AuditLogAttributes, 'id' | 'createdAt' | 'customerId' | 'resourceId' | 'details'> {}

class AuditLog extends Model<AuditLogAttributes, AuditLogCreationAttributes> implements AuditLogAttributes {
  public id!: string;
  public userId!: string;
  public customerId!: string | null;
  public action!: string;
  public resourceType!: string;
  public resourceId!: string | null;
  public details!: Record<string, any>;
  public ipAddress!: string;
  public userAgent!: string;
  public readonly createdAt!: Date;

  // Associations
  public readonly user?: User;
  public readonly customer?: Customer;

  public static associations: {
    user: Association<AuditLog, User>;
    customer: Association<AuditLog, Customer>;
  };

  // Helper method to create audit log entry
  public static async log(params: {
    userId: string;
    customerId?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    details?: Record<string, any>;
    ipAddress: string;
    userAgent: string;
  }): Promise<AuditLog> {
    return AuditLog.create({
      userId: params.userId,
      customerId: params.customerId || null,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId || null,
      details: params.details || {},
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  }
}

AuditLog.init(
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
      allowNull: true,
      field: 'customer_id',
      references: {
        model: 'customers',
        key: 'id',
      },
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Action performed (e.g., impersonate_customer, suspend_account, view_customer_data)',
    },
    resourceType: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'resource_type',
      comment: 'Type of resource affected (e.g., customer, user, subscription)',
    },
    resourceId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'resource_id',
      comment: 'ID of the affected resource',
    },
    details: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Additional context about the action',
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'ip_address',
    },
    userAgent: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'user_agent',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
    },
  },
  {
    sequelize,
    tableName: 'audit_logs',
    underscored: true,
    timestamps: true,
    updatedAt: false, // Audit logs are never updated
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['customer_id'],
      },
      {
        fields: ['action'],
      },
      {
        fields: ['created_at'],
      },
      {
        fields: ['user_id', 'action'],
      },
      {
        fields: ['customer_id', 'action'],
      },
    ],
  }
);

// Define associations
AuditLog.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

AuditLog.belongsTo(Customer, {
  foreignKey: 'customerId',
  as: 'customer',
});

User.hasMany(AuditLog, {
  foreignKey: 'userId',
  as: 'auditLogs',
});

Customer.hasMany(AuditLog, {
  foreignKey: 'customerId',
  as: 'auditLogs',
});

export default AuditLog;
