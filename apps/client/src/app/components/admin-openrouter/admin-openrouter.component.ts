import {
  PROPERTY_API_KEY_OPENROUTER,
  PROPERTY_OPENROUTER_MODEL,
  PROPERTY_OPENROUTER_MODEL_WEB_FETCH,
  PROPERTY_WEB_FETCH_ROUTES
} from '@ghostfolio/common/config';
import { AdminService, DataService } from '@ghostfolio/ui/services';

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  inject,
  OnInit
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  eyeOffOutline,
  eyeOutline,
  saveOutline,
  trashOutline
} from 'ionicons/icons';

interface WebFetchRoute {
  domain: string;
  responseContentType?: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonIcon,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule,
    ReactiveFormsModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  selector: 'gf-admin-openrouter',
  styleUrls: ['./admin-openrouter.component.scss'],
  templateUrl: './admin-openrouter.component.html'
})
export class GfAdminOpenrouterComponent implements OnInit {
  protected apiKeyForm: FormGroup;
  protected modelsForm: FormGroup;
  protected newRouteForm: FormGroup;
  protected isApiKeyHidden = true;
  protected hasApiKey = false;
  protected webFetchRoutes: WebFetchRoute[] = [];
  protected readonly webFetchRoutesDisplayedColumns = [
    'domain',
    'responseContentType',
    'actions'
  ];

  private readonly adminService = inject(AdminService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly dataService = inject(DataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  public constructor() {
    this.apiKeyForm = this.fb.group({
      apiKey: ['', Validators.required]
    });

    this.modelsForm = this.fb.group({
      model: [''],
      modelWebFetch: ['']
    });

    this.newRouteForm = this.fb.group({
      domain: ['', Validators.required],
      responseContentType: ['application/json']
    });

    addIcons({
      addOutline,
      eyeOffOutline,
      eyeOutline,
      saveOutline,
      trashOutline
    });
  }

  public ngOnInit() {
    this.loadSettings();
  }

  protected onSaveApiKey() {
    const apiKey = this.apiKeyForm.get('apiKey')?.value?.trim();

    if (!apiKey) {
      return;
    }

    this.dataService
      .putAdminSetting(PROPERTY_API_KEY_OPENROUTER, { value: apiKey })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.hasApiKey = true;
        this.apiKeyForm.reset();
        this.changeDetectorRef.markForCheck();
      });
  }

  protected onRemoveApiKey() {
    this.dataService
      .putAdminSetting(PROPERTY_API_KEY_OPENROUTER, { value: undefined })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.hasApiKey = false;
        this.changeDetectorRef.markForCheck();
      });
  }

  protected onSaveModels() {
    const model = this.modelsForm.get('model')?.value?.trim() || undefined;
    const modelWebFetch =
      this.modelsForm.get('modelWebFetch')?.value?.trim() || undefined;

    this.dataService
      .putAdminSetting(PROPERTY_OPENROUTER_MODEL, { value: model })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();

    this.dataService
      .putAdminSetting(PROPERTY_OPENROUTER_MODEL_WEB_FETCH, {
        value: modelWebFetch
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.changeDetectorRef.markForCheck();
      });
  }

  protected onAddRoute() {
    if (this.newRouteForm.invalid) {
      return;
    }

    const domain = this.newRouteForm.get('domain')?.value?.trim();
    const responseContentType =
      this.newRouteForm.get('responseContentType')?.value?.trim() || undefined;

    const newRoute: WebFetchRoute = { domain };

    if (responseContentType) {
      newRoute.responseContentType = responseContentType;
    }

    const updatedRoutes = [...this.webFetchRoutes, newRoute];

    this.saveRoutes(updatedRoutes, () => {
      this.newRouteForm.reset({ responseContentType: 'application/json' });
    });
  }

  protected onDeleteRoute(domain: string) {
    const updatedRoutes = this.webFetchRoutes.filter(
      (r) => r.domain !== domain
    );

    this.saveRoutes(updatedRoutes);
  }

  private loadSettings() {
    this.adminService
      .fetchAdminData()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ settings }) => {
        this.hasApiKey = !!settings[PROPERTY_API_KEY_OPENROUTER];

        this.modelsForm.patchValue({
          model: (settings[PROPERTY_OPENROUTER_MODEL] as string) ?? '',
          modelWebFetch:
            (settings[PROPERTY_OPENROUTER_MODEL_WEB_FETCH] as string) ?? ''
        });

        this.webFetchRoutes =
          (settings[PROPERTY_WEB_FETCH_ROUTES] as WebFetchRoute[]) ?? [];

        this.changeDetectorRef.markForCheck();
      });
  }

  private saveRoutes(routes: WebFetchRoute[], onSuccess?: () => void) {
    this.dataService
      .putAdminSetting(PROPERTY_WEB_FETCH_ROUTES, {
        value: routes.length > 0 ? JSON.stringify(routes) : undefined
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.webFetchRoutes = routes;
        onSuccess?.();
        this.changeDetectorRef.markForCheck();
      });
  }
}
