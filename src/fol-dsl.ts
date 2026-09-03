// ─── Types ────────────────────────────────────────────────────────────────────

export type Sort = { name: string; variants: string[] };

export type FieldType =
  | { kind: 'primitive'; name: string }
  | { kind: 'ref'; name: string }
  | { kind: 'set'; inner: string }
  | { kind: 'list'; inner: string };

export type Field = { name: string; type: FieldType };

export type Expr =
  | { kind: 'implies'; left: Expr; right: Expr }
  | { kind: 'and'; left: Expr; right: Expr }
  | { kind: 'or'; left: Expr; right: Expr }
  | { kind: 'not'; expr: Expr }
  | { kind: 'eq'; left: string; right: string }
  | { kind: 'neq'; left: string; right: string }
  | { kind: 'cmp'; op: string; left: string; right: string }
  | { kind: 'ite'; cond: Expr; then: Expr; else_: Expr | null }
  | { kind: 'pred'; name: string; args: string[] }
  | { kind: 'forall'; variable: string; sort: string; body: Expr }
  | { kind: 'exists'; variable: string; sort: string; body: Expr };

export type Axiom = { name: string; expr: Expr };
export type Entity = { name: string; kind: 'entity' | 'value'; fields: Field[]; axioms: Axiom[] };
export type Program = { sorts: Sort[]; entities: Entity[]; globalAxioms: Axiom[] };
export type ParseError = { line: number; message: string };
export type ParseResult =
  | { ok: true; program: Program }
  | { ok: false; errors: ParseError[] };

// ─── Tokenizer ────────────────────────────────────────────────────────────────

type Tok =
  | { t: 'ident'; v: string }
  | { t: 'op'; v: string }
  | { t: 'lparen' }
  | { t: 'rparen' }
  | { t: 'dot' }
  | { t: 'colon' }
  | { t: 'comma' };

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    if (/\s/.test(src[i])) { i++; continue; }
    if (src.startsWith('=>', i)) { toks.push({ t: 'op', v: '=>' }); i += 2; continue; }
    if (src.startsWith('!=', i)) { toks.push({ t: 'op', v: '!=' }); i += 2; continue; }
    if (src.startsWith('>=', i)) { toks.push({ t: 'op', v: '>=' }); i += 2; continue; }
    if (src.startsWith('<=', i)) { toks.push({ t: 'op', v: '<=' }); i += 2; continue; }
    if (src.startsWith('<=>', i)) { toks.push({ t: 'op', v: '<=>' }); i += 3; continue; }
    const uni: Record<string, string> = { '→': '=>', '↔': '<=>', '∧': '&', '∨': '|', '¬': '~' };
    if (uni[src[i]]) { toks.push({ t: 'op', v: uni[src[i]] }); i++; continue; }
    if (src[i] === '∀') { toks.push({ t: 'ident', v: 'forall' }); i++; continue; }
    if (src[i] === '∃') { toks.push({ t: 'ident', v: 'exists' }); i++; continue; }
    if (src[i] === '(') { toks.push({ t: 'lparen' }); i++; continue; }
    if (src[i] === ')') { toks.push({ t: 'rparen' }); i++; continue; }
    if (src[i] === '.') { toks.push({ t: 'dot' }); i++; continue; }
    if (src[i] === ':') { toks.push({ t: 'colon' }); i++; continue; }
    if (src[i] === ',') { toks.push({ t: 'comma' }); i++; continue; }
    if (src[i] === '&') { toks.push({ t: 'op', v: '&' }); i++; continue; }
    if (src[i] === '|') { toks.push({ t: 'op', v: '|' }); i++; continue; }
    if (src[i] === '~') { toks.push({ t: 'op', v: '~' }); i++; continue; }
    if (src[i] === '=') { toks.push({ t: 'op', v: '=' }); i++; continue; }
    if (src[i] === '>') { toks.push({ t: 'op', v: '>' }); i++; continue; }
    if (src[i] === '<') { toks.push({ t: 'op', v: '<' }); i++; continue; }
    // identifiers and numeric literals (both as ident tokens)
    if (/[\w\d]/.test(src[i])) {
      const s = i;
      while (i < src.length && /[\w\d.]/.test(src[i])) i++;
      toks.push({ t: 'ident', v: src.slice(s, i) });
      continue;
    }
    i++;
  }
  return toks;
}

