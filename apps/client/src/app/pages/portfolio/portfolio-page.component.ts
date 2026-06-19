import { UserService } from '@ghostfolio/client/services/user/user.service';
import { User } from '@ghostfolio/common/interfaces';
import { hasPermission, permissions } from '@ghostfolio/common/permissions';
import { internalRoutes } from '@ghostfolio/common/routes/routes';
import {
  GfPageTabsComponent,
  TabConfiguration
} from '@ghostfolio/ui/page-tabs';

import { ChangeDetectorRef, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { addIcons } from 'ionicons';
import {
  albumsOutline,
  analyticsOutline,
  bookmarkOutline,
  calculatorOutline,
  newspaperOutline,
  pieChartOutline,
  scanOutline,
  swapVerticalOutline
} from 'ionicons/icons';

@Component({
  host: { class: 'page' },
  imports: [GfPageTabsComponent],
  selector: 'gf-portfolio-page',
  styleUrls: ['./portfolio-page.scss'],
  templateUrl: './portfolio-page.html'
})
export class PortfolioPageComponent {
  public tabs: TabConfiguration[] = [];
  public user: User;

  public constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private destroyRef: DestroyRef,
    private userService: UserService
  ) {
    this.userService.stateChanged
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        if (state?.user) {
          this.user = state.user;

          this.tabs = [
            {
              iconName: 'analytics-outline',
              label: internalRoutes.portfolio.subRoutes.analysis.title,
              routerLink: internalRoutes.portfolio.routerLink
            },
            {
              iconName: 'albums-outline',
              label: internalRoutes.portfolio.subRoutes.holdings.title,
              routerLink: internalRoutes.portfolio.subRoutes.holdings.routerLink
            },
            {
              iconName: 'swap-vertical-outline',
              label: internalRoutes.portfolio.subRoutes.activities.title,
              routerLink:
                internalRoutes.portfolio.subRoutes.activities.routerLink
            },
            {
              iconName: 'pie-chart-outline',
              label: internalRoutes.portfolio.subRoutes.allocations.title,
              routerLink:
                internalRoutes.portfolio.subRoutes.allocations.routerLink
            },
            {
              iconName: 'bookmark-outline',
              label: internalRoutes.portfolio.subRoutes.watchlist.title,
              routerLink:
                internalRoutes.portfolio.subRoutes.watchlist.routerLink
            },
            {
              iconName: 'newspaper-outline',
              label: hasPermission(
                this.user?.permissions,
                permissions.readMarketDataOfMarkets
              )
                ? internalRoutes.portfolio.subRoutes.marketsPremium.title
                : internalRoutes.portfolio.subRoutes.markets.title,
              routerLink: hasPermission(
                this.user?.permissions,
                permissions.readMarketDataOfMarkets
              )
                ? internalRoutes.portfolio.subRoutes.marketsPremium.routerLink
                : internalRoutes.portfolio.subRoutes.markets.routerLink
            },
            {
              iconName: 'calculator-outline',
              label: internalRoutes.portfolio.subRoutes.fire.title,
              routerLink: internalRoutes.portfolio.subRoutes.fire.routerLink
            },
            {
              iconName: 'scan-outline',
              label: internalRoutes.portfolio.subRoutes.xRay.title,
              routerLink: internalRoutes.portfolio.subRoutes.xRay.routerLink
            }
          ];

          this.changeDetectorRef.markForCheck();
        }
      });

    addIcons({
      albumsOutline,
      analyticsOutline,
      bookmarkOutline,
      calculatorOutline,
      newspaperOutline,
      pieChartOutline,
      scanOutline,
      swapVerticalOutline
    });
  }
}
