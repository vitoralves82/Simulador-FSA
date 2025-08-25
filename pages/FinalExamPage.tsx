import React, { useState, useMemo } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useQuiz } from '../context/CourseContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { QuizResult } from '../types';

const ResultItem: React.FC<{ result: QuizResult, index: number }> = ({ result, index }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { question, userAnswer, isCorrect, timeSpentOnQuestion } = result;
    const correctAnswers = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];

    return (
        <div className={`border rounded-lg overflow-hidden ${isCorrect ? 'border-green-300' : 'border-red-300'}`}>
            <div className={`p-4 flex justify-between items-center cursor-pointer ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`} onClick={() => setIsOpen(!isOpen)}>
                <div className="flex-1 font-semibold text-slate-800 mr-4">Question {index + 1}</div>
                <div className="flex items-center space-x-4">
                     <span className="text-sm text-slate-500 hidden sm:inline">
                        <i className="fa-regular fa-clock mr-1"></i> {Math.round(timeSpentOnQuestion)}s
                     </span>
                    {isCorrect ? (
                         <span className="text-sm font-bold text-green-700"><i className="fa-solid fa-check mr-2"></i>Correct</span>
                    ) : (
                         <span className="text-sm font-bold text-red-700"><i className="fa-solid fa-times mr-2"></i>Incorrect</span>
                    )}
                    <i className={`fa-solid fa-chevron-down ml-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
                </div>
            </div>
            {isOpen && (
                <div className="p-4 bg-white border-t border-slate-200">
                    <p className="font-semibold mb-3 text-slate-800">{question.question}</p>
                    <p className="text-xs text-slate-400 mb-3">TOPIC: {question.topic}</p>
                    <div className="space-y-2 text-sm">
                        {question.options.map((option, i) => {
                            const isUserAnswer = userAnswer.includes(option);
                            const isCorrectAnswer = correctAnswers.includes(option);
                            let icon = <div className="w-5"></div>;
                            let colorClass = 'text-slate-600';

                            if (isCorrectAnswer) {
                                icon = <i className="fa-solid fa-check mr-2 text-green-600"></i>;
                                colorClass = 'text-green-800 font-semibold';
                            }
                            if (isUserAnswer && !isCorrectAnswer) {
                                icon = <i className="fa-solid fa-times mr-2 text-red-600"></i>;
                                colorClass = 'text-red-800 line-through';
                            } else if (isUserAnswer) {
                                icon = <i className="fa-solid fa-check mr-2 text-green-600"></i>;
                            }
                            
                            return (
                                <div key={i} className={`flex items-center ${colorClass}`}>
                                    {icon}
                                    <span>{option}</span>
                                </div>
                            );
                        })}
                    </div>
                     {question.explanation && (
                        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                            <h4 className="font-bold text-slate-700">Explanation:</h4>
                            <p className="text-slate-600">{question.explanation}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const ResultsPage: React.FC = () => {
    const { results, questions, resetQuiz, settings, timeTaken } = useQuiz();
    const navigate = useNavigate();

    const performanceData = useMemo(() => {
        if (!results || results.length === 0) return null;

        const topicStats: { [key: string]: { correct: number; total: number } } = {};
        
        results.forEach(result => {
          const topic = result.question.topic || "Uncategorized";
          if (!topicStats[topic]) {
            topicStats[topic] = { correct: 0, total: 0 };
          }
          topicStats[topic].total++;
          if (result.isCorrect) {
            topicStats[topic].correct++;
          }
        });

        const weakTopics = Object.entries(topicStats)
          .filter(([, stats]) => stats.correct < stats.total)
          .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))
          .map(([topic]) => topic);

        const questionTypeStats = results.reduce((acc, result) => {
            const type = result.question.isMultipleChoice ? 'multiple' : 'single';
            acc[type].total++;
            if (result.isCorrect) acc[type].correct++;
            return acc;
        }, { single: { correct: 0, total: 0 }, multiple: { correct: 0, total: 0 } });

        return { topicStats, weakTopics, questionTypeStats };
    }, [results]);


    if (questions.length === 0 || !performanceData) {
        return <Navigate to="/" />;
    }

    const correctCount = results.filter(r => r.isCorrect).length;
    const totalCount = questions.length;
    const percentage = Math.round((correctCount / totalCount) * 100);

    const getFeedback = () => {
        if (percentage >= 90) return { text: "Excellent! You have mastered the subject!", icon: "fa-rocket", color: "text-green-500" };
        if (percentage >= 70) return { text: "Very good! Keep practicing.", icon: "fa-thumbs-up", color: "text-blue-500" };
        if (percentage >= 50) return { text: "Good effort. Review the questions to improve.", icon: "fa-book-open", color: "text-yellow-500" };
        return { text: "Don't be discouraged! Review is the key to success.", icon: "fa-face-sad-tear", color: "text-red-500" };
    };
    
    const feedback = getFeedback();
    
    const formatTime = (seconds: number | null): string => {
        if (seconds === null) return 'N/A';
        if (seconds < 0) return '00:00';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const handleRetryWeakTopics = () => {
        if (performanceData?.weakTopics && performanceData.weakTopics.length > 0) {
            navigate('/', {
                state: {
                    weakTopics: performanceData.weakTopics,
                },
            });
        }
    };

    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            <Card className="text-center">
                <h1 className="text-4xl font-bold mb-4">Performance Report</h1>
                <i className={`fa-solid ${feedback.icon} fa-4x mb-4 ${feedback.color}`}></i>
                <h2 className="text-2xl font-semibold mb-2">{feedback.text}</h2>
                <p className="text-xl my-6 text-slate-700">
                    Your score: <span className="font-bold">{correctCount}</span> of {totalCount} questions (<span className={`font-bold ${feedback.color}`}>{percentage}%</span>)
                </p>
                
                <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                    <Button onClick={() => navigate('/')} className="w-full sm:w-auto">
                       <i className="fa-solid fa-home mr-2"></i> Home
                    </Button>
                    {performanceData.weakTopics.length > 0 && (
                        <Button onClick={handleRetryWeakTopics} className="bg-orange-500 hover:bg-orange-600 focus:ring-orange-400 w-full sm:w-auto">
                            <i className="fa-solid fa-arrows-rotate mr-2"></i> Retry Weak Topics
                        </Button>
                    )}
                </div>
            </Card>
            
            <Card className="mt-8">
                <h3 className="text-2xl font-bold mb-4 text-slate-800">Detailed Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                         <h4 className="font-semibold text-lg text-slate-700 mb-3">Performance by Topic</h4>
                         <div className="space-y-2">
                             {Object.entries(performanceData.topicStats).map(([topic, stats]) => (
                                <div key={topic} className="text-sm">
                                    <div className="flex justify-between mb-1">
                                        <span className="font-medium text-slate-600">{topic.split('. ').slice(1).join('. ')}</span>
                                        <span className="font-semibold text-slate-800">{stats.correct}/{stats.total}</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-2">
                                        <div 
                                            className={`h-2 rounded-full ${stats.correct/stats.total > 0.7 ? 'bg-green-500' : 'bg-red-500'}`}
                                            style={{width: `${(stats.correct/stats.total) * 100}%`}}>
                                        </div>
                                    </div>
                                </div>
                             ))}
                         </div>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-semibold text-lg text-slate-700 mb-3">Response Time</h4>
                             <div className="flex items-baseline justify-center bg-slate-50 p-4 rounded-lg">
                                <span className="text-4xl font-bold text-slate-800">{formatTime(timeTaken)}</span>
                                <span className="text-sm text-slate-500 ml-2">Total Time</span>
                             </div>
                        </div>
                         <div>
                            <h4 className="font-semibold text-lg text-slate-700 mb-3">Accuracy by Question Type</h4>
                             <div className="space-y-3 bg-slate-50 p-4 rounded-lg">
                                 <p className="flex justify-between text-sm"><span>Single Choice:</span> <span className="font-bold">{performanceData.questionTypeStats.single.correct} of {performanceData.questionTypeStats.single.total}</span></p>
                                 <p className="flex justify-between text-sm"><span>Multiple Choice:</span> <span className="font-bold">{performanceData.questionTypeStats.multiple.correct} of {performanceData.questionTypeStats.multiple.total}</span></p>
                             </div>
                        </div>
                    </div>
                </div>
            </Card>

            <div className="mt-8">
                <h3 className="text-2xl font-bold mb-4 text-slate-800">Question Review</h3>
                <div className="space-y-4">
                    {results.map((result, index) => (
                        <ResultItem key={result.question.id} result={result} index={index} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ResultsPage;