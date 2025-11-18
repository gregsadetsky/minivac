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
});
