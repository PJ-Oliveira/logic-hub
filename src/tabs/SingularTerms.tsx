import React, { useState } from 'react';
import { ChevronRight, FastForward, RotateCcw } from 'lucide-react';
import { Language } from '../i18n';
import { translations } from '../i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

type ExampleId = 'socrates' | 'pegasus' | 'king';
type StepKind = 'info' | 'formal';
type Step = { en: string; pt: string; kind: StepKind };

// ─── Example data ─────────────────────────────────────────────────────────────

const STEPS: Record<ExampleId, Step[]> = {
  socrates: [
    { kind: 'info',   en: '1. "Socrates" is a proper name — it rigidly designates one individual.', pt: '1. "Sócrates" é um nome próprio — designa rigidamente um indivíduo.' },
    { kind: 'info',   en: '2. Logical subject: Socrates → nominal constant s', pt: '2. Sujeito lógico: Sócrates → constante nominal s' },
    { kind: 'info',   en: '3. "is mortal" is the logical predicate → propositional function M(x)', pt: '3. "é mortal" é o predicado lógico → função proposicional M(x)' },
    { kind: 'info',   en: '4. Substituting s into M(x):', pt: '4. Substituindo s em M(x):' },
    { kind: 'formal', en: 'M(s)', pt: 'M(s)' },
  ],
  pegasus: [
    { kind: 'info',   en: '1. "Pegasus" behaves grammatically like a proper name, but names no real object.', pt: '1. "Pégaso" comporta-se gramaticalmente como nome próprio, mas não nomeia objeto real.' },
    { kind: 'info',   en: '2. Key Frege/Russell insight: "existence" is NOT a predicate applied to an object.', pt: '2. Intuição central de Frege/Russell: "existência" NÃO é predicado aplicado a objeto.' },
    { kind: 'info',   en: '3. Existence is a quantifier over concepts: ∃x P(x) asks if the concept P has instances.', pt: '3. Existência é quantificador sobre conceitos: ∃x P(x) pergunta se o conceito P tem instâncias.' },
    { kind: 'info',   en: '4. "Pegasus does not exist" = "no x satisfies the concept of being Pegasus":', pt: '4. "Pégaso não existe" = "nenhum x satisfaz o conceito de ser Pégaso":' },
    { kind: 'formal', en: '¬∃x P(x)', pt: '¬∃x P(x)' },
  ],
  king: [
    { kind: 'info',   en: '1. "The present king of France" — a definite description. France has no king.', pt: '1. "O atual rei da França" — uma descrição definida. A França não tem rei.' },
    { kind: 'info',   en: '2. Russell: "the F is G" is not a simple predication. It unpacks into three conditions:', pt: '2. Russell: "o F é G" não é predicação simples. Desdobra-se em três condições:' },
    { kind: 'info',   en: '3. (i) Existence: there is at least one x that is king → ∃x K(x)', pt: '3. (i) Existência: existe pelo menos um x que é rei → ∃x K(x)' },
    { kind: 'info',   en: '4. (ii) Uniqueness: that x is the only one → ∀y (K(y) → y = x)', pt: '4. (ii) Unicidade: esse x é o único → ∀y (K(y) → y = x)' },
    { kind: 'info',   en: '5. (iii) Predication: x is bald → C(x)', pt: '5. (iii) Predicação: x é careca → C(x)' },
    { kind: 'info',   en: '6. Combining all three conditions:', pt: '6. Combinando as três condições:' },
    { kind: 'formal', en: '∃x (K(x) ∧ ∀y (K(y) → y=x) ∧ C(x))', pt: '∃x (K(x) ∧ ∀y (K(y) → y=x) ∧ C(x))' },
  ],
};

// ─── Component ────────────────────────────────────────────────────────────────

