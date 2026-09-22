/**
 * Gradient-boosted regression trees, small enough to read in one sitting.
 *
 * Section 7's M4 asks for LightGBM quantile regression. Decision 6 keeps the pipeline in
 * TypeScript, and there is no gradient-boosting library in that stack, so M4 was deferred — not
 * because the method is wrong but because there was nothing to run it with. This is the
 * nothing-to-run-it-with fixed, in about three hundred lines and no dependencies, so the rung
 * can be measured on the same backtest as every other rung rather than argued about.
 *
 * What it is, precisely, so nobody mistakes it for LightGBM:
 *
 * - **Histogram splits.** Every feature is cut once into at most `maxBins` quantile bins before
 *   the first tree, and each node's split search is a pass over bins rather than over sorted
 *   values. Bin 0 is reserved for missing values (NaN), which always go left; a feature that is
 *   missing for the first years of the record simply sits in that bin.
 * - **Depth-limited trees, grown level by level**, with a minimum leaf size. The split criterion
 *   is squared error on the pseudo-residuals (Friedman's gradient boosting), with an optional
 *   L2 penalty on leaf values for the squared loss.
 * - **Shrinkage and row subsampling** (stochastic gradient boosting), with optional feature
 *   subsampling per tree. All randomness comes from one seeded generator, so the same inputs
 *   and options produce the same model bit for bit.
 * - **Two losses.** Squared error, whose leaves are the mean residual; and the pinball loss at
 *   quantile α, whose pseudo-residual is α above the current fit and α − 1 below it, and whose
 *   leaves are then re-estimated as the α-quantile of the residuals that landed in them — the
 *   line search that makes gradient boosting a quantile regression rather than a sign fit.
 *
 * What it is not: no leaf-wise growth, no exclusive feature bundling, no GOSS, no categorical
 * splits, no early stopping. None of those change what a tree can represent; they make large
 * problems fast, and this problem is a few thousand rows.
 */

import { quantile } from "../util/stats.ts";

export type GbmLoss = { kind: "squared" } | { kind: "quantile"; alpha: number };

export interface GbmOptions {
  loss: GbmLoss;
  trees: number;
  learningRate: number;
  maxDepth: number;
  /** Fewest training rows a leaf may hold. */
  minLeaf: number;
  /** Share of rows each tree is fitted on, drawn without replacement. 1 disables subsampling. */
  subsample: number;
  /** Share of features each tree may split on. 1 disables it. */
  featureFraction: number;
  /** At most 255: bins are stored in bytes, and bin 0 is reserved for missing values. */
  maxBins: number;
  /** L2 penalty on leaf values; used by the squared loss only. */
  l2: number;
  seed: number;
}

export const DEFAULT_GBM: Omit<GbmOptions, "loss"> = {
  trees: 200,
  learningRate: 0.05,
  maxDepth: 3,
  minLeaf: 20,
  subsample: 0.8,
  featureFraction: 1,
  maxBins: 32,
  l2: 0,
  seed: 1,
};

/** Mulberry32: a 32-bit generator whose whole state is one integer, so a seed pins it exactly. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A feature matrix cut into bins once, so several models on the same rows share the work. */
export interface BinnedMatrix {
  rows: number;
  features: number;
  /** Row-major: bin of row `i` for feature `f` is `bins[i * features + f]`. */
  bins: Uint8Array;
  /** Per feature, ascending upper edges: bin `k` (k ≥ 1) holds values `≤ edges[k - 1]`. */
  edges: Float64Array[];
  /** Histogram slots per feature: the largest bin count over all features. */
  width: number;
}

function binOf(edges: Float64Array, value: number): number {
  if (Number.isNaN(value)) return 0;
  // Count of edges strictly below the value, plus one: the first bin whose edge is ≥ value.
  let low = 0;
  let high = edges.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (edges[mid]! < value) low = mid + 1;
    else high = mid;
  }
  return low + 1;
}

/**
 * Quantile bin edges from the observed values. When a feature has fewer distinct values than
 * bins, every distinct value gets its own bin and the edges sit on the values themselves, so a
 * binary or low-cardinality feature is split exactly.
 */
