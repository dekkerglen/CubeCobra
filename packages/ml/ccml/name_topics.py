"""Archetype names for the topics found by ccml.topics, adapted from mp-deckbuilder-server's
name_topics.

1. Names an admin edited on the live version carry over to the new topic whose top tags overlap the
   old topic's most (Jaccard at least 0.5). Topic ids change between runs, top tags mostly don't.
2. Claude on Amazon Bedrock names the rest in two strict-JSON calls covering every topic at once,
   so names stay distinct: an actor proposes names, then a critic re-reads each against its evidence
   (top tags, representative cards, deck makeup) and revises names that don't fit.

Never blocks the run, since names are cosmetic and admins can edit them: with no model configured,
on any Bedrock error or unusable response, topics keep their auto names (top three tags); a failed
critic leaves the actor's names. naming.json records which of these happened.
"""

import json
import os
import time

from ccml import storage

JACCARD_CARRY_OVER = 0.5
MAX_TOKENS = 64000

NAMES_SCHEMA = {
    "type": "object",
    "properties": {
        "names": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"topic_id": {"type": "string"}, "name": {"type": "string"}},
                "required": ["topic_id", "name"],
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
- Name a strategy a drafter builds toward, never a card role every deck plays: 'Removal', 'Card
  Draw', 'Sweepers', 'Combat Tricks' and 'Counterspells' are components, not archetypes. For a
  role-shaped topic, name the archetype its cards and deck makeup serve: cheap creatures and burn
  at a low average mana value is 'Aggro'; counterspells, removal and few creatures is 'Control';
  pump spells is 'Power Matters'.
- Prefer the broadest name the evidence supports ('Artifacts', not 'Artifact Tokens').
- Names must be unique across topics and must not repeat a name already in use. When two topics
  share a dominant archetype, keep it on the topic whose evidence supports it more strongly and
  name the other after its next-most-prominent theme."""


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


def parse_names(text: str, topic_ids) -> dict[str, str]:
    """{topic id: name} for the ids asked about; {} when the response is unusable."""
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return {}
    wanted = set(topic_ids)
    out = {}
    for entry in data.get("names", []) if isinstance(data, dict) else []:
        topic_id, name = entry.get("topic_id"), entry.get("name")
        if topic_id in wanted and isinstance(name, str) and name.strip():
            out[topic_id] = name.strip()
    return out


def _evidence(topic: dict) -> dict:
    return {
        "topic_id": topic["id"],
        "top_tags": topic["topTags"],
        "representative_cards": topic["cards"],
        "deck_makeup": {
            "average_mana_value": topic["shape"]["avgManaValue"],
            "creature_share": topic["shape"]["creatureShare"],
            "instant_sorcery_share": topic["shape"]["instantSorceryShare"],
        },
        "share_of_decks": topic["deckShare"],
    }


def actor_prompt(topics: list[dict], taken: list[str]) -> str:
    lines = "\n".join(json.dumps(_evidence(t)) for t in topics)
    return (
        "You are naming Magic: The Gathering cube draft archetypes discovered by topic modeling over\n"
        "the Scryfall oracle tags of recently drafted decks. Each topic lists its top oracle-tag slugs,\n"
        "the cards that load on it most heavily, and the makeup of decks where it dominates.\n"
        "Give every topic_id a short player-facing archetype name.\n\n"
        f"{RULES}\n\nNames already in use: {json.dumps(taken)}\n\nTopics:\n{lines}"
    )


def critic_prompt(topics: list[dict], proposed: dict[str, str], taken: list[str]) -> str:
    lines = "\n".join(
        json.dumps({"proposed_name": proposed[t["id"]], **_evidence(t)}) for t in topics if t["id"] in proposed
    )
    return (
        "You are reviewing proposed names for Magic: The Gathering cube draft archetypes discovered\n"
        "by topic modeling over the Scryfall oracle tags of recently drafted decks. Each topic lists its\n"
        "proposed name and its evidence: top oracle-tag slugs, highest-loading cards, the makeup of\n"
        "decks where it dominates, and its share of decks.\n"
        "Check that each name accurately describes its evidence and revise the ones that don't. Return\n"
        "every topic_id with its final name, the proposed name unchanged when it is accurate.\n\n"
        f"{RULES}\n\nNames already in use: {json.dumps(taken)}\n\nTopics:\n{lines}"
    )


def _ask(client, model_id: str, prompt: str) -> str:
    """One structured-output call; the refusal-fallback middleware retries refusals on the fallback model."""
    from anthropic import BetaFallbackState

    with BetaFallbackState(), client.beta.messages.stream(
        model=model_id,
        max_tokens=MAX_TOKENS,
        thinking={"type": "adaptive"},
        output_config={"effort": "high", "format": {"type": "json_schema", "schema": NAMES_SCHEMA}},
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        message = stream.get_final_message()
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
            return [], {}
        prefix = f"model/{pointer['version']}/archetypes/"
        topics = storage.read_json(bucket, prefix + "topics.json") or {}
        names = storage.read_json(bucket, prefix + "names.json") or {}
        return topics.get("topics", []), names.get("names", {})
    except Exception as exc:  # noqa: BLE001 - carrying edits over is best-effort
        print(f"[naming] could not read live archetypes: {exc}", flush=True)
        return [], {}


def name_topics(topics: list[dict], auto_names: list[str], live_bucket: str | None) -> tuple[dict, dict]:
    """Returns (names.json payload, naming.json payload)."""
    now = int(time.time() * 1000)
    names = {t["id"]: {"name": auto, "source": "auto", "auto": auto} for t, auto in zip(topics, auto_names)}

    live_topics, live_names = _live_archetypes(live_bucket)
    carried = carry_over_edits(topics, live_topics, live_names)
    for topic_id, entry in carried.items():
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
    taken = sorted({entry["name"] for entry in carried.values()})
    if not model_id:
        outcome["reason"] = "model id unset"
        return payload()
    if not to_name:
        outcome["mode"] = "llm"
        return payload()

    try:
        client = _client()
        proposed = parse_names(_ask(client, model_id, actor_prompt(to_name, taken)), [t["id"] for t in to_name])
    except Exception as exc:  # noqa: BLE001 - naming never blocks the run
        outcome["reason"] = f"actor: {exc}"
        print(f"[naming] actor call failed, keeping auto names: {exc}", flush=True)
        return payload()
    if not proposed:
        outcome["reason"] = "unusable actor response"
        return payload()

    final = dict(proposed)
    try:
        reviewed = parse_names(_ask(client, model_id, critic_prompt(to_name, proposed, taken)), list(proposed))
        outcome["criticRevised"] = sum(1 for t, name in reviewed.items() if name != proposed[t])
        final.update(reviewed)
    except Exception as exc:  # noqa: BLE001 - the actor's names stand
        print(f"[naming] critic call failed, keeping actor names: {exc}", flush=True)

    for topic_id, name in final.items():
        names[topic_id].update({"name": name, "source": "llm", "llm": name})
    outcome.update({"mode": "llm", "named": len(final)})
    missing = len(to_name) - len(final)
    if missing:
        outcome["reason"] = f"{missing} topics missing from the response kept auto names"
    return payload()
