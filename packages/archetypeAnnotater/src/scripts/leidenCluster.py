"""
Leiden community detection over deck embeddings — mirrors the draft simulator's
clustering (k-NN graph + Leiden modularity), which produces clean, well-separated
archetypes on these embeddings where UMAP->HDBSCAN(eom) collapses them.

Pipeline:
  1. Load 128-dim encoder embeddings (data/embeddings/embeddings.ndjson).
  2. Build an approximate cosine k-NN graph (pynndescent). Cached to .npz so
     re-sweeps are instant.
  3. Build an undirected weighted igraph, run Leiden (RBConfiguration modularity)
     at each --resolution in one pass over the same graph (cheap).
  4. Merge communities smaller than --min-cluster-size into their nearest large
     community (by embedding centroid cosine) so there are no junk clusters.
  5. Write data/clusters/clusters_res{r}.ndjson for every resolution, and copy the
     one whose community count is closest to --target-clusters to clusters.ndjson
     (the file prepareAppData consumes).

Writes: data/clusters/clusters_res{r}.ndjson (per resolution)
        data/clusters/clusters.ndjson         (auto-picked closest to target)
        data/clusters/leiden_summary.json      (resolution -> count + sizes)
        data/clusters/knn_cache.npz            (k-NN graph, for fast re-sweeps)

Usage (overnight, full set):
  .venv/Scripts/python src/scripts/leidenCluster.py --target-clusters 40
Fast calibration on a sample:
  .venv/Scripts/python src/scripts/leidenCluster.py --sample 30000
"""
import argparse
import json
import os
import time

import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, '..', '..', 'data')
EMBEDDINGS_PATH = os.path.join(DATA_DIR, 'embeddings', 'embeddings.ndjson')
CLUSTERS_DIR = os.path.join(DATA_DIR, 'clusters')


def log(msg):
    print(f'{time.strftime("%H:%M:%S")}  {msg}', flush=True)


def load_embeddings(path, sample=0):
    log(f'Loading embeddings from {path}...')
    deck_ids, embs = [], []
    with open(path, 'r') as f:
        for i, line in enumerate(f):
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            deck_ids.append(rec['deckId'])
            embs.append(rec['embedding'])
            if sample and len(deck_ids) >= sample:
                break
            if (i + 1) % 500_000 == 0:
                log(f'  {i + 1} loaded...')
    X = np.asarray(embs, dtype=np.float32)
    log(f'Loaded {len(deck_ids)} embeddings, dim={X.shape[1]}')
    return deck_ids, X


def build_knn(X, k, cache_path, refit=False):
    if os.path.exists(cache_path) and not refit:
        log(f'Loading cached k-NN from {cache_path}')
        d = np.load(cache_path)
        if d['indices'].shape[0] == X.shape[0] and d['indices'].shape[1] >= k + 1:
            return d['indices'], d['distances']
        log('  cache shape mismatch — rebuilding')
    from pynndescent import NNDescent
    log(f'Building approximate cosine k-NN (k={k}) over {X.shape[0]} points...')
    t0 = time.time()
    index = NNDescent(X, n_neighbors=k + 1, metric='cosine', low_memory=True, n_jobs=-1)
    indices, distances = index.neighbor_graph
    log(f'k-NN built in {time.time() - t0:.0f}s')
    np.savez(cache_path, indices=indices.astype(np.int32), distances=distances.astype(np.float32))
    log(f'Cached k-NN to {cache_path}')
    return indices, distances


def build_graph(n, indices, distances):
    import igraph as ig
    log('Assembling edge list...')
    k = indices.shape[1]
    src = np.repeat(np.arange(n, dtype=np.int64), k)
    tgt = indices.reshape(-1).astype(np.int64)
    w = (1.0 - distances.reshape(-1)).astype(np.float64)  # cosine similarity
    keep = src != tgt                                     # drop self-loops
    src, tgt, w = src[keep], tgt[keep], w[keep]
    np.clip(w, 1e-4, None, out=w)
    log(f'{len(src)} directed edges — building graph...')
    g = ig.Graph(n=n, edges=np.column_stack([src, tgt]), directed=False)
    g.es['weight'] = w
    log('Simplifying (merge reciprocal edges, drop duplicates)...')
    g.simplify(multiple=True, loops=True, combine_edges={'weight': 'max'})
    log(f'Graph: {g.vcount()} nodes, {g.ecount()} undirected edges')
    return g


