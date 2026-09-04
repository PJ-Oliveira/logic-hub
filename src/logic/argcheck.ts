import { parseFormula, evaluateAST, getVariables, type ASTNode } from '../tableau';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FallacyEntry = {
  id: string;
  name: { en: string; pt: string };
  latin: string;
  form: string;
  category: 'formal' | 'informal';
  detectable: boolean;
  description: { en: string; pt: string };
  example: { en: string; pt: string };
};

export type ValidFormEntry = {
  id: string;
  name: { en: string; pt: string };
  latin: string;
  form: string;
  description: { en: string; pt: string };
};

export type TableRow = {
  assignment: Record<string, boolean>;
  premiseVals: boolean[];
  conclusionVal: boolean;
  allPremisesTrue: boolean;
  isCounterexample: boolean;
};

export type ArgumentCheckResult = {
  ok: true;
  valid: boolean;
  variables: string[];
  rows: TableRow[];
  counterexamples: TableRow[];
  detectedFallacy: FallacyEntry | null;
  detectedForm: ValidFormEntry | null;
  premiseTrees: ASTNode[];
  conclusionTree: ASTNode;
};

export type ArgumentCheckError = {
  ok: false;
  error: string;
  field: 'premise' | 'conclusion';
  index: number;
};

// ─── Fallacy Catalog ──────────────────────────────────────────────────────────

