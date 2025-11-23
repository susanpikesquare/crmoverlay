import { DataTypes, Model, Optional, Association } from 'sequelize';
import sequelize from '../config/database';
import Customer from './Customer';

export enum UserRole {
  AE = 'ae',
  AM = 'am',
  CSM = 'csm',
  ADMIN = 'admin',
}

export interface UserAttributes {
  id: string;
  customerId: string;
  email: string;
  salesforceUserId: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  salesforceProfile: string;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'createdAt' | 'updatedAt' | 'lastLoginAt'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: string;
  public customerId!: string;
  public email!: string;
  public salesforceUserId!: string;
  public firstName!: string;
  public lastName!: string;
  public role!: UserRole;
  public salesforceProfile!: string;
  public lastLoginAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public readonly customer?: Customer;

  public static associations: {
    customer: Association<User, Customer>;
  };

  // Helper methods
  public getFullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  public isAdmin(): boolean {
    return this.role === UserRole.ADMIN;
  }

  public async updateLastLogin(): Promise<void> {
    this.lastLoginAt = new Date();
    await this.save();
  }
}

User.init(
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
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    salesforceUserId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'salesforce_user_id',
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'first_name',
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'last_name',
    },
    role: {
      type: DataTypes.ENUM(...Object.values(UserRole)),
      allowNull: false,
      defaultValue: UserRole.AE,
    },
    salesforceProfile: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'salesforce_profile',
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login_at',
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
    tableName: 'users',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['email'],
      },
      {
        fields: ['customer_id'],
      },
      {
        fields: ['salesforce_user_id'],
      },
    ],
  }
);

// Define associations
User.belongsTo(Customer, {
  foreignKey: 'customerId',
  as: 'customer',
});

Customer.hasMany(User, {
  foreignKey: 'customerId',
  as: 'users',
});

export default User;
