// services/geminiService.ts
// Serviço para geração de questões com Gemini.
import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuizResult } from "../types";

// ---------- Tipos ----------
export type Difficulty = "easy" | "medium" | "hard";

export type GeneratedQuestion = {
  question: string;
  options: string[];
  answer_keys: string[]; // e.g. ["A"], ["B", "D"]
  isMultipleChoice: boolean;
  explanation: string;
};

const questionSchema = {
    type: Type.OBJECT,
    properties: {
        question: { type: Type.STRING, description: "The question text." },
        options: {
            type: Type.ARRAY,
            description: "An array of possible answers, including labels like 'A) '.",
            items: { type: Type.STRING }
        },
        answer_keys: {
            type: Type.ARRAY,
            description: "An array of correct answer keys, like ['A', 'C'].",
            items: { type: Type.STRING }
        },
        isMultipleChoice: { type: Type.BOOLEAN, description: "True if more than one answer can be selected." },
        explanation: { type: Type.STRING, description: "A detailed explanation of the correct and incorrect answers." }
    },
    required: ['question', 'options', 'answer_keys', 'isMultipleChoice', 'explanation']
};


// ---------- Helper: Robust JSON Parser ----------
function robustJsonParse(jsonString: string): any {
    // The Gemini API with a JSON schema should return a clean JSON string.
    // However, in case of variations (e.g., wrapped in markdown, extra text), this function adds resilience.
    
    // Step 1: Remove citations and trim whitespace.
    let text = jsonString.replace(/\[\s*cite_start:[^\]]*\]|\[\s*cite_end:[^\]]*\]/g, '').trim();

    // Step 2: If wrapped in markdown ```json ... ```, extract the content.
    const markdownMatch = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (markdownMatch) {
        text = markdownMatch[1].trim();
    }

    // Step 3: The model might add text before/after the JSON object.
    // Find the first '{' and the last '}' to extract the core object.
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        text = text.substring(firstBrace, lastBrace + 1);
    }
    
    // Step 4: Try to parse the cleaned/extracted string.
    try {
        return JSON.parse(text);
    } catch (error) {
        // If all cleanup attempts fail, throw a detailed error.
        console.error("Final JSON parsing attempt failed for text:", text, "Original string:", jsonString);
        const errorMessage = `Could not find a valid JSON object in the AI's response. Snippet: "${jsonString.substring(0, 100)}..."`;
        throw new Error(errorMessage);
    }
}


// ---------- Prompt Builder ----------
function buildPrompt(opts: {
  topic: string;
  difficulty?: Difficulty;
  alignWithExam?: boolean;
  exampleQuestions?: Question[];
}): string {
  const { topic, difficulty = "medium", alignWithExam, exampleQuestions } = opts;

  const examplePrompt = (exampleQuestions && exampleQuestions.length > 0)
    ? `
Use the following questions as inspiration for style, format, and subject matter.
Your task is to generate a COMPLETELY NEW and UNIQUE question on the same topic.
DO NOT copy or slightly rephrase the example questions.

--- EXAMPLE QUESTIONS START ---
${exampleQuestions.map(q => JSON.stringify({ question: q.question, options: q.options })).join('\n---\n')}
--- EXAMPLE QUESTIONS END ---
`
    : '';

  if (alignWithExam) {
      return `
You are an expert exam item writer for the IFRS Foundation's FSA Level I exam.
Your task is to create ONE exam-style question based on your knowledge of the topic: "${topic}".

${examplePrompt}

Output English only.

**FSA Level I Question Styles:**
You MUST generate a question that fits one of the following formats, chosen based on what the context best supports:
1.  **Single-Concept (Single-Choice):** A direct question testing a key definition or concept. (e.g., "What is the primary challenge of X?") Always use 4 options (A-D).
2.  **Multiple-Answer (Choose Two/Three):** A question that requires selecting two or three correct statements from a list. The stem must clearly state "(Choose two)" or "(Choose three)". For "Choose two", provide 4-5 options. For "Choose three", provide 5-6 options (A-F).
3.  **Sequence/Ordering:** Present 4 numbered events or stages. The options (A-D) must be different permutations of these numbers (e.g., "3, 1, 2, 4"). The stem will ask to select the correct chronological or logical order.
4.  **Pairing/Matching:** Ask the user to choose the pairing that correctly matches a data type with its relevance to a financial driver (e.g., DCF analysis). Present 4 options (A-D), each containing a pair.
5.  **Spectrum/Classification:** Ask the user to identify which item fits best at a certain point on a spectrum (e.g., farthest on the 'value' end of investing approaches). Present 4 options (A-D).
6.  **Inclusion/Exclusion Criteria:** Ask which two statements, if true, provide evidence that a topic fails to meet criteria for inclusion in a standard. This is typically a "Choose two" format.

**Constraints:**
- The question must be about "${topic}" with difficulty: ${difficulty}.
- Adhere strictly to one of the question styles described above.
- The explanation must follow the official style: First, explain *why* each correct option is correct. Then, for each incorrect option, explain *why* it is incorrect.
- The output must be a single JSON object. Do not add any extra text, prose, or markdown formatting around the JSON.
`;
  }

  return `
You are an exam question writer for the **FSA Credential Level 1** (sustainability/ESG).
Use your knowledge to generate a question.

${examplePrompt}

Output English only.

Constraints:
- Create ONE multiple-choice question about "${topic}" (difficulty: ${difficulty}).
- Write 4 options (A–D). Exactly ONE must be correct.
- Provide a short explanation (1–3 sentences).
- The output must be a single JSON object. Do not add any extra text, prose, or markdown formatting around the JSON.
`;
}

