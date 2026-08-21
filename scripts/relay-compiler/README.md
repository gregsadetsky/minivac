# gate netlist -> relay backend

a working answer to "why not just port an FPGA tetris to this?".
`relay-compile.mjs` compiles a gate netlist to Minivac notation; the two
`cmp-*.mjs` scripts compile designs that already exist HAND-WIRED in this
repo and compare relays, wires, matrix size and correctness.

    npx vite-node scripts/relay-compiler/cmp-headtohead.mjs   # adder + shift register
    npx vite-node scripts/relay-compiler/cmp-decoder.mjs      # the control-logic case

results and what they mean: `_notes/compiled-relays.md`. short version —
datapath compiles to within ~1.2-2.1x of hand, control logic to 5-8x,
and tetris is nearly all control logic.
