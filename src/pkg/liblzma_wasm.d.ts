/* tslint:disable */
/* eslint-disable */
/**
* @param {string} source
* @returns {Uint8Array}
*/
export function xz_compress(source: string): Uint8Array;
/**
* @param {Uint8Array} source
* @returns {Uint8Array}
*/
export function xz_decompress(source: Uint8Array): Uint8Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly xz_compress: (a: number, b: number, c: number) => void;
  readonly xz_decompress: (a: number, b: number) => void;
  readonly rust_lzma_wasm_shim_malloc: (a: number) => number;
  readonly rust_lzma_wasm_shim_calloc: (a: number, b: number) => number;
  readonly rust_lzma_wasm_shim_free: (a: number) => void;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {SyncInitInput} module
*
* @returns {InitOutput}
*/
export function initSync(module: SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
