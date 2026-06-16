import { GfPortfolioPerformanceComponent } from '@ghostfolio/client/components/portfolio-performance/portfolio-performance.component';
import { LayoutService } from '@ghostfolio/client/core/layout.service';
import { ImpersonationStorageService } from '@ghostfolio/client/services/impersonation-storage.service';
import { UserService } from '@ghostfolio/client/services/user/user.service';
import {
  DEFAULT_CURRENCY,
  DEFAULT_DATE_RANGE,
  NUMERICAL_PRECISION_THRESHOLD_6_FIGURES,
  UNKNOWN_KEY
} from '@ghostfolio/common/config';
import { getCountryName } from '@ghostfolio/common/helper';
import {
  AssetProfileIdentifier,
  LineChartItem,
  PortfolioDetails,
  PortfolioPerformance,
  PortfolioPosition,
  PortfolioSummary,
  User
} from '@ghostfolio/common/interfaces';
import { hasPermission, permissions } from '@ghostfolio/common/permissions';
import { internalRoutes } from '@ghostfolio/common/routes/routes';
import { GfLineChartComponent } from '@ghostfolio/ui/line-chart';
import { GfPortfolioProportionChartComponent } from '@ghostfolio/ui/portfolio-proportion-chart';
import { DataService } from '@ghostfolio/ui/services';
import { GfValueComponent } from '@ghostfolio/ui/value';
import { GfWorldMapChartComponent } from '@ghostfolio/ui/world-map-chart';

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { AssetClass, AssetSubClass } from '@prisma/client';
import { addIcons } from 'ionicons';
import { trendingDownOutline, trendingUpOutline } from 'ionicons/icons';
import { DeviceDetectorService } from 'ngx-device-detector';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    GfLineChartComponent,
    GfPortfolioPerformanceComponent,
    GfPortfolioProportionChartComponent,
    GfValueComponent,
    GfWorldMapChartComponent,
    IonIcon,
    MatButtonModule,
    NgxSkeletonLoaderModule,
    RouterModule
  ],
  selector: 'gf-home-overview',
  styleUrls: ['./home-overview.scss'],
  templateUrl: './home-overview.html'
})
export class GfHomeOverviewComponent implements OnInit {
  protected readonly errors = signal<AssetProfileIdentifier[]>([]);
  protected readonly hasImpersonationId = signal(false);
  protected readonly historicalDataItems = signal<LineChartItem[] | null>(null);
  protected readonly isLoadingPerformance = signal(true);
  protected readonly isLoadingDetails = signal(true);
  protected readonly performance = signal<PortfolioPerformance | null>(null);
  protected readonly performanceLabel = $localize`Performance`;
  protected readonly precision = signal(2);
  protected readonly user = signal<User | null>(null);
  protected readonly summary = signal<PortfolioSummary | null>(null);
  protected readonly holdingsMap = signal<Record<string, any>>({});
  protected readonly countriesMap = signal<
    Record<string, { name: string; value: number }>
  >({});

  protected readonly routerLinkAccounts = internalRoutes.accounts.routerLink;
  protected readonly routerLinkPortfolio = internalRoutes.portfolio.routerLink;
  protected readonly routerLinkPortfolioActivities =
    internalRoutes.portfolio.subRoutes.activities.routerLink;

  protected readonly deviceType = computed(
    () => this.deviceDetectorService.deviceInfo().deviceType
  );

  protected readonly hasPermissionToCreateActivity = computed(() => {
    return hasPermission(this.user()?.permissions, permissions.createActivity);
  });

  protected readonly showDetails = computed(() => {
    const user = this.user();
    return user
      ? !user.settings.isRestrictedView && user.settings.viewMode !== 'ZEN'
      : false;
  });

  protected readonly unit = computed(() => {
    return this.showDetails()
      ? (this.user()?.settings?.baseCurrency ?? DEFAULT_CURRENCY)
      : '%';
  });

  protected readonly ytdPercent = computed(() => {
    const perf = this.performance();
    if (!perf) {
      return null;
    }
    return perf.netPerformancePercentageWithCurrencyEffect * 100;
  });

  protected readonly ytdPositive = computed(() => {
    const ytd = this.ytdPercent();
    return ytd !== null && ytd >= 0;
  });

  protected readonly isDarkMode = computed(() => {
    return this.user()?.settings?.colorScheme === 'DARK';
  });

  protected readonly ytdPercentFormatted = computed(() => {
    const ytd = this.ytdPercent();
    if (ytd === null) {
      return '';
    }
    const sign = ytd > 0 ? '+' : ytd < 0 ? '-' : '';
    return `${sign}${Math.abs(ytd).toFixed(1)}%`;
  });

