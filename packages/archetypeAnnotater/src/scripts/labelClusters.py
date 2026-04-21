"""Label clusters using a two-pass LLM approach via AWS Bedrock.

Pass 1: Assign a broad archetype label to each cluster (Aggro, Midrange, Reanimator, Elves, etc.)
Pass 2: Find duplicate labels and refine them with distinguishing qualifiers.

Usage:
  python3 src/scripts/labelClusters.py [--dry-run] [--batch-size 20]

Requires: pip install boto3 (+ AWS credentials configured)
"""
import argparse
import json
import os
import sys
import time
from collections import Counter

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, '..', '..', 'data', 'app')

MODEL_ID = "us.anthropic.claude-opus-4-5-20251101-v1:0"

PASS1_SYSTEM = """You are an expert Magic: The Gathering cube metagame analyst.

You will receive deck clusters with an ID, deck count, and top 40 synergy-scored cards.

Assign each cluster a SHORT archetype label (1-3 words). This is a first pass — duplicates are fine and expected.

Rules:
- NO card names. The input cards are data to analyze, not words for labels. Creature types (Goblins, Elves, Zombies) and card types (Artifacts, Enchantments) are allowed.
- NO colors, pair names (Rakdos, Simic), or abbreviations (UW, BG). For 4-5 color clusters use "Soup".
- NO set names (Innistrad, Eldraine, etc.).
- Use "Typal" not "Tribal". Use "Soup" not "Goodstuff".
- Use broad established archetype names: Aggro, Midrange, Control, Reanimator, Storm, Tokens, Aristocrats, Blink, Ramp, Lands, Prowess, Dredge, Elves, Goblins, Spellslinger, etc.

Respond with ONLY a JSON object mapping cluster ID (string) to label (string). No markdown, no explanation."""

PASS2_SYSTEM = """You are an expert Magic: The Gathering cube metagame analyst.

You will receive groups of deck clusters that currently share the same archetype label. Each cluster has an ID, deck count, and top 40 synergy-scored cards.

Your job: refine each cluster's label so they are distinguishable from each other. Add a qualifier, use "X Matters", "X & Y", or any other short modifier that captures what makes each one unique.

Rules:
- NO card names. Creature types and card types are allowed.
- NO colors, pair names, or abbreviations. Use "Soup" for 4-5 color.
- NO set names. Use flavorful descriptors instead (e.g. "Critters" not "Bloomburrow", "Fairy Tale" not "Eldraine").
- Use "Typal" not "Tribal". Use "Soup" not "Goodstuff".
- Keep labels 2-4 words.
- If a group has only 2-3 clusters, simple qualifiers suffice (e.g. "Aggro" → "Tempo Aggro" vs "Token Aggro").
- For larger groups, look deeper at the card differences to find meaningful distinctions.

Respond with ONLY a JSON object mapping cluster ID (string) to new label (string). No markdown, no explanation."""

# Words that must never appear in labels (case-insensitive)
BANNED_WORDS = {
    "white", "blue", "black", "red", "green", "colorless",
    "mono", "multicolor", "multicolour", "five color", "four color",
    "three color", "two color",
    "azorius", "dimir", "rakdos", "gruul", "selesnya",
    "orzhov", "izzet", "golgari", "boros", "simic",
    "esper", "grixis", "jund", "naya", "bant",
    "abzan", "jeskai", "sultai", "mardu", "temur",
    "tribal", "goodstuff", "miscellaneous", "generic",
    "unclassified", "cube",
    "plains", "island", "swamp", "mountain", "forest", "wastes",
}

