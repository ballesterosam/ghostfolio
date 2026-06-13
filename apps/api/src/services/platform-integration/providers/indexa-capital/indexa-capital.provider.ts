import { FetchService } from '@ghostfolio/api/services/fetch/fetch.service';

import { Injectable, Logger } from '@nestjs/common';
import { IntegrationProvider } from '@prisma/client';

import {
  ExternalAccount,
  ExternalPosition,
  ExternalTransaction,
  IntegrationProviderInterface
} from '../../interfaces/integration-provider.interface';

@Injectable()
export class IndexaCapitalProvider implements IntegrationProviderInterface {
  private readonly logger = new Logger(IndexaCapitalProvider.name);
  private readonly baseUrl = 'https://api.indexacapital.com';

  public constructor(private readonly fetchService: FetchService) {}

  public getProviderName(): IntegrationProvider {
    return IntegrationProvider.INDEXA_CAPITAL;
  }

  public async validateCredentials(credentials: string): Promise<boolean> {
    try {
      const response = await this.fetchService.fetch(
        `${this.baseUrl}/users/me`,
        {
          headers: {
            'X-AUTH-TOKEN': credentials
          }
        }
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error(`Credentials validation failed: ${error.message}`);
      return false;
    }
  }

  public async getAccounts(credentials: string): Promise<ExternalAccount[]> {
    const response = await this.fetchService.fetch(
      `${this.baseUrl}/user/accounts`,
      {
        headers: {
          'X-AUTH-TOKEN': credentials
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch accounts from Indexa: ${response.statusText}`
      );
    }

    const accountsData = (await response.json()) as any[];
    const activeAccounts = accountsData.filter(
      (acc) => acc.status === 'active'
    );

    const result: ExternalAccount[] = [];

    for (const acc of activeAccounts) {
      // Fetch details to retrieve exact currency
      const detailResponse = await this.fetchService.fetch(
        `${this.baseUrl}/accounts/${acc.account_number}`,
        {
          headers: {
            'X-AUTH-TOKEN': credentials
          }
        }
      );

      let currency = 'EUR';
      if (detailResponse.ok) {
        const detailData = await detailResponse.json();
        currency = detailData.currency || 'EUR';
      }

      let name = '';
      switch (acc.type) {
        case 'mutual':
          name = 'Fondos de Inversión';
          break;
        case 'pension':
          name = 'Plan de Pensiones';
          break;
        case 'epsv':
          name = 'EPSV';
          break;
        case 'employment_plan':
          name = 'Plan de Empleo';
          break;
        default:
          name = `Cuenta (${acc.type})`;
      }

      result.push({
        currency,
        id: acc.account_number,
        name: `${name} (${acc.account_number})`
      });
    }

    return result;
  }

  public async getPositions(
    credentials: string,
    externalAccountId: string
  ): Promise<ExternalPosition[]> {
    const response = await this.fetchService.fetch(
      `${this.baseUrl}/accounts/${externalAccountId}/portfolio`,
      {
        headers: {
          'X-AUTH-TOKEN': credentials
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch portfolio from Indexa for account ${externalAccountId}: ${response.statusText}`
      );
    }

    const data = await response.json();
    const positions: ExternalPosition[] = [];

    const instrumentAccounts = data.instrument_accounts || [];
    for (const instAcc of instrumentAccounts) {
      const rawPositions = instAcc.positions || [];
      for (const pos of rawPositions) {
        if (pos.instrument?.isin_code) {
          positions.push({
            currency: 'EUR', // Indexa instruments are traded/valued in EUR inside their portfolios
            isin: pos.instrument.isin_code,
            name: pos.instrument.name,
            quantity: Number(pos.titles),
            unitPrice: Number(pos.price)
          });
        }
      }
    }

    return positions;
  }

  public async getCashBalance(
    credentials: string,
    externalAccountId: string
  ): Promise<number> {
    const response = await this.fetchService.fetch(
      `${this.baseUrl}/accounts/${externalAccountId}/portfolio`,
      {
        headers: {
          'X-AUTH-TOKEN': credentials
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch cash balance from Indexa for account ${externalAccountId}: ${response.statusText}`
      );
    }

    const data = await response.json();
    return Number(data.portfolio?.cash_amount ?? 0);
  }

  public async getTransactions(
    credentials: string,
    externalAccountId: string,
    since?: Date
  ): Promise<ExternalTransaction[]> {
    const response = await this.fetchService.fetch(
      `${this.baseUrl}/accounts/${externalAccountId}/instrument-transactions`,
      {
        headers: {
          'X-AUTH-TOKEN': credentials
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch transactions from Indexa for account ${externalAccountId}: ${response.statusText}`
      );
    }

    const rawTransactions = (await response.json()) as any[];
    const result: ExternalTransaction[] = [];

    for (const tx of rawTransactions) {
      const txDate = new Date(tx.date);

      if (since && txDate < since) {
        continue;
      }

      if (!tx.instrument?.isin_code) {
        continue;
      }

      const type = this.mapOperationType(tx.operation_code, tx.operation_type);
      if (!type) {
        continue; // Skip unsupported operation types
      }

      result.push({
        currency: tx.currency || 'EUR',
        date: txDate,
        isin: tx.instrument.isin_code,
        name: tx.instrument.name,
        quantity: Math.abs(Number(tx.titles)),
        reference: tx.reference,
        type,
        unitPrice: Number(tx.price)
      });
    }

    // Sort transactions chronologically (oldest first) so they are imported in order
    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private mapOperationType(
    code: number,
    operationType: string
  ): 'BUY' | 'SELL' | null {
    const opUpper = (operationType || '').toUpperCase();

    // Map BUY types
    if (
      code === 20 ||
      code === 1370 ||
      code === 1371 ||
      opUpper.includes('SUSCRIPCIÓN') ||
      opUpper.includes('ALTA')
    ) {
      return 'BUY';
    }

    // Map SELL types
    if (
      code === 21 ||
      code === 1339 ||
      code === 1372 ||
      opUpper.includes('REEMBOLSO') ||
      opUpper.includes('BAJA')
    ) {
      return 'SELL';
    }

    return null;
  }
}
