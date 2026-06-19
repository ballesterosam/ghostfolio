import { AuthGuard } from '@ghostfolio/client/core/auth.guard';
import { internalRoutes } from '@ghostfolio/common/routes/routes';

import { Routes } from '@angular/router';

import { GfAccountsPageComponent } from './accounts-page.component';

export const routes: Routes = [
  {
    canActivate: [AuthGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./accounts-list/accounts-list-page.component').then(
            (c) => c.GfAccountsListPageComponent
          ),
        title: internalRoutes.accounts.subRoutes.accounts.title
      },
      {
        path: internalRoutes.accounts.subRoutes.integrations.path,
        loadComponent: () =>
          import('./integrations/integrations-page.component').then(
            (c) => c.GfIntegrationsPageComponent
          ),
        title: internalRoutes.accounts.subRoutes.integrations.title
      }
    ],
    component: GfAccountsPageComponent,
    path: '',
    title: internalRoutes.accounts.title
  }
];
