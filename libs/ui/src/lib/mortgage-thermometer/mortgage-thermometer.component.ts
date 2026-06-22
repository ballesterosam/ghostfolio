import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges
} from '@angular/core';

@Component({
  selector: 'gf-mortgage-thermometer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mortgage-thermometer.component.html',
  styleUrls: ['./mortgage-thermometer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GfMortgageThermometerComponent implements OnChanges {
  @Input() propertyValue = 0;
  @Input() ownershipPercentage = 100;
  @Input() outstandingPrincipal = 0;
  @Input() remainingInterest = 0;
  @Input() currency = 'USD';

  public equityPct = 0;
  public debtPct = 0;
  public otherPct = 0;

  public equityVal = 0;
  public debtVal = 0;
  public otherVal = 0;

  public ngOnChanges(): void {
    const totalVal = this.propertyValue || 0;
    if (totalVal <= 0) {
      this.equityPct = 0;
      this.debtPct = 0;
      this.otherPct = 0;
      return;
    }

    const ownPct = this.ownershipPercentage || 0;
    const debt =
      (this.outstandingPrincipal || 0) + (this.remainingInterest || 0);

    // Other owners' share of the property
    this.otherPct = 100 - ownPct;
    this.otherVal = totalVal * (this.otherPct / 100);

    // Debt share of the property
    this.debtPct = (debt / totalVal) * 100;
    this.debtVal = debt;

    // User's outright owned equity share of the property
    this.equityPct = Math.max(0, ownPct - this.debtPct);
    this.equityVal = totalVal * (this.equityPct / 100);
  }

  public get otherOwnersTitle(): string {
    return $localize`Other owners: ${this.otherPct.toFixed(1)}%`;
  }

  public get debtTitle(): string {
    return $localize`Outstanding mortgage: ${this.debtPct.toFixed(1)}%`;
  }

  public get equityTitle(): string {
    return $localize`My equity: ${this.equityPct.toFixed(1)}%`;
  }
}