function edgesFor(values: number[], maxBins: number): Float64Array {
  const present = values.filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
  if (present.length === 0) return new Float64Array(0);
  const distinct: number[] = [];
  for (const v of present) if (distinct.length === 0 || v !== distinct[distinct.length - 1]) distinct.push(v);
  const usable = maxBins - 1; // bin 0 is missing
  if (distinct.length <= usable) return Float64Array.from(distinct.slice(0, -1));
  const out: number[] = [];
  for (let k = 1; k < usable; k++) {
    const edge = present[Math.floor((k * (present.length - 1)) / usable)]!;
    if (out.length === 0 || edge > out[out.length - 1]!) out.push(edge);
  }
  // The top bin must hold the maximum, so the last edge must sit below it.
  while (out.length > 0 && out[out.length - 1]! >= present[present.length - 1]!) out.pop();
  return Float64Array.from(out);
}

export function binMatrix(rows: readonly (readonly number[])[], maxBins: number = DEFAULT_GBM.maxBins): BinnedMatrix {
  if (maxBins < 2 || maxBins > 255) throw new Error(`maxBins must be in 2..255, got ${maxBins}`);
  const n = rows.length;
  const features = n === 0 ? 0 : rows[0]!.length;
  const bins = new Uint8Array(n * features);
  const edges: Float64Array[] = [];
  let width = 2;
  for (let f = 0; f < features; f++) {
    const column = rows.map((row) => row[f]!);
    const cut = edgesFor(column, maxBins);
    edges.push(cut);
    width = Math.max(width, cut.length + 2);
    for (let i = 0; i < n; i++) bins[i * features + f] = binOf(cut, column[i]!);
  }
  return { rows: n, features, bins, edges, width };
}

/** A tree as parallel arrays; node 0 is the root and `feature === -1` marks a leaf. */
export interface Tree {
  feature: Int32Array;
  /** Raw-value threshold: a row goes left when its value is `≤ threshold` or missing. */
  threshold: Float64Array;
  left: Int32Array;
  right: Int32Array;
  value: Float64Array;
}

export interface GbmModel {
  loss: GbmLoss;
  base: number;
  learningRate: number;
  features: number;
  trees: Tree[];
}

interface Split {
  feature: number;
  bin: number;
  gain: number;
}

interface GrowingNode {
  rows: Int32Array;
  depth: number;
  index: number;
  /** Gradient sums and row counts per feature and bin, `[f * width + b]`. */
  sums: Float64Array;
  counts: Float64Array;
}

interface NodeSpec {
  feature: number;
  bin: number;
  threshold: number;
  left: number;
  right: number;
}

function histogram(data: BinnedMatrix, gradient: Float64Array, rows: Int32Array): { sums: Float64Array; counts: Float64Array } {
  const F = data.features;
  const W = data.width;
  const sums = new Float64Array(F * W);
  const counts = new Float64Array(F * W);
  const bins = data.bins;
  for (let r = 0; r < rows.length; r++) {
    const i = rows[r]!;
    const g = gradient[i]!;
    const base = i * F;
    for (let f = 0; f < F; f++) {
      const slot = f * W + bins[base + f]!;
      sums[slot] = sums[slot]! + g;
      counts[slot] = counts[slot]! + 1;
    }
  }
  return { sums, counts };
}

/**
 * One tree on the rows in `sample`, split on `gradient`. Leaves are left at zero here and filled
 * in by the caller, because what a leaf should hold depends on the loss.
 *
 * Only the smaller child of each split has its histogram built from rows; the larger one's is
 * the parent's minus it. That is exact — the same sums, reached by subtraction — and roughly
 * halves the work below the root.
 */