export const FALLACY_CATALOG: FallacyEntry[] = [
  // ── Formal (detectable via truth table) ──────────────────────────────────
  {
    id: 'affirming_consequent',
    name: { en: 'Affirming the Consequent', pt: 'Afirmação do Consequente' },
    latin: 'Consequens Affirmans',
    form: 'P → Q, Q ⊢ P',
    category: 'formal',
    detectable: true,
    description: {
      en: 'Treats implication as reversible. P → Q means P is sufficient for Q — not that Q is sufficient for P. Q may arise from other causes.',
      pt: 'Trata a implicação como reversível. P → Q significa que P é suficiente para Q — não que Q seja suficiente para P. Q pode ter outras causas.',
    },
    example: {
      en: '"If it rains the ground is wet. The ground is wet. Therefore it rained." (The sprinkler could be on.)',
      pt: '"Se chove o chão fica molhado. O chão está molhado. Logo choveu." (O aspersor pode estar ligado.)',
    },
  },
  {
    id: 'denying_antecedent',
    name: { en: 'Denying the Antecedent', pt: 'Negação do Antecedente' },
    latin: 'Antecedens Negans',
    form: 'P → Q, ¬P ⊢ ¬Q',
    category: 'formal',
    detectable: true,
    description: {
      en: 'P → Q means P is sufficient for Q, not necessary. The absence of P does not guarantee the absence of Q.',
      pt: 'P → Q significa que P é suficiente para Q, não necessário. A ausência de P não garante a ausência de Q.',
    },
    example: {
      en: '"If I study, I pass. I did not study. Therefore I did not pass." (Could pass for other reasons.)',
      pt: '"Se eu estudar, passo. Não estudei. Logo não passei." (Poderia passar por outras razões.)',
    },
  },
  {
    id: 'affirming_disjunct',
    name: { en: 'Affirming a Disjunct', pt: 'Afirmação do Disjunto' },
    latin: 'Affirmatio Alterius',
    form: 'P ∨ Q, P ⊢ ¬Q',
    category: 'formal',
    detectable: true,
    description: {
      en: 'Logical OR is inclusive: P ∨ Q allows both to be true simultaneously. Affirming one does not exclude the other.',
      pt: 'O OU lógico é inclusivo: P ∨ Q permite que ambos sejam verdadeiros. Afirmar um não exclui o outro.',
    },
    example: {
      en: '"She is a doctor or a nurse. She is a doctor. Therefore she is not a nurse." (She could be both.)',
      pt: '"Ela é médica ou enfermeira. Ela é médica. Logo não é enfermeira." (Ela poderia ser as duas.)',
    },
  },
  {
    id: 'undistributed_middle',
    name: { en: 'Undistributed Middle', pt: 'Médio Não Distribuído' },
    latin: 'Non Distributio Medii',
    form: 'M → P, M → S ⊢ S → P',
    category: 'formal',
    detectable: true,
    description: {
      en: 'A shared antecedent M does not create a link between its consequents P and S. Both following from M does not mean one implies the other.',
      pt: 'Um antecedente comum M não cria vínculo entre seus consequentes P e S. Ambos seguirem de M não significa que um implica o outro.',
    },
    example: {
      en: '"All dogs are mammals. All cats are mammals. Therefore all dogs are cats."',
      pt: '"Todo cão é mamífero. Todo gato é mamífero. Logo todo cão é gato."',
    },
  },
  {
    id: 'begging_question',
    name: { en: 'Begging the Question', pt: 'Petição de Princípio' },
    latin: 'Petitio Principii',
    form: 'P ⊢ P',
    category: 'formal',
    detectable: true,
    description: {
      en: 'The conclusion is identical to a premise. Technically valid, but circular — it proves nothing new and presupposes what must be demonstrated.',
      pt: 'A conclusão é idêntica a uma premissa. Tecnicamente válido, mas circular — não prova nada novo e pressupõe o que deve ser demonstrado.',
    },
    example: {
      en: '"The Bible is true because the Bible says it is true."',
      pt: '"A Bíblia é verdadeira porque a Bíblia diz que é verdadeira."',
    },
  },
  // ── Informal (catalog / reference only) ──────────────────────────────────
  {
    id: 'ad_hominem',
    name: { en: 'Ad Hominem', pt: 'Ad Hominem' },
    latin: 'Ad Hominem',
    form: 'X has flaw Y. X claims P. ∴ ¬P.',
    category: 'informal',
    detectable: false,
    description: {
      en: 'Attacking the person making the argument rather than the argument itself. The speaker\'s character is irrelevant to the truth of their claim.',
      pt: 'Atacar a pessoa que faz o argumento, e não o argumento em si. O caráter do falante é irrelevante para a verdade da afirmação.',
    },
    example: {
      en: '"Don\'t take her economics advice — she\'s never run a business."',
      pt: '"Não siga os conselhos econômicos dela — ela nunca administrou uma empresa."',
    },
  },
  {
    id: 'appeal_authority',
    name: { en: 'Appeal to Authority', pt: 'Apelo à Autoridade' },
    latin: 'Ad Verecundiam',
    form: 'X is an authority. X says P. ∴ P.',
    category: 'informal',
    detectable: false,
    description: {
      en: 'Citing authority as proof, ignoring that experts can be wrong, biased, or speaking outside their area of expertise.',
      pt: 'Citar autoridade como prova, ignorando que especialistas podem errar, ser tendenciosos ou falar fora de sua área.',
    },
    example: {
      en: '"My doctor said homeopathy works, so it must be effective."',
      pt: '"Meu médico disse que homeopatia funciona, então deve ser eficaz."',
    },
  },
  {
    id: 'slippery_slope',
    name: { en: 'Slippery Slope', pt: 'Declive Escorregadio' },
    latin: 'Domino',
    form: 'A → B → C → … → Z (extreme). ∴ ¬A.',
    category: 'informal',
    detectable: false,
    description: {
      en: 'Claiming one step will inevitably lead to extreme consequences without justifying each causal link in the chain.',
      pt: 'Afirmar que um passo levará inevitavelmente a consequências extremas sem justificar cada elo causal da cadeia.',
    },
    example: {
      en: '"If we allow euthanasia, we\'ll soon be killing anyone inconvenient to society."',
      pt: '"Se permitirmos a eutanásia, logo estaremos matando qualquer pessoa inconveniente à sociedade."',
    },
  },
  {
    id: 'post_hoc',
    name: { en: 'Post Hoc Ergo Propter Hoc', pt: 'Post Hoc Ergo Propter Hoc' },
    latin: 'Post Hoc',
    form: 'A before B. ∴ A caused B.',
    category: 'informal',
    detectable: false,
    description: {
      en: 'Confusing temporal succession with causation. B following A does not prove A caused B.',
      pt: 'Confundir sucessão temporal com causalidade. B ocorrer após A não prova que A causou B.',
    },
    example: {
      en: '"I wore my lucky socks and won the match. The socks caused my victory."',
      pt: '"Usei minhas meias da sorte e ganhei a partida. As meias causaram minha vitória."',
    },
  },
  {
    id: 'false_dichotomy',
    name: { en: 'False Dichotomy', pt: 'Falso Dilema' },
    latin: 'Bifurcatio',
    form: 'P ∨ Q (presented as exhaustive). ¬P. ∴ Q.',
    category: 'informal',
    detectable: false,
    description: {
      en: 'Presenting only two alternatives as if they exhaust all possibilities, when more options actually exist.',
      pt: 'Apresentar apenas duas alternativas como se esgotassem todas as possibilidades, quando de fato existem mais.',
    },
    example: {
      en: '"You\'re either with us or against us." (Many degrees of agreement exist.)',
      pt: '"Você está conosco ou contra nós." (Existem muitos graus de concordância.)',
    },
  },
  {
    id: 'hasty_generalization',
    name: { en: 'Hasty Generalization', pt: 'Generalização Apressada' },
    latin: 'Dicto Simpliciter',
    form: 'P(a₁), P(a₂), … ⊢ ∀x P(x)',
    category: 'informal',
    detectable: false,
    description: {
      en: 'Drawing a universal conclusion from a sample that is too small or unrepresentative.',
      pt: 'Tirar uma conclusão universal a partir de uma amostra muito pequena ou não representativa.',
    },
    example: {
      en: '"The three students I met were hardworking, so all students are hardworking."',
      pt: '"Os três alunos que conheci eram dedicados, logo todos os alunos são dedicados."',
    },
  },
  {
    id: 'straw_man',
    name: { en: 'Straw Man', pt: 'Espantalho' },
    latin: 'Homo Stramineus',
    form: 'X says P. Distort P to P\'. P\' is false. ∴ ¬P.',
    category: 'informal',
    detectable: false,
    description: {
      en: 'Misrepresenting an argument so it becomes easier to attack, then refuting the distorted version.',
      pt: 'Distorcer um argumento para que fique mais fácil de atacar, depois refutando a versão distorcida.',
    },
    example: {
      en: '"They want stricter gun laws." → "They want to confiscate every gun in the country!"',
      pt: '"Querem leis de armas mais rígidas." → "Querem confiscar todas as armas do país!"',
    },
  },
  {
    id: 'ad_populum',
    name: { en: 'Appeal to the Masses', pt: 'Apelo à Maioria' },
    latin: 'Ad Populum',
    form: 'Most people believe P. ∴ P.',
    category: 'informal',
    detectable: false,
    description: {
      en: 'Claiming that majority belief establishes truth. Once, most people believed the Earth was flat.',
      pt: 'Afirmar que a crença da maioria estabelece a verdade. Outrora, a maioria acreditava que a Terra era plana.',
    },
    example: {
      en: '"Billions believe in astrology — it must have some truth."',
      pt: '"Bilhões acreditam em astrologia — deve ter algo de verdade."',
    },
  },
  {
    id: 'appeal_ignorance',
    name: { en: 'Appeal to Ignorance', pt: 'Apelo à Ignorância' },
    latin: 'Ad Ignorantiam',
    form: 'No proof of ¬P. ∴ P.',
    category: 'informal',
    detectable: false,
    description: {
      en: 'Claiming something is true because it has not been proven false. Absence of evidence is not evidence of absence.',
      pt: 'Afirmar que algo é verdadeiro porque não foi provado falso. Ausência de evidência não é evidência de ausência.',
    },
    example: {
      en: '"No one has proven aliens don\'t exist, so they must."',
      pt: '"Ninguém provou que extraterrestres não existem, logo eles devem existir."',
    },
  },
  {
    id: 'red_herring',
    name: { en: 'Red Herring', pt: 'Pista Falsa' },
    latin: 'Ignoratio Elenchi',
    form: 'Issue A raised. Irrelevant B introduced. B resolved. ∴ A resolved.',
    category: 'informal',
    detectable: false,
    description: {
      en: 'Diverting attention from the actual argument by introducing an irrelevant issue and addressing that instead.',
      pt: 'Desviar atenção do argumento real introduzindo uma questão irrelevante e abordando-a em vez do original.',
    },
    example: {
      en: '"Why worry about police brutality when crime rates are so high?"',
      pt: '"Por que se preocupar com brutalidade policial quando as taxas de criminalidade são tão altas?"',
    },
  },
];

