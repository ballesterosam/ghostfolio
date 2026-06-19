import { getTooltipOptions } from '@ghostfolio/common/chart-helper';
import { UNKNOWN_KEY } from '@ghostfolio/common/config';
import { getLocale, getSum, getTextColor } from '@ghostfolio/common/helper';
import {
  AssetProfileIdentifier,
  PortfolioPosition
} from '@ghostfolio/common/interfaces';
import { ColorScheme } from '@ghostfolio/common/types';

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  output,
  viewChild
} from '@angular/core';
import { DataSource } from '@prisma/client';
import { Big } from 'big.js';
import {
  ArcElement,
  Chart,
  type ChartData,
  type ChartDataset,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip,
  type TooltipOptions
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { isUUID } from 'class-validator';
import Color from 'color';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import OpenColor from 'open-color';

const {
  blue,
  cyan,
  grape,
  green,
  indigo,
  lime,
  orange,
  pink,
  red,
  teal,
  violet,
  yellow
} = OpenColor;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.has-legend]': 'showLegend'
  },
  imports: [NgxSkeletonLoaderModule],
  selector: 'gf-portfolio-proportion-chart',
  styleUrls: ['./portfolio-proportion-chart.component.scss'],
  templateUrl: './portfolio-proportion-chart.component.html'
})
export class GfPortfolioProportionChartComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input() baseCurrency: string;
  @Input() colorScheme: ColorScheme;
  @Input() cursor: string;
  @Input() data: {
    [symbol: string]: Pick<PortfolioPosition, 'type'> & {
      dataSource?: DataSource;
      name: string;
      value: number;
    };
  } = {};
  @Input() isInPercentage = false;
  @Input() keys: string[] = [];
  @Input() locale = getLocale();
  @Input() maxItems?: number;
  @Input() glow = false;
  @Input() hollow = false;
  @Input() separateSegments = false;
  @Input() showLabels = false;
  @Input() showLegend = false;

  public chart: Chart<'doughnut'>;
  public isLoading = true;
  public legendItems: {
    color: string;
    name: string;
    displayValue: string;
  }[] = [];
  private sortedKeys: string[] = [];

  protected readonly proportionChartClicked = output<AssetProfileIdentifier>();

  private readonly OTHER_KEY = 'OTHER';

  private readonly chartCanvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');

  private colorMap: {
    [symbol: string]: string;
  } = {};

  public constructor() {
    Chart.register(
      ArcElement,
      DoughnutController,
      Legend,
      LinearScale,
      Tooltip
    );
  }

  public ngAfterViewInit() {
    if (this.data) {
      this.initialize();
    }
  }

  public ngOnChanges() {
    if (this.data) {
      this.initialize();
    }
  }

  public ngOnDestroy() {
    this.chart?.destroy();
  }

  private initialize() {
    this.isLoading = true;
    const chartData: {
      [symbol: string]: {
        color?: string;
        name: string;
        subCategory?: { [symbol: string]: { value: Big } };
        value: Big;
      };
    } = {};
    this.colorMap = {
      [this.OTHER_KEY]: `rgba(${getTextColor(this.colorScheme)}, 0.24)`,
      [UNKNOWN_KEY]: `rgba(${getTextColor(this.colorScheme)}, 0.12)`
    };

    if (this.keys.length > 0) {
      const primaryKey = this.keys[0];
      const secondaryKey = this.keys[1];

      Object.keys(this.data).forEach((symbol) => {
        const asset = this.data[symbol];
        const assetValue = asset.value || 0;
        const primaryKeyValue = (asset[primaryKey] as string)?.toUpperCase();
        const secondaryKeyValue = asset[secondaryKey] as string;

        if (primaryKeyValue) {
          if (chartData[primaryKeyValue]) {
            chartData[primaryKeyValue].value =
              chartData[primaryKeyValue].value.plus(assetValue);

            const targetSubCategory =
              chartData[primaryKeyValue].subCategory?.[secondaryKeyValue];
            if (targetSubCategory) {
              targetSubCategory.value =
                targetSubCategory.value.plus(assetValue);
            } else {
              if (chartData[primaryKeyValue].subCategory) {
                chartData[primaryKeyValue].subCategory[
                  secondaryKeyValue ?? UNKNOWN_KEY
                ] = {
                  value: new Big(assetValue)
                };
              }
            }
          } else {
            chartData[primaryKeyValue] = {
              name:
                primaryKey === 'id'
                  ? asset.name
                  : (asset[primaryKey] as string),
              subCategory: {},
              value: new Big(assetValue)
            };

            if (secondaryKeyValue) {
              chartData[primaryKeyValue].subCategory = {
                [secondaryKeyValue]: {
                  value: new Big(assetValue)
                }
              };
            }
          }
        } else {
          if (chartData[UNKNOWN_KEY]) {
            chartData[UNKNOWN_KEY].value = chartData[UNKNOWN_KEY].value.plus(
              this.data[symbol].value || 0
            );
          } else {
            chartData[UNKNOWN_KEY] = {
              name: this.data[symbol].name,
              subCategory: secondaryKey
                ? { [secondaryKey]: { value: new Big(0) } }
                : undefined,
              value: new Big(assetValue)
            };
          }
        }
      });
    } else {
      Object.keys(this.data).forEach((symbol) => {
        chartData[symbol] = {
          name: this.data[symbol].name,
          value: new Big(this.data[symbol].value || 0)
        };
      });
    }

    if (this.isInPercentage) {
      const totalValueInPercentage = getSum(
        Object.values(chartData).map(({ value }) => {
          return value;
        })
      );

      const unknownValueInPercentage = new Big(1).minus(totalValueInPercentage);

      if (unknownValueInPercentage.gt(0)) {
        // If total is below 100%, allocate the remaining percentage to UNKNOWN_KEY
        if (chartData[UNKNOWN_KEY]) {
          chartData[UNKNOWN_KEY].value = chartData[UNKNOWN_KEY].value.plus(
            unknownValueInPercentage
          );
        } else {
          chartData[UNKNOWN_KEY] = {
            name: UNKNOWN_KEY,
            value: unknownValueInPercentage
          };
        }
      }
    }

    let chartDataSorted = Object.entries(chartData)
      .sort((a, b) => {
        return a[1].value.minus(b[1].value).toNumber();
      })
      .reverse();

    if (this.maxItems && chartDataSorted.length > this.maxItems) {
      // Add surplus items to OTHER group
      const rest = chartDataSorted.splice(
        this.maxItems,
        chartDataSorted.length - 1
      );

      chartDataSorted.push([
        this.OTHER_KEY,
        { name: this.OTHER_KEY, subCategory: {}, value: new Big(0) }
      ]);
      const otherItem = chartDataSorted[chartDataSorted.length - 1];

      rest.forEach((restItem) => {
        if (otherItem?.[1]) {
          otherItem[1] = {
            name: this.OTHER_KEY,
            subCategory: {},
            value: otherItem[1].value.plus(restItem[1].value)
          };
        }
      });

      // Sort data again
      chartDataSorted = chartDataSorted
        .sort((a, b) => {
          return a[1].value.minus(b[1].value).toNumber();
        })
        .reverse();
    }

    chartDataSorted.forEach(([symbol, item], index) => {
      if (this.colorMap[symbol]) {
        // Reuse color
        item.color = this.colorMap[symbol];
      } else {
        item.color =
          this.getColorPalette()[index % this.getColorPalette().length];
      }
    });

    const backgroundColorSubCategory: string[] = [];
    const dataSubCategory: number[] = [];
    const labelSubCategory: string[] = [];

    chartDataSorted.forEach(([, item]) => {
      let lightnessRatio = 0.2;

      Object.keys(item.subCategory ?? {}).forEach((subCategory) => {
        if (item.name === UNKNOWN_KEY) {
          backgroundColorSubCategory.push(item.color ?? '');
        } else {
          backgroundColorSubCategory.push(
            Color(item.color).lighten(lightnessRatio).hex()
          );
        }
        dataSubCategory.push(
          item.subCategory?.[subCategory].value.toNumber() ?? 0
        );
        labelSubCategory.push(subCategory);

        lightnessRatio += 0.1;
      });
    });

    const datasets: ChartDataset<'doughnut'>[] = [
      {
        backgroundColor: this.hollow
          ? chartDataSorted.map(([, item]) => {
              try {
                return Color(item.color).alpha(0.08).string();
              } catch {
                return 'transparent';
              }
            })
          : chartDataSorted.map(([, item]) => {
              return item.color;
            }),
        borderWidth: this.hollow ? 2 : this.separateSegments ? 3 : 0,
        borderColor: this.hollow
          ? chartDataSorted.map(([, item]) => item.color)
          : ('transparent' as any),
        borderRadius: this.hollow || this.separateSegments ? 4 : 0,
        data: chartDataSorted.map(([, item]) => {
          return item.value.toNumber();
        }),
        ...(this.hollow || this.separateSegments ? { spacing: 4 } : {})
      }
    ];

    let labels = chartDataSorted.map(([, { name }]) => {
      return name;
    });

    let sortedKeys = chartDataSorted.map(([key]) => key);

    if (this.keys[1]) {
      datasets.unshift({
        backgroundColor: backgroundColorSubCategory,
        borderWidth: 0,
        data: dataSubCategory
      });

      labels = labelSubCategory.concat(labels);
      sortedKeys = labelSubCategory.concat(sortedKeys);
    }

    if (datasets[0]?.data?.length === 0 || datasets[0]?.data?.[0] === 0) {
      labels = [''];
      sortedKeys = [''];
      datasets[0].backgroundColor = [this.colorMap[UNKNOWN_KEY]];
      datasets[0].data[0] = Number.MAX_SAFE_INTEGER;
    }

    if (datasets[1]?.data?.length === 0 || datasets[1]?.data?.[1] === 0) {
      labels = [''];
      sortedKeys = [''];
      datasets[1].backgroundColor = [this.colorMap[UNKNOWN_KEY]];
      datasets[1].data[1] = Number.MAX_SAFE_INTEGER;
    }

    this.sortedKeys = sortedKeys;

    const totalSum = getSum(chartDataSorted.map(([, item]) => item.value));

    this.legendItems = chartDataSorted.map(([, item]) => {
      let displayValue = '';
      if (item.value.toNumber() === Number.MAX_SAFE_INTEGER || totalSum.eq(0)) {
        displayValue = '';
      } else if (this.isInPercentage) {
        displayValue = `${item.value.times(100).toFixed(2)}%`;
      } else {
        const pct = totalSum.gt(0)
          ? item.value.times(100).div(totalSum).toFixed(2)
          : '0.00';
        displayValue = `${item.value.toNumber().toLocaleString(this.locale, {
          maximumFractionDigits: 2,
          minimumFractionDigits: 2
        })} ${this.baseCurrency || ''} (${pct}%)`;
      }

      return {
        color: item.color,
        displayValue,
        name:
          item.name === UNKNOWN_KEY
            ? $localize`No data available`
            : item.name === this.OTHER_KEY
              ? $localize`Other`
              : item.name
      };
    });

    const data: ChartData<'doughnut'> = {
      datasets,
      labels
    };

    if (this.chartCanvas()) {
      if (this.chart) {
        this.chart.data = data;
        this.chart.options.plugins ??= {};
        this.chart.options.plugins.tooltip =
          this.getTooltipPluginConfiguration(data);

        this.chart.update();
      } else {
        const plugins = [ChartDataLabels];

        if (this.glow) {
          plugins.push({
            id: 'shadowPlugin',
            beforeDatasetDraw: (chart, args) => {
              const { ctx } = chart;
              const meta = chart.getDatasetMeta(args.index);
              meta.data.forEach((element) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const arcElement = element as any;
                if (!arcElement._originalDraw) {
                  arcElement._originalDraw = arcElement.draw;
                  arcElement.draw = function (context: any) {
                    const drawCtx = context || ctx;
                    drawCtx.save();
                    drawCtx.shadowBlur = 15;
                    drawCtx.shadowColor =
                      this.options?.borderColor || 'transparent';
                    drawCtx.shadowOffsetX = 0;
                    drawCtx.shadowOffsetY = 0;
                    arcElement._originalDraw.call(this, drawCtx);
                    drawCtx.restore();
                  };
                }
              });
            }
          });
        }

        this.chart = new Chart<'doughnut'>(this.chartCanvas().nativeElement, {
          data,
          options: {
            animation: false,
            cutout: '70%',
            layout: {
              padding: this.showLabels === true ? 100 : 0
            },
            onClick: (_, activeElements) => {
              try {
                const dataIndex = activeElements[0].index;
                const symbol = this.sortedKeys[dataIndex];

                const dataSource = this.data[symbol]?.dataSource;

                this.proportionChartClicked.emit({ dataSource, symbol });
              } catch {}
            },
            onHover: (event, chartElement) => {
              if (this.cursor) {
                (event.native?.target as HTMLElement).style.cursor =
                  chartElement[0] ? this.cursor : 'default';
              }
            },
            plugins: {
              datalabels: {
                color: (context) => {
                  return this.getColorPalette()[
                    context.dataIndex % this.getColorPalette().length
                  ];
                },
                display: this.showLabels === true ? 'auto' : false,
                labels: {
                  index: {
                    align: 'end',
                    anchor: 'end',
                    formatter: (value, context) => {
                      const symbolKey = this.sortedKeys[context.dataIndex];
                      let symbol = context.chart.data.labels?.[
                        context.dataIndex
                      ] as string;

                      if (symbol === 'Commodity') {
                        symbol = $localize`Commodity`;
                      } else if (symbol === 'Cryptocurrency') {
                        symbol = $localize`Cryptocurrency`;
                      }

                      return value > 0
                        ? isUUID(symbolKey)
                          ? (this.data[symbolKey]?.name ?? symbol)
                          : symbol
                        : '';
                    },
                    offset: 8
                  }
                }
              },
              legend: {
                display: false,
                position: 'right',
                labels: {
                  color: `rgba(${getTextColor(this.colorScheme)}, 0.8)`
                }
              },
              tooltip: this.getTooltipPluginConfiguration(data)
            }
          },
          plugins,
          type: 'doughnut'
        });
      }
    }

    this.isLoading = false;
  }

  private getColorPalette() {
    return [
      blue[5],
      teal[5],
      lime[5],
      orange[5],
      pink[5],
      violet[5],
      indigo[5],
      cyan[5],
      green[5],
      yellow[5],
      red[5],
      grape[5]
    ];
  }

  private getTooltipPluginConfiguration(
    data: ChartData<'doughnut'>
  ): Partial<TooltipOptions<'doughnut'>> {
    return {
      ...getTooltipOptions({
        colorScheme: this.colorScheme,
        currency: this.baseCurrency,
        locale: this.locale
      }),
      // @ts-expect-error: no need to set all attributes in callbacks
      callbacks: {
        label: (context) => {
          const labelIndex =
            (data.datasets[context.datasetIndex - 1]?.data?.length ?? 0) +
            context.dataIndex;

          const symbolKey = this.sortedKeys[labelIndex];
          let symbol =
            (context.chart.data.labels?.[labelIndex] as string) ?? '';

          if (symbol === this.OTHER_KEY) {
            symbol = $localize`Other`;
          } else if (symbol === UNKNOWN_KEY) {
            symbol = $localize`No data available`;
          } else if (symbol === 'Commodity') {
            symbol = $localize`Commodity`;
          } else if (symbol === 'Cryptocurrency') {
            symbol = $localize`Cryptocurrency`;
          }

          const name = this.data[symbolKey]?.name;

          let sum = 0;

          for (const item of context.dataset.data) {
            sum += item;
          }

          const percentage = (context.parsed * 100) / sum;

          if ((context.raw as number) === Number.MAX_SAFE_INTEGER) {
            return $localize`No data available`;
          } else if (this.isInPercentage) {
            return [`${name ?? symbol}`, `${percentage.toFixed(2)}%`];
          } else {
            const value = context.raw as number;

            return [
              `${name ?? symbol}`,
              `${value.toLocaleString(this.locale, {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2
              })} ${this.baseCurrency} (${percentage.toFixed(2)}%)`
            ];
          }
        },
        title: () => {
          return '';
        }
      }
    };
  }
}
