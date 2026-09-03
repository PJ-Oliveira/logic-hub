# Logic Hub

*(Scroll down for the Portuguese version / Role para baixo para a versão em Português)*

**Logic Hub** is an interactive, bilingual (English & Portuguese) web application for studying formal logic and domain modelling. It combines a Socratic logic tutor (for learning) with a First-Order Logic specification editor that generates production-ready Rich Domain Model code in Java, TypeScript, and Python.

---

## Features

### 1. Truth Tables
- **Well-Formed Formula (WFF) Check** — validates formula syntax.
- **Row Count** — tests the student on the $2^n$ formula.
- **Classification** — hides the final column and asks: Tautology, Contradiction, or Contingency?
- **Axiomatic Foundations** — explains Axiom of Finitude, Excluded Middle, Non-Contradiction.

### 2. Propositional Tableau
- **Interactive Tree Expansion** — build semantic tableaus step by step.
- **Rule Selection** — identify the main connective and choose Linear (Alpha) or Branching (Beta) expansion.

### 3. First-Order Logic (Semantics)
- **Domain Expansion** — see how universal (∀) and existential (∃) quantifiers behave over a finite domain.
- **Interactive Mapping** — translate quantifiers into propositional connectives (AND / OR).

### 4. Predicate Calculus
- **Instantiation Rules** — simulate tableau tree expansions for predicate logic.
- **Gamma (γ) & Delta (δ) Rules** — decide whether to reuse an existing constant or instantiate a new one.

### 5. Singular Terms
- **Ontological Foundations** — formalize phrases like "Pegasus does not exist" (Frege/Russell) and learn whether existence is a predicate or a quantifier.

### 6. Aristotelian Square of Opposition
- **Interactive Inference** — set truth values for A, E, I, O propositions.
- **Socratic Propagation** — deduce adjacent nodes via Contradictories, Contraries, Subcontraries, and Subalternation.

---

### 7. FOL Specification Editor

> **Write your domain model in First-Order Logic — get idiomatic Java, TypeScript, or Python code following the Rich Domain Model pattern.**

The FOL Spec Editor is a purpose-built DSL (Domain-Specific Language) for specifying business domains with formal precision. You write your types, entities, rules, and invariants in a readable FOL syntax, and the editor generates production-ready, architecture-correct code — not boilerplate, not pseudo-code.

#### What you can do

| Construct | Description | Example |
|-----------|-------------|---------|
| `sort` | Finite closed enum — all variants declared upfront | `sort Status = pending \| approved \| rejected;` |
| `entity` | Domain entity with identity — distinguished by `id`, not by content | `entity Order { id: UUID; ... }` |
| `value` | Value Object — structural equality, no identity field needed | `value Money { amount: Float; ... }` |
| `rule` | Invariant scoped to an entity/value, enforced at construction | `rule r: amount > 0;` |
| `invariant` | Global FOL axiom spanning multiple types | `invariant admin_active: forall u: User. ...;` |

#### Expression syntax

| Syntax | Meaning |
|--------|---------|
| `if P then Q;` | Implication — whenever P holds, Q must hold (≡ P → Q) |
| `if P then Q else R;` | Conditional — if P enforce Q, otherwise enforce R |
| `P => Q` / `P → Q` | Implication (ASCII or Unicode) |
| `P & Q` / `P ∧ Q` | Conjunction (AND) |
| `P \| Q` / `P ∨ Q` | Disjunction (OR) |
| `~P` / `¬P` | Negation (NOT) |
| `forall x: Sort. P(x);` | Universal quantifier (∀) |
| `exists x: Sort. P(x);` | Existential quantifier (∃) |
| `field = value` | Equality / sort variant membership |
| `amount > 0` | Numeric comparison (`<` `<=` `>` `>=`) |
| `active(owner)` | Boolean predicate on a referenced entity |
| `hasRole(user, admin)` | Set membership predicate |

#### Rich Domain Model output

Every generated file strictly follows the Rich Domain Model architecture:

**Java 17+**
- `entity` → `public final class` with `private final` fields, `private` constructor, `static create(...)` factory, and `DomainException` thrown on rule violation. `equals`/`hashCode` are based on the `id` field.
- `value` → `public record` with a compact constructor that throws `DomainException` on violation.
- `sort` → `sealed interface` with one `record` per variant.
- Global invariants → documented comment with note to enforce in a domain service.

**TypeScript**
- Preamble: `DomainError`, `Result<T>`, `ok()`, `err()` — **never throws directly**.
- `entity` / `value` → branded `Readonly<{...}>` type + `createXxx(...): Result<Xxx>` smart constructor.
- `sort` → union type `'pending' | 'approved' | 'rejected'`.
- Rule violation → `return err('rule_name')` (no exceptions).