// ─── Valid Form Catalog ───────────────────────────────────────────────────────

export const VALID_FORMS: ValidFormEntry[] = [
  {
    id: 'modus_ponens',
    name: { en: 'Modus Ponens', pt: 'Modus Ponens' },
    latin: 'Modus Ponendo Ponens',
    form: 'P → Q, P ⊢ Q',
    description: {
      en: 'If P implies Q and P is true, then Q must be true. The fundamental rule of conditional elimination.',
      pt: 'Se P implica Q e P é verdadeiro, então Q deve ser verdadeiro. A regra fundamental de eliminação de condicionais.',
    },
  },
  {
    id: 'modus_tollens',
    name: { en: 'Modus Tollens', pt: 'Modus Tollens' },
    latin: 'Modus Tollendo Tollens',
    form: 'P → Q, ¬Q ⊢ ¬P',
    description: {
      en: 'If P implies Q and Q is false, then P must be false. The contrapositive rule.',
      pt: 'Se P implica Q e Q é falso, então P deve ser falso. A regra da contrapositiva.',
    },
  },
  {
    id: 'hypothetical_syllogism',
    name: { en: 'Hypothetical Syllogism', pt: 'Silogismo Hipotético' },
    latin: 'Syllogismus Hypotheticus',
    form: 'P → Q, Q → R ⊢ P → R',
    description: {
      en: 'Implication is transitive: if P implies Q and Q implies R, then P implies R.',
      pt: 'A implicação é transitiva: se P implica Q e Q implica R, então P implica R.',
    },
  },
  {
    id: 'disjunctive_syllogism',
    name: { en: 'Disjunctive Syllogism', pt: 'Silogismo Disjuntivo' },
    latin: 'Modus Tollendo Ponens',
    form: 'P ∨ Q, ¬P ⊢ Q',
    description: {
      en: 'If at least one of P or Q must be true and P is false, then Q must be true.',
      pt: 'Se pelo menos um de P ou Q deve ser verdadeiro e P é falso, então Q deve ser verdadeiro.',
    },
  },
  {
    id: 'constructive_dilemma',
    name: { en: 'Constructive Dilemma', pt: 'Dilema Construtivo' },
    latin: 'Disjunctio Constructiva',
    form: 'P → Q, R → S, P ∨ R ⊢ Q ∨ S',
    description: {
      en: 'If both conditionals hold and at least one antecedent is true, at least one consequent must be true.',
      pt: 'Se ambos os condicionais valem e pelo menos um antecedente é verdadeiro, pelo menos um consequente deve ser verdadeiro.',
    },
  },
  {
    id: 'simplification',
    name: { en: 'Simplification', pt: 'Simplificação' },
    latin: 'Simplificatio',
    form: 'P ∧ Q ⊢ P',
    description: {
      en: 'If a conjunction is true, each conjunct is individually true.',
      pt: 'Se uma conjunção é verdadeira, cada conjunto é individualmente verdadeiro.',
    },
  },
  {
    id: 'conjunction',
    name: { en: 'Conjunction', pt: 'Conjunção' },
    latin: 'Coniunctio',
    form: 'P, Q ⊢ P ∧ Q',
    description: {
      en: 'If P and Q are each true separately, then P ∧ Q is true.',
      pt: 'Se P e Q são verdadeiros separadamente, então P ∧ Q é verdadeiro.',
    },
  },
  {
    id: 'addition',
    name: { en: 'Addition', pt: 'Adição' },
    latin: 'Additio',
    form: 'P ⊢ P ∨ Q',
    description: {
      en: 'If P is true, then P ∨ Q is true regardless of Q.',
      pt: 'Se P é verdadeiro, então P ∨ Q é verdadeiro independentemente de Q.',
    },
  },
];