// ---------- Gemini API Call ----------
async function callGemini(prompt: string, outputJson: boolean = true): Promise<string> {
  // API Key is expected to be in process.env.API_KEY
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const config: any = {
      temperature: 0.4,
      topK: 32,
      topP: 0.95,
      maxOutputTokens: 2048,
      // As per guidelines, setting thinkingBudget when maxOutputTokens is set for gemini-2.5-flash
      // reserves tokens for the final output, preventing truncation.
      thinkingConfig: { thinkingBudget: 1024 },
  };
  
  if (outputJson) {
      config.responseMimeType = "application/json";
      config.responseSchema = questionSchema;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config,
  });

  const text = response.text;

  if (!text) throw new Error("Empty response from model.");
  return text;
}

// ---------- Question Validation ----------
function validateGeneratedQuestion(
  out: GeneratedQuestion
): { ok: boolean; reason?: string } {
  if (!out.question || typeof out.question !== 'string') return {ok: false, reason: "Missing or invalid 'question' field."};
  if (!Array.isArray(out.answer_keys) || out.answer_keys.length === 0) return { ok: false, reason: "Answer keys must be a non-empty array." };
  if (!Array.isArray(out.options) || out.options.length < 2) return { ok: false, reason: "Must provide at least 2 options." };

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


// ---------- Public Question Generator ----------
export async function generateQuestions(params: {
    topic: string;
    difficulty?: Difficulty;
    count?: number;
    alignWithExam?: boolean;
    exampleQuestions?: Question[];
}): Promise<{
  ok: boolean;
  data?: GeneratedQuestion[];
  reason?: string;
}> {
  const { topic, difficulty, count = 1, alignWithExam = true, exampleQuestions } = params;

  const results: GeneratedQuestion[] = [];
  // Generate questions sequentially to avoid overwhelming the API and to handle errors gracefully.
  for (let i = 0; i < count; i++) {
    try {
        const prompt = buildPrompt({ topic, difficulty, alignWithExam, exampleQuestions });
        const raw = await callGemini(prompt, true);
        const parsed = robustJsonParse(raw) as GeneratedQuestion;
        
        if (!parsed) {
          return { ok: false, reason: "Model did not return valid JSON." };
        }

        const check = validateGeneratedQuestion(parsed);
        if (!check.ok) {
          console.error("Invalid question data from AI:", parsed, "Reason:", check.reason);
          return { ok: false, reason: `AI returned a malformed question. Please try again. (${check.reason})` };
        }
        results.push(parsed);

    } catch (err: any) {
        console.error("Error generating question:", err);
        return { ok: false, reason: err.message || "An unknown error occurred while communicating with the AI." };
    }
  }

  return { ok: true, data: results };
}


// ---------- AI-powered Analysis and Explanation Functions ----------
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
Generate a report in **Markdown format**. Use headings for each section.

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


// FIX: Removed redundant export of 'GeneratedQuestion' which caused a conflict.
// The type is already exported where it is defined.