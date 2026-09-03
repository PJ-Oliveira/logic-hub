import type { Program, Entity, Field, Expr, Sort, Axiom, Fixture, FieldValue } from './fol-dsl';

export type Lang = 'java' | 'ts' | 'python';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

const INVERSE_OP: Record<string, string> = { '>': '<=', '<': '>=', '>=': '<', '<=': '>' };

function findIdField(entity: Entity): Field | null {
  return entity.fields.find(f => f.name === 'id' || f.name === 'uuid') ?? null;
}

// ─── Java field types ─────────────────────────────────────────────────────────

function javaFieldType(f: Field): string {
  switch (f.type.kind) {
    case 'primitive': {
      const m: Record<string, string> = {
        String: 'String', Boolean: 'boolean', Int: 'int',
        Float: 'double', Long: 'long', Double: 'double', UUID: 'java.util.UUID',
      };
      return m[f.type.name] ?? f.type.name;
    }
    case 'ref':  return f.type.name;
    case 'set':  return `java.util.Set<${f.type.inner}>`;
    case 'list': return `java.util.List<${f.type.inner}>`;
  }
}

function tsFieldType(f: Field): string {
  switch (f.type.kind) {
    case 'primitive': {
      const m: Record<string, string> = {
        String: 'string', Boolean: 'boolean', Int: 'number',
        Float: 'number', Long: 'number', Double: 'number', UUID: 'string',
      };
      return m[f.type.name] ?? f.type.name;
    }
    case 'ref':  return f.type.name;
    case 'set':  return `Set<${f.type.inner}>`;
    case 'list': return `${f.type.inner}[]`;
  }
}

function pyFieldType(f: Field): string {
  switch (f.type.kind) {
    case 'primitive': {
      const m: Record<string, string> = {
        String: 'str', Boolean: 'bool', Int: 'int',
        Float: 'float', Long: 'int', Double: 'float', UUID: 'uuid.UUID',
      };
      return m[f.type.name] ?? f.type.name;
    }
    case 'ref':  return f.type.name;
    case 'set':  return `frozenset[${f.type.inner}]`;
    case 'list': return `list[${f.type.inner}]`;
  }
}

// ─── Type resolution helpers ──────────────────────────────────────────────────

function sortOfVariant(v: string, program: Program): Sort | null {
  return program.sorts.find(s => s.variants.includes(v)) ?? null;
}

function setFieldFor(obj: string, sortName: string, entity: Entity, program: Program): string | null {
  const objField = entity.fields.find(f => f.name === obj);
  if (!objField || objField.type.kind !== 'ref') return null;
  const refEntity = program.entities.find(e => e.name === (objField.type.kind === 'ref' ? objField.type.name : ''));
  if (!refEntity) return null;
  return refEntity.fields.find(f =>
    (f.type.kind === 'set' || f.type.kind === 'list') && f.type.inner === sortName
  )?.name ?? null;
}

// ─── Expression → Code ────────────────────────────────────────────────────────

type Ctx = { lang: Lang; program: Program; entity: Entity | null };

function prefixSelf(term: string, ctx: Ctx): string {
  if (ctx.lang !== 'python' || !ctx.entity) return term;
  const base = term.includes('.') ? term.slice(0, term.indexOf('.')) : term;
  return ctx.entity.fields.some(f => f.name === base) ? 'self.' + term : term;
}

function eqCond(left: string, right: string, ctx: Ctx, negate = false): string {
  const sort = sortOfVariant(right, ctx.program);
  const l = prefixSelf(left, ctx);
  if (sort) {
    if (ctx.lang === 'java')   return negate ? `!(${l} instanceof ${cap(right)})` : `${l} instanceof ${cap(right)}`;
    if (ctx.lang === 'ts')     return negate ? `${l} !== '${right}'` : `${l} === '${right}'`;
    if (ctx.lang === 'python') return negate ? `${l} != ${sort.name}.${right}` : `${l} == ${sort.name}.${right}`;
  }
  if (ctx.lang === 'java')   return negate ? `!${l}.equals(${right})` : `${l}.equals(${right})`;
  if (ctx.lang === 'ts')     return negate ? `${l} !== ${right}` : `${l} === ${right}`;
  return negate ? `${l} != ${right}` : `${l} == ${right}`;
}

