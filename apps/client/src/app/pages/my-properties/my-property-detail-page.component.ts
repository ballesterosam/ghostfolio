import { getLocale } from '@ghostfolio/common/helper';
import {
  RealEstateProperty,
  LineChartItem
} from '@ghostfolio/common/interfaces';
import { GfLineChartComponent } from '@ghostfolio/ui/line-chart';
import { GfMortgageThermometerComponent } from '@ghostfolio/ui/mortgage-thermometer';
import { GfPortfolioProportionChartComponent } from '@ghostfolio/ui/portfolio-proportion-chart';
import { DataService } from '@ghostfolio/ui/services';

import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  createOutline,
  locationOutline,
  saveOutline,
  trashOutline,
  addOutline
} from 'ionicons/icons';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page' },
  imports: [
    DatePipe,
    FormsModule,
    GfLineChartComponent,
    GfPortfolioProportionChartComponent,
    GfMortgageThermometerComponent,
    IonIcon,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    NgxSkeletonLoaderModule,
    RouterLink
  ],
  selector: 'gf-my-property-detail-page',
  styleUrls: ['./my-property-detail-page.scss'],
  templateUrl: './my-property-detail-page.html'
})
export class GfMyPropertyDetailPageComponent implements OnInit {
  protected readonly property = signal<RealEstateProperty | null>(null);
  protected readonly isLoading = signal(true);

  protected chartItems: LineChartItem[] = [];
  protected chartYMin: number | undefined;
  protected donutData: Record<
    string,
    { name: string; type?: string; value: number }
  > = {};
  protected mapSrc: SafeResourceUrl | null = null;
  protected latitudeInput: number | null = null;
  protected longitudeInput: number | null = null;
  protected isSavingLocation = false;
  protected geocodeError = false;

  // Amortization form fields
  protected showAddAmortizationForm = false;
  protected amortizationDate = '';
  protected amortizationAmount: number | null = null;
  protected amortizationReduceTerm = true;

  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly dataService = inject(DataService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly locale = getLocale();
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);

  public constructor() {
    addIcons({
      arrowBackOutline,
      createOutline,
      locationOutline,
      saveOutline,
      trashOutline,
      addOutline
    });
  }

