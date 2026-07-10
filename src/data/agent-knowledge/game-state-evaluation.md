# Game State Evaluation — Reading the Board
_Use this to assess who is actually winning and what the position demands. Generic heuristics tell you what to do; this tells you what's true about the game state first._

---

## The Three Types of Advantage

A Lorcana game state is defined by three resources. A player can be ahead in one and behind in the others — the combination determines the correct strategy.

### 1. Lore Advantage
Who is closer to 20 lore?
- **Significant lead:** 5+ lore ahead
- **Slight lead:** 2–4 lore ahead
- **Even:** 0–1 lore difference
- **Behind:** Same definitions in reverse

Lore advantage is the most visible but NOT always the most important. A player at 15 lore with an empty board and no cards in hand is losing to a player at 8 lore with a full board and 4 cards in hand.

### 2. Board Advantage
Who controls the board?

Evaluate by:
- **Character count:** How many ready characters does each player have?
- **Character quality:** What is the average lore value? Are there Evasive, Ward, or Bodyguard characters?
- **Threats vs. answers:** Which characters are applying pressure and which are providing protection?

Board advantage directly determines how many lore each player can generate next turn. A player with 4 characters and no opponent blockers may quest for 6–8 lore in a single turn.

### 3. Card Advantage (Hand + Resources)
Who has more options?

Evaluate by:
- **Hand size:** How many cards does each player hold?
- **Ink available:** How much ink can each player spend this turn?
- **Quality:** Are the cards in hand immediately relevant or dead?

Card advantage is the most important resource in the long game. A player with 6 cards in hand can answer almost anything; a player topdecking has no flexibility.

---

## Reading a Game State — The 5 Questions

When evaluating any board state, answer these in order:

**Q1: Who wins if nothing changes?**
Simulate 3 turns of "no interactions." If both players just quest every turn and play characters, who reaches 20 first? This establishes the baseline — if you're winning the "do nothing" simulation, you play passively. If you're losing it, you must act.

**Q2: What is the fastest my opponent can win?**
Count their ready characters, their lore values, cards in hand that could affect lore (draw, bounce threats, etc.). Can they reach 20 in 1 turn? 2 turns? 3 turns? This sets your urgency level.

**Q3: What is my most threatening play this turn?**
Identify the single action that most advances your win condition OR most disrupts theirs. This is the candidate for your best play.

**Q4: What does my opponent WANT me to do?**
If your "obvious" play walks into a known counter (overextending into Be Prepared, questing into a character they can challenge profitably), find the alternative.

**Q5: What am I leaving on the table?**
After deciding your play, check: is there a character I could challenge that would meaningfully change the game state? A card in hand I'm forgetting? An ink I'm not spending?

---

## Board State Archetypes and What They Demand

### "I'm ahead on lore, ahead on board"
**Position:** You are winning. Don't get clever.
**Correct play:** Quest everything that can safely quest. Only challenge if an opponent character would close the lore gap by 3+ on their next turn. Don't develop new characters unless they quest immediately — the game should be ending.
**Mistake to avoid:** Slowing down to "lock up the win." The win is already there. Collect it.

### "I'm ahead on lore, behind on board"
**Position:** Dangerous. You look ahead but you're not safe.
**Correct play:** Prioritize stabilizing the board over advancing lore. Deploy Bodyguard characters. Use removal on the characters threatening your questers. Once the board is stabilized, resume questing.
**Mistake to avoid:** Continuing to quest aggressively while the opponent's growing board threatens to swing the lore race. A turn spent stabilizing now saves 3 turns of catching up later.

### "I'm behind on lore, ahead on board"
**Position:** The comeback position. Common for control decks.
**Correct play:** Leverage board advantage to establish safe questing. Deploy more characters. Challenge opponent's questers. Within 2–3 turns, your board should be generating more lore than theirs.
**Mistake to avoid:** Failing to convert board advantage into lore. Having a better board and not questing is the most common control mistake.

