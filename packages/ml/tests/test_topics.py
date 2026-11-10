import numpy as np
from scipy import sparse

from ccml import name_topics as naming
from ccml import topics


def _topic(topic_id, tags):
    return {
        "id": topic_id,
        "topTags": tags,
        "cards": [],
        "deckShare": 0.1,
        "shape": {"avgManaValue": 2.0, "creatureShare": 0.5, "instantSorceryShare": 0.3},
    }


def test_edited_names_follow_the_topic_with_the_most_similar_tags():
    live_topics = [_topic("7", ["reanimate", "self-mill", "discard-outlet"]), _topic("8", ["token", "go-wide"])]
    live_names = {
        "7": {"name": "Reanimator", "source": "edited", "auto": "x", "editedBy": "admin"},
        "8": {"name": "Tokens", "source": "llm", "auto": "y"},
    }
    new = [_topic("0", ["token", "go-wide"]), _topic("1", ["reanimate", "self-mill", "graveyard"])]
    carried = naming.carry_over_edits(new, live_topics, live_names)
    assert carried == {"1": live_names["7"]}  # LLM names are re-derived, never carried


def test_edits_are_not_carried_to_unrelated_topics():
    live_topics = [_topic("7", ["reanimate", "self-mill"])]
    live_names = {"7": {"name": "Reanimator", "source": "edited", "auto": "x"}}
    assert naming.carry_over_edits([_topic("0", ["token", "go-wide"])], live_topics, live_names) == {}


def test_parse_names_keeps_only_requested_non_empty_names():
    text = '{"names": [{"topic_id": "0", "name": " Storm "}, {"topic_id": "1", "name": ""}, {"topic_id": "9", "name": "X"}]}'
    assert naming.parse_names(text, ["0", "1"]) == {"0": "Storm"}
    assert naming.parse_names("not json", ["0"]) == {}


def test_without_a_model_topics_keep_auto_names(monkeypatch):
    monkeypatch.delenv("ML_BEDROCK_MODEL_ID", raising=False)
    names, outcome = naming.name_topics([_topic("0", ["token"])], ["token / go-wide"], None)
    assert names["names"]["0"] == {"name": "token / go-wide", "source": "auto", "auto": "token / go-wide"}
    assert outcome["mode"] == "auto-fallback" and outcome["reason"] == "model id unset"


def test_top_card_topics_skips_cards_without_topics():
    profiles = np.array([[0.7, 0.2, 0.1, 0.0], [0.0, 0.0, 0.0, 0.0]])
    assert topics.top_card_topics(profiles, ["a", "b"], n=2) == {"a": [["0", 0.7], ["1", 0.2]]}


def test_build_topics_separates_two_strategies(monkeypatch):
    monkeypatch.setattr(topics, "MIN_TAG_CARDS", 1)
    monkeypatch.setattr(topics, "MIN_DECK_SHARE", 0.0)
    monkeypatch.setattr(topics, "MIN_CARD_DECK_SHARE", 0.0)
    cards = [{"oracle": f"o{i}", "name": f"Token {i}", "type": "Creature", "cmc": 2, "tags": ["token", "go-wide"]} for i in range(10)]
    cards += [{"oracle": f"o{i}", "name": f"Mill {i}", "type": "Sorcery", "cmc": 3, "tags": ["self-mill", "reanimate"]} for i in range(10, 20)]
    cards += [{"oracle": "land", "name": "Land", "type": "Land", "cmc": 0, "tags": ["token"]}]
    rows, cols = [], []
    for deck in range(40):
        start = 0 if deck % 2 == 0 else 10
        for card in range(start, start + 10):
            rows.append(deck)
            cols.append(card)
    decks = sparse.csr_matrix((np.ones(len(rows), np.float32), (rows, cols)), shape=(40, len(cards)))

    payload, auto_names = topics.build_topics(cards, decks, k=2)

    assert {frozenset(name.split(" / ")) for name in auto_names} == {
        frozenset({"token", "go-wide"}),
        frozenset({"self-mill", "reanimate"}),
    }
    assert "land" not in payload["cardTopics"]
    token_topic = payload["cardTopics"]["o0"][0][0]
    mill_topic = payload["cardTopics"]["o10"][0][0]
    assert token_topic != mill_topic
    assert sum(t["deckShare"] for t in payload["topics"]) == 1.0
