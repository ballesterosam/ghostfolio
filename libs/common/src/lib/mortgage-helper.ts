import { addMonths } from 'date-fns';

export interface MortgageAmortizationInput {
  date: string | Date;
  amount: number;
  reduceTerm: boolean;
}

export interface MortgageInput {
  startDate: string | Date;
  installments: number;
  principal: number;
  interestRate: number; // percentage e.g. 2.5
  amortizations?: MortgageAmortizationInput[];
}

export interface MortgageCalculationResult {
  monthlyPayment: number;
  totalCost: number;
  totalInterest: number;
  remainingInterest: number;
  endDate: string;
  installmentsPaid: number;
  installmentsRemaining: number;
  totalAmortized: number;
  outstandingPrincipal: number;
  paidPrincipal: number;
  mortgageOwnershipPercentage: number;
}

/**
 * Helper to round values to 2 decimal places.
 */
function roundToCents(val: number): number {
  return Math.round(val * 100) / 100;
}

/**
 * Calculates the monthly payment using the French amortization system (constant payment).
 * formula: payment = P * r * (1+r)^n / ((1+r)^n - 1)
 */
export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  installments: number
): number {
  if (installments <= 0 || principal <= 0) {
    return 0;
  }
  if (annualRate <= 0) {
    return roundToCents(principal / installments);
  }
  const r = annualRate / 100 / 12;
  const payment =
    (principal * r * Math.pow(1 + r, installments)) /
    (Math.pow(1 + r, installments) - 1);
  return isNaN(payment) ? 0 : roundToCents(payment);
}

/**
 * Simulates the mortgage schedule step by step to calculate current status
 * and remaining values, taking into account any early amortizations.
 */
