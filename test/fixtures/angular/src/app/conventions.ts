import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-toggle',
  template: `<button type="button" (click)="toggle()">{{ label() }}: {{ text() }}</button>`,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: Toggle, multi: true }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown.escape)': 'reset()' },
})
export class Toggle implements ControlValueAccessor {
  private readonly document = inject(DOCUMENT);
  readonly #touched = signal(false);
  readonly touched = this.#touched.asReadonly();
  readonly label = input('Toggle');
  readonly checked = model(false);
  readonly changed = output();
  protected readonly text = computed(() => (this.checked() ? 'on' : 'off'));
  private onChange: (value: boolean) => void = () => {
    // replaced by registerOnChange
  };

  constructor() {
    effect(() => {
      this.document.title = this.text();
    });
  }

  toggle(): void {
    this.checked.update((value) => !value);
    this.onChange(this.checked());
    this.changed.emit();
  }

  reset(): void {
    this.checked.set(false);
  }

  writeValue(value: boolean): void {
    this.checked.set(value);
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(): void {
    this.#touched.set(true);
  }
}
