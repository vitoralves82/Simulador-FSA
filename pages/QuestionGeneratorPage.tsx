import React, { useState } from 'react';
import { generateQuestions } from '../services/geminiService';
import { curriculumTopics } from '../data/courseData';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import { Question } from '../types';

const QuestionGeneratorPage: React.FC = () => {
    const [topic, setTopic] = useState<string>(curriculumTopics[0].subTopics![0].title);
    const [generatedQuestion, setGeneratedQuestion] = useState<Question | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [showAnswer, setShowAnswer] = useState<boolean>(false);

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        setGeneratedQuestion(null);
        setShowAnswer(false);

        try {
            const result = await generateQuestions({
                topic: topic,
                difficulty: 'medium',
                count: 1,
                alignWithExam: true, // Always use aligned mode for single generation
            });

            if (result.ok && result.data && result.data.length > 0) {
                const genQ = result.data[0];
                const correctOptionIndices = genQ.answer_keys.map(key => key.charCodeAt(0) - 65);
                const cleanOptions = genQ.options.map(opt => opt.replace(/^[A-Z]\)\s*/, ''));

                const correctAnswers = correctOptionIndices
                    .map(index => cleanOptions[index])
                    .filter((item): item is string => !!item);

                if (correctAnswers.length !== genQ.answer_keys.length) {
                    throw new Error("AI returned a malformed answer. Please try again.");
                }
                
                const question: Question = {
                    id: Date.now(),
                    question: genQ.question,
                    options: cleanOptions,
                    correctAnswer: genQ.isMultipleChoice ? correctAnswers : correctAnswers[0],
                    isMultipleChoice: genQ.isMultipleChoice,
                    difficulty: 'Médio',
                    explanation: genQ.explanation,
                    topic: topic,
                };
                setGeneratedQuestion(question);
            } else {
                setError(result.reason || "A IA não retornou nenhuma questão. Tente novamente ou com um tópico diferente.");
            }
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4 text-center">Gerador Rápido de Questões</h1>
            <p className="text-lg text-gray-500 mb-8 text-center">Crie e valide rapidamente uma única questão de estudo sobre um tópico específico.</p>

            <Card>
                <div className="mb-6">
                    <label htmlFor="topic-select" className="block text-lg font-medium text-gray-700 mb-2">
                        Escolha um Tópico do Currículo:
                    </label>
                    <select
                        id="topic-select"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="mt-1 block w-full pl-3 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-md shadow-sm"
                    >
                        {curriculumTopics.map((t) => (
                            <optgroup key={t.id} label={t.title}>
                                {t.subTopics?.map(st => (
                                    st.subTopics ? (
                                        <optgroup key={st.id} label={`  ${st.title}`}>
                                            {st.subTopics.map(sst => (
                                                <option key={sst.id} value={sst.title}>{sst.title}</option>
                                            ))}
                                        </optgroup>
                                    ) : (
                                        <option key={st.id} value={st.title}>{st.title}</option>
                                    )
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </div>

                <div className="text-center">
                    <Button onClick={handleGenerate} disabled={isLoading} className="px-8 py-3 text-lg">
                        {isLoading ? (
                            <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                                Gerando...
                            </div>
                        ) : (
                            <><i className="fa-solid fa-wand-magic-sparkles mr-2"></i> Gerar Nova Questão</>
                        )}
                    </Button>
                </div>
            </Card>

            {error && (
                <div className="my-4 p-4 bg-red-100 text-red-800 border border-red-300 rounded-lg" role="alert">
                    <p><span className="font-bold">Error:</span> {error}</p>
                </div>
            )}
            
            {generatedQuestion && (
                <Card className="mt-8 animate-fade-in">
                    <h3 className="text-xl font-semibold mb-4 text-slate-800" style={{ whiteSpace: 'pre-wrap' }}>{generatedQuestion.question}</h3>
                    {generatedQuestion.isMultipleChoice && <p className="text-sm text-gray-500 mb-4 italic">Selecione todas as opções aplicáveis.</p>}
                    
                    <div className="space-y-3">
                        {generatedQuestion.options.map((option, index) => {
                             const isCorrect = Array.isArray(generatedQuestion.correctAnswer) 
                                ? generatedQuestion.correctAnswer.includes(option) 
                                : generatedQuestion.correctAnswer === option;
                            
                             return (
                                <div key={index} className={`p-4 rounded-lg border-2 ${showAnswer && isCorrect ? 'bg-green-100 border-green-500' : 'bg-white border-gray-200'}`}>
                                    <span className="ml-3 text-slate-700">{option}</span>
                                </div>
                             )
                        })}
                    </div>

                    <div className="mt-6 border-t pt-6 flex justify-between items-start">
                        <Button onClick={() => setShowAnswer(prev => !prev)} className="bg-slate-600 hover:bg-slate-700 focus:ring-slate-500">
                            {showAnswer ? 'Ocultar Resposta' : 'Mostrar Resposta'}
                        </Button>
                    </div>

                    {showAnswer && generatedQuestion.explanation && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg animate-fade-in">
                            <h4 className="font-bold text-blue-800">Explicação:</h4>
                            <p className="text-blue-700" style={{ whiteSpace: 'pre-wrap' }}>{generatedQuestion.explanation}</p>
                        </div>
                    )}
                </Card>
            )}

        </div>
    );
};

export default QuestionGeneratorPage;