// ─── Expression Parser ────────────────────────────────────────────────────────

const CMP_OPS = new Set(['>', '<', '>=', '<=']);

class ExprParser {
  private pos = 0;
  constructor(private toks: Tok[]) {}

  done(): boolean { return this.pos >= this.toks.length; }

  peek(): string {
    const t = this.toks[this.pos];
    if (!t) return 'EOF';
    return t.t === 'ident' || t.t === 'op' ? t.v : t.t;
  }

  consume(expected?: string): Tok {
    const t = this.toks[this.pos];
    if (!t) throw new Error(`Unexpected end${expected ? ', expected ' + expected : ''}`);
    const got = t.t === 'ident' || t.t === 'op' ? t.v : t.t;
    if (expected && got !== expected) throw new Error(`Expected '${expected}', got '${got}'`);
    this.pos++;
    return t;
  }

  try_(v: string): boolean {
    if (this.peek() === v) { this.pos++; return true; }
    return false;
  }

  parseExpr(): Expr { return this.parseImplies(); }

  parseImplies(): Expr {
    let left = this.parseOr();
    while (this.peek() === '=>') {
      this.consume('=>');
      const right = this.parseOr();
      left = { kind: 'implies', left, right };
    }
    return left;
  }

  parseOr(): Expr {
    let left = this.parseAnd();
    while (this.peek() === '|') {
      this.consume('|');
      const right = this.parseAnd();
      left = { kind: 'or', left, right };
    }
    return left;
  }

  parseAnd(): Expr {
    let left = this.parseNot();
    while (this.peek() === '&') {
      this.consume('&');
      const right = this.parseNot();
      left = { kind: 'and', left, right };
    }
    return left;
  }

  parseNot(): Expr {
    if (this.peek() === '~') {
      this.consume('~');
      return { kind: 'not', expr: this.parseNot() };
    }
    return this.parseQuantifier();
  }

  parseITE(): Expr {
    this.consume('if');
    const cond = this.parseImplies();
    this.consume('then');
    const then_ = this.parseImplies();
    let else_: Expr | null = null;
    if (this.peek() === 'else') {
      this.consume('else');
      else_ = this.parseImplies();
    }
    this.try_('endif');
    return { kind: 'ite', cond, then: then_, else_: else_ };
  }

  parseQuantifier(): Expr {
    const p = this.peek();
    if (p === 'if') return this.parseITE();
    if (p === 'forall' || p === 'exists') {
      const qk = p as 'forall' | 'exists';
      this.consume(qk);
      const varTok = this.consume() as { t: 'ident'; v: string };
      let sort = '';
      if (this.try_('colon')) {
        const st = this.consume() as { t: 'ident'; v: string };
        sort = st.v;
      }
      this.try_('dot');
      const body = this.parseImplies();
      return { kind: qk, variable: varTok.v, sort, body };
    }
    return this.parseAtom();
  }

