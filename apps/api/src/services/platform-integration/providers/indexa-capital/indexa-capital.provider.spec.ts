import { FetchService } from '@ghostfolio/api/services/fetch/fetch.service';

import { IntegrationProvider } from '@prisma/client';

import { IndexaCapitalProvider } from './indexa-capital.provider';

describe('IndexaCapitalProvider', () => {
  let provider: IndexaCapitalProvider;
  let mockFetchService: jest.Mocked<FetchService>;

  beforeEach(() => {
    mockFetchService = {
      fetch: jest.fn()
    } as any;

    provider = new IndexaCapitalProvider(mockFetchService);
  });

  it('getProviderName', () => {
    expect(provider.getProviderName()).toEqual(
      IntegrationProvider.INDEXA_CAPITAL
    );
  });

  describe('validateCredentials', () => {
    it('should return true for valid credentials (200 OK)', async () => {
      mockFetchService.fetch.mockResolvedValueOnce({
        status: 200
      } as any);

      const isValid = await provider.validateCredentials('valid-token');
      expect(isValid).toBe(true);
      expect(mockFetchService.fetch).toHaveBeenCalledWith(
        'https://api.indexacapital.com/users/me',
        { headers: { 'X-AUTH-TOKEN': 'valid-token' } }
      );
    });

    it('should return false for invalid credentials (401 Unauthorized)', async () => {
      mockFetchService.fetch.mockResolvedValueOnce({
        status: 401
      } as any);

      const isValid = await provider.validateCredentials('invalid-token');
      expect(isValid).toBe(false);
    });

    it('should return false if fetch service throws an error', async () => {
      mockFetchService.fetch.mockRejectedValueOnce(new Error('Network error'));

      const isValid = await provider.validateCredentials('token');
      expect(isValid).toBe(false);
    });
  });

  describe('getAccounts', () => {
    it('should fetch and map active accounts, calling detail endpoint for currency', async () => {
      // Mock /user/accounts
      mockFetchService.fetch.mockResolvedValueOnce({
        json: async () => {
          return [
            {
              account_number: 'BP2RHT5N',
              status: 'cancelled',
              type: 'mutual'
            },
            {
              account_number: 'AWIVYYQ9',
              status: 'active',
              type: 'mutual'
            },
            {
              account_number: 'PP123456',
              status: 'active',
              type: 'pension'
            }
          ];
        },
        ok: true
      } as any);

      // Mock /accounts/AWIVYYQ9 detail call
      mockFetchService.fetch.mockResolvedValueOnce({
        json: async () => {
          return { currency: 'EUR' };
        },
        ok: true
      } as any);

      // Mock /accounts/PP123456 detail call
      mockFetchService.fetch.mockResolvedValueOnce({
        json: async () => {
          return { currency: 'EUR' };
        },
        ok: true
      } as any);

      const accounts = await provider.getAccounts('token');

      expect(accounts).toHaveLength(2);
      expect(accounts[0]).toEqual({
        currency: 'EUR',
        id: 'AWIVYYQ9',
        name: 'Fondos de Inversión (AWIVYYQ9)'
      });
      expect(accounts[1]).toEqual({
        currency: 'EUR',
        id: 'PP123456',
        name: 'Plan de Pensiones (PP123456)'
      });
    });
  });

  describe('getPositions', () => {
    it('should fetch and map positions from portfolio correctly', async () => {
      mockFetchService.fetch.mockResolvedValueOnce({
        json: async () => {
          return {
            instrument_accounts: [
              {
                positions: [
                  {
                    instrument: {
                      isin_code: 'IE00BFPM9V94',
                      name: 'Vanguard US 500 Stk Idx'
                    },
                    price: 500.5,
                    titles: 10
                  },
                  {
                    instrument: {
                      isin_code: 'IE00BFPM9L96',
                      name: 'Vanguard European Stk Idx'
                    },
                    price: 150.2,
                    titles: 5
                  }
                ]
              }
            ]
          };
        },
        ok: true
      } as any);

      const positions = await provider.getPositions('token', 'AWIVYYQ9');

      expect(positions).toHaveLength(2);
      expect(positions[0]).toEqual({
        currency: 'EUR',
        isin: 'IE00BFPM9V94',
        name: 'Vanguard US 500 Stk Idx',
        quantity: 10,
        unitPrice: 500.5
      });
      expect(positions[1]).toEqual({
        currency: 'EUR',
        isin: 'IE00BFPM9L96',
        name: 'Vanguard European Stk Idx',
        quantity: 5,
        unitPrice: 150.2
      });
    });
  });

  describe('getCashBalance', () => {
    it('should fetch and return cash balance', async () => {
      mockFetchService.fetch.mockResolvedValueOnce({
        json: async () => {
          return {
            portfolio: {
              cash_amount: 123.45
            }
          };
        },
        ok: true
      } as any);

      const cashBalance = await provider.getCashBalance('token', 'AWIVYYQ9');
      expect(cashBalance).toEqual(123.45);
      expect(mockFetchService.fetch).toHaveBeenCalledWith(
        'https://api.indexacapital.com/accounts/AWIVYYQ9/portfolio',
        { headers: { 'X-AUTH-TOKEN': 'token' } }
      );
    });
  });

  describe('getTransactions', () => {
    it('should fetch, filter, sort and map transactions correctly', async () => {
      mockFetchService.fetch.mockResolvedValueOnce({
        json: async () => {
          return [
            {
              currency: 'EUR',
              date: '2026-02-27',
              instrument: {
                isin_code: 'IE00BZ04LQ92',
                name: 'Vanguard US Inv Gr Bnd'
              },
              operation_code: 1371,
              operation_type: 'ALTA IIC SWITCH',
              price: 111.43,
              reference: 'INV#256705375',
              titles: 28.07
            },
            {
              currency: 'EUR',
              date: '2026-02-25',
              instrument: {
                isin_code: 'IE00BFPM9V94',
                name: 'Vanguard US 500'
              },
              operation_code: 20,
              operation_type: 'SUSCRIPCIÓN FONDOS INVERSIÓN',
              price: 550.0,
              reference: 'INV#256705370',
              titles: 5.5
            },
            {
              currency: 'EUR',
              date: '2026-02-26',
              instrument: {
                isin_code: 'IE00BFPM9V94',
                name: 'Vanguard US 500'
              },
              operation_code: 1372,
              operation_type: 'BAJA IIC SWITCH',
              price: 555.0,
              reference: 'INV#256705372',
              titles: -1.2 // Venta representada como cantidad negativa
            }
          ];
        },
        ok: true
      } as any);

      const txs = await provider.getTransactions('token', 'AWIVYYQ9');

      expect(txs).toHaveLength(3);
      // Verify chronological sorting (2026-02-25 first, then 26, then 27)
      expect(txs[0].date.toISOString()).toContain('2026-02-25');
      expect(txs[0].type).toEqual('BUY');
      expect(txs[0].quantity).toEqual(5.5);

      expect(txs[1].date.toISOString()).toContain('2026-02-26');
      expect(txs[1].type).toEqual('SELL');
      expect(txs[1].quantity).toEqual(1.2); // Quantity mapped as absolute positive value

      expect(txs[2].date.toISOString()).toContain('2026-02-27');
      expect(txs[2].type).toEqual('BUY');
      expect(txs[2].quantity).toEqual(28.07);
    });

    it('should filter out transactions before the since date', async () => {
      mockFetchService.fetch.mockResolvedValueOnce({
        json: async () => {
          return [
            {
              currency: 'EUR',
              date: '2026-01-01',
              instrument: {
                isin_code: 'IE00BZ04LQ92',
                name: 'Vanguard'
              },
              operation_code: 20,
              operation_type: 'SUSCRIPCIÓN',
              price: 100.0,
              reference: 'REF1',
              titles: 10
            },
            {
              currency: 'EUR',
              date: '2026-02-01',
              instrument: {
                isin_code: 'IE00BZ04LQ92',
                name: 'Vanguard'
              },
              operation_code: 20,
              operation_type: 'SUSCRIPCIÓN',
              price: 105.0,
              reference: 'REF2',
              titles: 10
            }
          ];
        },
        ok: true
      } as any);

      const txs = await provider.getTransactions(
        'token',
        'AWIVYYQ9',
        new Date('2026-01-15')
      );

      expect(txs).toHaveLength(1);
      expect(txs[0].reference).toEqual('REF2');
    });
  });
});
