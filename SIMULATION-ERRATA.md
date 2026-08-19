As found by @tmcintos, the single-input flip-flop circuit described in Book IV on pages 68-69 seems to oscillate in the simulator, and not work:

https://minivac.greg.technology/simulator/#wires=5%2B%2F5H%206G%2F6F%205H%2F6H%205C%2F6C%205G%2F5F%206C%2F6-%206H%2F6Y%206X%2F5L%205K%2F6F%205N%2F6E%206Z%2F6L%206K%2F5E%206N%2F5F%206G%2F6A%206B%2F6-

It might be a simulator issue (we'd need a real device to test it/see how it actually behaves!) - for the time being, adding it here until we can know for sure.

Related discussion: https://github.com/gregsadetsky/minivac/issues/7

update 2026-08-17: real-device measurements ruled out component values as the cause —
the circuit behaves identically (stuck after cycle 1, oscillation alert while pressed)
under the old guessed values, the measured values, and measured values + relay hysteresis.

## RESOLVED 2026-08-18 — verified on a real Minivac 601: THE SIMULATOR WAS RIGHT

wired on the real device in stages, behavior matched the simulator at every step, and at
the second button press RELAY 6 PHYSICALLY CHATTERS AND BUZZES — the circuit as printed
in Book IV does not toggle.

the mechanism (found via the simulator's iteration trace, confirmed by the device): the
wires 6G/6F and 6G/6A permanently tie relay 6's coil-out to light 6 (jacks are tie
points). at the second press, + reaches the coil's other end via 5N/6E. relay 6 on →
both coil ends at + → ~0mA → drops. but the instant it drops, current flows
+ → coil 6 → light 6 → − at ~71-77mA, which is above this relay's pickup → re-picks →
both ends + again → drops → buzz. whether a given unit buzzes or toggles cleanly depends
on that relay's individual pickup vs ~75mA — per-relay variance (which book VII's
per-relay bias-calibration chart, p8-9, shows the manufacturer knew about).

measured on the device: replacing the 5N/6E wire with a meter during the buzzing press
reads 172mA; the sim computes 158mA for the same point (79mA coil-through-light-6 repick
path + 79mA relay-6 indicator lamp) — 9% agreement, and reading at/above the relay-out
figure implies the armature spends essentially the whole buzz in the out phase.

refinement from further device testing: the real circuit DOES function as a flip-flop —
it toggles reliably, deterministically alternating nobuzz/buzz presses; every buzzing
(1→0) press ends with relay 6 out and light 6 off. presumably the chattering armature
never seats the latch contact, so releasing mid-buzz always lands "off".

sim divergence FIXED: chattering relays now resolve to de-energized (a buzzing armature
never seats its contacts), so the sim toggles exactly like the device — nobuzz/buzz
alternation, always landing "off" after a buzzing press — with the oscillation alert
kept as the buzz indicator. the sim shows the buzz as an alert + resolved state, not as
an animated/audible buzz (the quasi-static solver has no timescale for the chatter).
device-verified test: src/simulator/tests/book4-single-input-flipflop.test.ts

---

## elevator circuit vs measured relay pickup (2026-08-17) — RESOLVED by device test

the measured model briefly predicted the elevator circuit couldn't work (relay driven
through an already-warm bulb at ~77mA, vs ~90mA bench pickup / 3-coils-in-series
failing at ~80mA). tested on the real device: a coil behind a warm bulb DOES pick up
reliably (coil shorted via button, bulb hot, button released → relay clicks, contacts
verified by driving a light). so pickup measurements bracket ~80mA inconsistently —
possibly per-relay variance — and the sim threshold is set at 70mA, below the
warm-bulb case. elevator tests pass. the 3-coils-in-series edge case is knowingly
mispredicted (sim: works, device: doesn't).
