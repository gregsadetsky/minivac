# real minivac 601 measurements (2026-08-17)

fill in as measured. sim's current assumptions are in [brackets] — they are unverified guesses until checked here.

## tools

- multimeter (DC volts, ohms, mA)
- tape measure / ruler
- phone (photos, video for motor timing, audio for relay click)
- optional but great: variable bench power supply (for relay pickup/dropout)

## safety / technique

- ohms ONLY with power off and the component disconnected from everything else
- current = meter in series, start on the highest mA range
- incandescent bulbs: cold ohms is NOT operating ohms (hot is typically 5–10x cold). the sim needs the HOT value: R = V_across_lit_bulb / I_through_it

## power supply  [sim: 12 V ideal source]

- [x] DC volts at +/− terminals, nothing connected: 13.3 V
- [x] DC volts with one light on: 13.15 V
- [x] DC volts with one relay energized: 12.88 V
- [ ] same terminals on AC range (ripple check): turn the meter dial to V~ (AC volts), measure the same +/− terminals. near 0 V = smooth DC, several volts = unfiltered rectified supply. not yet measured: ______ V
- [x] battery or wall adapter? what does the label on the supply say? wall adaptar

## lights (0–5)  [sim: 100 Ω, "on" above 10 mA]

- [x] cold resistance, one bulb, isolated: 14 Ω
- [x] wire one light directly across supply with meter in series (mA): I = 100 mA
- [x] volts across the lit bulb at the same time: V = 13.11 V  → hot R = V/I = 13.11/0.100 = 131 Ω (computed from the two measurements above)
- [x] dimmest visibly-on point (optional): put 1, then 2 lights in series — which still glow? 2 still glow ok, 3 are weak
- [ ] bulb type if readable on glass/base (e.g. #47, #53): OMNI-GLOW 1090A34

## relay coils (1–6)  [sim: coil 400 Ω, pickup 20 mA, indicator lamp 100 Ω in series with coil]

- [x] coil resistance, power off, across the coil terminals: 55 Ω
- [x] IMPORTANT modeling question: is the indicator lamp really in series with the coil?
      power off, measure ohms from relay + terminal to − terminal. coil-only value or coil+lamp?
      does the lamp ever light when the coil isn't energized (or vice versa)? ______

- the relay bulb itself is 15 ohms like regular bulbs
- the relay coil activates between point E and F. when those are energized, the coil activates
- the relay bulb is points C E. when those are energized, the light activates
- ipso facto, when energizing C F, you get coil + light. yes, they are in series. total resistance C F is 67 ohms.

- [x] current through coil circuit when energized normally (meter in series): 200 mA
- [x] pickup: with bench supply, slowly raise V until relay clicks in: V = ______, I = ______ mA

- i have no bench but with one light in series it consistently works, with 2 it doesn't always work

- [ ] dropout: lower V until relay releases: V = ______, I = ______ mA

## motor  [sim: 200 Ω, R1/R2 100 Ω each, 187.5 ms/step, 16 steps/rev]

- [ ] resistance across motor terminals, power off (rotate dial, note if it varies): ______ Ω
- [ ] running current: ______ mA
- [ ] step timing: video a full revolution, note time for 16 steps: ______ s → ______ ms/step
- [ ] are there physical resistors in the motor circuit (visible from behind)? values if marked: ______

## wire / patch cords  [sim: 0.1 Ω]

- [ ] one patch cord end-to-end: ______ Ω

- couldn't measure so leave as is

## physical dimensions (for ui placement)

the single most useful thing: one straight-on photo of the full panel with a ruler/tape lying flat on it — i can derive every relative position from that. plus these key numbers:

- [x] overall panel: 24inch x 13 5.6/16inch
- [x] left section width (lights/relays/switches) vs right section width (motor dial): 16 14/16inch vs 6 4.5/16 inch
- [x] column pitch (center-to-center distance between vertical channels 1→2): 2 10/16inch
- [x] jack hole diameter and spacing within a group (e.g. G-H-J centers): 2/16inch / from one hole to another center to center 4/16 (two holes of X for example)
- [x] motor dial diameter: the arrow length is 1 8/16inch from tip to opposite side
- [x] light lens diameter: 0.5inch
- [x] relay window size (if visible): relay is 12/16inch on the white part on the right, total relay width is 1 11/16inch by 1 2/16inch
- [x] straight-on photo taken: /Users/g/Desktop/ARTS/minivac/ui-repo/real-minivac-with-measuring-tape.heic

## relay sound recording

- quiet room, phone mic 10–20 cm from a relay
- record ~10 clean clicks: both pull-in AND release (they sound different — we may want both files)
- also a rapid buzz if you can make a self-interrupting circuit (nice-to-have)
- keep the raw file (wav/m4a, no processing) — drop it anywhere in the repo (e.g. `_recordings/`) and it'll get trimmed/normalized/converted to replace `public/relay-click.mp3`

--- COULD NOT RECORD IN SILENT ROOM WILL DO LATER