function growTree(
  data: BinnedMatrix,
  gradient: Float64Array,
  sample: Int32Array,
  allowed: readonly number[],
  options: GbmOptions,
): { nodes: NodeSpec[]; leaves: Map<number, Int32Array> } {
  const nodes: NodeSpec[] = [];
  const leaves = new Map<number, Int32Array>();
  const F = data.features;
  const W = data.width;
  const lambda = options.loss.kind === "squared" ? options.l2 : 0;

  nodes.push({ feature: -1, bin: 0, threshold: 0, left: -1, right: -1 });
  let frontier: GrowingNode[] = [{ rows: sample, depth: 0, index: 0, ...histogram(data, gradient, sample) }];

  while (frontier.length > 0) {
    const next: GrowingNode[] = [];
    for (const node of frontier) {
      const rows = node.rows;
      let best: Split | null = null;
      if (node.depth < options.maxDepth && rows.length >= 2 * options.minLeaf) {
        let total = 0;
        for (let r = 0; r < rows.length; r++) total += gradient[rows[r]!]!;
        const parentScore = (total * total) / (rows.length + lambda);

        for (const f of allowed) {
          const binCount = data.edges[f]!.length + 2;
          const offset = f * W;
          let leftSum = 0;
          let leftCount = 0;
          // Split after bin `b`: bins 0..b go left. `b = 0` sends only the missing values left,
          // which is how a tree learns that "not measured yet" means something. The last bin
          // can never be the cut.
          for (let b = 0; b < binCount - 1; b++) {
            leftSum += node.sums[offset + b]!;
            leftCount += node.counts[offset + b]!;
            const rightCount = rows.length - leftCount;
            if (leftCount < options.minLeaf) continue;
            if (rightCount < options.minLeaf) break;
            const rightSum = total - leftSum;
            const gain =
              (leftSum * leftSum) / (leftCount + lambda) + (rightSum * rightSum) / (rightCount + lambda) - parentScore;
            if (gain > 1e-12 && (best === null || gain > best.gain)) best = { feature: f, bin: b, gain };
          }
        }
      }

      if (best === null) {
        leaves.set(node.index, rows);
        continue;
      }
      let leftSize = 0;
      for (let r = 0; r < rows.length; r++) if (data.bins[rows[r]! * F + best.feature]! <= best.bin) leftSize++;
      const leftRows = new Int32Array(leftSize);
      const rightRows = new Int32Array(rows.length - leftSize);
      let l = 0;
      let rr = 0;
      for (let r = 0; r < rows.length; r++) {
        const i = rows[r]!;
        if (data.bins[i * F + best.feature]! <= best.bin) leftRows[l++] = i;
        else rightRows[rr++] = i;
      }
      const leftIndex = nodes.length;
      nodes.push({ feature: -1, bin: 0, threshold: 0, left: -1, right: -1 });
      const rightIndex = nodes.length;
      nodes.push({ feature: -1, bin: 0, threshold: 0, left: -1, right: -1 });
      nodes[node.index] = {
        feature: best.feature,
        bin: best.bin,
        threshold: best.bin === 0 ? Number.NEGATIVE_INFINITY : data.edges[best.feature]![best.bin - 1]!,
        left: leftIndex,
        right: rightIndex,
      };

      // Children that cannot split need no histogram at all.
      const childDepth = node.depth + 1;
      const needs = childDepth < options.maxDepth;
      let leftHist = { sums: node.sums, counts: node.counts };
      let rightHist = leftHist;
      if (needs) {
        const smallIsLeft = leftRows.length <= rightRows.length;
        const small = histogram(data, gradient, smallIsLeft ? leftRows : rightRows);
        const large = { sums: new Float64Array(F * W), counts: new Float64Array(F * W) };
        for (let k = 0; k < F * W; k++) {
          large.sums[k] = node.sums[k]! - small.sums[k]!;
          large.counts[k] = node.counts[k]! - small.counts[k]!;
        }
        leftHist = smallIsLeft ? small : large;
        rightHist = smallIsLeft ? large : small;
      }
      next.push({ rows: leftRows, depth: childDepth, index: leftIndex, ...leftHist });
      next.push({ rows: rightRows, depth: childDepth, index: rightIndex, ...rightHist });
    }
    frontier = next;
  }
  return { nodes, leaves };
}

/**
 * `k` of `n` row indices without replacement, in ascending order: selection sampling (Knuth's
 * algorithm S), one draw per row and no sort.
 */
function drawSample(n: number, share: number, random: () => number): Int32Array {
  const k = share >= 1 ? n : Math.max(1, Math.round(n * share));
  const out = new Int32Array(k);
  if (k === n) {
    for (let i = 0; i < n; i++) out[i] = i;
    return out;
  }
  let chosen = 0;
  for (let i = 0; i < n && chosen < k; i++) {
    if (random() * (n - i) < k - chosen) out[chosen++] = i;
  }
  return out;
}

function drawFeatures(count: number, share: number, random: () => number): number[] {
  const all = Array.from({ length: count }, (_, i) => i);
  if (share >= 1) return all;
  const k = Math.max(1, Math.round(count * share));
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(random() * (count - i));
    [all[i], all[j]] = [all[j]!, all[i]!];
  }
  return all.slice(0, k).sort((a, b) => a - b);
}

