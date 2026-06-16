import { NUMERICAL_PRECISION_THRESHOLD_6_FIGURES } from '@ghostfolio/common/config';
import { getDateFnsLocale, getLocale } from '@ghostfolio/common/helper';
import { LineChartItem, PortfolioSummary, User } from '@ghostfolio/common/interfaces';
import { translate } from '@ghostfolio/ui/i18n';
import { GfLineChartComponent } from '@ghostfolio/ui/line-chart';
import { NotificationService } from '@ghostfolio/ui/notifications';
import { GfValueComponent } from '@ghostfolio/ui/value';

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output
} from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IonIcon } from '@ionic/angular/standalone';
import { formatDistanceToNow } from 'date-fns';
import { addIcons } from 'ionicons';
import {
  addCircleOutline,
  ellipsisHorizontalCircleOutline,
  informationCircleOutline,
  removeCircleOutline,
  walletOutline
} from 'ionicons/icons';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GfValueComponent, IonIcon, MatTooltipModule, GfLineChartComponent],
  selector: 'gf-portfolio-summary',
  styleUrls: ['./portfolio-summary.component.scss'],
  templateUrl: './portfolio-summary.component.html'
})
export class GfPortfolioSummaryComponent implements OnChanges {
  @Input() baseCurrency: string;
  @Input() deviceType: string;
  @Input() hasImpersonationId: boolean;
  @Input() hasPermissionToUpdateUserSettings: boolean;
  @Input() isLoading: boolean;
  @Input() language: string;
  @Input() locale = getLocale();
  @Input() summary: PortfolioSummary;
  @Input() user: User;
  @Input() historicalDataItems: LineChartItem[] | null = null;

  @Output() emergencyFundChanged = new EventEmitter<number>();

  public buyAndSellActivitiesTooltip = translate(
    'BUY_AND_SELL_ACTIVITIES_TOOLTIP'
  );

  public precision = 2;
  public timeInMarket: string;

  public get buyingPowerPercentage() {
    return this.summary?.totalValueInBaseCurrency
      ? this.summary.cash / this.summary.totalValueInBaseCurrency
      : 0;
  }

  public get emergencyFundPercentage() {
    return this.summary?.totalValueInBaseCurrency
      ? (this.summary.emergencyFund?.total || 0) /
          this.summary.totalValueInBaseCurrency
      : 0;
  }

  public get excludedFromAnalysisPercentage() {
    return this.summary?.totalValueInBaseCurrency
      ? this.summary.excludedAccountsAndActivities /
          this.summary.totalValueInBaseCurrency
      : 0;
  }

  public get buyBarHeight(): number {
    if (!this.summary?.totalBuy && !this.summary?.totalSell) {
      return 0;
    }
    const max = Math.max(this.summary.totalBuy || 0, this.summary.totalSell || 0);
    return max ? ((this.summary.totalBuy || 0) / max) * 100 : 0;
  }

  public get sellBarHeight(): number {
    if (!this.summary?.totalBuy && !this.summary?.totalSell) {
      return 0;
    }
    const max = Math.max(this.summary.totalBuy || 0, this.summary.totalSell || 0);
    return max ? ((this.summary.totalSell || 0) / max) * 100 : 0;
  }

  public get grossPerformanceProgressWidth(): number {
    if (!this.summary?.totalInvestmentValueWithCurrencyEffect) {
      return 0;
    }
    const gross = this.summary.grossPerformanceWithCurrencyEffect || 0;
    const total = this.summary.totalInvestmentValueWithCurrencyEffect || 1;
    const ratio = Math.abs(gross / total) * 100;
    return Math.min(ratio, 100);
  }

  public get grossPerformancePositive(): boolean {
    return (this.summary?.grossPerformanceWithCurrencyEffect ?? 0) >= 0;
  }

  public get annualizedPerformanceProgressWidth(): number {
    const value = Math.abs(this.summary?.annualizedPerformancePercentWithCurrencyEffect ?? 0) * 100;
    return Math.min(value, 100);
  }

  public get annualizedPerformancePositive(): boolean {
    return (this.summary?.annualizedPerformancePercentWithCurrencyEffect ?? 0) >= 0;
  }

  public get dateRangeText(): string {
    const dateRange = this.user?.settings?.dateRange ?? 'max';
    const firstActivity = this.summary?.dateOfFirstActivity ? new Date(this.summary.dateOfFirstActivity) : null;
    let startDate: Date | null = null;
    let endDate = new Date();

    if (/^\d{4}$/.test(dateRange)) {
      const year = parseInt(dateRange, 10);
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
    } else if (dateRange === 'ytd') {
      startDate = new Date(new Date().getFullYear(), 0, 1);
    } else if (dateRange === '1d') {
      startDate = new Date();
    } else if (dateRange === 'wtd') {
      const today = new Date();
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(today.setDate(diff));
    } else if (dateRange === 'mtd') {
      startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    } else if (dateRange === '1y') {
      startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);
    } else if (dateRange === '5y') {
      startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 5);
    } else if (dateRange === 'max' && firstActivity) {
      startDate = firstActivity;
    }

    if (startDate) {
      const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
      const startStr = startDate.toLocaleDateString(this.locale, options);
      const endStr = endDate.toLocaleDateString(this.locale, options);
      return $localize`from ${startStr} to ${endStr}`;
    }

    return '';
  }

  public constructor(private notificationService: NotificationService) {
    addIcons({
      addCircleOutline,
      ellipsisHorizontalCircleOutline,
      informationCircleOutline,
      removeCircleOutline,
      walletOutline
    });
  }

  public ngOnChanges() {
    if (this.summary) {
      if (
        this.deviceType === 'mobile' &&
        this.summary.totalValueInBaseCurrency >=
          NUMERICAL_PRECISION_THRESHOLD_6_FIGURES
      ) {
        this.precision = 0;
      }

      if (this.summary.dateOfFirstActivity) {
        this.timeInMarket = formatDistanceToNow(
          this.summary.dateOfFirstActivity,
          {
            locale: getDateFnsLocale(this.language)
          }
        );
      } else {
        this.timeInMarket = '-';
      }
    } else {
      this.timeInMarket = undefined;
    }
  }

  public onEditEmergencyFund() {
    this.notificationService.prompt({
      confirmFn: (value) => {
        const emergencyFund = parseFloat(value.trim()) || 0;

        this.emergencyFundChanged.emit(emergencyFund);
      },
      confirmLabel: $localize`Save`,
      defaultValue: this.summary.emergencyFund?.total?.toString() ?? '0',
      title: $localize`Please set the amount of your emergency fund.`
    });
  }
}
