import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { UserSettings } from '@ghostfolio/common/interfaces';

import { Type } from '@prisma/client';
import { tool } from 'ai';
import { z } from 'zod';

export function computeMortgageDetails(mortgage: {
  amortizations: { amount: number; date: Date; reduceTerm: boolean }[];
  installments: number;
  interestRate: number;
  principal: number;
  startDate: Date;
}) {
  const monthlyRate = mortgage.interestRate / 100 / 12;
  const n = mortgage.installments;

  const monthlyPayment =
    monthlyRate > 0
      ? +(
          (mortgage.principal * monthlyRate * Math.pow(1 + monthlyRate, n)) /
          (Math.pow(1 + monthlyRate, n) - 1)
        ).toFixed(2)
      : +(mortgage.principal / n).toFixed(2);

  const now = new Date();
  const start = mortgage.startDate;
  const monthsElapsed =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());

  const remainingBalanceStandard =
    monthlyRate > 0
      ? +(
          (mortgage.principal *
            (Math.pow(1 + monthlyRate, n) -
              Math.pow(1 + monthlyRate, monthsElapsed))) /
          (Math.pow(1 + monthlyRate, n) - 1)
        ).toFixed(2)
      : +(
          mortgage.principal -
          (mortgage.principal / n) * monthsElapsed
        ).toFixed(2);

  const totalEarlyAmortized = mortgage.amortizations.reduce(
    (sum, a) => sum + a.amount,
    0
  );
  const remainingBalance = Math.max(
    0,
    +(remainingBalanceStandard - totalEarlyAmortized).toFixed(2)
  );

  const remainingInstallments = Math.max(0, n - monthsElapsed);
  const totalRemainingPayments = monthlyPayment * remainingInstallments;
  const totalInterestRemaining = +(
    totalRemainingPayments - remainingBalance
  ).toFixed(2);

  return {
    amortizations: mortgage.amortizations.map((a) => ({
      amount: a.amount,
      date: a.date.toISOString().slice(0, 10),
      reduceTerm: a.reduceTerm
    })),
    initialPrincipal: mortgage.principal,
    interestRate: mortgage.interestRate,
    monthlyPayment,
    monthsElapsed,
    remainingBalance,
    remainingInstallments,
    startDate: mortgage.startDate.toISOString().slice(0, 10),
    totalEarlyAmortized: +totalEarlyAmortized.toFixed(2),
    totalInstallments: n,
    totalInterestRemaining: Math.max(0, totalInterestRemaining)
  };
}

