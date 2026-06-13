import { IntegrationProvider } from '@prisma/client';

export interface ExternalAccount {
  id: string; // Número de cuenta (ej. AWIVYYQ9)
  name: string; // Tipo o nombre descriptivo
  currency: string;
}

export interface ExternalPosition {
  isin: string;
  name: string;
  quantity: number;
  unitPrice: number;
  currency: string;
}

export interface ExternalTransaction {
  reference: string; // ID único de la transacción
  date: Date;
  type: 'BUY' | 'SELL';
  isin: string;
  name: string;
  quantity: number;
  unitPrice: number;
  currency: string;
}

export interface IntegrationProviderInterface {
  getProviderName(): IntegrationProvider;
  getAccounts(credentials: string): Promise<ExternalAccount[]>;
  getPositions(
    credentials: string,
    externalAccountId: string
  ): Promise<ExternalPosition[]>;
  getTransactions(
    credentials: string,
    externalAccountId: string,
    since?: Date
  ): Promise<ExternalTransaction[]>;
  getCashBalance(
    credentials: string,
    externalAccountId: string
  ): Promise<number>;
  validateCredentials(credentials: string): Promise<boolean>;
}
