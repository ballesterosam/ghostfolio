import { AuthGuard } from '@ghostfolio/client/core/auth.guard';
import { internalRoutes } from '@ghostfolio/common/routes/routes';

import { Routes } from '@angular/router';

import { GfMyPropertiesPageComponent } from './my-properties-page.component';
import { GfMyPropertyDetailPageComponent } from './my-property-detail-page.component';

export const routes: Routes = [
  {
    canActivate: [AuthGuard],
    component: GfMyPropertiesPageComponent,
    path: '',
    title: internalRoutes.myProperties.title
  },
  {
    canActivate: [AuthGuard],
    component: GfMyPropertyDetailPageComponent,
    path: ':id',
    title: internalRoutes.myProperties.title
  }
];
