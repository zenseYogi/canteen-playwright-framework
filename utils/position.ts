export type Position = 'first' | 'second' | 'third' | 'fourth';

const ORDER: Position[] = ['first', 'second', 'third', 'fourth'];

/**
 * Converts a named position to a numeric index. `base` picks the offset:
 * 0 for direct array/element-list indexing (e.g. `elements[index]`), 1 for
 * building an XPath positional predicate (XPath positions are 1-indexed).
 *
 * Ported from common_keywords.robot, which had two separate keywords for
 * this ("Convert position to index value" and "set index based on
 * position") - one per base - because RF has no parameter defaults. Collapsed
 * into one function here; every call site should be explicit about which
 * base it needs rather than relying on which keyword happened to get called.
 */
export function positionToIndex(position: Position, base: 0 | 1 = 0): number {
  const zeroBased = ORDER.indexOf(position);
  if (zeroBased === -1) {
    throw new Error(`Unknown position "${position}"`);
  }
  return zeroBased + base;
}
