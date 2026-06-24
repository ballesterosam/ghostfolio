import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { UserSettings } from '@ghostfolio/common/interfaces';

import { PropertyType, Type } from '@prisma/client';
import { tool } from 'ai';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export function buildWriteTools(prisma: PrismaService, userId: string) {
  return {
    create_account: tool({
      description:
        'Create a new investment account for the user. Optionally links to a broker/platform by name (e.g. "Degiro", "Interactive Brokers") and sets an initial cash balance.',
      execute: async ({
        balance,
        comment,
        currency,
        isExcluded,
        name,
        platformName
      }) => {
        let platformId: string | null = null;
        let platformLinked = false;

        if (platformName) {
          const platform = await prisma.platform.findFirst({
            where: { name: { contains: platformName, mode: 'insensitive' } }
          });

          if (platform) {
            platformId = platform.id;
            platformLinked = true;
          }
        }

        const account = await prisma.account.create({
          data: {
            balance: balance ?? 0,
            comment: comment ?? null,
            currency,
            isExcluded: isExcluded ?? false,
            name,
            user: { connect: { id: userId } },
            ...(platformId ? { platform: { connect: { id: platformId } } } : {})
          }
        });

        // Create AccountBalance record so Ghostfolio tracks the initial balance
        await prisma.accountBalance.create({
          data: {
            accountId: account.id,
            date: new Date(),
            userId,
            value: balance ?? 0
          }
        });

        const platformMsg = platformLinked
          ? ` linked to ${platformName}`
          : platformName
            ? ` (platform "${platformName}" not found in Ghostfolio — account created without platform link)`
            : '';

        return {
          id: account.id,
          message: `Account "${name}" created${platformMsg}`,
          name,
          platformLinked
        };
      },
      inputSchema: z.object({
        balance: z
          .number()
          .optional()
          .describe('Initial cash balance (default 0)'),
        comment: z.string().optional().describe('Optional note about account'),
        currency: z
          .string()
          .describe('Currency code, e.g. EUR or USD (required)'),
        isExcluded: z
          .boolean()
          .optional()
          .describe('Whether to exclude from net worth (default false)'),
        name: z.string().describe('Account name (required)'),
        platformName: z
          .string()
          .optional()
          .describe(
            'Broker or platform name to link the account to (e.g. "Degiro", "Interactive Brokers")'
          )
      })
    }),

    create_activity: tool({
      description:
        'Record a new investment activity. Use type BUY/SELL/DIVIDEND for asset transactions (requires symbol), and FEE/INTEREST/LIABILITY for cash entries (requires name). Quantity is the number of shares; unitPrice is the price per share (or total amount for cash entries with quantity=1).',
      execute: async ({
        accountId,
        comment,
        currency,
        date,
        fee,
        name,
        quantity,
        symbol,
        type,
        unitPrice
      }) => {
        const isCashType = ['FEE', 'INTEREST', 'LIABILITY'].includes(type);
        let symbolProfileId: string;

        if (isCashType) {
          const profile = await prisma.symbolProfile.create({
            data: {
              currency,
              dataSource: 'MANUAL',
              name: name ?? type,
              symbol: randomUUID(),
              user: { connect: { id: userId } }
            }
          });

          symbolProfileId = profile.id;
        } else {
          if (!symbol) {
            return {
              error: 'symbol is required for BUY, SELL, and DIVIDEND activities'
            };
          }

          const upperSymbol = symbol.toUpperCase();
          const existing = await prisma.symbolProfile.findFirst({
            orderBy: { dataSource: 'asc' },
            where: { symbol: upperSymbol }
          });

          if (existing) {
            symbolProfileId = existing.id;
          } else {
            const profile = await prisma.symbolProfile.upsert({
              create: {
                currency,
                dataSource: 'MANUAL',
                name: name ?? upperSymbol,
                symbol: upperSymbol,
                user: { connect: { id: userId } }
              },
              update: {},
              where: {
                dataSource_symbol: { dataSource: 'MANUAL', symbol: upperSymbol }
              }
            });

            symbolProfileId = profile.id;
          }
        }

        if (accountId) {
          const account = await prisma.account.findFirst({
            where: { id: accountId, userId }
          });

          if (!account) {
            return { error: 'Account not found or does not belong to user' };
          }
        }

        const order = await prisma.order.create({
          data: {
            comment: comment ?? null,
            currency,
            date: new Date(date),
            fee: fee ?? 0,
            isDraft: false,
            quantity,
            symbolProfileId,
            type: type as Type,
            unitPrice,
            userId,
            ...(accountId ? { accountId, accountUserId: userId } : {})
          }
        });

        return {
          currency,
          date,
          id: order.id,
          message: `${type} activity recorded`,
          quantity,
          type,
          unitPrice
        };
      },
      inputSchema: z.object({
        accountId: z
          .string()
          .optional()
          .describe('Account ID to link the activity to'),
        comment: z.string().optional().describe('Optional note'),
        currency: z.string().describe('Currency code, e.g. EUR (required)'),
        date: z
          .string()
          .describe('Transaction date in YYYY-MM-DD format (required)'),
        fee: z
          .number()
          .optional()
          .describe('Transaction fee amount (default 0)'),
        name: z
          .string()
          .optional()
          .describe(
            'Asset or category name — required for FEE/INTEREST/LIABILITY'
          ),
        quantity: z
          .number()
          .describe(
            'Number of shares or units; use 1 for FEE/INTEREST/LIABILITY (required)'
          ),
        symbol: z
          .string()
          .optional()
          .describe(
            'Ticker symbol, e.g. AAPL — required for BUY/SELL/DIVIDEND'
          ),
        type: z
          .enum(['BUY', 'SELL', 'DIVIDEND', 'FEE', 'INTEREST', 'LIABILITY'])
          .describe('Activity type (required)'),
        unitPrice: z
          .number()
          .describe(
            'Price per share, or total amount for cash entries (required)'
          )
      })
    }),

    create_amortization: tool({
      description:
        'Record an early mortgage repayment on a property. Reduces the outstanding balance. Use the property ID (from get_real_estate_properties) to identify the property.',
      execute: async ({ amount, date, propertyId, reduceTerm }) => {
        const property = await prisma.realEstateProperty.findFirst({
          include: { mortgage: true },
          where: { id: propertyId, userId }
        });

        if (!property) {
          return { error: 'Property not found or does not belong to user' };
        }

        if (!property.mortgage) {
          return { error: 'No mortgage found for this property' };
        }

        const amortization = await prisma.mortgageAmortization.create({
          data: {
            amount,
            date: new Date(date),
            mortgageId: property.mortgage.id,
            reduceTerm: reduceTerm ?? true
          }
        });

        return {
          id: amortization.id,
          message: `Early repayment of ${amount} ${property.currency} recorded`,
          reduceTerm: reduceTerm ?? true
        };
      },
      inputSchema: z.object({
        amount: z.number().describe('Repayment amount (required)'),
        date: z
          .string()
          .describe('Date of the repayment in YYYY-MM-DD format (required)'),
        propertyId: z
          .string()
          .describe('Property ID from get_real_estate_properties (required)'),
        reduceTerm: z
          .boolean()
          .optional()
          .describe(
            'true = reduces remaining term (default), false = reduces monthly payment'
          )
      })
    }),

    create_mortgage: tool({
      description:
        'Add a mortgage to an existing real estate property. The property must belong to the user and must not already have a mortgage.',
      execute: async ({
        installments,
        interestRate,
        principal,
        propertyId,
        startDate
      }) => {
        const property = await prisma.realEstateProperty.findFirst({
          where: { id: propertyId, userId }
        });

        if (!property) {
          return { error: 'Property not found or does not belong to user' };
        }

        const existing = await prisma.mortgage.findUnique({
          where: { propertyId }
        });

        if (existing) {
          return {
            error:
              'A mortgage already exists for this property. Delete it first if you need to replace it.'
          };
        }

        const mortgage = await prisma.mortgage.create({
          data: {
            installments,
            interestRate,
            principal,
            propertyId,
            startDate: new Date(startDate)
          }
        });

        return {
          id: mortgage.id,
          message: `Mortgage of ${principal} at ${interestRate}% created (${installments} installments)`
        };
      },
      inputSchema: z.object({
        installments: z
          .number()
          .int()
          .describe('Total number of monthly payments (required)'),
        interestRate: z
          .number()
          .describe('Annual interest rate as percentage, e.g. 2.5 (required)'),
        principal: z.number().describe('Loan amount (required)'),
        propertyId: z
          .string()
          .describe('Property ID from get_real_estate_properties (required)'),
        startDate: z
          .string()
          .describe('Mortgage start date in YYYY-MM-DD format (required)')
      })
    }),

    create_real_estate_property: tool({
      description:
        'Add a real estate property to the user portfolio. PropertyType must be OWNERSHIP, BARE_OWNERSHIP, or OTHER.',
      execute: async ({
        acquisitionDate,
        addressCity,
        addressCountry,
        addressProvince,
        addressStreet,
        addressZipCode,
        currency,
        name,
        ownershipPercentage,
        propertyType,
        usufructuaryAge,
        value
      }) => {
        const property = await prisma.realEstateProperty.create({
          data: {
            acquisitionDate: acquisitionDate ? new Date(acquisitionDate) : null,
            addressCity: addressCity ?? null,
            addressCountry: addressCountry ?? null,
            addressProvince: addressProvince ?? null,
            addressStreet: addressStreet ?? null,
            addressZipCode: addressZipCode ?? null,
            currency,
            name,
            ownershipPercentage: ownershipPercentage ?? 100,
            propertyType: propertyType as PropertyType,
            userId,
            usufructuaryAge: usufructuaryAge ?? null,
            value
          }
        });

        return {
          id: property.id,
          message: `Property "${name}" created`,
          name
        };
      },
      inputSchema: z.object({
        acquisitionDate: z
          .string()
          .optional()
          .describe('Purchase date in YYYY-MM-DD format'),
        addressCity: z.string().optional().describe('City'),
        addressCountry: z.string().optional().describe('Country'),
        addressProvince: z.string().optional().describe('Province or region'),
        addressStreet: z.string().optional().describe('Street address'),
        addressZipCode: z.string().optional().describe('Postal code'),
        currency: z.string().describe('Currency code, e.g. EUR (required)'),
        name: z.string().describe('Property name or label (required)'),
        ownershipPercentage: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe('Ownership stake 0–100 (default 100)'),
        propertyType: z
          .enum(['OWNERSHIP', 'BARE_OWNERSHIP', 'OTHER'])
          .describe('Property type (required)'),
        usufructuaryAge: z
          .number()
          .int()
          .optional()
          .describe(
            'Age of the usufructuary — required for BARE_OWNERSHIP to compute fiscal value'
          ),
        value: z.number().describe('Current estimated market value (required)')
      })
    }),

    delete_activity: tool({
      description: 'Delete an existing investment activity by its ID.',
      execute: async ({ activityId }) => {
        const existing = await prisma.order.findFirst({
          where: { id: activityId, userId }
        });

        if (!existing) {
          return { error: 'Activity not found or does not belong to user' };
        }

        await prisma.order.delete({ where: { id: activityId } });

        return { message: 'Activity deleted' };
      },
      inputSchema: z.object({
        activityId: z
          .string()
          .describe('Activity ID from get_activities (required)')
      })
    }),

    delete_goal: tool({
      description: 'Delete an annual savings goal by year.',
      execute: async ({ year }) => {
        const settingsRecord = await prisma.settings.findUnique({
          where: { userId }
        });

        const userSettings = (settingsRecord?.settings ?? {}) as UserSettings;
        const existing = userSettings.goals ?? [];
        const updated = existing.filter((g) => g.year !== year);

        if (updated.length === existing.length) {
          return { message: `No goal found for year ${year}` };
        }

        await prisma.settings.update({
          data: { settings: { ...userSettings, goals: updated } },
          where: { userId }
        });

        return { message: `Goal for ${year} deleted` };
      },
      inputSchema: z.object({
        year: z.number().int().describe('Year of the goal to delete (required)')
      })
    }),

    set_goal: tool({
      description:
        'Create or update an annual savings goal. If a goal for the given year already exists, it will be replaced.',
      execute: async ({ targetAmount, year }) => {
        const settingsRecord = await prisma.settings.findUnique({
          where: { userId }
        });

        const userSettings = (settingsRecord?.settings ?? {}) as UserSettings;
        const goals = (userSettings.goals ?? []).filter((g) => g.year !== year);
        goals.push({ targetAmount, year });
        goals.sort((a, b) => a.year - b.year);

        await prisma.settings.upsert({
          create: { settings: { ...userSettings, goals }, userId },
          update: { settings: { ...userSettings, goals } },
          where: { userId }
        });

        return { message: `Goal for ${year}: ${targetAmount}` };
      },
      inputSchema: z.object({
        targetAmount: z
          .number()
          .describe('Target portfolio value in base currency (required)'),
        year: z.number().int().describe('Year for the goal (required)')
      })
    }),

    store_memory: tool({
      description:
        "Store a relevant insight about the user for future conversations — investment preferences, risk tolerance, excluded assets, life events relevant to their financial situation, or any personal detail that should inform future advice. Call this proactively when the user reveals something meaningful. Do NOT store conversation-specific facts that won't apply across sessions.",
      execute: async ({ category, content }) => {
        await prisma.hipatiaMemory.create({
          data: { category: category ?? null, content, userId }
        });

        return { message: 'Memory stored' };
      },
      inputSchema: z.object({
        category: z
          .enum([
            'excluded_asset',
            'goal',
            'life_event',
            'other',
            'preference',
            'risk_tolerance'
          ])
          .optional()
          .describe('Category to help organise memories'),
        content: z
          .string()
          .max(500)
          .describe(
            'The insight to remember about the user (max 500 chars, required)'
          )
      })
    }),

    update_activity: tool({
      description:
        'Update an existing investment activity. Only numeric fields and comment can be updated; type and symbol cannot be changed. All update fields are optional — only provide what needs to change.',
      execute: async ({
        activityId,
        comment,
        date,
        fee,
        quantity,
        unitPrice
      }) => {
        const existing = await prisma.order.findFirst({
          where: { id: activityId, userId }
        });

        if (!existing) {
          return { error: 'Activity not found or does not belong to user' };
        }

        const updateData: {
          comment?: string | null;
          date?: Date;
          fee?: number;
          quantity?: number;
          unitPrice?: number;
        } = {};

        if (date !== undefined) updateData.date = new Date(date);
        if (quantity !== undefined) updateData.quantity = quantity;
        if (unitPrice !== undefined) updateData.unitPrice = unitPrice;
        if (fee !== undefined) updateData.fee = fee;
        if (comment !== undefined) updateData.comment = comment;

        if (Object.keys(updateData).length === 0) {
          return { message: 'No fields to update were provided' };
        }

        await prisma.order.update({
          data: updateData,
          where: { id: activityId }
        });

        return { id: activityId, message: 'Activity updated' };
      },
      inputSchema: z.object({
        activityId: z
          .string()
          .describe('Activity ID from get_activities (required)'),
        comment: z
          .string()
          .optional()
          .describe('New comment (use empty string to clear)'),
        date: z.string().optional().describe('New date in YYYY-MM-DD format'),
        fee: z.number().optional().describe('New fee amount'),
        quantity: z.number().optional().describe('New quantity'),
        unitPrice: z.number().optional().describe('New price per unit')
      })
    })
  };
}
