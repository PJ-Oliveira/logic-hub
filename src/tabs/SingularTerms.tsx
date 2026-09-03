import React, { useState } from 'react';
import { formatLogicString } from '../tableau';
import { translations, Language } from '../i18n';
import { ChevronRight, FastForward } from 'lucide-react';

type Phase = 'SELECT' | 'ONTOLOGY' | 'TRANSLATION';

export const SingularTerms: React.FC<{ lang: Language }> = ({ lang }) => {
  const t = translations[lang].singularTerms;
  const [selectedExample, setSelectedExample] = useState(t.examples[0].id);
  
  const [phase, setPhase] = useState<Phase>('SELECT');
  const [ontologyFeedback, setOntologyFeedback] = useState<{msg: string, isCorrect: boolean} | null>(null);

  const [steps, setSteps] = useState<{ text: string, type: 'info' | 'formal' }[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const getExampleData = (id: string) => {
    switch(id) {
      case 'socrates':
        return [
          { text: '1. Identify the subject: Socrates (s)', type: 'info' as const },
          { text: '2. Identify the predicate: is mortal (M)', type: 'info' as const },
          { text: '3. Combine: M(s)', type: 'formal' as const }
        ];
      case 'pegasus':
        return [
          { text: '1. Pegasus is not a real object, but a description: P(x)', type: 'info' as const },
          { text: '2. We say it is NOT the case that there exists an x such that P(x)', type: 'info' as const },
          { text: '3. Combine: ~Ex P(x)', type: 'formal' as const }
        ];
      case 'king':
        return [
          { text: '1. There is an x that is King of France: Ex K(x)', type: 'info' as const },
          { text: '2. And for all y, if y is King of France, y is x: Ay (K(y) -> x=y)', type: 'info' as const },
          { text: '3. And x is bald: B(x)', type: 'info' as const },
          { text: '4. Combine: Ex (K(x) & Ay (K(y) -> x=y) & B(x))', type: 'formal' as const }
        ];
      default:
        return [];
    }
  };

  const handleAnalyzeClick = () => {
    setPhase('ONTOLOGY');
    setOntologyFeedback(null);
  };

  const handleOntologyAnswer = (answer: 'PREDICATE' | 'QUANTIFIER') => {
    if (answer === 'QUANTIFIER') {
      setOntologyFeedback({ msg: t.ontologyCorrect, isCorrect: true });
      setTimeout(() => {
        setSteps(getExampleData(selectedExample));
        setCurrentStep(0);
        setPhase('TRANSLATION');
      }, 1500);
    } else {
      setOntologyFeedback({ msg: t.ontologyIncorrect, isCorrect: false });
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-8 border-b-2 border-sand-300 pb-4">
        <h1 className="text-3xl font-bold text-sand-800">{t.title}</h1>
        <p className="text-sand-700 mt-2">{t.description}</p>
      </header>

      <div className="bg-white p-6 rounded-xl shadow-md border border-sand-200 mb-8">
        <label className="block text-sm font-semibold mb-2 text-sand-800">{t.selectExample}</label>
        <div className="flex flex-col md:flex-row gap-4">
          <select 
            value={selectedExample}
            onChange={(e) => {
              setSelectedExample(e.target.value);
              setPhase('SELECT');
            }}
            className="flex-1 px-4 py-2 bg-sand-50 border border-sand-400 rounded focus:ring-2 focus:ring-sand-600 text-lg"
          >
            {t.examples.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.text}</option>
            ))}
          </select>
          <button onClick={handleAnalyzeClick} className="px-6 py-2 bg-sand-600 hover:bg-sand-700 text-white font-bold rounded shadow-sm">
            {t.analyzeBtn}
          </button>
        </div>
      </div>

      {phase !== 'SELECT' && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-sand-200 mb-8 animate-in slide-in-from-top-4">
           <h2 className="text-xl font-bold text-sand-800 mb-4">{t.qOntology}</h2>
           <div className="flex gap-4 mb-4">
             <button onClick={() => handleOntologyAnswer('PREDICATE')} className="px-4 py-2 bg-white border-2 border-blue-400 text-blue-900 rounded font-bold hover:bg-blue-50">{t.btnPredicate}</button>
             <button onClick={() => handleOntologyAnswer('QUANTIFIER')} className="px-4 py-2 bg-white border-2 border-blue-400 text-blue-900 rounded font-bold hover:bg-blue-50">{t.btnQuantifier}</button>
           </div>
           
           {ontologyFeedback && (
             <div className={`p-4 rounded border ${ontologyFeedback.isCorrect ? 'bg-green-50 border-green-300 text-green-900' : 'bg-red-50 border-red-300 text-red-900'}`}>
               <strong className="block">{ontologyFeedback.msg}</strong>
             </div>
           )}
        </div>
      )}

      {phase === 'TRANSLATION' && steps.length > 0 && (
        <div className="bg-white p-8 rounded-xl shadow-md border border-sand-200 animate-in slide-in-from-bottom-4">
          <div className="flex flex-col md:flex-row items-center justify-between mb-8 pb-4 border-b border-sand-200">
            <h2 className="text-xl font-bold text-sand-800">{lang === 'en' ? 'Step' : 'Passo'} {currentStep + 1} / {steps.length}</h2>
            <div className="flex gap-2 mt-4 md:mt-0">
              <button
                onClick={() => setCurrentStep(c => Math.min(steps.length - 1, c + 1))}
                disabled={currentStep >= steps.length - 1}
                className="flex items-center gap-1 px-4 py-2 bg-sand-600 hover:bg-sand-700 text-white font-bold rounded disabled:opacity-50"
              >
                {t.nextStepBtn} <ChevronRight size={18}/>
              </button>
              <button
                onClick={() => setCurrentStep(steps.length - 1)}
                disabled={currentStep >= steps.length - 1}
                className="flex items-center gap-1 px-4 py-2 bg-sand-800 hover:bg-sand-900 text-white font-bold rounded disabled:opacity-50"
              >
                {t.playAllBtn} <FastForward size={18}/>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {steps.slice(0, currentStep + 1).map((s, idx) => (
              <div key={idx} className={`p-4 rounded border animate-in fade-in slide-in-from-left-4 ${s.type === 'formal' ? 'bg-sand-800 border-sand-900 text-white' : 'bg-sand-50 border-sand-300 text-sand-900'}`}>
                {s.type === 'formal' ? (
                  <div className="font-mono text-xl font-bold text-center py-2">{formatLogicString(s.text)}</div>
                ) : (
                  <div className="font-medium">{formatLogicString(s.text)}</div>
                )}
              </div>
            ))}
            
            {currentStep === steps.length - 1 && (
              <div className="mt-8 p-4 bg-green-50 text-green-800 font-bold rounded-lg border border-green-200 text-center animate-in zoom-in">
                {t.stepCompleted}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
