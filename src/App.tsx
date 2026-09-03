import { useState } from 'react';
import { Globe, GitMerge, FileDigit, Square, Type, FileSignature, Table } from 'lucide-react';
import { translations, Language } from './i18n';
import { PropositionalTableau } from './tabs/PropositionalTableau';
import { FirstOrderLogic } from './tabs/FirstOrderLogic';
import { AristotelianSquare } from './tabs/AristotelianSquare';
import { SingularTerms } from './tabs/SingularTerms';
import { TruthTable } from './tabs/TruthTable';
import { PredicateCalculus } from './tabs/PredicateCalculus';

type Tab = 'truthTable' | 'propTableau' | 'singularTerms' | 'fol' | 'predicate' | 'aristotelian';

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const [activeTab, setActiveTab] = useState<Tab>('truthTable');

  const t = translations[lang];

  return (
    <div className="min-h-screen bg-sand-50 text-sand-900 font-sans flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-sand-200 shadow-sm flex flex-col">
        <div className="p-6 border-b border-sand-200 flex items-center justify-between">
          <h2 className="text-2xl font-black text-sand-900 tracking-tight">{t.appTitle}</h2>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button 
            onClick={() => setActiveTab('truthTable')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-semibold transition-colors ${activeTab === 'truthTable' ? 'bg-sand-100 text-sand-900 border border-sand-300 shadow-inner' : 'text-sand-700 hover:bg-sand-50 hover:text-sand-900 border border-transparent'}`}
          >
            <Table size={18} className={activeTab === 'truthTable' ? 'text-sand-700' : 'text-sand-400'} />
            {t.tabs.truthTable}
          </button>

          <button 
            onClick={() => setActiveTab('singularTerms')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-semibold transition-colors ${activeTab === 'singularTerms' ? 'bg-sand-100 text-sand-900 border border-sand-300 shadow-inner' : 'text-sand-700 hover:bg-sand-50 hover:text-sand-900 border border-transparent'}`}
          >
            <Type size={18} className={activeTab === 'singularTerms' ? 'text-sand-700' : 'text-sand-400'} />
            {t.tabs.singularTerms}
          </button>

          <button 
            onClick={() => setActiveTab('propTableau')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-semibold transition-colors ${activeTab === 'propTableau' ? 'bg-sand-100 text-sand-900 border border-sand-300 shadow-inner' : 'text-sand-700 hover:bg-sand-50 hover:text-sand-900 border border-transparent'}`}
          >
            <GitMerge size={18} className={activeTab === 'propTableau' ? 'text-sand-700' : 'text-sand-400'} />
            {t.tabs.propTableau}
          </button>

          <button 
            onClick={() => setActiveTab('fol')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-semibold transition-colors ${activeTab === 'fol' ? 'bg-sand-100 text-sand-900 border border-sand-300 shadow-inner' : 'text-sand-700 hover:bg-sand-50 hover:text-sand-900 border border-transparent'}`}
          >
            <FileDigit size={18} className={activeTab === 'fol' ? 'text-sand-700' : 'text-sand-400'} />
            {t.tabs.fol}
          </button>

          <button 
            onClick={() => setActiveTab('predicate')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-semibold transition-colors ${activeTab === 'predicate' ? 'bg-sand-100 text-sand-900 border border-sand-300 shadow-inner' : 'text-sand-700 hover:bg-sand-50 hover:text-sand-900 border border-transparent'}`}
          >
            <FileSignature size={18} className={activeTab === 'predicate' ? 'text-sand-700' : 'text-sand-400'} />
            {t.tabs.predicate}
          </button>

          <button 
            onClick={() => setActiveTab('aristotelian')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-semibold transition-colors ${activeTab === 'aristotelian' ? 'bg-sand-100 text-sand-900 border border-sand-300 shadow-inner' : 'text-sand-700 hover:bg-sand-50 hover:text-sand-900 border border-transparent'}`}
          >
            <Square size={18} className={activeTab === 'aristotelian' ? 'text-sand-700' : 'text-sand-400'} />
            {t.tabs.aristotelian}
          </button>
        </nav>

        <div className="p-4 border-t border-sand-200">
           <div className="flex items-center gap-2 bg-sand-50 px-3 py-2 rounded-lg border border-sand-200 justify-center">
            <Globe size={18} className="text-sand-600" />
            <button 
              onClick={() => setLang('en')} 
              className={`text-sm font-bold transition-colors ${lang === 'en' ? 'text-sand-900' : 'text-sand-400 hover:text-sand-600'}`}
            >
              EN
            </button>
            <span className="text-sand-300">|</span>
            <button 
              onClick={() => setLang('pt')} 
              className={`text-sm font-bold transition-colors ${lang === 'pt' ? 'text-sand-900' : 'text-sand-400 hover:text-sand-600'}`}
            >
              PT
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto h-screen relative">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'truthTable' && <TruthTable lang={lang} />}
          {activeTab === 'singularTerms' && <SingularTerms lang={lang} />}
          {activeTab === 'propTableau' && <PropositionalTableau lang={lang} />}
          {activeTab === 'fol' && <FirstOrderLogic lang={lang} />}
          {activeTab === 'predicate' && <PredicateCalculus lang={lang} />}
          {activeTab === 'aristotelian' && <AristotelianSquare lang={lang} />}
        </div>
      </main>
    </div>
  );
}
