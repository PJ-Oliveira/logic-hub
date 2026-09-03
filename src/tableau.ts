export type NodeType = 'VAR' | 'NOT' | 'AND' | 'OR' | 'IMPLIES';

export interface ASTNode {
  type: NodeType;
  name?: string;
  left?: ASTNode;
  right?: ASTNode;
}

export function parseFormula(input: string): ASTNode | null {
  let pos = 0;
  const tokens = input.replace(/\s+/g, '').match(/->|[&|~!()]|[a-zA-Z]+/g);
  if (!tokens) return null;

  function parseImplies(): ASTNode {
    let node = parseOr();
    while (pos < tokens!.length && tokens![pos] === '->') {
      pos++;
      const right = parseImplies();
      node = { type: 'IMPLIES', left: node, right };
    }
    return node;
  }

  function parseOr(): ASTNode {
    let node = parseAnd();
    while (pos < tokens!.length && tokens![pos] === '|') {
      pos++;
      node = { type: 'OR', left: node, right: parseAnd() };
    }
    return node;
  }

  function parseAnd(): ASTNode {
    let node = parseNot();
    while (pos < tokens!.length && tokens![pos] === '&') {
      pos++;
      node = { type: 'AND', left: node, right: parseNot() };
    }
    return node;
  }

  function parseNot(): ASTNode {
    if (pos < tokens!.length && (tokens![pos] === '~' || tokens![pos] === '!')) {
      pos++;
      return { type: 'NOT', left: parseNot() };
    }
    return parsePrimary();
  }

  function parsePrimary(): ASTNode {
    if (pos >= tokens!.length) throw new Error("Unexpected end of formula");
    const token = tokens![pos];
    if (token === '(') {
      pos++;
      const node = parseImplies();
      if (tokens![pos] !== ')') throw new Error("Expected )");
      pos++;
      return node;
    }
    if (/^[a-zA-Z]+$/.test(token)) {
      pos++;
      return { type: 'VAR', name: token };
    }
    throw new Error(`Unexpected token ${token}`);
  }

  try {
    const ast = parseImplies();
    if (pos < tokens.length) return null;
    return ast;
  } catch (e) {
    return null;
  }
}

export function astToString(node: ASTNode): string {
  if (node.type === 'VAR') return node.name!;
  if (node.type === 'NOT') return `~${astToString(node.left!)}`;
  if (node.type === 'AND') return `(${astToString(node.left!)} & ${astToString(node.right!)})`;
  if (node.type === 'OR') return `(${astToString(node.left!)} | ${astToString(node.right!)})`;
  if (node.type === 'IMPLIES') return `(${astToString(node.left!)} -> ${astToString(node.right!)})`;
  return '';
}

let idCounter = 0;
let stepCounter = 0;

export interface TableauNode {
  id: string;
  formulas: ASTNode[];
  children: TableauNode[];
  closed: boolean;
  open: boolean;
  models?: string[];
  step: number;
}

export function buildTableau(formula: ASTNode): { root: TableauNode, maxSteps: number } {
  idCounter = 0;
  stepCounter = 0;
  
  const root: TableauNode = {
    id: `node-${idCounter++}`,
    formulas: [formula],
    children: [],
    closed: false,
    open: false,
    step: stepCounter++
  };

  function expand(node: TableauNode, branchFormulas: ASTNode[]) {
    const unexpanded = branchFormulas.filter(f => !isLiteral(f));
    
    if (unexpanded.length === 0) {
      const literals = branchFormulas.map(astToString);
      const hasContradiction = branchFormulas.some(f => {
        if (f.type === 'VAR') return literals.includes(`~${f.name}`) || literals.includes(`!${f.name}`);
        if (f.type === 'NOT' && f.left?.type === 'VAR') return literals.includes(f.left.name!);
        return false;
      });
      
      if (hasContradiction) {
        node.closed = true;
      } else {
        node.open = true;
        const posVars = branchFormulas.filter(f => f.type === 'VAR').map(f => f.name!);
        const negVars = branchFormulas.filter(f => f.type === 'NOT' && f.left?.type === 'VAR').map(f => `~${f.left!.name}`);
        node.models = Array.from(new Set([...posVars, ...negVars]));
      }
      return;
    }

    let targetIdx = unexpanded.findIndex(isNonBranching);
    if (targetIdx === -1) targetIdx = 0; 
    
    const target = unexpanded[targetIdx];
    const rest = branchFormulas.filter(f => f !== target);

    const ruleResult = applyRule(target);
    
    const currentStep = stepCounter++;

    if (ruleResult.length === 1) {
      const child: TableauNode = {
        id: `node-${idCounter++}`,
        formulas: ruleResult[0],
        children: [],
        closed: false,
        open: false,
        step: currentStep
      };
      node.children.push(child);
      expand(child, [...rest, ...ruleResult[0]]);
    } else {
      for (const branch of ruleResult) {
        const child: TableauNode = {
          id: `node-${idCounter++}`,
          formulas: branch,
          children: [],
          closed: false,
          open: false,
          step: currentStep
        };
        node.children.push(child);
        expand(child, [...rest, ...branch]);
      }
    }
  }

  expand(root, root.formulas);
  return { root, maxSteps: stepCounter };
}

