import React, { useState } from 'react';
import { formatLogicString } from '../tableau';
import { translations, Language } from '../i18n';
import { CheckCircle2, XCircle, Info, FastForward, PlayCircle } from 'lucide-react';

type Phase = 'INPUT' | 'WFF_CHECK' | 'TREE_BUILD';

// Mock tree specifically for FOL display purposes (since real tableau handles prop logic)
// In a real FOL tableau, we would have a full FOL AST. Here we simulate for pedagogical UI.
interface FolNode {
  id: string;
  formulas: string[];
  step: number;
  children: FolNode[];
  rule?: string;
  closed?: boolean;
}

export const PredicateCalculus: React.FC<{ lang: Language }> = ({ lang }) => {
  const t = translations[lang].predicate;
  const [formula, setFormula] = useState('Ax (P(x) -> Q(x)) & P(a) & ~Q(a)');
  
  const [phase, setPhase] = useState<Phase>('INPUT');
  const [wffFeedback, setWffFeedback] = useState<{msg: string, isCorrect: boolean} | null>(null);

  const [tree, setTree] = useState<FolNode | null>(null);
  const [maxSteps, setMaxSteps] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const [pendingRule, setPendingRule] = useState<{type: 'GAMMA' | 'DELTA', nodeStep: number} | null>(null);
  const [ruleFeedback, setRuleFeedback] = useState<{msg: string, isCorrect: boolean} | null>(null);

  const handleVerify = () => {
    setPhase('WFF_CHECK');
    setWffFeedback(null);
  };

  const handleWffAnswer = (userSaysYes: boolean) => {
    // Basic heuristic: check if it has Ax or Ex
    const hasQuant = formula.includes('Ax') || formula.includes('Ex');
    if (userSaysYes && hasQuant) {
      setWffFeedback({ msg: t.wffCorrect, isCorrect: true });
    } else if (userSaysYes && !hasQuant) {
      setWffFeedback({ msg: t.wffInvalidIncorrect, isCorrect: false });
    } else if (!userSaysYes && !hasQuant) {
      setWffFeedback({ msg: t.wffInvalidCorrect, isCorrect: true });
    } else {
      setWffFeedback({ msg: t.wffIncorrect, isCorrect: false });
    }
  };

  const generateMockTree = () => {
    // For this demonstration, we build a hardcoded tree to show the rules visually
    const root: FolNode = {
      id: 'root',
      formulas: ['Ax (P(x) -> Q(x))', 'P(a)', '~Q(a)'],
      step: 0,
      children: [
        {
          id: '1',
          formulas: ['P(a) -> Q(a)'],
          step: 1, // Gamma rule here
          rule: 'Universal Instantiation (x/a)',
          children: [
            {
              id: '2a',
              formulas: ['~P(a)'],
              step: 2,
              closed: true,
              children: []
            },
            {
              id: '2b',
              formulas: ['Q(a)'],
              step: 2,
              closed: true,
              children: []
            }
          ]
        }
      ]
    };
    
    setTree(root);
    setMaxSteps(3); // steps 0, 1, 2
    setCurrentStep(0);
    setPhase('TREE_BUILD');
    determineNextPendingRule(1); // Check for step 1
  };

  const determineNextPendingRule = (targetStep: number) => {
    if (targetStep === 1) {
      // Step 1 in our mock tree is a Universal Instantiation
      setPendingRule({ type: 'GAMMA', nodeStep: 1 });
    } else if (targetStep === 2) {
       // Just branching, no quantifier rule.
       setPendingRule(null);
    } else {
       setPendingRule(null);
    }
  };

  const handleRuleAnswer = (answer: 'NEW' | 'REUSE') => {
    if (!pendingRule) return;
    
    const isGamma = pendingRule.type === 'GAMMA';
    const isDelta = pendingRule.type === 'DELTA';
    
    if (isGamma && answer === 'REUSE') {
      setRuleFeedback({ msg: t.gammaCorrect, isCorrect: true });
      advanceAfterRule();
    } else if (isGamma && answer === 'NEW') {
      setRuleFeedback({ msg: t.gammaIncorrect, isCorrect: false });
    } else if (isDelta && answer === 'NEW') {
      setRuleFeedback({ msg: t.deltaCorrect, isCorrect: true });
      advanceAfterRule();
    } else if (isDelta && answer === 'REUSE') {
      setRuleFeedback({ msg: t.deltaIncorrect, isCorrect: false });
    }
  };

  const advanceAfterRule = () => {
    setTimeout(() => {
      setRuleFeedback(null);
      setCurrentStep(c => {
        const next = c + 1;
        determineNextPendingRule(next + 1);
        return next;
      });
    }, 1500);
  };

  const playAll = () => {
    if (!tree) return;
    setCurrentStep(maxSteps - 1);
    setPendingRule(null);
  };

  const renderNode = (node: FolNode) => {
    if (node.step > currentStep) return null;

    return (
      <li key={node.id} className="animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col items-center">
          {node.rule && (
             <div className="text-[10px] bg-blue-200 text-blue-900 px-2 py-0.5 rounded-full mb-1 max-w-[200px] leading-tight text-center font-bold shadow-sm">
                {node.rule}
             </div>
          )}
          <div className="bg-white border-2 border-sand-400 rounded-lg p-3 min-w-[120px] text-center shadow-sm relative">
            {node.formulas.map((f, i) => (
              <div key={i} className="font-mono text-sand-900 font-semibold">{formatLogicString(f)}</div>
            ))}
            
            {node.closed && (
              <div className="mt-2 text-red-700 flex flex-col items-center justify-center text-sm font-bold gap-1 animate-in fade-in">
                <div className="flex items-center gap-1"><XCircle size={16} /> {(lang === 'en' ? 'Closed' : 'Fechado')}</div>
              </div>
            )}
          </div>
        </div>
        
        {node.children.length > 0 && (
          <ul>
            {node.children.map(child => renderNode(child))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-8 border-b-2 border-sand-300 pb-4">
        <h1 className="text-3xl font-bold text-sand-800">{t.title}</h1>
        <p className="text-sand-700 mt-2">{t.description}</p>
      </header>

      <div className="bg-white p-6 rounded-xl shadow-md border border-sand-200 mb-8">
        <label className="block text-sm font-semibold mb-2 text-sand-800">{t.formulaLabel}</label>
        <div className="flex gap-4">
          <input
            type="text"
            value={formula}
            onChange={(e) => { setFormula(e.target.value); setPhase('INPUT'); }}
            className="flex-1 px-4 py-2 bg-sand-50 border border-sand-400 rounded focus:outline-none focus:ring-2 focus:ring-sand-600 font-mono"
            placeholder="Ax (P(x) -> Q(x)) & P(a) & ~Q(a)"
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
          />
          <button onClick={handleVerify} className="px-6 py-2 bg-sand-600 hover:bg-sand-700 text-white font-bold rounded shadow-sm flex-shrink-0">
            {t.generateBtn}
          </button>
        </div>
        <div className="mt-4 flex gap-2 text-sm text-sand-600 items-center">
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
                 <button onClick={generateMockTree} className="mt-4 px-4 py-2 bg-sand-800 text-white rounded shadow text-sm">{(lang === 'en' ? 'Start Expansion' : 'Iniciar Expansão')}</button>
               )}
             </div>
           )}
        </div>
      )}

      {phase === 'TREE_BUILD' && tree && (
        <div className="bg-white p-8 rounded-xl shadow-md border border-sand-200 overflow-x-auto relative min-h-[400px]">
          <div className="sticky left-0 flex flex-col md:flex-row items-center justify-between bg-sand-50 p-4 rounded border border-sand-200 mb-8 shadow-sm">
            <div className="font-bold text-sand-800 mb-2 md:mb-0">
              {(lang === 'en' ? 'Step' : 'Passo')} {currentStep + 1} / {maxSteps}
              {currentStep >= maxSteps - 1 && <span className="ml-4 text-green-700">{t.stepCompleted}</span>}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setCurrentStep(c => {
                    const next = c + 1;
                    determineNextPendingRule(next + 1);
                    return next;
                  });
                }}
                disabled={currentStep >= maxSteps - 1 || pendingRule !== null}
                className="flex items-center gap-1 px-4 py-2 bg-sand-600 hover:bg-sand-700 text-white font-bold rounded transition-colors disabled:opacity-50"
              >
                {t.nextStepBtn} <PlayCircle size={18}/>
              </button>
              <button
                onClick={playAll}
                disabled={currentStep >= maxSteps - 1}
                className="flex items-center gap-1 px-4 py-2 bg-sand-800 hover:bg-sand-900 text-white font-bold rounded transition-colors disabled:opacity-50"
              >
                {t.playAllBtn} <FastForward size={18}/>
              </button>
            </div>
          </div>

          {/* INTERACTIVE RULE SELECTOR */}
          {pendingRule && currentStep < maxSteps - 1 && (
            <div className="sticky left-0 bg-blue-50 border border-blue-300 p-4 rounded-xl mb-8 shadow-sm flex flex-col items-center gap-4 animate-in slide-in-from-top-4">
              <h3 className="font-bold text-blue-900 text-lg">
                {pendingRule.type === 'GAMMA' ? t.qRuleGamma : t.qRuleDelta}
              </h3>
              <div className="flex gap-4">
                <button onClick={() => handleRuleAnswer('NEW')} className="px-4 py-2 bg-white text-blue-900 font-bold border-2 border-blue-400 hover:bg-blue-100 rounded shadow-sm">
                  {t.btnNew}
                </button>
                <button onClick={() => handleRuleAnswer('REUSE')} className="px-4 py-2 bg-white text-blue-900 font-bold border-2 border-blue-400 hover:bg-blue-100 rounded shadow-sm">
                  {t.btnReuse}
                </button>
              </div>
              {ruleFeedback && (
                <div className={`p-2 px-4 rounded font-bold ${ruleFeedback.isCorrect ? 'text-green-800 bg-green-100' : 'text-red-800 bg-red-100'}`}>
                  {ruleFeedback.msg}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-center min-w-fit pb-8 tree">
            <ul className="!pt-0">
              {renderNode(tree)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