  parseAtom(): Expr {
    if (this.peek() === 'lparen') {
      this.consume('lparen');
      const e = this.parseImplies();
      this.consume('rparen');
      return e;
    }

    const t = this.toks[this.pos];
    if (t?.t !== 'ident') throw new Error(`Unexpected token: ${this.peek()}`);
    this.pos++;
    let name = t.v;

    // dot chain: u.active
    while (this.peek() === 'dot') {
      this.consume('dot');
      const next = this.toks[this.pos];
      if (next?.t === 'ident') { name += '.' + next.v; this.pos++; }
    }

    // pred(args)
    if (this.peek() === 'lparen') {
      this.consume('lparen');
      const args: string[] = [];
      while (this.peek() !== 'rparen' && !this.done()) {
        if (args.length) this.try_('comma');
        const a = this.toks[this.pos];
        if (a?.t === 'ident') { args.push(a.v); this.pos++; } else break;
      }
      this.consume('rparen');
      return { kind: 'pred', name, args };
    }

    // equality / inequality
    if (this.peek() === '=') {
      this.consume('=');
      const r = this.toks[this.pos];
      const right = r?.t === 'ident' ? (this.pos++, r.v) : '';
      return { kind: 'eq', left: name, right };
    }
    if (this.peek() === '!=') {
      this.consume('!=');
      const r = this.toks[this.pos];
      const right = r?.t === 'ident' ? (this.pos++, r.v) : '';
      return { kind: 'neq', left: name, right };
    }

    // numeric comparisons: amount > 0, age >= 18
    if (CMP_OPS.has(this.peek())) {
      const op = this.peek();
      this.consume(op);
      const r = this.toks[this.pos];
      const right = r?.t === 'ident' ? (this.pos++, r.v) : '0';
      return { kind: 'cmp', op, left: name, right };
    }

    return { kind: 'pred', name, args: [] };
  }
}

function parseExprStr(src: string): Expr {
  const p = new ExprParser(tokenize(src));
  return p.parseExpr();
}

// ─── Program Parser ───────────────────────────────────────────────────────────

function parseFieldType(raw: string): FieldType {
  const s = raw.match(/^Set<(.+)>$/);
  if (s) return { kind: 'set', inner: s[1].trim() };
  const l = raw.match(/^List<(.+)>$/);
  if (l) return { kind: 'list', inner: l[1].trim() };
  if (['String', 'Int', 'Float', 'Boolean', 'UUID', 'Long', 'Double'].includes(raw))
    return { kind: 'primitive', name: raw };
  return { kind: 'ref', name: raw };
}

