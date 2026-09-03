# Logic Hub

Uma aplicação web interativa e didática, construída passo a passo, para o ensino de Lógica Formal — pensada para estudantes e professores que desejam explorar semântica, teoria da prova e filosofia da linguagem clássica com rigor e clareza.

## Ferramentas

### 1. Tabelas-Verdade
Gera tabelas-verdade exaustivas para fórmulas proposicionais.
- **Heurística de dentro para fora:** avalia variáveis → subfórmulas → conectivo principal.
- **Classificação automática:** Tautologia, Contradição ou Contingência.
- Sintaxe: variáveis A–Z, `&` (E), `|` (OU), `->` (IMPLICA), `~` ou `!` (NÃO).

### 2. Termos Singulares (Filosofia da Linguagem)
Formalização passo a passo de frases da linguagem natural em lógica de predicados.
- *Nomes próprios:* "Sócrates é mortal" → `M(s)`
- *Existenciais negativos:* "Pégaso não existe" → `¬∃x P(x)`
- *Descrições definidas de Russell:* "O atual rei da França é careca" → `∃x (K(x) ∧ ∀y(K(y)→y=x) ∧ C(x))`

### 3. Tableau Proposicional
Construtor de árvores semânticas dinâmico e animado.
- **Heurística positiva:** explora a fórmula diretamente para extrair todos os modelos satisfatíveis dos ramos abertos (sem negar a fórmula para refutação).
- Cada passo de ramificação exibe um balão pedagógico explicando a regra aplicada (De Morgan, Dupla Negação, etc.).

### 4. Lógica de Primeira Ordem (Semântica)
Demonstra como os quantificadores operam sobre um domínio finito.
- `∀x` se expande numa conjunção sobre cada elemento do domínio.
- `∃x` se expande numa disjunção sobre cada elemento do domínio.
- A substituição de variáveis é mostrada passo a passo.

### 5. Cálculo de Predicados (Regras de Tableau)
Aplicação visual das regras de instanciação γ/δ.
- A instanciação existencial (δ) introduz primeiro uma constante nova.
- A instanciação universal (γ) aplica-se a todas as constantes conhecidas.
- Detecção automática de contradições fecha o ramo.

### 6. Quadrado Aristotélico (Oposição)
Simulador interativo da lógica categórica clássica (A, E, I, O).
- Atribua Verdadeiro/Falso a qualquer proposição.
- O valor de verdade se propaga passo a passo pelas relações de Contrariedade, Subcontrariedade, Contradição e Subalternação, com explicação a cada consequência.

## Tecnologias

| Camada | Escolha |
|--------|---------|
| Framework | React 19 (Hooks, componentes funcionais) |
| Linguagem | TypeScript — tipagem estrita para AST e motor lógico |
| Estilização | Tailwind CSS v4 com tema areia/bege acadêmico |
| Ícones | Lucide React |
| Build | Vite 6 + plugin `@tailwindcss/vite` |
| Testes | Vitest + React Testing Library + jsdom |

## Executando Localmente

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de produção
npm test         # executar testes
npm run coverage # relatório de cobertura (≥ 80 % em todas as métricas)
```

## Internacionalização

Alterne entre **Inglês** e **Português** a qualquer momento usando os botões EN / PT no rodapé do menu lateral. Todas as strings de interface, exemplos e descrições pedagógicas estão completamente traduzidos.

---

*O Logic Hub une rigor formal e pedagogia intuitiva — tornando os fundamentos do raciocínio dedutivo acessíveis a todos.*
