- wheel animation spurts, PROFILED 2026-08-18: one elevator resimulate = 33ms, of which
  dc()=29.4ms, finalize=2.1ms, build=0.9ms — the matrix solve is 90% of the cost, in ONE
  relaxation iteration. inside cktsim's find_solution: (a) it refuses to converge on the
  first newton iteration, so even our purely-linear circuits pay >=2 load+LU cycles;
  (b) mat_solve is dense with per-call array allocation. DIAGNOSED AND FIXED
  2026-08-18 (briefly reverted, then re-applied): zero-initial-residual pathology —
  voltage-source-only circuits start at KCL residual exactly 0, so ~1e-13 float noise
  after the first exact newton step read as "divergence", the exact solution was
  undone, and 0.3V step-limiting burned ~12 extra iterations (14 instead of 2,
  ~3x slower). fix = "+res_check_abs" epsilon in find_solution's increase check in
  public/cktsimvsp_sn.js — documented inline there with the original line for easy
  revert. gated debug_newton trace hook also in the file for re-diagnosis.
  worker caveat discussed: relay reactions would lag the wheel by ~1 frame round-trip;
  mitigate by making the worker's motor angle authoritative
- capacitors in the UI: panel jacks + a resistor-placement UI + RAF loop calling
  stepTime(dt, substepped) when any cap is wired. small cap circuits solve fast enough
  for 60fps; big circuits + caps want the web worker first
- show reduced versions of minivac - just relay + button + light
- hold button for long time to lock, click again to unlock (mobile equivalent of shift-click latch, which is done)
- drag cables on mobile
- for elevator, grey out buttons 4-5-6?
- add "stickers" on top of buttons/wheel..?
- how to have small zoomed out version with 'fullscreen' version?
  - mobile fullscreen version rotated 90 degrees and button to-unfullscreen
- automate button pressing (for 3 bit counter)
  - how to pause this automation example?
- 3 bit counter: labels for lights 4/5/6? show binary table with the correct 4/5/6 lights in a row and highlight row of the current number?
- ability to turn the wheel manually - while its not turning only..?
- ability to close (while clicking/holding) a relay manually..?
- live documentation: show relevant manual page?
- bring in examples: tic tac toe... others from all books?
- bring in existing tests or just go through books again and re-create tests: very basic "do voltage work" (like test fundamental circuit simulation), test short circuit (+ to -) at analog simulation level, then test the same at minivac level: loading a url that connects positive to negative power rails
- test the toll circuit - it should still not work - write a test for it? test it? and then see it - does the relay "alarm" sound work in the emulated circuit?
- make manual interactive: "turn on" would be hyperlinked and actually turn power on...? "push button" would do it?
- have ability to have floating greg video for specific manual examples?
- rename manual examples (file name/structure + name..?) to include book number + experiment number
- direct links to full pdf manuals + including errata (host them yourself)
- ability to push one button and then keep it pushed to push another button (... how? if clicking+holding for 3s?)
- ability to add skeuo "stickers"/"labels" ie add something "on top" of buttons 1-2-3 in elevator example? and something on top of the wheel for the elevator levels?
- deal with sound not working if not click - if loading a circuit via url and the circuit starts, relays won't be clicking. show some fake dialog?
- have an about dialog, credit William McAllister, + recurse people that helped (most recent flip flop thread + rob)
- about: i want to buy minivac + interested in the capacity + 24 additional circuit extension..!
- have links/show ads from minivac era? maybe separate sub-about page?
- present/write narrative? why do i care? why is this interesting?
- ability to have mp3 related to relays or light? for morse example (short/long beep) and for musical examples using the relays? can example labels+sounds be something "on top" of the react app state and that can be easily cleared...? how do you clear that example? can you still change circuits when an example like that is loaded?
- ability to slow down or speed up the motor wheel..?
- retest automatic toll to see if it passes (with break before make?)
- when the power is turned off, any relays losing power should click off (if they were on)
- get a recording of the original minivac relay sound
- find out real speed of the minivac wheel (does the motor "rev up" or is it immediately at full speed?)
- to be able to create "micro panels" (for tutorial):
  - get `setIsPowerOn(!isBottom);` code out of the minivacpanel into higher end component
  - move cables and alerts out of minivacpanel as well into higher end (and could be passed down to minivacpanel?)

### no

- can you drag a cable from one emulated minivac window to another window....???
  - (at that point, would rather have multiple minivacs in the same window and the ability to zoom out and connect them all)
- connect "external" devices: 5 relays or lights interpreted as baudot code? ability to send over the wire? or to receive? over https? show "keyboard", when typing, 5 relays are set to that? or show 5 lights... as pixels? only relevant if multiple minivacs to create mini dislpay?
