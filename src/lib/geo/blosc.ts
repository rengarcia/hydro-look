/**
 * Decoding for the Blosc 1 frames that GEOGLOWS' Zarr v2 stores are chunked in.
 *
 * The return-period store (`s3://geoglows-v2/retrospective/return-periods.zarr`) compresses its
 * `river_id` chunks with Blosc-LZ4 and its value chunks with Blosc-Zstd, both byte-shuffled. There
 * is no Blosc in Node, and the store is read about once a year, so this implements the small part
 * of the format the store uses rather than taking a native dependency: the 16-byte header, the
 * block offsets, the per-block split streams, LZ4 block decoding, Zstd through `node:zlib`, and the
 * byte and bit unshuffle. A chunk can also be read a few blocks at a time, which is how one member of
 * a 15 MB forecast chunk is read by HTTP range. Anything else in the header (delta, another codec)
 * is refused, not guessed at. Tested on frames written by numcodecs.
 */

import { zstdDecompressSync } from "node:zlib";

const HEADER_BYTES = 16;
const FLAG_SHUFFLE = 0x01;
const FLAG_MEMCPYED = 0x02;
const FLAG_BITSHUFFLE = 0x04;
const FLAG_DELTA = 0x08;
const FLAG_DONT_SPLIT = 0x10;
/** Blosc splits a block into one stream per byte of the type only up to this type size... */
const MAX_SPLITS = 16;
/** ...and only when each stream would hold at least this many bytes. */
const MIN_BUFFERSIZE = 128;

/** The header stores a format code, not the compressor: LZ4 and LZ4HC share format 1. */
const CODECS = ["blosclz", "lz4", "snappy", "zlib", "zstd"] as const;

export interface BloscHeader {
  version: number;
  flags: number;
  typesize: number;
  nbytes: number;
  blocksize: number;
  cbytes: number;
  codec: (typeof CODECS)[number] | `unknown (${number})`;
}

export function bloscHeader(frame: Uint8Array): BloscHeader {
  if (frame.length < HEADER_BYTES) throw new Error(`blosc: frame of ${frame.length} bytes is shorter than its header`);
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const flags = frame[2]!;
  const code = flags >> 5;
  return {
    version: frame[0]!,
    flags,
    typesize: frame[3]!,
    nbytes: view.getUint32(4, true),
    blocksize: view.getUint32(8, true),
    cbytes: view.getUint32(12, true),
    codec: CODECS[code] ?? `unknown (${code})`,
  };
}

/** LZ4 block format (not the frame format): what Blosc stores per stream. */
export function lz4DecodeBlock(src: Uint8Array, outLength: number): Uint8Array {
  const out = new Uint8Array(outLength);
  let s = 0;
  let o = 0;
  while (s < src.length) {
    const token = src[s++]!;
    let literals = token >> 4;
    if (literals === 15) {
      let b: number;
      do {
        b = src[s++]!;
        literals += b;
      } while (b === 255);
    }
    if (o + literals > outLength || s + literals > src.length) throw new Error("lz4: literal run overflows the block");
    out.set(src.subarray(s, s + literals), o);
    s += literals;
    o += literals;
    if (s >= src.length) break; // the last sequence carries literals only
    const offset = src[s]! | (src[s + 1]! << 8);
    s += 2;
    if (offset === 0 || offset > o) throw new Error(`lz4: match offset ${offset} at output ${o} is out of range`);
    let length = (token & 0x0f) + 4;
    if ((token & 0x0f) === 15) {
      let b: number;
      do {
        b = src[s++]!;
        length += b;
      } while (b === 255);
    }
    if (o + length > outLength) throw new Error("lz4: match overflows the block");
    // Byte by byte: a match may overlap its own output (offset < length), which is how LZ4 encodes runs.
    for (let i = 0; i < length; i++, o++) out[o] = out[o - offset]!;
  }
  if (o !== outLength) throw new Error(`lz4: decoded ${o} bytes, expected ${outLength}`);
  return out;
}

function decodeStream(codec: BloscHeader["codec"], src: Uint8Array, outLength: number): Uint8Array {
  if (codec === "lz4") return lz4DecodeBlock(src, outLength);
  if (codec === "zstd") {
    const out = new Uint8Array(zstdDecompressSync(src));
    if (out.length !== outLength) throw new Error(`zstd: decoded ${out.length} bytes, expected ${outLength}`);
    return out;
  }
  throw new Error(`blosc: codec ${codec} is not supported`);
}

/** Undo Blosc's byte shuffle: the input holds every element's byte 0, then every byte 1, and so on. */
export function unshuffle(src: Uint8Array, typesize: number): Uint8Array {
  if (typesize <= 1) return src;
  const out = new Uint8Array(src.length);
  const n = Math.floor(src.length / typesize);
  for (let b = 0; b < typesize; b++) {
    const base = b * n;
    for (let i = 0; i < n; i++) out[i * typesize + b] = src[base + i]!;
  }
  // Bytes past the last whole element are not shuffled.
  out.set(src.subarray(n * typesize), n * typesize);
  return out;
}

/**
 * Undo Blosc's bit shuffle (bitshuffle's `bshuf_untrans_bit_elem`): the input is one row of bits
 * per bit of the element — byte 0's bit 0 of every element, then byte 0's bit 1, and so on — each
 * row packed least significant bit first. It works on whole groups of eight elements; format
 * version 2 frames leave a block that is not one unshuffled, later versions only its tail.
 */
