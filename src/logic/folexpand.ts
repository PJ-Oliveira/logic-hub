// ─── FOL → Propositional expansion (finite domain / finitismo) ────────────────
// Parses first-order formulas with ∀/∃, predicates P(x), constants,
// and expands quantifiers over a user-supplied finite domain before passing
// the result to the propositional truth-table checker.

// ─── Tokenizer ────────────────────────────────────────────────────────────────

type QTok =
  | { t: 'ident'; v: string }
  | { t: 'forall' }
  | { t: 'exists' }
  | { t: 'op'; v: string };

function tokenizeQ(raw: string): QTok[] {
  const s = raw
    .replace(/∀/g, ' forall ')
    .replace(/∃/g, ' exists ')
    .replace(/→/g, ' -> ')
    .replace(/∧/g, ' & ')
    .replace(/∨/g, ' | ')
    .replace(/¬/g, ' ~ ');
  const parts = s.match(/->|forall|exists|[&|~(),.]|[a-zA-Z][a-zA-Z0-9]*/g) ?? [];
  return parts.map(p => {
    if (p === 'forall') return { t: 'forall' } as QTok;
    if (p === 'exists') return { t: 'exists' } as QTok;
    if ('->&|~(),.'.includes(p) || p === '->') return { t: 'op', v: p } as QTok;
    return { t: 'ident', v: p } as QTok;
  });
}

// ─── AST ──────────────────────────────────────────────────────────────────────

type QExpr =
  | { k: 'var';  name: string }
  | { k: 'pred'; name: string; args: string[] }
  | { k: 'not';  e: QExpr }
  | { k: 'and';  l: QExpr; r: QExpr }
  | { k: 'or';   l: QExpr; r: QExpr }
  | { k: 'imp';  l: QExpr; r: QExpr }
  | { k: 'all';  v: string; e: QExpr }
  | { k: 'ex';   v: string; e: QExpr };

// ─── Parser ───────────────────────────────────────────────────────────────────

class QParser {
  pos = 0;
  constructor(private toks: QTok[]) {}

  peek(): QTok | undefined { return this.toks[this.pos]; }
  consume(): QTok {
    const t = this.toks[this.pos++];
    if (!t) throw new Error('Unexpected end of formula');
    return t;
  }
  eatOp(v: string): boolean {
    const t = this.peek();
    if (t?.t === 'op' && t.v === v) { this.pos++; return true; }
    return false;
  }

  parse(): QExpr {
    const e = this.parseImp();
    if (this.pos < this.toks.length)
      throw new Error(`Unexpected token: ${JSON.stringify(this.toks[this.pos])}`);
    return e;
  }

  parseImp(): QExpr {
    let l = this.parseOr();
    while (this.eatOp('->')) l = { k: 'imp', l, r: this.parseOr() };
    return l;
  }
  parseOr(): QExpr {
    let l = this.parseAnd();
    while (this.eatOp('|')) l = { k: 'or', l, r: this.parseAnd() };
    return l;
  }
  parseAnd(): QExpr {
    let l = this.parseNot();
    while (this.eatOp('&')) l = { k: 'and', l, r: this.parseNot() };
    return l;
  }
  parseNot(): QExpr {
    if (this.eatOp('~')) return { k: 'not', e: this.parseNot() };
    return this.parseQ();
  }
  parseQ(): QExpr {
    const t = this.peek();
    if (t?.t === 'forall' || t?.t === 'exists') {
      const q = t.t;
      this.pos++;
      const vt = this.consume();
      if (vt.t !== 'ident') throw new Error('Expected variable after quantifier');
      this.eatOp('.');
      const e = this.parseImp();
      return q === 'forall' ? { k: 'all', v: vt.v, e } : { k: 'ex', v: vt.v, e };
    }
    return this.parseAtom();
  }
  parseAtom(): QExpr {
    if (this.eatOp('(')) {
      const e = this.parseImp();
      if (!this.eatOp(')')) throw new Error('Expected )');
      return e;
    }
    const t = this.consume();
    if (t.t !== 'ident') throw new Error(`Expected identifier, got: ${t.t}`);
    // Predicate call: Name(arg1, arg2, ...)
    const next = this.peek();
    if (next?.t === 'op' && next.v === '(') {
      this.pos++;
      const args: string[] = [];
      while (!(this.peek()?.t === 'op' && (this.peek() as {t:'op';v:string}).v === ')')) {
        if (args.length > 0 && !this.eatOp(',')) throw new Error('Expected , in predicate args');
        const a = this.consume();
        if (a.t !== 'ident') throw new Error('Expected identifier as predicate argument');
        args.push(a.v);
      }
      this.eatOp(')');
      return { k: 'pred', name: t.v, args };
    }
    return { k: 'var', name: t.v };
  }
}

// ─── Substitution ─────────────────────────────────────────────────────────────

