# Logic Hub 🧠

*(Scroll down for the Portuguese version / Role para baixo para a versão em Português)*

**Logic Hub** is an interactive, bilingual (English & Portuguese), and pedagogically driven web application designed to teach the foundations of formal logic. Instead of merely functioning as a calculator that spits out answers, Logic Hub behaves like a Socratic tutor—guiding students step-by-step through logical processes, challenging them to identify syntax errors, main connectives, logical classifications, and ontological axioms.

## 🚀 Key Features

### 1. Truth Tables
- **Well-Formed Formula (WFF) Check**: Challenges the user to verify if the syntax is valid.
- **Row Count Calculation**: Asks the student to apply the $2^n$ formula to deduce the correct number of rows.
- **Final Classification**: Conceals the final column and asks if the formula represents a **Tautology**, **Contradiction**, or **Contingency**.
- **Axiomatic Foundations**: Explains the underlying rules of Boolean logic (Axiom of Finitude, Law of Excluded Middle, and Law of Non-Contradiction).

### 2. Propositional Tableau
- **Interactive Tree Expansion**: Students build semantic tableaus by exploring positive formulas to find satisfiable models.
- **Rule Selection**: The system quizzes the user to identify the main connective and decide whether it triggers a **Linear (Alpha)** or **Branching (Beta)** expansion.

### 3. First-Order Logic (Semantics)
- **Domain Expansion**: Teaches how quantifiers behave over a finite domain.
- **Interactive Mapping**: The student must correctly identify if the main quantifier is Universal (∀) or Existential (∃) and translate it into the correct propositional connective (AND/OR).

### 4. Predicate Calculus
- **Instantiation Rules**: Simulates tableau tree expansions for predicate calculus.
- **Gamma (γ) & Delta (δ) Rules**: Tests the user on whether they should **Reuse** an existing constant or instantiate a completely **New** one depending on the quantifier being resolved.

### 5. Singular Terms
- **Ontological Foundations**: Before translating phrases like *"Pegasus does not exist"* (Frege/Russell), the app quizzes the user on whether modern logic treats "existence" as a Predicate or a Quantifier.

### 6. Aristotelian Square of Opposition
- **Interactive Inference**: Users set truth values (True/False) for categorical propositions (A, E, I, O).
- **Socratic Propagation**: Instead of auto-resolving, the diagram asks the student to deduce the truth values of adjacent nodes based on logical relations (Contradictories, Contraries, Subcontraries, and Subalternation).

## 🛠 Tech Stack
- **Frontend**: React 19, TypeScript
- **Styling**: TailwindCSS v4
- **Testing**: Vitest + React Testing Library (100% test passing rate, >80% line coverage)
- **Build & Deploy**: Vite, GitHub Actions (Automated GitHub Pages deployment)

---

# Logic Hub 🧠 (Português)

O **Logic Hub** é uma aplicação web interativa, bilíngue (Inglês e Português) e construída sob rigorosos princípios pedagógicos para o ensino dos fundamentos da lógica formal. Em vez de funcionar apenas como uma calculadora que cospe respostas, o Logic Hub atua como um tutor socrático — guiando os alunos passo a passo através dos processos lógicos, desafiando-os a identificar erros de sintaxe, conectivos principais, classificações lógicas e premissas ontológicas.

## 🚀 Principais Ferramentas (Features)

### 1. Tabelas-Verdade
- **Checagem de Fórmulas Bem Formadas (WFF)**: Desafia o usuário a validar se a sintaxe da fórmula digitada está correta.
- **Cálculo de Linhas**: Pergunta ao aluno quantas linhas a tabela terá, exigindo a aplicação da fórmula $2^n$.
- **Classificação Lógica**: Oculta o resultado da última coluna e testa o aluno para saber se a fórmula é uma **Tautologia**, **Contradição** ou **Contingência**.
- **Fundamentos Axiomáticos**: Explica as leis subjacentes da lógica Booleana (Axioma da Finitude, Princípio do Terceiro Excluído e Princípio da Não-Contradição).

### 2. Tableau Proposicional
- **Expansão Interativa em Árvore**: Alunos constroem tableaus semânticos explorando fórmulas positivas para encontrar todos os modelos satisfatíveis (ramos abertos).
- **Seleção de Regras**: O sistema testa o usuário pedindo para que ele identifique o conectivo principal e decida se a expansão deve ser **Linear (Alfa)** ou **Bifurcada (Beta)**.

### 3. Lógica de Primeira Ordem (Semântica)
- **Expansão de Domínio**: Ensina de forma prática como os quantificadores se comportam aplicados a domínios finitos.
- **Mapeamento Interativo**: O aluno deve identificar corretamente se o quantificador principal é Universal (∀) ou Existencial (∃) e traduzi-lo para o conectivo proposicional correto (E/OU).

### 4. Cálculo de Predicados
- **Regras de Instanciação**: Simula a expansão de árvores para a lógica de predicados.
- **Regras Gama (γ) e Delta (δ)**: Testa o usuário perguntando se, para determinado quantificador, ele deve **Reutilizar** uma constante existente ou instanciar uma **Nova** constante na ontologia.

### 5. Termos Singulares
- **Fundamentos Ontológicos**: Antes de traduzir frases famosas como *"Pégaso não existe"* (nas visões de Frege/Russell), o aplicativo questiona o aluno sobre como a lógica moderna lida com a "existência": como um Predicado ou como um Quantificador?

### 6. Quadrado Aristotélico (Oposição)
- **Inferência Interativa**: O usuário define valores de verdade (V/F) para proposições categóricas (A, E, I, O).
- **Propagação Socrática**: Em vez de resolver tudo sozinho, o diagrama força o aluno a deduzir ativamente os valores-verdade dos nós adjacentes com base nas relações (Contraditórias, Contrárias, Subcontrárias e Subalternas).

## 🛠 Tecnologias Utilizadas
- **Frontend**: React 19, TypeScript
- **Estilização**: TailwindCSS v4
- **Testes**: Vitest + React Testing Library (100% dos testes passando, >80% de cobertura de código)
- **Build & Deploy**: Vite, GitHub Actions (Deploy automatizado direto para o GitHub Pages)
