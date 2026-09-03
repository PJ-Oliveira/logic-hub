import React, { useState } from 'react';
import { translations, Language } from '../i18n';
import { parseFormula, getVariables, getSubformulas, evaluateAST, astToString, ASTNode, formatLogicString } from '../tableau';
import { AlertCircle, CheckCircle, Info, Hash, BookOpen } from 'lucide-react';

type Phase = 'INPUT' | 'WFF_CHECK' | 'ROW_COUNT' | 'CLASSIFY' | 'DONE';

export const TruthTable: React.FC<{ lang: Language }> = ({ lang }) => {
  const t = translations[lang].truthTable;
  const [input, setInput] = useState('(P -> Q) & P');
  
  const [phase, setPhase] = useState<Phase>('INPUT');
  const [isValidAST, setIsValidAST] = useState<boolean>(false);
  const [ast, setAst] = useState<ASTNode | null>(null);
  
  const [wffFeedback, setWffFeedback] = useState<{msg: string, isCorrect: boolean} | null>(null);
  const [rowsFeedback, setRowsFeedback] = useState<{msg: string, isCorrect: boolean} | null>(null);
  const [classFeedback, setClassFeedback] = useState<{msg: string, isCorrect: boolean} | null>(null);
  
  const [vars, setVars] = useState<string[]>([]);
  const [subs, setSubs] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, boolean>[]>([]);
  
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
      const variables = getVariables(ast!);
      setVars(variables);
    } else if (userSaysYes && !isValidAST) {
      setWffFeedback({ msg: t.wffInvalidIncorrect, isCorrect: false });
    } else if (!userSaysYes && !isValidAST) {
      setWffFeedback({ msg: t.wffInvalidCorrect, isCorrect: true });
    } else {
      setWffFeedback({ msg: t.wffIncorrect, isCorrect: false });
    }
  };

  const [rowAnswer, setRowAnswer] = useState('');
  
  const handleRowCheck = () => {
    const expected = Math.pow(2, vars.length);
    if (parseInt(rowAnswer) === expected) {
      setRowsFeedback({ msg: t.rowsCorrect.replace('{n}', vars.length.toString()).replace('{rows}', expected.toString()), isCorrect: true });
    } else {
      setRowsFeedback({ msg: t.rowsIncorrect, isCorrect: false });
    }
  };
  
  const generateTable = () => {
    if (!ast) return;
    const subformulasAST = getSubformulas(ast);
    const subformulasStr = subformulasAST.map(astToString);
    
    const numRows = Math.pow(2, vars.length);
    const newRows: Record<string, boolean>[] = [];
    
    for (let i = 0; i < numRows; i++) {
      const assignment: Record<string, boolean> = {};
      vars.forEach((v, idx) => {
        assignment[v] = ((i >> (vars.length - 1 - idx)) & 1) === 1;
      });
      
      subformulasAST.forEach((sub, idx) => {
        assignment[subformulasStr[idx]] = evaluateAST(sub, assignment);
      });
      
      newRows.push(assignment);
    }
    
    setSubs(subformulasStr);
    setRows(newRows);
    setPhase('CLASSIFY');
  };

  const getAnalysis = () => {
    if (rows.length === 0 || subs.length === 0) return null;
    const mainFormula = subs[subs.length - 1];
    const isTautology = rows.every(r => r[mainFormula] === true);
    const isContradiction = rows.every(r => r[mainFormula] === false);
    
    if (isTautology) return 'tautology';
    if (isContradiction) return 'contradiction';
    return 'contingency';
  };

  const handleClassify = (answer: string) => {
    const actual = getAnalysis();
    if (actual === answer) {
      setClassFeedback({ msg: t.classCorrect, isCorrect: true });
      setTimeout(() => {
        setPhase('DONE');
      }, 1000);
    } else {
      setClassFeedback({ msg: t.classIncorrect, isCorrect: false });
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-8 border-b-2 border-sand-300 pb-4">
        <h1 className="text-3xl font-bold text-sand-800">{t.title}</h1>
        <p className="text-sand-700 mt-2">{t.description}</p>
      </header>

      {/* INPUT PHASE */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-sand-200 mb-8">
        <label className="block text-sm font-semibold mb-2 text-sand-800">{t.formulaLabel}</label>
        <div className="flex gap-4">
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setPhase('INPUT'); }}
            className="flex-1 px-4 py-2 bg-sand-50 border border-sand-400 rounded focus:outline-none focus:ring-2 focus:ring-sand-600 font-mono"
            placeholder="(A & B) | (C -> D)"
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
          />
          <button onClick={handleVerify} className="px-6 py-2 bg-sand-600 hover:bg-sand-700 text-white font-bold rounded transition-colors shadow-sm cursor-pointer flex-shrink-0">
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
                 <button onClick={() => setPhase('ROW_COUNT')} className="mt-4 px-4 py-2 bg-sand-800 text-white rounded shadow text-sm">{(lang === 'en' ? 'Next: Row Count' : 'Próximo: Número de Linhas')}</button>
               )}
             </div>
           )}
        </div>
      )}

      {/* ROW COUNT PHASE */}
      {(phase === 'ROW_COUNT' || phase === 'CLASSIFY' || phase === 'DONE') && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-sand-200 mb-8 animate-in slide-in-from-top-4">
           <h2 className="text-xl font-bold text-sand-800 mb-4">{t.qRowCount.replace('{vars}', vars.join(', '))}</h2>
           <div className="flex gap-4 mb-4">
             <input type="number" value={rowAnswer} onChange={e => setRowAnswer(e.target.value)} className="w-24 px-4 py-2 bg-sand-50 border border-sand-400 rounded focus:ring-2 focus:ring-sand-600" />
             <button onClick={handleRowCheck} className="px-6 py-2 bg-sand-600 text-white rounded font-bold hover:bg-sand-700">{t.btnCheckRows}</button>
           </div>
           {rowsFeedback && (
             <div className={`p-4 rounded border ${rowsFeedback.isCorrect ? 'bg-green-50 border-green-300 text-green-900' : 'bg-red-50 border-red-300 text-red-900'}`}>
               <strong className="block">{rowsFeedback.msg}</strong>
               {rowsFeedback.isCorrect && phase === 'ROW_COUNT' && (
                 <button onClick={generateTable} className="mt-4 px-4 py-2 bg-sand-800 text-white rounded shadow text-sm">{(lang === 'en' ? 'Draw Table' : 'Desenhar Tabela')}</button>
               )}
             </div>
           )}
        </div>
      )}

      {/* TABLE DRAWN - CLASSIFY PHASE */}
      {(phase === 'CLASSIFY' || phase === 'DONE') && rows.length > 0 && (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white p-8 rounded-xl shadow-md border border-sand-200 overflow-x-auto relative">
            
            {phase === 'CLASSIFY' && (
              <div className="sticky left-0 bg-blue-50 border border-blue-300 p-4 rounded-xl mb-8 shadow-sm flex flex-col items-center gap-4 animate-in slide-in-from-top-4">
                <h3 className="font-bold text-blue-900 text-lg">{t.qClassify}</h3>
                <div className="flex gap-4">
                  <button onClick={() => handleClassify('tautology')} className="px-4 py-2 bg-white text-blue-900 font-bold border-2 border-blue-400 hover:bg-blue-100 rounded shadow-sm">{t.btnTautology}</button>
                  <button onClick={() => handleClassify('contradiction')} className="px-4 py-2 bg-white text-blue-900 font-bold border-2 border-blue-400 hover:bg-blue-100 rounded shadow-sm">{t.btnContradiction}</button>
                  <button onClick={() => handleClassify('contingency')} className="px-4 py-2 bg-white text-blue-900 font-bold border-2 border-blue-400 hover:bg-blue-100 rounded shadow-sm">{t.btnContingency}</button>
                </div>
                {classFeedback && (
                  <div className={`p-2 px-4 rounded font-bold ${classFeedback.isCorrect ? 'text-green-800 bg-green-100' : 'text-red-800 bg-red-100'}`}>
                    {classFeedback.msg}
                  </div>
                )}
              </div>
            )}

            {phase === 'DONE' && (
              <div className={`mb-6 p-4 rounded border-2 shadow-sm flex items-start gap-3 ${getAnalysis() === 'tautology' ? 'bg-green-50 border-green-500 text-green-900' : getAnalysis() === 'contradiction' ? 'bg-red-50 border-red-500 text-red-900' : 'bg-blue-50 border-blue-500 text-blue-900'}`}>
                 {getAnalysis() === 'tautology' ? <CheckCircle className="mt-1 shrink-0 text-green-600" /> : getAnalysis() === 'contradiction' ? <AlertCircle className="mt-1 shrink-0 text-red-600" /> : <Hash className="mt-1 shrink-0 text-blue-600" />}
                 <div>
                    <h3 className="font-bold text-lg">{lang === 'en' ? 'Logical Classification' : 'Classificação Lógica'}</h3>
                    <p className="font-medium mt-1 uppercase">{getAnalysis()}</p>
                 </div>
              </div>
            )}

            <table className="w-full text-center border-collapse mb-4">
              <thead>
                <tr>
                  {vars.map(v => (
                    <th key={v} className="border-2 border-sand-300 bg-sand-100 p-3 font-mono font-bold text-sand-900">{formatLogicString(v)}</th>
                  ))}
                  {subs.map((s, idx) => (
                    <th key={s} className={`border-2 border-sand-300 p-3 font-mono font-bold ${idx === subs.length - 1 ? 'bg-sand-800 text-white' : 'bg-sand-100 text-sand-900'}`}>
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-sand-50 transition-colors">
                    {vars.map(v => (
                      <td key={v} className={`border border-sand-200 p-3 font-bold ${row[v] ? 'text-green-600' : 'text-red-600'}`}>
                        {row[v] ? (lang === 'en' ? 'T' : 'V') : 'F'}
                      </td>
                    ))}
                    {subs.map((s, idx) => (
                      <td key={s} className={`border border-sand-200 p-3 font-bold ${idx === subs.length - 1 ? 'bg-sand-100 border-x-2 border-sand-400' : ''} ${row[s] ? 'text-green-600' : 'text-red-600'}`}>
                        {row[s] ? (lang === 'en' ? 'T' : 'V') : 'F'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {phase === 'DONE' && (
            <div className="bg-sand-100 border-2 border-sand-300 p-6 rounded-xl shadow-inner">
              <h3 className="flex items-center gap-2 text-xl font-black text-sand-900 mb-4 border-b border-sand-300 pb-2">
                <BookOpen size={24} className="text-sand-700" />
                {lang === 'en' ? 'Ontological & Axiomatic Foundations' : 'Fundamentos Ontológicos & Axiomáticos'}
              </h3>
              <ul className="space-y-4 text-sm text-sand-800">
                <li className="flex gap-3 bg-white p-4 rounded shadow-sm border border-sand-200">
                  <span className="font-bold text-lg min-w-8">1.</span>
                  <div>
                    <strong className="block text-sand-900 text-base mb-1">
                      {lang === 'en' ? 'Axiom of Finitude (Enumerable Domain)' : 'Axioma da Finitude (Domínio Enumerável)'}
                    </strong>
                    {lang === 'en' 
                      ? `Boolean logic strictly relies on finite, enumerable domains. The ontology contains exactly ${vars.length} variable(s) {${vars.join(', ')}}. Therefore, the logical space is strictly bounded to 2^${vars.length} = ${rows.length} finite possibilities.`
                      : `A lógica booleana depende estritamente de domínios finitos e enumeráveis. A ontologia desta proposição contém exatamente ${vars.length} variável(is) {${vars.join(', ')}}. Logo, o espaço lógico total está rigorosamente limitado a 2^${vars.length} = ${rows.length} possibilidades finitas.`
                    }
                  </div>
                </li>
                <li className="flex gap-3 bg-white p-4 rounded shadow-sm border border-sand-200">
                  <span className="font-bold text-lg min-w-8">2.</span>
                  <div>
                    <strong className="block text-sand-900 text-base mb-1">
                      {lang === 'en' ? 'Law of Excluded Middle (Tertium Non Datur)' : 'Princípio do Terceiro Excluído (Tertium Non Datur)'}
                    </strong>
                    {lang === 'en'
                      ? 'Every proposition in the table is strictly evaluated as either True (T) or False (F). There is no third value or ontological ambiguity allowed in this system.'
                      : 'A lógica subjacente aceita o terceiro excluído. Note que cada célula da tabela é rigorosamente avaliada como Verdadeira (V) ou Falsa (F). Não há um terceiro valor ou ambiguidade ontológica neste sistema lógico.'
                    }
                  </div>
                </li>
                <li className="flex gap-3 bg-white p-4 rounded shadow-sm border border-sand-200">
                  <span className="font-bold text-lg min-w-8">3.</span>
                  <div>
                    <strong className="block text-sand-900 text-base mb-1">
                      {lang === 'en' ? 'Law of Non-Contradiction' : 'Princípio da Não-Contradição'}
                    </strong>
                    {lang === 'en'
                      ? 'For any given row (possible world), a proposition cannot simultaneously hold True and False.'
                      : 'Para qualquer linha (mundo possível) da tabela, é garantido axiologicamente que nenhuma proposição admitirá os valores Verdadeiro e Falso simultaneamente.'
                    }
                  </div>
                </li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
