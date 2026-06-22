import {
  CreateRealEstatePropertyDto,
  CreateRealEstatePropertyValuationDto,
  UpdateRealEstatePropertyDto
} from '@ghostfolio/common/dtos';
import { getLocale } from '@ghostfolio/common/helper';
import {
  RealEstateProperty,
  LineChartItem
} from '@ghostfolio/common/interfaces';
import { GfLineChartComponent } from '@ghostfolio/ui/line-chart';
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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  createOutline,
  homeOutline,
  saveOutline,
  trashOutline
} from 'ionicons/icons';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    GfLineChartComponent,
    IonIcon,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    NgxSkeletonLoaderModule,
    RouterLink
  ],
  selector: 'gf-my-properties-page',
  styleUrls: ['./my-properties-page.scss'],
  templateUrl: './my-properties-page.html'
})
export class GfMyPropertiesPageComponent implements OnInit {
  protected readonly properties = signal<RealEstateProperty[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isEditing = signal(false);

  protected formData: Partial<RealEstateProperty> = {};
  protected valuationForm: { date: string; value: number | null } = {
    date: '',
    value: null
  };
  protected editingId: string | null = null;
  protected valuationEditId: string | null = null;

  private chartDataMap = new Map<
    string,
    { items: LineChartItem[]; yMin: number }
  >();

  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly dataService = inject(DataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = getLocale();

  public constructor() {
    addIcons({
      addOutline,
      createOutline,
      homeOutline,
      saveOutline,
      trashOutline
    });
  }

  public ngOnInit(): void {
    this.loadProperties();
  }

  protected onAddNew(): void {
    this.editingId = null;
    this.formData = {
      name: '',
      currency: 'EUR',
      ownershipPercentage: 100,
      propertyType: 'OWNERSHIP',
      value: 0
    };
    this.resetValuationForm();
    this.isEditing.set(true);
  }

  protected onEdit(p: RealEstateProperty): void {
    this.editingId = p.id;
    this.formData = { ...p };
    this.resetValuationForm();
    this.isEditing.set(true);
  }

  protected onCancel(): void {
    this.isEditing.set(false);
    this.formData = {};
    this.editingId = null;
    this.valuationEditId = null;
    this.resetValuationForm();
  }

  protected onSave(): void {
    const isUpdate = !!this.editingId;

    if (isUpdate) {
      const dto: UpdateRealEstatePropertyDto = {
        id: this.editingId!,
        name: this.formData.name,
        addressStreet: this.formData.addressStreet,
        addressZipCode: this.formData.addressZipCode,
        addressCity: this.formData.addressCity,
        addressProvince: this.formData.addressProvince,
        addressCountry: this.formData.addressCountry,
        currency: this.formData.currency,
        ownershipPercentage: this.formData.ownershipPercentage,
        propertyType: this.formData.propertyType as any,
        value: this.formData.value
      };

      this.dataService
        .putRealEstateProperty(this.editingId!, dto)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.onCancel();
          this.loadProperties();
        });
    } else {
      const dto: CreateRealEstatePropertyDto = {
        name: this.formData.name!,
        addressStreet: this.formData.addressStreet,
        addressZipCode: this.formData.addressZipCode,
        addressCity: this.formData.addressCity,
        addressProvince: this.formData.addressProvince,
        addressCountry: this.formData.addressCountry,
        currency: this.formData.currency!,
        ownershipPercentage: this.formData.ownershipPercentage ?? 100,
        propertyType: this.formData.propertyType as any,
        value: this.formData.value ?? 0
      };

      this.dataService
        .postRealEstateProperty(dto)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.onCancel();
          this.loadProperties();
        });
    }
  }

  protected onDelete(id: string): void {
    this.dataService
      .deleteRealEstateProperty(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadProperties();
      });
  }

  protected onAddValuation(): void {
    if (
      !this.editingId ||
      !this.valuationForm.date ||
      this.valuationForm.value === null
    ) {
      return;
    }

    const dto: CreateRealEstatePropertyValuationDto = {
      date: this.valuationForm.date,
      value: this.valuationForm.value
    };

    if (this.valuationEditId) {
      const oldId = this.valuationEditId;
      this.dataService
        .deleteRealEstatePropertyValuation(this.editingId, oldId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.dataService
            .postRealEstatePropertyValuation(this.editingId!, dto)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
              this.valuationEditId = null;
              this.resetValuationForm();
              this.loadProperties(true);
            });
        });
    } else {
      this.dataService
        .postRealEstatePropertyValuation(this.editingId, dto)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.resetValuationForm();
          this.loadProperties(true);
        });
    }
  }

  protected onEditValuation(v: {
    id: string;
    date: string;
    value: number;
  }): void {
    this.valuationEditId = v.id;
    this.valuationForm = {
      date: new Date(v.date).toISOString().substring(0, 10),
      value: v.value
    };
    this.changeDetectorRef.markForCheck();
  }

  protected onCancelValuationEdit(): void {
    this.valuationEditId = null;
    this.resetValuationForm();
  }

  protected onDeleteValuation(valuationId: string): void {
    if (!this.editingId) {
      return;
    }

    this.dataService
      .deleteRealEstatePropertyValuation(this.editingId, valuationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.valuationEditId === valuationId) {
          this.valuationEditId = null;
          this.resetValuationForm();
        }
        this.loadProperties(true);
      });
  }

  protected adjustedValue(p: RealEstateProperty): number {
    return (p.value * p.ownershipPercentage) / 100;
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

  protected cssClass(type: string): string {
    switch (type) {
      case 'OWNERSHIP':
        return 'ownership';
      case 'BARE_OWNERSHIP':
        return 'bare-ownership';
      default:
        return 'other';
    }
  }

  protected formatCurrency(value: number, currency: string): string {
    return new Intl.NumberFormat(this.locale, {
      currency: currency || 'EUR',
      maximumFractionDigits: 0,
      style: 'currency'
    }).format(value);
  }

  protected getChartItems(id: string): LineChartItem[] {
    return this.chartDataMap.get(id)?.items ?? [];
  }

  protected getChartYMin(id: string): number | undefined {
    return this.chartDataMap.get(id)?.yMin;
  }

  protected getEditingProperty(): RealEstateProperty | undefined {
    return this.properties().find((p) => p.id === this.editingId);
  }

  private resetValuationForm(): void {
    this.valuationForm = { date: '', value: null };
  }

  private buildChartData(properties: RealEstateProperty[]): void {
    const today = new Date().toISOString().substring(0, 10);
    const map = new Map<string, { items: LineChartItem[]; yMin: number }>();
    for (const p of properties) {
      if (!p.valuations || p.valuations.length < 1) {
        continue;
      }
      const items: LineChartItem[] = p.valuations.map((v) => ({
        date:
          typeof v.date === 'string'
            ? v.date.substring(0, 10)
            : new Date(v.date).toISOString().substring(0, 10),
        value: v.value
      }));
      // Append the current property value as the rightmost point
      const last = items[items.length - 1];
      if (last.date !== today || last.value !== p.value) {
        items.push({ date: today, value: p.value });
      }
      if (items.length < 2) {
        continue;
      }
      const vals = items.map((i) => i.value);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const padding = max > min ? (max - min) * 0.2 : min * 0.03;
      map.set(p.id, { items, yMin: min - padding });
    }
    this.chartDataMap = map;
  }

  private loadProperties(keepEditing = false): void {
    if (!keepEditing) {
      this.isLoading.set(true);
    }
    this.dataService
      .fetchRealEstateProperties()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((properties) => {
        this.buildChartData(properties);
        this.properties.set(properties);
        if (!keepEditing) {
          this.isLoading.set(false);
        }
        if (keepEditing && this.editingId) {
          const updated = properties.find((p) => p.id === this.editingId);
          if (updated) {
            this.formData = { ...updated };
          }
        }
        this.changeDetectorRef.markForCheck();
      });
  }
}
