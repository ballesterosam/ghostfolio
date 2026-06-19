import { SUPPORTED_INTEGRATIONS } from '@ghostfolio/common/integration-registry';
import {
  ConnectIntegrationResponse,
  IntegrationProviderInfo
} from '@ghostfolio/common/interfaces';
import { GfEntityLogoComponent } from '@ghostfolio/ui/entity-logo';
import { DataService } from '@ghostfolio/ui/services';

import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { alertCircleOutline, checkmarkCircleOutline } from 'ionicons/icons';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    GfEntityLogoComponent,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    ReactiveFormsModule,
    IonIcon
  ],
  selector: 'gf-add-integration-dialog',
  styleUrls: ['./add-integration-dialog.scss'],
  templateUrl: './add-integration-dialog.html'
})
export class GfAddIntegrationDialogComponent implements OnInit {
  protected step: 'select' | 'configure' | 'loading' | 'success' | 'error' =
    'select';
  protected supportedIntegrations: IntegrationProviderInfo[] = [];
  protected selectedIntegration: IntegrationProviderInfo | null = null;
  protected integrationForm: FormGroup;
  protected connectionResult: ConnectIntegrationResponse | null = null;
  protected errorMessage: string | null = null;

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dataService = inject(DataService);
  private readonly dialogRef = inject(
    MatDialogRef<GfAddIntegrationDialogComponent>
  );
  private readonly formBuilder = inject(FormBuilder);

  public constructor() {
    addIcons({ checkmarkCircleOutline, alertCircleOutline });
  }

  public ngOnInit() {
    this.integrationForm = this.formBuilder.group({});
    this.supportedIntegrations = this.getLocalisedIntegrations();
  }

  private getLocalisedIntegrations(): IntegrationProviderInfo[] {
    return SUPPORTED_INTEGRATIONS.map((integration) => {
      let description = integration.description;
      let setupSteps = integration.setupSteps;
      const credentialFields = integration.credentialFields.map((field) => ({
        ...field
      }));

      if (integration.provider === 'INDEXA_CAPITAL') {
        description = $localize`Leading automated investment manager in Spain (index funds, pension plans, EPSV).`;
        setupSteps = [
          $localize`Access your private area at indexacapital.com`,
          $localize`Go to User settings > API / Applications`,
          $localize`Generate an API token with read permissions`,
          $localize`Copy the token and paste it below`
        ];
        const tokenField = credentialFields.find((f) => f.key === 'apiToken');
        if (tokenField) {
          tokenField.label = $localize`API Token`;
          tokenField.placeholder = $localize`Indexa Capital Token`;
          tokenField.helpText = $localize`Your personal API token for read-only access.`;
        }
      } else if (integration.provider === 'ETORO') {
        description = $localize`Leading global investment broker. Automatically sync your stock, ETF and cryptocurrency positions.`;
        setupSteps = [
          $localize`Log in to your eToro account.`,
          $localize`Go to Settings > Trading.`,
          $localize`Create a new API key (Create New Key).`,
          $localize`Set the environment to "Real Portfolio" and copy your API Key and User Key.`
        ];
        const apiKeyField = credentialFields.find((f) => f.key === 'apiKey');
        if (apiKeyField) {
          apiKeyField.label = $localize`API Key (x-api-key)`;
          apiKeyField.placeholder = $localize`Your public API key`;
          apiKeyField.helpText = $localize`Public application key provided by eToro.`;
        }
        const userKeyField = credentialFields.find((f) => f.key === 'userKey');
        if (userKeyField) {
          userKeyField.label = $localize`User Key (x-user-key)`;
          userKeyField.placeholder = $localize`Your user account key`;
          userKeyField.helpText = $localize`Private key generated in your trading settings.`;
        }
      }

      return {
        ...integration,
        description,
        setupSteps,
        credentialFields
      };
    });
  }

  protected selectIntegration(integration: IntegrationProviderInfo) {
    this.selectedIntegration = integration;

    // Clear old controls
    Object.keys(this.integrationForm.controls).forEach((key) => {
      this.integrationForm.removeControl(key);
    });

    // Add new controls dynamically
    for (const field of integration.credentialFields) {
      this.integrationForm.addControl(
        field.key,
        this.formBuilder.control('', Validators.required)
      );
    }

    this.step = 'configure';
  }

  protected goBack() {
    if (this.step === 'configure') {
      this.step = 'select';
      this.selectedIntegration = null;
    } else if (this.step === 'error') {
      this.step = 'configure';
    }
  }

  protected onCancel() {
    this.dialogRef.close(this.connectionResult ? true : null);
  }

  protected onSubmit() {
    if (this.integrationForm.invalid || !this.selectedIntegration) {
      return;
    }

    this.step = 'loading';

    let credentials = '';
    const fields = this.selectedIntegration.credentialFields;
    if (fields.length === 1) {
      credentials = this.integrationForm.get(fields[0].key)?.value;
    } else {
      const credentialsObj: Record<string, string> = {};
      for (const field of fields) {
        credentialsObj[field.key] = this.integrationForm.get(field.key)?.value;
      }
      credentials = JSON.stringify(credentialsObj);
    }

    this.dataService
      .connectPlatformIntegration({
        provider: this.selectedIntegration.provider,
        credentials
      })
      .subscribe({
        next: (res) => {
          this.connectionResult = res;
          this.step = 'success';
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.errorMessage =
            err.error?.message || err.message || 'Error desconocido';
          this.step = 'error';
          this.cdr.markForCheck();
        }
      });
  }
}
