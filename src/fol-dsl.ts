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

// ─── Fixture types ────────────────────────────────────────────────────────────

export type ScalarValue = string | number | boolean;
export type FieldValue = ScalarValue | Set<string>;
export type Bindings = Record<string, FieldValue>;

export type FixtureInstance = {
  varName: string;
  entityName: string;
  fields: Bindings;
};

export type FixtureExpect =
  | { kind: 'expect_ok';        varName: string }
  | { kind: 'expect_violation'; varName: string; ruleName: string };

export type Fixture = {
  name: string;
  instances: FixtureInstance[];
  expects: FixtureExpect[];
};

export type FixtureResult = {
  fixtureName: string;
  expects: Array<{
    varName: string;
    ruleName: string | null;
    expected: 'ok' | 'violation';
    pass: boolean;
    firedRule: string | null;
  }>;
};

export type ParseResult =
  | { ok: true;  program: Program; fixtures: Fixture[] }
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

    // fixture blocks — parsed separately, skip here
    if (line.startsWith('fixture ')) {
      while (i < lines.length && lines[i].trim() !== '}') i++;
      if (i < lines.length) i++;
      continue;
    }

    errors.push({ line: lineNum, message: `Unknown declaration: ${line}` });
    i++;
  }

  const fixtures = parseFixtures(source);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, program: { sorts, entities, globalAxioms }, fixtures };
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

// ─── Semantic Evaluator ───────────────────────────────────────────────────────

function resolveField(term: string, bindings: Bindings): FieldValue | undefined {
  // support dot-chain: owner.active → look up in bindings['owner.active'] or nested
  return bindings[term];
}

function evalCmpOp(op: string, l: number, r: number): boolean {
  if (op === '>')  return l > r;
  if (op === '<')  return l < r;
  if (op === '>=') return l >= r;
  if (op === '<=') return l <= r;
  return false;
}

export function evalExpr(e: Expr, bindings: Bindings, program: Program): boolean {
  switch (e.kind) {
    case 'and':     return evalExpr(e.left, bindings, program) && evalExpr(e.right, bindings, program);
    case 'or':      return evalExpr(e.left, bindings, program) || evalExpr(e.right, bindings, program);
    case 'not':     return !evalExpr(e.expr, bindings, program);
    case 'implies': return !evalExpr(e.left, bindings, program) || evalExpr(e.right, bindings, program);
    case 'ite': {
      const c = evalExpr(e.cond, bindings, program);
      if (c) return evalExpr(e.then, bindings, program);
      return e.else_ ? evalExpr(e.else_, bindings, program) : true;
    }
    case 'eq': {
      const lv = resolveField(e.left, bindings);
      // direct value match or variant name match
      if (lv instanceof Set) return lv.has(e.right);
      return String(lv) === e.right || lv === bindings[e.right];
    }
    case 'neq': {
      const lv = resolveField(e.left, bindings);
      if (lv instanceof Set) return !lv.has(e.right);
      return String(lv) !== e.right && lv !== bindings[e.right];
    }
    case 'cmp': {
      const lv = Number(resolveField(e.left, bindings));
      const rv = Number(resolveField(e.right, bindings) ?? e.right);
      return evalCmpOp(e.op, lv, isNaN(rv) ? Number(e.right) : rv);
    }
    case 'pred': {
      if (e.args.length === 0) {
        // zero-arg: treat as boolean field on current bindings
        const v = resolveField(e.name, bindings);
        return v === true || v === 'true';
      }
      if (e.args.length === 1) {
        // unary pred: active(owner) → look up 'owner.active' or bindings[owner][active]
        const fieldKey = `${e.args[0]}.${e.name}`;
        const v = resolveField(fieldKey, bindings) ?? resolveField(e.name, bindings);
        return v === true || v === 'true';
      }
      if (e.args.length === 2) {
        // binary pred: hasRole(owner, admin) → bindings['owner.roles'] is a Set
        const [obj, val] = e.args;
        const sort = program.sorts.find(s => s.variants.includes(val));
        if (sort) {
          // try common field name patterns: roles, permissions, <sortName>s, etc.
          const candidates = [
            `${obj}.roles`, `${obj}.${sort.name.toLowerCase()}s`,
            `${obj}.${sort.name.toLowerCase()}`, obj,
          ];
          for (const key of candidates) {
            const setVal = resolveField(key, bindings);
            if (setVal instanceof Set) return setVal.has(val);
          }
        }
      }
      return false;
    }
    case 'forall': {
      const sort = program.sorts.find(s => s.name === e.sort);
      if (!sort) return true;
      return sort.variants.every(v =>
        evalExpr(e.body, { ...bindings, [e.variable]: v }, program)
      );
    }
    case 'exists': {
      const sort = program.sorts.find(s => s.name === e.sort);
      if (!sort) return false;
      return sort.variants.some(v =>
        evalExpr(e.body, { ...bindings, [e.variable]: v }, program)
      );
    }
  }
}

