from ccml import review_names


def test_names_changed_by_hand_become_edited_names():
    names = {
        "0": {"name": "Reanimator", "source": "llm", "auto": "reanimate / self-mill", "llm": "Reanimator"},
        "1": {"name": "Tokens", "source": "llm", "auto": "token / go-wide", "llm": "Go Wide"},
        "2": {"name": "Storm", "source": "auto", "auto": "storm / ritual"},
        "3": {"name": "Blink", "source": "edited", "auto": "flicker", "editedBy": "admin", "editedAt": 1},
    }
    marked = review_names.mark_hand_edits(names, 99)
    assert marked["0"] == names["0"]
    assert marked["1"] == {**names["1"], "source": "edited", "editedAt": 99}
    assert marked["2"] == {**names["2"], "source": "edited", "editedAt": 99}
    assert marked["3"] == names["3"]  # already edited (carried over), left as is


def test_empty_and_overlong_names_are_problems():
    names = {
        "0": {"name": "Ramp"},
        "1": {"name": "  "},
        "2": {"name": "x" * (review_names.MAX_NAME_LENGTH + 1)},
    }
    found = review_names.problems(names)
    assert len(found) == 2
    assert found[0].startswith("topic 1")
    assert found[1].startswith("topic 2")


def test_repeated_names_ignore_case():
    names = {"0": {"name": "Ramp"}, "1": {"name": "ramp"}, "2": {"name": "Storm"}}
    assert review_names.duplicates(names) == ["Ramp", "ramp"]


def test_review_shows_each_name_beside_the_tags_claude_was_sent():
    topic = {
        "id": "30",
        "topTags": ["lifegain", "hate-discard"],
        "tagWeights": [["lifegain", 1.0], ["hate-discard", 0.3]],
        "deckShare": 0.014,
    }
    names = {"30": {"name": "Lifegain", "source": "llm", "auto": "lifegain / hate-discard", "llm": "Lifegain"}}
    trace = {
        "actor": {"30": {"name": "Hate Pieces", "reason": "hate-discard"}},
        "critic": {"30": {"name": "Lifegain", "reason": "lifegain outweighs hate-discard"}},
    }
    [entry] = review_names.review_entries([topic], names, {"30": {"name": "old"}}, trace)
    assert entry["sentToClaude"] == [{"tag": "lifegain", "weight": 1.0}, {"tag": "hate-discard", "weight": 0.3}]
    assert entry["committed"] == "old"
    assert entry["actor"]["name"] == "Hate Pieces" and entry["critic"]["name"] == "Lifegain"
    assert entry["proposed"] == "Lifegain"
