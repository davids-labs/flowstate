// Firebase module
export * from './auth';
export * from './sync';
// NOTE: config.ts exports are used internally by auth.ts and sync.ts.
// Do not re-export config to avoid exposing Firebase internals.
