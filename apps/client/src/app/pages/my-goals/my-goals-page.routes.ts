import { AuthGuard } from '@ghostfolio/client/core/auth.guard';
import { GfFirePageComponent } from '@ghostfolio/client/pages/portfolio/fire/fire-page.component';
import { internalRoutes } from '@ghostfolio/common/routes/routes';

import { Routes } from '@angular/router';

import { GfMyGoalsPageComponent } from './my-goals-page.component';

export const routes: Routes = [
  {
    canActivate: [AuthGuard],
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./goals/goals-page.routes').then((m) => m.routes)
      },
      {
        component: GfFirePageComponent,
        path: internalRoutes.myGoals.subRoutes.fire.path,
        title: internalRoutes.myGoals.subRoutes.fire.title
      }
    ],
    component: GfMyGoalsPageComponent,
    path: '',
    title: internalRoutes.myGoals.title
  }
];