# Creature types / card types that are allowed even if they match card names
ALLOWED_WORDS = {
    "goblin", "goblins", "zombie", "zombies", "elf", "elves",
    "human", "humans", "spirit", "spirits", "faerie", "faeries",
    "dragon", "dragons", "angel", "angels", "demon", "demons",
    "vampire", "vampires", "wizard", "wizards", "knight", "knights",
    "sliver", "slivers", "merfolk", "cat", "cats", "rat", "rats",
    "beast", "beasts", "elemental", "elementals", "soldier", "soldiers",
    "warrior", "warriors", "cleric", "clerics", "rogue", "rogues",
    "shaman", "artifact", "artifacts", "enchantment", "enchantments",
    "equipment", "instant", "sorcery", "creature", "planeswalker",
    "land", "lands", "token", "tokens", "mouse", "mice",
    "rabbit", "rabbits", "wolf", "wolves", "bird", "birds",
    "typal", "soup", "spore", "fungus",
}


def collect_card_names(summaries: list[dict]) -> set[str]:
    """Build a set of all card names from cluster data (lowercased)."""
    names = set()
    for cluster in summaries:
        for card in cluster.get("topCards", []):
            name = card["name"].lower()
            names.add(name)
            for word in name.split():
                if len(word) >= 4:
                    names.add(word)
    return names


def find_violations(result: dict, card_names: set[str]) -> dict[str, list[str]]:
    """Check labels for banned words / card names."""
    violations = {}
    for cid, label in result.items():
        label_lower = label.lower()
        problems = []
        for word in BANNED_WORDS:
            if word in label_lower:
                problems.append(f"'{word}'")
        for lw in label_lower.split():
            clean = lw.strip(".,!?&+/")
            if clean in card_names and clean not in ALLOWED_WORDS:
                problems.append(f"card:'{clean}'")
        if problems:
            violations[cid] = problems
    return violations


def build_batch_prompt(clusters: list[dict]) -> str:
    lines = []
    for c in clusters:
        cid = c['clusterId']
        count = c['count']
        top = c.get('topCards', [])
        cards_str = ', '.join(
            f"{card['name']} ({card['synergy']:.3f})" for card in top
        )
        lines.append(f"Cluster {cid} (n={count}): {cards_str}")
    return '\n'.join(lines)


def call_bedrock(client, system: str, prompt: str, card_names: set[str],
                 max_fixes: int = 3) -> dict:
    """Call Bedrock, validate, auto-fix violations via multi-turn."""
    messages = [{"role": "user", "content": [{"text": prompt}]}]
    full_result = {}

    for attempt in range(1 + max_fixes):
        response = client.converse(
            modelId=MODEL_ID,
            system=[{"text": system}],
            messages=messages,
            inferenceConfig={"maxTokens": 4096},
        )
        text = response["output"]["message"]["content"][0]["text"].strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            text = text.rsplit("```", 1)[0]

        try:
            partial = json.loads(text)
        except json.JSONDecodeError:
            print(f"[JSON error, retrying]", end=" ", flush=True)
            messages.append({"role": "assistant", "content": [{"text": text}]})
            messages.append({"role": "user", "content": [{"text":
                "That was not valid JSON. Please respond with ONLY a JSON object."}]})
            continue

        full_result.update(partial)

        violations = find_violations(full_result, card_names)
        if not violations:
            return full_result

        fix_lines = [f'  {cid} "{full_result[cid]}": {", ".join(p)}'
                     for cid, p in violations.items()]
        fix_prompt = (
            "These labels have banned words or card names:\n"
            + "\n".join(fix_lines)
            + "\n\nRewrite ONLY those. Same JSON format."
        )
        print(f"[fix {len(violations)}]", end=" ", flush=True)
        messages.append({"role": "assistant", "content": [{"text": text}]})
        messages.append({"role": "user", "content": [{"text": fix_prompt}]})

    return full_result