function cmpCond(left: string, op: string, right: string, ctx: Ctx, negate = false): string {
  const l = prefixSelf(left, ctx);
  const actualOp = negate ? (INVERSE_OP[op] ?? op) : op;
  return `${l} ${actualOp} ${right}`;
}

function predCond(name: string, args: string[], ctx: Ctx, negate = false): string {
  const { lang, entity, program } = ctx;
  const neg = (s: string) => lang === 'python' ? `not (${s})` : `!(${s})`;
  const wrap = (s: string) => negate ? neg(s) : s;

  if (args.length === 0) {
    const pName = prefixSelf(name, ctx);
    return lang === 'java' ? wrap(`${pName}()`) : wrap(pName);
  }

  if (args.length === 1) {
    const obj = prefixSelf(args[0], ctx);
    return lang === 'java' ? wrap(`${obj}.${name}()`) : wrap(`${obj}.${name}`);
  }

  if (args.length === 2 && entity) {
    const [obj, val] = args;
    const sort = sortOfVariant(val, program);
    if (sort) {
      const sf = setFieldFor(obj, sort.name, entity, program) ?? 'roles';
      const pObj = prefixSelf(obj, ctx);
      if (lang === 'java')   return wrap(`${pObj}.${sf}().contains(new ${cap(val)}())`);
      if (lang === 'ts')     return wrap(`${pObj}.${sf}.has('${val}')`);
      if (lang === 'python') return negate ? `${sort.name}.${val} not in ${pObj}.${sf}` : `${sort.name}.${val} in ${pObj}.${sf}`;
    }
  }

  const pArgs = args.map(a => prefixSelf(a, ctx)).join(', ');
  const call = `${name}(${pArgs})`;
  return negate ? (lang === 'python' ? `not (${call})` : `!(${call})`) : call;
}

// holdsExpr → boolean that is TRUE when axiom is satisfied
function holdsExpr(e: Expr, ctx: Ctx): string {
  const and = ctx.lang === 'python' ? ' and ' : ' && ';
  const or  = ctx.lang === 'python' ? ' or '  : ' || ';
  const neg = (s: string) => ctx.lang === 'python' ? `not (${s})` : `!(${s})`;
  switch (e.kind) {
    case 'implies': return `${neg(holdsExpr(e.left, ctx))}${or}${holdsExpr(e.right, ctx)}`;
    case 'and':     return `${holdsExpr(e.left, ctx)}${and}${holdsExpr(e.right, ctx)}`;
    case 'or':      return `${holdsExpr(e.left, ctx)}${or}${holdsExpr(e.right, ctx)}`;
    case 'not':     return neg(holdsExpr(e.expr, ctx));
    case 'eq':      return eqCond(e.left, e.right, ctx);
    case 'neq':     return eqCond(e.left, e.right, ctx, true);
    case 'cmp':     return cmpCond(e.left, e.op, e.right, ctx);
    case 'ite': {
      const condH = holdsExpr(e.cond, ctx);
      const or_  = ctx.lang === 'python' ? ' or '  : ' || ';
      const and_ = ctx.lang === 'python' ? ' and ' : ' && ';
      const neg_ = (s: string) => ctx.lang === 'python' ? `not (${s})` : `!(${s})`;
      if (!e.else_) return `${neg_(condH)}${or_}${holdsExpr(e.then, ctx)}`;
      return `(${neg_(condH)}${or_}${holdsExpr(e.then, ctx)})${and_}(${condH}${or_}${holdsExpr(e.else_, ctx)})`;
    }
    case 'pred':    return predCond(e.name, e.args, ctx);
    case 'forall':
    case 'exists':  return `/* ${e.kind} ${e.variable}${e.sort ? ': ' + e.sort : ''} */`;
  }
}

