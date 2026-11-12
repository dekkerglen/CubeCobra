"""Build a run's archetypes locally, name them, review the names, and commit them once approved.

For revising the archetypes (ccml/topics.py) and the naming prompts (RULES, actor_prompt and
critic_prompt in ccml/name_topics.py) without a retraining run: the commands run the pipeline's own
code with your AWS credentials, and nothing changes in S3 until commit.

    python -m ccml.review_names topics <id>    # clusters the run's training decks into archetypes, then names them
    python -m ccml.review_names propose <id>   # names the archetypes again, without re-clustering
    python -m ccml.review_names show <id>      # the saved proposal next to the committed names
    python -m ccml.review_names commit <id>    # lists the changes, asks, then writes them

topics downloads the run's training data once (ML_WORK_DIR/<id>/data, about 400 MB) and saves the
archetypes to ML_WORK_DIR/naming/<id>.topics.json, then names them like propose. While that file
exists, propose names those archetypes instead of the committed ones and commit replaces the
committed archetypes with them; delete it to go back to the committed archetypes.

<id> is a run id, which is also the version the run publishes as. A proposal is a local file,
ML_WORK_DIR/naming/<id>.json; change a "name" in it by hand to override Claude, and commit marks it
edited so later runs carry it over. Beside it, <id>.review.json lists every archetype with its name,
the tags Claude was sent, and the name and reason from each call; the prompts themselves are in
<id>.actor-prompt.txt and <id>.critic-prompt.txt.

Commit writes archetypes/names.json and naming.json (and topics.json, from a local build) to the
run's bundle, which publishing copies, and to model/<id>/archetypes/ in every bucket the version is
already published to. Servers load archetypes at boot, so a served version's changes show after the
next restart. R2 copies aren't updated: nothing reads archetypes from R2.
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

from ccml import storage
from ccml.config import RunContext
from ccml.name_topics import auto_name, name_topics, topic_evidence

# The production pipeline's settings (packages/cdk/config.ts mlPipeline); the same environment
# variables override them.
DEFAULTS = {
    "ML_RUNS_BUCKET": "cubecobra-data-production",
    "ML_PUBLISH_BUCKETS": "cubecobra-data-beta,cubecobra-data-production",
    "ML_BEDROCK_MODEL_ID": "anthropic.claude-opus-5-5",
    "ML_BEDROCK_FALLBACK_MODEL_ID": "anthropic.claude-opus-4-8",
    "ML_BEDROCK_REGION": "us-east-1",
}

# The admin page's limit (MAX_ARCHETYPE_NAME_LENGTH in routes/admin/archetypes.ts).
MAX_NAME_LENGTH = 40


def _env(name: str) -> str:
    return os.environ.get(name) or DEFAULTS[name]


def locations(version: str) -> list[tuple[str, str]]:
    """(bucket, archetypes prefix) for every copy of the version's archetypes: the run's bundle
    first, then each published copy."""
    candidates = [(_env("ML_RUNS_BUCKET"), f"ml/runs/{version}/bundle/archetypes/")]
    candidates += [(bucket, f"model/{version}/archetypes/") for bucket in _env("ML_PUBLISH_BUCKETS").split(",")]
    return [(bucket, prefix) for bucket, prefix in candidates if storage.exists(bucket, prefix + "topics.json")]


def _work_dir() -> Path:
    return Path(os.environ.get("ML_WORK_DIR", "/tmp/ml"))


def proposal_path(version: str) -> Path:
    return _work_dir() / "naming" / f"{version}.json"


def local_topics_path(version: str) -> Path:
    return _work_dir() / "naming" / f"{version}.topics.json"


def mark_hand_edits(names: dict, now: int) -> dict:
    """Names changed by hand in the proposal file become edited names."""
    marked = {}
    for topic_id, entry in names.items():
        expected = entry.get("llm") if entry.get("source") == "llm" else entry.get("auto")
        if entry.get("source") != "edited" and entry["name"] != expected:
            entry = {**entry, "source": "edited", "editedAt": now}
        marked[topic_id] = entry
    return marked


def problems(names: dict) -> list[str]:
    out = []
    for topic_id, entry in names.items():
        name = entry.get("name")
        if not isinstance(name, str) or not name.strip():
            out.append(f"topic {topic_id}: empty name")
        elif len(name) > MAX_NAME_LENGTH:
            out.append(f"topic {topic_id}: '{name}' is over {MAX_NAME_LENGTH} characters")
    return out


def duplicates(names: dict) -> list[str]:
    seen, repeated = set(), set()
    for entry in names.values():
        key = entry["name"].strip().lower()
        (repeated if key in seen else seen).add(key)
    return sorted({entry["name"] for entry in names.values() if entry["name"].strip().lower() in repeated})


def review_entries(topics: list[dict], names: dict, committed: dict, trace: dict) -> list[dict]:
    """Per topic, by deck share: its name, the tags Claude was sent, and the name at each step."""
    actor, critic = trace.get("actor", {}), trace.get("critic", {})
    entries = []
    for topic in sorted(topics, key=lambda t: -t["deckShare"]):
        topic_id = topic["id"]
        entries.append(
            {
                "id": topic_id,
                "deckShare": topic["deckShare"],
                "sentToClaude": topic_evidence(topic)["tags"],
                "committed": committed.get(topic_id, {}).get("name"),
                "auto": names[topic_id]["auto"],
                "actor": actor.get(topic_id),
                "critic": critic.get(topic_id),
                "proposed": names[topic_id]["name"],
                "source": names[topic_id]["source"],
            }
        )
    return entries


def _cell(text: str, width: int) -> str:
    return text if len(text) <= width else text[: width - 1] + "…"


def print_table(topics: list[dict], committed: dict, proposed: dict, previous: dict | None) -> None:
    """Topics by deck share. '*' marks a name that differs from the previous proposal."""
    print(f"{'id':>4}  {'decks':>6}  {'committed':<34}   proposed")
    for topic in sorted(topics, key=lambda t: -t["deckShare"]):
        topic_id = topic["id"]
        now = proposed[topic_id]["name"]
        before = committed.get(topic_id, {}).get("name", "")
        mark = "*" if previous and previous.get(topic_id, {}).get("name") != now else " "
        arrow = "->" if now != before else "  "
        print(f"{topic_id:>4}  {topic['deckShare']:>6.1%}  {_cell(before, 34):<34}{arrow}{mark}{now}")


def _load(path: Path):
    return json.loads(path.read_text()) if path.exists() else None


def _source(version: str):
    """(copies, topics payload, committed names, local): the archetypes to name, from a local build
    when there is one. A local build's archetypes are new, so nothing is committed for them yet."""
    places = locations(version)
    if not places:
        sys.exit(f"No archetypes for {version} in the run's bundle or any published copy yet.")
    bucket, prefix = places[0]
    for other_bucket, other_prefix in places[1:]:
        print(f"Also published at s3://{other_bucket}/{other_prefix}", flush=True)
    local = _load(local_topics_path(version))
    if local:
        print(
            f"Archetypes: local build {local_topics_path(version)}, {len(local['topics'])} archetypes "
            f"(commit replaces s3://{bucket}/{prefix}topics.json)",
            flush=True,
        )
        return places, local, {}, True
    payload = storage.read_json(bucket, prefix + "topics.json")
    committed = (storage.read_json(bucket, prefix + "names.json") or {}).get("names", {})
    vectors = sum(1 for topic in payload["topics"] if topic.get("tagWeights"))
    print(
        f"Archetypes: s3://{bucket}/{prefix}topics.json, {len(payload['topics'])} archetypes, "
        + (f"{vectors} with tag vectors" if vectors else "top tags only (built before tag vectors)"),
        flush=True,
    )
    return places, payload, committed, False


