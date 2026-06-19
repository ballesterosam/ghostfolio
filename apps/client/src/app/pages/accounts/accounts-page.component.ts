import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  host: { class: 'page' },
  imports: [RouterModule],
  selector: 'gf-accounts-page',
  template: '<div class="flex-grow-1 overflow-auto"><router-outlet /></div>'
})
export class GfAccountsPageComponent {}
