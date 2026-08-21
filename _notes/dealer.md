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
