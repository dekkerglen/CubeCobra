"""Archetype names for the topics found by ccml.topics, adapted from mp-deckbuilder-server's
name_topics.

1. Names an admin edited on the live version carry over to the new topic whose top tags overlap the
   old topic's most (Jaccard at least 0.5). Topic ids change between runs, top tags mostly don't.
2. Claude on Amazon Bedrock names the rest in two strict-JSON calls covering every topic at once,
   so names stay distinct: an actor proposes names, then a critic re-reads each against its tag
   vector and revises names that don't fit. A topic's tag vector (its strongest oracle tags and
   their weights) is the only evidence: cards and deck makeup mix in whatever shares a deck with
   the theme.

Never blocks the run, since names are cosmetic and admins can edit them: with no model configured,
on any Bedrock error or unusable response, topics keep their auto names (top three tags); a failed
critic leaves the actor's names. naming.json records which of these happened.
"""

import json
import os
import threading
import time

from ccml import storage
from ccml.tag_denylist import is_denied

JACCARD_CARRY_OVER = 0.5
MAX_TOKENS = 64000
# Seconds between "still waiting" lines while a call runs.
HEARTBEAT_SECONDS = 30

NAMES_SCHEMA = {
    "type": "object",
    "properties": {
        "names": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "topic_id": {"type": "string"},
                    "name": {"type": "string"},
                    "reason": {"type": "string"},
                },
                "required": ["topic_id", "name", "reason"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["names"],
    "additionalProperties": False,
}

RULES = """Rules:
- Concise Title-Case cube archetype terms drafters recognize (Reanimator, Storm, Tempo, Ramp,
  Aristocrats, Artifacts, Tokens, Spellslinger, Blink, Elves).
- One archetype per name: the topic's most prominent theme. Never combine themes: no parentheses,
  no slashes, no secondary qualifiers ('Goblins', never 'Goblins (Sacrifice)').
- Never use colors, color pairs or guild names. The site shows a deck's colors separately.
- Name from the tags that describe what cards do. Ignore tags about a card's name, art, printing,
  type line or rules history ('single-english-word-name', 'punny-name', 'type-errata',
  'potentially-black-border', 'draft-signpost').
- Name a strategy a drafter builds toward, never a component of a deck: 'Removal', 'Card Draw',
  'Mana Dorks', 'Treasures', 'Sweepers', 'Combat Tricks', 'Counterspells' and 'Disruption' are
  components, not archetypes. For a topic whose strongest tags are card roles, name the archetype
  those roles serve together: burn and haste is 'Aggro'; counterspells, removal and draw engines is
  'Control'; pump effects is 'Power Matters'.
- Efficient interaction (hand disruption, removal, counterspells) together with creatures that are
  efficient or generate card advantage (curiosity effects, ninjutsu) is 'Tempo'.
- Wheels, whirlpools or restock effects together with rituals is 'Combo', not 'Wheels': the
  rituals show the deck is building to one big turn.
- Mana rocks with artifact synergy is 'Artifacts', not 'Combo': refunds, untappers and rocks that
  make extra mana are an artifact deck's ramp, not a combo. Qualify it ('Artifact Ramp') only when
  another topic is also artifact-themed and the two need telling apart.
- Prefer the broadest name the evidence supports ('Artifacts', not 'Artifact Tokens').
- Names must be unique across topics and must not repeat a name already in use. When two topics
  share a dominant archetype, keep it on the topic whose evidence supports it more strongly and
  name the other after its next-most-prominent theme."""


def _log(message: str) -> None:
    print(f"[naming] {message}", flush=True)


def auto_name(top_tags: list[str]) -> str:
    """A topic's placeholder name: its top three tags."""
    return " / ".join(top_tags[:3])


def jaccard(a, b) -> float:
    a, b = set(a), set(b)
    return len(a & b) / len(a | b) if a | b else 0.0


def carry_over_edits(topics: list[dict], live_topics: list[dict], live_names: dict) -> dict[str, dict]:
    """New topic id -> the live version's edited name entry, matched by top-tag overlap. Each edit
    and each new topic is used at most once, best matches first."""
    by_id = {t["id"]: t for t in live_topics}
    pairs = []
    for old_id, entry in live_names.items():
        if entry.get("source") != "edited" or old_id not in by_id:
            continue
        for topic in topics:
            score = jaccard(by_id[old_id]["topTags"], topic["topTags"])
            if score >= JACCARD_CARRY_OVER:
                pairs.append((score, old_id, topic["id"]))
    carried, used_old = {}, set()
    for _, old_id, new_id in sorted(pairs, key=lambda p: (-p[0], p[1], p[2])):
        if old_id in used_old or new_id in carried:
            continue
        carried[new_id] = live_names[old_id]
        used_old.add(old_id)
    return carried


def parse_entries(text: str, topic_ids) -> dict[str, dict]:
    """{topic id: {"name", "reason"}} for the ids asked about; {} when the response is unusable."""
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return {}
    wanted = set(topic_ids)
    out = {}
    for entry in data.get("names", []) if isinstance(data, dict) else []:
        topic_id, name, reason = entry.get("topic_id"), entry.get("name"), entry.get("reason")
        if topic_id in wanted and isinstance(name, str) and name.strip():
            out[topic_id] = {"name": name.strip(), "reason": reason.strip() if isinstance(reason, str) else ""}
    return out


def parse_names(text: str, topic_ids) -> dict[str, str]:
    """{topic id: name} for the ids asked about; {} when the response is unusable."""
    return {topic_id: entry["name"] for topic_id, entry in parse_entries(text, topic_ids).items()}


def topic_evidence(topic: dict) -> dict:
    """The topic's tag vector without denied tags. Topics from before tag vectors have their top
    tags, unweighted; topics from before the denylist can still carry denied tags."""
    if topic.get("tagWeights"):
        tags = [{"tag": tag, "weight": weight} for tag, weight in topic["tagWeights"] if not is_denied(tag)]
    else:
        tags = [{"tag": tag} for tag in topic["topTags"] if not is_denied(tag)]
    return {"topic_id": topic["id"], "tags": tags}


def actor_prompt(topics: list[dict], taken: list[str]) -> str:
    lines = "\n".join(json.dumps(topic_evidence(t)) for t in topics)
    return (
        "You are naming Magic: The Gathering cube draft archetypes found by clustering recently drafted\n"
        "decks on the Scryfall oracle tags of their cards. Each topic is one cluster's tag vector: the\n"
        "oracle-tag slugs its decks have far more of than decks overall, strongest first; a tag's\n"
        "weight, when given, is relative to the strongest tag (1.0). Name each topic from its tags alone.\n"
        "Give every topic_id a short player-facing archetype name, and a one-sentence reason naming\n"
        "the tags the name comes from.\n\n"
        f"{RULES}\n\nNames already in use: {json.dumps(taken)}\n\nTopics:\n{lines}"
    )


def critic_prompt(topics: list[dict], proposed: dict[str, str], taken: list[str]) -> str:
    lines = "\n".join(
        json.dumps({"proposed_name": proposed[t["id"]], **topic_evidence(t)}) for t in topics if t["id"] in proposed
    )
    return (
        "You are reviewing proposed names for Magic: The Gathering cube draft archetypes found by\n"
        "clustering recently drafted decks on the Scryfall oracle tags of their cards. Each topic lists\n"
        "its proposed name and its cluster's tag vector: the oracle-tag slugs its decks have far more of\n"
        "than decks overall, strongest first, each weight (when given) relative to the strongest (1.0).\n"
        "Check that each name accurately describes its tags and revise the ones that don't.\n"
        "A name for a component of decks is not an archetype name, however well it fits the tags:\n"
        "card types, roles and resources such as 'Mana Dorks', 'Removal' or 'Treasures' are pieces a\n"
        "deck contains. Rename those to the strategy the components serve ('Ramp', 'Control',\n"
        "'Artifacts').\n"
        "Return every topic_id with its final name, the proposed name unchanged when it is accurate, and a\n"
        "one-sentence reason: which tags the name fits, or what was wrong with the proposed name.\n\n"
        f"{RULES}\n\nNames already in use: {json.dumps(taken)}\n\nTopics:\n{lines}"
    )


def _ask(client, model_id: str, prompt: str, step: str) -> str:
    """One structured-output call; the refusal-fallback middleware retries refusals on the fallback model."""
    from anthropic import BetaFallbackState

    _log(f"{step}: asking {model_id} ({len(prompt):,} prompt characters)")
    started = time.monotonic()
    answered = [0]  # characters of the answer so far, read by the heartbeat thread
    done = threading.Event()

    def heartbeat():
        while not done.wait(HEARTBEAT_SECONDS):
            _log(f"{step}: still waiting after {time.monotonic() - started:.0f}s, {answered[0]:,} characters answered")

    threading.Thread(target=heartbeat, daemon=True).start()
    try:
        with BetaFallbackState(), client.beta.messages.stream(
            model=model_id,
            max_tokens=MAX_TOKENS,
            thinking={"type": "adaptive"},
            output_config={"effort": "high", "format": {"type": "json_schema", "schema": NAMES_SCHEMA}},
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            for event in stream:
                if event.type == "content_block_delta" and getattr(event.delta, "type", None) == "text_delta":
                    answered[0] += len(event.delta.text)
            message = stream.get_final_message()
    finally:
        done.set()
    # message.model names the fallback model when the main one refused.
    _log(
        f"{step}: {message.stop_reason} from {message.model} after {time.monotonic() - started:.0f}s, "
        f"{message.usage.input_tokens:,} input and {message.usage.output_tokens:,} output tokens"
    )
    if message.stop_reason != "end_turn":
        raise RuntimeError(f"stop reason {message.stop_reason}")
    return next(block.text for block in message.content if block.type == "text")


def _client():
    from anthropic import AnthropicBedrockMantle, BetaRefusalFallbackMiddleware

    fallback = os.environ.get("ML_BEDROCK_FALLBACK_MODEL_ID")
    return AnthropicBedrockMantle(
        aws_region=os.environ.get("ML_BEDROCK_REGION") or os.environ.get("AWS_REGION"),
        timeout=1200,
        middleware=[BetaRefusalFallbackMiddleware([{"model": fallback}])] if fallback else None,
    )


def _live_archetypes(bucket: str | None) -> tuple[list[dict], dict]:
    """The live version's topics and names, or empty when it has none (v3) or can't be read."""
    if not bucket:
        return [], {}
    try:
        pointer = storage.read_json(bucket, "model/current.json")
        if not pointer:
            _log(f"no served version in {bucket}, so no edited names to carry over")
            return [], {}
        prefix = f"model/{pointer['version']}/archetypes/"
        topics = storage.read_json(bucket, prefix + "topics.json") or {}
        names = storage.read_json(bucket, prefix + "names.json") or {}
        edited = sum(1 for entry in names.get("names", {}).values() if entry.get("source") == "edited")
        _log(f"served version {pointer['version']}: {len(topics.get('topics', []))} topics, {edited} edited names")
        return topics.get("topics", []), names.get("names", {})
    except Exception as exc:  # noqa: BLE001 - carrying edits over is best-effort
        _log(f"could not read live archetypes: {exc}")
        return [], {}


def name_topics(
    topics: list[dict], auto_names: list[str], live_bucket: str | None, trace: dict | None = None
) -> tuple[dict, dict]:
    """Returns (names.json payload, naming.json payload). A trace dict, when given, gets each call's
    prompt and its {topic id: {name, reason}} answers (actorPrompt, actor, criticPrompt, critic)."""
    trace = {} if trace is None else trace
    now = int(time.time() * 1000)
    names = {t["id"]: {"name": auto, "source": "auto", "auto": auto} for t, auto in zip(topics, auto_names)}

    live_topics, live_names = _live_archetypes(live_bucket)
    carried = carry_over_edits(topics, live_topics, live_names)
    for topic_id, entry in carried.items():
        _log(f"topic {topic_id}: carried over the edited name '{entry['name']}'")
        names[topic_id].update(
            {"name": entry["name"], "source": "edited", "editedBy": entry.get("editedBy"), "editedAt": entry.get("editedAt")}
        )

    model_id = os.environ.get("ML_BEDROCK_MODEL_ID")
    outcome = {
        "mode": "auto-fallback",
        "reason": None,
        "named": 0,
        "carriedOver": len(carried),
        "criticRevised": 0,
        "total": len(topics),
        "modelId": model_id or None,
        "createdAt": now,
    }

    def payload():
        return {"names": names, "updatedAt": now}, outcome

    to_name = [t for t in topics if t["id"] not in carried]
    # A topic whose tags are all denied has nothing to name it from.
    tagless = [t["id"] for t in to_name if not topic_evidence(t)["tags"]]
    if tagless:
        _log(f"topics {', '.join(tagless)} have only denied tags, keeping auto names")
        to_name = [t for t in to_name if t["id"] not in tagless]
    taken = sorted({entry["name"] for entry in carried.values()})
    if not model_id:
        outcome["reason"] = "model id unset"
        _log("ML_BEDROCK_MODEL_ID is unset, keeping auto names")
        return payload()
    if not to_name:
        outcome["mode"] = "llm"
        _log("every topic carried over an edited name or has only denied tags, nothing to ask")
        return payload()
    _log(
        f"{len(to_name)} topics to name with {model_id} in "
        f"{os.environ.get('ML_BEDROCK_REGION') or os.environ.get('AWS_REGION')}, "
        f"falling back to {os.environ.get('ML_BEDROCK_FALLBACK_MODEL_ID') or 'nothing'} on refusals"
    )

    try:
        client = _client()
        trace["actorPrompt"] = actor_prompt(to_name, taken)
        asked = [t["id"] for t in to_name]
        trace["actor"] = parse_entries(_ask(client, model_id, trace["actorPrompt"], "actor"), asked)
        proposed = {topic_id: entry["name"] for topic_id, entry in trace["actor"].items()}
    except Exception as exc:  # noqa: BLE001 - naming never blocks the run
        outcome["reason"] = f"actor: {exc}"
        _log(f"actor call failed, keeping auto names: {exc}")
        return payload()
    _log(f"actor: named {len(proposed)} of {len(asked)} topics")
    unanswered = [topic_id for topic_id in asked if topic_id not in proposed]
    if unanswered:
        _log(f"actor: no usable name for topics {', '.join(unanswered)}")
    if not proposed:
        outcome["reason"] = "unusable actor response"
        return payload()

    final = dict(proposed)
    try:
        trace["criticPrompt"] = critic_prompt(to_name, proposed, taken)
        trace["critic"] = parse_entries(_ask(client, model_id, trace["criticPrompt"], "critic"), list(proposed))
        reviewed = {topic_id: entry["name"] for topic_id, entry in trace["critic"].items()}
        outcome["criticRevised"] = sum(1 for t, name in reviewed.items() if name != proposed[t])
        for topic_id, name in reviewed.items():
            if name != proposed[topic_id]:
                _log(f"critic: topic {topic_id} '{proposed[topic_id]}' -> '{name}': {trace['critic'][topic_id]['reason']}")
        final.update(reviewed)
        _log(f"critic: reviewed {len(reviewed)} of {len(proposed)} names, revised {outcome['criticRevised']}")
    except Exception as exc:  # noqa: BLE001 - the actor's names stand
        _log(f"critic call failed, keeping actor names: {exc}")

    for topic_id, name in final.items():
        names[topic_id].update({"name": name, "source": "llm", "llm": name})
    outcome.update({"mode": "llm", "named": len(final)})
    missing = len(to_name) - len(final)
    if missing:
        outcome["reason"] = f"{missing} topics missing from the response kept auto names"
    _log(
        f"done: {len(final)} named, {len(carried)} carried over, {missing + len(tagless)} kept auto names "
        f"({len(tagless)} with only denied tags), {outcome['criticRevised']} revised by the critic"
    )
    return payload()