// violationExpr → boolean that is TRUE when axiom is VIOLATED
function violationExpr(e: Expr, ctx: Ctx): string {
  const and = ctx.lang === 'python' ? ' and ' : ' && ';
  const or  = ctx.lang === 'python' ? ' or '  : ' || ';
  const neg = (s: string) => ctx.lang === 'python' ? `not (${s})` : `!(${s})`;
  switch (e.kind) {
    case 'implies': return `${holdsExpr(e.left, ctx)}${and}${neg(holdsExpr(e.right, ctx))}`;
    case 'and':     return `${neg(holdsExpr(e.left, ctx))}${or}${neg(holdsExpr(e.right, ctx))}`;
    case 'or':      return `${neg(holdsExpr(e.left, ctx))}${and}${neg(holdsExpr(e.right, ctx))}`;
    case 'not':     return holdsExpr(e.expr, ctx);
    case 'eq':      return eqCond(e.left, e.right, ctx, true);
    case 'neq':     return eqCond(e.left, e.right, ctx);
    case 'cmp':     return cmpCond(e.left, e.op, e.right, ctx, true);
    case 'ite': {
      const condH = holdsExpr(e.cond, ctx);
      const and_ = ctx.lang === 'python' ? ' and ' : ' && ';
      const or_  = ctx.lang === 'python' ? ' or '  : ' || ';
      const neg_ = (s: string) => ctx.lang === 'python' ? `not (${s})` : `!(${s})`;
      if (!e.else_) return `${condH}${and_}${neg_(holdsExpr(e.then, ctx))}`;
      return `(${condH}${and_}${neg_(holdsExpr(e.then, ctx))})${or_}(${neg_(condH)}${and_}${neg_(holdsExpr(e.else_, ctx))})`;
    }
    case 'pred':    return predCond(e.name, e.args, ctx, true);
    case 'forall':
    case 'exists':  return `/* ${e.kind} ${e.variable}${e.sort ? ': ' + e.sort : ''} */`;
  }
}

// ─── Java Generator ───────────────────────────────────────────────────────────

export function generateJava(program: Program): string {
  const out: string[] = [];
  const w = (...lines: string[]) => out.push(...lines);

  w(
    '// Generated by Logic Hub — FOL Specification Editor',
    '// Java 17+ · Rich Domain Model',
    '// Entities: final class · private constructor · static factory · DomainException',
    '// Value Objects: immutable record · compact constructor',
    '',
    'public class DomainException extends RuntimeException {',
    '    private final String rule;',
    '    public DomainException(String rule) {',
    '        super("Domain rule violated: " + rule);',
    '        this.rule = rule;',
    '    }',
    '    public String getRule() { return rule; }',
    '}',
    '',
  );

  if (program.sorts.length > 0) {
    w('// ── Sorts ────────────────────────────────────────────────────────');
    for (const sort of program.sorts) {
      const permits = sort.variants.map(cap).join(', ');
      w(`public sealed interface ${sort.name} permits ${permits} {}`);
      for (const v of sort.variants) w(`public record ${cap(v)}() implements ${sort.name} {}`);
      w('');
    }
  }

  const entityList = program.entities.filter(e => e.kind === 'entity');
  const valueList  = program.entities.filter(e => e.kind === 'value');

  if (entityList.length > 0) {
    w('// ── Entities (identity · private constructor · static factory) ───');
    for (const entity of entityList) {
      const ctx: Ctx = { lang: 'java', program, entity };
      const idField = findIdField(entity);
      // class declaration + private fields
      w(`public final class ${entity.name} {`);
      for (const f of entity.fields) w(`    private final ${javaFieldType(f)} ${f.name};`);
      w('');
      // private constructor
      const ctorParams = entity.fields.map(f => `${javaFieldType(f)} ${f.name}`).join(', ');
      w(`    private ${entity.name}(${ctorParams}) {`);
      for (const f of entity.fields) {
        const isSet = f.type.kind === 'set';
        w(`        this.${f.name} = ${isSet ? `java.util.Collections.unmodifiableSet(${f.name})` : f.name};`);
      }
      w('    }', '');
      // static factory
      w(`    public static ${entity.name} create(${ctorParams}) {`);
      for (const ax of entity.axioms) {
        const guard = violationExpr(ax.expr, ctx);
        w(`        // rule: ${ax.name}`);
        w(`        if (${guard}) throw new DomainException("${ax.name}");`);
      }
      w(`        return new ${entity.name}(${entity.fields.map(f => f.name).join(', ')});`);
      w('    }', '');
      // accessors
      for (const f of entity.fields) {
        w(`    public ${javaFieldType(f)} ${f.name}() { return ${f.name}; }`);
      }
      // equals / hashCode based on id if present
      if (idField) {
        const idn = idField.name;
        w('');
        w('    @Override');
        w('    public boolean equals(Object o) {');
        w(`        if (this == o) return true;`);
        w(`        if (!(o instanceof ${entity.name} other)) return false;`);
        w(`        return ${idn}.equals(other.${idn});`);
        w('    }');
        w('    @Override');
        w(`    public int hashCode() { return ${idn}.hashCode(); }`);
      }
      w('}', '');
    }
  }

  if (valueList.length > 0) {
    w('// ── Value Objects (structural equality · immutable record) ────────');
    for (const entity of valueList) {
      const ctx: Ctx = { lang: 'java', program, entity };
      const params = entity.fields.map(f => `${javaFieldType(f)} ${f.name}`).join(', ');
      if (entity.axioms.length === 0) {
        w(`public record ${entity.name}(${params}) {}`, '');
      } else {
        w(`public record ${entity.name}(${params}) {`);
        w(`    public ${entity.name} {`);
        for (const ax of entity.axioms) {
          const guard = violationExpr(ax.expr, ctx);
          w(`        // rule: ${ax.name}`);
          w(`        if (${guard}) throw new DomainException("${ax.name}");`);
        }
        w('    }', '}', '');
      }
    }
  }

  if (program.globalAxioms.length > 0) {
    w('// ── Global Invariants ─────────────────────────────────────────────');
    w('// These are system-level invariants — enforce in a domain service or @Invariant check.');
    for (const ax of program.globalAxioms) w(`// • invariant ${ax.name}`);
  }

  return out.join('\n');
}

