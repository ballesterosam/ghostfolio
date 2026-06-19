import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  input,
  OnInit,
  signal,
  viewChild
} from '@angular/core';
import {
  ControlValueAccessor,
  FormControl,
  FormsModule,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule
} from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { IonIcon } from '@ionic/angular/standalone';
import { countries } from 'countries-list';
import { addIcons } from 'ionicons';
import { addOutline, closeOutline } from 'ionicons/icons';
import { of } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

import { AllocationItem } from './interfaces/interfaces';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    IonIcon,
    MatAutocompleteModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule
  ],
  providers: [
    {
      multi: true,
      provide: NG_VALUE_ACCESSOR,
      useExisting: GfAssetProfileAllocationEditorComponent
    }
  ],
  selector: 'gf-asset-profile-allocation-editor',
  styleUrls: ['./asset-profile-allocation-editor.component.scss'],
  templateUrl: './asset-profile-allocation-editor.component.html'
})
export class GfAssetProfileAllocationEditorComponent
  implements ControlValueAccessor, OnInit
{
  public readonly label = input<string>();
  public readonly placeholder = input<string>();
  public readonly type = input.required<'country' | 'sector'>();

  public readonly items = signal<AllocationItem[]>([]);
  public readonly separatorKeysCodes: number[] = [COMMA, ENTER];

  public itemControl = new FormControl('');
  public filteredOptions = of<string[]>([]);

  private readonly countryList = Object.entries(countries).map(
    ([code, country]) => ({
      code,
      name: country.name
    })
  );

  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly itemInput =
    viewChild<ElementRef<HTMLInputElement>>('itemInput');

  public constructor() {
    addIcons({ addOutline, closeOutline });
  }

  public ngOnInit() {
    if (this.type() === 'country') {
      this.filteredOptions = this.itemControl.valueChanges.pipe(
        startWith(''),
        map((value: string | null) => this.filterOptions(value || ''))
      );
    }
  }

  public getPlaceholder(): string {
    return (
      this.placeholder() ||
      (this.type() === 'country'
        ? $localize`Add country...`
        : $localize`Add sector...`)
    );
  }

  public onFocus() {
    this.itemControl.setValue(this.itemControl.value || '', {
      emitEvent: true
    });
  }

  public addItem(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();

    if (value) {
      this.resolveAndAddItem(value);
    }

    event.chipInput!.clear();
    this.itemControl.setValue('', { emitEvent: true });
  }

  public onSelected(event: MatAutocompleteSelectedEvent): void {
    const value = event.option.viewValue;

    if (value) {
      this.resolveAndAddItem(value);
      if (this.itemInput()) {
        this.itemInput()!.nativeElement.value = '';
      }
      this.itemControl.setValue('', { emitEvent: true });
    }
  }

  private resolveAndAddItem(value: string) {
    if (this.type() === 'sector') {
      // Check if already exists
      if (this.items().find((i) => i.name === value)) {
        return;
      }

      const newItem: AllocationItem = { name: value, weight: 0 };
      this.items.update((items) => [...items, newItem]);
    } else {
      const country = this.countryList.find(
        (c) =>
          c.name.toLowerCase() === value.toLowerCase() ||
          c.code.toLowerCase() === value.toLowerCase()
      );

      if (country) {
        // Check if already exists
        if (this.items().find((i) => i.code === country.code)) {
          return;
        }

        const newItem: AllocationItem = {
          code: country.code,
          name: country.name,
          weight: 0
        };
        this.items.update((items) => [...items, newItem]);
      }
    }

    this.onChange(this.items());
    this.onTouched();
    this.changeDetectorRef.markForCheck();
  }

  public removeItem(item: AllocationItem): void {
    this.items.update((items) => items.filter((i) => i !== item));
    this.onChange(this.items());
    this.onTouched();
  }

  public updateWeight(item: AllocationItem, weight: number): void {
    item.weight = weight;
    this.onChange(this.items());
    this.onTouched();
  }

  public distributeEvenly(): void {
    const items = this.items();
    if (items.length === 0) return;

    const evenWeight = parseFloat((100 / items.length).toFixed(2));
    items.forEach((item) => (item.weight = evenWeight));

    const total = items.reduce((acc, item) => acc + item.weight, 0);
    if (total !== 100) {
      items[items.length - 1].weight = parseFloat(
        (items[items.length - 1].weight + (100 - total)).toFixed(2)
      );
    }

    this.onChange(this.items());
    this.onTouched();
    this.changeDetectorRef.markForCheck();
  }

  private filterOptions(value: string): string[] {
    const filterValue = value.toLowerCase();
    return this.countryList
      .filter((country) => country.name.toLowerCase().includes(filterValue))
      .map((country) => country.name)
      .slice(0, 10);
  }

  public writeValue(value: AllocationItem[]): void {
    this.items.set(value || []);
    this.changeDetectorRef.markForCheck();
  }

  public registerOnChange(fn: (value: AllocationItem[]) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /* eslint-disable @typescript-eslint/no-empty-function */
  /* eslint-disable @typescript-eslint/no-unused-vars */
  public setDisabledState?(_isDisabled: boolean): void {}

  private onChange = (_value: AllocationItem[]) => {};
  private onTouched = () => {};
  /* eslint-enable @typescript-eslint/no-empty-function */
  /* eslint-enable @typescript-eslint/no-unused-vars */
}
