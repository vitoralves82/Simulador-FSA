import React from 'react';
import { useQuizHistory, QuizHistoryItem } from '../hooks/useQuizHistory';
import Card from '../components/common/Card';
import Button from '../components/common/Button';

const HistoryItemCard: React.FC<{ item: QuizHistoryItem; index: number }> = ({ item, index }) => {
    const { settings, results, date } = item;
    const correctCount = results.filter(r => r.isCorrect).length;
    const totalCount = results.length;
    const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

    let modeTitle = 'Practice';
    if (settings.mode === 'timed') modeTitle = 'Full Simulator';
    if (settings.mode === 'timed_half') modeTitle = '1/2 Simulator';
    if (settings.mode === 'assessment') modeTitle = 'Assessment';
    
    const getScoreColor = () => {
        if (percentage >= 90) return "text-green-500";
        if (percentage >= 70) return "text-blue-500";
        if (percentage >= 50) return "text-yellow-500";
        return "text-red-500";
    };

    return (
        <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
            <div className="mb-4 sm:mb-0">
                <p className="font-bold text-lg text-slate-800">{modeTitle}</p>
                <p className="text-sm text-slate-500">
                    {new Date(date).toLocaleDateString()} - {new Date(date).toLocaleTimeString()}
                </p>
                 <p className="text-xs text-slate-400 mt-1">{totalCount} questions</p>
            </div>
            <div className="flex items-center space-x-4">
                <div className="text-right">
                    <p className={`text-2xl font-bold ${getScoreColor()}`}>{percentage}%</p>
                    <p className="text-sm text-slate-600">{correctCount} / {totalCount} correct</p>
                </div>
            </div>
        </Card>
    );
};


const QuizHistoryPage: React.FC = () => {
    const { history, clearHistory } = useQuizHistory();

    const handleClearHistory = () => {
        if (window.confirm("Are you sure you want to delete your entire quiz history? This action cannot be undone.")) {
            clearHistory();
        }
    };
    
    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl md:text-5xl font-bold text-gray-800">Quiz History</h1>
                    <p className="text-xl text-gray-500 mt-1">Review your past performance.</p>
                </div>
                {history.length > 0 && (
                    <Button onClick={handleClearHistory} className="bg-slate-600 hover:bg-slate-700 focus:ring-slate-500">
                        <i className="fa-solid fa-trash mr-2"></i> Clear History
                    </Button>
                )}
            </div>

            {history.length > 0 ? (
                <div className="space-y-4">
                    {history.map((item, index) => (
                        <HistoryItemCard key={item.date} item={item} index={index} />
                    ))}
                </div>
            ) : (
                <Card className="text-center py-12">
                     <i className="fa-solid fa-history text-5xl text-slate-400 mb-4"></i>
                    <h2 className="text-2xl font-bold text-slate-700">No History Yet</h2>
                    <p className="text-slate-500 mt-2">Your completed quizzes will appear here.</p>
                </Card>
            )}
        </div>
    );
};

export default QuizHistoryPage;