// ─── TypeScript Generator ─────────────────────────────────────────────────────

export function generateTS(program: Program): string {
  const out: string[] = [];
  const w = (...lines: string[]) => out.push(...lines);

  w(
    '// Generated by Logic Hub — FOL Specification Editor',
    '// TypeScript · Rich Domain Model',
    '// Result<T, DomainError> · Branded Types · Smart Constructors · Never throw directly',
    '',
    '// ── Domain Error & Result ──────────────────────────────────────',
    'type DomainError = Readonly<{ tag: \'DomainError\'; rule: string }>;',
    'type Result<T> =',
    '  | { readonly ok: true;  readonly value: T }',
    '  | { readonly ok: false; readonly error: DomainError };',
    '',
    'const ok  = <T>(value: T): Result<T> => ({ ok: true, value });',
    'const err = (rule: string): Result<never> =>',
    '  ({ ok: false, error: { tag: \'DomainError\', rule } });',
    '',
  );

  if (program.sorts.length > 0) {
    w('// ── Sorts ────────────────────────────────────────────────────');
    for (const sort of program.sorts) {
      const union = sort.variants.map(v => `'${v}'`).join(' | ');
      w(`type ${sort.name} = ${union};`, '');
    }
  }

  const entityList = program.entities.filter(e => e.kind === 'entity');
  const valueList  = program.entities.filter(e => e.kind === 'value');

  if (entityList.length > 0) {
    w('// ── Entities ─────────────────────────────────────────────────');
    for (const entity of entityList) {
      const ctx: Ctx = { lang: 'ts', program, entity };
      const fields = entity.fields.map(f => `    ${f.name}: ${tsFieldType(f)};`).join('\n');
      w(`type ${entity.name} = Readonly<{`, fields, `}> & { readonly _brand: '${entity.name}' };`, '');
      const factoryArgs = entity.fields.map(f => `${f.name}: ${tsFieldType(f)}`).join(', ');
      const fieldNames  = entity.fields.map(f => f.name).join(', ');
      w(`function create${entity.name}(${factoryArgs}): Result<${entity.name}> {`);
      for (const ax of entity.axioms) {
        const guard = violationExpr(ax.expr, ctx);
        w(`    // rule: ${ax.name}`);
        w(`    if (${guard}) return err('${ax.name}');`);
      }
      w(`    return ok({ ${fieldNames} } as ${entity.name});`);
      w('}', '');
    }
  }

  if (valueList.length > 0) {
    w('// ── Value Objects ────────────────────────────────────────────');
    for (const entity of valueList) {
      const ctx: Ctx = { lang: 'ts', program, entity };
      const fields = entity.fields.map(f => `    ${f.name}: ${tsFieldType(f)};`).join('\n');
      w(`type ${entity.name} = Readonly<{`, fields, `}> & { readonly _brand: '${entity.name}' };`, '');
      const factoryArgs = entity.fields.map(f => `${f.name}: ${tsFieldType(f)}`).join(', ');
      const fieldNames  = entity.fields.map(f => f.name).join(', ');
      w(`function create${entity.name}(${factoryArgs}): Result<${entity.name}> {`);
      for (const ax of entity.axioms) {
        const guard = violationExpr(ax.expr, ctx);
        w(`    // rule: ${ax.name}`);
        w(`    if (${guard}) return err('${ax.name}');`);
      }
      w(`    return ok({ ${fieldNames} } as ${entity.name});`);
      w('}', '');
    }
  }

  if (program.globalAxioms.length > 0) {
    w('// ── Global Invariants ─────────────────────────────────────────');
    w('// System-level invariants — enforce in a domain service or repository validator.');
    for (const ax of program.globalAxioms) w(`// • invariant ${ax.name}`);
  }

  return out.join('\n');
}

