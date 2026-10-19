/**
 * Remaps a list of original card indices onto their positions in a filtered list.
 *
 * A null map means no filter is active, so the indices pass through untouched. Indices that
 * were filtered out have no entry in the map and are dropped.
 */
export const applyIndexMap = (indices: number[], indexMap: Map<number, number> | null): number[] =>
  indexMap === null ? indices : (indices.map((i) => indexMap.get(i)).filter((i) => i !== undefined) as number[]);

export default applyIndexMap;
