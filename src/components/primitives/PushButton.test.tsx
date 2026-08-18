/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import PushButton from './PushButton';

describe('PushButton', () => {
  describe('pointer events (mouse, touch, pen)', () => {
    it('should call onPress and onRelease on pointer down/up', () => {
      const onPress = vi.fn();
      const onRelease = vi.fn();

      const { container } = render(
        <PushButton onPress={onPress} onRelease={onRelease} />
      );

      const button = container.firstChild as HTMLElement;

      fireEvent.pointerDown(button);
      expect(onPress).toHaveBeenCalledTimes(1);

      fireEvent.pointerUp(button);
      expect(onRelease).toHaveBeenCalledTimes(1);
    });

    it('should release button when pointer leaves while pressed', () => {
      const onPress = vi.fn();
      const onRelease = vi.fn();

      const { container } = render(
        <PushButton onPress={onPress} onRelease={onRelease} />
      );

      const button = container.firstChild as HTMLElement;

      fireEvent.pointerDown(button);
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(onRelease).toHaveBeenCalledTimes(0);

      fireEvent.pointerLeave(button);
      expect(onRelease).toHaveBeenCalledTimes(1);
    });

    it('should release button when pointer is cancelled', () => {
      const onPress = vi.fn();
      const onRelease = vi.fn();

      const { container } = render(
        <PushButton onPress={onPress} onRelease={onRelease} />
      );

      const button = container.firstChild as HTMLElement;

      fireEvent.pointerDown(button);
      expect(onPress).toHaveBeenCalledTimes(1);

      fireEvent.pointerCancel(button);
      expect(onRelease).toHaveBeenCalledTimes(1);
    });

    it('should not double-release on pointer up after leave already released', () => {
      const onPress = vi.fn();
      const onRelease = vi.fn();

      const { container } = render(
        <PushButton onPress={onPress} onRelease={onRelease} />
      );
      const button = container.firstChild as HTMLElement;

      fireEvent.pointerDown(button);
      fireEvent.pointerLeave(button); // releases
      fireEvent.pointerUp(button);    // must not release again
      expect(onRelease).toHaveBeenCalledTimes(1);
    });

    it('should work with touch events through pointer API', () => {
      // This test verifies that touch events work through the pointer event API
      // Modern browsers map touch events to pointer events automatically
      const onPress = vi.fn();
      const onRelease = vi.fn();

      const { container } = render(
        <PushButton onPress={onPress} onRelease={onRelease} />
      );

      const button = container.firstChild as HTMLElement;

      // Simulate touch by using pointerDown with pointerType: 'touch'
      fireEvent.pointerDown(button, { pointerType: 'touch' });
      expect(onPress).toHaveBeenCalledTimes(1);

      fireEvent.pointerUp(button, { pointerType: 'touch' });
      expect(onRelease).toHaveBeenCalledTimes(1);
    });
  });

  describe('shift-click latch', () => {
    it('should latch on shift-click: press fires, release does not fire on pointer up', () => {
      const onPress = vi.fn();
      const onRelease = vi.fn();

      const { container } = render(
        <PushButton onPress={onPress} onRelease={onRelease} />
      );
      const button = container.firstChild as HTMLElement;

      fireEvent.pointerDown(button, { shiftKey: true });
      expect(onPress).toHaveBeenCalledTimes(1);

      fireEvent.pointerUp(button);
      expect(onRelease).toHaveBeenCalledTimes(0);
    });

    it('should keep a latched button pressed through pointer leave and cancel', () => {
      const onPress = vi.fn();
      const onRelease = vi.fn();

      const { container } = render(
        <PushButton onPress={onPress} onRelease={onRelease} />
      );
      const button = container.firstChild as HTMLElement;

      fireEvent.pointerDown(button, { shiftKey: true });
      fireEvent.pointerUp(button);
      fireEvent.pointerLeave(button);
      fireEvent.pointerCancel(button);
      expect(onRelease).toHaveBeenCalledTimes(0);
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('should release a latched button on the next plain click, exactly once', () => {
      const onPress = vi.fn();
      const onRelease = vi.fn();

      const { container } = render(
        <PushButton onPress={onPress} onRelease={onRelease} />
      );
      const button = container.firstChild as HTMLElement;

      fireEvent.pointerDown(button, { shiftKey: true });
      fireEvent.pointerUp(button);

      // unlatching click: releases on pointer down, no extra events after
      fireEvent.pointerDown(button);
      expect(onRelease).toHaveBeenCalledTimes(1);
      expect(onPress).toHaveBeenCalledTimes(1); // no new press

      fireEvent.pointerUp(button);
      expect(onRelease).toHaveBeenCalledTimes(1); // no double release
    });

    it('should release a latched button on a second shift-click too (toggle)', () => {
      const onPress = vi.fn();
      const onRelease = vi.fn();

      const { container } = render(
        <PushButton onPress={onPress} onRelease={onRelease} />
      );
      const button = container.firstChild as HTMLElement;

      fireEvent.pointerDown(button, { shiftKey: true });
      fireEvent.pointerUp(button);

      fireEvent.pointerDown(button, { shiftKey: true });
      fireEvent.pointerUp(button);
      expect(onRelease).toHaveBeenCalledTimes(1);
      expect(onPress).toHaveBeenCalledTimes(1); // did not re-latch
    });

    it('should resume normal momentary operation after unlatching', () => {
      const onPress = vi.fn();
      const onRelease = vi.fn();

      const { container } = render(
        <PushButton onPress={onPress} onRelease={onRelease} />
      );
      const button = container.firstChild as HTMLElement;

      // latch, unlatch
      fireEvent.pointerDown(button, { shiftKey: true });
      fireEvent.pointerUp(button);
      fireEvent.pointerDown(button);
      fireEvent.pointerUp(button);

      // normal click cycle works again
      fireEvent.pointerDown(button);
      expect(onPress).toHaveBeenCalledTimes(2);
      fireEvent.pointerUp(button);
      expect(onRelease).toHaveBeenCalledTimes(2);
    });

    it('should render the cap visually pressed while latched (uncontrolled)', () => {
      const { container } = render(<PushButton />);
      const button = container.firstChild as HTMLElement;
      const cap = button.children[1] as HTMLElement;

      expect(cap.style.top).toBe('3px'); // released position

      fireEvent.pointerDown(button, { shiftKey: true });
      fireEvent.pointerUp(button);
      expect(cap.style.top).toBe('5px'); // stays pressed after pointer up

      fireEvent.pointerDown(button);
      expect(cap.style.top).toBe('3px'); // unlatched back to released
    });
  });
});
