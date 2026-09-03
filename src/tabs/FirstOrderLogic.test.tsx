import { vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FirstOrderLogic } from './FirstOrderLogic';

describe('FirstOrderLogic Component', () => {
  it('expands domain interactively', () => {
    vi.useFakeTimers();
    render(<FirstOrderLogic lang="en" />);
    
    fireEvent.click(screen.getByText('Verify Formula'));
    fireEvent.click(screen.getByText('Yes'));
    
    fireEvent.click(screen.getByText('Next: Quantifier Check'));
    fireEvent.click(screen.getByText('Universal (∀)'));
    
    fireEvent.click(screen.getByText('Next: Expansion Rule'));
    fireEvent.click(screen.getByText('AND (∧)'));
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    const playBtn = screen.getByText(/Play All/i);
    fireEvent.click(playBtn);
    
    expect(screen.getByText('Expansion Completed!')).toBeInTheDocument();
    
    vi.useRealTimers();
  });

  it('handles invalid syntax (sad path)', () => {
    render(<FirstOrderLogic lang="en" />);
    
    const input = screen.getAllByRole('textbox')[1];
    fireEvent.change(input, { target: { value: 'P(x) -> Q(x)' } }); // Invalid (missing quantifiers for this specific tool's mock parser)
    
    fireEvent.click(screen.getByText('Verify Formula'));
    
    fireEvent.click(screen.getByText('No'));
    
    expect(screen.getByText('Correct! The formula has syntax errors.')).toBeInTheDocument();
  });
});
