import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProgressBar } from '../feedback/ProgressBar';

describe('ProgressBar', () => {
  it('renders with a percentage display', async () => {
    await act(async () => { render(<ProgressBar value={50} />); });
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('renders a progressbar role element', async () => {
    await act(async () => { render(<ProgressBar value={75} />); });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('sets aria-valuenow correctly', async () => {
    await act(async () => { render(<ProgressBar value={30} max={100} />); });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30');
  });

  it('sets aria-valuemax correctly', async () => {
    await act(async () => { render(<ProgressBar value={30} max={200} />); });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '200');
  });

  it('renders the label text', async () => {
    await act(async () => { render(<ProgressBar value={40} label="처리 중" />); });
    expect(screen.getByText('처리 중')).toBeInTheDocument();
  });

  it('renders step info when currentStep and totalSteps provided', async () => {
    await act(async () => { render(<ProgressBar value={60} currentStep={3} totalSteps={5} />); });
    expect(screen.getByText('3/5')).toBeInTheDocument();
  });

  it('clamps percentage to 100 when value exceeds max', async () => {
    await act(async () => { render(<ProgressBar value={150} max={100} />); });
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('clamps percentage to 0 when value is negative', async () => {
    await act(async () => { render(<ProgressBar value={-10} max={100} />); });
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('calculates percentage correctly with custom max', async () => {
    await act(async () => { render(<ProgressBar value={1} max={4} />); });
    expect(screen.getByText('25%')).toBeInTheDocument();
  });
});
