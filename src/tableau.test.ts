import { describe, it, expect } from 'vitest';
import {
  parseFormula,
  buildTableau,
  astToString,
  evaluateAST,
  getVariables,
  getSubformulas,
  ASTNode,
  TableauNode,
} from './tableau';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function allLeavesClosed(node: TableauNode): boolean {
  if (node.children.length === 0) return node.closed;
  return node.children.every(allLeavesClosed);
}

function allLeavesOpen(node: TableauNode): boolean {
  if (node.children.length === 0) return node.open;
  return node.children.every(allLeavesOpen);
}

function openLeaves(node: TableauNode): TableauNode[] {
  if (node.children.length === 0) return node.open ? [node] : [];
  return node.children.flatMap(openLeaves);
}

// ─── Parser ───────────────────────────────────────────────────────────────────

describe('parseFormula', () => {
  it('parses a bare variable', () => {
    const ast = parseFormula('P');
    expect(ast?.type).toBe('VAR');
    expect(ast?.name).toBe('P');
  });

  it('parses negation', () => {
    const ast = parseFormula('~P');
    expect(ast?.type).toBe('NOT');
    expect(ast?.left?.name).toBe('P');
  });

  it('parses chained negations', () => {
    const ast = parseFormula('~~P');
    expect(ast?.type).toBe('NOT');
    expect(ast?.left?.type).toBe('NOT');
    expect(ast?.left?.left?.name).toBe('P');
  });

  it('parses AND with correct precedence over OR', () => {
    const ast = parseFormula('A & B | C');
    expect(ast?.type).toBe('OR');
    expect(ast?.left?.type).toBe('AND');
  });

  it('allows parentheses to override precedence', () => {
    const ast = parseFormula('A & (B | C)');
    expect(ast?.type).toBe('AND');
    expect(ast?.right?.type).toBe('OR');
  });

  it('parses IMPLIES as right-associative', () => {
    const ast = parseFormula('A -> B -> C');
    expect(ast?.type).toBe('IMPLIES');
    expect(ast?.right?.type).toBe('IMPLIES');
  });

  it('accepts ! as an alias for ~', () => {
    const ast = parseFormula('!P');
    expect(ast?.type).toBe('NOT');
  });

  it('returns null for empty/invalid input', () => {
    expect(parseFormula('')).toBeNull();
    expect(parseFormula('&&&')).toBeNull();
    expect(parseFormula('(A')).toBeNull();
  });

  it('returns null when trailing tokens remain', () => {
    // "(A)B" → parses (A) then has trailing token B
    expect(parseFormula('(A)B')).toBeNull();
  });
});

// ─── astToString ──────────────────────────────────────────────────────────────

describe('astToString', () => {
  it('round-trips a complex formula', () => {
    const src = '~((A & B) -> C)';
    const ast = parseFormula(src)!;
    expect(astToString(ast)).toBe(src);
  });

  it('wraps AND / OR / IMPLIES in parentheses', () => {
    const and = parseFormula('A & B')!;
    expect(astToString(and)).toBe('(A & B)');

    const or = parseFormula('A | B')!;
    expect(astToString(or)).toBe('(A | B)');

    const imp = parseFormula('A -> B')!;
    expect(astToString(imp)).toBe('(A -> B)');
  });

  it('prefixes NOT with ~', () => {
    const not = parseFormula('~A')!;
    expect(astToString(not)).toBe('~A');
  });
});

// ─── evaluateAST ──────────────────────────────────────────────────────────────

describe('evaluateAST', () => {
  it('evaluates VAR', () => {
    const ast = parseFormula('P')!;
    expect(evaluateAST(ast, { P: true })).toBe(true);
    expect(evaluateAST(ast, { P: false })).toBe(false);
    // Missing variable defaults to false
    expect(evaluateAST(ast, {})).toBe(false);
  });

  it('evaluates NOT', () => {
    const ast = parseFormula('~P')!;
    expect(evaluateAST(ast, { P: true })).toBe(false);
    expect(evaluateAST(ast, { P: false })).toBe(true);
  });

  it('evaluates AND', () => {
    const ast = parseFormula('A & B')!;
    expect(evaluateAST(ast, { A: true, B: true })).toBe(true);
    expect(evaluateAST(ast, { A: true, B: false })).toBe(false);
    expect(evaluateAST(ast, { A: false, B: true })).toBe(false);
    expect(evaluateAST(ast, { A: false, B: false })).toBe(false);
  });

  it('evaluates OR', () => {
    const ast = parseFormula('A | B')!;
    expect(evaluateAST(ast, { A: false, B: false })).toBe(false);
    expect(evaluateAST(ast, { A: true, B: false })).toBe(true);
    expect(evaluateAST(ast, { A: false, B: true })).toBe(true);
  });

  it('evaluates IMPLIES (material conditional)', () => {
    const ast = parseFormula('A -> B')!;
    expect(evaluateAST(ast, { A: true, B: true })).toBe(true);
    expect(evaluateAST(ast, { A: true, B: false })).toBe(false);
    expect(evaluateAST(ast, { A: false, B: true })).toBe(true);
    expect(evaluateAST(ast, { A: false, B: false })).toBe(true);
  });
});

