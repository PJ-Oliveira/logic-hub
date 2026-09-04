import { useState, useMemo } from 'react';
import { Plus, X, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import {
  checkArgument,
  displayFormula,
  FALLACY_CATALOG,
  VALID_FORMS,
  type FallacyEntry,
  type ValidFormEntry,
} from '../logic/argcheck';
import { type Language } from '../i18n';
import { expandFormula, needsExpansion } from '../logic/folexpand';
import type { ArgumentCheckResult } from '../logic/argcheck';
import { buildTableau, type TableauNode, astToString, parseFormula, formatLogicString, type ASTNode } from '../tableau';

// ─── i18n ─────────────────────────────────────────────────────────────────────

const i18n = {
  en: {
    title: 'Argument Validator',
    subtitle: 'Fallacy Detector',
    desc: 'Enter premises and a conclusion to check argument validity, explore all truth branches, and identify formal fallacies.',
    syntax: 'Syntax: A B P Q — variables | ~ ¬ — NOT | & ∧ — AND | | ∨ — OR | -> → — IMPLIES',
    premises: 'Premises',
    addPremise: 'Add Premise',
    conclusion: 'Conclusion',
    placeholderPremise: 'e.g. A -> B',
    placeholderConclusion: 'e.g. A',
    noInput: 'Enter at least one premise and a conclusion.',
    valid: 'VALID ARGUMENT',
    invalid: 'INVALID ARGUMENT',
    validDesc: 'In every row where all premises are true, the conclusion is also true.',
    invalidDesc: 'Found {n} row(s) where all premises are true but the conclusion is false.',
    fallacyDetected: 'Fallacy detected',
    validFormDetected: 'Valid form recognized',
    circular: 'Circular (valid but trivial)',
    unknownPattern: 'No named pattern matched.',
    counterexamples: 'Counterexample(s)',
    ceRow: 'All premises true, conclusion FALSE',
    tableTitle: 'Truth Table — All Branches',
    tableVars: 'Variables',
    tablePremise: 'P',
    tableConclusion: 'C',
    tableStatus: 'Status',
    rowCounterexample: 'Counterexample',
    rowHolds: 'All premises hold',
    rowIrrelevant: 'Premises not all true',
    tableCapped: 'Showing {shown} of {total} rows.',
    catalogTitle: 'Fallacy Reference',
    catalogAll: 'All',
    catalogFormal: 'Formal',
    catalogInformal: 'Informal',
    catalogValid: 'Valid Forms',
    detected: 'Detected',
    form: 'Form',
    example: 'Example',
    parseError: 'Parse error in {field} {index}: {msg}',
    domain: 'Domain',
    domainHint: 'finite elements for ∀/∃ expansion (e.g. a, b, c)',
    expandedTo: 'Expands to',
    folSyntax: '∀/∃ syntax: forall x. P(x), exists x. Q(x,y) — domain elements are the constants',
    varCount: '{n} variables after expansion → {rows} rows',
    tableauProof: 'Tableau Proof',
    tableauProofDesc: 'Refutation proof: assumes all premises true and conclusion false — every branch closes → QED',
    tableauQED: 'All branches closed — QED ✓',
    tableauClosed: 'closed',
    syntaxRef: 'Syntax Reference',
  },
  pt: {
    title: 'Verificador de Argumentos',
    subtitle: 'Detector de Falácias',
    desc: 'Insira premissas e uma conclusão para verificar a validade do argumento, explorar todos os ramos e identificar falácias formais.',
    syntax: 'Sintaxe: A B P Q — variáveis | ~ ¬ — NÃO | & ∧ — E | | ∨ — OU | -> → — IMPLICA',
    premises: 'Premissas',
    addPremise: 'Adicionar Premissa',
    conclusion: 'Conclusão',
    placeholderPremise: 'ex. A -> B',
    placeholderConclusion: 'ex. A',
    noInput: 'Insira ao menos uma premissa e uma conclusão.',
    valid: 'ARGUMENTO VÁLIDO',
    invalid: 'ARGUMENTO INVÁLIDO',
    validDesc: 'Em todas as linhas onde as premissas são verdadeiras, a conclusão também é.',
    invalidDesc: 'Encontrado(s) {n} contra-exemplo(s) onde as premissas são verdadeiras mas a conclusão é falsa.',
    fallacyDetected: 'Falácia detectada',
    validFormDetected: 'Forma válida reconhecida',
    circular: 'Circular (válido mas trivial)',
    unknownPattern: 'Nenhum padrão nomeado encontrado.',
    counterexamples: 'Contra-exemplo(s)',
    ceRow: 'Todas as premissas verdadeiras, conclusão FALSA',
    tableTitle: 'Tabela-Verdade — Todos os Ramos',
    tableVars: 'Variáveis',
    tablePremise: 'P',
    tableConclusion: 'C',
    tableStatus: 'Status',
    rowCounterexample: 'Contra-exemplo',
    rowHolds: 'Premissas satisfeitas',
    rowIrrelevant: 'Premissas nem todas verdadeiras',
    tableCapped: 'Exibindo {shown} de {total} linhas.',
    catalogTitle: 'Referência de Falácias',
    catalogAll: 'Todas',
    catalogFormal: 'Formais',
    catalogInformal: 'Informais',
    catalogValid: 'Formas Válidas',
    detected: 'Detectada',
    form: 'Forma',
    example: 'Exemplo',
    parseError: 'Erro de sintaxe em {field} {index}: {msg}',
    domain: 'Domínio',
    domainHint: 'elementos finitos para expansão ∀/∃ (ex: a, b, c)',
    expandedTo: 'Expande para',
    folSyntax: 'Sintaxe ∀/∃: forall x. P(x), exists x. Q(x,y) — elementos do domínio são as constantes',
    varCount: '{n} variáveis após expansão → {rows} linhas',
    tableauProof: 'Prova em Tableau',
    tableauProofDesc: 'Prova por refutação: assume premissas verdadeiras e conclusão falsa — todos os ramos fecham → QED',
    tableauQED: 'Todos os ramos fechados — QED ✓',
    tableauClosed: 'fechado',
    syntaxRef: 'Referência de Sintaxe',
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const T = (s: boolean) => (
  <span className={`font-mono font-bold text-xs ${s ? 'text-emerald-700' : 'text-red-600'}`}>
    {s ? 'T' : 'F'}
  </span>
);

function FallacyCard({
  entry, lang, detected,
}: {
  entry: FallacyEntry;
  lang: Language;
  detected: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pt = lang === 'pt';
  return (
    <div className={`border rounded-lg overflow-hidden text-xs transition-colors ${
      detected ? 'border-red-300 bg-red-50' : 'border-sand-200 bg-white'
    }`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start justify-between gap-2 px-3 py-2.5 text-left hover:bg-sand-50 transition-colors"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-bold ${detected ? 'text-red-700' : 'text-sand-800'}`}>
              {pt ? entry.name.pt : entry.name.en}
            </span>
            <span className="text-sand-400 italic">{entry.latin}</span>
            {detected && (
              <span className="text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-600 border border-red-200 px-1.5 py-0.5 rounded">
                {pt ? 'Detectada' : 'Detected'}
              </span>
            )}
          </div>
          <div className="font-mono text-sand-500 mt-0.5">{entry.form}</div>
        </div>
        {open ? <ChevronUp size={13} className="shrink-0 mt-0.5 text-sand-400" /> : <ChevronDown size={13} className="shrink-0 mt-0.5 text-sand-400" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-sand-100 pt-2">
          <p className="text-sand-700 leading-relaxed">{pt ? entry.description.pt : entry.description.en}</p>
          <div className="bg-sand-50 border border-sand-200 rounded px-2 py-1.5">
            <span className="text-sand-400 font-semibold">{pt ? 'Exemplo' : 'Example'}:</span>{' '}
            <span className="text-sand-700 italic">{pt ? entry.example.pt : entry.example.en}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ValidFormCard({ entry, lang, detected }: { entry: ValidFormEntry; lang: Language; detected: boolean }) {
  const [open, setOpen] = useState(false);
  const pt = lang === 'pt';
  return (
    <div className={`border rounded-lg overflow-hidden text-xs transition-colors ${
      detected ? 'border-emerald-300 bg-emerald-50' : 'border-sand-200 bg-white'
    }`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start justify-between gap-2 px-3 py-2.5 text-left hover:bg-sand-50 transition-colors"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-bold ${detected ? 'text-emerald-700' : 'text-sand-800'}`}>
              {pt ? entry.name.pt : entry.name.en}
            </span>
            <span className="text-sand-400 italic">{entry.latin}</span>
            {detected && (
              <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">
                {pt ? 'Identificada' : 'Identified'}
              </span>
            )}
          </div>
          <div className="font-mono text-sand-500 mt-0.5">{entry.form}</div>
        </div>
        {open ? <ChevronUp size={13} className="shrink-0 mt-0.5 text-sand-400" /> : <ChevronDown size={13} className="shrink-0 mt-0.5 text-sand-400" />}
      </button>
      {open && (
        <div className="px-3 pb-3 border-t border-sand-100 pt-2">
          <p className="text-sand-700 leading-relaxed text-xs">{pt ? entry.description.pt : entry.description.en}</p>
        </div>
      )}
    </div>
  );
}

// ─── Tableau Proof Tree ───────────────────────────────────────────────────────

function ProofNodeView({ node }: { node: TableauNode }) {
  const fmt = (f: ASTNode) => formatLogicString(astToString(f));
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`border rounded px-2 py-1 text-[10px] font-mono text-center ${
        node.closed ? 'bg-red-50 border-red-200 text-red-800' : 'bg-white border-sand-200 text-sand-800'
      }`} style={{ maxWidth: 240 }}>
        {node.formulas.map((f, i) => (
          <div key={i} className="leading-tight truncate" style={{ maxWidth: 230 }} title={fmt(f)}>{fmt(f)}</div>
        ))}
        {node.closed && <div className="text-red-500 font-bold mt-0.5">✗</div>}
      </div>
      {node.children.length > 0 && (
        <div className={`flex items-start pt-1.5 ${node.children.length > 1 ? 'gap-6' : ''}`}>
          {node.children.map(child => <ProofNodeView key={child.id} node={child} />)}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const MAX_TABLE_ROWS = 64;

type CheckResultExtended = ArgumentCheckResult & {
  varLabels: Record<string, string>;
  expandedPremises: string[];
  expandedConclusion: string;
};

export function ArgumentChecker({ lang }: { lang: Language }) {
  const t = i18n[lang];
  const pt = lang === 'pt';

  const [premises, setPremises] = useState(['A -> B', 'B']);
  const [conclusion, setConclusion] = useState('A');
  const [showCatalog, setShowCatalog] = useState(false);
  const [showSyntaxRef, setShowSyntaxRef] = useState(false);
  const [catalogTab, setCatalogTab] = useState<'formal' | 'informal' | 'valid'>('formal');
  const [domainStr, setDomainStr] = useState('a, b');
  const [showTableau, setShowTableau] = useState(true);

  const domain = useMemo(
    () => domainStr.split(',').map(s => s.trim()).filter(Boolean),
    [domainStr],
  );

  // Per-premise expansion notes (parallel to premises array, null = no expansion)
  const premiseExpansions = useMemo(() =>
    premises.map(p => {
      if (!p.trim() || !needsExpansion(p)) return null;
      const exp = expandFormula(p.trim(), domain);
      return exp.ok && exp.wasExpanded ? exp.displayProp : null;
    }),
  [premises, domain]);

  const conclusionExpansion = useMemo(() => {
    if (!conclusion.trim() || !needsExpansion(conclusion)) return null;
    const exp = expandFormula(conclusion.trim(), domain);
    return exp.ok && exp.wasExpanded ? exp.displayProp : null;
  }, [conclusion, domain]);

  const result = useMemo(() => {
    const nonEmpty = premises.map(p => p.trim()).filter(Boolean);
    if (!nonEmpty.length || !conclusion.trim()) return null;

    const allLabels: Record<string, string> = {};
    const expandedPremises: string[] = [];

    for (let i = 0; i < nonEmpty.length; i++) {
      const exp = expandFormula(nonEmpty[i], domain);
      if (!exp.ok) return { ok: false as const, error: exp.error, field: 'premise' as const, index: i };
      Object.assign(allLabels, exp.labels);
      expandedPremises.push(exp.prop);
    }

    const expConc = expandFormula(conclusion.trim(), domain);
    if (!expConc.ok) return { ok: false as const, error: expConc.error, field: 'conclusion' as const, index: 0 };
    Object.assign(allLabels, expConc.labels);

    const base = checkArgument(expandedPremises, expConc.prop);
    if (!base.ok) return base;
    return { ...base, varLabels: allLabels, expandedPremises, expandedConclusion: expConc.prop } as CheckResultExtended;
  }, [premises, conclusion, domain]);

  function addPremise() { setPremises(p => [...p, '']); }
  function removePremise(i: number) { setPremises(p => p.filter((_, idx) => idx !== i)); }
  function updatePremise(i: number, v: string) { setPremises(p => p.map((x, idx) => idx === i ? v : x)); }

  const res = result?.ok ? (result as CheckResultExtended) : null;
  const vLabel = (v: string) => res?.varLabels?.[v] ?? v;

  const tableauProof = useMemo(() => {
    if (!res?.valid || res.detectedFallacy) return null;
    const premAsts = res.expandedPremises
      .map(p => parseFormula(p))
      .filter((a): a is ASTNode => a !== null);
    const concAst = parseFormula(res.expandedConclusion);
    if (!concAst || premAsts.length === 0) return null;
    const negConc: ASTNode = { type: 'NOT', left: concAst };
    const all: ASTNode[] = [...premAsts, negConc];
    const combined = all.reduce((acc, cur): ASTNode => ({ type: 'AND', left: acc, right: cur }));
    try { return buildTableau(combined); } catch { return null; }
  }, [res]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline gap-3 mb-1">
          <h1 className="text-2xl font-black text-sand-900">{t.title}</h1>
          <span className="text-xs font-semibold text-sand-400 uppercase tracking-wide">{t.subtitle}</span>
        </div>
        <p className="text-sand-600 text-sm">{t.desc}</p>
        <p className="text-sand-400 text-xs mt-1 font-mono">{t.syntax}</p>
      </div>

      {/* ── Input panel ── */}
      <div className="bg-white border border-sand-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-sand-100 bg-sand-50 flex items-center justify-between gap-4 flex-wrap">
          <span className="text-xs font-semibold text-sand-600 uppercase tracking-wide">{t.premises}</span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-sand-500 font-semibold">{t.domain}</span>
            <input
              value={domainStr}
              onChange={e => setDomainStr(e.target.value)}
              placeholder="a, b, c"
              title={t.domainHint}
              className="font-mono text-xs px-2 py-1 border border-sand-200 rounded-lg bg-white text-sand-900 focus:outline-none focus:border-violet-400 w-28 transition-colors"
            />
          </div>
        </div>
        <div className="p-4 space-y-3">
          {premises.map((p, i) => (
            <div key={i} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-sand-400 w-5 shrink-0">P{i + 1}</span>
                <input
                  value={p}
                  onChange={e => updatePremise(i, e.target.value)}
                  placeholder={t.placeholderPremise}
                  className="flex-1 font-mono text-sm px-3 py-2 border border-sand-200 rounded-lg bg-white text-sand-900 focus:outline-none focus:border-sand-400 transition-colors"
                />
                {premises.length > 1 && (
                  <button
                    onClick={() => removePremise(i)}
                    className="p-1.5 rounded-md text-sand-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {premiseExpansions[i] && (
                <div className="ml-7 flex items-start gap-1 text-[10px] font-mono">
                  <span className="text-violet-400 shrink-0">↳</span>
                  <span className="text-violet-600">{premiseExpansions[i]}</span>
                </div>
              )}
            </div>
          ))}
          <button
            onClick={addPremise}
            className="flex items-center gap-1.5 text-xs text-sand-500 hover:text-sand-800 transition-colors px-1"
          >
            <Plus size={13} /> {t.addPremise}
          </button>

          <div className="space-y-0.5 pt-1 border-t border-sand-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-sand-400 w-5 shrink-0">⊢</span>
              <input
                value={conclusion}
                onChange={e => setConclusion(e.target.value)}
                placeholder={t.placeholderConclusion}
                className="flex-1 font-mono text-sm px-3 py-2 border border-sand-200 rounded-lg bg-white text-sand-900 focus:outline-none focus:border-sand-400 transition-colors"
              />
              <div className="w-7 shrink-0" />
            </div>
            {conclusionExpansion && (
              <div className="ml-7 flex items-start gap-1 text-[10px] font-mono">
                <span className="text-violet-400 shrink-0">↳</span>
                <span className="text-violet-600">{conclusionExpansion}</span>
              </div>
            )}
          </div>
          <p className="text-[10px] text-sand-400">{t.conclusion}</p>
          <p className="text-[10px] text-sand-400 italic">{t.folSyntax}</p>
        </div>
      </div>

      {/* ── No input state ── */}
      {!result && (
        <div className="text-center text-xs text-sand-400 py-4">{t.noInput}</div>
      )}

      {/* ── Parse error ── */}
      {result && !result.ok && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700">
          <span className="font-semibold">
            {t.parseError
              .replace('{field}', result.field === 'premise' ? (pt ? 'premissa' : 'premise') : (pt ? 'conclusão' : 'conclusion'))
              .replace('{index}', result.field === 'premise' ? String(result.index + 1) : '')
              .replace('{msg}', result.error)}
          </span>
          <p className="mt-1 text-red-500">{pt ? 'Verifique a sintaxe.' : 'Check the formula syntax.'}</p>
        </div>
      )}

      {/* ── Valid / Invalid verdict ── */}
      {res && (
        <>
          <div className={`rounded-xl p-4 border ${
            res.valid
              ? (res.detectedFallacy ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200')
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {res.valid && !res.detectedFallacy
                ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                : res.valid && res.detectedFallacy
                ? <Info size={18} className="text-amber-600 shrink-0" />
                : <AlertTriangle size={18} className="text-red-500 shrink-0" />
              }
              <span className={`font-black text-base tracking-tight ${
                res.valid && !res.detectedFallacy ? 'text-emerald-800'
                : res.valid ? 'text-amber-800'
                : 'text-red-700'
              }`}>
                {res.valid ? t.valid : t.invalid}
              </span>
            </div>

            <p className={`text-xs mb-3 ${
              res.valid && !res.detectedFallacy ? 'text-emerald-700'
              : res.valid ? 'text-amber-700'
              : 'text-red-600'
            }`}>
              {res.valid
                ? (res.detectedFallacy ? t.circular : t.validDesc)
                : t.invalidDesc.replace('{n}', String(res.counterexamples.length))}
            </p>

            {/* Fallacy / Valid form info */}
            {res.detectedFallacy && (
              <div className={`border rounded-lg p-3 space-y-1.5 ${
                res.valid ? 'bg-amber-100 border-amber-300' : 'bg-red-100 border-red-300'
              }`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${
                    res.valid ? 'text-amber-700' : 'text-red-700'
                  }`}>
                    {res.valid ? t.circular : t.fallacyDetected}:
                  </span>
                  <span className={`text-sm font-bold ${
                    res.valid ? 'text-amber-900' : 'text-red-900'
                  }`}>
                    {pt ? res.detectedFallacy.name.pt : res.detectedFallacy.name.en}
                  </span>
                  <span className="text-xs italic text-sand-500">{res.detectedFallacy.latin}</span>
                </div>
                <div className="font-mono text-xs text-sand-600">{t.form}: {res.detectedFallacy.form}</div>
                <p className="text-xs text-sand-700 leading-relaxed">
                  {pt ? res.detectedFallacy.description.pt : res.detectedFallacy.description.en}
                </p>
                <div className="text-xs text-sand-500 italic border-l-2 border-sand-300 pl-2">
                  {t.example}: {pt ? res.detectedFallacy.example.pt : res.detectedFallacy.example.en}
                </div>
              </div>
            )}

            {res.detectedForm && !res.detectedFallacy && (
              <div className="bg-emerald-100 border border-emerald-300 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    {t.validFormDetected}:
                  </span>
                  <span className="text-sm font-bold text-emerald-900">
                    {pt ? res.detectedForm.name.pt : res.detectedForm.name.en}
                  </span>
                  <span className="text-xs italic text-sand-500">{res.detectedForm.latin}</span>
                </div>
                <div className="font-mono text-xs text-sand-600">{t.form}: {res.detectedForm.form}</div>
                <p className="text-xs text-sand-700 leading-relaxed">
                  {pt ? res.detectedForm.description.pt : res.detectedForm.description.en}
                </p>
              </div>
            )}

            {!res.detectedFallacy && !res.detectedForm && !res.valid && (
              <p className="text-xs text-sand-500 italic">{t.unknownPattern}</p>
            )}
          </div>

          {/* ── Tableau Proof (only for truly valid arguments) ── */}
          {res.valid && !res.detectedFallacy && tableauProof && (
            <div className="bg-white border border-emerald-200 rounded-xl overflow-hidden shadow-sm">
              <button
                onClick={() => setShowTableau(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-emerald-700 uppercase tracking-wide hover:bg-emerald-50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span>{t.tableauProof}</span>
                  <span className="font-normal normal-case text-emerald-500">({tableauProof.maxSteps} {tableauProof.maxSteps === 1 ? 'step' : 'steps'})</span>
                </span>
                {showTableau ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showTableau && (
                <div className="border-t border-emerald-100 p-4 space-y-3">
                  <p className="text-[10px] text-emerald-600 italic">{t.tableauProofDesc}</p>
                  <div className="overflow-x-auto pb-2">
                    <ProofNodeView node={tableauProof.root} />
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-emerald-100">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">{t.tableauQED}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Counterexamples ── */}
          {res.counterexamples.length > 0 && (
            <div className="bg-white border border-red-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-red-100 bg-red-50">
                <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">
                  {t.counterexamples} ({res.counterexamples.length})
                </span>
              </div>
              <div className="p-3 space-y-2">
                {res.counterexamples.map((ce, i) => (
                  <div key={i} className="flex flex-wrap gap-2 items-center text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <div className="flex gap-2 flex-wrap font-mono">
                      {res.variables.map(v => (
                        <span key={v} className={`${ce.assignment[v] ? 'text-emerald-700' : 'text-red-600'}`}>
                          {vLabel(v)}={ce.assignment[v] ? 'T' : 'F'}
                        </span>
                      ))}
                    </div>
                    <span className="text-sand-400">→</span>
                    <span className="text-red-700 font-semibold">{t.ceRow}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Truth Table ── */}
          <div className="bg-white border border-sand-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-sand-100 bg-sand-50 flex items-center justify-between">
              <span className="text-xs font-semibold text-sand-600 uppercase tracking-wide">{t.tableTitle}</span>
              <span className="text-xs text-sand-400">
                {res.rows.length > MAX_TABLE_ROWS
                  ? t.tableCapped.replace('{shown}', String(MAX_TABLE_ROWS)).replace('{total}', String(res.rows.length))
                  : `${res.rows.length} rows`
                }
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-sand-50 border-b border-sand-100">
                    {res.variables.map(v => (
                      <th key={v} className="px-3 py-2 text-center font-bold text-sand-600 whitespace-nowrap">{vLabel(v)}</th>
                    ))}
                    {premises.filter(p => p.trim()).map((p, i) => (
                      <th key={i} className="px-3 py-2 text-center font-bold text-sand-600 whitespace-nowrap border-l border-sand-100">
                        <div className="font-mono font-normal text-sand-400 text-[10px]">{t.tablePremise}{i + 1}</div>
                        <div className="font-mono text-sand-700 text-[10px] max-w-[80px] truncate" title={displayFormula(p)}>
                          {displayFormula(p.trim()).length > 12 ? displayFormula(p.trim()).slice(0, 11) + '…' : displayFormula(p.trim())}
                        </div>
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center font-bold text-sand-600 whitespace-nowrap border-l border-sand-200">
                      <div className="font-mono font-normal text-sand-400 text-[10px]">{t.tableConclusion}</div>
                      <div className="font-mono text-sand-700 text-[10px] max-w-[80px] truncate" title={displayFormula(conclusion)}>
                        {displayFormula(conclusion.trim()).length > 12
                          ? displayFormula(conclusion.trim()).slice(0, 11) + '…'
                          : displayFormula(conclusion.trim())}
                      </div>
                    </th>
                    <th className="px-3 py-2 text-center font-bold text-sand-600 whitespace-nowrap border-l border-sand-200">{t.tableStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {res.rows.slice(0, MAX_TABLE_ROWS).map((row, ri) => {
                    const isCE = row.isCounterexample;
                    const holds = row.allPremisesTrue && !isCE;
                    return (
                      <tr
                        key={ri}
                        className={`border-b border-sand-50 last:border-0 ${
                          isCE ? 'bg-red-50' : holds ? 'bg-emerald-50/40' : ''
                        }`}
                      >
                        {res.variables.map(v => (
                          <td key={v} className="px-3 py-1.5 text-center">{T(row.assignment[v])}</td>
                        ))}
                        {row.premiseVals.map((val, pi) => (
                          <td key={pi} className={`px-3 py-1.5 text-center border-l border-sand-100 ${isCE ? '' : ''}`}>
                            {T(val)}
                          </td>
                        ))}
                        <td className={`px-3 py-1.5 text-center border-l border-sand-200 ${isCE ? 'font-bold' : ''}`}>
                          {T(row.conclusionVal)}
                        </td>
                        <td className="px-3 py-1.5 text-center border-l border-sand-200 whitespace-nowrap">
                          {isCE ? (
                            <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded border border-red-200">
                              ✗ {t.rowCounterexample}
                            </span>
                          ) : holds ? (
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              ✓ {t.rowHolds}
                            </span>
                          ) : (
                            <span className="text-[10px] text-sand-400">
                              ○
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Syntax Reference ── */}
      <div className="bg-white border border-sand-200 rounded-xl overflow-hidden shadow-sm">
        <button
          onClick={() => setShowSyntaxRef(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-sand-600 uppercase tracking-wide hover:bg-sand-50 transition-colors"
        >
          {t.syntaxRef}
          {showSyntaxRef ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showSyntaxRef && (
          <div className="border-t border-sand-100 px-4 pb-5 space-y-5 mt-1">

            {/* Connectives */}
            <div>
              <div className="text-[10px] font-bold text-sand-400 uppercase tracking-widest mt-4 mb-2">Connectives</div>
              <table className="w-full text-xs">
                <tbody>
                  {[
                    ['~ ¬',    'NOT',     'negation',    '~A',        '¬A'],
                    ['& ∧',    'AND',     'conjunction', 'A & B',     'A ∧ B'],
                    ['| ∨',    'OR',      'disjunction', 'A | B',     'A ∨ B'],
                    ['-> →',   'IMPLIES', 'conditional', 'A -> B',    'A → B'],
                  ].map(([sym, name, desc, ex1, ex2]) => (
                    <tr key={sym} className="border-b border-sand-50 last:border-0">
                      <td className="py-1.5 pr-3 font-mono font-bold text-sand-800 w-16 align-top">{sym}</td>
                      <td className="py-1.5 pr-2 font-semibold text-sand-700 w-20 align-top">{name}</td>
                      <td className="py-1.5 pr-3 text-sand-500 align-top">{desc}</td>
                      <td className="py-1.5 font-mono text-sand-600 align-top whitespace-nowrap">{ex1} &nbsp;·&nbsp; {ex2}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Grouping */}
            <div>
              <div className="text-[10px] font-bold text-sand-400 uppercase tracking-widest mb-2">Grouping</div>
              <table className="w-full text-xs">
                <tbody>
                  <tr>
                    <td className="py-1.5 pr-3 font-mono font-bold text-sand-800 w-36 align-top">(A &amp; B) -&gt; C</td>
                    <td className="py-1.5 text-sand-500">Parentheses control precedence. Precedence (tight→loose): ~ &gt; &amp; &gt; | &gt; →</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Quantifiers & Predicates */}
            <div>
              <div className="text-[10px] font-bold text-sand-400 uppercase tracking-widest mb-2">Quantifiers &amp; Predicates (FOL mode)</div>
              <table className="w-full text-xs">
                <tbody>
                  {[
                    ['forall x. P(x)',   '∀x.P(x)',   'Universal: P holds for every domain element → P(a) ∧ P(b) ∧ …'],
                    ['exists x. P(x)',   '∃x.P(x)',   'Existential: P holds for some domain element → P(a) ∨ P(b) ∨ …'],
                    ['P(a)',             'P(a)',       'Unary predicate — becomes propositional atom Pa'],
                    ['R(a, b)',          'R(a,b)',     'Binary predicate — becomes propositional atom Rab'],
                  ].map(([syn, uni, desc]) => (
                    <tr key={syn} className="border-b border-sand-50 last:border-0">
                      <td className="py-1.5 pr-3 font-mono font-semibold text-sand-700 whitespace-nowrap align-top w-40">{syn}</td>
                      <td className="py-1.5 pr-3 font-mono text-sand-500 align-top w-20">{uni}</td>
                      <td className="py-1.5 text-sand-500 leading-snug">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 text-[10px] text-sand-400 italic">Set the Domain field to the elements you want (e.g. <span className="font-mono not-italic">a, b, c</span>) — quantifiers expand over them.</div>
            </div>

            {/* Classic valid forms */}
            <div>
              <div className="text-[10px] font-bold text-sand-400 uppercase tracking-widest mb-2">Quick Examples — Valid Arguments</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-sand-50 border-b border-sand-100">
                    <th className="px-2 py-1.5 text-left font-bold text-sand-500 w-44">Name</th>
                    <th className="px-2 py-1.5 text-left font-bold text-sand-500">Premises</th>
                    <th className="px-2 py-1.5 text-left font-bold text-sand-500 w-24">Conclusion</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Modus Ponens',            'P → Q,  P',       'Q'],
                    ['Modus Tollens',           'P → Q,  ¬Q',      '¬P'],
                    ['Hypothetical Syllogism',  'P → Q,  Q → R',   'P → R'],
                    ['Disjunctive Syllogism',   'P ∨ Q,  ¬P',      'Q'],
                    ['Constructive Dilemma',    '(P → Q) ∧ (R → S),  P ∨ R', 'Q ∨ S'],
                    ['Absorption',              'P → Q',           'P → (P ∧ Q)'],
                  ].map(([name, prems, conc]) => (
                    <tr key={name} className="border-b border-sand-50 last:border-0">
                      <td className="px-2 py-1.5 font-semibold text-sand-700 align-top">{name}</td>
                      <td className="px-2 py-1.5 font-mono text-sand-600 align-top">{prems}</td>
                      <td className="px-2 py-1.5 font-mono text-sand-600 align-top">{conc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Common fallacies */}
            <div>
              <div className="text-[10px] font-bold text-sand-400 uppercase tracking-widest mb-2">Quick Examples — Common Fallacies</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-sand-50 border-b border-sand-100">
                    <th className="px-2 py-1.5 text-left font-bold text-sand-500 w-44">Name</th>
                    <th className="px-2 py-1.5 text-left font-bold text-sand-500">Premises</th>
                    <th className="px-2 py-1.5 text-left font-bold text-sand-500 w-24">Conclusion</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Affirming the Consequent', 'P → Q,  Q',  'P'],
                    ['Denying the Antecedent',   'P → Q,  ¬P', '¬Q'],
                    ['Undistributed Middle',     'P → M,  Q → M', 'P → Q'],
                  ].map(([name, prems, conc]) => (
                    <tr key={name} className="border-b border-sand-50 last:border-0">
                      <td className="px-2 py-1.5 font-semibold text-red-700 align-top">{name}</td>
                      <td className="px-2 py-1.5 font-mono text-sand-600 align-top">{prems}</td>
                      <td className="px-2 py-1.5 font-mono text-sand-600 align-top">{conc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}
      </div>

      {/* ── Fallacy Catalog ── */}
      <div className="bg-white border border-sand-200 rounded-xl overflow-hidden shadow-sm">
        <button
          onClick={() => setShowCatalog(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-sand-600 uppercase tracking-wide hover:bg-sand-50 transition-colors"
        >
          {t.catalogTitle}
          {showCatalog ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showCatalog && (
          <div className="border-t border-sand-100 p-4 space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 bg-sand-100 rounded-lg p-1 text-xs">
              {(['formal', 'informal', 'valid'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setCatalogTab(tab)}
                  className={`flex-1 py-1.5 rounded-md font-semibold transition-colors ${
                    catalogTab === tab ? 'bg-white text-sand-900 shadow-sm' : 'text-sand-500 hover:text-sand-700'
                  }`}
                >
                  {tab === 'formal' ? t.catalogFormal
                    : tab === 'informal' ? t.catalogInformal
                    : t.catalogValid}
                </button>
              ))}
            </div>

            {/* Cards */}
            <div className="space-y-2">
              {catalogTab === 'valid'
                ? VALID_FORMS.map(entry => (
                    <ValidFormCard
                      key={entry.id}
                      entry={entry}
                      lang={lang}
                      detected={res?.detectedForm?.id === entry.id && !res.detectedFallacy}
                    />
                  ))
                : FALLACY_CATALOG.filter(f => f.category === catalogTab).map(entry => (
                    <FallacyCard
                      key={entry.id}
                      entry={entry}
                      lang={lang}
                      detected={res?.detectedFallacy?.id === entry.id}
                    />
                  ))
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