**Python 3.10+**
- `entity` → `@dataclass(eq=False, frozen=True)` with explicit `__eq__`/`__hash__` by `id`. Validates in `__post_init__` with `raise DomainError`.
- `value` → `@dataclass(frozen=True)` (structural equality by default). Validates in `__post_init__`.
- `sort` → `class Xxx(Enum): variant = auto()`.

#### Example specification

```fol
// ── E-commerce · Rich Domain Model via Finite First-Order Logic ──

sort Status   = pending | approved | rejected;
sort Role     = admin | user | guest;
sort Currency = USD | EUR | BRL;

entity User {
  id: UUID;
  active: Boolean;
  roles: Set<Role>;
}

entity Order {
  id: UUID;
  owner: User;
  status: Status;

  rule approved_requires_active_owner:
    if status = approved then active(owner);

  rule no_rejected_for_admins:
    if hasRole(owner, admin) then status != rejected;
}

value Money {
  amount: Float;
  currency: Currency;

  rule positive_amount:
    amount > 0;
}

invariant admin_always_active:
  forall u: User. hasRole(u, admin) => u.active = true;
```

#### Automatic Debug — Rule Coverage (no fixtures needed)

As you type your FOL specification, the editor automatically generates **all meaningful test scenarios** for every entity and value that has rules. No `fixture` blocks required.

For each rule, it shows:
- How many scenarios satisfy the rule (**hold**)
- How many violate it (**violations found**)
- Whether the rule is **coverable** (violations were found) or **never fires** (the rule may be vacuously true or dead)
- Concrete binding examples: which exact field values cause a violation

The scenario generator works by:
1. Walking the rule's AST to extract candidate values for every field referenced (sort variants for enum comparisons, boundary numerics for `>` / `<`, booleans for predicates, set membership for `hasRole`)
2. Generating the Cartesian product of all candidates (capped at 200 per entity to keep evaluation instant)
3. Evaluating every combination against every rule and counting results

Example output for `Order` with two rules:
```
Order entity · 54 scenarios evaluated
  approved_requires_active_owner  20 hold  4 violations  ✓ coverable
  no_rejected_for_admins          22 hold  2 violations  ✓ coverable

[violation] approved_requires_active_owner ← status=approved, owner.active=false, id=id-1
[valid] status=pending, owner.active=true, owner.roles={admin}, id=id-1
```

#### Manual Fixtures (optional — for named test cases)

You can also write named `fixture` blocks to assert specific scenarios and get PASS/FAIL results:

```fol
fixture valid_order {
  let buyer = User { id: "u-1", active: true, roles: { user } };
  let order = Order { id: "o-1", owner: buyer, status: pending };
  expect_ok order;
}

fixture rejected_for_admin_violates_rule {
  let admin = User { id: "u-2", active: true, roles: { admin } };
  let order = Order { id: "o-2", owner: admin, status: rejected };
  expect_violation no_rejected_for_admins in order;
}
```

Each `expect_ok` / `expect_violation` assertion shows **PASS** or **FAIL** with the specific rule that fired.

#### Test Code Generation

Switch the output panel to **Tests** to generate ready-to-paste test code from your fixtures:
- **Java 17+** — JUnit 5 `@Test` / `assertThrows(DomainException.class, ...)`
- **TypeScript** — Vitest `test()` / `expect(result.ok).toBe(false)`
- **Python** — pytest `def test_...` / `with pytest.raises(DomainError)`

#### Additional features
- **Live parse feedback** — errors are shown with line numbers as you type.
- **Parsed model panel** — shows sorts, entities, fields, and rules in a readable summary.
- **Syntax Reference** — collapsible, with rich cards explaining every keyword: tagline, explanation, syntax example, and generated code for all three languages.
- **FOL → RDM mapping table** — shows how each FOL keyword maps to its Rich Domain Model role in Java, TypeScript, and Python.
- **Copy & Download** — copy the generated code to clipboard or download as `.java` / `.ts` / `.py`.
- **Collapsible sidebar** — click the `‹` arrow in the sidebar header to hide the navigation and gain full-width workspace. A `›` pill appears at the left edge to restore it. On mobile, a **Menu** button appears at the top of the content area.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React 19 (Hooks, functional components) |
| Language | TypeScript — strict typing for AST and logic engine |
| Styling | Tailwind CSS v4 with an academic sand/beige theme |
| Icons | Lucide React |
| Build | Vite 6 + `@tailwindcss/vite` plugin |
| Tests | Vitest + React Testing Library + jsdom |