// ─── Structural Equality ──────────────────────────────────────────────────────

function astEqual(a: ASTNode, b: ASTNode): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'VAR') return a.name === b.name;
  if (a.type === 'NOT') return astEqual(a.left!, b.left!);
  return astEqual(a.left!, b.left!) && astEqual(a.right!, b.right!);
}

// ─── Fallacy Pattern Matchers ─────────────────────────────────────────────────

function matchAffirmingConsequent(premises: ASTNode[], conclusion: ASTNode): boolean {
  for (const p1 of premises) {
    if (p1.type !== 'IMPLIES') continue;
    const ant = p1.left!;
    const con = p1.right!;
    for (const p2 of premises) {
      if (p2 === p1) continue;
      if (astEqual(p2, con) && astEqual(conclusion, ant)) return true;
    }
  }
  return false;
}

function matchDenyingAntecedent(premises: ASTNode[], conclusion: ASTNode): boolean {
  for (const p1 of premises) {
    if (p1.type !== 'IMPLIES') continue;
    const ant = p1.left!;
    const con = p1.right!;
    const negAnt: ASTNode = { type: 'NOT', left: ant };
    const negCon: ASTNode = { type: 'NOT', left: con };
    for (const p2 of premises) {
      if (p2 === p1) continue;
      if (astEqual(p2, negAnt) && astEqual(conclusion, negCon)) return true;
    }
  }
  return false;
}

