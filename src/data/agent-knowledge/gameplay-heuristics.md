# Lorcana Gameplay Heuristics
_Reference for the agent when providing gameplay advice, reviewing plays, or suggesting optimized lines_

These are the fundamental strategic principles of Disney Lorcana. When analyzing a game state, replay, or asking "what should I have done here," apply these in order.

---

## Core Priority Framework

In most game states, evaluate your options in this order:

1. **Can I win this turn?** (20 lore check) — If yes, prioritize questing over everything else.
2. **Can the opponent win next turn?** — If yes, prioritize disruption (challenges, bounce, removal) over questing.
3. **What maximizes my lore per turn while protecting my board?** — Default game plan.
4. **What maximizes my options next turn?** — Card draw, ink setting, tempo.

---

## The Quest vs. Challenge Decision

This is the most common decision in the game. General rules:

### Quest when:
- You are ahead on lore and the opponent can't challenge your questing character safely
- The character has Evasive (opponent can't challenge it at all)
- The opponent has no characters that could challenge this one profitably
- Gaining lore brings you closer to 20 and the opponent can't catch up this turn
- The character would die to a challenge anyway — better to gain 1 lore than nothing

### Challenge when:
- You can banish a character that would otherwise quest for 2+ lore next turn
- You can profitably trade (your character survives, opponent's is banished)
- You need to protect a key questing character by removing a threatening blocker
- The opponent's character has a dangerous triggered ability when it quests
- You can banish their only Bodyguard, opening up attacks on their questers

### The Lore Math Rule:
If questing gains you **X** lore and the challenged character quests for **Y** lore next turn, challenging is better if **Y ≥ X** and you can win the trade.

---

## Ink Management (The Inkwell)

### Setting Ink:
- You may set one card into your inkwell each turn (if it has the ink symbol)
- This is almost always correct on turns 1–4, especially if you don't have a play
- **Never** skip inking a card if you have no other play — tempo loss is severe
- Prioritize inking cards you have duplicates of before unique pieces

### What to Ink:
- Ink cards you have 3–4 copies of before 1–2 copies
- Ink expensive cards (6+ cost) early if you have cheaper replacements
- Ink cards that are dead in the current matchup (e.g., anti-aggro pieces in a control matchup)
- Keep at least 1 copy of every key card in hand if possible

### Ink Counting:
- Count your opponent's available ink each turn — this tells you what they can cast
- If opponent has 5 ink up and passes without playing, consider what they're holding (removal, bounce, board wipe)
- Don't overcommit to the board if opponent has 7 ink up and runs Amethyst (Be Prepared range)

---

## Card Advantage Principles

- **Hand size matters.** Going below 3 cards in hand is dangerous — you're one removal spell away from topdeck mode.
- Draw spells are usually correct on any turn you can't develop your board meaningfully.
- Don't play draw spells when ahead on board and behind on lore — play threats instead.
- Saving A Whole New World when opponent has fewer cards than you is a mistake — it benefits them more.

---

## Curve and Tempo

### The Ink Curve Rule:
- You should be spending most or all of your available ink every turn in the early game.
- Under-spending ink (e.g., having 4 ink and spending 2) is a tempo loss that compounds.
- Having a play at 1, 2, 3, 4, and 5 ink is "being on curve" — this usually wins games.

### Opening Hand Evaluation (Mulligan Guide):
Keep if you have:
- A play at 1 or 2 ink AND a play at 3 or 4 ink
- Both ink colors represented (if 2-color deck)
- At most 2 cards costing 5+ in a 7-card hand

Mulligan if:
- No play before turn 3
- All high-cost cards (4+ cost) with no low-curve
- Only one ink color in an opening 7
- More than 3 cards costing 5+ (too top-heavy)

### Shift Optimization:
- Always have the base character in hand before playing the Shift-able version
- Shift is almost always correct if you have the base — pays off immediately
- Don't hold a Shift character if you never draw the base — play it at full cost if game state demands it

---

## Board Management

### Protection Priority:
1. Characters that generate 3+ lore/turn (highest threat — protect or quest ASAP)
2. Characters that generate card advantage (Genie, Enchanted Rose activators)
3. Characters that enable key combos (Support chains, Shift targets)
4. Characters that block the opponent's win condition

### When to Trade vs. Race:
- **Race** (pure lore) when your deck is faster and opponent lacks removal
- **Trade** (challenge to banish) when opponent's board generates more lore per turn than yours
- **Control** (challenge + bounce) when opponent has a single must-answer threat

### Bodyguard Sequencing:
- Play Bodyguard characters BEFORE other characters on the same turn when possible
- Bodyguard characters must be challenged first — they protect your questers

### Ward Sequencing:
- Ward characters cannot be chosen by opponent's effects — play them as your main threat when opponent relies on targeted removal
- Ward does NOT protect against board wipes (Be Prepared hits everything regardless)

---

## Songs and Timing

- **Songs** cost ink like normal OR can be sung by a character of the song's cost or higher (for free, but that character is exhausted)
- Singing is almost always better than paying — only pay if you need the character ready to quest or challenge
- Save songs for turns where your characters can't quest profitably anyway (already exhausted)
- Don't sing a character that generates 3+ lore/turn — the lore loss usually outweighs the song's value

---

## Endgame / Race Decisions

When one player is at 15–19 lore:
- **Leading player:** Stop all non-essential development; quest everything that can safely quest; ignore opponent's board unless they can win this turn
- **Trailing player:** Go wide to try to challenge questers; look for board wipes; look for lore-drain effects (Ursula, etc.)
- A character with Evasive that quests is often unkillable at this stage — prioritize removing these first

### The 20-Lore Checklist (When You Can Win):
Before swinging for the win, verify:
- Count lore already accumulated
- Count lore each ready quester generates
- Ensure no opponent card can prevent it (Hypnotize, Break Time, etc.)
- If you can win, always win — don't delay

---

## Synergy-Aware Decision Making

_Read synergy-theory.md for the full framework. This section applies it to specific in-game decisions._

### Before ANY Action: Find Your Active Synergy

Before deciding to quest, challenge, or play a card, ask: **"What synergy type is my deck executing this turn?"**

- **Trigger chain turn:** Draw effects FIRST. Resolve all card draw before committing ink or declaring challenges. Every card you draw before acting is more information and potentially more triggers.
- **Cost reduction turn:** Have the enabler in play BEFORE attempting to deploy the reduced-cost threat. Shift requires the base card in play. Song requires a character of equal/greater cost ready.
- **Stat modification turn:** Buff BEFORE challenging. "+X strength when you pay 2 or less" must be calculated at challenge declaration time — play the cheap card THEN challenge with the newly-buffed character.
- **Resource generation turn:** Trigger all draw effects before spending any ink. The card you draw might be the play you make.
- **Condition creation turn:** Create the condition 1 turn BEFORE executing the payoff. Playing Sid into a full board is wasted because opponent gets optimal "choice." Clear 1–2 characters, THEN Sid.

### The Synergy Order of Operations

Every turn has a correct order. Violating it loses triggers and value:

1. **Draw** — Quest draw characters (Jesse, Woody), fire "on quest" triggers, sing draw songs
2. **Assess** — With maximum information, decide your play sequence
3. **Buff** — Play stat-modifying cards before combat (low-cost cards that trigger Babyhead, Jesse shrink effects)
4. **Combat** — Challenge now that buffs are in effect and you've reduced opponent's "choice" for Sid
5. **Deploy threats** — Play characters (Sid, Horseman, new threats) into the post-combat board state
6. **Flood** — Dump free/discounted characters AFTER main plays to maximize board presence
7. **Quest remaining characters** — Quest everything that's safe after combat and deployment
8. **Ink** — Set ink only after all actions are confirmed (avoid inking a card you end up needing)

### Identifying the Opponent's Core Loop Mid-Game

When reviewing "what went wrong" or giving advice mid-game:

1. Look at what the opponent has played at 4 copies — that's their key piece
2. Identify which synergy type is active (trigger chain? condition creation?)
3. Find their "condition card" — the one that everything else needs
4. Ask: "What would collapse their plan?" — THAT is the removal target, not the biggest card

### When to Break Your Own Synergy

Sometimes the correct play violates your own synergy for tempo or survival:

- **If opponent wins in 1 turn:** Forget your combo setup. Any defensive play is correct.
- **If the game state demands aggression:** A wide pressure deck in a position where they're behind on lore should abandon the "hold your free toys for the right moment" rule and dump everything NOW.
- **If you've been disrupted:** Your Jesse was bounced; your Babyhead is dead. Don't try to rebuild the same engine — pivot to whichever path (disruption or pressure) is available with your current hand.

---

## Common Mistakes to Flag

When reviewing gameplay or deck lists, flag these patterns:

1. **Not inking on turn 1** when no 1-cost play is available
2. **Questing into a guaranteed unfavorable challenge** — losing a 4-cost character to gain 1 lore is almost always wrong
3. **Holding draw spells** when the hand is already full (wasted card slot)
4. **Overextending into Be Prepared** when opponent has 7+ Amethyst ink
5. **Not setting up Shift** — playing the Shift version at full cost repeatedly
6. **Forgetting to challenge before questing** — order matters; exhausted characters can't be rearranged
7. **Playing high-cost characters into empty inkwells** — you need mana to respond to opponent's bounce/removal
8. **Singing with a 3-lore character** when paying 4 ink is fine — the math often favors not singing
9. **Playing Sid (or condition payoff) without setting up the condition** — Sid into a full board is wasted; Sid after clearing 2 characters is game-winning
10. **Not drawing first** — making ink and play decisions before resolving available draw effects
11. **Spending free/discounted cards too early** — free toys should be held for explosive post-combat or post-disruption dumps, not played on curve
12. **Buffing after challenging** — stat modifications must be in place at challenge declaration; reversing the order loses the buff
13. **Removing the wrong card** — targeting the largest card instead of the "condition card" that everything else needs (e.g., killing Elsa when Dale is the problem)
