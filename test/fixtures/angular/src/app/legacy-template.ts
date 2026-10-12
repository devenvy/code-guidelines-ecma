import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

@Component({
  selector: 'app-legacy',
  template: '<p *ngIf="visible()">shown</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Legacy {
  protected readonly visible = signal(true);
}