// ─── Python Generator ─────────────────────────────────────────────────────────

export function generatePython(program: Program): string {
  const out: string[] = [];
  const w = (...lines: string[]) => out.push(...lines);
  const hasUUID = program.entities.some(e => e.fields.some(f => f.type.kind === 'primitive' && f.type.name === 'UUID'));

  w(
    '# Generated by Logic Hub — FOL Specification Editor',
    '# Python 3.10+ · Rich Domain Model',
    '# DomainError · frozen dataclass · entities: identity by id · values: structural equality',
    '',
    'from __future__ import annotations',
    'from enum import Enum, auto',
    'from dataclasses import dataclass',
    'from typing import FrozenSet',
    ...(hasUUID ? ['import uuid'] : []),
    '',
    '',
    '# ── Domain Error ──────────────────────────────────────────────────',
    'class DomainError(Exception):',
    '    def __init__(self, rule: str) -> None:',
    '        super().__init__(f"Domain rule violated: {rule}")',
    '        self.rule = rule',
    '',
  );

  if (program.sorts.length > 0) {
    w('# ── Sorts ────────────────────────────────────────────────────────');
    for (const sort of program.sorts) {
      w(`class ${sort.name}(Enum):`);
      for (const v of sort.variants) w(`    ${v} = auto()`);
      w('');
    }
  }

  const entityList = program.entities.filter(e => e.kind === 'entity');
  const valueList  = program.entities.filter(e => e.kind === 'value');

  if (entityList.length > 0) {
    w('# ── Entities (identity by id field) ──────────────────────────────');
    for (const entity of entityList) {
      const ctx: Ctx = { lang: 'python', program, entity };
      const idField = findIdField(entity);
      w('@dataclass(eq=False, frozen=True)');
      w(`class ${entity.name}:`);
      for (const f of entity.fields) w(`    ${f.name}: ${pyFieldType(f)}`);
      if (idField) {
        const idn = idField.name;
        w('');
        w('    def __eq__(self, other: object) -> bool:');
        w(`        return isinstance(other, ${entity.name}) and self.${idn} == other.${idn}`);
        w('');
        w('    def __hash__(self) -> int:');
        w(`        return hash(self.${idn})`);
      }
      w('');
      w('    def __post_init__(self) -> None:');
      if (entity.axioms.length === 0) {
        w('        pass');
      } else {
        for (const ax of entity.axioms) {
          const guard = violationExpr(ax.expr, ctx);
          w(`        # rule: ${ax.name}`);
          w(`        if ${guard}:`);
          w(`            raise DomainError("${ax.name}")`);
        }
      }
      w('');
    }
  }

  if (valueList.length > 0) {
    w('# ── Value Objects (structural equality) ──────────────────────────');
    for (const entity of valueList) {
      const ctx: Ctx = { lang: 'python', program, entity };
      w('@dataclass(frozen=True)');
      w(`class ${entity.name}:`);
      for (const f of entity.fields) w(`    ${f.name}: ${pyFieldType(f)}`);
      if (entity.axioms.length > 0) {
        w('');
        w('    def __post_init__(self) -> None:');
        for (const ax of entity.axioms) {
          const guard = violationExpr(ax.expr, ctx);
          w(`        # rule: ${ax.name}`);
          w(`        if ${guard}:`);
          w(`            raise DomainError("${ax.name}")`);
        }
      }
      w('');
    }
  }

  if (program.globalAxioms.length > 0) {
    w('# ── Global Invariants ─────────────────────────────────────────────');
    w('# System-level invariants — enforce in a domain service.');
    for (const ax of program.globalAxioms) w(`# • invariant ${ax.name}`);
  }

  return out.join('\n');
}