### "I'm behind on lore, behind on board"
**Position:** You are losing. A swing is required.
**Correct play:** Find the highest-impact play available — a board wipe, a bounce of their best character, an Evasive character that quests for free. Normal incremental play will not work. Take a calculated risk.
**Mistake to avoid:** Playing normally while losing. Small, safe plays lose the game from this position. Commit to a swing.

### "Even on lore, even on board"
**Position:** The grind game. Card advantage determines the winner.
**Correct play:** Draw spells take priority. Efficient trades (remove their character cheaply). Do not overextend. The player who runs out of cards first loses.
**Mistake to avoid:** Developing too many characters into a potential board wipe, or spending answers on small threats when the real threat is card parity.

---

## Threat Assessment — What to Prioritize

When multiple threats exist, prioritize in this order:

**Priority 1: Win conditions**
Any character or card that could end the game in 1–2 turns. Examples: a character that will quest for 5 lore, a Be Prepared that will clear your board, an Evasive character questing freely. Answer these first regardless of "efficiency."

**Priority 2: Lore generators**
Characters questing for 2+ lore per turn. These compound — every turn they survive is a meaningful lore swing.

**Priority 3: Card advantage engines**
Characters or items generating extra cards (Genie, Enchanted Rose, etc.). These extend the opponent's resources indefinitely. They're not immediately threatening but win long games.

**Priority 4: Board presence**
Characters that don't quest but block your threats. Bodyguards fall here — they're annoying but not winning the game themselves.

**Priority 5: Incidental threats**
1-lore questers, small support characters. Only address these if you have resources left over after handling priorities 1–4.

---

## Tempo — The Hidden Resource

Tempo is the value of acting before your opponent. A play that gains tempo advances your position while setting back theirs.

**High-tempo plays:**
- Challenging an opponent character on the same turn you deploy a new one
- Playing a removal spell on the opponent's turn (if applicable)
- Shift (playing a character for 2 less ink than normal — banking 2 tempo)
- Songs sung for free by a character (getting the card effect without spending ink)

**Low-tempo plays:**
- Developing a character that doesn't quest or interact this turn
- Using removal on a character that posed no immediate threat
- Drawing cards when you already have a full hand
- Inking a card when you had a play available

**When tempo matters most:**
Tempo is most valuable in turns 3–6, when the game is being decided. In the late game (turn 8+), card quality and lore totals matter more than tempo.

**The tempo trap:**
Don't sacrifice long-game position for short-term tempo. Using all your resources to gain tempo on turn 4 then having nothing on turn 5 is net negative. Tempo plays should advance a plan, not just feel good.

---

## Identifying a "Correct" Game State vs. a "Fallen Behind" State

One of the most important coaching insights: some deficits are expected and recoverable; others indicate a mistake was made.

### Expected deficits (part of the plan):
- **Ramp decks** at 8 lore when opponent is at 13, with 7 ink available → on track; big threat deploys this turn
- **Control decks** behind on lore in turns 1–5 → normal; their plan kicks in at turns 6–7
- **Aggro decks** with a smaller board than control opponent → fine if they're ahead on lore

### Deficits that indicate a mistake:
- **Aggro decks** below 10 lore by turn 6 → they've been outpaced; something went wrong with removal or questing
- **Control decks** behind on lore AND cards in turns 7+ → both resources are gone; no path back
- **Midrange decks** with empty hands by turn 5 → over-developed the board without drawing; resources exhausted

When reviewing gameplay and a player is in an unexpected deficit, trace back to where the divergence happened — usually 2–3 turns before the position became clearly bad.

---

## Quick State Evaluation Cheat Sheet

```
Ahead lore + ahead board   → Quest everything. End the game.
Ahead lore + behind board  → Stabilize board first. Then quest.
Behind lore + ahead board  → Convert board to lore. Challenge their questers.
Behind lore + behind board → Find a swing play. Normal play loses.
Even lore + even board     → Prioritize cards. Draw, then develop efficiently.

Opponent wins in 1 turn    → All-in disruption or win attempt.
Opponent wins in 2 turns   → One answer play required; normal development resumes.
Opponent wins in 3+ turns  → Execute your game plan. Don't panic.
```
