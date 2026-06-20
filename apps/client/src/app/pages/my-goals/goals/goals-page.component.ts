import { UserService } from '@ghostfolio/client/services/user/user.service';
import { getLocale } from '@ghostfolio/common/helper';
import { GoalYear, User } from '@ghostfolio/common/interfaces';
import { UserSettings } from '@ghostfolio/common/interfaces/user-settings.interface';
import { DataService } from '@ghostfolio/ui/services';

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IonIcon } from '@ionic/angular/standalone';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  Tooltip
} from 'chart.js';
import { addIcons } from 'ionicons';
import {
  addOutline,
  createOutline,
  flagOutline,
  removeCircleOutline,
  saveOutline
} from 'ionicons/icons';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

interface GoalTableRow {
  actual: number | null;
  pct: number | null;
  status: 'ahead' | 'on-track' | 'behind' | 'unknown';
  target: number;
  year: number;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IonIcon,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    NgxSkeletonLoaderModule
  ],
  selector: 'gf-goals-page',
  styleUrls: ['./goals-page.scss'],
  templateUrl: './goals-page.html'
})
export class GfGoalsPageComponent implements OnInit, OnDestroy {
  protected readonly isLoading = signal(true);
  protected readonly isEditMode = signal(false);
  protected readonly tableRows = signal<GoalTableRow[]>([]);
  protected readonly editGoals = signal<GoalYear[]>([]);
  protected readonly currency = signal('');
  protected readonly locale = signal(getLocale());

  private readonly deviationChartCanvas = viewChild<
    ElementRef<HTMLCanvasElement>
  >('deviationChartCanvas');
  private readonly comparisonChartCanvas = viewChild<
    ElementRef<HTMLCanvasElement>
  >('comparisonChartCanvas');