## Running Locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
npm test         # run test suite
npm run coverage # coverage report (≥ 80% across all metrics)
```

## Internationalisation

Switch between **English** and **Portuguese** at any time using the EN / PT buttons in the sidebar footer. All UI strings, examples, and descriptions are fully translated.

---

*Logic Hub bridges formal rigour and intuitive pedagogy — making the foundations of deductive reasoning accessible to everyone.*

---
---

# Logic Hub (Português)

O **Logic Hub** é uma aplicação web interativa e bilíngue (Inglês & Português) para o estudo de lógica formal e modelagem de domínios. Combina um tutor socrático de lógica (para aprendizado) com um editor de especificação em Lógica de Primeira Ordem que gera código Rich Domain Model pronto para produção em Java, TypeScript e Python.

---

## Funcionalidades

### 1. Tabelas-Verdade
- **Checagem de WFF** — valida a sintaxe da fórmula.
- **Contagem de Linhas** — testa o aluno na fórmula $2^n$.
- **Classificação** — oculta a coluna final e pergunta: Tautologia, Contradição ou Contingência?
- **Fundamentos Axiomáticos** — explica o Axioma da Finitude, o Princípio do Terceiro Excluído e o Princípio da Não-Contradição.

### 2. Tableau Proposicional
- **Expansão Interativa em Árvore** — construa tableaus semânticos passo a passo.
- **Seleção de Regra** — identifique o conectivo principal e escolha expansão Linear (Alfa) ou Bifurcada (Beta).

### 3. Lógica de Primeira Ordem (Semântica)
- **Expansão de Domínio** — veja como os quantificadores universal (∀) e existencial (∃) se comportam sobre um domínio finito.
- **Mapeamento Interativo** — traduza quantificadores para conectivos proposicionais (E / OU).

### 4. Cálculo de Predicados
- **Regras de Instanciação** — simule expansões de árvore tableau para lógica de predicados.
- **Regras Gama (γ) e Delta (δ)** — decida quando reutilizar uma constante existente ou instanciar uma nova.

### 5. Termos Singulares
- **Fundamentos Ontológicos** — formalize frases como "Pégaso não existe" (Frege/Russell) e aprenda se existência é predicado ou quantificador.

### 6. Quadrado Aristotélico (Oposição)
- **Inferência Interativa** — atribua valores de verdade às proposições A, E, I, O.
- **Propagação Socrática** — deduza os nós adjacentes via Contraditórias, Contrárias, Subcontrárias e Subalternas.

---

### 7. Editor de Especificação FOL

> **Escreva seu modelo de domínio em Lógica de Primeira Ordem — receba código Java, TypeScript ou Python idiomático seguindo o padrão Rich Domain Model.**

O FOL Spec Editor é uma DSL (Domain-Specific Language) criada para especificar domínios de negócio com precisão formal. Você escreve seus tipos, entidades, regras e invariantes em sintaxe FOL legível, e o editor gera código arquiteturalmente correto e pronto para produção.

#### O que você pode fazer

| Construtor | Descrição | Exemplo |
|-----------|------------|---------|
| `sort` | Enum finito fechado — todos os variantes declarados de antemão | `sort Status = pending \| approved \| rejected;` |
| `entity` | Entidade de domínio com identidade — distinguida pelo `id`, não pelo conteúdo | `entity Order { id: UUID; ... }` |
| `value` | Value Object — igualdade estrutural, sem campo de identidade | `value Money { amount: Float; ... }` |
| `rule` | Invariante escopado a uma entity/value, aplicado na construção | `rule r: amount > 0;` |
| `invariant` | Axioma FOL global abrangendo múltiplos tipos | `invariant admin_active: forall u: User. ...;` |

#### Sintaxe de expressões

| Sintaxe | Significado |
|---------|-------------|
| `if P then Q;` | Implicação legível — sempre que P vale, Q deve valer (≡ P → Q) |
| `if P then Q else R;` | Condicional — se P aplica Q, senão aplica R |
| `P => Q` / `P → Q` | Implicação (ASCII ou Unicode) |
| `P & Q` / `P ∧ Q` | Conjunção (E) |
| `P \| Q` / `P ∨ Q` | Disjunção (OU) |
| `~P` / `¬P` | Negação (NÃO) |
| `forall x: Sort. P(x);` | Quantificador universal (∀) |
| `exists x: Sort. P(x);` | Quantificador existencial (∃) |
| `field = value` | Igualdade / pertencimento a variante de sort |
| `amount > 0` | Comparação numérica (`<` `<=` `>` `>=`) |
| `active(owner)` | Predicado booleano em uma entity referenciada |
| `hasRole(user, admin)` | Predicado de pertencimento a conjunto |

#### Saída Rich Domain Model

Todo arquivo gerado segue estritamente o padrão Rich Domain Model:

**Java 17+**
- `entity` → `public final class` com campos `private final`, construtor `private`, factory `static create(...)` e `DomainException` lançada em violação de regra. `equals`/`hashCode` baseados no campo `id`.
- `value` → `public record` com construtor compacto que lança `DomainException` em violação.
- `sort` → `sealed interface` com um `record` por variante.
- Invariantes globais → comentário documentado com nota para aplicar em um domain service.

**TypeScript**
- Preâmbulo: `DomainError`, `Result<T>`, `ok()`, `err()` — **nunca lança `throw` diretamente**.
- `entity` / `value` → tipo `Readonly<{...}>` com branding + smart constructor `createXxx(...): Result<Xxx>`.
- `sort` → union type `'pending' | 'approved' | 'rejected'`.
- Violação de regra → `return err('nome_da_regra')` (sem exceções).

**Python 3.10+**
- `entity` → `@dataclass(eq=False, frozen=True)` com `__eq__`/`__hash__` explícitos por `id`. Valida em `__post_init__` com `raise DomainError`.
- `value` → `@dataclass(frozen=True)` (igualdade estrutural padrão). Valida em `__post_init__`.
- `sort` → `class Xxx(Enum): variante = auto()`.

#### Exemplo de especificação

```fol
// ── E-commerce · Rich Domain Model via Finite First-Order Logic ──

