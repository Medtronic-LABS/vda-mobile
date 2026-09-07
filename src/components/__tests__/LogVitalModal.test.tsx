/**
 * VDA Mobile — LogVitalModal Component Unit Tests
 *
 * Validates:
 * - Modal visibility toggling
 * - Self-reported Blood Sugar observation creation (LOINC 1558-6 / 1521-4)
 * - Self-reported Blood Pressure observation creation (LOINC 85354-9)
 * - Close button behavior
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LogVitalModal } from '../LogVitalModal';

describe('VDA Mobile — LogVitalModal', () => {
  it('should return null when isOpen is false', () => {
    const { container } = render(
      <LogVitalModal
        isOpen={false}
        onClose={vi.fn()}
        onSaveVital={vi.fn()}
        lang="en"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render modal when isOpen is true', () => {
    render(
      <LogVitalModal
        isOpen={true}
        onClose={vi.fn()}
        onSaveVital={vi.fn()}
        lang="en"
      />
    );
    expect(screen.getByText(/Log New Reading/i)).toBeInTheDocument();
  });

  it('should create and submit a fasting blood glucose observation', () => {
    const mockSave = vi.fn();
    render(
      <LogVitalModal
        isOpen={true}
        onClose={vi.fn()}
        onSaveVital={mockSave}
        lang="en"
      />
    );

    // Enter glucose value
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '115' } });

    // Save
    const saveBtn = screen.getByText(/Measurement Recorded/i);
    fireEvent.click(saveBtn);

    expect(mockSave).toHaveBeenCalledTimes(1);
    const savedObs = mockSave.mock.calls[0][0];
    expect(savedObs.category).toBe('laboratory');
    expect(savedObs.code).toContain('1558-6');
    expect(savedObs.value).toBe(115);
    expect(savedObs.unit).toBe('mg/dL');
    expect(savedObs.sourceFacility).toContain('Self-reported');
  });

  it('should switch to Blood Pressure mode and submit BP observation', () => {
    const mockSave = vi.fn();
    render(
      <LogVitalModal
        isOpen={true}
        onClose={vi.fn()}
        onSaveVital={mockSave}
        lang="en"
      />
    );

    // Switch tab to Blood Pressure
    const bpTab = screen.getByText(/Log Blood Pressure/i);
    fireEvent.click(bpTab);

    // Save
    const saveBtn = screen.getByText(/Measurement Recorded/i);
    fireEvent.click(saveBtn);

    expect(mockSave).toHaveBeenCalledTimes(1);
    const savedObs = mockSave.mock.calls[0][0];
    expect(savedObs.category).toBe('vital-signs');
    expect(savedObs.code).toContain('85354-9');
    expect(savedObs.unit).toContain('mmHg');
  });

  it('should invoke onClose when close icon button is clicked', () => {
    const mockClose = vi.fn();
    const { container } = render(
      <LogVitalModal
        isOpen={true}
        onClose={mockClose}
        onSaveVital={vi.fn()}
        lang="en"
      />
    );

    const closeBtn = container.querySelector('button .lucide-x')?.closest('button');
    expect(closeBtn).toBeDefined();
    fireEvent.click(closeBtn!);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