function matchAffirmingDisjunct(premises: ASTNode[], conclusion: ASTNode): boolean {
  for (const p1 of premises) {
    if (p1.type !== 'OR') continue;
    const L = p1.left!;
    const R = p1.right!;
    for (const p2 of premises) {
      if (p2 === p1) continue;
      if (astEqual(p2, L) && conclusion.type === 'NOT' && astEqual(conclusion.left!, R)) return true;
      if (astEqual(p2, R) && conclusion.type === 'NOT' && astEqual(conclusion.left!, L)) return true;
    }
  }
  return false;
}

function matchUndistributedMiddle(premises: ASTNode[], conclusion: ASTNode): boolean {
  if (conclusion.type !== 'IMPLIES') return false;
  const concAnt = conclusion.left!;
  const concCon = conclusion.right!;
  for (let i = 0; i < premises.length; i++) {
    if (premises[i].type !== 'IMPLIES') continue;
    for (let j = i + 1; j < premises.length; j++) {
      if (premises[j].type !== 'IMPLIES') continue;
      const p1 = premises[i];
      const p2 = premises[j];
      if (!astEqual(p1.left!, p2.left!)) continue;
      const P = p1.right!;
      const S = p2.right!;
      if ((astEqual(concAnt, S) && astEqual(concCon, P)) ||
          (astEqual(concAnt, P) && astEqual(concCon, S))) return true;
    }
  }
  return false;
}

function matchBeggingQuestion(premises: ASTNode[], conclusion: ASTNode): boolean {
  return premises.some(p => astEqual(p, conclusion));
}

// ─── Valid Form Matchers ──────────────────────────────────────────────────────

function matchModusPonens(premises: ASTNode[], conclusion: ASTNode): boolean {
  for (const p1 of premises) {
    if (p1.type !== 'IMPLIES') continue;
    const ant = p1.left!;
    const con = p1.right!;
    for (const p2 of premises) {
      if (p2 === p1) continue;
      if (astEqual(p2, ant) && astEqual(conclusion, con)) return true;
    }
  }
  return false;
}

function matchModusTollens(premises: ASTNode[], conclusion: ASTNode): boolean {
  for (const p1 of premises) {
    if (p1.type !== 'IMPLIES') continue;
    const ant = p1.left!;
    const con = p1.right!;
    const negCon: ASTNode = { type: 'NOT', left: con };
    const negAnt: ASTNode = { type: 'NOT', left: ant };
    for (const p2 of premises) {
      if (p2 === p1) continue;
      if (astEqual(p2, negCon) && astEqual(conclusion, negAnt)) return true;
    }
  }
  return false;
}