def merge_small(membership, X, min_size):
    """Reassign members of communities smaller than min_size to the nearest large
    community by centroid cosine. Returns contiguous 0..K-1 labels."""
    membership = np.asarray(membership)
    ids, counts = np.unique(membership, return_counts=True)
    big = ids[counts >= min_size]
    small = set(ids[counts < min_size].tolist())
    if not small:
        return _relabel(membership)
    log(f'Merging {len(small)} communities < {min_size} decks into {len(big)} large ones...')
    # L2-normalize embeddings for cosine, compute big-community centroids
    Xn = X / np.clip(np.linalg.norm(X, axis=1, keepdims=True), 1e-9, None)
    cents = np.stack([Xn[membership == c].mean(0) for c in big])
    cents /= np.clip(np.linalg.norm(cents, axis=1, keepdims=True), 1e-9, None)
    small_mask = np.isin(membership, list(small))
    sims = Xn[small_mask] @ cents.T
    membership[small_mask] = big[np.argmax(sims, axis=1)]
    return _relabel(membership)


def _relabel(membership):
    membership = np.asarray(membership)
    uniq = {c: i for i, c in enumerate(sorted(set(membership.tolist())))}
    return np.array([uniq[c] for c in membership.tolist()], dtype=np.int64)


def write_clusters(path, deck_ids, labels):
    with open(path, 'w') as f:
        for did, lab in zip(deck_ids, labels):
            f.write(json.dumps({'deckId': did, 'clusterId': int(lab)}) + '\n')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', default=EMBEDDINGS_PATH)
    ap.add_argument('--k', type=int, default=15, help='k-NN neighbors')
    ap.add_argument('--resolutions', default='1.5,1.0,0.7,0.5,0.3,0.2,0.1',
                    help='comma-separated RBConfiguration resolutions to sweep (high->low: fast, useful ones first)')
    ap.add_argument('--target-clusters', type=int, default=40,
                    help='copy the sweep result closest to this to clusters.ndjson')
    ap.add_argument('--min-cluster-size', type=int, default=200,
                    help='merge communities smaller than this into nearest large one')
    ap.add_argument('--seed', type=int, default=42)
    ap.add_argument('--sample', type=int, default=0, help='use only first N decks (calibration)')
    ap.add_argument('--refit-knn', action='store_true', help='ignore cached k-NN and rebuild')
    args = ap.parse_args()

    os.makedirs(CLUSTERS_DIR, exist_ok=True)
    resolutions = [float(r) for r in args.resolutions.split(',')]

    deck_ids, X = load_embeddings(args.input, sample=args.sample)
    n = X.shape[0]

    cache = os.path.join(CLUSTERS_DIR, f'knn_cache{"_s" + str(args.sample) if args.sample else ""}.npz')
    indices, distances = build_knn(X, args.k, cache, refit=args.refit_knn)
    g = build_graph(n, indices, distances)

    import leidenalg as la
    summary = []
    best = None
    for r in resolutions:
        t0 = time.time()
        part = la.find_partition(
            g, la.RBConfigurationVertexPartition,
            weights='weight', resolution_parameter=r,
            seed=args.seed, n_iterations=2,
        )
        labels = merge_small(part.membership, X, args.min_cluster_size)
        k_found = int(labels.max()) + 1
        _, sizes = np.unique(labels, return_counts=True)
        out = os.path.join(CLUSTERS_DIR, f'clusters_res{r}.ndjson')
        write_clusters(out, deck_ids, labels)
        rec = {'resolution': r, 'clusters': k_found,
               'largest': int(sizes.max()), 'smallest': int(sizes.min()),
               'median': int(np.median(sizes)), 'seconds': round(time.time() - t0, 1)}
        summary.append(rec)
        log(f'res={r}: {k_found} clusters (sizes {rec["smallest"]}..{rec["largest"]}, '
            f'median {rec["median"]}) in {rec["seconds"]}s -> {os.path.basename(out)}')
        if best is None or abs(k_found - args.target_clusters) < abs(best[1] - args.target_clusters):
            best = (r, k_found, labels)

    with open(os.path.join(CLUSTERS_DIR, 'leiden_summary.json'), 'w') as f:
        json.dump(summary, f, indent=2)

    if best is not None:
        r, k_found, labels = best
        write_clusters(os.path.join(CLUSTERS_DIR, 'clusters.ndjson'), deck_ids, labels)
        log(f'AUTO-PICK: resolution={r} -> {k_found} clusters (closest to target '
            f'{args.target_clusters}) written to clusters.ndjson')
    log('Done. Sweep summary in data/clusters/leiden_summary.json')


if __name__ == '__main__':
    main()
