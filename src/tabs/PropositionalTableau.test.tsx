import { vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PropositionalTableau } from './PropositionalTableau';

describe('PropositionalTableau Component', () => {
  it('generates tableau interactively step by step', () => {
    render(<PropositionalTableau lang="en" />);
    
    // 1. INPUT PHASE
    const input = screen.getByPlaceholderText('(A & B) | (C -> D)');
    fireEvent.change(input, { target: { value: 'A & B' } });
    
    const verifyBtn = screen.getByText('Verify Formula');
    fireEvent.click(verifyBtn);
    
    // 2. WFF CHECK PHASE
    expect(screen.getByText('Is this formula Well-Formed (WFF)?')).toBeInTheDocument();
    const yesBtn = screen.getByText('Yes');
    fireEvent.click(yesBtn);
    
    expect(screen.getByText('Correct! The formula syntax is perfectly valid.')).toBeInTheDocument();
    
    const nextBtn1 = screen.getByText('Next: Main Connective');
    fireEvent.click(nextBtn1);
    
    // 3. MAIN CONNECTIVE PHASE
    expect(screen.getByText('What is the main connective of this formula?')).toBeInTheDocument();
    const andBtn = screen.getByText('AND (∧)');
    fireEvent.click(andBtn);
    
    expect(screen.getByText('Correct! That is the main connective.')).toBeInTheDocument();
    const startTableauBtn = screen.getByText('Start Tableau');
    fireEvent.click(startTableauBtn);
    
    // 4. TREE BUILD PHASE
    expect(screen.getByText('Step 1 / 2')).toBeInTheDocument();
    expect(screen.getByText('(A ∧ B)')).toBeInTheDocument();
    
    // Play all
    const playBtn = screen.getByText('Play All');
    fireEvent.click(playBtn);
    
    expect(screen.getByText(/Completed! All open branches/)).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('handles invalid formula interactively', () => {
    render(<PropositionalTableau lang="en" />);
    
    const input = screen.getByPlaceholderText('(A & B) | (C -> D)');
    fireEvent.change(input, { target: { value: 'A &' } }); // Invalid
    
    const verifyBtn = screen.getByText('Verify Formula');
    fireEvent.click(verifyBtn);
    
    const noBtn = screen.getByText('No');
    fireEvent.click(noBtn);
    
    expect(screen.getByText('Correct! The formula has syntax errors (e.g., missing parentheses or operators).')).toBeInTheDocument();
  });

  it('handles incorrect interactive answers', () => {
    render(<PropositionalTableau lang="en" />);
    
    const input = screen.getByPlaceholderText('(A & B) | (C -> D)');
    fireEvent.change(input, { target: { value: 'A & B' } });
    
    const verifyBtn = screen.getByText('Verify Formula');
    fireEvent.click(verifyBtn);
    
    const noBtn = screen.getByText('No');
    fireEvent.click(noBtn);
    expect(screen.getByText('Incorrect. The formula syntax is valid!')).toBeInTheDocument();
    
    const yesBtn = screen.getByText('Yes');
    fireEvent.click(yesBtn);
    
    const nextBtn1 = screen.getByText('Next: Main Connective');
    fireEvent.click(nextBtn1);
    
    const orBtn = screen.getByText('OR (∨)');
    fireEvent.click(orBtn);
    expect(screen.getByText('Incorrect. Try again.')).toBeInTheDocument();
    
    const andBtn = screen.getByText('AND (∧)');
    fireEvent.click(andBtn);
    
    const startTableauBtn = screen.getByText('Start Tableau');
    fireEvent.click(startTableauBtn);
    
    const branchingBtn = screen.getByText('Branching (Beta - 2 branches)');
    fireEvent.click(branchingBtn);
    expect(screen.getByText('Incorrect! Remember: AND/NOT-OR are linear. OR/IMPLIES are branching.')).toBeInTheDocument();
  });

  it('completes tableau explicitly', () => {
    vi.useFakeTimers();
    render(<PropositionalTableau lang="en" />);
    const input = screen.getByPlaceholderText('(A & B) | (C -> D)');
    fireEvent.change(input, { target: { value: 'A & B' } });
    fireEvent.click(screen.getByText('Verify Formula'));
    fireEvent.click(screen.getByText('Yes'));
    fireEvent.click(screen.getByText('Next: Main Connective'));
    fireEvent.click(screen.getByText('AND (∧)'));
    fireEvent.click(screen.getByText('Start Tableau'));
    
    const linearBtn = screen.getByText('Linear (Alpha - 1 branch)');
    fireEvent.click(linearBtn);
    
    expect(screen.getByText('Correct!')).toBeInTheDocument();
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(screen.getByText(/Completed! All open branches/)).toBeInTheDocument();
    
    vi.useRealTimers();
  });
});
