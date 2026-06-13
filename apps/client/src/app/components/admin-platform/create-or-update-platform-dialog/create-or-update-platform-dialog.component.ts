import { CreatePlatformDto, UpdatePlatformDto } from '@ghostfolio/common/dtos';
import { SUPPORTED_INTEGRATIONS } from '@ghostfolio/common/integration-registry';
import { validateObjectForForm } from '@ghostfolio/common/utils';
import { GfEntityLogoComponent } from '@ghostfolio/ui/entity-logo';

import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  OnInit
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { CreateOrUpdatePlatformDialogParams } from './interfaces/interfaces';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'h-100' },
  imports: [
    FormsModule,
    GfEntityLogoComponent,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule
  ],
  selector: 'gf-create-or-update-platform-dialog',
  styleUrls: ['./create-or-update-platform-dialog.scss'],
  templateUrl: 'create-or-update-platform-dialog.html'
})
export class GfCreateOrUpdatePlatformDialogComponent implements OnInit {
  public platformForm: FormGroup;
  public platformType: 'custom' | 'native' = 'custom';
  public supportedIntegrations = SUPPORTED_INTEGRATIONS;

  public constructor(
    @Inject(MAT_DIALOG_DATA) public data: CreateOrUpdatePlatformDialogParams,
    public dialogRef: MatDialogRef<GfCreateOrUpdatePlatformDialogComponent>,
    private formBuilder: FormBuilder
  ) {
    this.platformForm = this.formBuilder.group({
      name: [this.data.platform?.name, Validators.required],
      url: [this.data.platform?.url ?? 'https://', Validators.required]
    });
  }

  public ngOnInit() {
    // If updating, determine if it matches a native integration
    if (this.data.platform?.id) {
      const isNative = this.supportedIntegrations.some(
        (integration) =>
          integration.name.toLowerCase() ===
            this.data.platform.name?.toLowerCase() ||
          integration.url.toLowerCase() ===
            this.data.platform.url?.toLowerCase()
      );
      if (isNative) {
        this.platformType = 'native';
      }
    }
  }

  public onPlatformTypeChange(type: 'custom' | 'native') {
    this.platformType = type;
    if (type === 'custom') {
      this.platformForm.patchValue({
        name: '',
        url: 'https://'
      });
    }
  }

  public onIntegrationChange(integration: any) {
    if (integration) {
      this.platformForm.patchValue({
        name: integration.name,
        url: integration.url
      });
      this.platformForm.markAsDirty();
    }
  }

  public onCancel() {
    this.dialogRef.close();
  }

  public async onSubmit() {
    try {
      const platform: CreatePlatformDto | UpdatePlatformDto = {
        name: this.platformForm.get('name')?.value,
        url: this.platformForm.get('url')?.value
      };

      if (this.data.platform?.id) {
        (platform as UpdatePlatformDto).id = this.data.platform.id;
        await validateObjectForForm({
          classDto: UpdatePlatformDto,
          form: this.platformForm,
          object: platform
        });
      } else {
        await validateObjectForForm({
          classDto: CreatePlatformDto,
          form: this.platformForm,
          object: platform
        });
      }

      this.dialogRef.close(platform);
    } catch (error) {
      console.error(error);
    }
  }
}
