import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuiz } from '../context/CourseContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';

interface QuizNavigatorProps {
    questionsCount: number;
    currentQuestionIndex: number;
    results: { question: { id: number }, isCorrect: boolean }[];
    reviewedQuestions: Set<number>;
    onQuestionSelect: (index: number) => void;
}

const QuizNavigator: React.FC<QuizNavigatorProps> = ({ questionsCount, currentQuestionIndex, results, reviewedQuestions, onQuestionSelect }) => {
    
    const answeredStatusMap = useMemo(() => {
        const map = new Map<number, boolean>();
        results.forEach(r => map.set(r.question.id, r.isCorrect));
        return map;
    }, [results]);

    const getStatusClass = (index: number, questionId: number) => {
        const isReviewed = reviewedQuestions.has(questionId);
        const baseClass = "w-10 h-10 flex items-center justify-center rounded-md border text-sm font-semibold transition-all duration-200";
        const reviewClass = isReviewed ? "ring-2 ring-yellow-400 ring-offset-1" : "";
        
        if (index === currentQuestionIndex) {
            return `${baseClass} ${reviewClass} bg-red-600 text-white border-red-700`;
        }
        
        const answerStatus = answeredStatusMap.get(questionId);
        if (answerStatus === true) {
            return `${baseClass} ${reviewClass} bg-green-100 border-green-300 text-green-800 hover:bg-green-200`;
        }
        if (answerStatus === false) {
            return `${baseClass} ${reviewClass} bg-red-100 border-red-300 text-red-800 hover:bg-red-200`;
        }

        return `${baseClass} ${reviewClass} bg-white border-slate-300 hover:bg-slate-100`;
    };

    return (
         <Card className="sticky top-20">
            <h3 className="font-bold text-lg mb-4 text-slate-800">Questions</h3>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[60vh] overflow-y-auto">
                {Array.from({ length: questionsCount }, (_, i) => {
                    const questionId = useQuiz().questions[i].id;
                    return (
                        <button
                            key={i}
                            onClick={() => onQuestionSelect(i)}
                            className={getStatusClass(i, questionId)}
                            aria-label={`Go to question ${i + 1}`}
                        >
                            {i + 1}
                        </button>
                    )
                })}
            </div>
        </Card>
    )
}

