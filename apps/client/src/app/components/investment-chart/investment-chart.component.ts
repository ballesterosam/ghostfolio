import {
  getTooltipOptions,
  getVerticalHoverLinePlugin,
  transformTickToAbbreviation
} from '@ghostfolio/common/chart-helper';
import { secondaryColorRgb } from '@ghostfolio/common/config';
import {
  getBackgroundColor,
  getDateFormatString,
  getLocale,
  parseDate
} from '@ghostfolio/common/helper';
import { LineChartItem } from '@ghostfolio/common/interfaces';
import { InvestmentItem } from '@ghostfolio/common/interfaces/investment-item.interface';
import { ColorScheme, GroupBy } from '@ghostfolio/common/types';
import { registerChartConfiguration } from '@ghostfolio/ui/chart';

import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  viewChild
} from '@angular/core';
import {
  BarController,
  BarElement,
  Chart,
  ChartData,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  type ScriptableLineSegmentContext,
  TimeScale,
  Tooltip,
  type TooltipOptions
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import annotationPlugin, {
  type AnnotationOptions
} from 'chartjs-plugin-annotation';
import { isAfter } from 'date-fns';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxSkeletonLoaderModule],
  selector: 'gf-investment-chart',
  styleUrls: ['./investment-chart.component.scss'],
  templateUrl: './investment-chart.component.html'
})
export class GfInvestmentChartComponent implements OnChanges, OnDestroy {
  @Input() public readonly benchmarkDataItems: InvestmentItem[] = [];
  @Input() public readonly benchmarkDataLabel = '';
  @Input() public readonly colorScheme: ColorScheme;
  @Input() public readonly currency: string;
  @Input() public readonly groupBy: GroupBy;
  @Input() public readonly historicalDataItems: LineChartItem[] = [];
  @Input() public readonly isInPercentage = false;
  @Input() public readonly isLoading = false;
  @Input() public readonly locale = getLocale();
  @Input() public readonly savingsRate = 0;
  @Input() public readonly showGradient = true;

  private readonly chartCanvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');

  private chart: Chart<'bar' | 'line'>;
  private investments: InvestmentItem[];
  private values: LineChartItem[];

  public constructor() {
    Chart.register(
      annotationPlugin,
      BarController,
      BarElement,
      LinearScale,
      LineController,
      LineElement,
      PointElement,
      TimeScale,
      Tooltip
    );

    registerChartConfiguration();
  }

  public ngOnChanges() {
    if (this.benchmarkDataItems && this.historicalDataItems) {
      this.initialize();
    }
  }

  public ngOnDestroy() {
    this.chart?.destroy();
  }

  private initialize() {
    // Create a clone
    this.investments = this.benchmarkDataItems.map((item) =>
      Object.assign({}, item)
    );
    this.values = this.historicalDataItems.map((item) =>
      Object.assign({}, item)
    );

    const chartData: ChartData<'bar' | 'line'> = {
      labels: this.historicalDataItems.map(({ date }) => {
        return parseDate(date);
      }),
      datasets: [
        {
          backgroundColor: (context) => {
            if (this.groupBy) {
              // Vibrant color for bars in Timeline charts
              return 'rgba(255, 255, 255, 0.7)';
            }
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return undefined;
            const gradient = ctx.createLinearGradient(
              0,
              chartArea.top,
              0,
              chartArea.bottom
            );
            // Alternative color: Slate gray-blue for secondary line
            gradient.addColorStop(0, 'rgba(148, 163, 184, 0.3)');
            gradient.addColorStop(1, 'rgba(148, 163, 184, 0)');
            return gradient;
          },
          borderColor: this.groupBy
            ? 'rgba(255, 255, 255, 0.9)'
            : 'rgb(148, 163, 184)',
          borderWidth: this.groupBy ? 0 : 3, // Thicker line
          data: this.investments.map(({ date, investment }) => {
            return {
              x: parseDate(date)?.getTime() ?? null,
              y: this.isInPercentage ? investment * 100 : investment
            };
          }),
          fill: this.showGradient && !this.groupBy ? 'origin' : false,
          label: this.benchmarkDataLabel,
          segment: {
            borderColor: (context) =>
              this.isInFuture(context, 'rgba(148, 163, 184, 0.67)'),
            borderDash: (context) => this.isInFuture(context, [2, 2])
          },
          stepped: true
        },
        {
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return undefined;
            const gradient = ctx.createLinearGradient(
              0,
              chartArea.top,
              0,
              chartArea.bottom
            );
            gradient.addColorStop(0, 'rgba(147, 197, 253, 0.5)');
            gradient.addColorStop(1, 'rgba(147, 197, 253, 0)');
            return gradient;
          },
          borderColor: 'rgb(147, 197, 253)',
          borderWidth: 3, // Thicker line
          data: this.values.map(({ date, value }) => {
            return {
              x: parseDate(date)?.getTime() ?? null,
              y: this.isInPercentage ? value * 100 : value
            };
          }),
          fill: this.showGradient && !this.groupBy ? 'origin' : false,
          label: $localize`Total Amount`,
          pointRadius: 0,
          segment: {
            borderColor: (context) =>
              this.isInFuture(context, 'rgba(147, 197, 253, 0.67)'),
            borderDash: (context) => this.isInFuture(context, [2, 2])
          }
        }
      ]
    };

