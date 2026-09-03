# Logic Hub

Uma aplicação web interativa e bilíngue (Inglês & Português) para o estudo de lógica formal e modelagem de domínios. Combina um tutor socrático de lógica com um editor de especificação em Lógica de Primeira Ordem que gera código Rich Domain Model pronto para produção em Java, TypeScript e Python.

---

## Ferramentas

### 1. Tabelas-Verdade

Gera tabelas-verdade exaustivas para fórmulas proposicionais com feedback pedagógico.

- **Checagem de WFF:** valida se a sintaxe da fórmula digitada está correta.
- **Contagem de linhas:** aplica a fórmula $2^n$ para calcular o número correto de linhas.
- **Classificação automática:** Tautologia, Contradição ou Contingência — com justificativa.
- **Fundamentos axiomáticos:** Axioma da Finitude, Princípio do Terceiro Excluído, Princípio da Não-Contradição.
- Sintaxe: variáveis A–Z, `&` (E), `|` (OU), `->` (IMPLICA), `~` ou `!` (NÃO).

### 2. Termos Singulares (Filosofia da Linguagem)

Formalização passo a passo de frases da linguagem natural em lógica de predicados.

- *Nomes próprios:* "Sócrates é mortal" → `M(s)`
- *Existenciais negativos:* "Pégaso não existe" → `¬∃x P(x)`
- *Descrições definidas de Russell:* "O atual rei da França é careca" → `∃x (K(x) ∧ ∀y(K(y)→y=x) ∧ C(x))`

### 3. Tableau Proposicional

Construtor de árvores semânticas dinâmico e animado.

- **Heurística positiva:** explora a fórmula diretamente para extrair todos os modelos satisfatíveis dos ramos abertos.
- **Regras Alfa (Linear) e Beta (Bifurcada):** cada passo exibe um balão pedagógico explicando a regra aplicada (De Morgan, Dupla Negação, etc.).

### 4. Lógica de Primeira Ordem (Semântica)

Demonstra como os quantificadores operam sobre um domínio finito.

- `∀x` se expande numa conjunção sobre cada elemento do domínio.
- `∃x` se expande numa disjunção sobre cada elemento do domínio.
- A substituição de variáveis é mostrada passo a passo.

### 5. Cálculo de Predicados (Regras de Tableau)

Aplicação visual das regras de instanciação γ/δ.

- A instanciação existencial (δ) introduz uma constante nova.
- A instanciação universal (γ) aplica-se a todas as constantes conhecidas.
- Detecção automática de contradições fecha o ramo.

### 6. Quadrado Aristotélico (Oposição)

Simulador interativo da lógica categórica clássica (A, E, I, O).

- Atribua Verdadeiro/Falso a qualquer proposição.
- O valor de verdade se propaga pelas relações de Contrariedade, Subcontrariedade, Contradição e Subalternação, com explicação a cada consequência.

---

### 7. Editor de Especificação FOL

> **Escreva seu modelo de domínio em Lógica de Primeira Ordem — receba código Java, TypeScript ou Python idiomático seguindo o padrão Rich Domain Model.**

O FOL Spec Editor é uma DSL (Domain-Specific Language) criada para especificar domínios de negócio com precisão formal. Você escreve tipos, entidades, regras e invariantes em sintaxe FOL legível — e o editor gera código arquiteturalmente correto e pronto para produção em três linguagens.

#### O que você pode escrever

##### `sort` — Enum finito fechado

Declara um conjunto fixo de variantes. Todos os valores possíveis são listados de antemão — nenhum outro pode existir. Use como tipo de campo dentro de `entity` e `value`.

```
sort Status   = pending | approved | rejected;
sort Role     = admin | user | guest;
sort Currency = USD | EUR | BRL;
```

Gerado como:
- **Java:** `sealed interface Status permits Pending, Approved, Rejected {}` + um `record` por variante
- **TypeScript:** `type Status = 'pending' | 'approved' | 'rejected'`
- **Python:** `class Status(Enum): pending = auto() ...`

---

##### `entity` — Entidade com identidade

Objetos distinguidos pelo campo `id`, não pelo conteúdo. Dois objetos com dados idênticos mas `id` diferente são entidades diferentes. As `rule`s internas são verificadas na construção — violação impede a criação do objeto.

```
entity Order {
  id: UUID;
  owner: User;
  status: Status;

  rule approved_requires_active_owner:
    if status = approved then active(owner);

  rule no_rejected_for_admins:
    if hasRole(owner, admin) then status != rejected;
}
```

Gerado como:
- **Java:** `public final class` + campos `private final` + construtor `private` + `static create(...)` + `DomainException` + `equals`/`hashCode` por `id`
- **TypeScript:** branded type + `createOrder(...): Result<Order>` + `return err('rule')` em violação
- **Python:** `@dataclass(eq=False, frozen=True)` + `__eq__`/`__hash__` por `id` + `__post_init__` com `raise DomainError`

---

##### `value` — Value Object (igualdade estrutural)

Dois objetos com os mesmos campos são sempre iguais, independentemente de onde vieram. Sem campo `id`. Ideal para: Money, Coordenadas, Email, Medidas — coisas definidas puramente pelo conteúdo.

```
value Money {
  amount: Float;
  currency: Currency;

  rule positive_amount:
    amount > 0;
}
```

Gerado como:
- **Java:** `public record Money(double amount, Currency currency)` + compact constructor com `DomainException`
- **TypeScript:** branded type + `createMoney(...): Result<Money>`
- **Python:** `@dataclass(frozen=True)` (igualdade estrutural padrão) + `__post_init__` com `raise DomainError`

---

##### `rule` — Invariante escopado (dentro de entity/value)

