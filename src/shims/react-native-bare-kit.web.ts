// Minimal web shim for react-native-bare-kit to prevent TurboModule access on web
// Export shapes that downstream code may import without executing native calls

// Stub functions for NativeBareKit that are called but won't work on web
const stubNativeBareKit = {
  init: () => ({}) as any,
  update: () => {},
  read: () => null,
  write: () => 0,
  startFile: () => {},
  startUTF8: () => {},
  startBytes: () => {},
  suspend: () => {},
  resume: () => {},
  wakeup: () => {},
  terminate: () => {},
  getEnforcing: () => stubNativeBareKit,
};

export const NativeBareKit = stubNativeBareKit;
export const BareKit = stubNativeBareKit;

// Default export for the main module
export default stubNativeBareKit;


