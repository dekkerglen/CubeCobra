"""Archetype topics stage: finds deck archetypes in the run's training decks and names them.

    ML_RUN_ID=<run id> ML_RUNS_BUCKET=<bucket> ML_LIVE_BUCKET=<bucket> python -m ccml.topics

Each training deck becomes a bag of its nonland cards' Scryfall oracle tags (lands are the manabase,
not a strategy). Tags that describe no cube strategy (ccml/tag_denylist.py) and tags too rare or too
common to tell decks apart are dropped; the rest are TF-IDF weighted, so each deck is a normalized
tag vector. Truncated SVD reduces those vectors, and k-means on the re-normalized reductions (so
decks are compared by angle) groups the decks into K archetypes.

An archetype's tags are the ones its decks have far more of than decks overall: its average tag
vector against the average over every deck, scored as cluster * log(cluster / overall). The top
TAG_VECTOR of those are all it is named from (ccml.name_topics).

A deck's archetype is the cluster center nearest its reduced vector in angle. That is linear in the
deck's tag counts, so it splits into a score per card and cluster, and summing a deck's card scores
classifies it. The site does exactly that with each card's top CARD_TOPICS scores (cardTopics,
@utils/drafting/topicArchetypes), and the build logs how often that agrees with the full assignment.

Writes ml/runs/<runId>/bundle/archetypes/topics.json, names.json and naming.json; ccml.name_topics
does the naming. Runs alongside training: nothing here depends on the trained model.
"""

import json
import os
import time

import numpy as np
from scipy import sparse
from sklearn.cluster import MiniBatchKMeans
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import normalize

from ccml import storage
from ccml.config import RunContext, run_context
from ccml.name_topics import auto_name, name_topics
from ccml.tag_denylist import is_denied

K = int(os.environ.get("ML_TOPICS", "30"))
# A tag must be on this many nonland cards to describe anything.
MIN_TAG_CARDS = 30
# ...and in this share of decks, but not nearly all of them.
MIN_DECK_SHARE = 0.001
MAX_DECK_SHARE = 0.92
# Decks per chunk when computing tag counts and assignments, so memory doesn't grow with the corpus.
CHUNK = 250_000
# Decks the reduction and clustering are fit on; archetypes are stable well below the full corpus.
FIT_SAMPLE = 500_000
# Dimensions the tag vectors are reduced to before clustering.
DIMENSIONS = 64
# k-means restarts; the best one is kept.
KMEANS_INIT = 5
TOP_TAGS = 6
# Tags in each archetype's tag vector, which is all its name is drawn from.
TAG_VECTOR = 10
CARD_TOPICS = 3
# Tagged cards the site needs to classify a deck (MIN_TAGGED_CARDS in topicArchetypes.ts).
MIN_TAGGED_CARDS = 8


def tag_vocabulary(cards: list[dict]) -> list[str]:
    counts: dict[str, int] = {}
    for card in cards:
        if "Land" in (card.get("type") or ""):
            continue
        for tag in card.get("tags") or []:
            if not is_denied(tag):
                counts[tag] = counts.get(tag, 0) + 1
    return sorted(tag for tag, count in counts.items() if count >= MIN_TAG_CARDS)


def card_tag_matrix(cards: list[dict], vocab: list[str], nonland: np.ndarray) -> sparse.csr_matrix:
    """Binary cards x tags, nonland cards only (land rows stay empty)."""
    index = {tag: j for j, tag in enumerate(vocab)}
    rows, cols = [], []
    for i, card in enumerate(cards):
        if not nonland[i]:
            continue
        for tag in card.get("tags") or []:
            j = index.get(tag)
            if j is not None:
                rows.append(i)
                cols.append(j)
    return sparse.csr_matrix((np.ones(len(rows), np.float32), (rows, cols)), shape=(len(cards), len(vocab)))


def deck_card_matrix(deck_dir, n_cards: int, nonland: np.ndarray) -> sparse.csr_matrix:
    """Binary decks x cards over each training deck's unique nonland mainboard cards."""
    indptr, indices = [0], []
    paths = sorted(deck_dir.glob("*.json"))
    last = time.monotonic()
    for i, path in enumerate(paths, 1):
        for deck in json.loads(path.read_text()):
            main = sorted({c for c in deck["mainboard"] if 0 <= c < n_cards and nonland[c]})
            indices.extend(main)
            indptr.append(len(indices))
        if time.monotonic() - last >= storage.PROGRESS_SECONDS or i == len(paths):
            last = time.monotonic()
            print(f"  read {i}/{len(paths)} deck files, {len(indptr) - 1:,} decks", flush=True)
    indices = np.asarray(indices, dtype=np.int32)
    return sparse.csr_matrix(
        (np.ones(len(indices), np.float32), indices, np.asarray(indptr, dtype=np.int64)),
        shape=(len(indptr) - 1, n_cards),
    )