  // Color palette matching GfPortfolioProportionChartComponent order
  private readonly chartPalette = [
    '#339af0',
    '#20c997',
    '#94d82d',
    '#ff922b',
    '#f06595',
    '#9775fa',
    '#5c7cfa',
    '#22b8cf',
    '#51cf66',
    '#fcc419',
    '#ff6b6b',
    '#cc5de8'
  ];

  protected readonly holdingsLegend = computed(() => {
    const holdings = this.holdingsMap();
    const byClass: Record<string, { name: string; value: number }> = {};
    let total = 0;

    for (const item of Object.values(holdings)) {
      const key = (item.assetClass as string) || UNKNOWN_KEY;
      const label = item.assetClassLabel || key;
      if (!byClass[key]) {
        byClass[key] = { name: label, value: 0 };
      }
      byClass[key].value += item.value;
      total += item.value;
    }

    return Object.entries(byClass)
      .sort(([, a], [, b]) => b.value - a.value)
      .map(([key, { name, value }], index) => ({
        key,
        name,
        value,
        color: this.chartPalette[index % this.chartPalette.length],
        pct: total > 0 ? ((value / total) * 100).toFixed(0) : '0'
      }));
  });

  private readonly dataService = inject(DataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly deviceDetectorService = inject(DeviceDetectorService);
  private readonly impersonationStorageService = inject(
    ImpersonationStorageService
  );
  private readonly layoutService = inject(LayoutService);
  private readonly userService = inject(UserService);

  public constructor() {
    addIcons({ trendingDownOutline, trendingUpOutline });

    this.userService.stateChanged
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        if (state?.user) {
          this.user.set(state.user);
          this.update();
        }
      });
  }

  public ngOnInit() {
    this.impersonationStorageService
      .onChangeHasImpersonation()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((impersonationId) => {
        this.hasImpersonationId.set(!!impersonationId);
      });

    this.layoutService.shouldReloadContent$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.update();
      });
  }

  private update() {
    this.historicalDataItems.set(null);
    this.isLoadingPerformance.set(true);
    this.isLoadingDetails.set(true);

    this.dataService
      .fetchPortfolioPerformance({
        range: this.user()?.settings?.dateRange ?? DEFAULT_DATE_RANGE
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ chart, errors, performance }) => {
        this.errors.set(errors ?? []);
        this.performance.set(performance);

        this.historicalDataItems.set(
          chart?.map(
            ({ date, netPerformanceInPercentageWithCurrencyEffect }) => {
              return {
                date,
                value: (netPerformanceInPercentageWithCurrencyEffect ?? 0) * 100
              };
            }
          ) ?? null
        );

        this.precision.set(2);

        if (
          this.deviceType() === 'mobile' &&
          performance.currentValueInBaseCurrency >=
            NUMERICAL_PRECISION_THRESHOLD_6_FIGURES
        ) {
          this.precision.set(0);
        }

        this.isLoadingPerformance.set(false);
      });

    this.dataService
      .fetchPortfolioDetails({
        filters: this.userService.getFilters()
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((portfolioDetails: PortfolioDetails) => {
        if (portfolioDetails.summary) {
          this.summary.set(portfolioDetails.summary);
        }

        this.holdingsMap.set(
          this.buildHoldingsMap(portfolioDetails.holdings ?? {})
        );

        this.countriesMap.set(
          this.buildCountriesMap(portfolioDetails.holdings ?? {})
        );

        this.isLoadingDetails.set(false);
      });
  }

  private buildHoldingsMap(
    holdings: Record<string, PortfolioPosition>
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [symbol, position] of Object.entries(holdings)) {
      result[symbol] = {
        value: position.valueInBaseCurrency ?? 0,
        assetClass:
          position.assetProfile.assetClass || (UNKNOWN_KEY as AssetClass),
        assetClassLabel: position.assetProfile.assetClassLabel || UNKNOWN_KEY,
        assetSubClass:
          position.assetProfile.assetSubClass || (UNKNOWN_KEY as AssetSubClass),
        assetSubClassLabel:
          position.assetProfile.assetSubClassLabel || UNKNOWN_KEY,
        name: position.assetProfile.name
      };
    }

    return result;
  }

  private buildCountriesMap(
    holdings: Record<string, PortfolioPosition>
  ): Record<string, { name: string; value: number }> {
    const result: Record<string, { name: string; value: number }> = {};

    for (const position of Object.values(holdings)) {
      if (!position.assetProfile.countries?.length) {
        continue;
      }

      for (const country of position.assetProfile.countries) {
        const { code, weight } = country;
        const countryValue = weight * (position.valueInBaseCurrency ?? 0);

        if (result[code]) {
          result[code].value += countryValue;
        } else {
          result[code] = {
            name: getCountryName({
              code,
              locale: this.user()?.settings?.locale
            }),
            value: countryValue
          };
        }
      }
    }

    return result;
  }
}