export const SingularTerms: React.FC<{ lang: Language }> = ({ lang }) => {
  const t = translations[lang].singularTerms;
  const pt = lang === 'pt';

  const [selectedId, setSelectedId] = useState<ExampleId>('socrates');
  const [currentStep, setCurrentStep] = useState(0);
  const [ontologyAnswer, setOntologyAnswer] = useState<'correct' | 'incorrect' | null>(null);

  const steps = STEPS[selectedId];

  const handleSelect = (id: ExampleId) => {
    setSelectedId(id);
    setCurrentStep(0);
    setOntologyAnswer(null);
  };

  const handleNext = () => setCurrentStep(c => Math.min(steps.length - 1, c + 1));
  const handleAll  = () => setCurrentStep(steps.length - 1);
  const handleReset = () => { setCurrentStep(0); setOntologyAnswer(null); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-sand-900 mb-1">{t.title}</h1>
        <p className="text-sand-600 text-sm">{t.description}</p>
      </div>

      {/* ── Selector ── */}
      <div className="bg-white border border-sand-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-sand-100 bg-sand-50">
          <span className="text-xs font-semibold text-sand-600 uppercase tracking-wide">
            {t.selectExample}
          </span>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(t.examples as { id: string; text: string }[]).map(ex => (
              <button
                key={ex.id}
                onClick={() => handleSelect(ex.id as ExampleId)}
                className={`text-left px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                  selectedId === ex.id
                    ? 'bg-sand-900 text-white border-sand-900'
                    : 'bg-white border-sand-200 text-sand-700 hover:border-sand-400'
                }`}
              >
                {ex.text}
              </button>
            ))}
          </div>

          {/* Steps */}
          <div className="space-y-2">
            {steps.slice(0, currentStep + 1).map((step, i) => (
              <div
                key={i}
                className={`rounded-lg px-3 py-2.5 border text-xs animate-in fade-in ${
                  step.kind === 'formal'
                    ? 'bg-sand-900 border-sand-800 text-white font-mono text-center text-2xl font-bold py-5'
                    : 'bg-sand-50 border-sand-200 text-sand-800'
                }`}
              >
                {pt ? step.pt : step.en}
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-sand-400">
              {pt ? `Passo ${currentStep + 1}/${steps.length}` : `Step ${currentStep + 1}/${steps.length}`}
            </span>
            <button
              onClick={handleNext}
              disabled={currentStep >= steps.length - 1}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-sand-800 hover:bg-sand-900 text-white font-semibold rounded disabled:opacity-40 transition-colors"
            >
              {t.nextStepBtn} <ChevronRight size={13} />
            </button>
            <button
              onClick={handleAll}
              disabled={currentStep >= steps.length - 1}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-sand-600 hover:bg-sand-700 text-white font-semibold rounded disabled:opacity-40 transition-colors"
            >
              {t.playAllBtn} <FastForward size={13} />
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-3 py-1.5 text-xs border border-sand-200 text-sand-600 hover:bg-sand-50 rounded transition-colors"
            >
              <RotateCcw size={11} />
            </button>
          </div>

          {currentStep === steps.length - 1 && (
            <div className="text-xs font-bold text-center px-3 py-2 bg-green-50 text-green-700 border border-green-100 rounded-lg">
              {t.stepCompleted}
            </div>
          )}
        </div>
      </div>

      {/* ── Ontology quiz (Pegasus only) ── */}
      {selectedId === 'pegasus' && currentStep >= steps.length - 1 && (
        <div className="bg-white border border-sand-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-sand-100 bg-sand-50">
            <span className="text-xs font-semibold text-sand-600 uppercase tracking-wide">
              {pt ? 'Questão Filosófica' : 'Philosophical Question'}
            </span>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-sm text-sand-800">{t.qOntology}</p>
            {ontologyAnswer === null ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setOntologyAnswer('incorrect')}
                  className="px-4 py-2 text-xs font-semibold border border-sand-200 rounded text-sand-600 hover:bg-sand-50 transition-colors"
                >
                  {t.btnPredicate}
                </button>
                <button
                  onClick={() => setOntologyAnswer('correct')}
                  className="px-4 py-2 text-xs font-semibold border border-sand-200 rounded text-sand-600 hover:bg-sand-50 transition-colors"
                >
                  {t.btnQuantifier}
                </button>
              </div>
            ) : (
              <div className={`text-xs font-semibold px-4 py-3 rounded-lg border ${
                ontologyAnswer === 'correct'
                  ? 'bg-green-50 text-green-700 border-green-100'
                  : 'bg-red-50 text-red-600 border-red-100'
              }`}>
                {ontologyAnswer === 'correct' ? t.ontologyCorrect : t.ontologyIncorrect}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Quote ── */}
      <div className="bg-sand-50 border-l-4 border-sand-400 px-4 py-3 rounded-r-xl">
        <p className="text-xs italic text-sand-600 leading-relaxed">
          "{pt
            ? 'A designação de um objeto singular pode consistir em várias palavras ou sinais. Para sermos breves, chamaremos de nome próprio toda designação desse gênero.'
            : 'The designation of a singular object may consist of several words or signs. For brevity, we shall call every designation of this kind a proper name.'}"
        </p>
        <p className="text-[10px] font-semibold text-sand-400 mt-1">
          — Gottlob Frege, {pt ? 'Lógica e Filosofia da Linguagem, p. 132' : 'Sense and Reference, p. 132'}
        </p>
      </div>
    </div>
  );
};
