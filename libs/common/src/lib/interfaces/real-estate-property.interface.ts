export interface RealEstatePropertyValuation {
  id: string;
  date: string;
  value: number;
  propertyId: string;
}

export interface MortgageAmortization {
  id: string;
  date: string;
  amount: number;
  reduceTerm: boolean;
  mortgageId: string;
}

export interface Mortgage {
  id: string;
  startDate: string;
  installments: number;
  principal: number;
  interestRate: number;
  propertyId: string;
  amortizations?: MortgageAmortization[];
}

export interface MortgageWithCalculations extends Mortgage {
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

export interface RealEstateProperty {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  addressStreet?: string;
  addressZipCode?: string;
  addressCity?: string;
  addressProvince?: string;
  addressCountry?: string;
  currency: string;
  ownershipPercentage: number;
  propertyType: 'OWNERSHIP' | 'BARE_OWNERSHIP' | 'OTHER';
  value: number;
  latitude?: number | null;
  longitude?: number | null;
  usufructuaryAge?: number | null;
  userId: string;
  valuations?: RealEstatePropertyValuation[];
  mortgage?: MortgageWithCalculations | null;
}
