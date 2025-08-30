import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Question, QuizSettings, CourseTopic } from "../types";
import { curriculumTopics } from "../data/courseData";

/** === CONFIG ===
 * 1) Gemini API_KEY: set in AI Studio (Environment variables).
 * 2) RETRIEVER: change the TOKEN if you change it in the Worker.
 */
const API_KEY = process.env.API_KEY;
const RETRIEVER_URL = "https://fsa-retriever.fsa-rag.workers.dev/search_chunks";
const RETRIEVER_TOKEN = "12345"; // the same one saved in the Worker (wrangler secret put RETRIEVER_TOKEN)

/** === GEMINI CLIENT === */
const getClient = () => {
  if (!API_KEY) {
    throw new Error(
      "API_KEY for Gemini is not set in environment variables. The Question Generator feature will not work."
    );
  }
  return new GoogleGenAI({ apiKey: API_KEY });
};

/** Get all "leaf topics" from the course (for simulator mode) */
const getAllLeafTopics = (): string[] => {
  const leafTopics: string[] = [];
  const traverse = (topics: CourseTopic[]) => {
    topics.forEach((topic) => {
      if (topic.subTopics && topic.subTopics.length > 0) {
        traverse(topic.subTopics);
      } else {
        leafTopics.push(topic.title);
      }
    });
  };
  traverse(curriculumTopics);
  return leafTopics;
};

/** === RAG: calls the Worker to fetch relevant chunks === */
export async function searchChunks(topic: string, chapter?: string, k: number = 5) {
  const resp = await fetch(RETRIEVER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RETRIEVER_TOKEN}`,
    },
    body: JSON.stringify({ topic, chapter, k }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`Retriever error (${resp.status}): ${txt || "no details"}`);
  }
  return (await resp.json()) as {
    snippets: { id: number; docId?: string; chapter?: string; page?: number; snippet: string; score?: number }[];
    used: { topic: string; chapter?: string | null; k: number; engine?: string };
  };
}

/** Builds the prompt with snippets (RAG) + instructions */
function buildPromptFromSnippets(
  topic: string,
  snippets: { snippet: string; docId?: string; chapter?: string; page?: number }[],
  difficulty: string
) {
  const contextText =
    snippets && snippets.length
      ? snippets
          .map((s, i) => {
            const src = [s.docId, s.chapter, s.page ? `p.${s.page}` : ""]
              .filter(Boolean)
              .join(" | ");
            return `#${i + 1} [${src}]\n${s.snippet}`;
          })
          .join("\n\n")
      : "NO SNIPPETS WERE FOUND. BE CONSERVATIVE AND ASK FOR A MORE SPECIFIC TOPIC.";

  const fsaLevel1Context = `
You are an exam question generator for the **IFRS FSA Level 1 (Sustainability Accounting)** exam. 
Your job is to create exactly ONE multiple-choice question in English.

STRICT INSTRUCTIONS:
- Use ONLY the context snippets below. Do NOT use your own knowledge or invent content.
- If the snippets do not contain enough info, you MUST return a JSON array with an error object, for example: [{"error": "Insufficient data to generate a question."}]
- The question must test application of sustainability/ESG accounting concepts, not generic finance.
- Always finish the explanation with the exact sources (docId / chapter / page).

CONTEXT SNIPPETS:
${contextText}

OUTPUT FORMAT (JSON only, array with one object):
[
 {
  "question": "Question text in English...",
  "options": ["Complete text for option A...", "Complete text for option B...", "Complete text for option C...", "Complete text for option D..."],
  "correctAnswer": "The full, exact text of the correct option from the 'options' array.",
  "isMultipleChoice": false,
  "difficulty": "${difficulty}",
  "topic": "${topic}",
  "explanation": "Short justification in English. Sources: <docId>, chapter <chapter>, p.<page>"
 }
]
`;

  return fsaLevel1Context;
}

