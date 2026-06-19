import { FetchService } from '@ghostfolio/api/services/fetch/fetch.service';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';

import { IntegrationProvider } from '@prisma/client';

import { EtoroProvider } from './etoro.provider';

describe('EtoroProvider', () => {
  let provider: EtoroProvider;
  let mockFetchService: jest.Mocked<FetchService>;
  let mockPrismaService: jest.Mocked<PrismaService>;

  const credentials = JSON.stringify({
    apiKey: 'test-api-key',
    userKey: 'test-user-key'
  });

  beforeEach(() => {
    mockFetchService = {
      fetch: jest.fn()
    } as any;

    mockPrismaService = {
      platformIntegration: {
        findFirst: jest.fn()
      },
      order: {
        findFirst: jest.fn()
      }
    } as any;

    provider = new EtoroProvider(mockFetchService, mockPrismaService);
  });

  it('getProviderName', () => {
    expect(provider.getProviderName()).toEqual(IntegrationProvider.ETORO);
  });

  describe('validateCredentials', () => {
    it('should return true for valid credentials (200 OK)', async () => {
      mockFetchService.fetch.mockResolvedValueOnce({
        status: 200
      } as any);

      const isValid = await provider.validateCredentials(credentials);
      expect(isValid).toBe(true);
      expect(mockFetchService.fetch).toHaveBeenCalledWith(
        'https://public-api.etoro.com/api/v1/me',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key',
            'x-user-key': 'test-user-key',
            'x-request-id': expect.any(String)
          })
        })
      );
    });

    it('should return false for invalid credentials (401 Unauthorized)', async () => {
      mockFetchService.fetch.mockResolvedValueOnce({
        status: 401
      } as any);

      const isValid = await provider.validateCredentials(credentials);
      expect(isValid).toBe(false);
    });

    it('should return false if credentials format is invalid', async () => {
      const isValid = await provider.validateCredentials('invalid-json');
      expect(isValid).toBe(false);
    });
  });

  describe('getAccounts', () => {
    it('should retrieve user realCid as account ID', async () => {
      mockFetchService.fetch.mockResolvedValueOnce({
        json: async () => ({
          realCid: 10853278,
          username: 'ballesterosam'
        }),
        ok: true
      } as any);

      const accounts = await provider.getAccounts(credentials);

      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toEqual({
        id: '10853278',
        name: 'eToro Real Portfolio (ballesterosam)',
        currency: 'USD'
      });
    });
  });

  describe('getCashBalance', () => {
    it('should retrieve credit balance from portfolio', async () => {
      mockFetchService.fetch.mockResolvedValueOnce({
        json: async () => ({
          credit: 123.45
        }),
        ok: true
      } as any);

      const balance = await provider.getCashBalance(credentials, '10853278');
      expect(balance).toEqual(123.45);
    });
  });

  describe('getPositions', () => {
    it('should retrieve and map open positions, filtering out CFDs', async () => {
      // Portfolio mock returning 2 valid positions and 1 CFD
      mockFetchService.fetch.mockResolvedValueOnce({
        json: async () => ({
          clientPortfolio: {
            positions: [
              {
                positionID: 111,
                openRate: 200,
                units: 2,
                instrumentID: 1001,
                settlementTypeID: 1 // Real asset
              },
              {
                positionID: 222,
                openRate: 150,
                units: 5,
                instrumentID: 1002,
                settlementTypeID: 0 // CFD (should be skipped)
              }
            ],
            mirrors: [
              {
                positions: [
                  {
                    positionID: 333,
                    openRate: 50,
                    units: 10,
                    instrumentID: 1003,
                    settlementTypeID: 1 // Real asset in copy trading
                  }
                ]
              }
            ]
          }
        }),
        ok: true
      } as any);

      // Instrument types mock
      mockFetchService.fetch.mockResolvedValueOnce({
        json: async () => ({
          instrumentTypes: [
            { instrumentTypeID: 1, instrumentTypeDescription: 'Stocks' },
            {
              instrumentTypeID: 5,
              instrumentTypeDescription: 'Cryptocurrencies'
            }
          ]
        }),
        ok: true
      } as any);

      // Instruments metadata mock for IDs 1001 and 1003
      mockFetchService.fetch.mockResolvedValueOnce({
        json: async () => ({
          instrumentDisplayDatas: [
            {
              instrumentID: 1001,
              symbolFull: 'AAPL',
              instrumentDisplayName: 'Apple Inc.',
              instrumentTypeID: 1
            },
            {
              instrumentID: 1003,
              symbolFull: 'MSFT',
              instrumentDisplayName: 'Microsoft',
              instrumentTypeID: 1
            }
          ]
        }),
        ok: true
      } as any);

      const positions = await provider.getPositions(credentials, '10853278');

      expect(positions).toHaveLength(2);
      expect(positions[0]).toEqual({
        isin: 'AAPL',
        name: 'Apple Inc.',
        quantity: 2,
        unitPrice: 200,
        currency: 'USD',
        assetClass: 'EQUITY',
        assetSubClass: 'STOCK'
      });
      expect(positions[1]).toEqual({
        isin: 'MSFT',
        name: 'Microsoft',
        quantity: 10,
        unitPrice: 50,
        currency: 'USD',
        assetClass: 'EQUITY',
        assetSubClass: 'STOCK'
      });
    });
  });

  describe('getTransactions', () => {
    it('should map closed trades and open positions correctly', async () => {
      // Mock db queries for since date fallback
      (
        mockPrismaService.platformIntegration.findFirst as jest.Mock
      ).mockResolvedValueOnce(null);

      // Mock trade history: 1 valid buy/sell closed trade, 1 CFD (skipped)
      mockFetchService.fetch.mockResolvedValueOnce({
        json: async () => [
          {
            netProfit: 10,
            closeRate: 210,
            closeTimestamp: '2026-03-01T10:00:00Z',
            positionId: 999,
            instrumentId: 1001,
            isBuy: true,
            leverage: 1,
            openRate: 200,
            openTimestamp: '2026-02-01T10:00:00Z',
            units: 1
          },
          {
            netProfit: 5,
            closeRate: 55,
            closeTimestamp: '2026-03-01T10:00:00Z',
            positionId: 888,
            instrumentId: 1002,
            isBuy: true,
            leverage: 2, // CFD (skipped)
            openRate: 50,
            openTimestamp: '2026-02-01T10:00:00Z',
            units: 10
          }
        ],
        ok: true
      } as any);

      // Mock open positions: 1 open position
      mockFetchService.fetch.mockResolvedValueOnce({
        json: async () => ({
          clientPortfolio: {
            positions: [
              {
                positionID: 777,
                openDateTime: '2026-02-15T10:00:00Z',
                openRate: 150,
                units: 4,
                instrumentID: 1003,
                settlementTypeID: 1,
                leverage: 1,
                isBuy: true
              }
            ]
          }
        }),
        ok: true
      } as any);

      // Instrument types mock
      mockFetchService.fetch.mockResolvedValueOnce({
        json: async () => ({
          instrumentTypes: [
            { instrumentTypeID: 1, instrumentTypeDescription: 'Stocks' },
            {
              instrumentTypeID: 5,
              instrumentTypeDescription: 'Cryptocurrencies'
            }
          ]
        }),
        ok: true
      } as any);

      // Mock metadata for 1001 and 1003
      mockFetchService.fetch.mockResolvedValueOnce({
        json: async () => ({
          instrumentDisplayDatas: [
            {
              instrumentID: 1001,
              symbolFull: 'AAPL',
              instrumentDisplayName: 'Apple Inc.',
              instrumentTypeID: 1
            },
            {
              instrumentID: 1003,
              symbolFull: 'MSFT',
              instrumentDisplayName: 'Microsoft',
              instrumentTypeID: 1
            }
          ]
        }),
        ok: true
      } as any);

      const txs = await provider.getTransactions(credentials, '10853278');

      expect(txs).toHaveLength(3);

      // Check chronologically sorted result
      // 1. AAPL buy (open of closed trade) - 2026-02-01
      expect(txs[0]).toEqual({
        reference: 'etoro-pos-open-999',
        date: new Date('2026-02-01T10:00:00Z'),
        type: 'BUY',
        isin: 'AAPL',
        name: 'Apple Inc.',
        quantity: 1,
        unitPrice: 200,
        currency: 'USD',
        assetClass: 'EQUITY',
        assetSubClass: 'STOCK'
      });

      // 2. MSFT buy (open position) - 2026-02-15
      expect(txs[1]).toEqual({
        reference: 'etoro-pos-open-777',
        date: new Date('2026-02-15T10:00:00Z'),
        type: 'BUY',
        isin: 'MSFT',
        name: 'Microsoft',
        quantity: 4,
        unitPrice: 150,
        currency: 'USD',
        assetClass: 'EQUITY',
        assetSubClass: 'STOCK'
      });

      // 3. AAPL sell (close of closed trade) - 2026-03-01
      expect(txs[2]).toEqual({
        reference: 'etoro-pos-close-999',
        date: new Date('2026-03-01T10:00:00Z'),
        type: 'SELL',
        isin: 'AAPL',
        name: 'Apple Inc.',
        quantity: 1,
        unitPrice: 210,
        currency: 'USD',
        assetClass: 'EQUITY',
        assetSubClass: 'STOCK'
      });
    });
  });
});
