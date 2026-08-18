As found by @tmcintos, the single-input flip-flop circuit described in Book IV on pages 68-69 seems to oscillate in the simulator, and not work:

https://minivac.greg.technology/simulator/#wires=5%2B%2F5H%206G%2F6F%205H%2F6H%205C%2F6C%205G%2F5F%206C%2F6-%206H%2F6Y%206X%2F5L%205K%2F6F%205N%2F6E%206Z%2F6L%206K%2F5E%206N%2F5F%206G%2F6A%206B%2F6-

It might be a simulator issue (we'd need a real device to test it/see how it actually behaves!) - for the time being, adding it here until we can know for sure.

Related discussion: https://github.com/gregsadetsky/minivac/issues/7

update 2026-08-17: real-device measurements (see REAL-DEVICE-MEASUREMENTS.md) ruled out
component values as the cause — the circuit behaves identically (stuck after cycle 1,
oscillation alert while pressed) under the old guessed values, the measured values, and
measured values + relay hysteresis. still unexplained; needs wiring on the real device.

---

## elevator circuit vs measured relay pickup (2026-08-17)

with measured values (13.3V supply, 55Ω coil, real bulb i-v curve, pickup bracketed
80-119mA by coils-in-series tests on the device), the three-floor elevator circuit
cannot work: it drives relay 4 through an already-warm indicator lamp at ~77mA steady,
below pickup. the 5 elevator tests fail against the measured model, and the model
predicts the circuit would also fail on a real Minivac. needs device verification
(the relay stage can be checked without the motor: wire it, press a call button,
listen for relay 4) — then either the circuit gets redesigned (drive coils E-F
directly, lamp separately) or we learn the model is missing something.
