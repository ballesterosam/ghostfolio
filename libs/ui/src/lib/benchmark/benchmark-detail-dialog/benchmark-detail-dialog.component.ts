import { DATE_FORMAT } from '@ghostfolio/common/helper';
import {
  AdminMarketDataDetails,
  LineChartItem
} from '@ghostfolio/common/interfaces';
import { GfDialogFooterComponent } from '@ghostfolio/ui/dialog-footer';
import { GfDialogHeaderComponent } from '@ghostfolio/ui/dialog-header';
import { DataService } from '@ghostfolio/ui/services';

import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  Inject,
  OnInit
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA
} from '@angular/material/dialog';
import { IonIcon } from '@ionic/angular/standalone';
import { format } from 'date-fns';
import { addIcons } from 'ionicons';
import {
  businessOutline,
  close,
  helpCircleOutline,
  layersOutline,
  leafOutline,
  logoBitcoin,
  pieChartOutline,
  readerOutline,
  receiptOutline,
  walletOutline
} from 'ionicons/icons';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

import { GfEntityLogoComponent } from '../../entity-logo/entity-logo.component';
import { GfLineChartComponent } from '../../line-chart/line-chart.component';
import { GfValueComponent } from '../../value/value.component';
import { BenchmarkDetailDialogParams } from './interfaces/interfaces';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'd-flex flex-column h-100' },
  imports: [
    GfDialogFooterComponent,
    GfDialogHeaderComponent,
    GfEntityLogoComponent,
    GfLineChartComponent,
    GfValueComponent,
    IonIcon,
    MatDialogModule,
    NgxSkeletonLoaderModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  selector: 'gf-benchmark-detail-dialog',
  styleUrls: ['./benchmark-detail-dialog.component.scss'],
  templateUrl: 'benchmark-detail-dialog.html'
})
export class GfBenchmarkDetailDialogComponent implements OnInit {
  public assetProfile: AdminMarketDataDetails['assetProfile'];
  public historicalDataItems: LineChartItem[];
  public value: number;

  public constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private dataService: DataService,
    private destroyRef: DestroyRef,
    public dialogRef: MatDialogRef<GfBenchmarkDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: BenchmarkDetailDialogParams
  ) {
    addIcons({
      businessOutline,
      close,
      helpCircleOutline,
      layersOutline,
      leafOutline,
      logoBitcoin,
      pieChartOutline,
      readerOutline,
      receiptOutline,
      walletOutline
    });
  }

  public ngOnInit() {
    this.dataService
      .fetchAsset({
        dataSource: this.data.dataSource,
        symbol: this.data.symbol
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ assetProfile, marketData }) => {
        this.assetProfile = assetProfile;

        this.historicalDataItems = marketData.map(
          ({ date, marketPrice }, index) => {
            if (marketData.length - 1 === index) {
              this.value = marketPrice;
            }

            return {
              date: format(date, DATE_FORMAT),
              value: marketPrice
            };
          }
        );

        this.changeDetectorRef.markForCheck();
      });
  }

  public getAssetIcon(assetSubClass: string, assetClass: string): string {
    const subClass = assetSubClass?.toUpperCase();
    const aClass = assetClass?.toUpperCase();

    switch (subClass) {
      case 'CRYPTOCURRENCY':
        return 'logo-bitcoin';
      case 'ETF':
        return 'pie-chart-outline';
      case 'MUTUALFUND':
      case 'MUTUAL_FUND':
        return 'layers-outline';
      case 'BOND':
        return 'receipt-outline';
      case 'PRECIOUS_METAL':
        return 'leaf-outline';
    }

    switch (aClass) {
      case 'CASH':
      case 'LIQUIDITY':
        return 'wallet-outline';
      case 'EQUITY':
        return 'business-outline';
    }

    return 'help-circle-outline';
  }

  public onClose() {
    this.dialogRef.close();
  }
}
