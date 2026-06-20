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
import { getCountryName, getDateFnsLocale } from '@ghostfolio/common/helper';
import {
  AssetProfileIdentifier,
  GoalYear,
  LineChartItem,
  PortfolioDetails,
  PortfolioPerformance,
  PortfolioPosition,
  PortfolioSummary,
  User,
  UserSettings
} from '@ghostfolio/common/interfaces';
import { hasPermission, permissions } from '@ghostfolio/common/permissions';
import { internalRoutes } from '@ghostfolio/common/routes/routes';
import { translate } from '@ghostfolio/ui/i18n';
import { GfLineChartComponent } from '@ghostfolio/ui/line-chart';
import { NotificationService } from '@ghostfolio/ui/notifications';
import { GfPortfolioProportionChartComponent } from '@ghostfolio/ui/portfolio-proportion-chart';
import { DataService } from '@ghostfolio/ui/services';
import { GfValueComponent } from '@ghostfolio/ui/value';
import { GfWorldMapChartComponent } from '@ghostfolio/ui/world-map-chart';

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { AssetClass, AssetSubClass } from '@prisma/client';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  Tooltip
} from 'chart.js';
import { formatDistanceToNow } from 'date-fns';
import { addIcons } from 'ionicons';
import {
  addCircleOutline,
  analyticsOutline,
  briefcaseOutline,
  cashOutline,
  diamondOutline,
  ellipsisHorizontalCircleOutline,
  eyeOffOutline,
  gridOutline,
  informationCircleOutline,
  leafOutline,
  removeCircleOutline,
  shieldCheckmarkOutline,
  statsChartOutline,
  trendingDownOutline,
  trendingUpOutline,
  walletOutline
} from 'ionicons/icons';
import { DeviceDetectorService } from 'ngx-device-detector';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { switchMap } from 'rxjs';

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
    MatTooltipModule,
    NgxSkeletonLoaderModule,
    RouterModule
  ],
  selector: 'gf-home-overview',
  styleUrls: ['./home-overview.scss'],
  templateUrl: './home-overview.html'
})
export class GfHomeOverviewComponent implements OnInit, OnDestroy {
  protected readonly goalDeviationCanvas = viewChild<
    ElementRef<HTMLCanvasElement>
  >('goalDeviationCanvas');

  private goalDeviationChart: Chart<'bar'> | null = null;

  protected readonly errors = signal<AssetProfileIdentifier[]>([]);
  protected readonly hasImpersonationId = signal(false);
  protected readonly historicalDataItems = signal<LineChartItem[] | null>(null);
  protected readonly netWorthHistoricalData = signal<LineChartItem[] | null>(
    null
  );
  protected readonly isLoadingPerformance = signal(true);
  protected readonly isLoadingDetails = signal(true);
  protected readonly performance = signal<PortfolioPerformance | null>(null);
  protected readonly performanceLabel = $localize`Performance`;
  protected readonly netWorthLabel = $localize`Net Worth`;
  protected readonly buyAndSellActivitiesTooltip = translate(
    'BUY_AND_SELL_ACTIVITIES_TOOLTIP'
  );
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

