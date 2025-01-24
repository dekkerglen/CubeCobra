export const createTypeGuard = <T extends string>(validValues: readonly T[]) => {
  return (value: unknown): value is T => validValues.includes(value as T);
};
