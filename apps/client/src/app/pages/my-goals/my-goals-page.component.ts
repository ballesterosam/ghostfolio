import { UserService } from '@ghostfolio/client/services/user/user.service';
import { User } from '@ghostfolio/common/interfaces';
import { internalRoutes } from '@ghostfolio/common/routes/routes';
import {
  GfPageTabsComponent,
  TabConfiguration
} from '@ghostfolio/ui/page-tabs';

import { ChangeDetectorRef, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { addIcons } from 'ionicons';
import { calculatorOutline, flagOutline } from 'ionicons/icons';

@Component({
  host: { class: 'page' },
  imports: [GfPageTabsComponent],
  selector: 'gf-my-goals-page',
  styleUrls: ['./my-goals-page.scss'],
  templateUrl: './my-goals-page.html'
})
export class GfMyGoalsPageComponent {
  public tabs: TabConfiguration[] = [];
  public user: User;

  public constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private destroyRef: DestroyRef,
    private userService: UserService
  ) {
    addIcons({ calculatorOutline, flagOutline });

    this.userService.stateChanged
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        if (state?.user) {
          this.user = state.user;

          this.tabs = [
            {
              iconName: 'flag-outline',
              label: internalRoutes.myGoals.subRoutes.goals.title,
              routerLink: internalRoutes.myGoals.routerLink
            },
            {
              iconName: 'calculator-outline',
              label: internalRoutes.myGoals.subRoutes.fire.title,
              routerLink: internalRoutes.myGoals.subRoutes.fire.routerLink
            }
          ];

          this.changeDetectorRef.markForCheck();
        }
      });
  }
}
