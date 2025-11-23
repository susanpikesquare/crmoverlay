import { DataTypes, Model, Optional, Association } from 'sequelize';
import sequelize from '../config/database';
import Customer from './Customer';

export enum UserRole {
  AE = 'ae',
  AM = 'am',
  CSM = 'csm',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

export interface UserAttributes {
  id: string;
  customerId: string | null;
  email: string;
  salesforceUserId: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  salesforceProfile: string | null;
  isSuperAdmin: boolean;
  passwordHash: string | null;
  superAdminNotes: string | null;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'createdAt' | 'updatedAt' | 'lastLoginAt' | 'customerId' | 'salesforceUserId' | 'salesforceProfile' | 'isSuperAdmin' | 'passwordHash' | 'superAdminNotes'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: string;
  public customerId!: string | null;
  public email!: string;
  public salesforceUserId!: string | null;
  public firstName!: string;
  public lastName!: string;
  public role!: UserRole;
  public salesforceProfile!: string | null;
  public isSuperAdmin!: boolean;
  public passwordHash!: string | null;
  public superAdminNotes!: string | null;
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
    return this.role === UserRole.ADMIN || this.role === UserRole.SUPER_ADMIN;
  }

  public isSuperAdminUser(): boolean {
    return this.isSuperAdmin === true || this.role === UserRole.SUPER_ADMIN;
  }

  public async updateLastLogin(): Promise<void> {
    this.lastLoginAt = new Date();
    await this.save();
  }

  // Verify password for super admin login
  public async verifyPassword(password: string): Promise<boolean> {
    if (!this.passwordHash) return false;
    const bcrypt = await import('bcrypt');
    return bcrypt.compare(password, this.passwordHash);
  }

  // Set password for super admin
  public async setPassword(password: string): Promise<void> {
    const bcrypt = await import('bcrypt');
    this.passwordHash = await bcrypt.hash(password, 10);
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
      allowNull: true, // Null for super admins
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
      allowNull: true, // Null for super admins
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
      allowNull: true, // Null for super admins
      field: 'salesforce_profile',
    },
    isSuperAdmin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_super_admin',
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'password_hash',
    },
    superAdminNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'super_admin_notes',
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
