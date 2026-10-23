// Typed custom events shared between modules.
export {};

declare global {
  interface DocumentEventMap {
    /** detail = Segment id; selects that layer in "The Stack of a Career". */
    'stack:select': CustomEvent<string>;
  }
}
