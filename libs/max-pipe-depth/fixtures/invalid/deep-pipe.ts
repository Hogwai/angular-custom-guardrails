import { of } from 'rxjs';
import { map, filter, tap, take } from 'rxjs/operators';
const s = of(1).pipe(map((x: number) => x), filter(Boolean), tap(() => {}), take(1));
