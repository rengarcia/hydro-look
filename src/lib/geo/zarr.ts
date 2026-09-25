/**
 * A Zarr v2 reader for the three GEOGLOWS stores this repository reads: the return periods, the
 * daily retrospective simulation and the daily forecasts. Each is a consolidated store on a public
 * bucket whose arrays are Blosc-compressed and C-ordered, and each has a river-id index array that
 * is not sorted. That is all this handles; anything else about an array is refused by `arrayMeta`.
 *
 * Nothing here opens a socket: the caller passes `get` (whole object) and, for reading a few blocks
 * of a big chunk, `getRange`. The script supplies both over HTTP; the tests supply them over bytes.
 */

import { blockExtent, blocksFor, bloscDecompress, bloscHeader, bloscIndex, bloscIndexBytes, decodeBlocks } from "./blosc.ts";

export interface ZarrArrayMeta {
  shape: number[];
  chunks: number[];
  dtype: "<i4" | "<i8" | "<f4" | "<f8";
  fillValue: number | null;
}

export interface ZarrSource {
  /** An object's bytes by key, or null when it does not exist. */
  get(key: string): Promise<Uint8Array | null>;
  /** Bytes `[from, to)` of an object. */
  getRange(key: string, from: number, to: number): Promise<Uint8Array>;
}

const BYTES: Record<ZarrArrayMeta["dtype"], number> = { "<i4": 4, "<i8": 8, "<f4": 4, "<f8": 8 };

export type Consolidated = Record<string, Record<string, unknown>>;

export async function readConsolidated(source: ZarrSource): Promise<Consolidated> {
  const bytes = await source.get(".zmetadata");
  if (!bytes) throw new Error("zarr: the store is not consolidated (no .zmetadata)");
  return (JSON.parse(new TextDecoder().decode(bytes)) as { metadata: Consolidated }).metadata;
}

export function arrayMeta(metadata: Consolidated, name: string): ZarrArrayMeta {
  const a = metadata[`${name}/.zarray`];
  if (!a) throw new Error(`zarr: the store has no array ${name}`);
  const compressor = a["compressor"] as { id?: string } | null;
  if (a["order"] !== "C" || (a["filters"] ?? null) !== null)
    throw new Error(`zarr: ${name} uses an order or filters this reader does not handle`);
  if (compressor?.id !== "blosc") throw new Error(`zarr: ${name} is not Blosc-compressed`);
  if ((a["dimension_separator"] ?? ".") !== ".") throw new Error(`zarr: ${name} does not separate chunk keys with "."`);
  const dtype = a["dtype"] as string;
  if (!(dtype in BYTES)) throw new Error(`zarr: ${name} has dtype ${dtype}, which this reader does not handle`);
  const fill = a["fill_value"];
  return {
    shape: a["shape"] as number[],
    chunks: a["chunks"] as number[],
    dtype: dtype as ZarrArrayMeta["dtype"],
    fillValue: fill === "NaN" ? NaN : typeof fill === "number" ? fill : null,
  };
}

/** A decoded chunk as numbers (an `<i8` chunk's values are converted; river ids and years fit). */
export function typedValues(bytes: Uint8Array, dtype: ZarrArrayMeta["dtype"]): ArrayLike<number> {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  switch (dtype) {
    case "<i4":
      return new Int32Array(buffer);
    case "<i8":
      return Array.from(new BigInt64Array(buffer), Number);
    case "<f4":
      return new Float32Array(buffer);
    case "<f8":
      return new Float64Array(buffer);
  }
}

export const chunkKey = (name: string, index: readonly number[]): string => `${name}/${index.join(".")}`;

/** A whole chunk, decoded. A chunk that was never written is the fill value throughout. */
export async function readChunk(
  source: ZarrSource,
  name: string,
  meta: ZarrArrayMeta,
  index: readonly number[],
): Promise<ArrayLike<number>> {
  const bytes = await source.get(chunkKey(name, index));
  if (!bytes) return new Float64Array(meta.chunks.reduce((a, b) => a * b, 1)).fill(meta.fillValue ?? NaN);
  return typedValues(bloscDecompress(bytes), meta.dtype);
}

/** Where each wanted id sits along a one-dimensional index array such as `river_id` or `rivid`. */
export async function positionsOf(
  source: ZarrSource,
  name: string,
  meta: ZarrArrayMeta,
  wanted: readonly number[],
): Promise<Map<number, number>> {
  const want = new Set(wanted);
  const found = new Map<number, number>();
  const chunks = Math.ceil(meta.shape[0]! / meta.chunks[0]!);
  for (let c = 0; c < chunks && found.size < want.size; c++) {
    const values = await readChunk(source, name, meta, [c]);
    for (let i = 0; i < values.length; i++) if (want.has(values[i]!)) found.set(values[i]!, c * meta.chunks[0]! + i);
  }
  return found;
}

/**
 * The C-order element range `[from, to)` of one chunk, reading only the Blosc blocks that hold it:
 * a header-and-index request, then one range request per block. For a 15 MB forecast chunk whose
 * last ensemble member is the one wanted, that is about half a megabyte instead of all of it.
 */
export async function readChunkRange(
  source: ZarrSource,
  name: string,
  meta: ZarrArrayMeta,
  index: readonly number[],
  from: number,
  to: number,
): Promise<ArrayLike<number>> {
  const key = chunkKey(name, index);
  const size = BYTES[meta.dtype];
  const head = await source.getRange(key, 0, 16);
  const prefix = await source.getRange(key, 0, bloscIndexBytes(bloscHeader(head)));
  const blosc = bloscIndex(prefix);
  const { first, last } = blocksFor(blosc, from * size, to * size);
  const blocks = new Map<number, Uint8Array>();
  for (let i = first; i <= last; i++) {
    const extent = blockExtent(blosc, i);
    blocks.set(i, await source.getRange(key, extent.from, extent.to));
  }
  const decoded = decodeBlocks(blosc, first, last, (i) => blocks.get(i)!);
  const offset = from * size - first * blosc.header.blocksize;
  return typedValues(decoded.subarray(offset, offset + (to - from) * size), meta.dtype);
}