  protected readonly hasPermissionToUpdateUserSettings = computed(() => {
    const user = this.user();

    return user
      ? hasPermission(user.permissions, permissions.updateUserSettings)
      : false;
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

  protected readonly timeInMarket = computed(() => {
    const sum = this.summary();
    const lang = this.user()?.settings?.language;
    if (sum?.dateOfFirstActivity) {
      return formatDistanceToNow(new Date(sum.dateOfFirstActivity), {
        locale: getDateFnsLocale(lang)
      });
    }
    return '-';
  });

  protected readonly buyBarHeight = computed(() => {
    const sum = this.summary();
    if (!sum?.totalBuy && !sum?.totalSell) {
      return 0;
    }
    const max = Math.max(sum.totalBuy || 0, sum.totalSell || 0);
    return max ? ((sum.totalBuy || 0) / max) * 100 : 0;
  });

  protected readonly sellBarHeight = computed(() => {
    const sum = this.summary();
    if (!sum?.totalBuy && !sum?.totalSell) {
      return 0;
    }
    const max = Math.max(sum.totalBuy || 0, sum.totalSell || 0);
    return max ? ((sum.totalSell || 0) / max) * 100 : 0;
  });

  protected readonly buyingPowerPercentage = computed(() => {
    const sum = this.summary();
    return sum?.totalValueInBaseCurrency
      ? sum.cash / sum.totalValueInBaseCurrency
      : 0;
  });

  protected readonly emergencyFundPercentage = computed(() => {
    const sum = this.summary();
    return sum?.totalValueInBaseCurrency
      ? (sum.emergencyFund?.total || 0) / sum.totalValueInBaseCurrency
      : 0;
  });

  protected readonly excludedFromAnalysisPercentage = computed(() => {
    const sum = this.summary();
    return sum?.totalValueInBaseCurrency
      ? sum.excludedAccountsAndActivities / sum.totalValueInBaseCurrency
      : 0;
  });

  protected readonly totalInvestedInFunds = computed(() => {
    return Object.values(this.holdingsMap())
      .filter(
        (h) =>
          h.assetSubClass === AssetSubClass.MUTUALFUND ||
          h.assetSubClass === AssetSubClass.ETF
      )
      .reduce((sum, h) => sum + (h.value || 0), 0);
  });

  protected readonly totalInvestedInStocks = computed(() => {
    return Object.values(this.holdingsMap())
      .filter((h) => h.assetSubClass === AssetSubClass.STOCK)
      .reduce((sum, h) => sum + (h.value || 0), 0);
  });

  protected readonly totalInvestedInCrypto = computed(() => {
    return Object.values(this.holdingsMap())
      .filter((h) => h.assetSubClass === AssetSubClass.CRYPTOCURRENCY)
      .reduce((sum, h) => sum + (h.value || 0), 0);
  });

  protected readonly totalInvestedInOthers = computed(() => {
    const mainSubClasses = new Set<string>([
      AssetSubClass.MUTUALFUND,
      AssetSubClass.ETF,
      AssetSubClass.STOCK,
      AssetSubClass.CRYPTOCURRENCY
    ]);
    return Object.values(this.holdingsMap())
      .filter((h) => !mainSubClasses.has(h.assetSubClass))
      .reduce((sum, h) => sum + (h.value || 0), 0);
  });

  protected readonly hasGoals = computed(() => {
    const goals = (this.user()?.settings as UserSettings)?.goals;
    return Array.isArray(goals) && goals.length > 0;
  });

  protected readonly yoyNetWorthPercent = computed(() => {
    const data = this.netWorthHistoricalData();
    if (!data || data.length < 2) {
      return null;
    }

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoStr = oneYearAgo.toISOString().slice(0, 10);

    let yearAgoItem = data[0];
    for (const item of data) {
      if (item.date <= oneYearAgoStr) {
        yearAgoItem = item;
      }
    }

    const currentItem = data[data.length - 1];
    if (!yearAgoItem?.value || !currentItem?.value) {
      return null;
    }

    return ((currentItem.value - yearAgoItem.value) / yearAgoItem.value) * 100;
  });

  protected readonly yoyPositive = computed(() => {
    const yoy = this.yoyNetWorthPercent();
    return yoy !== null && yoy >= 0;
  });

  protected readonly yoyFormatted = computed(() => {
    const yoy = this.yoyNetWorthPercent();
    if (yoy === null) {
      return '';
    }
    const sign = yoy > 0 ? '+' : yoy < 0 ? '-' : '';
    return `${sign}${Math.abs(yoy).toFixed(1)}%`;
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

  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly dataService = inject(DataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly deviceDetectorService = inject(DeviceDetectorService);
  private readonly impersonationStorageService = inject(
    ImpersonationStorageService
  );
  private readonly layoutService = inject(LayoutService);
  private readonly notificationService = inject(NotificationService);
  private readonly userService = inject(UserService);

  public constructor() {
    Chart.register(
      BarController,
      BarElement,
      CategoryScale,
      LinearScale,
      Tooltip
    );

    addIcons({
      addCircleOutline,
      analyticsOutline,
      briefcaseOutline,
      cashOutline,
      diamondOutline,
      ellipsisHorizontalCircleOutline,
      eyeOffOutline,
      gridOutline,
      informationCircleOutline,
      leafOutline,
      removeCircleOutline,
      shieldCheckmarkOutline,
      statsChartOutline,
      trendingDownOutline,
      trendingUpOutline,
      walletOutline
    });

    this.userService.stateChanged
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        if (state?.user) {
          this.user.set(state.user);
          this.update();
        }
      });
  }

  public ngOnDestroy() {
    this.goalDeviationChart?.destroy();
  }

  protected onChangeEmergencyFund(emergencyFund: number) {
    this.dataService
      .putUserSetting({ emergencyFund })
      .pipe(
        switchMap(() => this.userService.get(true)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((user) => {
        this.user.set(user);
        this.update();
      });
  }

  public onEditEmergencyFund() {
    this.notificationService.prompt({
      confirmFn: (value) => {
        const emergencyFund = parseFloat(value.trim()) || 0;

        this.onChangeEmergencyFund(emergencyFund);
      },
      confirmLabel: $localize`Save`,
      defaultValue: this.summary()?.emergencyFund?.total?.toString() ?? '0',
      title: $localize`Please set the amount of your emergency fund.`
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
    this.netWorthHistoricalData.set(null);
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

        this.netWorthHistoricalData.set(
          chart
            ?.map(
              ({
                date,
                netWorth,
                totalAccountBalance,
                totalInvestmentValueWithCurrencyEffect
              }) => ({
                date,
                value:
                  netWorth ??
                  (totalInvestmentValueWithCurrencyEffect ?? 0) +
                    (totalAccountBalance ?? 0)
              })
            )
            .filter((item) => item.value > 0) ?? null
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

        setTimeout(() => {
          this.renderGoalDeviationChart();
          this.changeDetectorRef.markForCheck();
        }, 0);
      });

    this.dataService
      .fetchPortfolioDetails({
        filters: this.userService.getFilters(),
        range: this.user()?.settings?.dateRange ?? DEFAULT_DATE_RANGE
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

  private renderGoalDeviationChart() {
    const canvas = this.goalDeviationCanvas()?.nativeElement;
    const goals: GoalYear[] =
      (this.user()?.settings as UserSettings)?.goals ?? [];

    if (!canvas || goals.length === 0) {
      return;
    }

    const netWorthData = this.netWorthHistoricalData() ?? [];
    const yearMap: Record<number, number> = {};
    for (const item of netWorthData) {
      yearMap[new Date(item.date).getFullYear()] = item.value;
    }

    const currentYear = new Date().getFullYear();
    const currentNetWorth = netWorthData[netWorthData.length - 1]?.value ?? 0;

    const rows = goals
      .slice()
      .sort((a, b) => a.year - b.year)
      .map((goal) => {
        const actual =
          goal.year < currentYear
            ? (yearMap[goal.year] ?? null)
            : currentNetWorth;
        const pct =
          actual != null && goal.targetAmount > 0
            ? ((actual - goal.targetAmount) / goal.targetAmount) * 100
            : null;
        return { year: goal.year, pct };
      });

    const isDark =
      document.documentElement.classList.contains('theme-dark') ||
      document.body.classList.contains('theme-dark');
    const textColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

    const labels = rows.map((r) => String(r.year));
    const pctData = rows.map((r) => r.pct ?? 0);
    const barColors = pctData.map((v) =>
      v >= 0 ? 'rgba(34, 197, 94, 0.85)' : 'rgba(239, 68, 68, 0.85)'
    );

    this.goalDeviationChart?.destroy();

    this.goalDeviationChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: $localize`Goal deviation`,
            data: pctData,
            backgroundColor: barColors,
            borderColor: barColors.map((c) => c.replace('0.85', '1')),
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.raw as number;
                return ` ${val > 0 ? '+' : ''}${val.toFixed(1)}%`;
              }
            }
          }
        },
        scales: {
          x: { ticks: { color: textColor }, grid: { color: gridColor } },
          y: {
            ticks: { color: textColor, callback: (v) => `${v}%` },
            grid: { color: gridColor }
          }
        }
      }
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
