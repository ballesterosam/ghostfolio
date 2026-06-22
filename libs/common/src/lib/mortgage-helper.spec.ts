import {
  calculateMonthlyPayment,
  calculateMortgageSummary
} from './mortgage-helper';

describe('Mortgage Helper', () => {
  describe('calculateMonthlyPayment', () => {
    it('should calculate correct monthly payment for French amortization (fixed rate)', () => {
      const payment = calculateMonthlyPayment(200000, 2.5, 360);
      expect(payment).toBe(790.24); // exact rounded value
    });

    it('should handle zero interest rate', () => {
      const payment = calculateMonthlyPayment(200000, 0, 360);
      expect(payment).toBe(555.56); // 200000 / 360 = 555.5555... rounded to 555.56
    });

    it('should handle zero principal or installments', () => {
      expect(calculateMonthlyPayment(0, 2.5, 360)).toBe(0);
      expect(calculateMonthlyPayment(200000, 2.5, 0)).toBe(0);
    });
  });

  describe('calculateMortgageSummary', () => {
    const mortgageInput = {
      startDate: '2026-01-01',
      installments: 360,
      principal: 200000,
      interestRate: 2.5,
      amortizations: []
    };

    it('should calculate initial state correctly (at start date)', () => {
      const summary = calculateMortgageSummary(
        mortgageInput,
        300000,
        '2026-01-01'
      );

      expect(summary.installmentsPaid).toBe(0);
      expect(summary.outstandingPrincipal).toBe(200000);
      expect(summary.installmentsRemaining).toBe(360);
      expect(summary.totalAmortized).toBe(0);
      expect(summary.paidPrincipal).toBe(0);
      // Let's verify the exact rounded totals
      expect(summary.totalCost).toBeCloseTo(284487.34, 1);
      expect(summary.totalInterest).toBeCloseTo(84487.34, 1);
      expect(summary.remainingInterest).toBeCloseTo(84487.34, 1);

      // propertyValue: 300000
      // outstanding: 200000
      // remainingInterest: 84487.34
      // realPatrimony = 300000 - 200000 - 84487.34 = 15512.66
      // % = 15512.66 / 300000 * 100 = 5.17088...%
      expect(summary.mortgageOwnershipPercentage).toBeCloseTo(5.17, 2);
    });

    it('should calculate correct values after 120 payments (10 years)', () => {
      const summary = calculateMortgageSummary(
        mortgageInput,
        300000,
        '2036-01-01'
      );

      expect(summary.installmentsPaid).toBe(120);
      expect(summary.installmentsRemaining).toBe(240);
      expect(summary.outstandingPrincipal).toBeLessThan(200000);
      expect(summary.remainingInterest).toBeLessThan(84487.34);
      expect(summary.mortgageOwnershipPercentage).toBeGreaterThan(5.17);
    });

    it('should handle early amortization reducing term', () => {
      const inputWithAmortization = {
        ...mortgageInput,
        amortizations: [
          {
            date: '2026-06-15',
            amount: 10000,
            reduceTerm: true
          }
        ]
      };

      const summary = calculateMortgageSummary(
        inputWithAmortization,
        300000,
        '2026-07-01'
      );

      expect(summary.totalAmortized).toBe(10000);

      const noAmortSummary = calculateMortgageSummary(
        mortgageInput,
        300000,
        '2026-07-01'
      );
      // Interest savings for the next payment (20.83) makes outstanding principal slightly lower than pure 10000 reduction.
      expect(summary.outstandingPrincipal).toBeCloseTo(187726.03, 1);
      expect(summary.outstandingPrincipal).toBeCloseTo(
        noAmortSummary.outstandingPrincipal - 10000 - 20.83,
        1
      );

      // Remaining installments overall should be less, because it reduces term
      const finalSummary = calculateMortgageSummary(
        inputWithAmortization,
        300000,
        '2060-01-01'
      );
      const finalNoAmortSummary = calculateMortgageSummary(
        mortgageInput,
        300000,
        '2060-01-01'
      );

      expect(new Date(finalSummary.endDate).getTime()).toBeLessThan(
        new Date(finalNoAmortSummary.endDate).getTime()
      );
    });

    it('should handle early amortization keeping term (reducing monthly payment)', () => {
      const inputWithAmortization = {
        ...mortgageInput,
        amortizations: [
          {
            date: '2026-06-15',
            amount: 10000,
            reduceTerm: false
          }
        ]
      };

      const summaryAtJuly = calculateMortgageSummary(
        inputWithAmortization,
        300000,
        '2026-07-01'
      );

      expect(summaryAtJuly.monthlyPayment).toBeLessThan(790.24);

      const finalSummary = calculateMortgageSummary(
        inputWithAmortization,
        300000,
        '2060-01-01'
      );
      expect(finalSummary.endDate).toBe('2056-01-01');
    });
  });
});
