// ---------------------------------------------------------------------------
// Shared Cross-Context Ambient Type Declarations
// ---------------------------------------------------------------------------
// This file contains ambient type declarations that are available globally
// across ALL process contexts (main, preload, renderer).
//
// Rules for this file:
//   - Only place types here that are truly needed in 2+ process contexts
//     AND that make sense as global ambient declarations (no import needed).
//   - For shared types that can be imported as modules, prefer:
//     src/shared/ipc.ts          — IPC result envelopes
//     src/shared/ipc-channels.ts — IPC channel names and contracts
//     src/shared/channels        — messaging channel domain types
//   - Do NOT import Electron, Node.js, React, or browser APIs here.
//
// Included by:
//   - tsconfig.node.json
//   - tsconfig.web.json
// ---------------------------------------------------------------------------

// (Add cross-context global augmentations here when needed.)
                                                                                                                                                                                                                     
  declare const __APP_NAME__: string;                                                                                                                                                                                
  declare const __APP_VERSION__: string;                                                                                                                                                                             
  declare const __APP_AUTHOR__: string;                                                                                                                                                                              
  declare const __APP_HOMEPAGE__: string;
  declare const __APP_LICENSE__: string;                                                                                                                                                                             
