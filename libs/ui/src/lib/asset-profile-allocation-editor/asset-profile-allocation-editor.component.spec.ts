/* eslint-disable @angular-eslint/component-selector */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { firstValueFrom } from 'rxjs';

import { GfAssetProfileAllocationEditorComponent } from './asset-profile-allocation-editor.component';

jest.mock('@ionic/angular/standalone', () => {
  const { Component } = require('@angular/core');

  @Component({
    selector: 'ion-icon',
    template: '',
    standalone: true
  })
  class MockIonIcon {}

  return {
    IonIcon: MockIonIcon
  };
});

describe('GfAssetProfileAllocationEditorComponent', () => {
  let component: GfAssetProfileAllocationEditorComponent;
  let fixture: ComponentFixture<GfAssetProfileAllocationEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GfAssetProfileAllocationEditorComponent],
      providers: [provideAnimations()]
    }).compileComponents();

    fixture = TestBed.createComponent(GfAssetProfileAllocationEditorComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.componentRef.setInput('type', 'country');
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should populate countryList', () => {
    fixture.componentRef.setInput('type', 'country');
    fixture.detectChanges();
    const countryList = component['countryList'];
    console.log('TEST LOG: countryList length is:', countryList?.length);
    if (countryList && countryList.length > 0) {
      console.log('TEST LOG: First country is:', countryList[0]);
    }
    expect(countryList?.length).toBeGreaterThan(0);
  });

  it('should emit filtered countries when initialized as country type', async () => {
    fixture.componentRef.setInput('type', 'country');
    fixture.detectChanges();

    const options = await firstValueFrom(component.filteredOptions);
    console.log('TEST LOG: filteredOptions emitted:', options);
    expect(options.length).toBeGreaterThan(0);
  });
});
