import { of } from 'rxjs';
of(1).subscribe(v => of(2).subscribe(inner => console.log(v, inner)));
