import { IntegrationProvider, IntegrationSyncStatus } from '@prisma/client';

export interface IntegrationField {
  key: string;
  label: string;
  type: 'text' | 'password';
  placeholder?: string;
  helpText?: string;
}

export interface IntegrationProviderInfo {
  provider: IntegrationProvider;
  name: string;
  url: string;
  description: string;
  iconKey: string;
  setupSteps: string[];
  credentialFields: IntegrationField[];
}

export interface PlatformIntegrationDetails {
  id: string;
  provider: IntegrationProvider;
  externalAccountId: string;
  lastSyncAt: Date | null;
  lastSyncStatus: IntegrationSyncStatus;
  lastSyncError: string | null;
  isActive: boolean;
  accountId: string;
  accountName: string;
  accountCurrency: string;
}

export interface ConnectIntegrationResponse {
  accountsCreated: {
    id: string;
    name: string;
    externalAccountId: string;
  }[];
}
