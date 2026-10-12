import { computed, signal } from '@angular/core';

const FACTOR = 2;
const reader = { valueOf: <T>(source: () => T): T => source() };
const count = signal(1);

export const doubled = computed(() => {
  const { valueOf } = reader;
  return valueOf(count) * FACTOR;
});
