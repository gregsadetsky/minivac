# random piece dealing — design, 2026-08-21

today the operator picks the shape with UP before spawning. real tetris
DEALS one. this rung makes the machine choose.

## the honest constraint: relays have no randomness

nothing in a Minivac is random. what a relay machine CAN do is run a
counter fast compared to human reaction time and sample it on the
player's own press — the classic arcade trick, and genuinely
unpredictable in practice because the sample instant is human-timed.
so: a FREE-RUNNING RING clocked by something that moves constantly,
sampled at START.

## what clocks it

candidates, in order of preference:
1. THE TICK. the ring advances one step per game tick. sampled at
   spawn, the shape depends on how many ticks the player let pass —
   which is player-controlled but not player-tracked. cheap (no new
   clock) and deterministic for TESTS, which matters: a dealer whose
   sequence is reproducible from the tick count keeps the step-exact
   driver scenario possible.
2. the capacitor oscillator (3b-5) when AUTO is on — genuinely
   free-running, but silent when AUTO is off, so it cannot be the only
   source.
choose (1), optionally mixed with (2) later. determinism is a FEATURE
here: every existing receipt stays checkable.

## the shape ring already is the dealer

key realisation: there is already a 12-state one-hot ring holding the
current shape, and it already has a clock input (UPM) and a legality
network deciding whether the clock conducts. dealing = clocking that
same ring from the TICK instead of only from UP, while no piece is
falling.

so the whole rung is:
- a DEAL mirror: tick AND no-token (NOTOK, which the rotation rung
  already built and which is exactly "no piece is falling") -> pulse
  the shape ring's clock.
- that is it. between a lock and the next spawn the ring free-runs on
  ticks; at START the shape is whatever it landed on.
- the chooser still works: UP pre-spawn steps it deliberately.

## the catch to check on paper FIRST

- the transition network gates the ring clock on LEGALITY. pre-spawn
  every occupancy rail is dark, so all in-range transitions pass —
  EXCEPT the bounds: entering S at pos 0 has no branch. so a
  free-running ring parked at pos 0 would STALL at O (exactly what
  bit two of my own test scenarios today). the dealer must therefore
  either (a) re-home the register into range as it walks, or (b)
  accept stalling, which would bias the deal hard.
  -> this is THE design question for this rung. cheapest answer may be
  to deal only among shapes legal at the current column, and let the
  operator's own steering decide the rest.
- SHBOOT seeds state 0 at power-on and latches away on the first UP;
  a tick-clocked ring must not fight that.
- the ring clock rising during the LOCK sequence (LKS up, token still
  alive) must not deal — NOTOK covers this: the token is alive until
  the reset tick, so dealing resumes only once it dies.

## receipts plan

- suite: over N ticks with no piece, the shape ring visits several
  distinct states (not stuck); a spawn takes whatever is current; the
  chooser still overrides pre-spawn; nothing deals while a piece falls.
- driver: the step-exact scenario keeps working (determinism), and a
  hands-off auto game shows varied pieces.
