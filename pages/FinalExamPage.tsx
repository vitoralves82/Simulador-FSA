import React, { useState, useMemo } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useQuiz } from '../context/CourseContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import { QuizResult, Question } from '../types';

const ResultItem: React.FC<{ result: QuizResult, index: number }> = ({ result, index }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { question, userAnswer, isCorrect, timeSpentOnQuestion } = result;
    const correctAnswers = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];
    
    const [isAiExplanationLoading, setIsAiExplanationLoading] = useState(false);
    const [aiExplanation, setAiExplanation] = useState<string | null>(null);
    const [aiExplanationError, setAiExplanationError] = useState<string | null>(null);
    
    const handleGetAiExplanation = async () => {
        setIsAiExplanationLoading(true);
        setAiExplanationError(null);
        try {
            const { generateExplanation } = await import('../services/geminiService');
            const explanationText = await generateExplanation(question, userAnswer);
            setAiExplanation(explanationText);
        } catch (err: any) {
            setAiExplanationError(err.message || "Failed to load explanation.");
        } finally {
            setIsAiExplanationLoading(false);
        }
    };

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
                <div className="p-4 bg-white border-t border-slate-200 animate-fade-in">
                    <p className="font-semibold mb-3 text-slate-800" style={{ whiteSpace: 'pre-wrap' }}>{question.question}</p>
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
                     {question.explanation && !aiExplanation && (
                        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                            <h4 className="font-bold text-slate-700">Explanation:</h4>
                            <p className="text-slate-600" style={{ whiteSpace: 'pre-wrap' }}>{question.explanation}</p>
                        </div>
                    )}
                    {aiExplanation && (
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                            <h4 className="font-bold text-blue-800"><i className="fa-solid fa-brain mr-2"></i>AI Tutor Explanation:</h4>
                            <p className="text-blue-700" style={{ whiteSpace: 'pre-wrap' }}>{aiExplanation}</p>
                        </div>
                    )}
                     <div className="mt-4">
                        <Button 
                            onClick={handleGetAiExplanation} 
                            disabled={isAiExplanationLoading} 
                            className="bg-sky-600 hover:bg-sky-700 focus:ring-sky-500 text-xs py-1 px-3"
                        >
                             {isAiExplanationLoading ? (
                                <>
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                                    Thinking...
                                </>
                             ) : (
                                <><i className="fa-solid fa-wand-magic-sparkles mr-2"></i>Ask AI Tutor</>
                             )}
                        </Button>
                        {aiExplanationError && <p className="text-red-500 text-xs mt-1">{aiExplanationError}</p>}
                    </div>
                </div>
            )}
        </div>
    );
};

const ResultsPage: React.FC = () => {
    const { results, questions, resetQuiz, settings, timeTaken } = useQuiz();
    const navigate = useNavigate();

    const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    const handleGenerateAnalysis = async () => {
        setIsAnalysisLoading(true);
        setAnalysisError(null);
        try {
            const { generatePerformanceAnalysis } = await import('../services/geminiService');
            const analysisText = await generatePerformanceAnalysis(results, timeTaken);
            setAnalysis(analysisText);
        } catch (err: any) {
            setAnalysisError(err.message || "Failed to generate analysis.");
        } finally {
            setIsAnalysisLoading(false);
        }
    };

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

        const topicTypeStats: { [topic: string]: { single: { correct: number, total: number }, multiple: { correct: number, total: number }}} = {};
        results.forEach(result => {
            const topic = result.question.topic || "Uncategorized";
            const type = result.question.isMultipleChoice ? 'multiple' : 'single';
            if (!topicTypeStats[topic]) {
                topicTypeStats[topic] = {
                    single: { correct: 0, total: 0 },
                    multiple: { correct: 0, total: 0 }
                };
            }
            topicTypeStats[topic][type].total++;
            if (result.isCorrect) {
                topicTypeStats[topic][type].correct++;
            }
        });

        const weakAreas = Object.entries(topicTypeStats).flatMap(([topic, stats]) => {
            const areas = [];
            if (stats.single.total > 0 && stats.single.correct < stats.single.total) {
                areas.push({
                    topic,
                    type: 'Single-Choice',
                    accuracy: stats.single.correct / stats.single.total,
                    ...stats.single
                });
            }
            if (stats.multiple.total > 0 && stats.multiple.correct < stats.multiple.total) {
                areas.push({
                    topic,
                    type: 'Multiple-Choice',
                    accuracy: stats.multiple.correct / stats.multiple.total,
                    ...stats.multiple
                });
            }
            return areas;
        }).sort((a, b) => a.accuracy - b.accuracy);


        return { topicStats, weakTopics, questionTypeStats, weakAreas: weakAreas.slice(0, 3) };
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
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
                    <h3 className="text-2xl font-bold text-slate-800 mb-3 sm:mb-0">AI Performance Analysis</h3>
                    {!analysis && (
                        <Button onClick={handleGenerateAnalysis} disabled={isAnalysisLoading} className="bg-slate-700 hover:bg-slate-800 focus:ring-slate-500">
                            {isAnalysisLoading ? (
                                <div className="flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                                    Analyzing...
                                </div>
                            ) : (
                                <><i className="fa-solid fa-wand-magic-sparkles mr-2"></i>Generate Report</>
                            )}
                        </Button>
                    )}
                </div>
                {isAnalysisLoading && <div className="flex justify-center p-4"><Spinner /></div>}
                {analysisError && <p className="text-red-500 bg-red-50 p-3 rounded-md">{analysisError}</p>}
                {analysis && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700">{analysis}</pre>
                    </div>
                )}
            </Card>

            <Card className="mt-8">
                <h3 className="text-2xl font-bold mb-4 text-slate-800">Study Recommendations</h3>
                {performanceData.weakAreas && performanceData.weakAreas.length > 0 ? (
                    <div className="space-y-4">
                    <p className="text-slate-600">Based on your performance, you should focus on these areas:</p>
                    <ul className="list-disc list-inside space-y-3 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        {performanceData.weakAreas.map((area, index) => (
                        <li key={index} className="text-slate-700">
                            <span className="font-semibold">{area.type}</span> questions related to the topic <span className="font-semibold">"{area.topic.split('. ').slice(1).join('. ')}"</span>.
                            <span className="text-sm text-slate-500 ml-2">({area.correct} of {area.total} correct)</span>
                        </li>
                        ))}
                    </ul>
                    </div>
                ) : (
                    <p className="text-slate-600">Great job! No specific weak areas were identified. Keep up the broad-based practice.</p>
                )}
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