import { useState, useEffect, useCallback } from 'react';
import { QuizSettings, QuizResult } from '../types';

const HISTORY_STORAGE_KEY = 'quizHistory';

export interface QuizHistoryItem {
    settings: QuizSettings;
    results: QuizResult[];
    date: string;
    timeTaken: number | null;
}

export const useQuizHistory = () => {
    const [history, setHistory] = useState<QuizHistoryItem[]>([]);

    useEffect(() => {
        try {
            const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
            if (storedHistory) {
                setHistory(JSON.parse(storedHistory));
            }
        } catch (error) {
            console.error("Failed to load quiz history from localStorage", error);
        }
    }, []);

    const saveQuizToHistory = useCallback((item: QuizHistoryItem) => {
        setHistory(prevHistory => {
            const newHistory = [item, ...prevHistory];
            try {
                localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
            } catch (error) {
                console.error("Failed to save quiz history to localStorage", error);
            }
            return newHistory;
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