- gates: fast file + check + driver (the user's amended gate).


## THE BOUNDS STALL, MEASURED 2026-08-21 — and why this rung is BLOCKED

walked the chooser from each column at 6 wide, counting how many of the
twelve states a free-running ring can reach:

    col 0: 4/12   (stalls at O — entering S needs column >= 1)
    col 1: 12/12
    col 2: 12/12
    col 3: 12/12
    col 4: 5/12   (stalls at S)
    col 5: 1/12   (stalls immediately — even 2wide needs column <= 4)

and a lock re-homes the register to COLUMN 0, so a tick-clocked dealer
would always deal from the worst column: four shapes out of twelve,
forever. the dealer cannot be built on top of that.

## the fix that works, and why it is NOT landed here

make the home column the middle of the window every shape can occupy —
derived from the geometry, `homeColumn(cols)` = 1 at four wide, 2 at
six, 4 at ten. it unblocks the ring completely (verified: from the new
home, all 12 states reachable with no steering) AND it spawns pieces
centrally, which is what tetris does anyway. two lines of wiring.

BUT the home column is baked into roughly thirty test scenarios — every
"drop at column 0" expectation, the seeded gameplay models, the driver's
step-exact script. changing it turns nearly the whole suite red at once,
and rewriting thirty scenarios to match NEW behaviour is precisely the
situation where a test gets "fixed" into agreeing with a bug. that is a
deliberate call for a human, not a thing to do unilaterally at 1am.

so this rung is BLOCKED on one decision: move the home column (a real
gameplay improvement, a big mechanical test rewrite, best done as its
own rung with fresh eyes) or give the dealer its own steering machinery
(more relays, no test churn). the measurement above is the evidence for
whoever decides.

the alternative worth noting: deal only among the shapes legal at the
current column. rejected — at the home column that is four shapes, and
a dealer that never deals an S is not a dealer.

## 2026-08-26 — the home column MOVED (center spawn landed), and what
## actually shipped as "dealing"

the blocker above is gone: homeColumn(cols) is real (1 at four wide, 2 at
six), POSRST re-homes there, BOOTL seeds there, the whole suite + driver
were rewritten to the center. so the tick-clocked ring is UNBLOCKED —
but designing it further surfaced a QUALITY problem worth recording:

- NOTOK is up only while no token is alive: the reset tick, the collapse
  ticks, and idle pre-spawn ticks. under auto-gravity the spawn follows
  the reset almost immediately, so a plain lock advances a tick-clocked
  ring by ~1-2 states, a clearing lock by 1 + 3*rows more. consecutive
  deals would be NEAR-ADJACENT ring states (1x1 then 2wide then 2tall...)
  — a strongly patterned deal, not a shuffle. the NES-class trick (free
  counter sampled on a human-timed event) needs the counter to run FAST
  relative to the sampling, and a ring that only steps between pieces
  is slow by construction.
- fixes all cost real machinery: a private fast counter + a "step the
  shape ring k times" transfer, or clocking deals from player input
  presses. neither is the two-relay rung the first sketch hoped for.
  design it with a clean-context review when it comes up.

WHAT SHIPPED INSTEAD (2026-08-26): the /tetris/ page deals like the
/relays/ page does — the OPERATOR'S DICE. after every lock (and at boot)
the page walks the shape ring toward a Math.random() target, one clamped
press per frame, every transition still allowed/refused by the contacts.
?deal=manual turns it off (the driver's step-exact scripts use that).
the machine semantics are untouched, so the reference-model differential
is unaffected: randomness lives exactly where a human operator would be.

## 2026-08-26, later — THE DICE DIE (user call, and the right one)

the user's verdict on what shipped above: Math.random choosing the
target with relay presses performing around it is "javascript tetris
with relays blinking" — the exact fake this project exists to not be.
correct. the operator-dice framing hid the one part that matters: WHO
CHOOSES. the presses were real; the choice was not the machine's, and
not a human's either.

### the honest split of roles

JS may supply CADENCE (the operator's hand: the gravity timer, crank
pulses, conveying keys to buttons). JS may never supply CHOICE (which
piece). the only entropy this machine has ever had access to is human
input timing — so the dealer must be built on that, the way 1960s
arcade hardware did it: a counter running fast relative to human
reaction, sampled by the player's own press.

### D1 — SHIPPED (page side): the free-running ring, sampled by your press

between pieces the page cranks UP continuously — no target, no random
call anywhere in the deal path — and the shape ring visibly spins
through all 21 states (clamp steps into each next state's fit range,
every transition allowed/refused by the contacts, as ever). the piece
you get is the state the contacts held when you pressed ↓/space/enter
(the serve key acts IMMEDIATELY during the spin — queueing it would
decouple the piece from the press instant, which is the whole point).

declared properties, not hidden:
- press instantly every time and you walk the selection cycle in order:
  the machine reflects exactly the entropy you feed it.
- a patient player can try to time a shape — a skill stop (pachislo).
  feature, documented.
- unattended (auto-gravity, nobody pressing): the 700ms timer takes the
  piece after AT LEAST ONE FULL REVOLUTION (never near-adjacent to the
  previous state — the quality problem recorded above). the sample then
  rides the drift between the timer grid and the spin's solve cadence:
  deterministic in principle, drifting in practice. the attract mode is
  a demo; the human mode is the game.
- the /relays/ viewer's "random" dropdown option is DELETED — its named
  state picker (deal me a T) is the honest open chooser.

### D2 — OPEN RUNG (relay side): the crank moves into the machine

the motor dial — the real Minivac 601's own randomizer (the 1961
manual's games use the motorized rotary for chance) — or the 3b-5
capacitor oscillator pulses the ring clock through a DEALING-WINDOW
relay: latched at the reset tick (the piece died), broken by START.
then JS is not even the hand. needs the clean-context review the note
above already called for: the window gating vs NOTOK, the oscillator's
flutter class (it must pulse the RING CLOCK, not the game tick — the
flutter lesson in CLAUDE.md), and whether motor cadence vs relay settle
time double-steps.
