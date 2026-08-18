/**
 * @vitest-environment jsdom
 *
 * Power / short-circuit / relay-sound behavior of the full SimulatorCore:
 * - auto power-off when a short circuit appears (and the power switch locks)
 * - relay release sound on manual power-off (github issue #9)
 * - relay pull-in sound when power comes back on
 *
 * requestAnimationFrame is stubbed so the simulation loop advances only when
 * the test flushes frames explicitly. Howler is mocked; the on/off click
 * instances are identified by their src.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import cktsimSource from '../../public/cktsimvsp_sn.js?raw';
import SimulatorCore from './SimulatorCore';
import type { MinivacSimulator } from '../simulator/minivac-simulator';

// in jsdom the circuit engine isn't loaded via script tag — evaluate its source here.
// the script assigns `cktsim = (function(){...})()` without var, so in non-strict
// mode the result lands on globalThis; mirror it onto window for the browser loader.
beforeAll(() => {
  const i18n = {
    ckt_alert1: 'Warning!!! Circuit has a voltage source loop or shorted source.',
    ckt_alert2: 'Warning!!! Simulator might produce meaningless results with illegal circuits.',
  };
  new Function('i18n', 'alert', cktsimSource)(i18n, () => {});
  (window as unknown as { cktsim: unknown }).cktsim =
    (globalThis as unknown as { cktsim: unknown }).cktsim;
});

const howls = vi.hoisted(() => {
  return { instances: [] as Array<{ src: string[]; play: ReturnType<typeof vi.fn> }> };
});

vi.mock('howler', () => ({
  Howl: class {
    src: string[];
    play = vi.fn();
    mute = vi.fn();
    volume = vi.fn();
    fade = vi.fn();
    unload = vi.fn();
    constructor(opts: { src: string[] }) {
      this.src = opts.src;
      howls.instances.push(this as unknown as (typeof howls.instances)[number]);
    }
  },
}));

function sound(name: string) {
  const found = howls.instances.filter(h => h.src[0].includes(name));
  expect(found.length).toBeGreaterThan(0);
  return found[found.length - 1]; // most recent instance
}

// rAF stub: the sim loop only advances when the test flushes frames
let rafQueue: FrameRequestCallback[] = [];

function flushFrames(n: number) {
  for (let i = 0; i < n; i++) {
    const cbs = rafQueue;
    rafQueue = [];
    act(() => {
      cbs.forEach(cb => cb(performance.now()));
    });
  }
}

async function setup(circuit: string[]) {
  let sim: MinivacSimulator | null = null;
  render(
    <SimulatorCore
      initialCircuit={circuit}
      onSimulatorReady={s => {
        sim = s;
      }}
    />
  );
  // wait until the simulator built from the loaded cables is ready
  // (the first ready callback fires for the initial empty circuit)
  await waitFor(() => {
    expect(sim).not.toBeNull();
    expect(rafQueue.length).toBeGreaterThan(0);
  });
  return () => sim!;
}

function powerSwitch() {
  const section = screen.getByTestId('power-section');
  return section.querySelector('[class*="cursor-"]') as HTMLElement;
}

function isPowerOn() {
  return screen.getByTestId('power-section').getAttribute('data-power-on') === 'true';
}

beforeEach(() => {
  howls.instances.length = 0;
  rafQueue = [];
  window.requestAnimationFrame = (cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return rafQueue.length;
  };
  window.cancelAnimationFrame = () => {};
});

afterEach(() => {
  cleanup();
});

describe('SimulatorCore power and sound behavior', () => {
  it('auto powers off on a short circuit and locks the power switch', async () => {
    await setup(['1+/1-']);
    await waitFor(() => screen.getByText(/SHORT CIRCUIT/));

    expect(isPowerOn()).toBe(true);
    flushFrames(2); // loop notices the alert and powers off
    expect(isPowerOn()).toBe(false);

    // switch is disabled while the short persists — clicking must not re-enable
    fireEvent.pointerDown(powerSwitch());
    expect(isPowerOn()).toBe(false);
  });

  it('plays the relay release sound on manual power-off when a relay was energized (issue #9)', async () => {
    const getSim = await setup(['1+/1E', '1F/1-']);
    await waitFor(() => expect(getSim().getState().relays[0]).toBe(true));

    flushFrames(2); // loop records the energized relay
    expect(sound('relay-on').play).not.toHaveBeenCalled(); // no click on initial load
    expect(sound('relay-off').play).not.toHaveBeenCalled();

    fireEvent.pointerDown(powerSwitch()); // power off
    expect(isPowerOn()).toBe(false);
    expect(sound('relay-off').play).toHaveBeenCalledTimes(1);
    expect(sound('relay-on').play).not.toHaveBeenCalled();
  });

  it('does not play the release sound on power-off when no relay was energized', async () => {
    await setup(['1+/1A', '1B/1-']); // just a light, no relay
    flushFrames(2);

    fireEvent.pointerDown(powerSwitch());
    expect(isPowerOn()).toBe(false);
    expect(sound('relay-off').play).not.toHaveBeenCalled();
  });

  it('plays the pull-in sound when power comes back on and the relay re-energizes', async () => {
    const getSim = await setup(['1+/1E', '1F/1-']);
    await waitFor(() => expect(getSim().getState().relays[0]).toBe(true));
    flushFrames(2);

    fireEvent.pointerDown(powerSwitch()); // off
    expect(sound('relay-off').play).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(powerSwitch()); // back on — recreates the simulator
    expect(isPowerOn()).toBe(true);
    flushFrames(2); // loop compares against the reset (all-off) previous states
    expect(sound('relay-on').play).toHaveBeenCalledTimes(1);
  });

  it('plays the release sound when a short circuit auto powers off an energized relay', async () => {
    const getSim = await setup(['1+/1E', '1F/1-', '2+/2X', '2Y/2-']);
    await waitFor(() => expect(getSim().getState().relays[0]).toBe(true));
    flushFrames(2); // record relay 1 energized, no short yet
    expect(isPowerOn()).toBe(true);
    expect(sound('relay-off').play).not.toHaveBeenCalled();

    // pressing button 2 closes the short (2X normally-open to 2Y arm)
    const button2 = screen.getByTestId('push-button-2').firstChild as HTMLElement;
    fireEvent.pointerDown(button2);
    await waitFor(() => screen.getByText(/SHORT CIRCUIT/));

    flushFrames(2); // loop sees the alert, powers off
    expect(isPowerOn()).toBe(false);
    expect(sound('relay-off').play).toHaveBeenCalledTimes(1);
  });
});
