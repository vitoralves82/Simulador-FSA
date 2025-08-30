import React, { createContext, useState, useContext, ReactNode } from 'react';
import { QuizSettings, Question, QuizResult } from '../types';

interface QuizContextType {
  settings: QuizSettings | null;
  questions: Question[];
  results: QuizResult[];
  isLoading: boolean;
  error: string | null;
  timeTaken: number | null;
  reviewedQuestions: Set<number>;
  startQuiz: (settings: QuizSettings, questions: Question[]) => void;
  submitAnswer: (question: Question, userAnswer: string[], timeSpentOnQuestion: number) => void;
  endQuiz: (timeInSeconds?: number) => void;
  resetQuiz: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  toggleReviewQuestion: (questionId: number) => void;
}

const QuizContext = createContext<QuizContextType | undefined>(undefined);

export const QuizProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<QuizSettings | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [timeTaken, setTimeTaken] = useState<number | null>(null);
  const [reviewedQuestions, setReviewedQuestions] = useState(new Set<number>());

  const startQuiz = (newSettings: QuizSettings, newQuestions: Question[]) => {
    setSettings(newSettings);
    setQuestions(newQuestions);
    setResults([]);
    setErrorState(null);
    setTimeTaken(null);
    setReviewedQuestions(new Set());
  };

  const submitAnswer = (question: Question, userAnswer: string[], timeSpentOnQuestion: number) => {
    const correctAnswers = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];
    const sortedCorrect = [...correctAnswers].sort();
    const sortedUser = [...userAnswer].sort();
    
    const isCorrect = 
      sortedCorrect.length === sortedUser.length &&
      sortedCorrect.every((value, index) => value === sortedUser[index]);
      
    setResults(prev => [...prev, { question, userAnswer, isCorrect, timeSpentOnQuestion }]);
  };
  
  const endQuiz = (timeInSeconds?: number) => {
    setTimeTaken(timeInSeconds ?? null);
  };

  const resetQuiz = () => {
    setSettings(null);
    setQuestions([]);
    setResults([]);
    setErrorState(null);
    setTimeTaken(null);
    setReviewedQuestions(new Set());
  }

  const setLoading = (loading: boolean) => {
    setIsLoading(loading);
  };
  
  const setError = (error: string | null) => {
      setErrorState(error);
  }
  
  const toggleReviewQuestion = (questionId: number) => {
    setReviewedQuestions(prev => {
        const newSet = new Set(prev);
        if (newSet.has(questionId)) {
            newSet.delete(questionId);
        } else {
            newSet.add(questionId);
        }
        return newSet;
    });
  };

  return (
    <QuizContext.Provider value={{ settings, questions, results, isLoading, error, timeTaken, startQuiz, submitAnswer, endQuiz, resetQuiz, setLoading, setError, reviewedQuestions, toggleReviewQuestion }}>
      {children}
    </QuizContext.Provider>
  );
};

export const useQuiz = (): QuizContextType => {
  const context = useContext(QuizContext);
  if (context === undefined) {
    throw new Error('useQuiz must be used within a QuizProvider');
  }
  return context;
};