def top_card_topics(card_topics: np.ndarray, oracles: list[str], n: int = CARD_TOPICS) -> dict:
    """oracle id -> up to n [topic id, weight] pairs, heaviest first; cards with no topics are left out."""
    out = {}
    for i, row in enumerate(card_topics):
        if row.sum() <= 0:
            continue
        top = [int(t) for t in np.argsort(row)[::-1][:n] if row[t] > 0]
        out[oracles[i]] = [[str(t), round(float(row[t]), 4)] for t in top]
    return out


def keep_top(scores: np.ndarray, n: int) -> np.ndarray:
    """Each row's n largest positive entries, every other entry zero."""
    kept = np.zeros_like(scores)
    rows = np.arange(len(scores))[:, None]
    top = np.argsort(-scores, axis=1)[:, :n]
    values = scores[rows, top]
    kept[rows, top] = np.where(values > 0, values, 0)
    return kept


def distinctive(cluster: np.ndarray, overall: np.ndarray, n: int):
    """[(index, score)] of the n entries the cluster has most beyond the overall average, scored
    cluster * log(cluster / overall): each entry's part in how the cluster differs from every deck."""
    with np.errstate(divide="ignore", invalid="ignore"):
        score = np.where((cluster > overall) & (overall > 0), cluster * np.log(cluster / overall), 0.0)
    return [(int(i), float(score[i])) for i in np.argsort(score)[::-1][:n] if score[i] > 0]


def build_topics(cards: list[dict], deck_matrix: sparse.csr_matrix, k: int = K) -> tuple[dict, list[str]]:
    """The topics.json payload (see ArchetypeTopicsFile) and each archetype's auto name."""
    n_decks = deck_matrix.shape[0]
    types = [card.get("type") or "" for card in cards]
    nonland = np.array(["Land" not in t for t in types])

    vocab = tag_vocabulary(cards)
    ctag = card_tag_matrix(cards, vocab, nonland)

    def chunks(step: str):
        for a in range(0, n_decks, CHUNK):
            b = min(a + CHUNK, n_decks)
            print(f"  {step}: decks {a:,} to {b:,} of {n_decks:,}", flush=True)
            yield a, b

    print(f"{len(vocab)} tags on at least {MIN_TAG_CARDS} nonland cards and not denied", flush=True)
    docfreq = np.zeros(len(vocab), dtype=np.int64)
    for a, b in chunks("counting tags"):
        docfreq += np.asarray(((deck_matrix[a:b] @ ctag) > 0).sum(axis=0)).ravel()
    keep = np.where((docfreq >= max(1, MIN_DECK_SHARE * n_decks)) & (docfreq <= MAX_DECK_SHARE * n_decks))[0]
    vocab = [vocab[j] for j in keep]
    ctag = ctag[:, keep].tocsr()
    print(f"{n_decks:,} decks, {len(vocab)} tags kept", flush=True)
    if len(vocab) < k:
        raise RuntimeError(f"Only {len(vocab)} usable tags for {k} archetypes; are oracle tags in the export?")

    # TF-IDF with smoothed idf and l2 rows, the idf fit on every deck so samples and chunks share it.
    idf = sparse.diags(np.log((1.0 + n_decks) / (1.0 + docfreq[keep])) + 1.0)

    def tfidf(rows):
        return normalize(rows @ ctag @ idf, norm="l2", copy=False)

    rng = np.random.default_rng(0)
    sample = np.sort(rng.choice(n_decks, FIT_SAMPLE, replace=False)) if n_decks > FIT_SAMPLE else np.arange(n_decks)
    sample_vectors = tfidf(deck_matrix[sample])
    dims = min(DIMENSIONS, len(vocab) - 1)
    print(f"Reducing to {dims} dimensions...", flush=True)
    started = time.monotonic()
    svd = TruncatedSVD(n_components=dims, random_state=0).fit(sample_vectors)
    reduced = normalize(svd.transform(sample_vectors))
    print(
        f"Reduced {len(vocab)} tags to {dims} dimensions on {len(sample):,} decks "
        f"({svd.explained_variance_ratio_.sum():.1%} of the variance) in {time.monotonic() - started:.0f}s",
        flush=True,
    )
    print(f"Clustering into {k} archetypes ({KMEANS_INIT} restarts)...", flush=True)
    started = time.monotonic()
    kmeans = MiniBatchKMeans(n_clusters=k, n_init=KMEANS_INIT, batch_size=4096, random_state=0).fit(reduced)
    print(f"Clustered into {k} archetypes in {time.monotonic() - started:.0f}s", flush=True)

    # Score of cluster c for a deck = its reduced vector . center c. Both normalizations only scale a
    # deck's scores, so the nearest center is the largest of deck tag counts @ idf @ components.T @
    # centers.T: a sum of per-card scores.
    centers = normalize(kmeans.cluster_centers_)
    card_scores = np.asarray(ctag @ (idf @ (svd.components_.T @ centers.T)))
    site_scores = keep_top(card_scores, CARD_TOPICS)
    site_tagged = (site_scores > 0).any(axis=1).astype(np.float32)

    # Each deck's cluster, the clusters' summed tag vectors, and how often the site's top-CARD_TOPICS
    # sum picks the same cluster.
    labels = np.full(n_decks, -1, dtype=np.int64)
    tag_sums = np.zeros((k, len(vocab)))
    agreed = compared = 0
    for a, b in chunks("assigning decks"):
        rows = deck_matrix[a:b]
        scores = np.asarray(rows @ card_scores)
        has = np.asarray((rows @ ctag).sum(axis=1)).ravel() > 0
        chunk_labels = np.where(has, scores.argmax(axis=1), -1)
        labels[a:b] = chunk_labels
        members = np.where(has)[0]
        onehot = sparse.csr_matrix((np.ones(len(members)), (chunk_labels[members], members)), shape=(k, b - a))
        tag_sums += (onehot @ tfidf(rows)).toarray()
        classified = has & (rows @ site_tagged >= MIN_TAGGED_CARDS)
        agreed += int((np.asarray(rows @ site_scores).argmax(axis=1) == chunk_labels)[classified].sum())
        compared += int(classified.sum())
    print(
        f"The site's top-{CARD_TOPICS} card scores pick each deck's cluster for "
        f"{agreed / max(compared, 1):.1%} of the {compared:,} decks it classifies",
        flush=True,
    )

    counts = np.bincount(labels[labels >= 0], minlength=k)
    labeled = max(int(counts.sum()), 1)
    print(f"Archetype sizes: {counts.min():,} to {counts.max():,} decks ({labeled:,} labeled)", flush=True)
    tag_overall = tag_sums.sum(axis=0) / labeled

    topics, auto_names = [], []
    for c in range(k):
        count = int(counts[c])
        vector = distinctive(tag_sums[c] / max(count, 1), tag_overall, TAG_VECTOR)
        peak = vector[0][1] if vector else 1.0
        tag_weights = [[vocab[j], round(score / peak, 3)] for j, score in vector]
        top_tags = [tag for tag, _ in tag_weights[:TOP_TAGS]]
        topics.append(
            {
                "id": str(c),
                "topTags": top_tags,
                "tagWeights": tag_weights,
                "deckShare": round(count / labeled, 5),
            }
        )
        auto_names.append(auto_name(top_tags) or f"Archetype {c}")

    payload = {
        "format": 1,
        "k": k,
        "createdAt": int(time.time() * 1000),
        "topics": topics,
        "cardTopics": top_card_topics(site_scores, [card["oracle"] for card in cards]),
    }
    return payload, auto_names


