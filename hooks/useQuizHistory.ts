import { useState, useEffect, useCallback } from 'react';
import { QuizSettings } from '../types';

const HISTORY_STORAGE_KEY = 'quizHistory';
const MAX_HISTORY_ITEMS = 50;

// Define a leaner result type for storage.
// We only need 'isCorrect' to calculate the score for the history summary.
interface LeanQuizResult {
    isCorrect: boolean;
}

export interface QuizHistoryItem {
    settings: QuizSettings;
    results: LeanQuizResult[];
    date: string;
    timeTaken: number | null;
}

export const useQuizHistory = () => {
    const [history, setHistory] = useState<QuizHistoryItem[]>([]);

    useEffect(() => {
        let needsResave = false;
        try {
            const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
            if (storedHistory) {
                const parsedHistory = JSON.parse(storedHistory) as any[];

                // Sanitize and lean the history data on load.
                // This will migrate old, bloated history items to the new lean format.
                const sanitizedHistory = parsedHistory.map((item: any) => {
                    // Check if the first result is bloated (has a 'question' property)
                    if (item.results && item.results[0] && item.results[0].question) {
                        needsResave = true;
                    }
                    return {
                        settings: item.settings,
                        results: item.results.map((r: any) => ({ isCorrect: r.isCorrect })),
                        date: item.date,
                        timeTaken: item.timeTaken,
                    };
                }).slice(0, MAX_HISTORY_ITEMS);

                setHistory(sanitizedHistory);

                // Re-save if we migrated any old data.
                if (needsResave) {
                    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(sanitizedHistory));
                }
            }
        } catch (error) {
            console.error("Failed to load or parse quiz history. Clearing it to recover.", error);
            localStorage.removeItem(HISTORY_STORAGE_KEY);
            setHistory([]);
        }
    }, []);

    const saveQuizToHistory = useCallback((item: QuizHistoryItem) => {
        setHistory(prevHistory => {
            const updatedHistory = [item, ...prevHistory].slice(0, MAX_HISTORY_ITEMS);
            try {
                localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
            } catch (error) {
                console.error("Failed to save quiz history to localStorage. Storage might be full or disabled.", error);
            }
            return updatedHistory;
        });
    }, []);

    const clearHistory = useCallback(() => {
        try {
            localStorage.removeItem(HISTORY_STORAGE_KEY);
            setHistory([]);
        } catch (error) {
            console.error("Failed to clear quiz history from localStorage", error);
        }
    }, []);

    return { history, saveQuizToHistory, clearHistory };
};