    if (this.chartCanvas) {
      const chartType = this.groupBy ? 'bar' : 'line';

      if (this.chart && (this.chart.config as any).type === chartType) {
        this.chart.data = chartData;
        this.chart.options.plugins ??= {};
        this.chart.options.plugins.tooltip =
          this.getTooltipPluginConfiguration();

        const annotations = this.chart.options.plugins.annotation
          ?.annotations as Record<string, AnnotationOptions<'line'>>;
        if (this.savingsRate && annotations.savingsRate) {
          annotations.savingsRate.value = this.savingsRate;
        }

        this.chart.update();
      } else {
        this.chart?.destroy();

        this.chart = new Chart<'bar' | 'line'>(
          this.chartCanvas().nativeElement,
          {
            data: chartData,
            options: {
              animation: false,
              elements: {
                line: {
                  tension: 0.1
                },
                point: {
                  hoverBackgroundColor: getBackgroundColor(this.colorScheme),
                  hoverRadius: 5,
                  radius: 0
                }
              },
              interaction: { intersect: false, mode: 'index' },
              maintainAspectRatio: false,
              plugins: {
                annotation: {
                  annotations: {
                    savingsRate: this.savingsRate
                      ? {
                          borderColor: `rgba(${secondaryColorRgb.r}, ${secondaryColorRgb.g}, ${secondaryColorRgb.b}, 0.75)`,
                          borderWidth: 1,
                          label: {
                            backgroundColor: `rgb(${secondaryColorRgb.r}, ${secondaryColorRgb.g}, ${secondaryColorRgb.b})`,
                            borderRadius: 2,
                            color: 'white',
                            content: $localize`Savings Rate`,
                            display: true,
                            font: { size: 10, weight: 'normal' },
                            padding: {
                              x: 4,
                              y: 2
                            },
                            position: 'start'
                          },
                          scaleID: 'y',
                          type: 'line',
                          value: this.savingsRate
                        }
                      : undefined,
                    yAxis: {
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                      borderWidth: 1,
                      scaleID: 'y',
                      type: 'line',
                      value: 0
                    }
                  }
                },
                legend: {
                  display: false
                },
                tooltip: this.getTooltipPluginConfiguration(),
                verticalHoverLine: {
                  color: 'rgba(255, 255, 255, 0.3)'
                }
              },
              responsive: true,
              scales: {
                x: {
                  border: {
                    color: 'rgba(255, 255, 255, 0.3)',
                    width: chartType === 'bar' ? 0 : 1
                  },
                  display: true,
                  grid: {
                    display: false
                  },
                  ticks: {
                    color: 'rgba(255, 255, 255, 0.7)',
                    font: {
                      size: 11
                    }
                  },
                  type: 'time',
                  time: {
                    tooltipFormat: getDateFormatString(this.locale),
                    unit: 'year'
                  }
                },
                y: {
                  border: {
                    display: false
                  },
                  display: true,
                  grid: {
                    color: () => {
                      return 'rgba(255, 255, 255, 0.2)';
                    }
                  },
                  position: 'right',
                  ticks: {
                    callback: (value: number) => {
                      return transformTickToAbbreviation(value);
                    },
                    color: 'rgba(255, 255, 255, 0.7)',
                    display: true,
                    font: {
                      size: 11
                    },
                    mirror: true,
                    z: 1
                  }
                }
              }
            },
            plugins: [
              getVerticalHoverLinePlugin(this.chartCanvas(), this.colorScheme)
            ],
            type: chartType
          }
        );
      }
    }
  }

  private getTooltipPluginConfiguration(): Partial<
    TooltipOptions<'bar' | 'line'>
  > {
    return {
      ...getTooltipOptions({
        colorScheme: this.colorScheme,
        currency: this.isInPercentage ? undefined : this.currency,
        groupBy: this.groupBy,
        locale: this.isInPercentage ? undefined : this.locale,
        unit: this.isInPercentage ? '%' : undefined
      }),
      mode: 'index',
      position: 'top',
      xAlign: 'center',
      yAlign: 'bottom'
    };
  }

  private isInFuture<T>(aContext: ScriptableLineSegmentContext, aValue: T) {
    const xValue = aContext?.p1?.parsed?.x;

    if (xValue == null) {
      return undefined;
    }

    return isAfter(new Date(xValue), new Date()) ? aValue : undefined;
  }
}