def load_training_data(ctx: RunContext) -> tuple[list[dict], sparse.csr_matrix]:
    """The run's cards.json and its training decks' card matrix, downloaded to the work dir once."""
    data_dir = ctx.work_dir / "data"
    for name in ("cards.json", "manifest.json"):
        storage.download_file(ctx.bucket, ctx.key("data", name), data_dir / name)
    decks = storage.download_prefix(ctx.bucket, ctx.key("data", "train", "decks") + "/", data_dir / "train" / "decks")
    print(f"Training data in {data_dir} ({decks} deck files)", flush=True)
    cards = json.loads((data_dir / "cards.json").read_text())
    nonland = np.array(["Land" not in (card.get("type") or "") for card in cards])
    return cards, deck_card_matrix(data_dir / "train" / "decks", len(cards), nonland)


def main() -> None:
    ctx = run_context()
    cards, deck_matrix = load_training_data(ctx)

    topics, auto_names = build_topics(cards, deck_matrix)
    for topic, auto in zip(topics["topics"], auto_names):
        print(f"  {topic['id']:>3}  {auto}  ({topic['deckShare']:.2%})")

    names, outcome = name_topics(topics["topics"], auto_names, os.environ.get("ML_LIVE_BUCKET"))

    prefix = ctx.key("bundle", "archetypes") + "/"
    storage.write_json(ctx.bucket, prefix + "topics.json", topics)
    storage.write_json(ctx.bucket, prefix + "names.json", names)
    storage.write_json(ctx.bucket, prefix + "naming.json", outcome)
    print(f"Wrote {len(topics['topics'])} topics to s3://{ctx.bucket}/{prefix} ({outcome['mode']})", flush=True)


if __name__ == "__main__":
    main()
