from ccml.tag_denylist import denied_group, is_denied


def test_tribes_are_denied_but_generic_typal_stays():
    for tag in ("typal-goblin", "typal-zombie", "typal-some-new-tribe", "synergy-party", "werewolf-mechanic"):
        assert denied_group(tag) == "tribes", tag
    for tag in ("typal", "typal-creature", "noncreature-typal", "typal-choose", "typal-share", "changeling"):
        assert not is_denied(tag), tag


def test_colors_and_basic_land_types_are_denied():
    for tag in ("blue-effect", "hate-red", "synergy-white", "synergy-forest", "tutor-land-plains", "converge"):
        assert denied_group(tag) == "colors", tag


def test_names_wording_and_card_trivia_are_denied():
    assert denied_group("single-english-word-name") == "names and wording"
    assert denied_group("punny-name") == "names and wording"
    assert denied_group("alliteration-c") == "names and wording"
    assert denied_group("type-errata-viashino") == "errata and printings"
    assert denied_group("unique-type-line") == "design and flavor"
    assert denied_group("staple-with-set-s-mechanic") == "design and flavor"
    assert denied_group("dnd-monster") == "novelty sets"


def test_strategy_tags_are_kept():
    for tag in ("reanimate", "lifegain", "sacrifice-outlet", "synergy-artifact", "hate-graveyard", "unearth", "cycle"):
        assert not is_denied(tag), tag