export function parse(source: string): ParseResult {
  const errors: ParseError[] = [];
  const sorts: Sort[] = [];
  const entities: Entity[] = [];
  const globalAxioms: Axiom[] = [];
  const lines = source.split('\n');
  let i = 0;

  function skip() {
    while (i < lines.length && (!lines[i].trim() || lines[i].trim().startsWith('//'))) i++;
  }

  function consumeAxiom(firstLine: string, lineNum: number): Axiom | null {
    // strip keyword: axiom | rule | invariant
    const rest = firstLine.replace(/^(axiom|rule|invariant)\s+/, '').trim();
    const colonIdx = rest.indexOf(':');
    if (colonIdx === -1) { errors.push({ line: lineNum, message: `Rule missing name: ${firstLine}` }); return null; }
    const axiomName = rest.slice(0, colonIdx).trim();
    let body = rest.slice(colonIdx + 1).trim();
    while (i < lines.length) {
      const next = lines[i];
      const indent = (next.match(/^(\s+)/)?.[1]?.length ?? 0);
      const trimmed = next.trim();
      if (indent >= 2 && trimmed && !trimmed.match(/^(rule|axiom|invariant)\s/) && trimmed !== '}') {
        body += ' ' + trimmed; i++;
      } else break;
    }
    if (!body) { errors.push({ line: lineNum, message: `Rule '${axiomName}' has no body` }); return null; }
    {
      const tb = body.trimEnd();
      if (tb.endsWith(';')) { body = tb.slice(0, -1).trim(); }
      else { errors.push({ line: lineNum, message: `Rule '${axiomName}' missing ';' at end` }); }
    }
    try {
      return { name: axiomName, expr: parseExprStr(body) };
    } catch (e) {
      errors.push({ line: lineNum, message: `Rule '${axiomName}': ${String(e)}` });
      return null;
    }
  }

  while (i < lines.length) {
    skip();
    if (i >= lines.length) break;
    const line = lines[i].trim();
    const lineNum = i + 1;

    // sort Status = pending | approved | rejected
    if (line.startsWith('sort ')) {
      const m = line.match(/^sort\s+(\w+)\s*=\s*(.+)$/);
      if (!m) { errors.push({ line: lineNum, message: `Invalid sort: ${line}` }); }
      else {
        const raw = m[2].trimEnd();
        if (!raw.endsWith(';')) errors.push({ line: lineNum, message: `Sort '${m[1]}' missing ';' at end` });
        sorts.push({ name: m[1], variants: raw.replace(/;$/, '').split('|').map(v => v.trim()).filter(Boolean) });
      }
      i++; continue;
    }

    // sig / entity / value
    const entityMatch = line.match(/^(sig|entity|value)\s+(\w+)\s*\{?$/);
    if (entityMatch) {
      const rawKind = entityMatch[1];
      const entityKind: 'entity' | 'value' = rawKind === 'value' ? 'value' : 'entity';
      const eName = entityMatch[2];
      const fields: Field[] = [];
      const axioms: Axiom[] = [];
      i++;
      if (i < lines.length && lines[i].trim() === '{') i++;
      while (i < lines.length && lines[i].trim() !== '}') {
        const inner = lines[i].trim();
        if (!inner || inner.startsWith('//')) { i++; continue; }
        if (inner.match(/^(rule|axiom)\s+/)) {
          i++;
          const ax = consumeAxiom(inner, i);
          if (ax) axioms.push(ax);
          continue;
        }
        const fM = inner.match(/^(\w+)\s*:\s*(.+)$/);
        if (fM) {
          const rawType = fM[2].trimEnd();
          if (!rawType.endsWith(';')) errors.push({ line: i + 1, message: `Field '${fM[1]}' missing ';' at end` });
          fields.push({ name: fM[1], type: parseFieldType(rawType.replace(/;$/, '').trim()) });
        }
        else { errors.push({ line: i + 1, message: `Unknown line in ${entityKind} '${eName}': ${inner}` }); }
        i++;
      }
      if (i < lines.length && lines[i].trim() === '}') i++;
      entities.push({ name: eName, kind: entityKind, fields, axioms });
      continue;
    }

    // global axiom / invariant
    if (line.match(/^(axiom|invariant)\s+/)) {
      i++;
      const ax = consumeAxiom(line, lineNum);
      if (ax) globalAxioms.push(ax);
      continue;
    }

    errors.push({ line: lineNum, message: `Unknown declaration: ${line}` });
    i++;
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, program: { sorts, entities, globalAxioms } };
}

// ─── Expr → readable string ───────────────────────────────────────────────────

export function exprToString(e: Expr): string {
  switch (e.kind) {
    case 'implies': return `(${exprToString(e.left)} → ${exprToString(e.right)})`;
    case 'and':     return `(${exprToString(e.left)} ∧ ${exprToString(e.right)})`;
    case 'or':      return `(${exprToString(e.left)} ∨ ${exprToString(e.right)})`;
    case 'not':     return `¬${exprToString(e.expr)}`;
    case 'eq':      return `${e.left} = ${e.right}`;
    case 'neq':     return `${e.left} ≠ ${e.right}`;
    case 'cmp':     return `${e.left} ${e.op} ${e.right}`;
    case 'ite':     return e.else_
      ? `(if ${exprToString(e.cond)} then ${exprToString(e.then)} else ${exprToString(e.else_)})`
      : `(if ${exprToString(e.cond)} then ${exprToString(e.then)})`;
    case 'pred':    return e.args.length ? `${e.name}(${e.args.join(', ')})` : e.name;
    case 'forall':  return `∀${e.variable}${e.sort ? ': ' + e.sort : ''}. ${exprToString(e.body)}`;
    case 'exists':  return `∃${e.variable}${e.sort ? ': ' + e.sort : ''}. ${exprToString(e.body)}`;
  }
}