  public ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id = params.get('id');
        if (!id) {
          this.router.navigate(['/my-properties']);
          return;
        }
        this.isLoading.set(true);
        this.mapSrc = null;
        this.latitudeInput = null;
        this.longitudeInput = null;
        this.chartItems = [];
        this.donutData = {};
        this.loadProperty(id);
      });
  }

  protected fullAddress(p: RealEstateProperty): string {
    return [
      p.addressStreet,
      p.addressZipCode,
      p.addressCity,
      p.addressProvince,
      p.addressCountry
    ]
      .filter(Boolean)
      .join(', ');
  }

  protected propertyTypeLabel(type: string): string {
    switch (type) {
      case 'OWNERSHIP':
        return $localize`Ownership`;
      case 'BARE_OWNERSHIP':
        return $localize`Bare ownership`;
      default:
        return $localize`Other`;
    }
  }

  protected formatCurrency(value: number, currency: string): string {
    return new Intl.NumberFormat(this.locale, {
      currency: currency || 'EUR',
      maximumFractionDigits: 0,
      style: 'currency'
    }).format(value);
  }

  protected adjustedValue(p: RealEstateProperty): number {
    let baseValue = p.value;
    if (p.propertyType === 'BARE_OWNERSHIP') {
      let reduction = 40;
      if (p.usufructuaryAge !== undefined && p.usufructuaryAge !== null) {
        reduction = Math.max(10, 89 - p.usufructuaryAge);
      }
      baseValue = p.value * (1 - reduction / 100);
    }
    if (p.mortgage) {
      const realPatrimony =
        baseValue -
        p.mortgage.outstandingPrincipal -
        p.mortgage.remainingInterest;
      return Math.max(0, (realPatrimony * p.ownershipPercentage) / 100);
    }
    return (baseValue * p.ownershipPercentage) / 100;
  }

  protected onEdit(): void {
    const p = this.property();
    if (p) {
      this.router.navigate(['/my-properties'], { queryParams: { edit: p.id } });
    }
  }

  protected onAutoDetect(): void {
    const p = this.property();
    if (!p) {
      return;
    }
    const address = this.fullAddress(p);
    if (!address) {
      return;
    }
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    )
      .then((r) => r.json())
      .then((results: { lat: string; lon: string }[]) => {
        if (results.length === 0) {
          this.geocodeError = true;
          this.changeDetectorRef.markForCheck();
          return;
        }
        const lat = parseFloat(results[0].lat);
        const lon = parseFloat(results[0].lon);
        this.latitudeInput = lat;
        this.longitudeInput = lon;
        this.geocodeError = false;
        this.updateMap(lat, lon);
        this.changeDetectorRef.markForCheck();
      })
      .catch(() => {
        this.geocodeError = true;
        this.changeDetectorRef.markForCheck();
      });
  }

  protected onSaveLocation(): void {
    const p = this.property();
    if (!p || this.latitudeInput === null || this.longitudeInput === null) {
      return;
    }
    this.isSavingLocation = true;
    this.dataService
      .putRealEstateProperty(p.id, {
        id: p.id,
        latitude: this.latitudeInput,
        longitude: this.longitudeInput
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.isSavingLocation = false;
        this.updateMap(this.latitudeInput!, this.longitudeInput!);
        this.changeDetectorRef.markForCheck();
      });
  }

  protected onMapInputChange(): void {
    if (this.latitudeInput !== null && this.longitudeInput !== null) {
      this.updateMap(this.latitudeInput, this.longitudeInput);
    }
  }

  protected onAddAmortization(): void {
    const p = this.property();
    if (
      !p ||
      !this.amortizationDate ||
      this.amortizationAmount === null ||
      this.amortizationAmount <= 0
    ) {
      return;
    }
    this.dataService
      .postMortgageAmortization(p.id, {
        date: this.amortizationDate,
        amount: this.amortizationAmount,
        reduceTerm: this.amortizationReduceTerm
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.showAddAmortizationForm = false;
        this.amortizationDate = '';
        this.amortizationAmount = null;
        this.amortizationReduceTerm = true;
        this.loadProperty(p.id);
      });
  }

  protected onDeleteAmortization(amortizationId: string): void {
    const p = this.property();
    if (!p) {
      return;
    }
    this.dataService
      .deleteMortgageAmortization(p.id, amortizationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadProperty(p.id);
      });
  }

  private loadProperty(id: string): void {
    this.dataService
      .fetchRealEstateProperty(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((property) => {
        this.property.set(property);
        this.buildChartData(property);
        this.buildDonutData(property);
        if (property.latitude != null && property.longitude != null) {
          this.latitudeInput = property.latitude;
          this.longitudeInput = property.longitude;
          this.updateMap(property.latitude, property.longitude);
        }
        this.isLoading.set(false);
        this.changeDetectorRef.markForCheck();
      });
  }

  private buildChartData(p: RealEstateProperty): void {
    if (!p.valuations || p.valuations.length < 1) {
      this.chartItems = [];
      return;
    }
    const today = new Date().toISOString().substring(0, 10);
    const items: LineChartItem[] = p.valuations.map((v) => ({
      date:
        typeof v.date === 'string'
          ? v.date.substring(0, 10)
          : new Date(v.date).toISOString().substring(0, 10),
      value: v.value
    }));
    const last = items[items.length - 1];
    if (last.date !== today || last.value !== p.value) {
      items.push({ date: today, value: p.value });
    }
    const vals = items.map((i) => i.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const padding = max > min ? (max - min) * 0.2 : min * 0.03;
    this.chartItems = items;
    this.chartYMin = min - padding;
  }

  private buildDonutData(p: RealEstateProperty): void {
    if (p.mortgage) {
      const ownPct = p.ownershipPercentage;
      const debt =
        p.mortgage.outstandingPrincipal + p.mortgage.remainingInterest;
      const debtVal = debt / p.value;
      const equityVal = Math.max(0, ownPct / 100 - debtVal);

      this.donutData = {
        mine: { name: $localize`My equity`, value: equityVal },
        mortgage: { name: $localize`Mortgage debt`, value: debtVal },
        ...(ownPct < 100
          ? {
              other: {
                name: $localize`Other`,
                value: (100 - ownPct) / 100
              }
            }
          : {})
      };
    } else {
      this.donutData = {
        mine: { name: $localize`My share`, value: p.ownershipPercentage / 100 },
        ...(p.ownershipPercentage < 100
          ? {
              other: {
                name: $localize`Other`,
                value: (100 - p.ownershipPercentage) / 100
              }
            }
          : {})
      };
    }
  }

  private updateMap(lat: number, lon: number): void {
    const delta = 0.01;
    const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
    const url = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
    this.mapSrc = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
