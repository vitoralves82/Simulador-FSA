// services/geminiService.ts
// Serviço completo para RAG com Gemini + seu retriever (Cloudflare Worker).
// Inclui o export "generateQuestions" que as páginas HomePage/QuestionGeneratorPage esperam.

// @google/genai SDK for Gemini API calls
import { GoogleGenAI } from "@google/genai";
import { Question, QuizResult } from "../types";

// ---------- Tipos ----------
type Snippet = {
  id?: number;
  docId: string;
  chapter?: string | null;
  page?: number | null;
  snippet: string;
  score?: number;
};

type SearchChunksResponse = {
  snippets: Snippet[];
  used: { topic: string; chapter?: string | null; k: number; engine: string };
};

type Difficulty = "easy" | "medium" | "hard";

type GenerateInput = {
  topic: string;
  chapter?: string | null;
  k?: number; // top-k de contexto (default = 5)
  difficulty?: Difficulty;
  alignWithExam?: boolean;
};

type GeneratedQuestion = {
  question: string;
  options: string[];
  answer_keys: string[]; // e.g. ["A"], ["B", "D"]
  isMultipleChoice: boolean;
  explanation: string;
  sources: Array<{
    docId: string;
    chapter?: string | null;
    page?: number | null;
  }>;
};


// ---------- Variáveis de ambiente ----------
const RETRIEVER_URL =
  (import.meta as any).env?.VITE_RETRIEVER_URL ?? (window as any).__RETRIEVER_URL;
const RETRIEVER_TOKEN =
  (import.meta as any).env?.VITE_RETRIEVER_TOKEN ?? (window as any).__RETRIEVER_TOKEN;
const GEMINI_API_KEY =
  (import.meta as any).env?.VITE_GEMINI_API_KEY ?? (window as any).__GEMINI_API_KEY;

// ---------- 1) Retriever: chama o Worker e obtém snippets ----------
export async function searchChunks(params: {
  topic: string;
  chapter?: string | null;
  k?: number;
}): Promise<SearchChunksResponse> {
  if (!RETRIEVER_URL || !RETRIEVER_TOKEN) {
    throw new Error("Retriever URL/token não configurados (VITE_RETRIEVER_URL / VITE_RETRIEVER_TOKEN).");
  }

  const body = JSON.stringify({
    topic: params.topic,
    chapter: params.chapter ?? null,
    k: Math.min(Math.max(params.k ?? 5, 1), 10),
  });

  const res = await fetch(RETRIEVER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RETRIEVER_TOKEN}`,
    },
    body,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Retriever HTTP ${res.status}: ${txt}`);
  }

  const json = (await res.json()) as SearchChunksResponse;
  if (!json || !Array.isArray(json.snippets)) {
    throw new Error("Formato inesperado do retriever.");
  }
  return json;
}

