import React, { useState } from 'react';
import { formatLogicString } from '../tableau';
import { translations, Language } from '../i18n';
import { Info, ChevronRight, FastForward } from 'lucide-react';

type Phase = 'INPUT' | 'WFF_CHECK' | 'QUANT_CHECK' | 'CONN_CHECK' | 'EXPANSION';

export const FirstOrderLogic: React.FC<{ lang: Language }> = ({ lang }) => {
  const t = translations[lang].fol;
  const [formula, setFormula] = useState('Ax P(x)');
  const [domain, setDomain] = useState('a, b, c');
  
  const [phase, setPhase] = useState<Phase>('INPUT');
  const [wffFeedback, setWffFeedback] = useState<{msg: string, isCorrect: boolean} | null>(null);
  const [quantFeedback, setQuantFeedback] = useState<{msg: string, isCorrect: boolean} | null>(null);
  const [connFeedback, setConnFeedback] = useState<{msg: string, isCorrect: boolean} | null>(null);

  const [steps, setSteps] = useState<{ title: string, formula: string }[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const handleVerify = () => {
    setPhase('WFF_CHECK');
    setWffFeedback(null);
  };
  
  const handleWffAnswer = (userSaysYes: boolean) => {
    // Basic logic: Ax P(x) or Ex P(x)
    const f = formula.trim();
    const isWff = f.startsWith('A') || f.startsWith('E');
    if (userSaysYes && isWff) {
      setWffFeedback({ msg: t.wffCorrect, isCorrect: true });
    } else if (userSaysYes && !isWff) {
      setWffFeedback({ msg: t.wffInvalidIncorrect, isCorrect: false });
    } else if (!userSaysYes && !isWff) {
      setWffFeedback({ msg: t.wffInvalidCorrect, isCorrect: true });
    } else {
      setWffFeedback({ msg: t.wffIncorrect, isCorrect: false });
    }
  };

  const getMainQuantifier = () => {
    const f = formula.trim();
    if (f.startsWith('A')) return 'UNIVERSAL';
    if (f.startsWith('E')) return 'EXISTENTIAL';
    return 'NONE';
  };

  const handleQuantAnswer = (answer: string) => {
    const actual = getMainQuantifier();
    if (actual === answer) {
      setQuantFeedback({ msg: t.quantCorrect, isCorrect: true });
    } else {
      setQuantFeedback({ msg: t.quantIncorrect, isCorrect: false });
    }
  };

  const handleConnAnswer = (answer: string) => {
    const q = getMainQuantifier();
    const actual = q === 'UNIVERSAL' ? 'AND' : 'OR';
    if (actual === answer) {
      setConnFeedback({ msg: t.expCorrect, isCorrect: true });
      setTimeout(() => {
        startExpansion();
      }, 1000);
    } else {
      setConnFeedback({ msg: t.expIncorrect, isCorrect: false });
    }
  };

  const startExpansion = () => {
    const q = getMainQuantifier();
    const isUniversal = q === 'UNIVERSAL';
    const varMatch = formula.match(/^[AE]([a-z])/);
    
    if (!varMatch) {
       // Should be caught by WFF, but fallback
       return;
    }
    
    const v = varMatch[1];
    const body = formula.substring(varMatch[0].length).trim();
    
    const elements = domain.split(',').map(d => d.trim()).filter(d => d);
    if (elements.length === 0) return;

    const op = isUniversal ? ' & ' : ' | ';
    const generatedSteps = [];
    
    let currentExp = '';
    
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const inst = body.replace(new RegExp(`\\b${v}\\b`, 'g'), el);
      
      if (i === 0) {
        currentExp = inst;
      } else {
        currentExp = `${currentExp}${op}${inst}`;
      }
      
      generatedSteps.push({
        title: `Instantiate for ${el}`,
        formula: currentExp
      });
    }

    setSteps(generatedSteps);
    setCurrentStep(0);
    setPhase('EXPANSION');
  };

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-8 border-b-2 border-sand-300 pb-4">
        <h1 className="text-3xl font-bold text-sand-800">{t.title}</h1>
        <p className="text-sand-700 mt-2">{t.description}</p>
      </header>

      <div className="bg-white p-6 rounded-xl shadow-md border border-sand-200 mb-8">
        <div className="grid md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block text-sm font-semibold mb-2 text-sand-800">{t.domainLabel}</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => { setDomain(e.target.value); setPhase('INPUT'); }}
              className="w-full px-4 py-2 bg-sand-50 border border-sand-400 rounded focus:ring-2 focus:ring-sand-600"
              placeholder="a, b, c"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2 text-sand-800">{t.formulaLabel}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formula}
                onChange={(e) => { setFormula(e.target.value); setPhase('INPUT'); }}
                className="w-full px-4 py-2 bg-sand-50 border border-sand-400 rounded focus:ring-2 focus:ring-sand-600 font-mono"
                placeholder="Ax P(x)"
              />
              <button onClick={handleVerify} className="px-6 py-2 bg-sand-600 hover:bg-sand-700 text-white font-bold rounded shadow-sm">
                {t.generateBtn}
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-2 text-sm text-sand-600 items-center">
          <Info size={16} />
          <span>{t.syntaxInfo}</span>
        </div>
      </div>

      {phase !== 'INPUT' && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-sand-200 mb-8 animate-in slide-in-from-top-4">
           <h2 className="text-xl font-bold text-sand-800 mb-4">{t.qWellFormed}</h2>
           <div className="flex gap-4 mb-4">
             <button onClick={() => handleWffAnswer(true)} className="px-6 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700">{t.btnYes}</button>
             <button onClick={() => handleWffAnswer(false)} className="px-6 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700">{t.btnNo}</button>
           </div>
           
           {wffFeedback && (
             <div className={`p-4 rounded border ${wffFeedback.isCorrect ? 'bg-green-50 border-green-300 text-green-900' : 'bg-red-50 border-red-300 text-red-900'}`}>
               <strong className="block">{wffFeedback.msg}</strong>
               {wffFeedback.isCorrect && phase === 'WFF_CHECK' && (
                 <button onClick={() => setPhase('QUANT_CHECK')} className="mt-4 px-4 py-2 bg-sand-800 text-white rounded shadow text-sm">{(lang === 'en' ? 'Next: Quantifier Check' : 'Próximo: Checar Quantificador')}</button>
               )}
             </div>
           )}
        </div>
      )}

      {(phase === 'QUANT_CHECK' || phase === 'CONN_CHECK' || phase === 'EXPANSION') && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-sand-200 mb-8 animate-in slide-in-from-top-4">
           <h2 className="text-xl font-bold text-sand-800 mb-4">{t.qMainQuantifier}</h2>
           <div className="flex gap-4 mb-4">
             <button onClick={() => handleQuantAnswer('UNIVERSAL')} className="px-4 py-2 bg-sand-200 text-sand-900 rounded font-bold hover:bg-sand-300">{t.btnUniversal}</button>
             <button onClick={() => handleQuantAnswer('EXISTENTIAL')} className="px-4 py-2 bg-sand-200 text-sand-900 rounded font-bold hover:bg-sand-300">{t.btnExistential}</button>
           </div>
           {quantFeedback && (
             <div className={`p-4 rounded border ${quantFeedback.isCorrect ? 'bg-green-50 border-green-300 text-green-900' : 'bg-red-50 border-red-300 text-red-900'}`}>
               <strong className="block">{quantFeedback.msg}</strong>
               {quantFeedback.isCorrect && phase === 'QUANT_CHECK' && (
                 <button onClick={() => setPhase('CONN_CHECK')} className="mt-4 px-4 py-2 bg-sand-800 text-white rounded shadow text-sm">{(lang === 'en' ? 'Next: Expansion Rule' : 'Próximo: Regra de Expansão')}</button>
               )}
             </div>
           )}
        </div>
      )}

      {(phase === 'CONN_CHECK' || phase === 'EXPANSION') && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-sand-200 mb-8 animate-in slide-in-from-top-4">
           <h2 className="text-xl font-bold text-sand-800 mb-4">{t.qExpansion}</h2>
           <div className="flex gap-4 mb-4">
             <button onClick={() => handleConnAnswer('AND')} className="px-4 py-2 bg-sand-200 text-sand-900 rounded font-bold hover:bg-sand-300">{t.btnAnd}</button>
             <button onClick={() => handleConnAnswer('OR')} className="px-4 py-2 bg-sand-200 text-sand-900 rounded font-bold hover:bg-sand-300">{t.btnOr}</button>
           </div>
           {connFeedback && (
             <div className={`p-4 rounded border ${connFeedback.isCorrect ? 'bg-green-50 border-green-300 text-green-900' : 'bg-red-50 border-red-300 text-red-900'}`}>
               <strong className="block">{connFeedback.msg}</strong>
             </div>
           )}
        </div>
      )}

      {phase === 'EXPANSION' && steps.length > 0 && (
        <div className="bg-white p-8 rounded-xl shadow-md border border-sand-200 animate-in slide-in-from-bottom-4">
          <div className="flex flex-col md:flex-row items-center justify-between mb-8 pb-4 border-b border-sand-200">
            <h2 className="text-xl font-bold text-sand-800">{t.resultTitle}</h2>
            <div className="flex gap-2 mt-4 md:mt-0">
              <button
                onClick={() => setCurrentStep(c => Math.max(0, c - 1))}
                disabled={currentStep === 0}
                className="px-4 py-2 bg-sand-200 text-sand-800 rounded disabled:opacity-50"
              >
                Back
              </button>
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
                {(lang === 'en' ? 'Play All' : 'Reproduzir Todos')} <FastForward size={18}/>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {steps.slice(0, currentStep + 1).map((s, idx) => (
              <div key={idx} className="p-4 bg-sand-50 rounded border border-sand-300 animate-in fade-in slide-in-from-left-4">
                <div className="text-sm font-bold text-sand-500 mb-2">{s.title}</div>
                <div className="font-mono text-lg text-sand-900 bg-white p-3 rounded shadow-sm border border-sand-200">
                  {formatLogicString(s.formula)}
                </div>
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
