import { ReactNode } from 'react';

export interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string | string[];
  isMultipleChoice?: boolean;
  difficulty: 'Fácil' | 'Médio' | 'Difícil';
  explanation?: string; // Optional field for AI to explain the answer
  topic: string;
}

export interface CourseTopic {
  id: string;
  title: string;
  longTitle?: string;
  content?: ReactNode;
  subTopics?: CourseTopic[];
}

export type QuizMode = 'practice' | 'timed' | 'timed_half' | 'assessment';

export type Difficulty = 'Fácil' | 'Médio' | 'Difícil';

export interface QuizSettings {
    topics: string[];
    difficulty: Difficulty[];
    numberOfQuestions: number;
    mode: QuizMode;
}

export interface QuizResult {
    question: Question;
    userAnswer: string[];
    isCorrect: boolean;
    timeSpentOnQuestion: number;
}