function matchHypotheticalSyllogism(premises: ASTNode[], conclusion: ASTNode): boolean {
  if (conclusion.type !== 'IMPLIES') return false;
  const concAnt = conclusion.left!;
  const concCon = conclusion.right!;
  for (const p1 of premises) {
    if (p1.type !== 'IMPLIES' || !astEqual(p1.left!, concAnt)) continue;
    const Q = p1.right!;
    for (const p2 of premises) {
      if (p2 === p1 || p2.type !== 'IMPLIES') continue;
      if (astEqual(p2.left!, Q) && astEqual(p2.right!, concCon)) return true;
    }
  }
  return false;
}

function matchDisjunctiveSyllogism(premises: ASTNode[], conclusion: ASTNode): boolean {
  for (const p1 of premises) {
    if (p1.type !== 'OR') continue;
    const L = p1.left!;
    const R = p1.right!;
    for (const p2 of premises) {
      if (p2 === p1) continue;
      if (p2.type === 'NOT' && astEqual(p2.left!, L) && astEqual(conclusion, R)) return true;
      if (p2.type === 'NOT' && astEqual(p2.left!, R) && astEqual(conclusion, L)) return true;
    }
  }
  return false;
}

function matchSimplification(premises: ASTNode[], conclusion: ASTNode): boolean {
  for (const p of premises) {
    if (p.type !== 'AND') continue;
    if (astEqual(p.left!, conclusion) || astEqual(p.right!, conclusion)) return true;
  }
  return false;
}

function matchConjunction(premises: ASTNode[], conclusion: ASTNode): boolean {
  if (conclusion.type !== 'AND') return false;
  const L = conclusion.left!;
  const R = conclusion.right!;
  return premises.some(p => astEqual(p, L)) && premises.some(p => astEqual(p, R));
}

function matchAddition(premises: ASTNode[], conclusion: ASTNode): boolean {
  if (conclusion.type !== 'OR') return false;
  const L = conclusion.left!;
  const R = conclusion.right!;
  return premises.some(p => astEqual(p, L) || astEqual(p, R));
}

function matchConstructiveDilemma(premises: ASTNode[], conclusion: ASTNode): boolean {
  if (conclusion.type !== 'OR') return false;
  const Q = conclusion.left!;
  const S = conclusion.right!;
  for (const p1 of premises) {
    if (p1.type !== 'IMPLIES' || !astEqual(p1.right!, Q)) continue;
    const P = p1.left!;
    for (const p2 of premises) {
      if (p2 === p1 || p2.type !== 'IMPLIES' || !astEqual(p2.right!, S)) continue;
      const R = p2.left!;
      const disj: ASTNode = { type: 'OR', left: P, right: R };
      if (premises.some(p => p !== p1 && p !== p2 && astEqual(p, disj))) return true;
    }
  }
  return false;
}

// ─── Formula Normalization ────────────────────────────────────────────────────

export function normalizeFormula(s: string): string {
  return s
    .replace(/→/g, '->')
    .replace(/∧/g, '&')
    .replace(/∨/g, '|')
    .replace(/¬/g, '~')
    .replace(/↔/g, '<->');
}

export function displayFormula(s: string): string {
  return s
    .replace(/->/g, '→')
    .replace(/&/g, '∧')
    .replace(/\|/g, '∨')
    .replace(/~/g, '¬')
    .replace(/!/g, '¬');
}

// ─── Main Checker ─────────────────────────────────────────────────────────────

