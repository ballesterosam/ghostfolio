import { GfHomeHoldingsComponent } from '@ghostfolio/client/components/home-holdings/home-holdings.component';
import { GfHomeMarketComponent } from '@ghostfolio/client/components/home-market/home-market.component';
import { GfHomeWatchlistComponent } from '@ghostfolio/client/components/home-watchlist/home-watchlist.component';
import { GfMarketsComponent } from '@ghostfolio/client/components/markets/markets.component';
import { AuthGuard } from '@ghostfolio/client/core/auth.guard';
import { internalRoutes } from '@ghostfolio/common/routes/routes';

import { Routes } from '@angular/router';

import { PortfolioPageComponent } from './portfolio-page.component';

export const routes: Routes = [
  {
    canActivate: [AuthGuard],
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./analysis/analysis-page.routes').then((m) => m.routes)
      },
      {
        path: internalRoutes.portfolio.subRoutes.activities.path,
        loadChildren: () =>
          import('./activities/activities-page.routes').then((m) => m.routes)
      },
      {
        path: internalRoutes.portfolio.subRoutes.allocations.path,
        loadChildren: () =>
          import('./allocations/allocations-page.routes').then((m) => m.routes)
      },
      {
        path: internalRoutes.portfolio.subRoutes.fire.path,
        loadChildren: () =>
          import('./fire/fire-page.routes').then((m) => m.routes)
      },
      {
        path: internalRoutes.portfolio.subRoutes.holdings.path,
        component: GfHomeHoldingsComponent,
        title: internalRoutes.portfolio.subRoutes.holdings.title
      },
      {
        path: internalRoutes.portfolio.subRoutes.markets.path,
        component: GfHomeMarketComponent,
        title: internalRoutes.portfolio.subRoutes.markets.title
      },
      {
        path: internalRoutes.portfolio.subRoutes.marketsPremium.path,
        component: GfMarketsComponent,
        title: internalRoutes.portfolio.subRoutes.marketsPremium.title
      },
      {
        path: internalRoutes.portfolio.subRoutes.watchlist.path,
        component: GfHomeWatchlistComponent,
        title: internalRoutes.portfolio.subRoutes.watchlist.title
      },
      {
        path: internalRoutes.portfolio.subRoutes.xRay.path,
        loadChildren: () =>
          import('./x-ray/x-ray-page.routes').then((m) => m.routes)
      }
    ],
    component: PortfolioPageComponent,
    path: '',
    title: internalRoutes.portfolio.title
  }
];
