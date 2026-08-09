import { of } from 'rxjs';
const outer$ = of(1);
const inner$ = of(2);
outer$.subscribe((v: number) => console.log(v));
inner$.subscribe((v: number) => console.log(v));