def build(version: str) -> None:
    from ccml import topics as archetypes  # numpy, scipy and scikit-learn, only needed here

    ctx = RunContext(run_id=version, bucket=_env("ML_RUNS_BUCKET"), work_dir=_work_dir() / version)
    ctx.work_dir.mkdir(parents=True, exist_ok=True)
    cards, deck_matrix = archetypes.load_training_data(ctx)
    payload, _ = archetypes.build_topics(cards, deck_matrix)

    path = local_topics_path(version)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload))
    print(f"Saved {len(payload['topics'])} archetypes to {path}; naming them\n", flush=True)
    propose(version)


def propose(version: str) -> None:
    for name in ("ML_BEDROCK_MODEL_ID", "ML_BEDROCK_FALLBACK_MODEL_ID", "ML_BEDROCK_REGION"):
        os.environ.setdefault(name, DEFAULTS[name])
    _, payload, committed, local = _source(version)
    topics = payload["topics"]
    path = proposal_path(version)
    previous = _load(path)
    if previous and previous.get("topicsCreatedAt") != payload["createdAt"]:
        previous = None  # named different archetypes
    if previous:
        print(f"Previous proposal: {path} (names marked * changed since)", flush=True)

    trace = {}
    names, outcome = name_topics(topics, [auto_name(t["topTags"]) for t in topics], _env("ML_RUNS_BUCKET"), trace=trace)

    path.parent.mkdir(parents=True, exist_ok=True)
    proposal = {
        "version": version,
        "topicsCreatedAt": payload["createdAt"],
        "localTopics": local,
        "names": names["names"],
        "naming": outcome,
    }
    path.write_text(json.dumps(proposal, indent=2))
    prompts = {}
    for step in ("actor", "critic"):
        if f"{step}Prompt" in trace:
            prompts[step] = str(path.with_name(f"{version}.{step}-prompt.txt"))
            Path(prompts[step]).write_text(trace[f"{step}Prompt"])
    review_path = path.with_name(f"{version}.review.json")
    review = {
        "version": version,
        "outcome": outcome,
        "prompts": prompts,
        "topics": review_entries(topics, names["names"], committed, trace),
    }
    review_path.write_text(json.dumps(review, indent=2))
    print()
    for topic in sorted(topics, key=lambda t: -t["deckShare"]):
        tags = ", ".join(entry["tag"] for entry in topic_evidence(topic)["tags"])
        name = names["names"][topic["id"]]["name"]
        mark = "*" if previous and previous["names"].get(topic["id"], {}).get("name") != name else " "
        print(f"{topic['id']:>4}  {topic['deckShare']:>6.1%} {mark}{_cell(name, 28):<28}  {tags}")
    print(
        f"\n{outcome['mode']}: {outcome['named']} named, {outcome['carriedOver']} carried over, "
        f"{outcome['criticRevised']} revised by the critic" + (f" ({outcome['reason']})" if outcome["reason"] else "")
    )
    repeated = duplicates(names["names"])
    if repeated:
        print(f"Repeated names: {', '.join(repeated)}")
    print(f"Saved to {path}\nReview: {review_path}")


