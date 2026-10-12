import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-bar',
  template: `<div class="bar" [style.width.%]="percent()"></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Bar {
  readonly percent = input.required<number>();
}