// ---------- 2) Prompt rígido (apenas contexto) ----------
function buildPromptFromSnippets(opts: {
  topic: string;
  difficulty?: Difficulty;
  snippets: Snippet[];
  alignWithExam?: boolean;
}): string {
  const { topic, difficulty = "medium", snippets, alignWithExam } = opts;

  const context = snippets
    .map((s, i) => {
      const attrs = [
        s.docId ? `docId="${s.docId}"` : "",
        s.chapter ? `chapter="${s.chapter}"` : "",
        typeof s.page === "number" ? `page="${s.page}"` : "",
      ]
        .filter(Boolean)
        .join(" ");
      const text = (s.snippet || "").slice(0, 1200);
      return `<CHUNK idx="${i + 1}" ${attrs}>
${text}
</CHUNK>`;
    })
    .join("\n\n");

    if (alignWithExam) {
        return `
You are an expert exam item writer for the IFRS Foundation's FSA Level I exam.
Your task is to create ONE exam-style question based ONLY on the provided <CONTEXT>.

**FSA Level I Question Styles:**
You MUST generate a question that fits one of the following formats, chosen based on what the context best supports:
1.  **Single-Concept (Single-Choice):** A direct question testing a key definition or concept. (e.g., "What is the primary challenge of X?") Always use 4 options (A-D).
2.  **Multiple-Answer (Choose Two/Three):** A question that requires selecting two or three correct statements from a list. The stem must clearly state "(Choose two)" or "(Choose three)". For "Choose two", provide 4-5 options. For "Choose three", provide 5-6 options (A-F).
3.  **Sequence/Ordering:** Present 4 numbered events or stages. The options (A-D) must be different permutations of these numbers (e.g., "3, 1, 2, 4"). The stem will ask to select the correct chronological or logical order.
4.  **Pairing/Matching:** Ask the user to choose the pairing that correctly matches a data type with its relevance to a financial driver (e.g., DCF analysis). Present 4 options (A-D), each containing a pair.
5.  **Spectrum/Classification:** Ask the user to identify which item fits best at a certain point on a spectrum (e.g., farthest on the 'value' end of investing approaches). Present 4 options (A-D).
6.  **Inclusion/Exclusion Criteria:** Ask which two statements, if true, provide evidence that a topic fails to meet criteria for inclusion in a standard. This is typically a "Choose two" format.

**Constraints:**
- Use ONLY facts/statements explicitly found in the <CONTEXT>.
- The question must be about "${topic}" with difficulty: ${difficulty}.
- Adhere strictly to one of the question styles described above.
- The explanation must follow the official style: First, explain *why* each correct option is correct. Then, for each incorrect option, explain *why* it is incorrect. All explanations must be grounded in the <CONTEXT>.
- If the context is insufficient for a high-quality question, answer exactly: "Insufficient data in context".

**Required JSON output schema (no prose, no markdown, no code fences):**
{
  "question": "string",
  "options": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."],
  "answer_keys": ["B", "E"],
  "isMultipleChoice": boolean,
  "explanation": "string",
  "sources": [{"docId":"string","chapter":"string|null","page":123|null}]
}

<CONTEXT>
${context}
</CONTEXT>
`;
    }

  return `
You are an exam question writer for the **FSA Credential Level 1** (sustainability/ESG).
Work ONLY with the provided <CONTEXT>. Do NOT use prior knowledge.
If the context is insufficient to support a safe and specific question, answer exactly: "Insufficient data in context".

Output English only.

Constraints:
- Create ONE multiple-choice question about "${topic}" (difficulty: ${difficulty}).
- Use ONLY facts/statements explicitly found in <CONTEXT>.
- Write 4 options (A–D). Exactly ONE must be correct.
- Provide a short explanation (1–3 sentences) grounded ONLY in the context.
- Provide sources as a list of up to 3 items, each with {docId, chapter, page} that appear in the <CONTEXT>.
- If you are not fully sure, return "Insufficient data in context".

Required JSON output schema (no prose, no markdown, no code fences):
{
  "question": "string",
  "options": ["A) ...","B) ...","C) ...","D) ..."],
  "answer_keys": ["A"],
  "isMultipleChoice": false,
  "explanation": "string",
  "sources": [{"docId":"string","chapter":"string|null","page":123|null}]
}

<CONTEXT>
${context}
</CONTEXT>
`;
}

// ---------- 3) Chamada ao Gemini ----------
async function callGemini(prompt: string, outputJson: boolean = true): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada.");

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const config: any = {
      temperature: 0.4,
      topK: 32,
      topP: 0.95,
      maxOutputTokens: 1024,
  };
  
  if (outputJson) {
      config.responseMimeType = "application/json";
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config,
  });

  const text = response.text;

  if (!text) throw new Error("Resposta vazia do modelo.");
  return text;
}