def show(version: str) -> None:
    proposal = _load(proposal_path(version))
    if not proposal:
        sys.exit(f"No proposal for {version}; run propose first.")
    _, payload, committed, _ = _source(version)
    print_table(payload["topics"], committed, proposal["names"], None)


def commit(version: str) -> None:
    proposal = _load(proposal_path(version))
    if not proposal:
        sys.exit(f"No proposal for {version}; run propose first.")
    now = int(time.time() * 1000)
    names = mark_hand_edits(proposal["names"], now)
    found = problems(names)
    if found:
        sys.exit("Fix these in the proposal first:\n  " + "\n  ".join(found))

    places, payload, _, local = _source(version)
    topics = payload["topics"]
    if proposal.get("topicsCreatedAt") != payload["createdAt"] or {t["id"] for t in topics} != set(names):
        sys.exit("The archetypes changed since this proposal; run propose again.")
    # Read once before asking: a copy that changes while this waits for approval isn't overwritten.
    current = {place: storage.read_json_with_etag(place[0], place[1] + "names.json") for place in places}
    current_topics = (
        {place: storage.read_json_with_etag(place[0], place[1] + "topics.json") for place in places} if local else {}
    )

    def topics_differ(place) -> bool:
        return local and (current_topics[place][0] or {}).get("createdAt") != payload["createdAt"]

    stale = [place for place in places if (current[place][0] or {}).get("names", {}) != names or topics_differ(place)]
    if not stale:
        print("Nothing to commit: every copy already has these archetypes and names.")
        return

    committed = {} if local else (current[places[0]][0] or {}).get("names", {})
    changed = {t for t, entry in names.items() if committed.get(t, {}).get("name") != entry["name"]}
    print_table([t for t in topics if t["id"] in changed], committed, names, None)
    repeated = duplicates(names)
    if repeated:
        print(f"\nRepeated names: {', '.join(repeated)}")
    if local:
        replaced = len((current_topics[places[0]][0] or {}).get("topics", []))
        print(f"\nReplaces the {replaced} committed archetypes with these {len(topics)} from the local build.")
    for bucket, prefix in places[1:]:
        if not local and (current[(bucket, prefix)][0] or {}).get("names", {}) != committed:
            print(f"\ns3://{bucket}/{prefix}names.json differs from the copy above (edited on the admin page?).")
    targets = "\n  ".join(f"s3://{bucket}/{prefix}" for bucket, prefix in stale)
    what = "these archetypes and names" if local else f"these names ({len(changed)} changed)"
    answer = input(f"\nCommit {what} to\n  {targets}\n? [y/N] ")
    if answer.strip().lower() not in ("y", "yes"):
        print("Not committed.")
        return

    names_payload = {"names": names, "updatedAt": now}
    for place in stale:
        bucket, prefix = place
        if topics_differ(place) and not storage.write_json_if_unchanged(
            bucket, prefix + "topics.json", payload, current_topics[place][1]
        ):
            print(f"s3://{bucket}/{prefix}topics.json changed since it was read; skipped. Run commit again.")
            continue
        if not storage.write_json_if_unchanged(bucket, prefix + "names.json", names_payload, current[place][1]):
            print(
                f"s3://{bucket}/{prefix}names.json changed since it was read; skipped"
                + (" after replacing its archetypes" if topics_differ(place) else "")
                + ". Run commit again."
            )
            continue
        storage.write_json(bucket, prefix + "naming.json", proposal["naming"])
        print(f"Committed to s3://{bucket}/{prefix}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build and name archetypes locally and commit approved ones.")
    parser.add_argument("command", choices=["topics", "propose", "show", "commit"])
    parser.add_argument("version", help="run id (the version it publishes as)")
    args = parser.parse_args()
    {"topics": build, "propose": propose, "show": show, "commit": commit}[args.command](args.version)


if __name__ == "__main__":
    main()
