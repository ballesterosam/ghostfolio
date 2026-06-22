export interface RealEstatePropertyValuation {
  id: string;
  date: string;
  value: number;
  propertyId: string;
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
  userId: string;
  valuations?: RealEstatePropertyValuation[];
}