// ---------- 4) Validação das fontes ----------
function norm(v: unknown): string {
  return String(v ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function validateSources(
  snippets: Snippet[],
  out: GeneratedQuestion
): { ok: boolean; reason?: string } {
  if (!out?.sources?.length) return { ok: false, reason: "No sources in output." };

  const allowed = new Set(
    snippets.map((s) =>
      [norm(s.docId), norm(s.chapter ?? ""), typeof s.page === "number" ? String(s.page) : ""].join("|")
    )
  );

  for (const src of out.sources) {
    const key = [norm(src.docId), norm(src.chapter ?? ""), typeof src.page === "number" ? String(src.page) : ""].join("|");
    const alt = [norm(src.docId), norm(src.chapter ?? ""), ""].join("|"); // tolera page null
    if (!allowed.has(key) && !allowed.has(alt)) {
      return { ok: false, reason: `Source not in context: ${JSON.stringify(src)}` };
    }
  }

  if (!Array.isArray(out.answer_keys) || out.answer_keys.length === 0) return { ok: false, reason: "Answer keys must be a non-empty array." };
  if (!Array.isArray(out.options) || out.options.length < 4) return { ok: false, reason: "Must provide at least 4 options." };

  for (const key of out.answer_keys) {
      if (!/^[A-F]$/.test(key)) return { ok: false, reason: `Invalid answer key format: ${key}`};
      const index = key.charCodeAt(0) - 65;
      if (index >= out.options.length) {
          return { ok: false, reason: `Answer key '${key}' is out of bounds for the given options.`};
      }
  }

  if (out.isMultipleChoice === false && out.answer_keys.length > 1) {
    return { ok: false, reason: "isMultipleChoice is false but multiple answers were provided." };
  }
  
  return { ok: true };
}

// ---------- 5) Uma questão a partir do contexto ----------
export async function generateQuestionFromContext(input: GenerateInput): Promise<{
  ok: boolean;
  data?: GeneratedQuestion;
  reason?: string;
  used?: { topic: string; chapter?: string | null; k: number };
}> {
  const topic = input.topic?.trim();
  if (!topic) return { ok: false, reason: "Missing topic." };

  const { snippets, used } = await searchChunks({
    topic,
    chapter: input.chapter ?? null,
    k: input.k ?? 5,
  });

  if (!snippets.length) return { ok: false, reason: "No snippets found for topic.", used };

  const prompt = buildPromptFromSnippets({
    topic,
    difficulty: input.difficulty ?? "medium",
    snippets,
    alignWithExam: input.alignWithExam ?? true,
  });

  const raw = await callGemini(prompt, true);

  let parsed: GeneratedQuestion | null = null;
  try {
    parsed = JSON.parse(raw) as GeneratedQuestion;
  } catch {
    const m = raw.match(/\{[\s\S]*\}$/);
    if (m) parsed = JSON.parse(m[0]) as GeneratedQuestion;
  }
  if (!parsed) return { ok: false, reason: "Model did not return valid JSON.", used };

  const allText = `${parsed.question} ${parsed.explanation}`.toLowerCase();
  if (allText.includes("insufficient data in context")) {
    return { ok: false, reason: "Insufficient data in context.", used };
  }

  const check = validateSources(snippets, parsed);
  if (!check.ok) return { ok: false, reason: `Invalid sources: ${check.reason}`, used };

  return { ok: true, data: parsed, used };
}

// ---------- 6) Adaptador pedido pelas páginas: generateQuestions ----------
// Aceita dois formatos:
//   A) generateQuestions("topic", "14.2", 5, "medium")  -> 1 questão
//   B) generateQuestions({ topic, chapter, k, difficulty, count: 3 }) -> N questões
export async function generateQuestions(
  arg1:
    | string
    | {
        topic: string;
        chapter?: string | null;
        k?: number;
        difficulty?: Difficulty;
        count?: number; // quantas questões (default 1)
        alignWithExam?: boolean;
      },
  chapter?: string | null,
  k?: number,
  difficulty?: Difficulty
): Promise<{
  ok: boolean;
  data?: GeneratedQuestion[];
  reason?: string;
  used?: { topic: string; chapter?: string | null; k: number };
}> {
  let topic: string;
  let chap: string | null | undefined;
  let topk: number | undefined;
  let diff: Difficulty | undefined;
  let count = 1;
  let alignWithExam = true;

  if (typeof arg1 === "string") {
    topic = arg1;
    chap = chapter ?? null;
    topk = k ?? 5;
    diff = difficulty ?? "medium";
  } else {
    topic = arg1.topic;
    chap = arg1.chapter ?? null;
    topk = arg1.k ?? 5;
    diff = arg1.difficulty ?? "medium";
    count = Math.max(1, Math.min(10, arg1.count ?? 1)); // limite defensivo
    alignWithExam = arg1.alignWithExam ?? true;
  }

  // Para ganhar performance, buscamos os snippets UMA vez e reutilizamos no loop.
  const { snippets, used } = await searchChunks({ topic, chapter: chap ?? null, k: topk });

  if (!snippets.length) return { ok: false, reason: "No snippets found for topic.", used };

  const results: GeneratedQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const prompt = buildPromptFromSnippets({ topic, difficulty: diff, snippets, alignWithExam });

    const raw = await callGemini(prompt, true);

    let parsed: GeneratedQuestion | null = null;
    try {
      parsed = JSON.parse(raw) as GeneratedQuestion;
    } catch {
      const m = raw.match(/\{[\s\S]*\}$/);
      if (m) parsed = JSON.parse(m[0]) as GeneratedQuestion;
    }
    if (!parsed) return { ok: false, reason: "Model did not return valid JSON.", used };

    const allText = `${parsed.question} ${parsed.explanation}`.toLowerCase();
    if (allText.includes("insufficient data in context")) {
      return { ok: false, reason: "Insufficient data in context.", used };
    }

    const check = validateSources(snippets, parsed);
    if (!check.ok) {
      return { ok: false, reason: `Invalid sources: ${check.reason}`, used };
    }

    results.push(parsed);
  }

  return { ok: true, data: results, used };
}

// ---------- 7) Novas funções de Análise e Explicação com IA ----------
export async function generateExplanation(
  question: Question,
  userAnswer: string[]
): Promise<string> {
    const { question: questionText, options, correctAnswer, topic } = question;

    const correctOptionLetters = (Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer])
        .map(ans => {
            const index = options.findIndex(opt => opt === ans);
            return index !== -1 ? String.fromCharCode(65 + index) : null;
        })
        .filter(Boolean)
        .join(', ');

    const userOptionLetters = userAnswer
        .map(ans => {
            const index = options.findIndex(opt => opt === ans);
            return index !== -1 ? String.fromCharCode(65 + index) : null;
        })
        .filter(Boolean)
        .join(', ');

    const sortedCorrect = correctOptionLetters.split(', ').sort().join(', ');
    const sortedUser = userOptionLetters.split(', ').sort().join(', ');
    const isCorrect = sortedCorrect === sortedUser;

    const prompt = `You are an expert tutor for the IFRS Foundation's FSA Level I exam.
A student has answered a question. Your task is to provide a detailed, structured explanation in the style of the official FSA Study Guide.

**Question Details:**
- **Topic:** "${topic}"
- **Question:** "${questionText}"
- **Options:**
${options.map((opt, i) => `  - ${String.fromCharCode(65 + i)}) ${opt}`).join('\n')}
- **Correct Answer Key(s):** ${correctOptionLetters}
- **Student's Answer Key(s):** ${userOptionLetters}

**Instructions:**
1.  Start with a clear, brief summary statement: "Your answer was ${isCorrect ? 'Correct' : 'Incorrect'}."
2.  Then, provide a **Detailed Breakdown** section.
3.  Go through **each option (A, B, C, etc.)** one by one.
4.  For each option, start a new line with the option letter (e.g., "A. This is CORRECT/INCORRECT.").
5.  Explain *why* the option is correct or incorrect, referencing key concepts from the FSA curriculum. Your explanation should be similar in style and depth to official FSA materials.
6.  Be clear and educational. Keep the total explanation concise but thorough.
7.  Output ONLY the explanation text, without any markdown or extra formatting.`;

    const explanation = await callGemini(prompt, false);
    return explanation;
}


