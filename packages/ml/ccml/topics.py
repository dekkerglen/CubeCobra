"""Archetype topics stage: finds deck archetypes in the run's training decks and names them.

    ML_RUN_ID=<run id> ML_RUNS_BUCKET=<bucket> ML_LIVE_BUCKET=<bucket> python -m ccml.topics

Adapted from mp-deckbuilder-server's build_topics. Each training deck becomes a bag of its nonland
cards' Scryfall oracle tags (lands are the manabase, not a strategy); tags too rare or too common
to tell decks apart are dropped; the rest are TF-IDF weighted and factored with NMF into K topics.
Every card then gets a topic profile (its tags projected onto the topics), which is all the site
needs to classify a deck or a cube (@utils/drafting/topicArchetypes).

Writes ml/runs/<runId>/bundle/archetypes/topics.json, names.json and naming.json; ccml.name_topics
does the naming. Runs alongside training: nothing here depends on the trained model.
"""

import json
import os
import re
import time

import numpy as np
from scipy import sparse
from sklearn.decomposition import MiniBatchNMF
from sklearn.preprocessing import normalize

from ccml import storage
from ccml.config import run_context
from ccml.name_topics import name_topics

K = int(os.environ.get("ML_TOPICS", 100))
# Tags that describe card design rather than play (cycles, alliteration).
JUNK_TAGS = re.compile(r"^(cycle-|alliteration)")
# A tag must be on this many nonland cards to describe anything.
MIN_TAG_CARDS = 30
# ...and in this share of decks, but not nearly all of them.
MIN_DECK_SHARE = 0.001
MAX_DECK_SHARE = 0.92
# Decks per chunk when computing tag counts and mixtures, so memory doesn't grow with the corpus.
CHUNK = 250_000
# Decks the NMF is fit on; archetypes are stable well below the full corpus.
NMF_SAMPLE = 500_000
TOP_TAGS = 6
REPRESENTATIVE_CARDS = 4
CARD_TOPICS = 3
# Representative cards must be played in this share of decks, so the namer sees cards it knows.
MIN_CARD_DECK_SHARE = 0.001


def tag_vocabulary(cards: list[dict]) -> list[str]:
    counts: dict[str, int] = {}
    for card in cards:
        if "Land" in (card.get("type") or ""):
            continue
        for tag in card.get("tags") or []:
            if not JUNK_TAGS.match(tag):
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
    for path in sorted(deck_dir.glob("*.json")):
        for deck in json.loads(path.read_text()):
            main = sorted({c for c in deck["mainboard"] if 0 <= c < n_cards and nonland[c]})
            indices.extend(main)
            indptr.append(len(indices))
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


