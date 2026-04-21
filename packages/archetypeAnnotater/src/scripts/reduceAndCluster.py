"""
Reduce 128-dim embeddings to 2D via UMAP (cosine metric) and cluster with HDBSCAN.

Reads:  data/embeddings/embeddings.ndjson
Writes: data/reduced/reduced.ndjson
        data/clusters/clusters.ndjson
"""

import json
import os
import sys
import time

import hdbscan
import numpy as np
import umap

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, '..', '..', 'data')
EMBEDDINGS_PATH = os.path.join(DATA_DIR, 'embeddings', 'embeddings.ndjson')
REDUCED_DIR = os.path.join(DATA_DIR, 'reduced')
CLUSTERS_DIR = os.path.join(DATA_DIR, 'clusters')


def load_embeddings():
    """Stream-load NDJSON embeddings into numpy arrays."""
    print('Loading embeddings...')
    deck_ids = []
    embeddings = []
    with open(EMBEDDINGS_PATH, 'r') as f:
        for i, line in enumerate(f):
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)
            deck_ids.append(record['deckId'])
            embeddings.append(record['embedding'])
            if (i + 1) % 500_000 == 0:
                print(f'  {i + 1} loaded...')

    print(f'Loaded {len(deck_ids)} embeddings.')
    return deck_ids, np.array(embeddings, dtype=np.float32)


def run_umap(embeddings, n_components=2, n_neighbors=15, min_dist=0.1, metric='cosine'):
    """Run UMAP dimensionality reduction."""
    print(f'Running UMAP -> {n_components}D (metric={metric}, n_neighbors={n_neighbors}, min_dist={min_dist})...')
    t0 = time.time()
    reducer = umap.UMAP(
        n_components=n_components,
        n_neighbors=n_neighbors,
        min_dist=min_dist,
        metric=metric,
        verbose=True,
    )
    reduced = reducer.fit_transform(embeddings)
    print(f'UMAP done in {time.time() - t0:.1f}s')
    return reduced


def run_hdbscan(embeddings_for_cluster, min_cluster_size=50, min_samples=10):
    """Run HDBSCAN clustering."""
    print(f'Running HDBSCAN (min_cluster_size={min_cluster_size}, min_samples={min_samples})...')
    t0 = time.time()
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        cluster_selection_method='eom',
        prediction_data=False,
    )
    labels = clusterer.fit_predict(embeddings_for_cluster)
    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
    n_noise = (labels == -1).sum()
    print(f'HDBSCAN done in {time.time() - t0:.1f}s: {n_clusters} clusters, {n_noise} noise points')

    # Assign noise points to nearest cluster (like Lucky Paper does)
    if n_noise > 0:
        print(f'Assigning {n_noise} noise points to nearest clusters...')
        from sklearn.neighbors import NearestCentroid
        # Compute centroids from labeled points
        mask = labels >= 0
        nc = NearestCentroid()
        nc.fit(embeddings_for_cluster[mask], labels[mask])
        noise_mask = labels == -1
        labels[noise_mask] = nc.predict(embeddings_for_cluster[noise_mask])
        print(f'All points assigned. Final cluster count: {len(set(labels))}')

    return labels


def write_reduced(deck_ids, reduced_2d):
    """Write 2D reduced points as NDJSON."""
    os.makedirs(REDUCED_DIR, exist_ok=True)
    out_path = os.path.join(REDUCED_DIR, 'reduced.ndjson')
    print(f'Writing {out_path}...')
    with open(out_path, 'w') as f:
        for i, deck_id in enumerate(deck_ids):
            record = {'deckId': deck_id, 'x': float(reduced_2d[i, 0]), 'y': float(reduced_2d[i, 1])}
            f.write(json.dumps(record) + '\n')
            if (i + 1) % 500_000 == 0:
                print(f'  {i + 1} written...')
    print(f'Wrote {len(deck_ids)} points.')


def write_clusters(deck_ids, labels):
    """Write cluster assignments as NDJSON."""
    os.makedirs(CLUSTERS_DIR, exist_ok=True)
    out_path = os.path.join(CLUSTERS_DIR, 'clusters.ndjson')
    print(f'Writing {out_path}...')
    with open(out_path, 'w') as f:
        for i, deck_id in enumerate(deck_ids):
            record = {'deckId': deck_id, 'clusterId': int(labels[i])}
            f.write(json.dumps(record) + '\n')
            if (i + 1) % 500_000 == 0:
                print(f'  {i + 1} written...')
    print(f'Wrote {len(deck_ids)} cluster assignments.')


def main():
    deck_ids, embeddings = load_embeddings()

    # Step 1: UMAP to 6D for clustering (better than 2D per Lucky Paper approach)
    reduced_6d = run_umap(embeddings, n_components=6, n_neighbors=30, min_dist=0.0, metric='cosine')

    # Step 2: Cluster in 6D space
    labels = run_hdbscan(reduced_6d, min_cluster_size=100, min_samples=15)

    # Step 3: UMAP to 2D for visualization
    reduced_2d = run_umap(embeddings, n_components=2, n_neighbors=30, min_dist=0.1, metric='cosine')

    # Write outputs
    write_reduced(deck_ids, reduced_2d)
    write_clusters(deck_ids, labels)

    print('Done!')


if __name__ == '__main__':
    main()
