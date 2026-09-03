import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

describe('App Layout and Routing', () => {
  it('renders the sidebar and initial tab', () => {
    render(<App />);
    expect(screen.getByText('Logic Hub')).toBeInTheDocument();
  });

  it('switches tabs correctly', () => {
    render(<App />);
    
    const truthBtn = screen.getByRole('button', { name: /Truth Tables/i });
    fireEvent.click(truthBtn);
    expect(screen.getByText('The fundamental tool for evaluating propositional logic.', { exact: false })).toBeInTheDocument();

    const singularBtn = screen.getByRole('button', { name: /Singular Terms/i });
    fireEvent.click(singularBtn);
    expect(screen.getByText('Learn how to translate natural language', { exact: false })).toBeInTheDocument();

    const tableauBtn = screen.getByRole('button', { name: /Propositional Tableau/i });
    fireEvent.click(tableauBtn);
    expect(screen.getByText('Explore the tableau tree in a', { exact: false })).toBeInTheDocument();

    const folBtn = screen.getByRole('button', { name: /First-Order Logic/i });
    fireEvent.click(folBtn);
    expect(screen.getByText('Expand First-Order formulas over a finite domain step-by-step.', { exact: false })).toBeInTheDocument();

    const predBtn = screen.getByRole('button', { name: /Predicate Calculus/i });
    fireEvent.click(predBtn);
    expect(screen.getByText('Step-by-step application of Predicate Calculus rules', { exact: false })).toBeInTheDocument();

    const squareBtn = screen.getByRole('button', { name: /Aristotelian Square/i });
    fireEvent.click(squareBtn);
    expect(screen.getByText('Interactive diagram representing logical relationships.', { exact: false })).toBeInTheDocument();
  });
});