// ─── Fixture Parser ───────────────────────────────────────────────────────────

function parseFixtures(source: string): Fixture[] {
  const fixtures: Fixture[] = [];
  const lines = source.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line.startsWith('fixture ')) { i++; continue; }

    const name = line.replace(/^fixture\s+/, '').replace(/\s*\{?\s*$/, '').trim();
    i++;
    if (i < lines.length && lines[i].trim() === '{') i++;

    const instances: FixtureInstance[] = [];
    const expects: FixtureExpect[] = [];

    while (i < lines.length && lines[i].trim() !== '}') {
      const inner = lines[i].trim();
      i++;
      if (!inner || inner.startsWith('//')) continue;

      // let varName = EntityName { field: value, ... };
      const letM = inner.match(/^let\s+(\w+)\s*=\s*(\w+)\s*\{(.*)$/);
      if (letM) {
        const varName = letM[1];
        const entityName = letM[2];
        const fields: Bindings = {};
        let fieldsStr = letM[3];
        // collect continuation lines until closing }
        while (!fieldsStr.includes('}') && i < lines.length) {
          fieldsStr += ' ' + lines[i].trim(); i++;
        }
        fieldsStr = fieldsStr.replace(/\};?\s*$/, '').replace(/;$/, '').trim();
        for (const part of fieldsStr.split(',')) {
          const kv = part.trim().match(/^(\w+(?:\.\w+)?)\s*:\s*(.+)$/);
          if (!kv) continue;
          const [, k, rawV] = kv;
          const v = rawV.trim().replace(/;$/, '');
          if (v.startsWith('{') && v.endsWith('}')) {
            const items = v.slice(1, -1).split(/[,\s]+/).filter(Boolean);
            fields[k] = new Set(items);
          } else if (v === 'true') { fields[k] = true; }
          else if (v === 'false') { fields[k] = false; }
          else if (!isNaN(Number(v))) { fields[k] = Number(v); }
          else { fields[k] = v.replace(/^["']|["']$/g, ''); }
        }
        instances.push({ varName, entityName, fields });
        continue;
      }

      // expect_ok varName;
      const okM = inner.match(/^expect_ok\s+(\w+)\s*;?$/);
      if (okM) { expects.push({ kind: 'expect_ok', varName: okM[1] }); continue; }

      // expect_violation ruleName in varName;
      const vM = inner.match(/^expect_violation\s+(\w+)\s+in\s+(\w+)\s*;?$/);
      if (vM) { expects.push({ kind: 'expect_violation', varName: vM[2], ruleName: vM[1] }); continue; }
    }
    if (i < lines.length && lines[i].trim() === '}') i++;
    fixtures.push({ name, instances, expects });
  }

  return fixtures;
}

// ─── Fixture Runner ───────────────────────────────────────────────────────────

export function runFixtures(fixtures: Fixture[], program: Program): FixtureResult[] {
  return fixtures.map(fx => {
    // build flat bindings from all instances, supporting cross-instance refs via dot-keys
    const allBindings: Bindings = {};
    for (const inst of fx.instances) {
      for (const [k, v] of Object.entries(inst.fields)) {
        allBindings[k] = v;                              // raw field
        allBindings[`${inst.varName}.${k}`] = v;        // var.field
      }
    }
    // resolve cross-instance references:
    // if Order.owner = "admin" (a varName), create owner.* = admin.* aliases
    for (const inst of fx.instances) {
      for (const [fieldName, fieldVal] of Object.entries(inst.fields)) {
        if (typeof fieldVal !== 'string') continue;
        const refInst = fx.instances.find(i => i.varName === fieldVal);
        if (!refInst) continue;
        for (const [k, v] of Object.entries(refInst.fields)) {
          allBindings[`${fieldName}.${k}`] = v;   // e.g. owner.roles, owner.active
        }
      }
    }

    const expects = fx.expects.map(exp => {
      const inst = fx.instances.find(ins => ins.varName === exp.varName);
      if (!inst) return { varName: exp.varName, ruleName: exp.kind === 'expect_violation' ? exp.ruleName : null, expected: exp.kind === 'expect_ok' ? 'ok' as const : 'violation' as const, pass: false, firedRule: null };

      const entity = program.entities.find(e => e.name === inst.entityName);
      if (!entity) return { varName: exp.varName, ruleName: exp.kind === 'expect_violation' ? exp.ruleName : null, expected: exp.kind === 'expect_ok' ? 'ok' as const : 'violation' as const, pass: false, firedRule: null };

      // merge instance fields flat (for within-entity field access)
      const bindings: Bindings = { ...allBindings, ...inst.fields };

      // find which rules fire (are violated)
      const firedRules = entity.axioms
        .filter(ax => !evalExpr(ax.expr, bindings, program))
        .map(ax => ax.name);

      if (exp.kind === 'expect_ok') {
        const pass = firedRules.length === 0;
        return { varName: exp.varName, ruleName: null, expected: 'ok' as const, pass, firedRule: firedRules[0] ?? null };
      } else {
        const pass = firedRules.includes(exp.ruleName);
        return { varName: exp.varName, ruleName: exp.ruleName, expected: 'violation' as const, pass, firedRule: firedRules[0] ?? null };
      }
    });

    return { fixtureName: fx.name, expects };
  });
}

// ─── Step Debugger ────────────────────────────────────────────────────────────

export type TraceStep = {
  exprStr: string;
  depth: number;
  result: boolean;
  skipped: boolean;
};

export function evalTrace(
  e: Expr,
  bindings: Bindings,
  program: Program,
): { steps: TraceStep[]; finalResult: boolean } {
  const steps: TraceStep[] = [];

  function go(node: Expr, depth: number, skip: boolean): boolean {
    if (skip) {
      steps.push({ exprStr: exprToString(node), depth, result: false, skipped: true });
      return false;
    }
    let result: boolean;
    switch (node.kind) {
      case 'and': {
        const l = go(node.left, depth + 1, false);
        const r = go(node.right, depth + 1, !l);
        result = l && r;
        break;
      }
      case 'or': {
        const l = go(node.left, depth + 1, false);
        const r = go(node.right, depth + 1, l);
        result = l || r;
        break;
      }
      case 'implies': {
        const l = go(node.left, depth + 1, false);
        const r = go(node.right, depth + 1, !l);
        result = !l || r;
        break;
      }
      case 'not': {
        const inner = go(node.expr, depth + 1, false);
        result = !inner;
        break;
      }
      case 'ite': {
        const cond = go(node.cond, depth + 1, false);
        go(node.then, depth + 1, !cond);
        if (node.else_) go(node.else_, depth + 1, cond);
        result = evalExpr(node, bindings, program);
        break;
      }
      default:
        result = evalExpr(node, bindings, program);
    }
    steps.push({ exprStr: exprToString(node), depth, result, skipped: false });
    return result;
  }

  const finalResult = go(e, 0, false);
  return { steps, finalResult };
}

// ─── Auto Debug (generates all scenarios from rules) ─────────────────────────

export type AutoCase = {
  bindings: Bindings;
  firedRules: string[];
  label: string;
};

export type AutoDebugResult = {
  entityName: string;
  entityKind: 'entity' | 'value';
  cases: AutoCase[];
  rulesCoverage: Record<string, { hold: number; violation: number }>;
};

// Walk expression tree and collect all "binding keys needed" with candidate values
function collectCandidates(
  e: Expr,
  entity: Entity,
  program: Program,
  out: Record<string, Set<FieldValue>>,
) {
  switch (e.kind) {
    case 'and': case 'or': case 'implies':
      collectCandidates(e.left, entity, program, out);
      collectCandidates(e.right, entity, program, out);
      break;
    case 'not':
      collectCandidates(e.expr, entity, program, out);
      break;
    case 'ite':
      collectCandidates(e.cond, entity, program, out);
      collectCandidates(e.then, entity, program, out);
      if (e.else_) collectCandidates(e.else_, entity, program, out);
      break;
    case 'eq': case 'neq': {
      if (!out[e.left]) out[e.left] = new Set();
      // add the literal value and all sort variants if it's a sort
      const sort = program.sorts.find(s => s.variants.includes(e.right));
      if (sort) {
        // add all sort variants so every branch is exercised
        for (const v of sort.variants) out[e.left].add(v);
      } else {
        out[e.left].add(e.right);
        out[e.left].add(e.right === 'true' ? false : true); // opposite
      }
      break;
    }
    case 'cmp': {
      if (!out[e.left]) out[e.left] = new Set();
      const n = Number(e.right);
      // boundary + one passing + one failing
      if (e.op === '>' || e.op === '>=') { out[e.left].add(n + 1); out[e.left].add(n - 1); out[e.left].add(n); }
      if (e.op === '<' || e.op === '<=') { out[e.left].add(n - 1); out[e.left].add(n + 1); out[e.left].add(n); }
      break;
    }
    case 'pred': {
      if (e.args.length === 0) {
        if (!out[e.name]) out[e.name] = new Set();
        out[e.name].add(true); out[e.name].add(false);
      }
      if (e.args.length === 1) {
        // active(owner) → need owner.active: boolean
        const key = `${e.args[0]}.${e.name}`;
        if (!out[key]) out[key] = new Set();
        out[key].add(true); out[key].add(false);
      }
      if (e.args.length === 2) {
        // hasRole(owner, admin) → need owner.roles: Set containing or not containing val
        const [obj, val] = e.args;
        const sort = program.sorts.find(s => s.variants.includes(val));
        if (sort) {
          const key = `${obj}.roles`;
          if (!out[key]) out[key] = new Set();
          // include each variant as a singleton set so every branch is reachable
          for (const v of sort.variants) {
            // store sets by reference — use a flag string, convert after
            out[key].add(`__SET__${v}`);
          }
          out[key].add('__SET__'); // empty set
        }
      }
      break;
    }
    case 'forall': case 'exists':
      collectCandidates(e.body, entity, program, out);
      break;
  }
}

function cartesian(candidates: Record<string, FieldValue[]>): Bindings[] {
  const keys = Object.keys(candidates);
  if (keys.length === 0) return [{}];
  const [first, ...rest] = keys;
  const subResults = cartesian(Object.fromEntries(rest.map(k => [k, candidates[k]])));
  const result: Bindings[] = [];
  for (const val of candidates[first]) {
    for (const sub of subResults) {
      result.push({ [first]: val, ...sub });
    }
  }
  return result;
}

function resolveSetTokens(bindings: Bindings): Bindings {
  const out: Bindings = {};
  for (const [k, v] of Object.entries(bindings)) {
    if (typeof v === 'string' && v.startsWith('__SET__')) {
      const variant = v.slice(7); // after '__SET__'
      out[k] = variant ? new Set([variant]) : new Set<string>();
    } else {
      out[k] = v;
    }
  }
  return out;
}

function bindingLabel(b: Bindings): string {
  return Object.entries(b)
    .map(([k, v]) => {
      if (v instanceof Set) return `${k}={${[...v].join(',') || '∅'}}`;
      return `${k}=${v}`;
    })
    .join(', ');
}

export function autoDebug(program: Program): AutoDebugResult[] {
  return program.entities
    .filter(e => e.axioms.length > 0)
    .map(entity => {
      // collect candidate values from all rules
      const rawCandidates: Record<string, Set<FieldValue>> = {};
      for (const ax of entity.axioms) {
        collectCandidates(ax.expr, entity, program, rawCandidates);
      }

      // also add UUID/String fields with a fixed value so bindings are complete
      for (const f of entity.fields) {
        if (f.type.kind === 'primitive' && (f.type.name === 'UUID' || f.type.name === 'String')) {
          if (!rawCandidates[f.name]) rawCandidates[f.name] = new Set([`${f.name}-1`]);
        }
      }

      const candidates: Record<string, FieldValue[]> = {};
      for (const [k, set] of Object.entries(rawCandidates)) {
        candidates[k] = [...set];
      }

      // generate all combinations (cap at 200)
      let combos = cartesian(candidates).map(resolveSetTokens);
      if (combos.length > 200) combos = combos.slice(0, 200);

      // evaluate each combination against all rules
      const coverage: Record<string, { hold: number; violation: number }> = {};
      for (const ax of entity.axioms) coverage[ax.name] = { hold: 0, violation: 0 };

      const cases: AutoCase[] = combos.map(bindings => {
        const firedRules = entity.axioms
          .filter(ax => !evalExpr(ax.expr, bindings, program))
          .map(ax => ax.name);
        for (const ax of entity.axioms) {
          if (firedRules.includes(ax.name)) coverage[ax.name].violation++;
          else coverage[ax.name].hold++;
        }
        return { bindings, firedRules, label: bindingLabel(bindings) };
      });

      return { entityName: entity.name, entityKind: entity.kind, cases, rulesCoverage: coverage };
    });
}
