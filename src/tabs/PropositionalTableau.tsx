import React, { useState } from 'react';
import { translations, Language } from '../i18n';
import { parseFormula, buildTableau, TableauNode, astToString, ASTNode, formatLogicString } from '../tableau';
import { CheckCircle2, XCircle, Info, ChevronRight, FastForward, PlayCircle } from 'lucide-react';

type Phase = 'INPUT' | 'WFF_CHECK' | 'MAIN_CONNECTIVE' | 'TREE_BUILD';

export const PropositionalTableau: React.FC<{ lang: Language }> = ({ lang }) => {
  const t = translations[lang].propTableau;
  const [input, setInput] = useState('A & (B | ~C)');
  
  const [phase, setPhase] = useState<Phase>('INPUT');
  const [isValidAST, setIsValidAST] = useState<boolean>(false);
  const [ast, setAst] = useState<ASTNode | null>(null);
  
  const [wffFeedback, setWffFeedback] = useState<{msg: string, isCorrect: boolean} | null>(null);
  const [connFeedback, setConnFeedback] = useState<{msg: string, isCorrect: boolean} | null>(null);
  
  const [tableauResult, setTableauResult] = useState<{ root: TableauNode, maxSteps: number } | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const [ruleFeedback, setRuleFeedback] = useState<{msg: string, isCorrect: boolean} | null>(null);
  const [pendingExpansion, setPendingExpansion] = useState<{formula: string, type: string, nodeType: string} | null>(null);

  const handleVerify = () => {
    const parsed = parseFormula(input);
    setAst(parsed);
    setIsValidAST(parsed !== null);
    setPhase('WFF_CHECK');
    setWffFeedback(null);
  };

  const handleWffAnswer = (userSaysYes: boolean) => {
    if (userSaysYes && isValidAST) {
      setWffFeedback({ msg: t.wffCorrect, isCorrect: true });
    } else if (userSaysYes && !isValidAST) {
      setWffFeedback({ msg: t.wffInvalidIncorrect, isCorrect: false });
    } else if (!userSaysYes && !isValidAST) {
      setWffFeedback({ msg: t.wffInvalidCorrect, isCorrect: true });
    } else {
      setWffFeedback({ msg: t.wffIncorrect, isCorrect: false });
    }
  };

  const getMainConnectiveString = (node: ASTNode) => {
    if (node.type === 'AND') return 'AND';
    if (node.type === 'OR') return 'OR';
    if (node.type === 'IMPLIES') return 'IMPLIES';
    if (node.type === 'NOT') return 'NOT';
    return 'VAR';
  };

  const handleConnAnswer = (answer: string) => {
    if (!ast) return;
    const actual = getMainConnectiveString(ast);
    if (actual === answer) {
      setConnFeedback({ msg: t.connCorrect, isCorrect: true });
    } else {
      setConnFeedback({ msg: t.connIncorrect, isCorrect: false });
    }
  };

  const startTree = () => {
    if (!ast) return;
    const res = buildTableau(ast);
    setTableauResult(res);
    setCurrentStep(0);
    setPhase('TREE_BUILD');
    determineNextPendingExpansion(res.root, 0);
  };

  // Helper to figure out what is being expanded in the NEXT step (currentStep + 1)
  const determineNextPendingExpansion = (node: TableauNode, targetStep: number): boolean => {
    // If one of the children is exactly targetStep + 1, it means THIS node was expanded to produce them.
    // Wait, the step in buildTableau assigns `stepCounter++` when applying a rule.
    // So the children created will have `step === targetStep + 1`.
    
    for (const child of node.children) {
      if (child.step === targetStep + 1) {
        // We found the expansion! What rule was it?
        // Node has multiple branches if beta, 1 branch if alpha.
        const isBranching = node.children.length > 1;
        
        // Find which formula in node.formulas caused it. (This is a bit tricky since we didn't save the target in TableauNode, 
        // but we can infer it by finding the first non-literal, just like buildTableau does).
        // For simplicity, we just ask the user if the rule is Branching or Linear.
        setPendingExpansion({
          formula: 'next', 
          type: isBranching ? 'BRANCHING' : 'LINEAR',
          nodeType: isBranching ? 'beta' : 'alpha'
        });
        return true;
      }
      if (child.step <= targetStep) {
         if (determineNextPendingExpansion(child, targetStep)) return true;
      }
    }
    setPendingExpansion(null);
    return false;
  };

  const handleRuleAnswer = (answer: 'LINEAR' | 'BRANCHING') => {
    if (!pendingExpansion) return;
    if (pendingExpansion.type === answer) {
      setRuleFeedback({ msg: t.ruleCorrect, isCorrect: true });
      setTimeout(() => {
        setRuleFeedback(null);
        setCurrentStep(c => {
          const next = c + 1;
          determineNextPendingExpansion(tableauResult!.root, next);
          return next;
        });
      }, 1000);
    } else {
      setRuleFeedback({ msg: t.ruleIncorrect, isCorrect: false });
    }
  };

  const playAll = () => {
    if (!tableauResult) return;
    setCurrentStep(tableauResult.maxSteps - 1);
    setPendingExpansion(null);
  };

  const getRuleHeuristic = (f: ASTNode): string => {
    if (f.type === 'AND') return 'AND is non-branching (both must be true in the same world).';
    if (f.type === 'OR') return 'OR is branching (either left or right is true).';
    if (f.type === 'IMPLIES') return 'IMPLIES is branching (~left or right).';
    if (f.type === 'NOT') {
      const inner = f.left!;
      if (inner.type === 'NOT') return 'Double negation cancels out.';
      if (inner.type === 'AND') return 'NOT-AND is branching (~left or ~right) by De Morgan.';
      if (inner.type === 'OR') return 'NOT-OR is non-branching (~left and ~right) by De Morgan.';
      if (inner.type === 'IMPLIES') return 'NOT-IMPLIES is non-branching (left and ~right).';
    }
    return '';
  };

  const renderNode = (node: TableauNode) => {
    if (node.step > currentStep) return null;

    return (
      <li key={node.id} className="animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col items-center">
          {node.step > 0 && (
             <div className="text-[10px] bg-sand-200 text-sand-800 px-2 py-0.5 rounded-full mb-1 max-w-[150px] leading-tight text-center shadow-sm">
                Rule Applied
             </div>
          )}
          <div className="bg-white border-2 border-sand-400 rounded-lg p-3 min-w-[120px] text-center shadow-sm relative transition-all hover:border-sand-600 hover:shadow-md">
            {node.formulas.map((f, i) => (
              <div key={i} className="font-mono text-sand-900 font-semibold">{formatLogicString(astToString(f))}</div>
            ))}
            
            {node.closed && (
              <div className="mt-2 text-red-700 flex flex-col items-center justify-center text-sm font-bold gap-1 animate-in fade-in">
                <div className="flex items-center gap-1"><XCircle size={16} /> {t.closed}</div>
              </div>
            )}
            
            {node.open && (
              <div className="mt-2 text-green-700 flex flex-col items-center justify-center text-sm font-bold gap-1 animate-in fade-in">
                <div className="flex items-center gap-1"><CheckCircle2 size={16} /> {t.open}</div>
                <div className="text-xs font-normal mt-1 bg-green-50 px-2 py-1 rounded text-green-800 border border-green-200 break-words max-w-[150px]">
                  {t.model}: {'{'}{formatLogicString(node.models?.join(', ') || '')}{'}'}
                </div>
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
        <p className="text-sand-700 mt-2" dangerouslySetInnerHTML={{ __html: t.description }}></p>
      </header>

      {/* INPUT PHASE */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-sand-200 mb-8">
        <label className="block text-sm font-semibold mb-2 text-sand-800">{t.labelFormula}</label>
        <div className="flex gap-4">
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setPhase('INPUT');
            }}
            className="flex-1 px-4 py-2 bg-sand-50 border border-sand-400 rounded focus:outline-none focus:ring-2 focus:ring-sand-600 font-mono"
            placeholder="(A & B) | (C -> D)"
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
          />
          <button
            onClick={handleVerify}
            className="px-6 py-2 bg-sand-600 hover:bg-sand-700 text-white font-bold rounded transition-colors shadow-sm cursor-pointer flex-shrink-0"
          >
            {t.generateBtn}
          </button>
        </div>
        <div className="mt-4 flex gap-2 text-sm text-sand-600 items-center">
          <Info size={16} />
          <span dangerouslySetInnerHTML={{ __html: t.syntaxInfo }}></span>
        </div>
      </div>

      {/* WFF CHECK PHASE */}
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
               {wffFeedback.isCorrect && isValidAST && phase === 'WFF_CHECK' && (
                 <button onClick={() => setPhase('MAIN_CONNECTIVE')} className="mt-4 px-4 py-2 bg-sand-800 text-white rounded shadow text-sm">{(lang === 'en' ? 'Next: Main Connective' : 'Próximo: Conectivo Principal')}</button>
               )}
               {!isValidAST && wffFeedback.isCorrect && (
                 <div className="mt-2 text-sm text-sand-600">Please edit the formula above to continue.</div>
               )}
             </div>
           )}
        </div>
      )}

      {/* MAIN CONNECTIVE PHASE */}
      {phase === 'MAIN_CONNECTIVE' && isValidAST && ast && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-sand-200 mb-8 animate-in slide-in-from-top-4">
           <h2 className="text-xl font-bold text-sand-800 mb-4">{t.qMainConnective}</h2>
           <div className="font-mono text-2xl mb-6 text-center bg-sand-50 p-4 rounded border border-sand-200 text-sand-900">
             {formatLogicString(astToString(ast))}
           </div>
           <div className="flex flex-wrap gap-4 mb-4">
             <button onClick={() => handleConnAnswer('AND')} className="px-4 py-2 bg-sand-200 text-sand-900 rounded font-bold hover:bg-sand-300">{t.connAnd}</button>
             <button onClick={() => handleConnAnswer('OR')} className="px-4 py-2 bg-sand-200 text-sand-900 rounded font-bold hover:bg-sand-300">{t.connOr}</button>
             <button onClick={() => handleConnAnswer('IMPLIES')} className="px-4 py-2 bg-sand-200 text-sand-900 rounded font-bold hover:bg-sand-300">{t.connImplies}</button>
             <button onClick={() => handleConnAnswer('NOT')} className="px-4 py-2 bg-sand-200 text-sand-900 rounded font-bold hover:bg-sand-300">{t.connNot}</button>
             <button onClick={() => handleConnAnswer('VAR')} className="px-4 py-2 bg-sand-200 text-sand-900 rounded font-bold hover:bg-sand-300">{t.connVar}</button>
           </div>
           
           {connFeedback && (
             <div className={`p-4 rounded border ${connFeedback.isCorrect ? 'bg-green-50 border-green-300 text-green-900' : 'bg-red-50 border-red-300 text-red-900'}`}>
               <strong className="block">{connFeedback.msg}</strong>
               {connFeedback.isCorrect && (
                 <button onClick={startTree} className="mt-4 px-4 py-2 bg-sand-800 text-white rounded shadow text-sm">{(lang === 'en' ? 'Start Tableau' : 'Iniciar Tableau')}</button>
               )}
             </div>
           )}
        </div>
      )}

      {/* TREE BUILD PHASE */}
      {phase === 'TREE_BUILD' && tableauResult && (
        <div className="bg-white p-8 rounded-xl shadow-md border border-sand-200 overflow-x-auto relative min-h-[400px]">
          
          <div className="sticky left-0 flex flex-col md:flex-row items-center justify-between bg-sand-50 p-4 rounded border border-sand-200 mb-8 shadow-sm">
            <div className="font-bold text-sand-800 mb-2 md:mb-0">
              {(lang === 'en' ? 'Step' : 'Passo')} {currentStep + 1} / {tableauResult.maxSteps}
              {currentStep >= tableauResult.maxSteps - 1 && <span className="ml-4 text-green-700">{t.stepCompleted}</span>}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={playAll}
                disabled={currentStep >= tableauResult.maxSteps - 1}
                className="flex items-center gap-1 px-4 py-2 bg-sand-600 hover:bg-sand-700 text-white font-bold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t.playAllBtn} <FastForward size={18}/>
              </button>
            </div>
          </div>

          {/* INTERACTIVE RULE SELECTOR */}
          {pendingExpansion && currentStep < tableauResult.maxSteps - 1 && (
            <div className="sticky left-0 bg-blue-50 border border-blue-300 p-4 rounded-xl mb-8 shadow-sm flex flex-col items-center gap-4 animate-in slide-in-from-top-4">
              <h3 className="font-bold text-blue-900 text-lg">{t.qRule}</h3>
              <div className="flex gap-4">
                <button onClick={() => handleRuleAnswer('LINEAR')} className="px-4 py-2 bg-white text-blue-900 font-bold border-2 border-blue-400 hover:bg-blue-100 rounded shadow-sm">
                  {t.ruleLinear}
                </button>
                <button onClick={() => handleRuleAnswer('BRANCHING')} className="px-4 py-2 bg-white text-blue-900 font-bold border-2 border-blue-400 hover:bg-blue-100 rounded shadow-sm">
                  {t.ruleBranching}
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
              {renderNode(tableauResult.root)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
