import '@testing-library/jest-dom/vitest';

// jsdom lacks these browser APIs used by the UI.
class IO {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
Object.assign(globalThis, { IntersectionObserver: IO, ResizeObserver: IO });
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as unknown as MediaQueryList;
}
window.scrollTo = () => {};