def main():
    parser = argparse.ArgumentParser(
        description="Two-pass cluster labeling via Bedrock")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--batch-size", type=int, default=20)
    parser.add_argument("--pass2-only", action="store_true",
                        help="Skip pass 1, refine existing labels")
    args = parser.parse_args()

    summaries_path = os.path.join(DATA_DIR, "clusterSummaries.json")
    annotations_path = os.path.join(DATA_DIR, "annotations.json")

    with open(summaries_path) as f:
        summaries = json.load(f)
    summaries.sort(key=lambda c: c["clusterId"])

    cluster_by_id = {str(c["clusterId"]): c for c in summaries}
    card_names = collect_card_names(summaries)
    print(f"{len(summaries)} clusters, {len(card_names)} card tokens for validation")

    if args.dry_run:
        batch = summaries[:args.batch_size]
        print(f"\n--- Pass 1 sample ({len(batch)} clusters) ---")
        print(build_batch_prompt(batch)[:3000])
        return

    import boto3
    client = boto3.client("bedrock-runtime", region_name="us-east-2")
    print(f"Model: {MODEL_ID}")

    annotations: dict[str, str] = {}

    # ── PASS 1: Broad labels ──
    if not args.pass2_only:
        print(f"\n=== PASS 1: Broad archetype labels ===")
        total = (len(summaries) + args.batch_size - 1) // args.batch_size
        for i in range(0, len(summaries), args.batch_size):
            batch = summaries[i:i + args.batch_size]
            n = i // args.batch_size + 1
            print(f"Batch {n}/{total} "
                  f"(clusters {batch[0]['clusterId']}-{batch[-1]['clusterId']})...",
                  end=" ", flush=True)

            prompt = build_batch_prompt(batch)
            result = call_bedrock(client, PASS1_SYSTEM, prompt, card_names)
            annotations.update(result)
            print(f"got {len(result)} labels")

            with open(annotations_path, "w") as f:
                json.dump(annotations, f, indent=2)

            if i + args.batch_size < len(summaries):
                time.sleep(1)

        counts = Counter(annotations.values())
        unique = len(counts)
        dupes = sum(1 for c in counts.values() if c > 1)
        print(f"\nPass 1 done: {len(annotations)} labels, "
              f"{unique} unique, {dupes} labels used more than once")
        print("Top labels:", ", ".join(
            f"{l}({c})" for l, c in counts.most_common(15)))
    else:
        # Load existing pass-1 labels
        with open(annotations_path) as f:
            annotations = json.load(f)
        print(f"Loaded {len(annotations)} existing labels for refinement")

    # ── PASS 2: Refine duplicates ──
    print(f"\n=== PASS 2: Refine duplicate labels ===")
    counts = Counter(annotations.values())
    dupe_labels = {label for label, count in counts.items() if count > 1}

    if not dupe_labels:
        print("No duplicates to refine!")
    else:
        print(f"{len(dupe_labels)} labels need refinement "
              f"({sum(counts[l] for l in dupe_labels)} clusters)")

        for label in sorted(dupe_labels):
            cids = [cid for cid, lbl in annotations.items() if lbl == label]
            clusters = [cluster_by_id[cid] for cid in cids]
            n = len(clusters)
            print(f'  "{label}" x{n}...', end=" ", flush=True)

            header = (
                f'These {n} clusters all have the label "{label}". '
                f"Differentiate them with qualifiers.\n\n"
            )
            prompt = header + build_batch_prompt(clusters)
            result = call_bedrock(client, PASS2_SYSTEM, prompt, card_names)
            annotations.update(result)

            new_labels = [result.get(cid, "?") for cid in cids]
            print(f"→ {', '.join(new_labels)}")

            with open(annotations_path, "w") as f:
                json.dump(annotations, f, indent=2)

            time.sleep(1)

    # ── Summary ──
    final_counts = Counter(annotations.values())
    remaining_dupes = sum(1 for c in final_counts.values() if c > 1)
    print(f"\nDone! {len(annotations)} clusters, "
          f"{len(final_counts)} unique labels, "
          f"{remaining_dupes} still duplicated")
    print(f"Saved to {annotations_path}")

    print("\nLabel distribution:")
    for label, count in final_counts.most_common():
        print(f"  {label}: {count}")


if __name__ == "__main__":
    main()
