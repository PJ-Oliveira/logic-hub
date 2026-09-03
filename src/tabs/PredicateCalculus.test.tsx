import { vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PredicateCalculus } from './PredicateCalculus';

describe('PredicateCalculus Component', () => {
  it('applies rules interactively', () => {
    vi.useFakeTimers();
    render(<PredicateCalculus lang="en" />);
    
    fireEvent.click(screen.getByText('Verify Formula'));
    fireEvent.click(screen.getByText('Yes'));
    
    fireEvent.click(screen.getByText('Start Expansion'));
    
    expect(screen.getByText(/Should we use a completely NEW constant or can we REUSE an existing one?/)).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Can REUSE / ANY'));
    
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    
    fireEvent.click(screen.getByText(/Play All/i));
    expect(screen.getByText('Calculus Completed!')).toBeInTheDocument();
    
    vi.useRealTimers();
  });

  it('handles invalid syntax (sad path)', () => {
    render(<PredicateCalculus lang="en" />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'P(x) -> Q(x)' } }); // Invalid (missing quantifiers)
    
    fireEvent.click(screen.getByText('Verify Formula'));
    
    fireEvent.click(screen.getByText('No'));
    
    expect(screen.getByText('Correct! The formula has syntax errors.')).toBeInTheDocument();
  });
});
