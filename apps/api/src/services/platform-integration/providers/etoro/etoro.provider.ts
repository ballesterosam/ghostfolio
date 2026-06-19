import { FetchService } from '@ghostfolio/api/services/fetch/fetch.service';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';

import { Injectable, Logger } from '@nestjs/common';
import { AssetClass, AssetSubClass, IntegrationProvider } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import {
  ExternalAccount,
  ExternalPosition,
  ExternalTransaction,
  IntegrationProviderInterface
} from '../../interfaces/integration-provider.interface';

@Injectable()
export class EtoroProvider implements IntegrationProviderInterface {
  private readonly logger = new Logger(EtoroProvider.name);
  private readonly baseUrl = 'https://public-api.etoro.com/api/v1';

  public constructor(
    private readonly fetchService: FetchService,
    private readonly prismaService: PrismaService
  ) {}

  public getProviderName(): IntegrationProvider {
    return IntegrationProvider.ETORO;
  }

  public async validateCredentials(credentials: string): Promise<boolean> {
    try {
      const keys = this.parseCredentials(credentials);
      if (!keys) {
        return false;
      }
      const response = await this.fetchService.fetch(`${this.baseUrl}/me`, {
        headers: {
          'x-api-key': keys.apiKey,
          'x-user-key': keys.userKey,
          'x-request-id': randomUUID()
        }
      });
      return response.status === 200;
    } catch (error) {
      this.logger.error(`Credentials validation failed: ${error.message}`);
      return false;
    }
  }

