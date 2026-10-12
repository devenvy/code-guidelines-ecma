import { Pipe, type PipeTransform } from '@angular/core';

@Pipe({ name: 'appShout' })
export class ShoutPipe implements PipeTransform {
  transform(value: string): string {
    return value.toUpperCase();
  }
}