export function buildReadTools(prisma: PrismaService, userId: string) {
  return {
    get_accounts: tool({
      description:
        'List the investment accounts of the user, including their name, currency, cash balance, and linked platform.',
      execute: async () => {
        const accounts = await prisma.account.findMany({
          orderBy: { name: 'asc' },
          select: {
            balance: true,
            currency: true,
            id: true,
            isExcluded: true,
            name: true,
            platform: { select: { name: true } }
          },
          where: { userId }
        });

        return accounts.map((a) => ({
          balance: a.balance,
          currency: a.currency,
          id: a.id,
          isExcluded: a.isExcluded,
          name: a.name ?? '(unnamed)',
          platform: a.platform?.name ?? null
        }));
      },
      inputSchema: z.object({})
    }),

    get_activities: tool({
      description:
        'List investment activities (trades, dividends, fees, interest). Supports optional filters by type and date range. Returns at most 100 records, newest first.',
      execute: async ({ dateFrom, dateTo, limit, type }) => {
        const activities = await prisma.order.findMany({
          orderBy: { date: 'desc' },
          select: {
            SymbolProfile: {
              select: {
                assetClass: true,
                currency: true,
                name: true,
                symbol: true
              }
            },
            account: { select: { name: true } },
            comment: true,
            currency: true,
            date: true,
            fee: true,
            id: true,
            quantity: true,
            type: true,
            unitPrice: true
          },
          take: limit,
          where: {
            userId,
            ...(type ? { type } : {}),
            ...(dateFrom || dateTo
              ? {
                  date: {
                    ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                    ...(dateTo ? { lte: new Date(dateTo) } : {})
                  }
                }
              : {})
          }
        });

        return activities.map((a) => ({
          account: a.account?.name ?? null,
          assetClass: a.SymbolProfile.assetClass,
          comment: a.comment,
          currency: a.currency,
          date: a.date.toISOString().slice(0, 10),
          fee: a.fee,
          id: a.id,
          name: a.SymbolProfile.name,
          quantity: a.quantity,
          symbol: a.SymbolProfile.symbol,
          total: +(a.quantity * a.unitPrice).toFixed(2),
          type: a.type,
          unitPrice: a.unitPrice
        }));
      },
      inputSchema: z.object({
        dateFrom: z
          .string()
          .optional()
          .describe(
            'ISO date string — only include activities on or after this date'
          ),
        dateTo: z
          .string()
          .optional()
          .describe(
            'ISO date string — only include activities on or before this date'
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('Maximum number of records to return (default 50)'),
        type: z
          .enum(['BUY', 'SELL', 'DIVIDEND', 'FEE', 'INTEREST', 'LIABILITY'])
          .optional()
          .describe('Filter by activity type')
      })
    }),

    get_goals: tool({
      description:
        "Retrieve the user's annual investment goals (target portfolio value per year). Use together with get_portfolio_summary to assess goal progress.",
      execute: async () => {
        const settings = await prisma.settings.findUnique({
          select: { settings: true },
          where: { userId }
        });

        const userSettings = settings?.settings as UserSettings | null;
        const goals = userSettings?.goals ?? [];
        const currentYear = new Date().getFullYear();

        return {
          currentYear,
          goals: goals.sort((a, b) => a.year - b.year)
        };
      },
      inputSchema: z.object({})
    }),

    get_portfolio_summary: tool({
      description:
        'Compute current portfolio holdings from all BUY/SELL activities. Returns each open position with its symbol, name, asset class, net quantity, average cost, and total cost basis.',
      execute: async () => {
        const activities = await prisma.order.findMany({
          select: {
            SymbolProfile: {
              select: {
                assetClass: true,
                assetSubClass: true,
                currency: true,
                name: true,
                symbol: true
              }
            },
            quantity: true,
            type: true,
            unitPrice: true
          },
          where: {
            isDraft: false,
            type: { in: [Type.BUY, Type.SELL] },
            userId
          }
        });

        const holdingsMap = new Map<
          string,
          {
            assetClass: string | null;
            assetSubClass: string | null;
            avgCost: number;
            costBasis: number;
            currency: string;
            name: string;
            quantity: number;
            symbol: string;
          }
        >();

        for (const activity of activities) {
          const { assetClass, assetSubClass, currency, name, symbol } =
            activity.SymbolProfile;

          if (!holdingsMap.has(symbol)) {
            holdingsMap.set(symbol, {
              assetClass: assetClass ?? null,
              assetSubClass: assetSubClass ?? null,
              avgCost: 0,
              costBasis: 0,
              currency,
              name: name ?? symbol,
              quantity: 0,
              symbol
            });
          }

          const h = holdingsMap.get(symbol)!;

          if (activity.type === Type.BUY) {
            const newCostBasis =
              h.costBasis + activity.quantity * activity.unitPrice;
            const newQuantity = h.quantity + activity.quantity;
            h.avgCost = newQuantity > 0 ? newCostBasis / newQuantity : 0;
            h.costBasis = newCostBasis;
            h.quantity = newQuantity;
          } else {
            h.quantity = Math.max(0, h.quantity - activity.quantity);
            h.costBasis = h.quantity * h.avgCost;
          }
        }

        const openPositions = Array.from(holdingsMap.values())
          .filter((h) => h.quantity > 0.0001)
          .sort((a, b) => b.costBasis - a.costBasis);

        return {
          positionCount: openPositions.length,
          positions: openPositions.map((h) => ({
            ...h,
            avgCost: +h.avgCost.toFixed(4),
            costBasis: +h.costBasis.toFixed(2),
            quantity: +h.quantity.toFixed(6)
          }))
        };
      },
      inputSchema: z.object({})
    }),

    get_real_estate_properties: tool({
      description:
        'List real estate properties owned by the user, including property type (full ownership, bare ownership), current valuation, ownership percentage, and full mortgage details: monthly payment, remaining balance, remaining installments, total interest remaining, and history of early amortizations. Use this tool to answer questions about mortgage debt, amortization decisions, or net equity in properties.',
      execute: async () => {
        const properties = await prisma.realEstateProperty.findMany({
          include: {
            mortgage: {
              include: {
                amortizations: {
                  orderBy: { date: 'asc' },
                  select: { amount: true, date: true, reduceTerm: true }
                }
              }
            },
            valuations: {
              orderBy: { date: 'desc' },
              select: { date: true, value: true },
              take: 1
            }
          },
          orderBy: { name: 'asc' },
          where: { userId }
        });

        const propertyTypeLabel: Record<string, string> = {
          BARE_OWNERSHIP: 'Bare Ownership (Nuda Propiedad)',
          OTHER: 'Other',
          OWNERSHIP: 'Full Ownership'
        };

        return properties.map((p) => {
          const currentValue = p.valuations[0]?.value ?? p.value;

          return {
            acquisitionDate:
              p.acquisitionDate?.toISOString().slice(0, 10) ?? null,
            addressCity: p.addressCity,
            addressCountry: p.addressCountry,
            currency: p.currency,
            currentValue,
            id: p.id,
            mortgage: p.mortgage ? computeMortgageDetails(p.mortgage) : null,
            name: p.name,
            ownershipPercentage: p.ownershipPercentage,
            propertyType: propertyTypeLabel[p.propertyType] ?? p.propertyType,
            usufructuaryAge: p.usufructuaryAge ?? null,
            value: p.value
          };
        });
      },
      inputSchema: z.object({})
    })
  };
}