export function bitUnshuffle(src: Uint8Array, typesize: number, version = 2): Uint8Array {
  const total = Math.floor(src.length / typesize);
  if (version <= 2 && total % 8 !== 0) return src;
  const n = total - (total % 8);
  const out = new Uint8Array(src.length);
  const rowBytes = n / 8;
  for (let k = 0; k < typesize; k++) {
    for (let b = 0; b < 8; b++) {
      const row = (k * 8 + b) * rowBytes;
      const mask = 1 << b;
      for (let byte = 0; byte < rowBytes; byte++) {
        const v = src[row + byte]!;
        if (v === 0) continue;
        for (let t = 0; t < 8; t++) if ((v >> t) & 1) out[(byte * 8 + t) * typesize + k]! |= mask;
      }
    }
  }
  out.set(src.subarray(n * typesize), n * typesize);
  return out;
}

/** Where each block of a frame starts; read from the frame's first `16 + 4 × blocks` bytes. */
export interface BloscIndex {
  header: BloscHeader;
  /** Offset of each block in the frame, and the frame's length after the last. */
  starts: number[];
}

/** The bytes a frame's index needs: its header, then one 32-bit offset per block. */
export function bloscIndexBytes(header: BloscHeader): number {
  return HEADER_BYTES + 4 * Math.ceil(header.nbytes / header.blocksize);
}

export function bloscIndex(prefix: Uint8Array): BloscIndex {
  const header = bloscHeader(prefix);
  if (header.flags & FLAG_MEMCPYED) throw new Error("blosc: a stored frame has no block index");
  const nblocks = Math.ceil(header.nbytes / header.blocksize);
  if (prefix.length < bloscIndexBytes(header))
    throw new Error(`blosc: the index needs ${bloscIndexBytes(header)} bytes, got ${prefix.length}`);
  const view = new DataView(prefix.buffer, prefix.byteOffset, prefix.byteLength);
  const starts = Array.from({ length: nblocks }, (_, i) => view.getInt32(HEADER_BYTES + 4 * i, true));
  return { header, starts: [...starts, header.cbytes] };
}

/**
 * The blocks holding decompressed bytes `[from, to)`, and the compressed byte range that holds
 * those blocks — what to ask for with an HTTP range request instead of the whole chunk. Blosc
 * writes blocks in order, so the range is contiguous.
 */
export function blocksFor(index: BloscIndex, from: number, to: number): { first: number; last: number; byteFrom: number; byteTo: number } {
  const { blocksize, nbytes } = index.header;
  if (from < 0 || to > nbytes || from >= to) throw new Error(`blosc: [${from}, ${to}) is outside the frame's ${nbytes} bytes`);
  const first = Math.floor(from / blocksize);
  const last = Math.floor((to - 1) / blocksize);
  return { first, last, byteFrom: index.starts[first]!, byteTo: index.starts[last + 1]! };
}

function decodeBlock(h: BloscHeader, bytes: Uint8Array, offset: number, i: number): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const bsize = Math.min(h.blocksize, h.nbytes - i * h.blocksize);
  const split =
    !(h.flags & FLAG_DONT_SPLIT) && h.typesize <= MAX_SPLITS && bsize === h.blocksize && h.blocksize / h.typesize >= MIN_BUFFERSIZE;
  const nsplits = split ? h.typesize : 1;
  const neblock = bsize / nsplits;
  const block = new Uint8Array(bsize);
  let s = offset;
  for (let j = 0; j < nsplits; j++) {
    const csize = view.getInt32(s, true);
    s += 4;
    const src = bytes.subarray(s, s + csize);
    // A stream that did not compress is stored as is, and says so by its size.
    block.set(csize === neblock ? src : decodeStream(h.codec, src, neblock), j * neblock);
    s += csize;
  }
  if (h.flags & FLAG_BITSHUFFLE && h.typesize > 1) return bitUnshuffle(block, h.typesize, h.version);
  return h.flags & FLAG_SHUFFLE ? unshuffle(block, h.typesize) : block;
}

function checkFlags(h: BloscHeader): void {
  if (h.version !== 2 && h.version !== 1) throw new Error(`blosc: format version ${h.version} is not supported`);
  if (h.flags & FLAG_DELTA) throw new Error(`blosc: flags 0x${h.flags.toString(16)} (delta) are not supported`);
}

/**
 * Blocks `first..last` of a frame, from `bytes` — the frame's compressed bytes starting at frame
 * offset `byteFrom`, as `blocksFor` gives them. Returns the decompressed bytes from the start of
 * block `first`.
 */
export function decodeBlocks(index: BloscIndex, bytes: Uint8Array, byteFrom: number, first: number, last: number): Uint8Array {
  const h = index.header;
  checkFlags(h);
  const end = Math.min(h.nbytes, (last + 1) * h.blocksize);
  const out = new Uint8Array(end - first * h.blocksize);
  for (let i = first; i <= last; i++) out.set(decodeBlock(h, bytes, index.starts[i]! - byteFrom, i), (i - first) * h.blocksize);
  return out;
}

export function bloscDecompress(frame: Uint8Array): Uint8Array {
  const h = bloscHeader(frame);
  checkFlags(h);
  if (h.cbytes !== frame.length) throw new Error(`blosc: header says ${h.cbytes} compressed bytes, frame has ${frame.length}`);
  if (h.flags & FLAG_MEMCPYED) {
    if (frame.length - HEADER_BYTES < h.nbytes) throw new Error("blosc: stored frame is truncated");
    return frame.slice(HEADER_BYTES, HEADER_BYTES + h.nbytes);
  }
  const index = bloscIndex(frame);
  return decodeBlocks(index, frame, 0, 0, index.starts.length - 2);
}