function subst(e: QExpr, v: string, d: string): QExpr {
  switch (e.k) {
    case 'var':  return { k: 'var', name: e.name === v ? d : e.name };
    case 'pred': return { k: 'pred', name: e.name, args: e.args.map(a => a === v ? d : a) };
    case 'not':  return { k: 'not', e: subst(e.e, v, d) };
    case 'and':  return { k: 'and', l: subst(e.l, v, d), r: subst(e.r, v, d) };
    case 'or':   return { k: 'or',  l: subst(e.l, v, d), r: subst(e.r, v, d) };
    case 'imp':  return { k: 'imp', l: subst(e.l, v, d), r: subst(e.r, v, d) };
    case 'all':  return e.v === v ? e : { k: 'all', v: e.v, e: subst(e.e, v, d) };
    case 'ex':   return e.v === v ? e : { k: 'ex',  v: e.v, e: subst(e.e, v, d) };
  }
}

// ─── Quantifier Expansion ─────────────────────────────────────────────────────

function expandQ(e: QExpr, domain: string[]): QExpr {
  switch (e.k) {
    case 'var':   return e;
    case 'pred':  return e;
    case 'not':   return { k: 'not', e: expandQ(e.e, domain) };
    case 'and':   return { k: 'and', l: expandQ(e.l, domain), r: expandQ(e.r, domain) };
    case 'or':    return { k: 'or',  l: expandQ(e.l, domain), r: expandQ(e.r, domain) };
    case 'imp':   return { k: 'imp', l: expandQ(e.l, domain), r: expandQ(e.r, domain) };
    case 'all': {
      const parts = domain.map(d => expandQ(subst(e.e, e.v, d), domain));
      return parts.reduce((acc, cur) => ({ k: 'and', l: acc, r: cur }));
    }
    case 'ex': {
      const parts = domain.map(d => expandQ(subst(e.e, e.v, d), domain));
      return parts.reduce((acc, cur) => ({ k: 'or', l: acc, r: cur }));
    }
  }
}

// ─── AST → propositional string + label map ───────────────────────────────────

function qToString(e: QExpr, labels: Record<string, string>): string {
  switch (e.k) {
    case 'var':  return e.name;
    case 'pred': {
      // P(a, b) → "Pab" as propositional var; label: { Pab: "P(a,b)" }
      const propName = e.name + e.args.join('');
      labels[propName] = `${e.name}(${e.args.join(',')})`;
      return propName;
    }
    case 'not':  return `~${qToString(e.e, labels)}`;
    case 'and':  return `(${qToString(e.l, labels)} & ${qToString(e.r, labels)})`;
    case 'or':   return `(${qToString(e.l, labels)} | ${qToString(e.r, labels)})`;
    case 'imp':  return `(${qToString(e.l, labels)} -> ${qToString(e.r, labels)})`;
    // Should not appear after expansion, but handle gracefully:
    case 'all':  return `(/* ∀${e.v} not expanded */)`;
    case 'ex':   return `(/* ∃${e.v} not expanded */)`;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasQuantifierOrPred(e: QExpr): boolean {
  switch (e.k) {
    case 'var':  return false;
    case 'pred': return true;
    case 'not':  return hasQuantifierOrPred(e.e);
    case 'and':  case 'or': case 'imp': return hasQuantifierOrPred(e.l) || hasQuantifierOrPred(e.r);
    case 'all':  case 'ex':  return true;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type ExpandResult =
  | { ok: true;  prop: string; labels: Record<string, string>; wasExpanded: boolean; displayProp: string }
  | { ok: false; error: string };

export function expandFormula(input: string, domain: string[]): ExpandResult {
  try {
    const toks = tokenizeQ(input.trim());
    if (toks.length === 0) return { ok: false, error: 'Empty formula' };
    const ast = new QParser(toks).parse();

    if (!hasQuantifierOrPred(ast)) {
      // Purely propositional — pass through without change
      return { ok: true, prop: input.trim(), labels: {}, wasExpanded: false, displayProp: input.trim() };
    }

    if (domain.length === 0) {
      return { ok: false, error: 'Domain is empty — add elements (e.g. a, b)' };
    }

    const expanded = expandQ(ast, domain);
    const labels: Record<string, string> = {};
    const prop = qToString(expanded, labels);
    const displayProp = prop
      .replace(/->/g, '→')
      .replace(/&/g, '∧')
      .replace(/\|/g, '∨')
      .replace(/~/g, '¬');
    return { ok: true, prop, labels, wasExpanded: true, displayProp };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export function needsExpansion(input: string): boolean {
  return /forall|exists|∀|∃|[A-Z]\s*\(/.test(input);
}

// Pretty-print a FOL formula (for display, not for evaluation)
export function prettyFOL(input: string): string {
  return input
    .replace(/forall\s+(\w+)\s*\./g, '∀$1.')
    .replace(/exists\s+(\w+)\s*\./g, '∃$1.')
    .replace(/->/g, '→')
    .replace(/&/g, '∧')
    .replace(/\|/g, '∨')
    .replace(/~/g, '¬');
}