  private deviationChart: Chart<'bar'> | null = null;
  private comparisonChart: Chart<'bar'> | null = null;
  private user: User | null = null;

  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly dataService = inject(DataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly userService = inject(UserService);

  public constructor() {
    Chart.register(
      BarController,
      BarElement,
      CategoryScale,
      Legend,
      LinearScale,
      Tooltip
    );

    addIcons({
      addOutline,
      createOutline,
      flagOutline,
      removeCircleOutline,
      saveOutline
    });
  }

  public ngOnInit() {
    this.userService.stateChanged
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        if (state?.user) {
          this.user = state.user;
          this.currency.set(
            (state.user.settings as UserSettings)?.baseCurrency ?? ''
          );
          this.locale.set(
            (state.user.settings as UserSettings)?.locale ?? getLocale()
          );
          this.loadData();
        }
      });
  }

  public ngOnDestroy() {
    this.deviationChart?.destroy();
    this.comparisonChart?.destroy();
  }

  protected get hasGoals(): boolean {
    return ((this.user?.settings as UserSettings)?.goals ?? []).length > 0;
  }

  protected onStartEdit() {
    const currentGoals = (this.user?.settings as UserSettings)?.goals ?? [];
    this.editGoals.set(currentGoals.map((g) => ({ ...g })));
    this.isEditMode.set(true);
  }

  protected onCancelEdit() {
    this.isEditMode.set(false);
  }

  protected onAddRow() {
    const goals = this.editGoals();
    const lastYear =
      goals.length > 0
        ? Math.max(...goals.map((g) => g.year))
        : new Date().getFullYear() - 1;
    this.editGoals.set([...goals, { year: lastYear + 1, targetAmount: 0 }]);
  }

  protected onRemoveRow(index: number) {
    const goals = [...this.editGoals()];
    goals.splice(index, 1);
    this.editGoals.set(goals);
  }

  protected onSaveGoals() {
    const goals = this.editGoals()
      .filter((g) => g.year > 0 && g.targetAmount > 0)
      .sort((a, b) => a.year - b.year);

    this.dataService
      .putUserSetting({ goals })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.userService
          .get(true)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((user) => {
            this.user = user;
            this.isEditMode.set(false);
            this.loadData();
            this.changeDetectorRef.markForCheck();
          });
      });
  }

  protected formatCurrency(value: number | null): string {
    if (value == null) return '–';
    return new Intl.NumberFormat(this.locale(), {
      currency: this.currency() || 'EUR',
      maximumFractionDigits: 0,
      style: 'currency'
    }).format(value);
  }

  protected formatPct(pct: number | null): string {
    if (pct == null) return '–';
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
  }

  private loadData() {
    const goals: GoalYear[] =
      (this.user?.settings as UserSettings)?.goals ?? [];

    if (goals.length === 0) {
      this.tableRows.set([]);
      this.isLoading.set(false);
      this.deviationChart?.destroy();
      this.deviationChart = null;
      this.comparisonChart?.destroy();
      this.comparisonChart = null;
      return;
    }

    this.isLoading.set(true);

    this.dataService
      .fetchPortfolioPerformance({ range: 'max' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ chart }) => {
        const yearNetWorth = this.buildYearNetWorthMap(chart ?? []);
        const currentNetWorth =
          chart && chart.length > 0
            ? (chart[chart.length - 1].netWorth ??
              (chart[chart.length - 1].totalInvestmentValueWithCurrencyEffect ??
                0) + (chart[chart.length - 1].totalAccountBalance ?? 0))
            : 0;

        const currentYear = new Date().getFullYear();

        const rows: GoalTableRow[] = goals
          .map((goal) => {
            const actual =
              goal.year < currentYear
                ? (yearNetWorth[goal.year] ?? null)
                : currentNetWorth;

            const pct =
              actual != null && goal.targetAmount > 0
                ? ((actual - goal.targetAmount) / goal.targetAmount) * 100
                : null;

            const status: GoalTableRow['status'] =
              pct == null
                ? 'unknown'
                : pct >= 0
                  ? 'ahead'
                  : pct >= -10
                    ? 'on-track'
                    : 'behind';

            return {
              year: goal.year,
              target: goal.targetAmount,
              actual,
              pct,
              status
            };
          })
          .sort((a, b) => a.year - b.year);

        this.tableRows.set(rows);
        this.isLoading.set(false);
        this.changeDetectorRef.markForCheck();

        setTimeout(() => {
          this.renderDeviationChart(rows);
          this.renderComparisonChart(rows);
        }, 0);
      });
  }

  private buildYearNetWorthMap(
    chart: {
      date: string;
      netWorth?: number;
      totalInvestmentValueWithCurrencyEffect?: number;
      totalAccountBalance?: number;
    }[]
  ): Record<number, number> {
    const map: Record<number, number> = {};
    for (const item of chart) {
      const year = new Date(item.date).getFullYear();
      map[year] =
        item.netWorth ??
        (item.totalInvestmentValueWithCurrencyEffect ?? 0) +
          (item.totalAccountBalance ?? 0);
    }
    return map;
  }

  private getChartColors(isDark: boolean) {
    return {
      text: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
      grid: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      zeroline: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'
    };
  }

  private isDarkMode(): boolean {
    return (
      document.documentElement.classList.contains('theme-dark') ||
      document.body.classList.contains('theme-dark')
    );
  }

  /** Chart 1: single bar per year showing % deviation from goal, 0 centered */
  private renderDeviationChart(rows: GoalTableRow[]) {
    const canvas = this.deviationChartCanvas()?.nativeElement;
    if (!canvas || rows.length === 0) return;

    this.deviationChart?.destroy();

    const isDark = this.isDarkMode();
    const colors = this.getChartColors(isDark);
    const labels = rows.map((r) => String(r.year));
    const pctData = rows.map((r) => r.pct ?? 0);
    const barColors = pctData.map((v) =>
      v >= 0 ? 'rgba(34, 197, 94, 0.85)' : 'rgba(239, 68, 68, 0.85)'
    );

    this.deviationChart = new Chart(canvas, {
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
            borderRadius: 3
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
                const sign = val > 0 ? '+' : '';
                return ` ${sign}${val.toFixed(1)}%`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: colors.text },
            grid: { color: colors.grid }
          },
          y: {
            ticks: {
              color: colors.text,
              callback: (val) => `${val}%`
            },
            grid: { color: colors.grid },
            border: { color: colors.zeroline }
          }
        }
      }
    });
  }

  /** Chart 2: grouped bars showing goal vs actual wealth */
  private renderComparisonChart(rows: GoalTableRow[]) {
    const canvas = this.comparisonChartCanvas()?.nativeElement;
    if (!canvas || rows.length === 0) return;

    this.comparisonChart?.destroy();

    const isDark = this.isDarkMode();
    const colors = this.getChartColors(isDark);
    const currency = this.currency() || 'EUR';
    const locale = this.locale();

    const labels = rows.map((r) => String(r.year));
    const targetData = rows.map((r) => r.target);
    const actualData = rows.map((r) => r.actual ?? 0);
    const actualColors = rows.map((r) =>
      r.status === 'ahead'
        ? 'rgba(34, 197, 94, 0.8)'
        : r.status === 'on-track'
          ? 'rgba(234, 179, 8, 0.8)'
          : 'rgba(239, 68, 68, 0.8)'
    );

    this.comparisonChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: $localize`Target`,
            data: targetData,
            backgroundColor: 'rgba(148, 163, 184, 0.6)',
            borderColor: 'rgba(148, 163, 184, 1)',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: $localize`Actual`,
            data: actualData,
            backgroundColor: actualColors,
            borderColor: actualColors.map((c) => c.replace('0.8', '1')),
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: colors.text }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.raw as number;
                return ` ${new Intl.NumberFormat(locale, {
                  currency,
                  maximumFractionDigits: 0,
                  style: 'currency'
                }).format(val)}`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: colors.text },
            grid: { color: colors.grid }
          },
          y: {
            ticks: {
              color: colors.text,
              callback: (val) =>
                new Intl.NumberFormat(locale, {
                  currency,
                  maximumFractionDigits: 0,
                  notation: 'compact',
                  style: 'currency'
                }).format(val as number)
            },
            grid: { color: colors.grid }
          }
        }
      }
    });
  }
}