/** `quantile` from `util/stats`, on a typed array it is allowed to sort in place. */
function quantileInPlace(values: Float64Array, q: number): number {
  values.sort();
  if (values.length === 1) return values[0]!;
  const position = q * (values.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return values[lower]!;
  return values[lower]! + (values[upper]! - values[lower]!) * (position - lower);
}

export function fitGbmBinned(data: BinnedMatrix, target: readonly number[], options: GbmOptions): GbmModel {
  if (target.length !== data.rows) throw new Error(`target has ${target.length} rows, matrix has ${data.rows}`);
  if (data.rows === 0) throw new Error("cannot fit on zero rows");
  const random = seededRandom(options.seed);
  const loss = options.loss;
  const alpha = loss.kind === "quantile" ? loss.alpha : 0.5;
  const base = loss.kind === "squared" ? target.reduce((a, b) => a + b, 0) / target.length : quantile(target, alpha)!;
  const F = data.features;

  const fitted = new Float64Array(data.rows).fill(base);
  const gradient = new Float64Array(data.rows);
  const trees: Tree[] = [];

  for (let t = 0; t < options.trees; t++) {
    // The negative gradient: the residual for squared error, and for the pinball loss α above
    // the current fit and α − 1 at or below it.
    if (loss.kind === "squared") {
      for (let i = 0; i < data.rows; i++) gradient[i] = target[i]! - fitted[i]!;
    } else {
      for (let i = 0; i < data.rows; i++) gradient[i] = target[i]! > fitted[i]! ? alpha : alpha - 1;
    }
    const sample = drawSample(data.rows, options.subsample, random);
    const allowed = drawFeatures(F, options.featureFraction, random);
    const { nodes, leaves } = growTree(data, gradient, sample, allowed, options);

    const tree: Tree = {
      feature: Int32Array.from(nodes.map((node) => node.feature)),
      threshold: Float64Array.from(nodes.map((node) => node.threshold)),
      left: Int32Array.from(nodes.map((node) => node.left)),
      right: Int32Array.from(nodes.map((node) => node.right)),
      value: new Float64Array(nodes.length),
    };
    const cuts = Int32Array.from(nodes.map((node) => node.bin));
    for (const [index, rows] of leaves) {
      let value: number;
      if (loss.kind === "squared") {
        let sum = 0;
        for (let r = 0; r < rows.length; r++) sum += gradient[rows[r]!]!;
        value = sum / (rows.length + options.l2);
      } else {
        const residuals = new Float64Array(rows.length);
        for (let r = 0; r < rows.length; r++) residuals[r] = target[rows[r]!]! - fitted[rows[r]!]!;
        value = quantileInPlace(residuals, alpha);
      }
      tree.value[index] = value;
    }
    trees.push(tree);

    // Every row moves, not only the sampled ones: the next tree's gradient is on the full fit.
    const step = options.learningRate;
    for (let i = 0; i < data.rows; i++) {
      let node = 0;
      while (tree.feature[node]! !== -1) {
        const b = data.bins[i * F + tree.feature[node]!]!;
        node = b <= cuts[node]! ? tree.left[node]! : tree.right[node]!;
      }
      fitted[i] = fitted[i]! + step * tree.value[node]!;
    }
  }
  return { loss, base, learningRate: options.learningRate, features: F, trees };
}

export function fitGbm(rows: readonly (readonly number[])[], target: readonly number[], options: GbmOptions): GbmModel {
  return fitGbmBinned(binMatrix(rows, options.maxBins), target, options);
}

function treeValue(tree: Tree, row: ArrayLike<number>): number {
  let node = 0;
  while (tree.feature[node]! !== -1) {
    const value = row[tree.feature[node]!]!;
    node = Number.isNaN(value) || value <= tree.threshold[node]! ? tree.left[node]! : tree.right[node]!;
  }
  return tree.value[node]!;
}

export function predictGbm(model: GbmModel, row: ArrayLike<number>): number {
  if (row.length !== model.features) throw new Error(`row has ${row.length} features, model has ${model.features}`);
  let out = model.base;
  for (const tree of model.trees) out += model.learningRate * treeValue(tree, row);
  return out;
}
