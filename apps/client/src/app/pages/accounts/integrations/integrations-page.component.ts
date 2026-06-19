import { ImpersonationStorageService } from '@ghostfolio/client/services/impersonation-storage.service';
import { UserService } from '@ghostfolio/client/services/user/user.service';
import { ConfirmationDialogType } from '@ghostfolio/common/enums';
import {
  User,
  PlatformIntegrationDetails
} from '@ghostfolio/common/interfaces';
import { NotificationService } from '@ghostfolio/ui/notifications';
import { DataService } from '@ghostfolio/ui/services';

import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { syncOutline, trashOutline, ellipsisHorizontal } from 'ionicons/icons';
import { DeviceDetectorService } from 'ngx-device-detector';
import { Subscription } from 'rxjs';

import { GfAddIntegrationDialogComponent } from '../add-integration-dialog/add-integration-dialog.component';

@Component({
  imports: [
    CommonModule,
    MatButtonModule,
    MatTableModule,
    MatMenuModule,
    IonIcon,
    RouterModule
  ],
  selector: 'gf-integrations-page',
  styleUrls: ['./integrations-page.scss'],
  templateUrl: './integrations-page.html'
})
export class GfIntegrationsPageComponent implements OnInit {
  public displayedColumns = [
    'accountName',
    'provider',
    'externalAccountId',
    'lastSyncAt',
    'status',
    'actions'
  ];
  public deviceType: string;
  public hasImpersonationId: boolean;
  public routeQueryParams: Subscription;
  public user: User;
  public integrations: PlatformIntegrationDetails[] = [];

  public constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private dataService: DataService,
    private destroyRef: DestroyRef,
    private deviceDetectorService: DeviceDetectorService,
    private dialog: MatDialog,
    private impersonationStorageService: ImpersonationStorageService,
    private notificationService: NotificationService,
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService
  ) {
    addIcons({ syncOutline, trashOutline, ellipsisHorizontal });

    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        if (params['addIntegrationDialog']) {
          this.openAddIntegrationDialog();
        }
      });
  }

  public ngOnInit() {
    this.deviceType = this.deviceDetectorService.getDeviceInfo().deviceType;

    this.impersonationStorageService
      .onChangeHasImpersonation()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((impersonationId) => {
        this.hasImpersonationId = !!impersonationId;
      });

    this.userService.stateChanged
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        if (state?.user) {
          this.user = state.user;
          this.changeDetectorRef.markForCheck();
        }
      });

    this.fetchIntegrations();
  }

  public openAddIntegrationDialog() {
    const dialogRef = this.dialog.open<GfAddIntegrationDialogComponent>(
      GfAddIntegrationDialogComponent,
      {
        height: this.deviceType === 'mobile' ? '98vh' : '80vh',
        width: this.deviceType === 'mobile' ? '100vw' : '55rem'
      }
    );

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((success) => {
        if (success) {
          this.fetchIntegrations();
        }
        this.router.navigate(['.'], { relativeTo: this.route });
      });
  }

  public fetchIntegrations() {
    this.dataService
      .fetchPlatformIntegrations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((integrations) => {
        this.integrations = integrations;
        this.changeDetectorRef.markForCheck();
      });
  }

  public onSyncIntegration(id: string) {
    this.dataService.syncPlatformIntegration(id).subscribe(() => {
      this.notificationService.alert({
        title: $localize`Sync job queued successfully.`
      });
      this.fetchIntegrations();
    });
  }

  public onDisconnectIntegration(id: string) {
    this.notificationService.confirm({
      confirmFn: () => {
        this.dataService.disconnectPlatformIntegration(id).subscribe(() => {
          this.fetchIntegrations();
        });
      },
      confirmType: ConfirmationDialogType.Warn,
      title: $localize`Do you really want to disconnect this integration? The historical account data will be preserved.`
    });
  }
}