export async function generatePerformanceAnalysis(
    results: QuizResult[], 
    timeTaken: number | null
): Promise<string> {
  
  const summary = results.map(r => ({
    topic: r.question.topic,
    question: r.question.question,
    isCorrect: r.isCorrect,
    timeSpent: Math.round(r.timeSpentOnQuestion)
  }));
  
  const correctCount = results.filter(r => r.isCorrect).length;
  const totalCount = results.length;
  const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  const formattedTime = timeTaken ? `${Math.floor(timeTaken / 60)} minutes and ${timeTaken % 60} seconds` : 'N/A';

  const prompt = `You are an expert tutor and performance analyst for the FSA Credential Level 1 exam.
A student has just completed a quiz. Analyze their performance based on the data below and provide a personalized study plan.

**Performance Data:**
- **Overall Score:** ${correctCount}/${totalCount} (${percentage}%)
- **Total Time Taken:** ${formattedTime}
- **Question-by-question breakdown:**
${JSON.stringify(summary, null, 2)}

**Instructions:**
Generate a report in markdown format. Use headings for each section.

**Overall Performance Summary**
- Briefly comment on the student's overall score. Be encouraging and constructive.

**Key Strengths**
- Identify up to 2 topics where the student performed well (high accuracy). If they did poorly everywhere, acknowledge the effort and skip this section.

**Top 3 Areas for Improvement**
- Identify the top 3 topics where the student struggled the most (low accuracy).
- For each topic, briefly explain its importance in the FSA curriculum.

**Time Management Analysis**
- Analyze the 'timeSpent' data. Did the student spend too long on incorrect questions? Were they too hasty on others? Provide actionable feedback on their pacing.

**Recommended Study Plan**
- Provide a concise, actionable study plan with 2-3 bullet points. Suggest specific actions for the weak topics identified.
- Example: "* Review Chapter X on 'Topic Y', focusing on definitions. * Try 5 practice questions specifically on this topic."

Keep the tone supportive and constructive. The goal is to help the student improve.`;

  const analysis = await callGemini(prompt, false);
  return analysis;
}


// ---------- 8) (Opcional) exportar tipos para uso externo ----------
export type { GeneratedQuestion, Difficulty, Snippet, SearchChunksResponse };