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
  protected supportedIntegrations = SUPPORTED_INTEGRATIONS;
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
    this.integrationForm = this.formBuilder.group({
      credentials: ['', Validators.required]
    });
  }

  protected selectIntegration(integration: IntegrationProviderInfo) {
    this.selectedIntegration = integration;
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
    const credentials = this.integrationForm.get('credentials')?.value;

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
