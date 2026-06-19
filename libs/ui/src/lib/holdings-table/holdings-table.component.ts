import { getLocale, getLowercase } from '@ghostfolio/common/helper';
import {
  AssetProfileIdentifier,
  PortfolioPosition
} from '@ghostfolio/common/interfaces';

import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  model,
  output,
  viewChild
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { IonIcon } from '@ionic/angular/standalone';
import { AssetSubClass } from '@prisma/client';
import { addIcons } from 'ionicons';
import {
  walletOutline,
  logoBitcoin,
  businessOutline,
  pieChartOutline,
  layersOutline,
  receiptOutline,
  leafOutline,
  helpCircleOutline,
  chevronDownOutline,
  chevronUpOutline
} from 'ionicons/icons';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

import { GfValueComponent } from '../value/value.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    GfValueComponent,
    IonIcon,
    MatButtonModule,
    MatDialogModule,
    MatPaginatorModule,
    MatSortModule,
    MatTableModule,
    NgxSkeletonLoaderModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  selector: 'gf-holdings-table',
  styleUrls: ['./holdings-table.component.scss'],
  templateUrl: './holdings-table.component.html'
})
export class GfHoldingsTableComponent {
  public readonly hasPermissionToOpenDetails = input(true);
  public readonly hasPermissionToShowQuantities = input(true);
  public readonly hasPermissionToShowValues = input(true);
  public readonly holdings = input.required<PortfolioPosition[]>();
  public readonly locale = input(getLocale());
  public readonly baseCurrency = input<string>();
  public readonly pageSize = model(Number.MAX_SAFE_INTEGER);

  public readonly holdingClicked = output<AssetProfileIdentifier>();

  protected readonly paginator = viewChild.required(MatPaginator);
  protected readonly sort = viewChild.required(MatSort);

  protected readonly dataSource = new MatTableDataSource<PortfolioPosition>([]);

  protected readonly displayedColumns = computed(() => {
    const columns = ['icon', 'nameWithSymbol', 'dateOfFirstActivity'];

    if (this.hasPermissionToShowQuantities()) {
      columns.push('quantity');
    }

    if (this.hasPermissionToShowValues()) {
      columns.push('valueInBaseCurrency');
    }

    columns.push('allocationInPercentage');

    if (this.hasPermissionToShowValues()) {
      columns.push('performance');
    }

    columns.push('performanceInPercentage');
    return columns;
  });

  protected readonly ignoreAssetSubClasses: AssetSubClass[] = [
    AssetSubClass.CASH
  ];

  protected readonly isLoading = computed(() => !this.holdings());

  protected expandedSymbols = new Set<string>();

  public constructor() {
    this.dataSource.sortingDataAccessor = getLowercase;

    addIcons({
      walletOutline,
      logoBitcoin,
      businessOutline,
      pieChartOutline,
      layersOutline,
      receiptOutline,
      leafOutline,
      helpCircleOutline,
      chevronDownOutline,
      chevronUpOutline
    });

    // Reactive data update
    effect(() => {
      this.dataSource.data = this.holdings();
    });

    // Reactive view connection
    effect(() => {
      this.dataSource.paginator = this.paginator();
      this.dataSource.sort = this.sort();
    });
  }

  protected getRowId(element: PortfolioPosition): string {
    return `${element.assetProfile.dataSource}:${element.assetProfile.symbol}`;
  }

  protected toggleExpand(element: PortfolioPosition, event: Event) {
    event.stopPropagation();
    const id = this.getRowId(element);
    if (this.expandedSymbols.has(id)) {
      this.expandedSymbols.delete(id);
    } else {
      this.expandedSymbols.add(id);
    }
  }

  protected isExpanded(element: PortfolioPosition): boolean {
    return this.expandedSymbols.has(this.getRowId(element));
  }

  protected isMobile(): boolean {
    return window.innerWidth < 576;
  }

  protected getAssetIcon(element: PortfolioPosition): string {
    const subClass = element.assetProfile.assetSubClass;
    const assetClass = element.assetProfile.assetClass;

    if (assetClass === 'LIQUIDITY' || subClass === 'CASH') {
      return 'wallet-outline';
    }
    switch (subClass) {
      case 'CRYPTOCURRENCY':
        return 'logo-bitcoin';
      case 'STOCK':
        return 'business-outline';
      case 'ETF':
        return 'pie-chart-outline';
      case 'MUTUALFUND':
        return 'layers-outline';
      case 'BOND':
      case 'LOAN':
        return 'receipt-outline';
      case 'PRECIOUS_METAL':
        return 'leaf-outline';
      default:
        return 'help-circle-outline';
    }
  }

  protected canShowDetails(holding: PortfolioPosition): boolean {
    return (
      this.hasPermissionToOpenDetails() &&
      !this.ignoreAssetSubClasses.includes(holding.assetProfile.assetSubClass)
    );
  }

  protected onOpenHoldingDialog({
    dataSource,
    symbol
  }: AssetProfileIdentifier) {
    this.holdingClicked.emit({ dataSource, symbol });
  }

  protected onShowAllHoldings() {
    this.pageSize.set(Number.MAX_SAFE_INTEGER);

    setTimeout(() => {
      this.dataSource.paginator = this.paginator();
    });
  }
}
