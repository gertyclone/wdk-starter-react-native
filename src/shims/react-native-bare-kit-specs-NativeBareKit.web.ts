// Web shim for react-native-bare-kit/specs/NativeBareKit
// This prevents TurboModule access on web platform

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

export default stubNativeBareKit;
