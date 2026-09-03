import { vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SingularTerms } from './SingularTerms';

describe('SingularTerms Component', () => {
  it('translates interactively', () => {
    vi.useFakeTimers();
    render(<SingularTerms lang="en" />);
    
    fireEvent.click(screen.getByText('Analyze Step-by-Step'));
    
    expect(screen.getByText(/is "existence" treated as a Predicate or a Quantifier/i)).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Quantifier'));
    
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    
    fireEvent.click(screen.getByText(/Play All/i));
    expect(screen.getByText('Formalization Completed!')).toBeInTheDocument();
    
    vi.useRealTimers();
  });
});
