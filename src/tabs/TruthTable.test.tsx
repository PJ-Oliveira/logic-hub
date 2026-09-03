import { vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TruthTable } from './TruthTable';

describe('TruthTable Component', () => {
  it('generates a truth table interactively', () => {
    vi.useFakeTimers();
    render(<TruthTable lang="en" />);
    
    // WFF Check
    fireEvent.click(screen.getByText('Verify Formula'));
    fireEvent.click(screen.getByText('Yes'));
    
    // Row Count
    fireEvent.click(screen.getByText('Next: Row Count'));
    const rowInput = screen.getAllByRole('spinbutton')[0];
    fireEvent.change(rowInput, { target: { value: '4' } });
    fireEvent.click(screen.getByText('Check'));
    
    // Generate Table
    fireEvent.click(screen.getByText('Draw Table'));
    
    // Classification
    const tautologyBtn = screen.getByText('Tautology');
    fireEvent.click(tautologyBtn);
    
    expect(screen.getByText(/Incorrect! Analyze the final column carefully/i)).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Contingency'));
    expect(screen.getByText('Correct!')).toBeInTheDocument();
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(screen.getByText(/Logical Classification/i)).toBeInTheDocument();
    
    vi.useRealTimers();
  });

  it('handles invalid syntax (sad path)', () => {
    render(<TruthTable lang="en" />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'P & ->' } });
    
    fireEvent.click(screen.getByText('Verify Formula'));
    fireEvent.click(screen.getByText('No'));
    
    expect(screen.getByText('Correct! The formula has syntax errors.')).toBeInTheDocument();
  });
});