// ─── getVariables ─────────────────────────────────────────────────────────────

describe('getVariables', () => {
  it('returns sorted, deduplicated variable names', () => {
    const ast = parseFormula('B & A & B')!;
    expect(getVariables(ast)).toEqual(['A', 'B']);
  });

  it('handles single variable', () => {
    const ast = parseFormula('Z')!;
    expect(getVariables(ast)).toEqual(['Z']);
  });
});

// ─── getSubformulas ───────────────────────────────────────────────────────────

describe('getSubformulas', () => {
  it('excludes bare variables but includes compound sub-expressions', () => {
    const ast = parseFormula('A & (B -> A)')!;
    const subs = getSubformulas(ast).map(astToString);

    // Variables not included (they are the base "columns")
    expect(subs).not.toContain('A');
    expect(subs).not.toContain('B');

    // Compound sub-expressions are included
    expect(subs).toContain('(B -> A)');
    expect(subs).toContain('(A & (B -> A))');
  });

  it('deduplicates repeated sub-expressions', () => {
    const ast = parseFormula('A & A')!;
    const subs = getSubformulas(ast).map(astToString);
    const andCount = subs.filter(s => s === '(A & A)').length;
    expect(andCount).toBe(1);
  });

  it('builds in post-order (smallest first)', () => {
    const ast = parseFormula('(A & B) | C')!;
    const subs = getSubformulas(ast).map(astToString);
    const andIdx = subs.indexOf('(A & B)');
    const orIdx = subs.indexOf('((A & B) | C)');
    expect(andIdx).toBeLessThan(orIdx);
  });
});

// ─── buildTableau ─────────────────────────────────────────────────────────────

describe('buildTableau', () => {
  it('closes all branches for a contradiction (A & ~A)', () => {
    const ast = parseFormula('A & ~A')!;
    const { root } = buildTableau(ast);
    expect(allLeavesClosed(root)).toBe(true);
  });

  it('leaves all branches open for a tautology (A | ~A)', () => {
    const ast = parseFormula('A | ~A')!;
    const { root } = buildTableau(ast);
    // Both branches open: {A} and {~A}
    const leaves = openLeaves(root);
    expect(leaves.length).toBe(2);
  });

  it('finds the correct model for a simple contingency (A | B)', () => {
    const ast = parseFormula('A | B')!;
    const { root } = buildTableau(ast);
    expect(root.closed).toBe(false);
    const leaves = openLeaves(root);
    expect(leaves.length).toBe(2);
    expect(leaves[0].open).toBe(true);
    expect(leaves[1].open).toBe(true);
  });

  it('assigns step numbers in monotonically increasing order', () => {
    const ast = parseFormula('~(A -> B)')!;
    const { root, maxSteps } = buildTableau(ast);
    expect(root.step).toBe(0);
    expect(root.children[0].step).toBeGreaterThan(0);
    expect(maxSteps).toBeGreaterThan(1);
  });

  it('processes NOT-AND (De Morgan branching)', () => {
    const ast = parseFormula('~(A & B)')!;
    const { root } = buildTableau(ast);
    // ~(A & B) branches into ~A | ~B
    expect(root.children.length).toBe(2);
  });

  it('processes NOT-OR (De Morgan non-branching)', () => {
    const ast = parseFormula('~(A | B)')!;
    const { root } = buildTableau(ast);
    // ~(A | B) → single child with ~A and ~B
    expect(root.children.length).toBe(1);
    expect(root.children[0].formulas.length).toBe(2);
  });

  it('processes NOT-NOT (double negation elimination)', () => {
    const ast = parseFormula('~~A')!;
    const { root } = buildTableau(ast);
    // ~~A → single child with A
    expect(root.children.length).toBe(1);
    expect(root.children[0].formulas[0].type).toBe('VAR');
  });

  it('processes NOT-IMPLIES', () => {
    const ast = parseFormula('~(A -> B)')!;
    const { root } = buildTableau(ast);
    // ~(A -> B) → single child with A and ~B
    expect(root.children.length).toBe(1);
    const childFormulas = root.children[0].formulas.map(astToString);
    expect(childFormulas).toContain('A');
    expect(childFormulas).toContain('~B');
  });

  it('reports correct models on open leaves', () => {
    const ast = parseFormula('A & B')!;
    const { root } = buildTableau(ast);
    const leaves = openLeaves(root);
    expect(leaves.length).toBeGreaterThan(0);
    expect(leaves[0].models).toContain('A');
    expect(leaves[0].models).toContain('B');
  });
});
