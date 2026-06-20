import { AuthGuard } from '@ghostfolio/client/core/auth.guard';
import { internalRoutes } from '@ghostfolio/common/routes/routes';

import { Routes } from '@angular/router';

import { GfGoalsPageComponent } from './goals-page.component';

export const routes: Routes = [
  {
    canActivate: [AuthGuard],
    component: GfGoalsPageComponent,
    path: '',
    title: internalRoutes.myGoals.subRoutes.goals.title
  }
];
