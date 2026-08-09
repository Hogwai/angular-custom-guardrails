import { of } from 'rxjs';
import { map, filter } from 'rxjs/operators';
const s = of(1).pipe(map((x: number) => x), filter(Boolean));
