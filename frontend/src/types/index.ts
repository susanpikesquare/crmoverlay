// Type definitions for the frontend

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
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

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'AE' | 'AM' | 'CSM';
}
