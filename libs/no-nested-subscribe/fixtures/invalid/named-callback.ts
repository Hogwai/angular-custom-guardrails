import { of } from 'rxjs';

const callback = () => {
  of(2).subscribe(() => {});
};

of(1).subscribe(callback);
