import { useState, useMemo } from 'react';
import { AlertCircle, CheckCircle2, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { parse, exprToString } from '../fol-dsl';
import { generate, type Lang } from '../fol-codegen';
import { type Language } from '../i18n';

const EXAMPLE = `// ── Rich Domain Model in Finite First-Order Logic ──────────────────
// keywords: sort · sig · value · rule · invariant  (see Syntax Reference ↓)

sort Status   = pending | approved | rejected;
sort Role     = admin | user | guest;
sort Currency = USD | EUR | BRL;

sig User {
  id: UUID;
  active: Boolean;
  roles: Set<Role>;
}

sig Order {
  id: UUID;
  owner: User;
  status: Status;

  rule approved_requires_active_owner:
    if status = approved then active(owner);

  rule no_rejected_for_admins:
    if hasRole(owner, admin) then status != rejected;
}

value Money {
  amount: Float;
  currency: Currency;

  rule positive_amount:
    amount > 0;
}

invariant admin_always_active:
  forall u: User. hasRole(u, admin) => u.active = true;`;

type SGEntry = { kw: string; tagline: string; body?: string; syntax?: string; gen?: string };
type SGSection = { title: string; rich?: boolean; entries: SGEntry[] };

const SYNTAX_GUIDE: SGSection[] = [
  {
    title: 'Domain Types', rich: true,
    entries: [
      {
        kw: 'sort',
        tagline: 'Finite closed enum — all variants known at compile time',
        body: 'A named set of possible values. All variants are listed upfront; no others can exist. Use sort names as field types inside sig and value.',
        syntax: 'sort Status = pending | approved | rejected;',
        gen: 'Java: sealed interface + record per variant\nTS:   type Status = \'pending\' | \'approved\' | \'rejected\'\nPy:   class Status(Enum): pending = auto() ...',
      },
      {
        kw: 'sig',
        tagline: 'FOL signature — entity WITH identity (Alloy-style)',
        body: 'Objects are distinguished by their id field, NOT by content. Two sigs with identical data but different ids are different entities. Rules inside run at construction — violation rejects the object.',
        syntax: 'sig Order {\n  id: UUID;\n  owner: User;\n  status: Status;\n\n  rule r: if status = approved then active(owner);\n}',
        gen: 'Java: public final class + private constructor + static create() + DomainException\nTS:   type T = Readonly<{...}> & { _brand } + createT(): Result<T, DomainError>\nPy:   @dataclass(eq=False, frozen=True) + __eq__/__hash__ by id field',
      },
      {
        kw: 'value',
        tagline: 'Value Object — NO identity, structural equality',
        body: 'Two instances with the same fields are always equal, regardless of where they came from. No id field needed. Rules run at construction the same way as sig. Use for: Money, Coordinates, Email, Measurement — things defined purely by their content.',
        syntax: 'value Money {\n  amount: Float;\n  currency: Currency;\n\n  rule r: amount > 0;\n}',
        gen: 'Java: public record + compact constructor + DomainException\nTS:   type T = Readonly<{...}> & { _brand } + createT(): Result<T, DomainError>\nPy:   @dataclass(frozen=True)  (default __eq__ compares all fields)',
      },
    ],
  },
  {
    title: 'Constraints', rich: true,
    entries: [
      {
        kw: 'rule',
        tagline: 'Invariant scoped to a sig/value — enforced at construction time',
        body: 'Violation REJECTS the object — construction fails with DomainException / DomainError. The object simply cannot exist in an invalid state. Use for field ranges, cross-field rules, status-based access constraints.',
        syntax: 'rule no_negative:\n  amount > 0;\n\nrule approved_needs_active_owner:\n  if status = approved then active(owner);',
        gen: 'Java: if (violation) throw new DomainException("rule_name")\nTS:   if (violation) return err(\'rule_name\')\nPy:   if violation: raise DomainError("rule_name")',
      },
      {
        kw: 'invariant',
        tagline: 'Global FOL axiom spanning multiple sig types',
        body: 'Cannot be enforced at construction because it crosses aggregate boundaries. Generated as a documented comment. Implement manually in a domain service, policy object, or repository-level validator.',
        syntax: 'invariant admin_always_active:\n  forall u: User. hasRole(u, admin) => u.active = true;',
        gen: '→ // invariant <name>  comment in all generated files\n→ implement in: DomainService / @Policy / Repository.validate()',
      },
    ],
  },
  {
    title: 'Conditionals & Operators',
    entries: [
      { kw: 'if P then Q;',          tagline: '"Whenever P holds, Q must hold" — readable implication  (≡ P → Q)' },
      { kw: 'if P then Q else R;',   tagline: 'If P enforce Q, otherwise enforce R  (≡ (P → Q) ∧ (¬P → R))' },
      { kw: 'P => Q  /  P → Q',     tagline: 'Implication — ASCII (=>) or Unicode (→)' },
      { kw: 'P & Q  /  P ∧ Q',      tagline: 'Conjunction (AND)' },
      { kw: 'P | Q  /  P ∨ Q',      tagline: 'Disjunction (OR)' },
      { kw: '~P  /  ¬P',            tagline: 'Negation (NOT)' },
    ],
  },
  {
    title: 'Quantifiers',
    entries: [
      { kw: 'forall x: Sort. P(x);', tagline: 'Universal (∀) — P must hold for every object of Sort. Also: ∀x: Sort. P(x)' },
      { kw: 'exists x: Sort. P(x);', tagline: 'Existential (∃) — P holds for some object of Sort. Also: ∃x: Sort. P(x)' },
    ],
  },
  {
    title: 'Atoms',
    entries: [
      { kw: 'field = value',           tagline: 'Equality — also checks sort variant membership  (status = approved)' },
      { kw: 'field != value',          tagline: 'Inequality' },
      { kw: 'amount > 0  /  age >= 18', tagline: 'Numeric comparison  (<  <=  >  >=)' },
      { kw: 'active(owner)',           tagline: 'Boolean predicate — reads a boolean field on a referenced sig' },
      { kw: 'hasRole(user, admin)',    tagline: '2-arg predicate — checks Set<Sort> membership on a referenced sig' },
      { kw: 'u.active = true',         tagline: 'Dot-chain — access a field on a quantified variable' },
    ],
  },
  {
    title: 'Field Types',
    entries: [
      { kw: 'String  Boolean  Int  Float  UUID', tagline: 'Primitive types' },
      { kw: 'Set<SortName>  List<SortName>',     tagline: 'Collections — inner type is a sort or sig name' },
      { kw: 'OtherSig',                          tagline: 'Reference to another sig (related by identity, not embedded)' },
    ],
  },
];

const LANG_LABELS: Record<Lang, string> = { java: 'Java 17+', ts: 'TypeScript', python: 'Python' };
const LANG_EXT: Record<Lang, string>    = { java: 'java', ts: 'ts', python: 'py' };

const RDM_MAP = [
  {
    kw: 'sort',
    fol: 'Finite sort (closed enum)',
    rdm: 'Sealed enum — finite set of named variants, no behaviour',
    java: 'sealed interface + record per variant',
    ts: "type S = 'v1' | 'v2'",
    py: 'class S(Enum): v1 = auto()',
  },
  {
    kw: 'sig',
    fol: 'FOL signature with identity',
    rdm: 'Entity — identity by id field, private constructor, enforced invariants at creation',
    java: 'final class + private ctor + static create() + DomainException',
    ts: 'branded type + createX(): Result<T, DomainError>',
    py: '@dataclass(eq=False, frozen=True) + __eq__/__hash__ by id',
  },
  {
    kw: 'value',
    fol: 'FOL signature without identity',
    rdm: 'Value Object — equality by structure, immutable, enforced at creation',
    java: 'record + compact constructor + DomainException',
    ts: 'branded type + createX(): Result<T, DomainError>',
    py: '@dataclass(frozen=True)  (default eq by all fields)',
  },
  {
    kw: 'rule',
    fol: 'Axiom scoped to a sig/value',
    rdm: 'Invariant enforced at construction — violation = reject the object',
    java: 'if (violation) throw new DomainException("rule")',
    ts: "if (violation) return err('rule')",
    py: 'if violation: raise DomainError("rule")',
  },
  {
    kw: 'invariant',
    fol: 'Global FOL axiom (forall / exists)',
    rdm: 'System-level constraint spanning multiple entities — cannot be enforced at construction',
    java: '// enforce in a domain service or @Invariant checker',
    ts: '// enforce in a domain service or repository validator',
    py: '# enforce in a domain service',
  },
];

const i18n = {
  en: {
    title: 'FOL Specification Editor',
    desc: 'Declare entities, sorts, and axioms in First-Order Logic — then export idiomatic code in Java, TypeScript, or Python.',
    specLabel: 'Specification (FOL DSL)',
    clear: 'Clear',
    reset: 'Example',
    parse: 'Parse',
    copy: 'Copy',
    copied: 'Copied!',
    download: 'Download',
    syntaxRef: 'Syntax reference',
    summaryTitle: 'Parsed model',
    sorts: 'Sorts',
    entities: 'Entities',
    axioms: 'Axioms',
    fields: 'fields',
    noAxioms: 'no axioms',
    globalAxioms: 'Global axioms',
    errTitle: 'Parse errors',
    live: 'Live preview',
    selectLang: 'Target language',
  },
  pt: {
    title: 'Editor de Especificação FOL',
    desc: 'Declare entidades, sorts e axiomas em Lógica de Primeira Ordem — e exporte código idiomático em Java, TypeScript ou Python.',
    specLabel: 'Especificação (DSL FOL)',
    clear: 'Limpar',
    reset: 'Exemplo',
    parse: 'Analisar',
    copy: 'Copiar',
    copied: 'Copiado!',
    download: 'Baixar',
    syntaxRef: 'Referência de sintaxe',
    summaryTitle: 'Modelo analisado',
    sorts: 'Sorts',
    entities: 'Entidades',
    axioms: 'Axiomas',
    fields: 'campos',
    noAxioms: 'sem axiomas',
    globalAxioms: 'Axiomas globais',
    errTitle: 'Erros de análise',
    live: 'Pré-visualização',
    selectLang: 'Linguagem alvo',
  },
};

export function FOLEditor({ lang }: { lang: Language }) {
  const t = i18n[lang];
  const [spec, setSpec] = useState(EXAMPLE);
  const [activeLang, setActiveLang] = useState<Lang>('java');
  const [copied, setCopied] = useState(false);
  const [showSyntax, setShowSyntax] = useState(false);
  const [showRDM, setShowRDM] = useState(false);

  const result = useMemo(() => parse(spec), [spec]);
  const code = useMemo(() => {
    if (result.ok) return generate(activeLang, result.program);
    return '';
  }, [result, activeLang]);

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function handleDownload() {
    const ext = LANG_EXT[activeLang];
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `model.${ext}`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-sand-900 mb-1">{t.title}</h1>
        <p className="text-sand-600 text-sm">{t.desc}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── Left: editor ── */}
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-sand-200 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-sand-100 bg-sand-50">
              <span className="text-xs font-semibold text-sand-600 uppercase tracking-wide">{t.specLabel}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSpec(EXAMPLE)}
                  className="text-xs px-3 py-1 rounded-md border border-sand-200 bg-white text-sand-600 hover:bg-sand-50 transition-colors"
                >
                  {t.reset}
                </button>
                <button
                  onClick={() => setSpec('')}
                  className="text-xs px-3 py-1 rounded-md border border-sand-200 bg-white text-sand-600 hover:bg-sand-50 transition-colors"
                >
                  {t.clear}
                </button>
              </div>
            </div>
            <textarea
              value={spec}
              onChange={e => setSpec(e.target.value)}
              spellCheck={false}
              className="w-full h-72 font-mono text-xs bg-white text-sand-900 p-4 resize-none focus:outline-none leading-relaxed"
              placeholder="// Write your FOL specification here…"
            />
          </div>

          {/* parse status */}
          {result.ok ? (
            <div className="bg-white border border-sand-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={15} className="text-green-600" />
                <span className="text-xs font-semibold text-sand-700 uppercase tracking-wide">{t.summaryTitle}</span>
              </div>
              <div className="space-y-2">
                {result.program.sorts.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-sand-500 uppercase">{t.sorts} </span>
                    <span className="text-xs text-sand-700">
                      {result.program.sorts.map(s => `${s.name} (${s.variants.join(' | ')})`).join(' · ')}
                    </span>
                  </div>
                )}
                {result.program.entities.map(e => (
                  <div key={e.name} className="border border-sand-100 rounded-lg p-3 bg-sand-50">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-sand-800">{e.name}</span>
                      <span className="text-xs text-sand-400">{e.fields.length} {t.fields}</span>
                    </div>
                    {e.axioms.length > 0 ? (
                      <div className="space-y-1 mt-2">
                        {e.axioms.map(ax => (
                          <div key={ax.name} className="text-xs font-mono text-sand-600 bg-white border border-sand-100 rounded px-2 py-1">
                            <span className="text-sand-400">rule </span>
                            <span className="font-semibold">{ax.name}:</span>
                            {' '}{exprToString(ax.expr)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-sand-400 italic">{t.noAxioms}</span>
                    )}
                  </div>
                ))}
                {result.program.globalAxioms.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-sand-500 uppercase">{t.globalAxioms} </span>
                    <div className="mt-1 space-y-1">
                      {result.program.globalAxioms.map(ax => (
                        <div key={ax.name} className="text-xs font-mono text-sand-600 bg-sand-50 border border-sand-100 rounded px-2 py-1">
                          <span className="text-sand-400">axiom </span>
                          <span className="font-semibold">{ax.name}:</span>
                          {' '}{exprToString(ax.expr)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={15} className="text-red-500" />
                <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">{t.errTitle}</span>
              </div>
              <div className="space-y-1">
                {result.errors.map((err, i) => (
                  <div key={i} className="text-xs font-mono text-red-700">
                    <span className="font-semibold">Line {err.line}:</span> {err.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FOL → RDM mapping */}
          <div className="bg-white border border-sand-200 rounded-xl overflow-hidden shadow-sm">
            <button
              onClick={() => setShowRDM(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-sand-600 uppercase tracking-wide hover:bg-sand-50 transition-colors"
            >
              FOL → Rich Domain Model mapping
              {showRDM ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showRDM && (
              <div className="border-t border-sand-100 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-sand-50 border-b border-sand-100">
                      <th className="px-3 py-2 text-left font-bold text-sand-500 whitespace-nowrap">Keyword</th>
                      <th className="px-3 py-2 text-left font-bold text-sand-500">FOL meaning</th>
                      <th className="px-3 py-2 text-left font-bold text-sand-500">RDM role</th>
                      <th className="px-3 py-2 text-left font-bold text-sand-500">Java</th>
                      <th className="px-3 py-2 text-left font-bold text-sand-500">TypeScript</th>
                      <th className="px-3 py-2 text-left font-bold text-sand-500">Python</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RDM_MAP.map(row => (
                      <tr key={row.kw} className="border-b border-sand-50 last:border-0 align-top">
                        <td className="px-3 py-2 font-bold text-sand-800 font-mono whitespace-nowrap">{row.kw}</td>
                        <td className="px-3 py-2 text-sand-600">{row.fol}</td>
                        <td className="px-3 py-2 text-sand-700">{row.rdm}</td>
                        <td className="px-3 py-2 font-mono text-sand-600 whitespace-nowrap">{row.java}</td>
                        <td className="px-3 py-2 font-mono text-sand-600 whitespace-nowrap">{row.ts}</td>
                        <td className="px-3 py-2 font-mono text-sand-600 whitespace-nowrap">{row.py}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* syntax reference */}
          <div className="bg-white border border-sand-200 rounded-xl overflow-hidden shadow-sm">
            <button
              onClick={() => setShowSyntax(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-sand-600 uppercase tracking-wide hover:bg-sand-50 transition-colors"
            >
              {t.syntaxRef}
              {showSyntax ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showSyntax && (
              <div className="px-4 pb-5 border-t border-sand-100 space-y-5 mt-1">
                {SYNTAX_GUIDE.map(sec => (
                  <div key={sec.title}>
                    <div className="text-[10px] font-bold text-sand-400 uppercase tracking-widest mt-4 mb-2">
                      {sec.title}
                    </div>
                    {sec.rich ? (
                      <div className="space-y-3">
                        {sec.entries.map(e => (
                          <div key={e.kw} className="border border-sand-200 rounded-lg overflow-hidden">
                            <div className="flex items-baseline gap-3 px-3 py-2 bg-sand-50 border-b border-sand-100">
                              <span className="font-mono font-bold text-sand-900 text-xs whitespace-nowrap">{e.kw}</span>
                              <span className="text-xs text-sand-500 leading-snug">{e.tagline}</span>
                            </div>
                            {e.body && (
                              <p className="text-xs text-sand-600 px-3 pt-2 pb-0 leading-relaxed">{e.body}</p>
                            )}
                            {e.syntax && (
                              <pre className="text-xs font-mono text-sand-800 bg-sand-50 mx-3 mt-2 rounded px-2 py-1.5 leading-relaxed border border-sand-100 whitespace-pre-wrap">{e.syntax}</pre>
                            )}
                            {e.gen && (
                              <pre className="text-xs font-mono text-sand-500 bg-white mx-3 mt-1.5 mb-2 rounded px-2 py-1.5 leading-relaxed border border-sand-100 whitespace-pre-wrap">{e.gen}</pre>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <table className="w-full text-xs">
                        <tbody>
                          {sec.entries.map(e => (
                            <tr key={e.kw} className="border-b border-sand-50 last:border-0">
                              <td className="py-1.5 pr-3 font-mono font-semibold text-sand-700 whitespace-nowrap align-top w-56">{e.kw}</td>
                              <td className="py-1.5 text-sand-500 leading-snug">{e.tagline}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: generated code ── */}
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-sand-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
            {/* lang tabs */}
            <div className="flex items-center border-b border-sand-100 bg-sand-50">
              {(Object.entries(LANG_LABELS) as [Lang, string][]).map(([l, label]) => (
                <button
                  key={l}
                  onClick={() => setActiveLang(l)}
                  className={`px-5 py-3 text-xs font-semibold transition-colors border-b-2 ${
                    activeLang === l
                      ? 'border-sand-700 text-sand-900 bg-white'
                      : 'border-transparent text-sand-400 hover:text-sand-700'
                  }`}
                >
                  {label}
                </button>
              ))}
              <div className="flex-1" />
              {result.ok && (
                <div className="flex gap-1 px-3">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-sand-200 bg-white text-sand-600 hover:bg-sand-50 transition-colors"
                  >
                    {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                    {copied ? t.copied : t.copy}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="text-xs px-3 py-1.5 rounded-md bg-sand-900 text-white hover:bg-sand-800 transition-colors"
                  >
                    {t.download}
                  </button>
                </div>
              )}
            </div>

            {/* code output */}
            <div className="overflow-auto" style={{ background: '#3a2611', minHeight: '420px' }}>
              {result.ok ? (
                <pre className="text-xs font-mono p-5 leading-relaxed whitespace-pre-wrap break-words" style={{ color: '#faf0e6' }}>
                  {code}
                </pre>
              ) : (
                <div className="flex items-center justify-center h-64 text-sand-500 text-xs">
                  Fix parse errors to see generated code.
                </div>
              )}
            </div>
          </div>

          {/* quick reference cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { lang: 'java' as Lang, label: 'Java 17+', desc: 'final class · private ctor · static factory · DomainException' },
              { lang: 'ts'   as Lang, label: 'TypeScript', desc: 'Result<T, DomainError> · branded types · never throw' },
              { lang: 'python' as Lang, label: 'Python', desc: 'DomainError · frozen dataclass · identity by id' },
            ].map(({ lang: l, label, desc }) => (
              <button
                key={l}
                onClick={() => setActiveLang(l)}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  activeLang === l
                    ? 'bg-sand-900 text-white border-sand-900'
                    : 'bg-white border-sand-200 text-sand-700 hover:border-sand-400'
                }`}
              >
                <div className={`text-xs font-bold mb-1 ${activeLang === l ? 'text-sand-100' : 'text-sand-800'}`}>{label}</div>
                <div className={`text-xs leading-snug ${activeLang === l ? 'text-sand-300' : 'text-sand-400'}`}>{desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
