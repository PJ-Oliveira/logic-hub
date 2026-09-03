import React, { useState } from 'react';
import { translations, Language } from '../i18n';

type NodeId = 'A' | 'E' | 'I' | 'O';
type TruthValue = 'T' | 'F' | 'U';

export const AristotelianSquare: React.FC<{ lang: Language }> = ({ lang }) => {
  const t = translations[lang].aristotelian;
  
  const [values, setValues] = useState<Record<NodeId, TruthValue>>({
    A: 'U', E: 'U', I: 'U', O: 'U'
  });

  const [activeRoot, setActiveRoot] = useState<{ id: NodeId, val: TruthValue } | null>(null);
  
  // The inference queue dictates what we ask the user next.
  const [queue, setQueue] = useState<{target: NodeId, expected: TruthValue, relation: string}[]>([]);
  const [currentInfer, setCurrentInfer] = useState<{target: NodeId, expected: TruthValue, relation: string} | null>(null);
  
  const [inferFeedback, setInferFeedback] = useState<{msg: string, isCorrect: boolean} | null>(null);

  const getConsequences = (node: NodeId, val: TruthValue) => {
    const rules: {target: NodeId, expected: TruthValue, relation: string}[] = [];
    
    if (node === 'A' && val === 'T') {
      rules.push({ target: 'O', expected: 'F', relation: t.contradictories });
      rules.push({ target: 'E', expected: 'F', relation: t.contraries });
      rules.push({ target: 'I', expected: 'T', relation: t.subalternation });
    }
    else if (node === 'A' && val === 'F') {
      rules.push({ target: 'O', expected: 'T', relation: t.contradictories });
    }
    else if (node === 'E' && val === 'T') {
      rules.push({ target: 'I', expected: 'F', relation: t.contradictories });
      rules.push({ target: 'A', expected: 'F', relation: t.contraries });
      rules.push({ target: 'O', expected: 'T', relation: t.subalternation });
    }
    else if (node === 'E' && val === 'F') {
      rules.push({ target: 'I', expected: 'T', relation: t.contradictories });
    }
    else if (node === 'I' && val === 'T') {
      rules.push({ target: 'E', expected: 'F', relation: t.contradictories });
    }
    else if (node === 'I' && val === 'F') {
      rules.push({ target: 'E', expected: 'T', relation: t.contradictories });
      rules.push({ target: 'A', expected: 'F', relation: t.subalternation });
      rules.push({ target: 'O', expected: 'T', relation: t.subcontraries });
    }
    else if (node === 'O' && val === 'T') {
      rules.push({ target: 'A', expected: 'F', relation: t.contradictories });
    }
    else if (node === 'O' && val === 'F') {
      rules.push({ target: 'A', expected: 'T', relation: t.contradictories });
      rules.push({ target: 'E', expected: 'F', relation: t.subalternation });
      rules.push({ target: 'I', expected: 'T', relation: t.subcontraries });
    }
    
    return rules;
  };

  const handleSetNode = (node: NodeId, val: TruthValue) => {
    // Reset everything
    setValues({ A: 'U', E: 'U', I: 'U', O: 'U', [node]: val });
    setActiveRoot({ id: node, val });
    
    const consequences = getConsequences(node, val);
    if (consequences.length > 0) {
      setCurrentInfer(consequences[0]);
      setQueue(consequences.slice(1));
    } else {
      setCurrentInfer(null);
      setQueue([]);
    }
    setInferFeedback(null);
  };

  const handleInferAnswer = (answer: TruthValue) => {
    if (!currentInfer) return;
    
    if (answer === currentInfer.expected) {
      setInferFeedback({ msg: t.inferCorrect, isCorrect: true });
      // update the node visually
      setValues(prev => ({ ...prev, [currentInfer.target]: answer }));
      
      setTimeout(() => {
        setInferFeedback(null);
        if (queue.length > 0) {
          setCurrentInfer(queue[0]);
          setQueue(queue.slice(1));
        } else {
          setCurrentInfer(null);
        }
      }, 1000);
    } else {
      setInferFeedback({ msg: t.inferIncorrect.replace('{relation}', currentInfer.relation), isCorrect: false });
    }
  };

  const getNodeClass = (val: TruthValue) => {
    if (val === 'T') return 'bg-green-100 border-green-500 text-green-900';
    if (val === 'F') return 'bg-red-100 border-red-500 text-red-900';
    return 'bg-white border-sand-400 text-sand-800';
  };

  const renderNodeControls = (id: NodeId, label: string) => (
    <div className={`p-4 border-2 rounded-xl text-center w-48 shadow-sm transition-all duration-300 ${getNodeClass(values[id])}`}>
      <div className="font-bold mb-2">{label}</div>
      <div className="text-sm font-mono mb-4 h-6">
        {values[id] === 'T' ? (lang === 'en' ? 'TRUE' : 'VERDADEIRO') : values[id] === 'F' ? (lang === 'en' ? 'FALSE' : 'FALSO') : (lang === 'en' ? 'UNKNOWN' : 'DESCONHECIDO')}
      </div>
      <div className="flex gap-2 justify-center">
        <button 
          onClick={() => handleSetNode(id, 'T')}
          className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded shadow-sm disabled:opacity-50"
          disabled={!!currentInfer}
        >
          {t.setTrue}
        </button>
        <button 
          onClick={() => handleSetNode(id, 'F')}
          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded shadow-sm disabled:opacity-50"
          disabled={!!currentInfer}
        >
          {t.setFalse}
        </button>
      </div>
    </div>
  );

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-8 border-b-2 border-sand-300 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-sand-800">{t.title}</h1>
          <p className="text-sand-700 mt-2">{t.description}</p>
        </div>
        <button 
          onClick={() => handleSetNode('A', 'U')} 
          className="px-4 py-2 bg-sand-200 hover:bg-sand-300 text-sand-800 font-bold rounded"
        >
          {t.resetBtn}
        </button>
      </header>
      
      {currentInfer && activeRoot && (
        <div className="bg-blue-50 border border-blue-300 p-6 rounded-xl mb-8 shadow-sm flex flex-col items-center gap-4 animate-in slide-in-from-top-4">
          <h3 className="font-bold text-blue-900 text-xl text-center">
            {t.qInfer
              .replace('{sourceNode}', activeRoot.id)
              .replace('{sourceVal}', activeRoot.val === 'T' ? (lang === 'en' ? 'True' : 'Verdadeiro') : (lang === 'en' ? 'False' : 'Falso'))
              .replace('{relation}', currentInfer.relation.toLowerCase())
              .replace('{targetNode}', currentInfer.target)}
          </h3>
          <div className="flex gap-4">
            <button onClick={() => handleInferAnswer('T')} className="px-6 py-2 bg-white text-blue-900 font-bold border-2 border-blue-400 hover:bg-blue-100 rounded shadow-sm">
              {t.btnTrue}
            </button>
            <button onClick={() => handleInferAnswer('F')} className="px-6 py-2 bg-white text-blue-900 font-bold border-2 border-blue-400 hover:bg-blue-100 rounded shadow-sm">
              {t.btnFalse}
            </button>
          </div>
          {inferFeedback && (
            <div className={`p-3 px-6 rounded font-bold text-lg ${inferFeedback.isCorrect ? 'text-green-800 bg-green-100' : 'text-red-800 bg-red-100'}`}>
              {inferFeedback.msg}
            </div>
          )}
        </div>
      )}

      {!currentInfer && activeRoot && activeRoot.val !== 'U' && (
        <div className="mb-8 p-4 bg-green-50 text-green-800 font-bold rounded-lg border border-green-200 text-center animate-in zoom-in">
          {t.stepCompleted}
        </div>
      )}

      <div className="bg-sand-50 p-8 rounded-xl shadow-md border border-sand-200 flex flex-col items-center relative overflow-hidden">
        {/* Top Row */}
        <div className="flex justify-between w-full max-w-2xl mb-32 relative z-10">
          {renderNodeControls('A', t.A)}
          {renderNodeControls('E', t.E)}
        </div>

        {/* Bottom Row */}
        <div className="flex justify-between w-full max-w-2xl relative z-10">
          {renderNodeControls('I', t.I)}
          {renderNodeControls('O', t.O)}
        </div>

        {/* SVG Lines - absolute positioned in the background */}
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-40 z-0">
          {/* Contraries A - E */}
          <line x1="30%" y1="20%" x2="70%" y2="20%" stroke="currentColor" strokeWidth="4" strokeDasharray="8 4" className="text-red-400" />
          
          {/* Subcontraries I - O */}
          <line x1="30%" y1="80%" x2="70%" y2="80%" stroke="currentColor" strokeWidth="4" strokeDasharray="8 4" className="text-green-400" />
          
          {/* Subalternation A - I */}
          <line x1="20%" y1="30%" x2="20%" y2="70%" stroke="currentColor" strokeWidth="4" className="text-blue-400" />
          <polygon points="17,65 23,65 20,72" fill="currentColor" className="text-blue-400" />
          
          {/* Subalternation E - O */}
          <line x1="80%" y1="30%" x2="80%" y2="70%" stroke="currentColor" strokeWidth="4" className="text-blue-400" />
          <polygon points="77,65 83,65 80,72" fill="currentColor" className="text-blue-400" />
          
          {/* Contradictories A - O */}
          <line x1="30%" y1="30%" x2="70%" y2="70%" stroke="currentColor" strokeWidth="4" className="text-purple-400" />
          
          {/* Contradictories E - I */}
          <line x1="70%" y1="30%" x2="30%" y2="70%" stroke="currentColor" strokeWidth="4" className="text-purple-400" />
        </svg>

        {/* Labels positioned absolutely */}
        <div className="absolute top-[10%] font-bold text-red-500 tracking-widest">{t.contraries}</div>
        <div className="absolute bottom-[10%] font-bold text-green-500 tracking-widest">{t.subcontraries}</div>
        <div className="absolute left-[5%] top-1/2 -translate-y-1/2 -rotate-90 font-bold text-blue-500">{t.subalternation}</div>
        <div className="absolute right-[5%] top-1/2 -translate-y-1/2 rotate-90 font-bold text-blue-500">{t.subalternation}</div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-bold text-purple-500 bg-sand-50 px-2 rounded-full z-10">{t.contradictories}</div>
      </div>
    </div>
  );
};