Verificado na construção. Violação **rejeita o objeto** — ele simplesmente não pode existir em estado inválido.

```
rule positive_amount:
  amount > 0;

rule approved_needs_active_owner:
  if status = approved then active(owner);
```

Gerado como:
- **Java:** `if (violation) throw new DomainException("nome_da_regra")`
- **TypeScript:** `if (violation) return err('nome_da_regra')`
- **Python:** `if violation: raise DomainError("nome_da_regra")`

---

##### `invariant` — Axioma FOL global

Abrange múltiplos tipos de entidade. Não pode ser aplicado na construção (cruza fronteiras de agregado). Gerado como comentário documentado — implemente manualmente em um domain service, policy object ou validador de repositório.

```
invariant admin_always_active:
  forall u: User. hasRole(u, admin) => u.active = true;
```

---

#### Sintaxe de expressões completa

| Sintaxe | Significado |
|---------|-------------|
| `if P then Q;` | Implicação legível — sempre que P vale, Q deve valer |
| `if P then Q else R;` | Condicional — se P aplica Q, senão aplica R |
| `P => Q` / `P → Q` | Implicação (ASCII ou Unicode) |
| `P & Q` / `P ∧ Q` | Conjunção (E) |
| `P \| Q` / `P ∨ Q` | Disjunção (OU) |
| `~P` / `¬P` | Negação (NÃO) |
| `forall x: Sort. P(x);` | Quantificador universal (∀) |
| `exists x: Sort. P(x);` | Quantificador existencial (∃) |
| `field = valor` | Igualdade / pertencimento a variante de sort |
| `field != valor` | Inequalidade |
| `amount > 0` | Comparação numérica (`<` `<=` `>` `>=`) |
| `active(owner)` | Predicado booleano em entity referenciada |
| `hasRole(user, admin)` | Pertencimento a `Set<Sort>` em entity referenciada |
| `u.active = true` | Acesso encadeado por ponto em variável quantificada |

#### Tipos de campo disponíveis

| Tipo | Descrição |
|------|-----------|
| `String` `Boolean` `Int` `Float` `UUID` | Primitivos |
| `Set<NomeDoSort>` `List<NomeDoSort>` | Coleções |
| `OutraEntity` | Referência a outra entity (por identidade, não embutida) |

#### Fixtures (casos de teste nomeados)

Escreva blocos `fixture` para definir cenários nomeados com resultados esperados:

```fol
fixture pedido_valido {
  let comprador = User { id: "u-1", active: true, roles: { user } };
  let pedido = Order { id: "o-1", owner: comprador, status: pending };
  expect_ok pedido;
}

fixture admin_nao_pode_rejected {
  let admin = User { id: "u-2", active: true, roles: { admin } };
  let pedido = Order { id: "o-2", owner: admin, status: rejected };
  expect_violation no_rejected_for_admins in pedido;
}
```

#### Step Debugger

Cada fixture alimenta um **Step Debugger** ao vivo — como o debugger do IntelliJ/VSCode, mas para as suas regras FOL. Aparece automaticamente quando há fixtures definidas, sem nenhuma configuração.

```
┌─────────────────────────────────────────────────────────┐
│ Step Debugger  pedido_valido ▾  expect_ok pedido ▾  rule ▾│
│ ⏮  ◀  Step 2/3  ▶  ⏭  ▶▶                               │
├─────────────────────────────────────────────────────────┤
│ Bindings                                                │
│   status = pending   owner.active = true   id = u-1    │
├─────────────────────────────────────────────────────────┤
│ ✓  status = approved                false              │
│ ⚡  active(owner)                   [atual]            │
│ ·  (if status = approved then ...)  futuro             │
└─────────────────────────────────────────────────────────┘
```

- Selecione qualquer **fixture**, **expect** e **regra** para traçar
- Avance manualmente com ◀ ▶, pule ao final com ⏭, ou use auto-play a 650 ms/passo com ▶▶
- Cada sub-expressão aparece **indentada pela profundidade** na árvore de avaliação
- Step atual: destaque âmbar ⚡
- Steps passados: ✓ verde (verdadeiro) / ✗ vermelho (falso)
- Steps curto-circuitados: ⟳ cinza + riscado (não avaliados por short-circuit de `∧`/`∨`/`→`)
- Steps futuros: opacos
- Veredicto final no último step: **rule holds — object is VALID** (verde) ou **rule violated — construction REJECTED** (vermelho)

#### Funcionalidades adicionais do editor

- **Feedback de parse em tempo real** — erros com número de linha enquanto você digita; `OK` quando o modelo está válido.
- **Painel de modelo analisado** — resumo legível: sorts, entidades, campos e regras.
- **Referência de Sintaxe** — cartões ricos por keyword: tagline, explicação completa, exemplo de sintaxe e código gerado para todas as linguagens. Seções: Domain Types, Constraints, Conditionals & Operators, Quantifiers, Atoms, Field Types.
- **Tabela FOL → RDM** — mostra como cada keyword FOL mapeia para seu papel RDM em Java, TypeScript e Python.
- **Abas de linguagem** — alterne entre Java, TypeScript e Python com um clique.
- **Copiar & Baixar** — copie o código para a área de transferência ou baixe como `.java` / `.ts` / `.py`.
- **`;` obrigatório** — ponto-e-vírgula é exigido em declarações de sort, campos e corpos de regra — erro de parse caso esteja ausente.
- **Sidebar colapsável** — clique na seta `‹` no cabeçalho da barra lateral para recolher a navegação e ter workspace completo. Uma aba `›` fica visível na borda esquerda para restaurar. Em mobile, aparece um botão **Menu** no topo do conteúdo.

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
