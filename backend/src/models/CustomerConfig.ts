import { DataTypes, Model, Optional, Association } from 'sequelize';
import sequelize from '../config/database';
import Customer from './Customer';

export interface FieldMappings {
  // Account field mappings
  accountOwner?: string;
  industry?: string;
  accountType?: string;
  clayTechnologies?: string;
  claySeniority?: string;
  sixSenseProfile?: string;
  sixSenseReach?: string;

  // Opportunity field mappings
  amount?: string;
  closeDate?: string;
  stage?: string;
  probability?: string;
  nextStep?: string;

  // Custom field mappings (extensible)
  [key: string]: string | undefined;
}

export interface RiskRules {
  staleOpportunityDays?: number;
  highRiskStages?: string[];
  lowEngagementThreshold?: number;
  staleDealWarningDays?: number;

  // Custom risk rules (extensible)
  [key: string]: any;
}

export interface PriorityWeights {
  dealSize?: number;
  closeProximity?: number;
  riskScore?: number;
  engagementLevel?: number;
  strategicValue?: number;

  // Custom weights (extensible)
  [key: string]: number | undefined;
}

export interface CustomerConfigAttributes {
  id: string;
  customerId: string;
  fieldMappings: FieldMappings;
  riskRules: RiskRules;
  priorityWeights: PriorityWeights;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CustomerConfigCreationAttributes extends Optional<CustomerConfigAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class CustomerConfig extends Model<CustomerConfigAttributes, CustomerConfigCreationAttributes> implements CustomerConfigAttributes {
  public id!: string;
  public customerId!: string;
  public fieldMappings!: FieldMappings;
  public riskRules!: RiskRules;
  public priorityWeights!: PriorityWeights;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public readonly customer?: Customer;

  public static associations: {
    customer: Association<CustomerConfig, Customer>;
  };

  // Helper methods
  public getFieldMapping(field: string): string | undefined {
    return this.fieldMappings[field];
  }

  public getRiskRule(rule: string): any {
    return this.riskRules[rule];
  }

  public getPriorityWeight(weight: string): number | undefined {
    return this.priorityWeights[weight];
  }

  public updateFieldMapping(field: string, value: string): void {
    this.fieldMappings = {
      ...this.fieldMappings,
      [field]: value,
    };
  }

  public updateRiskRule(rule: string, value: any): void {
    this.riskRules = {
      ...this.riskRules,
      [rule]: value,
    };
  }

  public updatePriorityWeight(weight: string, value: number): void {
    this.priorityWeights = {
      ...this.priorityWeights,
      [weight]: value,
    };
  }
}

CustomerConfig.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: 'customer_id',
      references: {
        model: 'customers',
        key: 'id',
      },
    },
    fieldMappings: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      field: 'field_mappings',
    },
    riskRules: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        staleOpportunityDays: 30,
        highRiskStages: ['Negotiation', 'Proposal'],
        lowEngagementThreshold: 3,
        staleDealWarningDays: 14,
      },
      field: 'risk_rules',
    },
    priorityWeights: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        dealSize: 0.3,
        closeProximity: 0.25,
        riskScore: 0.25,
        engagementLevel: 0.1,
        strategicValue: 0.1,
      },
      field: 'priority_weights',
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
    tableName: 'customer_configs',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['customer_id'],
      },
    ],
  }
);

// Define associations
CustomerConfig.belongsTo(Customer, {
  foreignKey: 'customerId',
  as: 'customer',
});

Customer.hasOne(CustomerConfig, {
  foreignKey: 'customerId',
  as: 'config',
});

export default CustomerConfig;
