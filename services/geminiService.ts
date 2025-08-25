import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Question, QuizSettings, CourseTopic } from '../types';
import { curriculumTopics } from '../data/courseData';

const API_KEY = process.env.API_KEY;

const getClient = () => {
  if (!API_KEY) {
    throw new Error("API_KEY for Gemini is not set in environment variables. The Question Generator feature will not work.");
  }
  return new GoogleGenAI({ apiKey: API_KEY });
};

const getAllLeafTopics = (): string[] => {
    const leafTopics: string[] = [];
    const traverse = (topics: CourseTopic[]) => {
        topics.forEach(topic => {
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


export const generateQuestions = async (settings: QuizSettings): Promise<Question[]> => {
  const ai = getClient();
  const totalQuestions = settings.numberOfQuestions;
  const BATCH_SIZE = 10; 

  try {
    let allGeneratedQuestions: any[] = [];
    
    let topicsForQuiz: string[] = settings.topics;
    const isSimuladoMode = settings.mode === 'timed' || settings.mode === 'timed_half';

    // For Simulado mode, create a diverse topic list to ensure coverage and prevent repetition.
    if(isSimuladoMode) {
        const allLeaves = getAllLeafTopics();
        
        // Simple shuffle and slice for diversity
        const shuffledLeaves = [...allLeaves].sort(() => 0.5 - Math.random());
        topicsForQuiz = shuffledLeaves.slice(0, totalQuestions);
        
        // If more questions are needed than available topics, start repeating them but keep them shuffled.
        if (totalQuestions > allLeaves.length) {
            let i = 0;
            while (topicsForQuiz.length < totalQuestions) {
                topicsForQuiz.push(shuffledLeaves[i % shuffledLeaves.length]);
                i++;
            }
        }
    }


    const batchPromises: Promise<any[]>[] = [];
    for (let i = 0; i < totalQuestions; i += BATCH_SIZE) {
      const batchTopics = topicsForQuiz.slice(i, i + BATCH_SIZE);
      if(batchTopics.length === 0) continue;
      
      const batchSettings = { ...settings, numberOfQuestions: batchTopics.length, topics: batchTopics };

      const task = async (): Promise<any[]> => {
        let modeSpecificInstructions = '';
        let difficultyPrompt = '';

        const antiBiasInstruction = "CRITICAL INSTRUCTION: To ensure fairness, the length and complexity of all options (correct and incorrect) MUST be similar. Do not make the correct answer obviously longer or more detailed than the others. All options must be plausible and professionally worded.";

        const fsaLevel1Context = `
--- FSA LEVEL 1 EXAM PROFILE AND CONTEXT ---
The FSA Level 1 exam tests the application of sustainability accounting concepts from an investor's and corporation's viewpoint. Questions are highly analytical and scenario-based, not simple definitions. They require synthesis of information.

--- CURRICULUM WEIGHTS (approximate for a 110-item exam) ---
- Part I (Need for Standards): ~17% (~19 questions). Focus on fundamentals: Demand for ESG data, limitations of traditional financials, evolution of disclosure, financial materiality.
- Part II (The Ecosystem): ~33% (~36 questions). Focus on roles: Data providers, standard-setters (SASB, GRI, IFRS), regulators. Key concepts: double materiality vs. financial materiality.
- Part III (IFRS Standards): ~17% (~19 questions). Focus on IFRS S1 & S2 structure and purpose: Core content (Governance, Strategy, Risk Management, Metrics & Targets), SASB integration.
- Part IV (Corporate & Investor Use): ~33% (~36 questions). Focus on application: How companies implement strategy and how investors use ESG data (fundamental analysis, screening, engagement).

--- QUESTION FORMATS AND PROPORTIONS (based on sample exams) ---
The exam uses a variety of question types to assess different cognitive skills. When in a simulated exam mode, the generated mix should reflect these proportions:

1.  **Single-Choice Concept (17%):**
    *   Description: Direct question with 4 options, only one is correct.
    *   Cognitive Skill: Recall/Comprehension.
    *   Example: "What is the primary challenge that the disclosure of company policies... can pose to investment analysis?"

2.  **Multiple-Response (25%):**
    *   Description: "Choose two/three" from 4-6 options. The exact set must be selected.
    *   Cognitive Skill: Analysis/Application.
    *   Example: "Corporate disclosures of sustainability information serve which two of the following purposes in capital markets? (Choose two)"

3.  **Sequencing / Ordering (8%):**
    *   Description: A numbered list of 4-6 phrases (e.g., process steps, historical events). The candidate must select the option with the correct chronological or logical order.
    *   Cognitive Skill: Analysis/Organization.
    *   Example: "The chart below presents examples of business initiatives... Select the arrangement of initiatives that progress from early-stage to late-stage." The options are permutations like "A. 3, 1, 2, 4".

4.  **Term Definition / Example Recognition (8%):**
    *   Description: "Which ... provides an example of X?" - tests recognition of technical jargon or concepts (e.g., line-item vs. principle-based).
    *   Cognitive Skill: Comprehension/Distinction.
    *   Example: "Which of the following provides an example of line-item sustainability disclosure guidance issued by a regulator?"

5.  **Metric Classification (8%):**
    *   Description: Identify the type of an indicator (e.g., activity metric, outcome metric) within a standard (SASB, IFRS).
    *   Cognitive Skill: Application.
    *   Example: "Which of the following is suitable to be included as an 'activity metric' in SASB's standards?"

6.  **Process/Objective Evaluation (8%):**
    *   Description: Assess the cost-benefit or purpose of a standard/process. "Why is cost-effectiveness... in the best interest of...?"
    *   Cognitive Skill: Evaluation/Analysis.
    *   Example: "Why is SASB's objective of cost-effectiveness for reporting companies ultimately in the best interest of providers of capital?"

7.  **Pairing / Matching (8%):**
    *   Description: Match two groups of items, e.g., a type of sustainability data with its relevant financial driver.
    *   Cognitive Skill: Application.
    *   Example: "Choose the pairing that correctly matches a data type with its relevance to a DCF analysis." Options are formatted like "Data about X : impacts on Y".

8.  **Spectrum Classification (8%):**
    *   Description: Place a strategy or concept on a spectrum (e.g., values-based vs. value-focused investing).
    *   Cognitive Skill: Comprehension/Analysis.
    *   Example: "On the spectrum of 'values-' to 'value'-focused investing, which investment strategy is farthest on the 'value' end?"

9.  **Inclusion/Exclusion Criteria (8%):**
    *   Description: "Which two statements indicate that X does not apply?" - assesses understanding of a standard's scope or materiality criteria.
    *   Cognitive Skill: Evaluation/Judgment.
    *   Example: "Which two statements, if true, provide evidence that the potential disclosure topic of Labor Practices fails to meet the criteria for inclusion in the Oil & Gas - Services Standard? (Choose two)"

Questions MUST reflect a professional, analytical tone, mirroring official FSA Level 1 sample questions. They should test application, not just recall. 'Difficult' questions should involve comparing frameworks or analyzing a scenario with multiple moving parts.
--- END OF CONTEXT ---
`;

        if (isSimuladoMode) {
            difficultyPrompt = "For this simulated exam, the difficulty of the questions MUST be a realistic mix of 'Fácil', 'Médio', and 'Difícil'. A 'Difficult' question involves comparing concepts or analyzing a scenario, not just recalling facts. Aim for a distribution that reflects a real exam: a majority of 'Médio' questions, with a smaller, balanced number of 'Fácil' and 'Difícil' questions. This is crucial for an authentic simulation.";
        } else {
             if (batchSettings.difficulty.length > 1) {
                difficultyPrompt = `The difficulty of the questions should be varied, including a mix of the following levels: ${batchSettings.difficulty.join(', ')}.`;
            } else {
                difficultyPrompt = `All questions must have a difficulty level of: "${batchSettings.difficulty[0]}".`;
            }
        }
        
        if (batchSettings.mode === 'practice') {
            modeSpecificInstructions = `
            For 'practice' mode, you can generate any of the 9 question formats described in the main context. The goal is varied practice.
            1.  **Single-choice questions (Types 1, 3, 4, 5, 6, 7, 8):** These must have 4 to 5 options with only ONE correct answer. 'isMultipleChoice' MUST be false.
            2.  **Multiple-choice questions (Types 2, 9):** These must have 4 to 6 options. 'isMultipleChoice' MUST be true and 'correctAnswer' MUST be an array of strings. The question text should indicate how many to choose (e.g., "Choose two").
            `;
        } else if (isSimuladoMode) {
            modeSpecificInstructions = `
            This is a 'simulated exam' mirroring the FSA Level 1 exam style. You MUST generate a mix of question formats reflecting the proportions outlined in the main context (~17% Single-Choice, ~25% Multi-Response, ~58% spread across the other 7 special formats).

            **Format Adherence:**
            - **Single-choice questions (including all formats except multi-response):** MUST have exactly 4 options with only ONE correct answer. 'isMultipleChoice' must be 'false'.
            - **'Choose Two' multiple-choice questions:** MUST have exactly 4 options, where TWO are correct. The question text should explicitly say "(Choose two)". 'isMultipleChoice' must be 'true', and 'correctAnswer' must be an array of two strings.
            - **'Choose Three' multiple-choice questions:** MUST have exactly 6 options, where THREE are correct. The question text should explicitly say "(Choose three)". 'isMultipleChoice' must be 'true', and 'correctAnswer' must be an array of three strings.

            **Special Format Rules:**
            - For **Sequencing** questions, the main question should present a numbered list to be ordered, and the 'options' array should contain strings representing the permutations (e.g., "A. 3, 1, 2, 4"). The 'correctAnswer' will be the single string of the correct permutation.
            - For **Pairing** questions, each string in the 'options' array must contain a pair connected by a colon (e.g., "Data about regulatory compliance : operational performance and cost structure").
            `;
        } else {
             modeSpecificInstructions = `
            The question must have 5 options with only one correct answer. "isMultipleChoice" must be false.
            `;
        }
        
        const diversityInstruction = "CRITICAL DIVERSITY REQUIREMENT: The generated questions must be unique and conceptually distinct from one another. For this specific batch, generate exactly one question for EACH of the following topics, in order: " + batchSettings.topics.join('; ');


        const prompt = `
            Act as an expert creator of exam questions for the IFRS FSA Level 1 certification, strictly adhering to the style and content profile described below.
            Your task is to generate ${batchSettings.numberOfQuestions} challenging, high-quality questions in English.
            ${fsaLevel1Context}
            ${diversityInstruction}
            ${difficultyPrompt}
            ${modeSpecificInstructions}
            ${antiBiasInstruction}
            
            The response MUST be a valid JSON array of objects. Do not include any text, markdown, or explanation outside of the JSON array itself.
            Ensure that any double quotes inside string values are properly escaped (e.g., "a question with a \\"quote\\" in it").
            Each object in the array must have the following structure:
            {
              "question": "The question text. For multiple-choice, explicitly add '(Choose two)' or '(Choose three)' at the end of the question string.",
              "options": ["An array of strings for the options. Exactly 4 for single-choice and 'choose two' questions. Exactly 6 for 'choose three' questions in simulado mode. 4-6 for practice mode based on its rules."],
              "correctAnswer": "For single-choice questions, a string. For multiple-choice questions, an array of strings with the correct answers.",
              "isMultipleChoice": true or false,
              "difficulty": "The assigned difficulty ('Fácil', 'Médio', or 'Difícil').",
              "topic": "The specific curriculum topic string from the provided list that this question relates to. This is mandatory and must be one of the leaf-node topics from the input list.",
              "explanation": "A detailed explanation of why the correct answer(s) are correct, and a brief explanation for why each of the other options is incorrect. This must be thorough and educational."
            }
            CRITICAL: Generate a JSON array with exactly ${batchSettings.numberOfQuestions} new, unique questions. The entire response must ONLY be the JSON array. The structure must be perfect and strictly follow the rules for each mode.
        `;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash', contents: prompt,
            config: { responseMimeType: 'application/json', temperature: 0.8, topK: 40 }
        });

        let jsonStr = response.text.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) { jsonStr = match[2].trim(); }
        
        let parsedData;
        try { parsedData = JSON.parse(jsonStr); } catch (parseError) {
            console.error("Gemini response was not valid JSON for batch.", parseError, response.text);
            throw new Error("A resposta da IA (lote) não estava em um formato JSON válido.");
        }
        if (!Array.isArray(parsedData)) {
            if (typeof parsedData === 'object' && parsedData !== null && parsedData.question) {
                return [parsedData];
            }
            throw new Error("A resposta da IA (lote) não é um array de questões válido.");
        }
        return parsedData;
      };

      batchPromises.push(task());
    }

    const resultsFromBatches = await Promise.all(batchPromises);
    allGeneratedQuestions = resultsFromBatches.flat();
    
    // Final validation and ID mapping
    return allGeneratedQuestions.slice(0, totalQuestions).map((item: any, index: number) => {
        if (!item.question || !item.options || !item.correctAnswer || !item.difficulty || !item.explanation || !item.topic) {
            console.error("Invalid question structure from AI:", item);
            throw new Error(`Estrutura de questão inválida nos dados gerados no índice ${index}. Faltam campos obrigatórios.`);
        }
        return { ...item, id: Date.now() + index };
    });

  } catch (error) {
    console.error("Error generating questions with Gemini:", error);
    if (error instanceof Error) {
        if (error.message.includes('API_KEY') || error.message.includes('JSON válido') || error.message.includes('Estrutura de questão inválida')) {
            throw error;
        }
    }
    throw new Error("Falha ao gerar questões. O serviço de IA pode estar sobrecarregado ou a solicitação era inválida. Por favor, tente novamente.");
  }
};