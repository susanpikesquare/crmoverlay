import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface AccountPlanAttributes {
  id: string;
  salesforceAccountId: string;
  salesforceUserId: string;
  planName: string;
  status: 'draft' | 'active' | 'archived';
  planDate: Date;

  // JSONB snapshot columns
  accountSnapshot: Record<string, any>;
  renewalOppsSnapshot: Record<string, any>[];
  expansionOppsSnapshot: Record<string, any>[];
  contactsSnapshot: Record<string, any>[];

  // User-authored strategy text
  executiveSummary: string;
  retentionStrategy: string;
  growthStrategy: string;
  keyInitiatives: string;
  risksAndMitigations: string;
  nextSteps: string;
  additionalNotes: string;

  // Export tracking
  lastExportedAt: Date | null;
  lastExportFormat: string | null;
  googleDocId: string | null;
  googleSlidesId: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface AccountPlanCreationAttributes extends Optional<AccountPlanAttributes,
  'id' | 'status' | 'planDate' | 'accountSnapshot' | 'renewalOppsSnapshot' |
  'expansionOppsSnapshot' | 'contactsSnapshot' | 'executiveSummary' | 'retentionStrategy' |
  'growthStrategy' | 'keyInitiatives' | 'risksAndMitigations' | 'nextSteps' |
  'additionalNotes' | 'lastExportedAt' | 'lastExportFormat' | 'googleDocId' |
  'googleSlidesId' | 'createdAt' | 'updatedAt'
> {}

class AccountPlan extends Model<AccountPlanAttributes, AccountPlanCreationAttributes> implements AccountPlanAttributes {
  public id!: string;
  public salesforceAccountId!: string;
  public salesforceUserId!: string;
  public planName!: string;
  public status!: 'draft' | 'active' | 'archived';
  public planDate!: Date;

  public accountSnapshot!: Record<string, any>;
  public renewalOppsSnapshot!: Record<string, any>[];
  public expansionOppsSnapshot!: Record<string, any>[];
  public contactsSnapshot!: Record<string, any>[];

  public executiveSummary!: string;
  public retentionStrategy!: string;
  public growthStrategy!: string;
  public keyInitiatives!: string;
  public risksAndMitigations!: string;
  public nextSteps!: string;
  public additionalNotes!: string;

  public lastExportedAt!: Date | null;
  public lastExportFormat!: string | null;
  public googleDocId!: string | null;
  public googleSlidesId!: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AccountPlan.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    salesforceAccountId: {
      type: DataTypes.STRING(18),
      allowNull: false,
      field: 'salesforce_account_id',
    },
    salesforceUserId: {
      type: DataTypes.STRING(18),
      allowNull: false,
      field: 'salesforce_user_id',
    },
    planName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'plan_name',
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'draft',
    },
    planDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'plan_date',
    },

    // JSONB snapshot columns
    accountSnapshot: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      field: 'account_snapshot',
    },
    renewalOppsSnapshot: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      field: 'renewal_opps_snapshot',
    },
    expansionOppsSnapshot: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      field: 'expansion_opps_snapshot',
    },
    contactsSnapshot: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      field: 'contacts_snapshot',
    },

    // User-authored strategy text
    executiveSummary: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
      field: 'executive_summary',
    },
    retentionStrategy: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
      field: 'retention_strategy',
    },
    growthStrategy: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
      field: 'growth_strategy',
    },
    keyInitiatives: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
      field: 'key_initiatives',
    },
    risksAndMitigations: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
      field: 'risks_and_mitigations',
    },
    nextSteps: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
      field: 'next_steps',
    },
    additionalNotes: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
      field: 'additional_notes',
    },

    // Export tracking
    lastExportedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_exported_at',
    },
    lastExportFormat: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'last_export_format',
    },
    googleDocId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'google_doc_id',
    },
    googleSlidesId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'google_slides_id',
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
    tableName: 'account_plans',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['salesforce_account_id'] },
      { fields: ['salesforce_user_id'] },
      { fields: ['status'] },
      { fields: ['salesforce_user_id', 'salesforce_account_id'] },
    ],
  }
);

export default AccountPlan;
