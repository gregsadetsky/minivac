/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import SlideSwitch from './SlideSwitch';

describe('SlideSwitch', () => {
  it('should toggle state when clicked', () => {
    const onChange = vi.fn();
    const { container } = render(<SlideSwitch onChange={onChange} />);
    const switchElement = container.firstChild as HTMLElement;

    fireEvent.pointerDown(switchElement);
    expect(onChange).toHaveBeenCalledWith(true);

    // Click again to toggle back
    fireEvent.pointerDown(switchElement);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('should work with touch events through pointer API', () => {
    const onChange = vi.fn();
    const { container } = render(<SlideSwitch onChange={onChange} />);
    const switchElement = container.firstChild as HTMLElement;

    fireEvent.pointerDown(switchElement, { pointerType: 'touch' });
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('should respect controlled state', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <SlideSwitch isRight={false} onChange={onChange} />
    );
    const switchElement = container.firstChild as HTMLElement;

    fireEvent.pointerDown(switchElement);
    expect(onChange).toHaveBeenCalledWith(true);

    // State should still be controlled from outside
    rerender(<SlideSwitch isRight={true} onChange={onChange} />);

    fireEvent.pointerDown(switchElement);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('should use internal state when not controlled', () => {
    const { container } = render(<SlideSwitch />);
    const switchElement = container.firstChild as HTMLElement;

    // Should work without onChange callback
    fireEvent.pointerDown(switchElement);
    // No error should occur
  });
});