export function calculateMortgageSummary(
  mortgage: MortgageInput,
  propertyValue: number,
  currentDateInput: string | Date
): MortgageCalculationResult {
  const startDate = new Date(mortgage.startDate);
  const currentDate = new Date(currentDateInput);
  const annualRate = mortgage.interestRate;
  const originalPrincipal = mortgage.principal;
  const originalInstallments = mortgage.installments;

  const amortizations: { date: Date; amount: number; reduceTerm: boolean }[] = (
    mortgage.amortizations ?? []
  )
    .map((a) => ({
      date: new Date(a.date),
      amount: a.amount,
      reduceTerm: a.reduceTerm
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const r = annualRate / 100 / 12;

  let outstanding = originalPrincipal;
  let termRemaining = originalInstallments;
  let cuota = calculateMonthlyPayment(outstanding, annualRate, termRemaining);

  // Values as of currentDate
  let outstandingPrincipalAtCurrentDate = originalPrincipal;
  let totalAmortizedAtCurrentDate = 0;
  let installmentsPaidVal = 0;
  let installmentsRemainingVal = 0;

  // Totals for the whole life of the mortgage
  let totalPaymentsPaid = 0;
  let totalInterestPaid = 0;
  let totalAmortizedVal = 0;

  let totalRemainingPayments = 0;
  let totalRemainingInterest = 0;

  let startOfPeriod = new Date(startDate.getTime());
  let step = 0;
  let amortIndex = 0;
  const maxSteps = originalInstallments * 3;
  let lastPaymentDate = new Date(startDate.getTime());

  while (outstanding > 0 && step < maxSteps) {
    step++;
    const endOfPeriod = addMonths(startDate, step);

    // 1. Process early amortizations in [startOfPeriod, endOfPeriod)
    while (
      amortIndex < amortizations.length &&
      amortizations[amortIndex].date.getTime() >= startOfPeriod.getTime() &&
      amortizations[amortIndex].date.getTime() < endOfPeriod.getTime()
    ) {
      const amort = amortizations[amortIndex];
      const appliedAmort = roundToCents(Math.min(outstanding, amort.amount));
      outstanding = roundToCents(outstanding - appliedAmort);

      const isAmortPaid = amort.date.getTime() <= currentDate.getTime();
      if (isAmortPaid) {
        totalAmortizedAtCurrentDate = roundToCents(
          totalAmortizedAtCurrentDate + appliedAmort
        );
        outstandingPrincipalAtCurrentDate = roundToCents(
          outstandingPrincipalAtCurrentDate - appliedAmort
        );
      }
      totalAmortizedVal = roundToCents(totalAmortizedVal + appliedAmort);

      if (!amort.reduceTerm) {
        // Re-calculate payment based on remaining installments (French system)
        const remainingSteps = originalInstallments - step + 1;
        if (remainingSteps > 0 && outstanding > 0) {
          termRemaining = remainingSteps;
          cuota = calculateMonthlyPayment(
            outstanding,
            annualRate,
            termRemaining
          );
        }
      }
      amortIndex++;
    }

    if (outstanding <= 0) {
      lastPaymentDate = endOfPeriod;
      break;
    }

    // 2. Process regular monthly installment payment at endOfPeriod
    const interestOfMonth = roundToCents(
      outstanding * (annualRate > 0 ? r : 0)
    );

    // Capping check to prevent rounding issues from creating an extra installment
    const isLastStep = outstanding + interestOfMonth < cuota + 1.0;
    const payment = isLastStep
      ? roundToCents(outstanding + interestOfMonth)
      : cuota;
    const principalPaid = roundToCents(
      Math.min(outstanding, payment - interestOfMonth)
    );
    const interestPaid = roundToCents(payment - principalPaid);

    outstanding = roundToCents(outstanding - principalPaid);
    lastPaymentDate = endOfPeriod;

    const isPaymentPaid = endOfPeriod.getTime() <= currentDate.getTime();
    if (isPaymentPaid) {
      installmentsPaidVal++;
      totalPaymentsPaid = roundToCents(totalPaymentsPaid + payment);
      totalInterestPaid = roundToCents(totalInterestPaid + interestPaid);
      outstandingPrincipalAtCurrentDate = roundToCents(
        outstandingPrincipalAtCurrentDate - principalPaid
      );
    } else {
      installmentsRemainingVal++;
      totalRemainingPayments = roundToCents(totalRemainingPayments + payment);
      totalRemainingInterest = roundToCents(
        totalRemainingInterest + interestPaid
      );
    }

    startOfPeriod = endOfPeriod;
  }

  // Gather any amortizations past the mortgage end date (safeguard)
  while (amortIndex < amortizations.length) {
    const amort = amortizations[amortIndex];
    const appliedAmort = roundToCents(
      Math.min(originalPrincipal, amort.amount)
    );
    if (amort.date.getTime() <= currentDate.getTime()) {
      totalAmortizedAtCurrentDate = roundToCents(
        totalAmortizedAtCurrentDate + appliedAmort
      );
      outstandingPrincipalAtCurrentDate = roundToCents(
        outstandingPrincipalAtCurrentDate - appliedAmort
      );
    }
    totalAmortizedVal = roundToCents(totalAmortizedVal + appliedAmort);
    amortIndex++;
  }

  outstandingPrincipalAtCurrentDate = Math.max(
    0,
    outstandingPrincipalAtCurrentDate
  );
  const paidPrincipalVal = roundToCents(
    originalPrincipal - outstandingPrincipalAtCurrentDate
  );

  const totalCostVal = roundToCents(
    totalPaymentsPaid + totalRemainingPayments + totalAmortizedVal
  );
  const totalInterestVal = roundToCents(
    totalInterestPaid + totalRemainingInterest
  );

  let mortgageOwnershipPercentageVal = 100;
  if (propertyValue > 0) {
    const realPatrimony = roundToCents(
      propertyValue - outstandingPrincipalAtCurrentDate - totalRemainingInterest
    );
    mortgageOwnershipPercentageVal = (realPatrimony / propertyValue) * 100;
    mortgageOwnershipPercentageVal = Math.max(
      0,
      Math.min(100, mortgageOwnershipPercentageVal)
    );
  }

  return {
    monthlyPayment: cuota,
    totalCost: totalCostVal,
    totalInterest: totalInterestVal,
    remainingInterest: totalRemainingInterest,
    endDate: lastPaymentDate.toISOString().split('T')[0],
    installmentsPaid: installmentsPaidVal,
    installmentsRemaining: installmentsRemainingVal,
    totalAmortized: totalAmortizedAtCurrentDate,
    outstandingPrincipal: outstandingPrincipalAtCurrentDate,
    paidPrincipal: paidPrincipalVal,
    mortgageOwnershipPercentage: roundToCents(mortgageOwnershipPercentageVal)
  };
}
