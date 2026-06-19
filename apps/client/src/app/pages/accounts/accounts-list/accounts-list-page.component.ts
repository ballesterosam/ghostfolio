import { GfAccountDetailDialogComponent } from '@ghostfolio/client/components/account-detail-dialog/account-detail-dialog.component';
import { AccountDetailDialogParams } from '@ghostfolio/client/components/account-detail-dialog/interfaces/interfaces';
import { ImpersonationStorageService } from '@ghostfolio/client/services/impersonation-storage.service';
import { UserService } from '@ghostfolio/client/services/user/user.service';
import { UNKNOWN_KEY } from '@ghostfolio/common/config';
import {
  CreateAccountDto,
  TransferBalanceDto,
  UpdateAccountDto
} from '@ghostfolio/common/dtos';
import { AssetProfileIdentifier, User } from '@ghostfolio/common/interfaces';
import { hasPermission, permissions } from '@ghostfolio/common/permissions';
import { GfAccountsTableComponent } from '@ghostfolio/ui/accounts-table';
import { GfFabComponent } from '@ghostfolio/ui/fab';
import { NotificationService } from '@ghostfolio/ui/notifications';
import { GfPortfolioProportionChartComponent } from '@ghostfolio/ui/portfolio-proportion-chart';
import { DataService } from '@ghostfolio/ui/services';

