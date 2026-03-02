"""Team picker: brute-force balanced 6v6 splits."""

from itertools import combinations


def pick_teams(
    player_ids: list[int],
    ratings: dict[int, float],
    synergy: dict[tuple[int, int], float],
) -> dict:
    """
    Given 12 player IDs, their ratings, and pairwise synergy scores,
    find the most balanced 6v6 split.

    924 possible splits → brute-force all of them (sub-millisecond).
    """
    if len(player_ids) != 12:
        raise ValueError(f"Need exactly 12 players, got {len(player_ids)}")

    sorted_ids = sorted(player_ids)
    best_split = None
    best_score = float("inf")

    # Generate all C(12,6) = 924 ways to pick team A
    # Only consider splits where the first player is always on team A (avoid duplicates)
    first = sorted_ids[0]
    rest = sorted_ids[1:]

    for combo in combinations(rest, 5):
        team_a = [first] + list(combo)
        team_b = [p for p in sorted_ids if p not in team_a]

        # Team strength = sum of individual ratings
        strength_a = sum(ratings.get(p, 0.5) for p in team_a)
        strength_b = sum(ratings.get(p, 0.5) for p in team_b)

        # Team synergy = average pairwise synergy within team
        syn_a = _team_synergy(team_a, synergy)
        syn_b = _team_synergy(team_b, synergy)

        # Balance score (lower = more balanced)
        balance = 0.70 * abs(strength_a - strength_b) + 0.30 * abs(syn_a - syn_b)

        if balance < best_score:
            best_score = balance
            best_split = (team_a, team_b, strength_a, strength_b, syn_a, syn_b)

    team_a, team_b, str_a, str_b, syn_a, syn_b = best_split
    return {
        "team_a": team_a,
        "team_b": team_b,
        "team_a_strength": round(str_a, 4),
        "team_b_strength": round(str_b, 4),
        "team_a_synergy": round(syn_a, 4),
        "team_b_synergy": round(syn_b, 4),
        "balance_score": round(best_score, 6),
    }


def _team_synergy(team: list[int], synergy: dict[tuple[int, int], float]) -> float:
    """Average pairwise synergy for a team of 6."""
    total = 0.0
    count = 0
    for i, a in enumerate(team):
        for b in team[i + 1:]:
            key = (min(a, b), max(a, b))
            total += synergy.get(key, 0.5)
            count += 1
    return total / count if count > 0 else 0.5
