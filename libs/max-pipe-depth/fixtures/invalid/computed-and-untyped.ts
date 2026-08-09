/**
 * Computed access on an explicitly untyped (`any`) source.
 * The member name is statically `pipe` and the call exceeds the default max,
 * so the strict any/unknown policy must report it.
 */
declare const source$: any;
source$['pipe'](1, 2, 3, 4);
