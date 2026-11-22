from seedlib.sources import normalise_name

# The reference lists "Doma United" and "Doma United FC" as two names; they are one team.
SAME_TEAM = {"Doma United FC": "Doma United", "Inter Lagos FC": "Inter Lagos"}


def by_alias(catalogue):
    return {a: t for t in catalogue for a in t.aliases}


def test_every_reference_team_is_in_the_catalogue(catalogue, reference_config):
    aliases = by_alias(catalogue)
    for name in reference_config["team_coords"]:
        assert normalise_name(name) in aliases, name


def test_coordinates_match_the_reference(catalogue, reference_config):
    aliases = by_alias(catalogue)
    for name, (lat, lon) in reference_config["team_coords"].items():
        team = aliases[normalise_name(name)]
        assert (team.lat, team.lon) == (lat, lon), name


def test_every_reference_alias_resolves_to_the_same_team(catalogue, reference_alias_map):
    aliases = by_alias(catalogue)
    for alias, target in reference_alias_map.items():
        assert alias in aliases, alias
        assert aliases[alias].name == SAME_TEAM.get(target, target), alias


def test_doma_united_spellings_are_one_team(catalogue):
    aliases = by_alias(catalogue)
    names = {aliases[a].name for a in ("doma united", "doma united fc", "doma fc")}
    assert names == {"Doma United"}


def test_codes_and_slugs(catalogue):
    assert len({t.code for t in catalogue}) == len(catalogue)
    assert all(t.slug and t.slug == t.slug.lower() for t in catalogue)


def test_no_invented_details(catalogue):
    assert all(t.city is None and t.primary_colour is None for t in catalogue)