import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Account as AccountModel, Platform } from '@prisma/client';
import { DeviceDetectorService } from 'ngx-device-detector';
import { EMPTY, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { GfAddIntegrationDialogComponent } from '../add-integration-dialog/add-integration-dialog.component';
import { GfCreateOrUpdateAccountDialogComponent } from '../create-or-update-account-dialog/create-or-update-account-dialog.component';
import { CreateOrUpdateAccountDialogParams } from '../create-or-update-account-dialog/interfaces/interfaces';
import { TransferBalanceDialogParams } from '../transfer-balance/interfaces/interfaces';
import { GfTransferBalanceDialogComponent } from '../transfer-balance/transfer-balance-dialog.component';

@Component({
  imports: [
    CommonModule,
    GfAccountsTableComponent,
    GfFabComponent,
    GfPortfolioProportionChartComponent,
    RouterModule
  ],
  selector: 'gf-accounts-list-page',
  styleUrls: ['./accounts-list-page.scss'],
  templateUrl: './accounts-list-page.html'
})
export class GfAccountsListPageComponent implements OnInit {
  public accounts: AccountModel[];
  public activitiesCount = 0;
  public deviceType: string;
  public hasImpersonationId: boolean;
  public hasPermissionToCreateAccount: boolean;
  public hasPermissionToUpdateAccount: boolean;
  public routeQueryParams: Subscription;
  public totalBalanceInBaseCurrency = 0;
  public totalValueInBaseCurrency = 0;
  public user: User;
  public platforms: {
    [id: string]: Pick<Platform, 'name'> & {
      id: string;
      value: number;
    };
  };
  public accountsChartData: {
    [id: string]: Pick<AccountModel, 'name'> & {
      id: string;
      value: number;
    };
  };

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
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        if (params['accountId'] && params['accountDetailDialog']) {
          this.openAccountDetailDialog(params['accountId']);
        } else if (
          params['createDialog'] &&
          this.hasPermissionToCreateAccount
        ) {
          this.openCreateAccountDialog();
        } else if (params['editDialog']) {
          if (this.accounts) {
            const account = this.accounts.find(({ id }) => {
              return id === params['accountId'];
            });

            this.openUpdateAccountDialog(account);
          } else {
            this.router.navigate(['.'], { relativeTo: this.route });
          }
        } else if (params['transferBalanceDialog']) {
          this.openTransferBalanceDialog();
        } else if (params['addIntegrationDialog']) {
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

          this.hasPermissionToCreateAccount = hasPermission(
            this.user.permissions,
            permissions.createAccount
          );
          this.hasPermissionToUpdateAccount = hasPermission(
            this.user.permissions,
            permissions.updateAccount
          );

          this.changeDetectorRef.markForCheck();
        }
      });

    this.fetchAccounts();
  }

  public fetchAccounts() {
    this.dataService
      .fetchAccounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(
        ({
          accounts,
          activitiesCount,
          totalBalanceInBaseCurrency,
          totalValueInBaseCurrency
        }) => {
          this.accounts = accounts;
          this.activitiesCount = activitiesCount;
          this.totalBalanceInBaseCurrency = totalBalanceInBaseCurrency;
          this.totalValueInBaseCurrency = totalValueInBaseCurrency;

          if (this.accounts?.length <= 0) {
            this.router.navigate([], { queryParams: { createDialog: true } });
          }

          this.changeDetectorRef.markForCheck();
        }
      );

    this.fetchPortfolioDetails();
  }

  public onDeleteAccount(aId: string, cascade = false) {
    this.reset();

    this.dataService
      .deleteAccount(aId, cascade)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.userService
          .get(true)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe();

        this.fetchAccounts();
      });
  }

  public onTransferBalance() {
    this.router.navigate([], {
      queryParams: { transferBalanceDialog: true }
    });
  }

  public onUpdateAccount(aAccount: AccountModel) {
    this.router.navigate([], {
      queryParams: { accountId: aAccount.id, editDialog: true }
    });
  }

  public openUpdateAccountDialog({
    balance,
    comment,
    currency,
    id,
    isExcluded,
    name,
    platformId
  }: AccountModel) {
    const dialogRef = this.dialog.open<
      GfCreateOrUpdateAccountDialogComponent,
      CreateOrUpdateAccountDialogParams
    >(GfCreateOrUpdateAccountDialogComponent, {
      data: {
        account: {
          balance,
          comment,
          currency,
          id,
          isExcluded,
          name,
          platformId
        }
      },
      height: this.deviceType === 'mobile' ? '98vh' : '80vh',
      width: this.deviceType === 'mobile' ? '100vw' : '50rem'
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((account: UpdateAccountDto | null) => {
        if (account) {
          this.reset();

          this.dataService
            .putAccount(account)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
              this.userService
                .get(true)
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe();

              this.fetchAccounts();
            });

          this.changeDetectorRef.markForCheck();
        }

        this.router.navigate(['.'], { relativeTo: this.route });
      });
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
          this.reset();
          this.fetchAccounts();
        }
        this.router.navigate(['.'], { relativeTo: this.route });
      });
  }

  private openAccountDetailDialog(aAccountId: string) {
    const dialogRef = this.dialog.open<
      GfAccountDetailDialogComponent,
      AccountDetailDialogParams
    >(GfAccountDetailDialogComponent, {
      autoFocus: false,
      data: {
        accountId: aAccountId,
        deviceType: this.deviceType,
        hasImpersonationId: this.hasImpersonationId,
        hasPermissionToCreateActivity:
          !this.hasImpersonationId &&
          hasPermission(this.user?.permissions, permissions.createActivity) &&
          !this.user?.settings?.isRestrictedView
      },
      height: this.deviceType === 'mobile' ? '98vh' : '80vh',
      width: this.deviceType === 'mobile' ? '100vw' : '50rem'
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.fetchAccounts();

        this.router.navigate(['.'], { relativeTo: this.route });
      });
  }

  private openCreateAccountDialog() {
    const dialogRef = this.dialog.open<
      GfCreateOrUpdateAccountDialogComponent,
      CreateOrUpdateAccountDialogParams
    >(GfCreateOrUpdateAccountDialogComponent, {
      data: {
        account: {
          balance: 0,
          comment: null,
          currency: this.user?.settings?.baseCurrency,
          id: null,
          isExcluded: false,
          name: null,
          platformId: null
        }
      },
      height: this.deviceType === 'mobile' ? '98vh' : '80vh',
      width: this.deviceType === 'mobile' ? '100vw' : '50rem'
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((account: CreateAccountDto | null) => {
        if (account) {
          this.reset();

          this.dataService
            .postAccount(account)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
              this.userService
                .get(true)
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe();

              this.fetchAccounts();
            });

          this.changeDetectorRef.markForCheck();
        }

        this.router.navigate(['.'], { relativeTo: this.route });
      });
  }

  private openTransferBalanceDialog() {
    const dialogRef = this.dialog.open<
      GfTransferBalanceDialogComponent,
      TransferBalanceDialogParams
    >(GfTransferBalanceDialogComponent, {
      data: {
        accounts: this.accounts
      },
      width: this.deviceType === 'mobile' ? '100vw' : '50rem'
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: any) => {
        if (data) {
          this.reset();

          const { accountIdFrom, accountIdTo, balance }: TransferBalanceDto =
            data?.account;

          this.dataService
            .transferAccountBalance({
              accountIdFrom,
              accountIdTo,
              balance
            })
            .pipe(
              catchError(() => {
                this.notificationService.alert({
                  title: $localize`Oops, cash balance transfer has failed.`
                });

                return EMPTY;
              }),
              takeUntilDestroyed(this.destroyRef)
            )
            .subscribe(() => {
              this.fetchAccounts();
            });

          this.changeDetectorRef.markForCheck();
        }

        this.router.navigate(['.'], { relativeTo: this.route });
      });
  }

  public isDarkMode() {
    return this.user?.settings?.colorScheme === 'DARK';
  }

  public onAccountChartClicked({ symbol }: AssetProfileIdentifier) {
    if (symbol && symbol !== UNKNOWN_KEY) {
      this.router.navigate([], {
        queryParams: { accountId: symbol, accountDetailDialog: true }
      });
    }
  }

  public showValuesInPercentage() {
    return this.hasImpersonationId || this.user?.settings?.isRestrictedView;
  }

  private fetchPortfolioDetails() {
    this.dataService
      .fetchPortfolioDetails({ withMarkets: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((portfolioDetails) => {
        this.accountsChartData = {};
        this.platforms = {};

        for (const [
          id,
          { name, valueInBaseCurrency, valueInPercentage }
        ] of Object.entries(portfolioDetails.accounts)) {
          let value = 0;

          if (this.showValuesInPercentage()) {
            value = valueInPercentage;
          } else {
            value = valueInBaseCurrency;
          }

          this.accountsChartData[id] = {
            id,
            name,
            value
          };
        }

        for (const [
          id,
          { name, valueInBaseCurrency, valueInPercentage }
        ] of Object.entries(portfolioDetails.platforms)) {
          let value = 0;

          if (this.showValuesInPercentage()) {
            value = valueInPercentage;
          } else {
            value = valueInBaseCurrency;
          }

          this.platforms[id] = {
            id,
            name,
            value
          };
        }

        this.changeDetectorRef.markForCheck();
      });
  }

  private reset() {
    this.accounts = undefined;
    this.activitiesCount = 0;
    this.totalBalanceInBaseCurrency = 0;
    this.totalValueInBaseCurrency = 0;
    this.platforms = undefined;
    this.accountsChartData = undefined;
  }
}