  public async getAccounts(credentials: string): Promise<ExternalAccount[]> {
    const keys = this.parseCredentials(credentials);
    if (!keys) {
      throw new Error('Invalid credentials format');
    }
    const response = await this.fetchService.fetch(`${this.baseUrl}/me`, {
      headers: {
        'x-api-key': keys.apiKey,
        'x-user-key': keys.userKey,
        'x-request-id': randomUUID()
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch eToro profile: ${response.statusText}`);
    }

    const data = await response.json();
    const realCid = data.realCid;
    const username = data.username || 'eToro User';

    if (!realCid) {
      throw new Error('eToro real account ID (realCid) not found in profile');
    }

    return [
      {
        id: realCid.toString(),
        name: `eToro Real Portfolio (${username})`,
        currency: 'USD'
      }
    ];
  }

  public async getCashBalance(
    credentials: string,
    externalAccountId: string
  ): Promise<number> {
    this.logger.debug(`Getting cash balance for account ${externalAccountId}`);
    const keys = this.parseCredentials(credentials);
    if (!keys) {
      throw new Error('Invalid credentials format');
    }
    const response = await this.fetchService.fetch(
      `${this.baseUrl}/trading/info/portfolio`,
      {
        headers: {
          'x-api-key': keys.apiKey,
          'x-user-key': keys.userKey,
          'x-request-id': randomUUID()
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch eToro portfolio balance: ${response.statusText}`
      );
    }

    const data = await response.json();
    return Number(data.credit ?? 0);
  }

  public async getPositions(
    credentials: string,
    externalAccountId: string
  ): Promise<ExternalPosition[]> {
    this.logger.debug(`Getting positions for account ${externalAccountId}`);
    const keys = this.parseCredentials(credentials);
    if (!keys) {
      throw new Error('Invalid credentials format');
    }
    const response = await this.fetchService.fetch(
      `${this.baseUrl}/trading/info/portfolio`,
      {
        headers: {
          'x-api-key': keys.apiKey,
          'x-user-key': keys.userKey,
          'x-request-id': randomUUID()
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch eToro portfolio: ${response.statusText}`
      );
    }

    const data = await response.json();
    const positionsData = data.clientPortfolio?.positions || [];
    const mirrorsData = data.clientPortfolio?.mirrors || [];

    const rawPositions = [...positionsData];
    for (const mirror of mirrorsData) {
      if (mirror.positions && Array.isArray(mirror.positions)) {
        rawPositions.push(...mirror.positions);
      }
    }

    // Filter out CFDs
    const validPositions = rawPositions.filter(
      (pos) => pos.settlementTypeID !== 0
    );

    if (validPositions.length === 0) {
      return [];
    }

    const instrumentIds = validPositions.map((pos) => pos.instrumentID);
    const metadata = await this.getInstrumentsMetadata(keys, instrumentIds);

    const result: ExternalPosition[] = [];
    for (const pos of validPositions) {
      const meta = metadata.get(pos.instrumentID);
      if (!meta) {
        this.logger.warn(
          `Could not resolve metadata for instrument ID ${pos.instrumentID}`
        );
        continue;
      }

      result.push({
        isin: meta.symbol,
        name: meta.name,
        quantity: Number(pos.units),
        unitPrice: Number(pos.openRate),
        currency: 'USD',
        assetClass: meta.assetClass,
        assetSubClass: meta.assetSubClass
      });
    }

    return result;
  }

  public async getTransactions(
    credentials: string,
    externalAccountId: string,
    since?: Date
  ): Promise<ExternalTransaction[]> {
    const keys = this.parseCredentials(credentials);
    if (!keys) {
      throw new Error('Invalid credentials format');
    }

    let minDateStr = '2000-01-01';

    if (since) {
      minDateStr = since.toISOString().split('T')[0];
    } else {
      try {
        const integration =
          await this.prismaService.platformIntegration.findFirst({
            where: { externalAccountId }
          });
        if (integration) {
          const lastOrder = await this.prismaService.order.findFirst({
            where: { accountId: integration.accountId },
            orderBy: { date: 'desc' }
          });
          if (lastOrder?.date) {
            const date = new Date(lastOrder.date);
            date.setDate(date.getDate() - 1);
            minDateStr = date.toISOString().split('T')[0];
          }
        }
      } catch (err) {
        this.logger.error(
          `Error querying last sync order date: ${err.message}`
        );
      }
    }

    // Fetch closed trades
    const historyResponse = await this.fetchService.fetch(
      `${this.baseUrl}/trading/info/trade/history?minDate=${minDateStr}`,
      {
        headers: {
          'x-api-key': keys.apiKey,
          'x-user-key': keys.userKey,
          'x-request-id': randomUUID()
        }
      }
    );

    let closedTrades = [];
    if (historyResponse.ok) {
      closedTrades = (await historyResponse.json()) as any[];
    } else {
      this.logger.error(
        `Failed to fetch eToro closed trades: ${historyResponse.statusText}`
      );
    }

    // Fetch open positions
    const portfolioResponse = await this.fetchService.fetch(
      `${this.baseUrl}/trading/info/portfolio`,
      {
        headers: {
          'x-api-key': keys.apiKey,
          'x-user-key': keys.userKey,
          'x-request-id': randomUUID()
        }
      }
    );

    let openPositions = [];
    if (portfolioResponse.ok) {
      const data = await portfolioResponse.json();
      const positionsData = data.clientPortfolio?.positions || [];
      const mirrorsData = data.clientPortfolio?.mirrors || [];

      openPositions = [...positionsData];
      for (const mirror of mirrorsData) {
        if (mirror.positions && Array.isArray(mirror.positions)) {
          openPositions.push(...mirror.positions);
        }
      }
    } else {
      this.logger.error(
        `Failed to fetch eToro open portfolio: ${portfolioResponse.statusText}`
      );
    }

    const validClosedTrades = closedTrades.filter(
      (trade) => trade.leverage === 1 && trade.isBuy === true
    );

    const validOpenPositions = openPositions.filter(
      (pos) =>
        pos.settlementTypeID === 1 || (pos.leverage === 1 && pos.isBuy === true)
    );

    const instrumentIds = [
      ...validClosedTrades.map((t) => t.instrumentId),
      ...validOpenPositions.map((p) => p.instrumentID)
    ];

    const metadata = await this.getInstrumentsMetadata(keys, instrumentIds);
    const result: ExternalTransaction[] = [];

    // 1. Open positions (Opening BUYs)
    for (const pos of validOpenPositions) {
      const meta = metadata.get(pos.instrumentID);
      if (!meta) {
        continue;
      }

      result.push({
        reference: `etoro-pos-open-${pos.positionID}`,
        date: new Date(pos.openDateTime),
        type: 'BUY',
        isin: meta.symbol,
        name: meta.name,
        quantity: Number(pos.units),
        unitPrice: Number(pos.openRate),
        currency: 'USD',
        assetClass: meta.assetClass,
        assetSubClass: meta.assetSubClass
      });
    }

    // 2. Closed trades (Opening BUY and Closing SELL)
    for (const trade of validClosedTrades) {
      const meta = metadata.get(trade.instrumentId);
      if (!meta) {
        continue;
      }

      result.push({
        reference: `etoro-pos-open-${trade.positionId}`,
        date: new Date(trade.openTimestamp),
        type: 'BUY',
        isin: meta.symbol,
        name: meta.name,
        quantity: Number(trade.units),
        unitPrice: Number(trade.openRate),
        currency: 'USD',
        assetClass: meta.assetClass,
        assetSubClass: meta.assetSubClass
      });

      result.push({
        reference: `etoro-pos-close-${trade.positionId}`,
        date: new Date(trade.closeTimestamp),
        type: 'SELL',
        isin: meta.symbol,
        name: meta.name,
        quantity: Number(trade.units),
        unitPrice: Number(trade.closeRate),
        currency: 'USD',
        assetClass: meta.assetClass,
        assetSubClass: meta.assetSubClass
      });
    }

    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private parseCredentials(
    credentials: string
  ): { apiKey: string; userKey: string } | null {
    try {
      const parsed = JSON.parse(credentials);
      if (parsed?.apiKey && parsed?.userKey) {
        return {
          apiKey: parsed.apiKey,
          userKey: parsed.userKey
        };
      }
    } catch {}
    return null;
  }

  private async getInstrumentTypes(keys: {
    apiKey: string;
    userKey: string;
  }): Promise<Map<number, string>> {
    const result = new Map<number, string>();
    try {
      const response = await this.fetchService.fetch(
        `${this.baseUrl}/market-data/instrument-types`,
        {
          headers: {
            'x-api-key': keys.apiKey,
            'x-user-key': keys.userKey,
            'x-request-id': randomUUID()
          }
        }
      );
      if (response.ok) {
        const data = await response.json();
        const types = data.instrumentTypes || [];
        for (const item of types) {
          if (
            item.instrumentTypeID !== undefined &&
            item.instrumentTypeDescription
          ) {
            result.set(
              item.instrumentTypeID,
              item.instrumentTypeDescription.toUpperCase()
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to fetch instrument types: ${error.message}`);
    }

    // Fallback known mappings
    if (result.size === 0) {
      result.set(1, 'STOCKS');
      result.set(2, 'COMMODITIES');
      result.set(3, 'CURRENCIES');
      result.set(4, 'INDICES');
      result.set(5, 'CRYPTOCURRENCIES');
      result.set(6, 'ETFS');
    }

    return result;
  }

  private mapEtoroType(
    typeDescription: string
  ): { assetClass: AssetClass; assetSubClass: AssetSubClass } | null {
    const desc = typeDescription.toUpperCase();
    if (desc.includes('STOCK') || desc.includes('EQUITY')) {
      return {
        assetClass: AssetClass.EQUITY,
        assetSubClass: AssetSubClass.STOCK
      };
    }
    if (desc.includes('ETF')) {
      return {
        assetClass: AssetClass.EQUITY,
        assetSubClass: AssetSubClass.ETF
      };
    }
    if (desc.includes('CRYPTO') || desc.includes('COIN')) {
      return {
        assetClass: AssetClass.ALTERNATIVE_INVESTMENT,
        assetSubClass: AssetSubClass.CRYPTOCURRENCY
      };
    }
    if (desc.includes('COMMODITY')) {
      return {
        assetClass: AssetClass.COMMODITY,
        assetSubClass: AssetSubClass.COMMODITY
      };
    }
    if (desc.includes('CURRENCY') || desc.includes('FOREX')) {
      return {
        assetClass: AssetClass.LIQUIDITY,
        assetSubClass: AssetSubClass.CASH
      };
    }
    if (desc.includes('INDEX') || desc.includes('INDICES')) {
      return {
        assetClass: AssetClass.EQUITY,
        assetSubClass: AssetSubClass.MUTUALFUND
      };
    }
    return null;
  }

  private async getInstrumentsMetadata(
    keys: { apiKey: string; userKey: string },
    instrumentIds: number[]
  ): Promise<
    Map<
      number,
      {
        symbol: string;
        name: string;
        assetClass?: AssetClass;
        assetSubClass?: AssetSubClass;
      }
    >
  > {
    const result = new Map<
      number,
      {
        symbol: string;
        name: string;
        assetClass?: AssetClass;
        assetSubClass?: AssetSubClass;
      }
    >();
    if (instrumentIds.length === 0) {
      return result;
    }

    const instrumentTypes = await this.getInstrumentTypes(keys);

    const uniqueIds = Array.from(new Set(instrumentIds));
    const response = await this.fetchService.fetch(
      `${this.baseUrl}/market-data/instruments?instrumentIds=${uniqueIds.join(',')}`,
      {
        headers: {
          'x-api-key': keys.apiKey,
          'x-user-key': keys.userKey,
          'x-request-id': randomUUID()
        }
      }
    );

    if (!response.ok) {
      this.logger.error(
        `Failed to fetch instruments metadata: ${response.statusText}`
      );
      return result;
    }

    const data = await response.json();
    const list = data.instrumentDisplayDatas || [];
    for (const item of list) {
      if (item.instrumentID && item.symbolFull) {
        let assetClass: AssetClass | undefined;
        let assetSubClass: AssetSubClass | undefined;

        if (item.instrumentTypeID !== undefined) {
          const typeDescription = instrumentTypes.get(item.instrumentTypeID);
          if (typeDescription) {
            const mapped = this.mapEtoroType(typeDescription);
            if (mapped) {
              assetClass = mapped.assetClass;
              assetSubClass = mapped.assetSubClass;
            }
          }
        }

        result.set(item.instrumentID, {
          symbol: item.symbolFull,
          name: item.instrumentDisplayName || item.symbolFull,
          assetClass,
          assetSubClass
        });
      }
    }

    return result;
  }
}