def build_topics(cards: list[dict], deck_matrix: sparse.csr_matrix, k: int = K) -> tuple[dict, list[str]]:
    """The topics.json payload (see ArchetypeTopicsFile) and each topic's auto name."""
    n_decks, n_cards = deck_matrix.shape
    types = [card.get("type") or "" for card in cards]
    nonland = np.array(["Land" not in t for t in types])

    vocab = tag_vocabulary(cards)
    ctag = card_tag_matrix(cards, vocab, nonland)

    def chunks():
        for a in range(0, n_decks, CHUNK):
            yield a, min(a + CHUNK, n_decks)

    docfreq = np.zeros(len(vocab), dtype=np.int64)
    for a, b in chunks():
        docfreq += np.asarray(((deck_matrix[a:b] @ ctag) > 0).sum(axis=0)).ravel()
    keep = np.where((docfreq >= max(1, MIN_DECK_SHARE * n_decks)) & (docfreq <= MAX_DECK_SHARE * n_decks))[0]
    vocab = [vocab[j] for j in keep]
    ctag = ctag[:, keep].tocsr()
    print(f"{n_decks:,} decks, {len(vocab)} tags kept", flush=True)
    if len(vocab) < k:
        raise RuntimeError(f"Only {len(vocab)} usable tags for {k} topics; are oracle tags in the export?")

    # TF-IDF with smoothed idf and l2 rows, the idf fit on every deck so samples and chunks share it.
    idf = sparse.diags(np.log((1.0 + n_decks) / (1.0 + docfreq[keep])) + 1.0)

    def tfidf(rows):
        return normalize(rows @ ctag @ idf, norm="l2", copy=False)

    rng = np.random.default_rng(0)
    sample = np.sort(rng.choice(n_decks, NMF_SAMPLE, replace=False)) if n_decks > NMF_SAMPLE else np.arange(n_decks)
    print(f"Fitting NMF with {k} topics on {len(sample):,} decks", flush=True)
    nmf = MiniBatchNMF(n_components=k, init="nndsvda", batch_size=4096, max_iter=80, random_state=0)
    nmf.fit(tfidf(deck_matrix[sample]))
    loadings = nmf.components_  # topics x tags

    # Each deck's dominant topic, and the makeup of its nonland mainboard.
    dominant = np.full(n_decks, -1, dtype=np.int64)
    for a, b in chunks():
        mix = nmf.transform(tfidf(deck_matrix[a:b]))
        has = mix.sum(axis=1) > 0
        dominant[a:b][has] = mix[has].argmax(axis=1)
    cmc = np.array([float(card.get("cmc") or 0) for card in cards], dtype=np.float32)
    creature = np.array(["Creature" in t for t in types], dtype=np.float32)
    spell = np.array([("Instant" in t or "Sorcery" in t) for t in types], dtype=np.float32)
    sizes = np.maximum(np.asarray(deck_matrix.sum(axis=1)).ravel(), 1)
    avg_mv = (deck_matrix @ cmc) / sizes
    creature_share = (deck_matrix @ creature) / sizes
    spell_share = (deck_matrix @ spell) / sizes

    card_topics = np.asarray(ctag @ loadings.T)
    card_topics /= card_topics.sum(axis=1, keepdims=True) + 1e-9
    deck_freq = np.asarray(deck_matrix.sum(axis=0)).ravel()
    familiar = deck_freq >= max(1, MIN_CARD_DECK_SHARE * n_decks)

    topics, auto_names = [], []
    labeled = max(int((dominant >= 0).sum()), 1)
    for t in range(k):
        # Tags with next to no weight say nothing about the topic.
        floor = 0.01 * loadings[t].max()
        top_tags = [vocab[j] for j in np.argsort(loadings[t])[::-1][:TOP_TAGS] if loadings[t, j] > floor]
        ranked = [int(i) for i in np.argsort(card_topics[:, t])[::-1] if familiar[i] and card_topics[i, t] > 0]
        members = dominant == t
        count = int(members.sum())
        topics.append(
            {
                "id": str(t),
                "topTags": top_tags,
                "cards": [cards[i]["name"] for i in ranked[:REPRESENTATIVE_CARDS]],
                "deckShare": round(count / labeled, 5),
                "shape": {
                    "avgManaValue": round(float(avg_mv[members].mean()), 2) if count else 0.0,
                    "creatureShare": round(float(creature_share[members].mean()), 3) if count else 0.0,
                    "instantSorceryShare": round(float(spell_share[members].mean()), 3) if count else 0.0,
                },
            }
        )
        auto_names.append(" / ".join(top_tags[:3]))

    payload = {
        "format": 1,
        "k": k,
        "createdAt": int(time.time() * 1000),
        "topics": topics,
        "cardTopics": top_card_topics(card_topics, [card["oracle"] for card in cards]),
    }
    return payload, auto_names


def main() -> None:
    ctx = run_context()
    data_dir = ctx.work_dir / "data"
    for name in ("cards.json", "manifest.json"):
        storage.download_file(ctx.bucket, ctx.key("data", name), data_dir / name)
    storage.download_prefix(ctx.bucket, ctx.key("data", "train", "decks") + "/", data_dir / "train" / "decks")

    cards = json.loads((data_dir / "cards.json").read_text())
    nonland = np.array(["Land" not in (card.get("type") or "") for card in cards])
    deck_matrix = deck_card_matrix(data_dir / "train" / "decks", len(cards), nonland)

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
