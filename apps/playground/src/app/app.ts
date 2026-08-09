import { Component } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { of } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [AsyncPipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly users$ = of([
    { id: 'ada', name: 'Ada' },
    { id: 'linus', name: 'Linus' },
  ]).pipe(
    map((users) => users.filter(Boolean)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}