export const generateQuestions = async (settings: QuizSettings): Promise<Question[]> => {
  const ai = getClient();
  const totalQuestions = settings.numberOfQuestions;
  const BATCH_SIZE = 10;

  try {
    let allGeneratedQuestions: any[] = [];

    // Topic selection by mode
    let topicsForQuiz: string[] = settings.topics;
    const isSimuladoMode = settings.mode === "timed" || settings.mode === "timed_half";

    if (isSimuladoMode) {
      const allLeaves = getAllLeafTopics();
      const shuffledLeaves = [...allLeaves].sort(() => 0.5 - Math.random());
      topicsForQuiz = shuffledLeaves.slice(0, totalQuestions);

      if (totalQuestions > allLeaves.length) {
        let i = 0;
        while (topicsForQuiz.length < totalQuestions) {
          topicsForQuiz.push(shuffledLeaves[i % shuffledLeaves.length]);
          i++;
        }
      }
    } else {
      if (totalQuestions > topicsForQuiz.length && topicsForQuiz.length > 0) {
        const repeatedTopics: string[] = [];
        for (let i = 0; i < totalQuestions; i++) {
          repeatedTopics.push(topicsForQuiz[i % topicsForQuiz.length]);
        }
        topicsForQuiz = repeatedTopics;
      }
    }

    const batchPromises: Promise<any[]>[] = [];

    for (let i = 0; i < totalQuestions; i += BATCH_SIZE) {
      const batchTopics = topicsForQuiz.slice(i, i + BATCH_SIZE);
      if (batchTopics.length === 0) continue;

      const batchSettings = {
        ...settings,
        numberOfQuestions: batchTopics.length,
        topics: batchTopics,
      };

      const task = async (): Promise<any[]> => {
        /** For each topic in the batch: do RAG + ask question */
        const resultsForThisBatch: any[] = [];
        for (const topic of batchSettings.topics) {
          // 1) Vector search (RAG)
          const k = 5;
          const chapter = (settings as any).chapter || undefined; // if you pass chapter through settings
          let snippets: { snippet: string; docId?: string; chapter?: string; page?: number }[] = [];
          try {
            const rag = await searchChunks(topic, chapter, k);
            snippets = rag.snippets ?? [];
          } catch (e) {
            console.warn("RAG failed for", topic, e);
          }

          // 2) Build prompt with context
          const prompt = buildPromptFromSnippets(
            topic,
            snippets,
            Array.isArray(batchSettings.difficulty)
              ? batchSettings.difficulty[0] || "Médio"
              : (batchSettings.difficulty as unknown as string) || "Médio"
          );

          // 3) Call Gemini asking for ONLY 1 question (JSON array with 1 item)
          const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json", temperature: 0.6, topK: 40 },
          });

          // 4) Strict JSON parsing
          let jsonStr = response.text.trim();
          const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
          const match = jsonStr.match(fenceRegex);
          if (match && match[2]) jsonStr = match[2].trim();

          let parsed: any;
          try {
            parsed = JSON.parse(jsonStr);
          } catch (err) {
            console.error("Invalid Gemini JSON:", err, response.text);
            throw new Error("The AI response was not valid JSON.");
          }

          const arr = Array.isArray(parsed) ? parsed : [parsed];

          // Handle cases where the AI couldn't generate a question
          if (arr.length > 0 && arr[0].error) {
            console.warn(`AI could not generate a question for topic "${topic}": ${arr[0].error}`);
            continue; // Skip to the next topic
          }
          
          if (!arr[0] || !arr[0].question || !arr[0].options || !arr[0].correctAnswer) {
            console.error("Unexpected structure:", parsed);
            throw new Error("Invalid question structure.");
          }

          resultsForThisBatch.push(arr[0]);
        } // end for topic

        return resultsForThisBatch;
      };

      batchPromises.push(task());
    }

    const resultsFromBatches = await Promise.all(batchPromises);
    allGeneratedQuestions = resultsFromBatches.flat();

    // Normalize and limit to the requested amount
    return allGeneratedQuestions.slice(0, totalQuestions).map((item: any, index: number) => {
      if (
        !item.question ||
        !item.options ||
        !item.correctAnswer ||
        !item.difficulty ||
        !item.explanation ||
        !item.topic
      ) {
        console.error("Invalid question structure from AI:", item);
        throw new Error(
          `Invalid question structure in generated data at index ${index}. Required fields are missing.`
        );
      }
      return { ...item, id: Date.now() + index } as Question;
    });
  } catch (error) {
    console.error("Error generating questions with Gemini:", error);
    if (error instanceof Error) {
      if (
        error.message.includes("API_KEY") ||
        error.message.includes("valid JSON") ||
        error.message.includes("Invalid question structure")
      ) {
        throw error;
      }
    }
    throw new Error(
      "Failed to generate questions. The AI service may be overloaded or the request was invalid. Please try again."
    );
  }
};