sort Status   = pending | approved | rejected;
sort Role     = admin | user | guest;
sort Currency = USD | EUR | BRL;

entity User {
  id: UUID;
  active: Boolean;
  roles: Set<Role>;
}

entity Order {
  id: UUID;
  owner: User;
  status: Status;

  rule approved_requires_active_owner:
    if status = approved then active(owner);

  rule no_rejected_for_admins:
    if hasRole(owner, admin) then status != rejected;
}

value Money {
  amount: Float;
  currency: Currency;

  rule positive_amount:
    amount > 0;
}

invariant admin_always_active:
  forall u: User. hasRole(u, admin) => u.active = true;
```

#### Debug Automático — Cobertura de Regras (sem fixtures)

Enquanto você escreve a especificação FOL, o editor gera automaticamente **todos os cenários de teste relevantes** para cada `entity` e `value` que possui regras. Sem blocos `fixture` necessários.

Para cada regra, exibe:
- Quantos cenários **satisfazem** a regra (hold)
- Quantos a **violam** (violations found)
- Se a regra é **coverable** (violações foram encontradas) ou **never fires** (a regra pode ser vacuamente verdadeira ou morta)
- Exemplos concretos: quais valores de campo causam a violação

#### Fixtures Manuais (opcional — para casos nomeados)

Você também pode escrever blocos `fixture` para asserções específicas com resultado PASS/FAIL:

```fol
fixture pedido_valido {
  let comprador = User { id: "u-1", active: true, roles: { user } };
  let pedido = Order { id: "o-1", owner: comprador, status: pending };
  expect_ok pedido;
}
```

#### Geração de Testes

Alterne o painel de saída para **Tests** para gerar código de teste a partir dos seus fixtures:
- **Java 17+** — JUnit 5 `@Test` / `assertThrows(DomainException.class, ...)`
- **TypeScript** — Vitest `test()` / `expect(result.ok).toBe(false)`
- **Python** — pytest `def test_...` / `with pytest.raises(DomainError)`

#### Funcionalidades adicionais
- **Feedback de parse em tempo real** — erros exibidos com número de linha enquanto você digita.
- **Painel de modelo analisado** — mostra sorts, entidades, campos e regras em resumo legível.
- **Referência de Sintaxe** — cartões ricos explicando cada keyword: tagline, explicação, exemplo de sintaxe e código gerado para as três linguagens.
- **Tabela FOL → RDM** — mostra como cada keyword FOL mapeia para seu papel no Rich Domain Model em Java, TypeScript e Python.
- **Copiar & Baixar** — copie o código gerado ou baixe como `.java` / `.ts` / `.py`.
- **Sidebar colapsável** — clique na seta `‹` no cabeçalho da sidebar para ocultar a navegação e ganhar espaço total. Uma aba `›` aparece na borda esquerda para restaurar. Em mobile, um botão **Menu** aparece no topo do conteúdo.

---

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
npm run coverage # relatório de cobertura (≥ 80% em todas as métricas)
```

## Internacionalização

Alterne entre **Inglês** e **Português** a qualquer momento usando os botões EN / PT no rodapé do menu lateral. Todas as strings de interface, exemplos e descrições pedagógicas estão completamente traduzidos.

---

*O Logic Hub une rigor formal e pedagogia intuitiva — tornando os fundamentos do raciocínio dedutivo acessíveis a todos.*