export function checkArgument(
  premises: string[],
  conclusion: string,
): ArgumentCheckResult | ArgumentCheckError {
  const premiseTrees: ASTNode[] = [];
  for (let i = 0; i < premises.length; i++) {
    const norm = normalizeFormula(premises[i].trim());
    const t = parseFormula(norm);
    if (!t) return { ok: false, error: `"${premises[i]}"`, field: 'premise', index: i };
    premiseTrees.push(t);
  }

  const normCon = normalizeFormula(conclusion.trim());
  const conclusionTree = parseFormula(normCon);
  if (!conclusionTree) return { ok: false, error: `"${conclusion}"`, field: 'conclusion', index: 0 };

  // Collect all variables (stable sort)
  const varSet = new Set<string>();
  for (const t of premiseTrees) for (const v of getVariables(t)) varSet.add(v);
  for (const v of getVariables(conclusionTree)) varSet.add(v);
  const variables = Array.from(varSet).sort();

  const n = variables.length;
  const rows: TableRow[] = [];

  // Enumerate all truth assignments, most-significant variable first (T,T,... first row)
  for (let mask = (1 << n) - 1; mask >= 0; mask--) {
    const assignment: Record<string, boolean> = {};
    for (let i = 0; i < n; i++) {
      assignment[variables[i]] = Boolean((mask >> (n - 1 - i)) & 1);
    }
    const premiseVals = premiseTrees.map(t => evaluateAST(t, assignment));
    const conclusionVal = evaluateAST(conclusionTree, assignment);
    const allPremisesTrue = premiseVals.every(Boolean);
    const isCounterexample = allPremisesTrue && !conclusionVal;
    rows.push({ assignment, premiseVals, conclusionVal, allPremisesTrue, isCounterexample });
  }

  const counterexamples = rows.filter(r => r.isCounterexample);
  const valid = counterexamples.length === 0;

  let detectedFallacy: FallacyEntry | null = null;
  let detectedForm: ValidFormEntry | null = null;

  if (!valid) {
    if (matchAffirmingConsequent(premiseTrees, conclusionTree))
      detectedFallacy = FALLACY_CATALOG.find(f => f.id === 'affirming_consequent') ?? null;
    else if (matchDenyingAntecedent(premiseTrees, conclusionTree))
      detectedFallacy = FALLACY_CATALOG.find(f => f.id === 'denying_antecedent') ?? null;
    else if (matchAffirmingDisjunct(premiseTrees, conclusionTree))
      detectedFallacy = FALLACY_CATALOG.find(f => f.id === 'affirming_disjunct') ?? null;
    else if (matchUndistributedMiddle(premiseTrees, conclusionTree))
      detectedFallacy = FALLACY_CATALOG.find(f => f.id === 'undistributed_middle') ?? null;
  } else {
    if (matchBeggingQuestion(premiseTrees, conclusionTree)) {
      detectedFallacy = FALLACY_CATALOG.find(f => f.id === 'begging_question') ?? null;
    } else if (matchModusPonens(premiseTrees, conclusionTree)) {
      detectedForm = VALID_FORMS.find(f => f.id === 'modus_ponens') ?? null;
    } else if (matchModusTollens(premiseTrees, conclusionTree)) {
      detectedForm = VALID_FORMS.find(f => f.id === 'modus_tollens') ?? null;
    } else if (matchHypotheticalSyllogism(premiseTrees, conclusionTree)) {
      detectedForm = VALID_FORMS.find(f => f.id === 'hypothetical_syllogism') ?? null;
    } else if (matchDisjunctiveSyllogism(premiseTrees, conclusionTree)) {
      detectedForm = VALID_FORMS.find(f => f.id === 'disjunctive_syllogism') ?? null;
    } else if (matchConstructiveDilemma(premiseTrees, conclusionTree)) {
      detectedForm = VALID_FORMS.find(f => f.id === 'constructive_dilemma') ?? null;
    } else if (matchSimplification(premiseTrees, conclusionTree)) {
      detectedForm = VALID_FORMS.find(f => f.id === 'simplification') ?? null;
    } else if (matchConjunction(premiseTrees, conclusionTree)) {
      detectedForm = VALID_FORMS.find(f => f.id === 'conjunction') ?? null;
    } else if (matchAddition(premiseTrees, conclusionTree)) {
      detectedForm = VALID_FORMS.find(f => f.id === 'addition') ?? null;
    }
  }

  return {
    ok: true,
    valid,
    variables,
    rows,
    counterexamples,
    detectedFallacy,
    detectedForm,
    premiseTrees,
    conclusionTree,
  };
}
