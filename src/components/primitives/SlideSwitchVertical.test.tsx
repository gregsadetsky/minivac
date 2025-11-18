/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import SlideSwitchVertical from './SlideSwitchVertical';

describe('SlideSwitchVertical', () => {
  it('should toggle state when clicked', () => {
    const onChange = vi.fn();
    const { container } = render(<SlideSwitchVertical onChange={onChange} />);
    const switchElement = container.firstChild as HTMLElement;

    fireEvent.pointerDown(switchElement);
    expect(onChange).toHaveBeenCalledWith(true);

    // Click again to toggle back
    fireEvent.pointerDown(switchElement);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('should work with touch events through pointer API', () => {
    const onChange = vi.fn();
    const { container } = render(<SlideSwitchVertical onChange={onChange} />);
    const switchElement = container.firstChild as HTMLElement;

    fireEvent.pointerDown(switchElement, { pointerType: 'touch' });
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('should respect controlled state', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <SlideSwitchVertical isBottom={false} onChange={onChange} />
    );
    const switchElement = container.firstChild as HTMLElement;

    fireEvent.pointerDown(switchElement);
    expect(onChange).toHaveBeenCalledWith(true);

    // State should still be controlled from outside
    rerender(<SlideSwitchVertical isBottom={true} onChange={onChange} />);

    fireEvent.pointerDown(switchElement);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('should not toggle when disabled', () => {
    const onChange = vi.fn();
    const { container } = render(
      <SlideSwitchVertical disabled={true} onChange={onChange} />
    );
    const switchElement = container.firstChild as HTMLElement;

    fireEvent.pointerDown(switchElement);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should not respond to touch when disabled', () => {
    const onChange = vi.fn();
    const { container } = render(
      <SlideSwitchVertical disabled={true} onChange={onChange} />
    );
    const switchElement = container.firstChild as HTMLElement;

    fireEvent.pointerDown(switchElement, { pointerType: 'touch' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should use internal state when not controlled', () => {
    const { container } = render(<SlideSwitchVertical />);
    const switchElement = container.firstChild as HTMLElement;

    // Should work without onChange callback
    fireEvent.pointerDown(switchElement);
    // No error should occur
  });
});