export function generate(lang: Lang, program: Program): string {
  if (lang === 'java')   return generateJava(program);
  if (lang === 'ts')     return generateTS(program);
  return generatePython(program);
}

export function axiomSummary(ax: Axiom, lang: Lang, program: Program, entity: Entity | null): string {
  const ctx: Ctx = { lang, program, entity };
  return violationExpr(ax.expr, ctx);
}

// ─── Test Codegen from Fixtures ───────────────────────────────────────────────

function fieldValueToJava(v: FieldValue, _fieldName: string, program: Program): string {
  if (v instanceof Set) {
    const items = [...v].map(item => {
      const sort = program.sorts.find(s => s.variants.includes(item));
      return sort ? `new ${cap(item)}()` : `"${item}"`;
    }).join(', ');
    return `java.util.Set.of(${items})`;
  }
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number') return String(v);
  const sort = program.sorts.find(s => s.variants.includes(String(v)));
  if (sort) return `new ${cap(String(v))}()`;
  return `"${v}"`;
}

function fieldValueToTS(v: FieldValue, program: Program): string {
  if (v instanceof Set) {
    const items = [...v].map(item => `'${item}'`).join(', ');
    return `new Set([${items}])`;
  }
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number') return String(v);
  const sort = program.sorts.find(s => s.variants.includes(String(v)));
  if (sort) return `'${v}'`;
  return `'${v}'`;
}

function fieldValueToPy(v: FieldValue, program: Program): string {
  if (v instanceof Set) {
    const items = [...v].map(item => {
      const sort = program.sorts.find(s => s.variants.includes(item));
      return sort ? `${sort.name}.${item}` : `"${item}"`;
    }).join(', ');
    return `frozenset({${items}})`;
  }
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'number') return String(v);
  const sort = program.sorts.find(s => s.variants.includes(String(v)));
  if (sort) return `${sort.name}.${v}`;
  return `"${v}"`;
}

export function generateTests(lang: Lang, fixtures: Fixture[], program: Program): string {
  if (!fixtures.length) return `// No fixtures defined.\n// Add fixture blocks to your spec to generate tests.`;
  if (lang === 'java')   return generateJavaTests(fixtures, program);
  if (lang === 'ts')     return generateTSTests(fixtures, program);
  return generatePythonTests(fixtures, program);
}

function generateJavaTests(fixtures: Fixture[], program: Program): string {
  const out: string[] = [];
  const w = (...lines: string[]) => out.push(...lines);
  w(
    '// Generated by Logic Hub — fixture tests',
    '// Java 17+ · JUnit 5',
    '',
    'import org.junit.jupiter.api.Test;',
    'import static org.junit.jupiter.api.Assertions.*;',
    '',
    'class DomainTests {',
  );
  for (const fx of fixtures) {
    w('', `    // fixture: ${fx.name}`);
    for (const exp of fx.expects) {
      const inst = fx.instances.find(i => i.varName === exp.varName);
      if (!inst) continue;
      const entity = program.entities.find(e => e.name === inst.entityName);
      if (!entity) continue;
      const methodName = exp.kind === 'expect_ok'
        ? `${fx.name}_${exp.varName}_is_valid`
        : `${fx.name}_${exp.varName}_violates_${exp.ruleName}`;
      w(`    @Test`);
      w(`    void ${methodName}() {`);
      for (const dep of fx.instances) {
        const fields = Object.entries(dep.fields)
          .filter(([k]) => !k.includes('.'))
          .map(([k, v]) => fieldValueToJava(v, k, program)).join(', ');
        w(`        var ${dep.varName} = ${dep.entityName}.create(${fields});`);
      }
      if (exp.kind === 'expect_ok') {
        w(`        assertDoesNotThrow(() -> ${exp.varName});`);
      } else {
        w(`        // expects rule '${exp.ruleName}' to fire`);
        const refFields = Object.entries(inst.fields)
          .filter(([k]) => !k.includes('.'))
          .map(([k, v]) => fieldValueToJava(v, k, program)).join(', ');
        w(`        var ex = assertThrows(DomainException.class, () ->`);
        w(`            ${inst.entityName}.create(${refFields}));`);
        w(`        assertEquals("${exp.ruleName}", ex.getRule());`);
      }
      w('    }');
    }
  }
  w('}');
  return out.join('\n');
}

