"""Oracle tags that archetype topics ignore: they don't describe a strategy a cube drafter builds.

ccml.topics leaves these out of the tag vocabulary, so they never shape a topic, and ccml.name_topics
never shows them to the namer. Each group lists exact tags plus patterns for families whose future
members belong too (a new tribe's typal-<tribe> tag, a new type-errata-<x>).

Typal stays in as its generic tags only: typal, typal-creature, noncreature-typal and the
typal-choose / -share / -coupling / -exclusion mechanics, plus changeling.
"""

import re

COLORS = "white|blue|black|red|green"
BASIC_TYPES = "plains|island|swamp|mountain|forest"
GENERIC_TYPAL = "creature|choose|share|coupling|exclusion"

DENIED_TAGS: dict[str, set[str]] = {
    # The card's name, wording or references, not what it does.
    "names and wording": {
        "anagram",
        "card-names",
        "creature-type-name",
        "doctor-who-episode-name",
        "episode-name",
        "eponymous",
        "eponymous-planeswalker",
        "game-name",
        "misnomer",
        "portmanteau",
        "punny-name",
        "quote-name",
        "real-life-animal-name",
        "references-keyword",
        "rhyming-name",
        "shares-name-with-a-mechanic",
        "single-english-word-name",
    },
    # A specific color, color pair or basic land type. The site shows a deck's colors separately.
    "colors": {
        "cda-color",
        "chromatic-lantern",
        "color-break",
        "color-change",
        "color-change-self",
        "color-spent-matters",
        "converge",
        "hate-color",
        "hate-color-choose",
        "offcolor-ability",
        "offcolor-additional-cost",
        "out-of-color-token",
        "single-minded-color-hate",
        "synergy-color-each",
        "synergy-color-share",
        "synergy-colorless",
        "synergy-multicolor",
    },
    # One tribe, or a mechanic only one tribe has.
    "tribes": {
        "catch-22",
        "day-night",
        "hate-typal",
        "sliver-stackable",
        "synergy-party",
        "werewolf-mechanic",
    },
    # Rules mechanics and templating every kind of deck has.
    "rules and templating": {
        "activated-ability",
        "breaks-ktk-morph-rule",
        "cda-power",
        "cda-subtype",
        "cda-toughness",
        "characteristic-defining-ability",
        "cr-107-3f-x-card",
        "delayed-replacement-effect",
        "faux-targeting",
        "fun-ruling",
        "indefinite-effect",
        "intervening-if-clause",
        "notorious-templating",
        "old-blocking-deathtouch",
        "passive-ability",
        "reflexive-trigger",
        "rules-nightmare",
        "self-replacement-effect",
        "state-trigger",
        "triggered-ability",
        "unnoted-tracked-information",
        "untracked-indefinite-effect",
    },
    # Errata, printings and card history.
    "errata and printings": {
        "day-zero-errata",
        "digital-only-mechanics",
        "keyword-errata",
        "keyword-errata-flash",
        "paper-compatible",
        "potentially-black-border",
        "token-errata",
        "unstable-variant",
    },
    # Design notes, flavor and type-line trivia.
    "design and flavor": {
        "aesthetic-counter",
        "class-type-only",
        "counter-fuel-aesthetic",
        "creates-oracle-token",
        "creates-token-of-a-card",
        "draft-signpost",
        "flavors-of-vanilla",
        "front-card",
        "has-identical-token",
        "helper-card",
        "legendary-team-up",
        "meme",
        "mirrored-knight",
        "mix-and-match",
        "mixed-subtypes",
        "multi-character-card",
        "multiple-species-types",
        "named-token",
        "tokenlink",
        "token-versions-of-cards",
        "tome",
        "unprinted-token",
        "vanilla-aura",
        "vanilla-equipment",
        "vanity-card",
        "vertical-cycle",
        "virtual-french-vanilla",
        "virtual-legendary",
        "virtual-vanilla",
    },
    # Un-sets and licensed-set flavor.
    "novelty sets": {
        "40k-model",
        "art-matters",
        "dexterity",
        "inscryption-achievement",
        "open-attraction",
        "place-sticker",
        "players-outside-game-matter",
        "speech-matters",
        "synergy-sticker",
    },
    # Commander, multiplayer and other formats; cube is singleton and two-player.
    "other formats": {
        "5c-set-mechanic-commander",
        "alt-commander",
        "commander-matters",
        "commander-set-booster-cards",
        "face-commander",
        "multiplayer",
        "name-matters",
        "pair-commander",
        "synergy-commander",
        "weaker-in-singleton-formats",
    },
}

DENIED_PATTERNS: dict[str, list[str]] = {
    "names and wording": [r"^alliteration"],
    "colors": [
        rf"^({COLORS})-effect$",
        rf"^(hate|synergy)-({COLORS})$",
        rf"^(synergy|tutor-land)-({BASIC_TYPES})$",
    ],
    "tribes": [rf"^typal-(?!({GENERIC_TYPAL})$)"],
    "errata and printings": [r"^deprecated-", r"^type-errata", r"^type-addition-", r"-storyline-in-cards$"],
    "design and flavor": [
        r"^cycle-",
        r"^unique-",
        r"^french-vanilla",
        r"-with-set-(s-)?mechanic$",
        r"^hate-set-mechanic$",
    ],
    "novelty sets": [r"^un-", r"^dnd(-|$)"],
    "other formats": [r"^(pwdeck|planeswalker-deck)-"],
}

_EXACT = {tag: group for group, tags in DENIED_TAGS.items() for tag in tags}
_PATTERNS = [(re.compile(pattern), group) for group, patterns in DENIED_PATTERNS.items() for pattern in patterns]


def denied_group(tag: str) -> str | None:
    """The group a denied tag belongs to, or None for a tag archetypes use."""
    if tag in _EXACT:
        return _EXACT[tag]
    return next((group for pattern, group in _PATTERNS if pattern.search(tag)), None)


def is_denied(tag: str) -> bool:
    return denied_group(tag) is not None