function isLiteral(f: ASTNode): boolean {
  return f.type === 'VAR' || (f.type === 'NOT' && f.left?.type === 'VAR');
}

function isNonBranching(f: ASTNode): boolean {
  if (f.type === 'AND') return true;
  if (f.type === 'NOT' && f.left?.type === 'OR') return true;
  if (f.type === 'NOT' && f.left?.type === 'IMPLIES') return true;
  if (f.type === 'NOT' && f.left?.type === 'NOT') return true;
  return false;
}

function applyRule(f: ASTNode): ASTNode[][] {
  if (f.type === 'AND') return [[f.left!, f.right!]];
  if (f.type === 'OR') return [[f.left!], [f.right!]];
  if (f.type === 'IMPLIES') return [[{ type: 'NOT', left: f.left! }], [f.right!]];
  
  if (f.type === 'NOT') {
    const inner = f.left!;
    if (inner.type === 'NOT') return [[inner.left!]];
    if (inner.type === 'AND') return [[{ type: 'NOT', left: inner.left! }], [{ type: 'NOT', left: inner.right! }]];
    if (inner.type === 'OR') return [[{ type: 'NOT', left: inner.left! }, { type: 'NOT', left: inner.right! }]];
    if (inner.type === 'IMPLIES') return [[inner.left!, { type: 'NOT', left: inner.right! }]];
  }
  return [];
}

export function evaluateAST(node: ASTNode, assignment: Record<string, boolean>): boolean {
  if (node.type === 'VAR') return assignment[node.name!] || false;
  if (node.type === 'NOT') return !evaluateAST(node.left!, assignment);
  if (node.type === 'AND') return evaluateAST(node.left!, assignment) && evaluateAST(node.right!, assignment);
  if (node.type === 'OR') return evaluateAST(node.left!, assignment) || evaluateAST(node.right!, assignment);
  if (node.type === 'IMPLIES') return !evaluateAST(node.left!, assignment) || evaluateAST(node.right!, assignment);
  return false;
}

export function getVariables(node: ASTNode): string[] {
  const vars = new Set<string>();
  function traverse(n: ASTNode) {
    if (n.type === 'VAR') vars.add(n.name!);
    if (n.left) traverse(n.left);
    if (n.right) traverse(n.right);
  }
  traverse(node);
  return Array.from(vars).sort();
}

export function getSubformulas(node: ASTNode): ASTNode[] {
  const subs: ASTNode[] = [];
  function traverse(n: ASTNode) {
    if (n.type === 'VAR') return; // Vars are usually just the initial columns
    if (n.left) traverse(n.left);
    if (n.right) traverse(n.right);
    // Add self after children (post-order traversal, builds up from smallest)
    subs.push(n);
  }
  traverse(node);
  
  // Remove duplicates based on string representation
  const seen = new Set<string>();
  const uniqueSubs: ASTNode[] = [];
  for (const s of subs) {
    const str = astToString(s);
    if (!seen.has(str)) {
      seen.add(str);
      uniqueSubs.push(s);
    }
  }
  return uniqueSubs;
}

export function formatLogicString(str: string): string {
  return str
    .replace(/\bA([a-z])\b/g, '∀$1')
    .replace(/\bE([a-z])\b/g, '∃$1')
    .replace(/&/g, '∧')
    .replace(/\|/g, '∨')
    .replace(/->/g, '→')
    .replace(/~/g, '¬')
    .replace(/!/g, '¬');
}