const QuizEnginePage: React.FC = () => {
    const navigate = useNavigate();
    const { settings, questions, results, submitAnswer, isLoading, error, endQuiz, reviewedQuestions, toggleReviewQuestion } = useQuiz();
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
    const [showFeedback, setShowFeedback] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [questionStartTime, setQuestionStartTime] = useState(Date.now());
    const [isNavOpen, setIsNavOpen] = useState(false);

    const isTimedMode = settings?.mode === 'timed' || settings?.mode === 'timed_half';

    useEffect(() => {
        if (!settings || questions.length === 0) return;
        if (isTimedMode) setTimeLeft(questions.length * 90);
        else if (settings.mode === 'lightning') setTimeLeft(settings.lightningBaseTime || 60);
        else setTimeLeft(null);
    }, [settings, questions, isTimedMode]);

    useEffect(() => {
        if (timeLeft === null || timeLeft <= 0) {
            if (timeLeft === 0) {
                endQuiz(isTimedMode ? (questions.length * 90) : undefined);
                navigate('/results');
            }
            return;
        }
        const timerId = setInterval(() => setTimeLeft(prev => (prev ? prev - 1 : 0)), 1000);
        return () => clearInterval(timerId);
    }, [timeLeft, navigate, questions.length, endQuiz, isTimedMode]);

    useEffect(() => {
        if (settings?.mode === 'practice' && !showFeedback) {
            const timerId = setInterval(() => setTimeElapsed(prev => prev + 1), 1000);
            return () => clearInterval(timerId);
        }
    }, [settings?.mode, showFeedback, currentQuestionIndex]);

    useEffect(() => {
        setQuestionStartTime(Date.now());
        setSelectedAnswers([]);
        setShowFeedback(false);
    }, [currentQuestionIndex]);


    const handleNext = useCallback(() => {
        const timeSpent = (Date.now() - questionStartTime) / 1000;
        submitAnswer(questions[currentQuestionIndex], selectedAnswers, timeSpent);
        
        if (settings?.mode === 'lightning' && timeLeft !== null) {
            setTimeLeft(prev => (prev || 0) + (settings.lightningBonusTime || 4));
        }
        
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            if (settings?.mode === 'practice') endQuiz(timeElapsed);
            else if (isTimedMode) endQuiz((questions.length * 90) - (timeLeft ?? 0));
            else endQuiz();
            navigate('/results');
        }
    }, [currentQuestionIndex, questions, selectedAnswers, submitAnswer, navigate, settings, timeLeft, endQuiz, timeElapsed, isTimedMode, questionStartTime]);

    if (isLoading) return <div className="text-center p-10"><Spinner /><p className="mt-4 text-lg">Generating your custom quiz...</p></div>;
    if (error) return <Navigate to="/" />;
    if (!settings || questions.length === 0) return <Navigate to="/" />;

    const question = questions[currentQuestionIndex];
    if (!question) return <Navigate to="/results" />;

    const handleAnswerSelect = (option: string) => {
        if (showFeedback) return;
        setSelectedAnswers(prev => question.isMultipleChoice ? (prev.includes(option) ? prev.filter(a => a !== option) : [...prev, option]) : [option]);
    };
    
    const handleCheckAnswer = () => {
        if (selectedAnswers.length === 0) return;
        setShowFeedback(true);
    };

    const isCorrect = (option: string) => {
        const correct = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];
        return correct.includes(option);
    };

    const formatTime = (seconds: number | null): string => {
        if (seconds === null) return '';
        if (seconds < 0) return '00:00';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const progressPercentage = ((results.length) / questions.length) * 100;
    
    let modeTitle = 'Practice Mode';
    if(settings.mode === 'timed') modeTitle = 'Full Simulator';
    if(settings.mode === 'timed_half') modeTitle = '1/2 Simulator';
    if(settings.mode === 'lightning') modeTitle = 'Lightning Quiz';
    const isReviewed = reviewedQuestions.has(question.id);

    return (
        <div className="max-w-7xl mx-auto">
            <div className="md:hidden mb-4">
                <Button onClick={() => setIsNavOpen(!isNavOpen)} className="w-full bg-slate-700 hover:bg-slate-800">
                    <i className={`fa-solid ${isNavOpen ? 'fa-xmark' : 'fa-bars'} mr-2`}></i> Quiz Navigation
                </Button>
            </div>
            <div className="flex flex-col md:flex-row gap-6">
                <aside className={`
                    ${isNavOpen ? 'block' : 'hidden'} md:block 
                    md:w-64 flex-shrink-0 animate-fade-in-left
                `}>
                   <QuizNavigator 
                       questionsCount={questions.length}
                       currentQuestionIndex={currentQuestionIndex}
                       results={results}
                       reviewedQuestions={reviewedQuestions}
                       onQuestionSelect={setCurrentQuestionIndex}
                   />
                </aside>
                <main className="flex-1 min-w-0">
                    <Card>
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <h1 className="text-xl font-bold text-red-600 capitalize">{modeTitle}</h1>
                                <div className="flex items-center space-x-4">
                                    {settings.mode === 'practice' ? (
                                        <div className="text-xl font-bold text-slate-600"><i className="fa-regular fa-clock mr-2"></i>{formatTime(timeElapsed)}</div>
                                    ) : (
                                        <div className={`text-xl font-bold ${timeLeft !== null && timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-slate-600'}`}><i className="fa-regular fa-clock mr-2"></i>{formatTime(timeLeft)}</div>
                                    )}
                                    <p className="text-gray-600 font-semibold">{results.length} / {questions.length}</p>
                                </div>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div className="bg-red-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-6 rounded-lg">
                            <h2 className="text-xl font-semibold mb-4 text-slate-800">{currentQuestionIndex + 1}. {question.question}</h2>
                            {question.isMultipleChoice && <p className="text-sm text-gray-500 mb-4 italic">Select all applicable options.</p>}
                            
                            <div className="space-y-3">
                                {question.options.map((option, index) => {
                                    const isSelected = selectedAnswers.includes(option);
                                    let feedbackClass = '';
                                    if (showFeedback) {
                                        if (isCorrect(option)) feedbackClass = 'bg-green-100 border-green-500';
                                        else if (isSelected && !isCorrect(option)) feedbackClass = 'bg-red-100 border-red-500';
                                    }
                                    
                                    return (
                                        <label key={index} className={`flex items-start p-4 rounded-lg border-2 transition-all ${!showFeedback && isSelected ? 'bg-red-100 border-red-500' : 'bg-white border-gray-200'} ${showFeedback ? 'cursor-default' : 'cursor-pointer hover:border-red-300'} ${feedbackClass}`}>
                                            <input
                                                type={question.isMultipleChoice ? "checkbox" : "radio"}
                                                name={`question-${question.id}`}
                                                value={option}
                                                checked={isSelected}
                                                onChange={() => handleAnswerSelect(option)}
                                                disabled={showFeedback}
                                                className="mt-1 h-5 w-5 text-red-600 focus:ring-red-500 border-gray-300"
                                            />
                                            <span className="ml-3 text-slate-700">{option}</span>
                                        </label>
                                    )
                                })}
                            </div>
                        </div>

                        {showFeedback && question.explanation && (
                            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg animate-fade-in">
                                <h4 className="font-bold text-blue-800">Explanation:</h4>
                                <p className="text-blue-700">{question.explanation}</p>
                            </div>
                        )}

                        <div className="mt-8 flex justify-between items-center">
                             <button 
                                type="button"
                                onClick={() => toggleReviewQuestion(question.id)} 
                                className={`px-4 py-2 rounded-lg flex items-center justify-center transition-all duration-200 text-sm font-semibold border-2 ${isReviewed ? 'bg-yellow-100 text-yellow-800 border-yellow-400' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`}
                                aria-label="Mark for Review"
                            >
                                <i className={`fa-solid fa-star mr-2 ${isReviewed ? 'text-yellow-500' : 'text-slate-400'}`}></i>
                                {isReviewed ? 'Marked for Review' : 'Mark for Review'}
                            </button>
                            {settings.mode === 'practice' ? (
                                showFeedback ? (
                                     <Button onClick={handleNext}>Next Question</Button>
                                ) : (
                                     <Button onClick={handleCheckAnswer} disabled={selectedAnswers.length === 0}>Check Answer</Button>
                                )
                            ) : (
                                <Button onClick={handleNext} disabled={selectedAnswers.length === 0}>
                                    {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish'}
                                </Button>
                            )}
                        </div>
                    </Card>
                </main>
            </div>
        </div>
    );
};

export default QuizEnginePage;