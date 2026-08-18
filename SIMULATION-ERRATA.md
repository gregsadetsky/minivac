As found by @tmcintos, the single-input flip-flop circuit described in Book IV on pages 68-69 seems to oscillate in the simulator, and not work:

https://minivac.greg.technology/simulator/#wires=5%2B%2F5H%206G%2F6F%205H%2F6H%205C%2F6C%205G%2F5F%206C%2F6-%206H%2F6Y%206X%2F5L%205K%2F6F%205N%2F6E%206Z%2F6L%206K%2F5E%206N%2F5F%206G%2F6A%206B%2F6-

It might be a simulator issue (we'd need a real device to test it/see how it actually behaves!) - for the time being, adding it here until we can know for sure.

Related discussion: https://github.com/gregsadetsky/minivac/issues/7

update 2026-08-17: real-device measurements (see REAL-DEVICE-MEASUREMENTS.md) ruled out
component values as the cause — the circuit behaves identically (stuck after cycle 1,
oscillation alert while pressed) under the old guessed values, the measured values, and
measured values + relay hysteresis. still unexplained; needs wiring on the real device.

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
