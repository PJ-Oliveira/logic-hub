import { vi } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { AristotelianSquare } from './AristotelianSquare';

describe('AristotelianSquare Component', () => {
  it('propagates truth values interactively', () => {
    vi.useFakeTimers();
    render(<AristotelianSquare lang="en" />);
    
    // Set A to True
    const nodes = screen.getAllByText('Set TRUE');
    fireEvent.click(nodes[0]); // A node
    
    // Inference asks for O
    expect(screen.getByText(/If A is True, what is the truth value of its Contradictories \(O\)\?/i)).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('False (F)'));
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    // Next Inference asks for E
    expect(screen.getByText(/If A is True, what is the truth value of its Contraries \(E\)\?/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('False (F)'));
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    // Next Inference asks for I
    expect(screen.getByText(/If A is True, what is the truth value of its Subalternation \(I\)\?/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('True (V)'));
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(screen.getByText('Completed!')).toBeInTheDocument();
    
    vi.useRealTimers();
  });
});
