import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'foo-widget',
  template: '<p>widget</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Widget {}