function generateTSTests(fixtures: Fixture[], program: Program): string {
  const out: string[] = [];
  const w = (...lines: string[]) => out.push(...lines);
  w(
    '// Generated by Logic Hub — fixture tests',
    '// TypeScript · Vitest',
    '',
    "import { describe, test, expect } from 'vitest';",
    "// import your generated factories here",
    '',
  );
  for (const fx of fixtures) {
    w(`describe('${fx.name}', () => {`);
    for (const exp of fx.expects) {
      const inst = fx.instances.find(i => i.varName === exp.varName);
      if (!inst) continue;
      const label = exp.kind === 'expect_ok'
        ? `${exp.varName} is valid`
        : `${exp.varName} violates rule '${exp.ruleName}'`;
      w(`    test('${label}', () => {`);
      for (const dep of fx.instances) {
        const fields = Object.entries(dep.fields)
          .filter(([k]) => !k.includes('.'))
          .map(([, v]) => fieldValueToTS(v, program)).join(', ');
        w(`        const ${dep.varName} = create${dep.entityName}(${fields});`);
      }
      if (exp.kind === 'expect_ok') {
        w(`        expect(${exp.varName}.ok).toBe(true);`);
      } else {
        w(`        expect(${exp.varName}.ok).toBe(false);`);
        w(`        if (!${exp.varName}.ok) expect(${exp.varName}.error.rule).toBe('${exp.ruleName}');`);
      }
      w('    });');
    }
    w('});', '');
  }
  return out.join('\n');
}

function generatePythonTests(fixtures: Fixture[], program: Program): string {
  const out: string[] = [];
  const w = (...lines: string[]) => out.push(...lines);
  w(
    '# Generated by Logic Hub — fixture tests',
    '# Python 3.10+ · pytest',
    '',
    'import pytest',
    '# from your_module import the generated classes',
    '',
  );
  for (const fx of fixtures) {
    w(`# fixture: ${fx.name}`);
    for (const exp of fx.expects) {
      const inst = fx.instances.find(i => i.varName === exp.varName);
      if (!inst) continue;
      const fnName = exp.kind === 'expect_ok'
        ? `test_${fx.name}_${exp.varName}_is_valid`
        : `test_${fx.name}_${exp.varName}_violates_${exp.ruleName}`;
      w(`def ${fnName}():`);
      for (const dep of fx.instances) {
        const fields = Object.entries(dep.fields)
          .filter(([k]) => !k.includes('.'))
          .map(([k, v]) => `${k}=${fieldValueToPy(v, program)}`).join(', ');
        w(`    ${dep.varName} = ${dep.entityName}(${fields})`);
      }
      if (exp.kind === 'expect_ok') {
        w(`    # no DomainError should be raised`);
        w(`    assert ${exp.varName} is not None`);
      } else {
        w(`    with pytest.raises(DomainError) as exc:`);
        const fields = Object.entries(inst.fields)
          .filter(([k]) => !k.includes('.'))
          .map(([k, v]) => `${k}=${fieldValueToPy(v, program)}`).join(', ');
        w(`        ${inst.entityName}(${fields})`);
        w(`    assert exc.value.rule == "${exp.ruleName}"`);
      }
      w('');
    }
  }
  return out.join('\n');
}
