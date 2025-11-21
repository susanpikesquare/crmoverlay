// Type definitions for the backend

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SalesforceConfig {
  loginUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  securityToken: string;
}

export interface Account {
  Id: string;
  Name: string;
  Industry?: string;
  AnnualRevenue?: number;
  NumberOfEmployees?: number;
  Owner?: {
    Name: string;
    Email: string;
  };
}

export interface Opportunity {
  Id: string;
  Name: string;
  StageName: string;
  Amount: number;
  CloseDate: string;
  Probability: number;
  AccountId: string;
}
