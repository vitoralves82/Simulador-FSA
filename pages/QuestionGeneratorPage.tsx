import React, { useState } from 'react';
import { generateQuestions } from '../services/geminiService';
import { curriculumTopics } from '../data/courseData';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import { Question, QuizSettings } from '../types';

const QuestionGeneratorPage: React.FC = () => {
    const [topic, setTopic] = useState<string>(curriculumTopics[0].title);
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
            const settings: QuizSettings = {
                topics: [topic],
                difficulty: ['Médio'],
                numberOfQuestions: 1,
                mode: 'practice',
            };
            const questions = await generateQuestions(settings);
            if (questions && questions.length > 0) {
                setGeneratedQuestion(questions[0]);
            } else {
                setError("A IA não retornou nenhuma questão. Tente novamente ou com um tópico diferente.");
            }
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="animate-fade-in">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Gerador de Questões com IA</h1>
            <p className="text-lg text-gray-500 mb-8">Use a API do Gemini para criar novas questões de estudo sobre tópicos específicos do exame.</p>

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
                            <option key={t.id} value={t.title}>{t.title}</option>
                        ))}
                    </select>
                </div>

                <Button onClick={handleGenerate} disabled={isLoading}>
                    {isLoading ? (
                        <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                            <span>Gerando...</span>
                        </div>
                    ) : (
                        'Gerar Questão'
                    )}
                </Button>

                {isLoading && !generatedQuestion && (
                    <div className="mt-8 text-center">
                        <Spinner />
                        <p className="mt-2 text-slate-600">Aguarde, a IA está elaborando sua questão...</p>
                    </div>
                )}

                {error && (
                    <div className="mt-8 p-4 bg-red-100 text-red-800 border border-red-300 rounded-lg">
                        <p><span className="font-bold">Erro:</span> {error}</p>
                         <p className="text-sm mt-2">Por favor, verifique se a chave de API do Gemini foi configurada corretamente nas variáveis de ambiente e tente novamente.</p>
                    </div>
                )}

                {generatedQuestion && (
                    <div className="mt-8 border-t pt-8">
                        <h3 className="text-xl font-semibold text-gray-800 mb-4">Questão Gerada:</h3>
                        <div className="bg-slate-50 p-6 rounded-lg">
                            <p className="font-semibold mb-4 text-slate-800">{generatedQuestion.question}</p>
                            <div className="space-y-2">
                                {generatedQuestion.options.map((option, index) => {
                                    const isCorrect = showAnswer && (Array.isArray(generatedQuestion.correctAnswer) ? generatedQuestion.correctAnswer.includes(option) : option === generatedQuestion.correctAnswer);
                                    return (
                                        <div 
                                            key={index}
                                            className={`p-3 rounded-lg border-2 transition-all ${isCorrect ? 'bg-green-100 border-green-400 font-bold text-green-800' : 'bg-white border-slate-200'}`}
                                        >
                                            {option}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                        <Button onClick={() => setShowAnswer(!showAnswer)} className="mt-4">
                            {showAnswer ? 'Ocultar Resposta' : 'Mostrar Resposta'}
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default QuestionGeneratorPage;