import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { curriculumTopics } from '../data/courseData';
import { useQuiz } from '../context/CourseContext';
import { generateQuestions } from '../services/geminiService';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import { QuizMode, QuizSettings, CourseTopic, Difficulty, Question } from '../types';


interface TopicItemProps {
    topic: CourseTopic;
    selectedTopics: Set<string>;
    onTopicChange: (topic: CourseTopic, checked: boolean) => void;
    disabled: boolean;
}

// Helper types for parsing loaded JSON quizzes
interface LoadedItem {
  id: string;
  type: 'single' | 'multi' | string;
  topics: string[];
  stem: string;
  options: string[];
}

interface LoadedAnswer {
  id: string;
  correctOptionIndices: number[];
  explanation: string;
}

interface LoadedQuiz {
  items: LoadedItem[];
  answerKey: LoadedAnswer[];
}

const TopicItem: React.FC<TopicItemProps> = ({ topic, selectedTopics, onTopicChange, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const isSelected = selectedTopics.has(topic.title);
    const hasSubtopics = topic.subTopics && topic.subTopics.length > 0;

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onTopicChange(topic, e.target.checked);
    };

    return (
        <div className="my-1">
            <div className="flex items-center">
                {hasSubtopics && (
                    <button
                        type="button"
                        onClick={() => !disabled && setIsOpen(!isOpen)}
                        className="w-6 h-6 mr-1 text-slate-500 hover:text-slate-800 flex-shrink-0"
                        aria-label={isOpen ? `Collapse ${topic.title}` : `Expand ${topic.title}`}
                        disabled={disabled}
                    >
                        <i className={`fa-solid fa-chevron-right text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`}></i>
                    </button>
                )}
                <label className={`flex items-center p-2 rounded-md transition-all w-full ${disabled ? 'cursor-not-allowed bg-slate-50' : 'cursor-pointer'} ${isSelected ? 'bg-red-50' : 'hover:bg-slate-100'} ${!hasSubtopics ? 'ml-7' : ''}`}>
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={handleCheckboxChange}
                        className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                        disabled={disabled}
                    />
                    <span className={`ml-3 text-slate-700 ${isSelected ? 'font-semibold' : ''}`}>{topic.title}</span>
                </label>
            </div>
            {hasSubtopics && isOpen && (
                <div className="pl-5 mt-1 border-l-2 border-slate-200 ml-3">
                    {topic.subTopics?.map(subTopic => (
                        <TopicItem key={subTopic.id} topic={subTopic} selectedTopics={selectedTopics} onTopicChange={onTopicChange} disabled={disabled} />
                    ))}
                </div>
            )}
        </div>
    );
};


const SetupPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { startQuiz, isLoading, setLoading, setError, error } = useQuiz();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inspirationFileInputRef = useRef<HTMLInputElement>(null);


  const [settings, setSettings] = useState<Pick<QuizSettings, 'topics' | 'difficulty' | 'numberOfQuestions'>>({
    topics: [curriculumTopics[0].subTopics![0].title],
    difficulty: ['Médio'],
    numberOfQuestions: 10,
  });
  const [mode, setMode] = useState<QuizMode>('practice');
  const [alignWithExam, setAlignWithExam] = useState(true);
  const [inspirationFiles, setInspirationFiles] = useState<File[]>([]);
  const [notification, setNotification] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<number | null>(null);
  
  const [activeTopicId, setActiveTopicId] = useState<string>(curriculumTopics[0].id);

  const isSimuladoMode = mode === 'timed' || mode === 'timed_half';
  const isAssessmentMode = mode === 'assessment';
  const isGeneratorMode = !isSimuladoMode && !isAssessmentMode;

  const SIMULADO_COMPLETO_QUESTIONS = 20;
  const HALF_SIMULADO_QUESTIONS = 50;

  const allTopicTitles = useMemo(() => {
    const titles: string[] = [];
    const collect = (topics: CourseTopic[]) => {
      topics.forEach(t => {
        titles.push(t.title);
        if (t.subTopics) collect(t.subTopics);
      });
    };
    collect(curriculumTopics);
    return titles;
  }, []);

  const effectiveSettings = useMemo(() => {
    if (isSimuladoMode) {
        let numQuestions;
        if (mode === 'timed') {
            numQuestions = SIMULADO_COMPLETO_QUESTIONS;
        } else { // 'timed_half'
            numQuestions = HALF_SIMULADO_QUESTIONS;
        }
      return {
        topics: allTopicTitles,
        difficulty: ['Fácil', 'Médio', 'Difícil'] as Difficulty[],
        numberOfQuestions: numQuestions,
      };
    }
    if (isAssessmentMode) {
      return {
        topics: [],
        difficulty: ['Fácil', 'Médio', 'Difícil'] as Difficulty[],
        numberOfQuestions: settings.numberOfQuestions
      };
    }
    return settings;
  }, [settings, isSimuladoMode, isAssessmentMode, mode, allTopicTitles]);


  const activeTopic = useMemo(() => 
    curriculumTopics.find(t => t.id === activeTopicId) || curriculumTopics[0],
    [activeTopicId]
  );
  
  const [parentMap, childrenMap, topicToPartMap] = useMemo(() => {
    const pMap = new Map<string, string | null>();
    const cMap = new Map<string, string[]>();
    const partMap = new Map<string, string>();
    
    const traverse = (topic: CourseTopic, parent: CourseTopic | null, partId: string) => {
        pMap.set(topic.title, parent ? parent.title : null);
        partMap.set(topic.title, partId);

        const childTitles = topic.subTopics ? topic.subTopics.map(t => t.title) : [];
        cMap.set(topic.title, childTitles);

        if (topic.subTopics) {
            topic.subTopics.forEach(sub => traverse(sub, topic, partId));
        }
    };
    
    curriculumTopics.forEach(part => {
      partMap.set(part.title, part.id);
      if (part.subTopics) {
        part.subTopics.forEach(subTopic => traverse(subTopic, part, part.id));
      }
    });

    return [pMap, cMap, partMap];
  }, []);

    const selectedTopics = useMemo(() => new Set(effectiveSettings.topics), [effectiveSettings.topics]);
    
    useEffect(() => {
        if (location.state?.weakTopics) {
            const weakTopics: string[] = location.state.weakTopics;
            
            const topicsToSelect = new Set<string>();

            const addTopicAndItsChildren = (topicTitle: string) => {
                topicsToSelect.add(topicTitle);
                const children = childrenMap.get(topicTitle) || [];
                children.forEach(child => addTopicAndItsChildren(child));
            };
            
            weakTopics.forEach(topic => addTopicAndItsChildren(topic));

            setSettings(prev => ({
                ...prev,
                topics: Array.from(topicsToSelect),
                difficulty: ['Fácil', 'Médio', 'Difícil'],
                numberOfQuestions: Math.min(10, Array.from(topicsToSelect).filter(t => (childrenMap.get(t) || []).length === 0).length || 10)
            }));
            setMode('practice');
            setNotification(`Focusing on your weakest topics. Ready for a review round?`);
            
            window.scrollTo(0, 0);

            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate, childrenMap]);

    useEffect(() => {
        if (location.pathname === '/exam') {
            setMode('timed');
        }
    }, [location.pathname]);

    const handleTopicChange = useCallback((topic: CourseTopic, checked: boolean) => {
        if (!isGeneratorMode) return;
        setSettings(prev => {
            const newSelected = new Set(prev.topics);

            const updateChildren = (title: string, select: boolean) => {
                if (select) newSelected.add(title);
                else newSelected.delete(title);
                const children = childrenMap.get(title) || [];
                children.forEach(child => updateChildren(child, select));
            };
            updateChildren(topic.title, checked);

            const updateParents = (title: string) => {
                const parentTitle = parentMap.get(title);
                if (!parentTitle) return;

                if (checked) {
                    const siblingTitles = childrenMap.get(parentTitle) || [];
                    const allSiblingsChecked = siblingTitles.every(t => newSelected.has(t));
                    if (allSiblingsChecked) {
                        newSelected.add(parentTitle);
                        updateParents(parentTitle);
                    }
                } else {
                    if (newSelected.has(parentTitle)) {
                        newSelected.delete(parentTitle);
                        updateParents(parentTitle);
                    }
                }
            };
            updateParents(topic.title);
            
            const newTopicsArray = Array.from(newSelected);
            if (newTopicsArray.length === 0) return prev; // Prevent unselecting all

            return { ...prev, topics: newTopicsArray };
        });
    }, [parentMap, childrenMap, isGeneratorMode]);
    
  const handleDifficultyChange = (d: Difficulty, checked: boolean) => {
    if (!isGeneratorMode) return;
    setSettings(prev => {
        const currentDifficulties = prev.difficulty;
        let newDifficulties;
        if (checked) {
            newDifficulties = [...currentDifficulties, d].sort();
        } else {
            newDifficulties = currentDifficulties.filter(diff => diff !== d);
        }
        // Ensure at least one is selected
        if (newDifficulties.length === 0) {
            return prev;
        }
        return { ...prev, difficulty: newDifficulties };
    });
  };

  const transformLoadedQuizData = (data: LoadedQuiz, startIndex: number = 0): Question[] => {
    if (!data.items || !data.answerKey) {
        throw new Error("Invalid JSON format: 'items' and 'answerKey' properties are required.");
    }

    const answerMap = new Map<string, LoadedAnswer>();
    data.answerKey.forEach(ans => answerMap.set(ans.id, ans));

    const questions: Question[] = data.items.map((item, index) => {
        const answer = answerMap.get(item.id);
        if (!answer) {
            console.warn(`Answer not found for question ID: ${item.id}, skipping.`);
            return null;
        }

        const correctAnswers = answer.correctOptionIndices.map(i => item.options[i]);
        if (correctAnswers.some(ans => ans === undefined)) {
            console.warn(`Invalid correctOptionIndices for question ID: ${item.id}, skipping.`);
            return null;
        }

        const isMultipleChoice = item.type === 'multi' || correctAnswers.length > 1;

        const question: Question = {
            id: startIndex + index,
            question: item.stem,
            options: item.options,
            correctAnswer: isMultipleChoice ? correctAnswers : correctAnswers[0],
            isMultipleChoice: isMultipleChoice,
            difficulty: 'Médio', // Default difficulty for loaded questions
            explanation: answer.explanation,
            topic: item.topics[0] || 'Uncategorized',
        };
        return question;
    }).filter((q): q is Question => q !== null);

    return questions;
  };

  const parseAndTransformQuizData = (jsonString: string, questionIdCounter: number): Question[] => {
      let data = JSON.parse(jsonString);
      // Handle double-stringified JSON
      if (typeof data === 'string') {
          data = JSON.parse(data);
      }
      return transformLoadedQuizData(data, questionIdCounter);
  };
  
  const selectAssessmentQuestions = (allQuestions: Question[], totalCount: number): Question[] => {
    // 1. Categorize questions by Part
    const categorizedQuestions: { [key: string]: Question[] } = {
        'part-i': [], 'part-ii': [], 'part-iii': [], 'part-iv': []
    };
    allQuestions.forEach(q => {
        const partId = topicToPartMap.get(q.topic);
        if (partId && categorizedQuestions[partId]) {
            categorizedQuestions[partId].push(q);
        }
    });

    // 2. Select questions based on distribution
    const distribution = {
        'part-i': 0.15, 'part-ii': 0.35, 'part-iii': 0.15, 'part-iv': 0.35
    };
    let selectedQuestions: Question[] = [];
    Object.entries(distribution).forEach(([partId, percentage]) => {
        const count = Math.round(totalCount * percentage);
        const pool = categorizedQuestions[partId] || [];
        if (pool.length < count) {
            console.warn(`Not enough questions for ${partId}. Have ${pool.length}, need ${count}. Using all available.`);
            selectedQuestions.push(...pool);
        } else {
            const shuffled = pool.sort(() => 0.5 - Math.random());
            selectedQuestions.push(...shuffled.slice(0, count));
        }
    });
    
    // 3. Ensure exact count by shuffling and slicing
    if (selectedQuestions.length > totalCount) {
        selectedQuestions = selectedQuestions.sort(() => 0.5 - Math.random()).slice(0, totalCount);
    } else if (selectedQuestions.length < totalCount && allQuestions.length >= totalCount) {
        const remainingNeeded = totalCount - selectedQuestions.length;
        const selectedIds = new Set(selectedQuestions.map(q => q.id));
        const remainingPool = allQuestions.filter(q => !selectedIds.has(q.id));
        selectedQuestions.push(...remainingPool.sort(() => 0.5 - Math.random()).slice(0, remainingNeeded));
    }

    return selectedQuestions.sort(() => 0.5 - Math.random()).slice(0, totalCount);
  };

  const handleStartQuiz = async () => {
    setLoading(true);
    setError(null);
    setNotification(null);
    setGenerationProgress(0);

    let inspirationQuestions: Question[] = [];
    if (alignWithExam && inspirationFiles.length > 0) {
        try {
            const fileContents = await Promise.all(inspirationFiles.map(file => file.text()));
            let questionIdCounter = 0;
            fileContents.forEach(content => {
                const questionsFromFile = parseAndTransformQuizData(content, questionIdCounter);
                inspirationQuestions.push(...questionsFromFile);
                questionIdCounter += questionsFromFile.length;
            });
        } catch (err: any) {
            setError(`Error reading inspiration files: ${err.message}`);
            setLoading(false);
            setGenerationProgress(null);
            return;
        }
    }

    // --- Assessment Mode Logic ---
    if (mode === 'assessment') {
        if (inspirationFiles.length === 0) {
            setError("Please upload at least one question bank file for the assessment.");
            setLoading(false);
            setGenerationProgress(null);
            return;
        }

        try {
            // Re-read files here for simplicity, or use `inspirationQuestions` if `alignWithExam` is true
            const fileContents = await Promise.all(inspirationFiles.map(file => file.text()));
            let allQuestionsFromFile: Question[] = [];
            let questionIdCounter = 0;
            fileContents.forEach(content => {
                const questionsFromFile = parseAndTransformQuizData(content, questionIdCounter);
                allQuestionsFromFile.push(...questionsFromFile);
                questionIdCounter += questionsFromFile.length;
            });

            const totalCount = effectiveSettings.numberOfQuestions;
            
            if (alignWithExam) {
                // Generate NEW questions using file content as examples
                setNotification("Using uploaded questions as inspiration to generate new ones with AI...");
                const generatedQuestions: Question[] = [];
                let questionId = 0;
                
                const topics = [...new Set(allQuestionsFromFile.map(q => q.topic))].filter(Boolean);
                if (topics.length === 0) throw new Error("No topics found in the uploaded files to guide the AI.");

                const mapDifficulty = (d: Difficulty): 'easy' | 'medium' | 'hard' => {
                    if (d === 'Fácil') return 'easy'; if (d === 'Difícil') return 'hard'; return 'medium';
                };
                const geminiDifficulties = effectiveSettings.difficulty.map(mapDifficulty);

                for (let i = 0; i < totalCount; i++) {
                    const topic = topics[i % topics.length];
                    const examples = allQuestionsFromFile.filter(q => q.topic === topic).sort(() => 0.5 - Math.random()).slice(0, 3);
                    
                    const result = await generateQuestions({
                        topic,
                        count: 1,
                        exampleQuestions: examples,
                        difficulty: geminiDifficulties[Math.floor(Math.random() * geminiDifficulties.length)],
                        alignWithExam: true
                    });
                    
                    if (result.ok && result.data) {
                        const genQ = result.data[0];
                        const correctOptionIndices = genQ.answer_keys.map(key => key.charCodeAt(0) - 65);
                        const cleanOptions = genQ.options.map(opt => opt.replace(/^[A-Z]\)\s*/, ''));
                        const correctAnswers = correctOptionIndices.map(index => cleanOptions[index]).filter(Boolean as any);

                        if (correctAnswers.length !== genQ.answer_keys.length) continue;

                        generatedQuestions.push({
                            id: questionId++,
                            question: genQ.question,
                            options: cleanOptions,
                            correctAnswer: genQ.isMultipleChoice ? correctAnswers : correctAnswers[0],
                            isMultipleChoice: genQ.isMultipleChoice,
                            difficulty: effectiveSettings.difficulty[Math.floor(Math.random() * effectiveSettings.difficulty.length)],
                            explanation: genQ.explanation,
                            topic: topic,
                        });
                         setGenerationProgress(Math.round(((i + 1) / totalCount) * 100));
                    } else {
                        throw new Error(result.reason || `AI failed to generate questions for topic: ${topic}`);
                    }
                }
                
                const finalSettings: QuizSettings = { ...effectiveSettings, mode: 'assessment', topics: ['AI-Generated Assessment'] };
                startQuiz(finalSettings, generatedQuestions);
                navigate('/quiz');
            } else {
                // Original assessment behavior: just use questions from file
                if (allQuestionsFromFile.length < totalCount) {
                  throw new Error(`Not enough questions. Uploaded files contain only ${allQuestionsFromFile.length} questions, but ${totalCount} are needed for a full assessment.`);
                }
                const selectedQuestions = selectAssessmentQuestions(allQuestionsFromFile, totalCount);
                const finalSettings: QuizSettings = { ...effectiveSettings, mode: 'assessment', topics: ['Assessment Mix'] };
                startQuiz(finalSettings, selectedQuestions.map((q, i) => ({ ...q, id: i })));
                navigate('/quiz');
            }
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred during assessment setup.');
        } finally {
            setLoading(false);
            setGenerationProgress(null);
        }
        return;
    }

    // --- Practice & Timed Mode Logic ---
    try {
      const finalTopics = effectiveSettings.topics.filter(t => (childrenMap.get(t) || []).length === 0);
      
       if (finalTopics.length === 0) {
            setError("Please select at least one specific sub-topic to generate questions.");
            setLoading(false);
            setGenerationProgress(null);
            return;
        }
      
      const fullSettings: QuizSettings = { 
        ...effectiveSettings, 
        mode,
        topics: finalTopics,
      };
      
      const allQuestions: Question[] = [];
      let questionId = 0;

      const mapDifficulty = (d: Difficulty): 'easy' | 'medium' | 'hard' => {
        if (d === 'Fácil') return 'easy';
        if (d === 'Difícil') return 'hard';
        return 'medium';
      };
      const geminiDifficulties = fullSettings.difficulty.map(mapDifficulty);
      const questionsPerTopic = Math.ceil(fullSettings.numberOfQuestions / finalTopics.length);
      
      for (const topic of finalTopics) {
        if (allQuestions.length >= fullSettings.numberOfQuestions) break;
        
        const count = Math.min(questionsPerTopic, fullSettings.numberOfQuestions - allQuestions.length);
        if (count <= 0) break;

        const examples = inspirationQuestions.length > 0
            ? inspirationQuestions.filter(q => q.topic === topic).sort(() => 0.5 - Math.random()).slice(0, 3)
            : [];

        const result = await generateQuestions({
            topic: topic,
            count: count,
            difficulty: geminiDifficulties[Math.floor(Math.random() * geminiDifficulties.length)],
            alignWithExam: alignWithExam,
            exampleQuestions: examples
        });

        if (result.ok && result.data) {
          result.data.forEach(genQ => {
            if (allQuestions.length < fullSettings.numberOfQuestions) {
                const correctOptionIndices = genQ.answer_keys.map(key => key.charCodeAt(0) - 65);
                const cleanOptions = genQ.options.map(opt => opt.replace(/^[A-Z]\)\s*/, ''));

                const correctAnswers = correctOptionIndices
                    .map(index => cleanOptions[index])
                    .filter((item): item is string => !!item);

                if (correctAnswers.length !== genQ.answer_keys.length) {
                    console.warn("Mismatched answer keys and options from AI, skipping question:", genQ);
                    return;
                }

                allQuestions.push({
                    id: questionId++,
                    question: genQ.question,
                    options: cleanOptions,
                    correctAnswer: genQ.isMultipleChoice ? correctAnswers : correctAnswers[0],
                    isMultipleChoice: genQ.isMultipleChoice,
                    difficulty: fullSettings.difficulty[Math.floor(Math.random() * fullSettings.difficulty.length)],
                    explanation: genQ.explanation,
                    topic: topic,
                });
                const newProgress = Math.round((allQuestions.length / fullSettings.numberOfQuestions) * 100);
                setGenerationProgress(Math.min(newProgress, 100));
            }
          });
        } else if (!result.ok) {
            throw new Error(result.reason || "The AI failed to generate questions for the selected topics.");
        }
      }

      const questions = allQuestions.slice(0, fullSettings.numberOfQuestions);
      
      if (questions.length === 0) {
        setError("The AI failed to generate any questions for the selected topics. This can happen if the source material is insufficient. Please try again with different topics.");
        setLoading(false);
        setGenerationProgress(null);
        return;
      }
      
      startQuiz(fullSettings, questions);
      navigate('/quiz');
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred while generating questions.');
    } finally {
      setLoading(false);
      setGenerationProgress(null);
    }
  };


  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    setError(null);
    setNotification(null);

    const fileReadPromises = Array.from(files).map(file => {
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result;
                if (typeof text === 'string') {
                    resolve(text);
                } else {
                    reject(new Error(`Could not read file content from ${file.name}.`));
                }
            };
            reader.onerror = () => {
                reject(new Error(`Error reading file ${file.name}.`));
            };
            reader.readAsText(file);
        });
    });

    Promise.all(fileReadPromises)
        .then(jsonStrings => {
            let allQuestions: Question[] = [];
            let questionIdCounter = 0;

            jsonStrings.forEach((jsonString, index) => {
                try {
                    const questions = parseAndTransformQuizData(jsonString, questionIdCounter);
                    allQuestions.push(...questions);
                    questionIdCounter += questions.length;
                } catch(e: any) {
                    throw new Error(`Error processing file #${index + 1}: ${e.message}`);
                }
            });
            
            const totalCount = settings.numberOfQuestions;

            if (allQuestions.length < totalCount) {
                throw new Error(`Not enough questions for a full assessment. Uploaded files contain ${allQuestions.length} questions, but ${totalCount} are needed.`);
            }

            const finalQuestions = selectAssessmentQuestions(allQuestions, totalCount);

            const combinedSettings: QuizSettings = {
                topics: ['Loaded Assessment Mix'],
                difficulty: ['Médio'],
                numberOfQuestions: finalQuestions.length,
                mode: 'assessment',
            };

            startQuiz(combinedSettings, finalQuestions.map((q, i) => ({ ...q, id: i })));
            navigate('/quiz');

        }).catch((err: any) => {
            setError(`Failed to load assessment from file(s): ${err.message}`);
        }).finally(() => {
            setLoading(false);
            if (event.target) {
                event.target.value = '';
            }
        });
  };
  
  const handleInspirationFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
        setInspirationFiles(Array.from(files));
    }
  };


  const ModeCard = ({ icon, title, description, value, children }: { icon: string, title: string, description: string, value: QuizMode, children?: React.ReactNode }) => (
    <div
      className={`p-6 rounded-xl border-2 transition-all duration-200 h-full flex flex-col ${mode === value ? 'bg-red-100 border-red-500 ring-2 ring-red-300' : 'bg-white hover:border-red-300'}`}
    >
      <div onClick={() => setMode(value)} className="cursor-pointer flex-grow">
        <i className={`fa-solid ${icon} text-3xl mb-3 ${mode === value ? 'text-red-600' : 'text-slate-500'}`}></i>
        <h3 className="font-bold text-lg text-gray-800">{title}</h3>
        <p className="text-sm text-gray-600 mt-1">{description}</p>
      </div>
      {children}
    </div>
  );
  
  const leafTopicCount = useMemo(() => {
    return effectiveSettings.topics.filter(t => (childrenMap.get(t) || []).length === 0).length;
  }, [effectiveSettings.topics, childrenMap]);

  const startButtonDisabled = isLoading || (isGeneratorMode && leafTopicCount === 0) || (isAssessmentMode && inspirationFiles.length === 0);

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        className="hidden"
        accept=".json"
        multiple
      />
      <input
          type="file"
          ref={inspirationFileInputRef}
          onChange={handleInspirationFileChange}
          className="hidden"
          accept=".json"
          multiple
      />
      <h1 className="text-3xl md:text-5xl font-bold text-gray-800 mb-2 text-center">AI Question Generator</h1>
      <p className="text-xl text-gray-500 mb-8 text-center">Customize your test to focus your studies.</p>
      
      {notification && (
        <div className="my-4 p-4 bg-blue-100 text-blue-800 border border-blue-300 rounded-lg" role="alert">
          <p><span className="font-bold"><i className="fa-solid fa-info-circle mr-2"></i></span> {notification}</p>
        </div>
      )}
      
      {error && (
        <div className="my-4 p-4 bg-red-100 text-red-800 border border-red-300 rounded-lg" role="alert">
          <p><span className="font-bold">Error:</span> {error}</p>
        </div>
      )}

      <Card className={`mb-8 ${!isGeneratorMode ? 'bg-slate-50' : ''}`}>
        <h2 className="text-2xl font-bold text-gray-700 mb-4 border-b pb-3">1. Choose Topics</h2>
        {!isGeneratorMode && <div className="text-sm text-red-700 bg-red-50 p-3 rounded-md mb-4"><i className="fa-solid fa-info-circle mr-2"></i>Topics are selected automatically for this mode.</div>}
        
        {/* Mobile Dropdown */}
        <div className="md:hidden">
          <label htmlFor="topic-select-mobile" className="block text-sm font-medium text-gray-700">Curriculum Part</label>
          <select
            id="topic-select-mobile"
            value={activeTopicId}
            onChange={(e) => setActiveTopicId(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-md"
            disabled={!isGeneratorMode}
          >
            {curriculumTopics.map(topic => (
              <option key={topic.id} value={topic.id}>{topic.title}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 md:grid md:grid-cols-3 md:gap-6">
          {/* Desktop Sidebar */}
          <div className="hidden md:block md:col-span-1 border-r border-slate-200 pr-4">
            <h3 className="text-md font-semibold text-gray-600 mb-2">Curriculum Parts</h3>
            <div className="space-y-1">
              {curriculumTopics.map(topic => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => setActiveTopicId(topic.id)}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm ${activeTopicId === topic.id ? 'bg-red-100 text-red-700 font-semibold' : 'text-slate-700 hover:bg-slate-100'} ${!isGeneratorMode ? 'opacity-60 cursor-not-allowed' : ''}`}
                  aria-current={activeTopicId === topic.id}
                  disabled={!isGeneratorMode}
                >
                  {topic.title}
                </button>
              ))}
            </div>
          </div>

          {/* Subtopics Area */}
          <div className="md:col-span-2 mt-4 md:mt-0">
            {activeTopic && (
              <div>
                <label className={`flex items-center p-2 rounded-md transition-all ${!isGeneratorMode ? 'cursor-not-allowed bg-slate-200' : 'hover:bg-slate-100 cursor-pointer'} bg-slate-50 font-semibold text-slate-800`}>
                  <input
                    type="checkbox"
                    checked={selectedTopics.has(activeTopic.title)}
                    onChange={e => handleTopicChange(activeTopic, e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    disabled={!isGeneratorMode}
                  />
                  <span className="ml-3">Select/Deselect All</span>
                </label>
                <div className="mt-2 border-t pt-2">
                  {activeTopic.subTopics && activeTopic.subTopics.length > 0 ? (
                    activeTopic.subTopics.map(subTopic => (
                      <TopicItem
                        key={subTopic.id}
                        topic={subTopic}
                        selectedTopics={selectedTopics}
                        onTopicChange={handleTopicChange}
                        disabled={!isGeneratorMode}
                      />
                    ))
                  ) : (
                    <p className="px-2 py-4 text-sm text-slate-500">This topic has no sub-topics.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
      
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <Card className={`${!isGeneratorMode ? 'bg-slate-50' : ''}`}>
          <h2 className="text-2xl font-bold text-gray-700 mb-4 border-b pb-3">2. Set Difficulty</h2>
          {!isGeneratorMode && <div className="text-sm text-red-700 bg-red-50 p-3 rounded-md mb-4"><i className="fa-solid fa-info-circle mr-2"></i>Simulator & Assessment modes use a mix of difficulties.</div>}
          <div className="flex flex-col space-y-3">
            {(['Fácil', 'Médio', 'Difícil'] as Difficulty[]).map(d => (
              <label key={d} className={`flex items-center p-3 rounded-lg border ${!isGeneratorMode ? 'cursor-not-allowed bg-slate-200' : 'cursor-pointer'} ${effectiveSettings.difficulty.includes(d) ? 'bg-red-50 border-red-400' : 'bg-white'}`}>
                <input
                  type="checkbox"
                  name="difficulty"
                  value={d}
                  checked={effectiveSettings.difficulty.includes(d)}
                  onChange={(e) => handleDifficultyChange(d, e.target.checked)}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                  disabled={!isGeneratorMode}
                />
                <span className="ml-3 text-slate-700 font-medium">{d}</span>
              </label>
            ))}
          </div>
        </Card>
        <Card>
            <h2 className="text-2xl font-bold text-gray-700 mb-4 border-b pb-3">3. Number of Questions</h2>
            {isSimuladoMode && <div className="text-sm text-red-700 bg-red-50 p-3 rounded-md -mt-2 mb-4"><i className="fa-solid fa-info-circle mr-2"></i>Fixed for the selected mode.</div>}
            <div className="flex flex-col items-center justify-center h-full">
                <span className="text-6xl font-bold text-red-600 mb-4">{effectiveSettings.numberOfQuestions}</span>
                <input
                type="range"
                min="1"
                max="50"
                value={effectiveSettings.numberOfQuestions}
                onChange={(e) => !isSimuladoMode && setSettings(prev => ({...prev, numberOfQuestions: parseInt(e.target.value, 10)}))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSimuladoMode}
                />
            </div>
        </Card>
      </div>

      <Card className="mb-8">
        <h2 className="text-2xl font-bold text-gray-700 mb-4 border-b pb-3">4. Choose Game Mode</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left mt-4">
          <ModeCard icon="fa-graduation-cap" title="Practice" description="No time limit, learn and review at your own pace." value="practice" />
          <ModeCard icon="fa-clipboard-question" title="Assessment" description="Upload your question banks for a timed evaluation based on official exam weights." value="assessment">
             <div className="mt-4 border-t pt-4">
                <p className="text-xs text-slate-600 text-center">
                    <i className="fa-solid fa-arrow-down mr-1"></i> Upload your files in the "Advanced Settings" section below.
                </p>
            </div>
          </ModeCard>
          <ModeCard icon="fa-file-alt" title="Full Simulator" description="A 20-question version for a quick test of the exam format." value="timed" />
          <ModeCard icon="fa-book-open" title="1/2 Simulator" description="Extended simulation with 50 questions for in-depth practice." value="timed_half" />
        </div>
      </Card>

      <Card className="mb-8">
        <h2 className="text-2xl font-bold text-gray-700 mb-4 border-b pb-3">5. Advanced Settings</h2>
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div>
                <label htmlFor="align-switch" className="font-semibold text-slate-800">Align with Official Exam Style</label>
                <p className="text-sm text-slate-500 mt-1">
                    AI will generate questions mimicking official formats. In Assessment mode, this will generate <span className="font-bold">new questions</span> based on your uploaded files.
                </p>
            </div>
            <label htmlFor="align-switch" className="relative inline-flex items-center cursor-pointer">
                <input 
                    type="checkbox" 
                    id="align-switch" 
                    className="sr-only peer"
                    checked={alignWithExam}
                    onChange={(e) => setAlignWithExam(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-red-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
            </label>
        </div>
         <div className="mt-4 border-t pt-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="mb-3 md:mb-0 md:mr-4">
                    <label className="font-semibold text-slate-800">Use Your Files as Inspiration</label>
                    <p className="text-sm text-slate-500 mt-1">
                        Upload JSON question banks. When "Align with Exam Style" is on, the AI will generate new questions inspired by your files. Works for Practice and Assessment modes.
                    </p>
                </div>
                <div>
                    <Button onClick={() => inspirationFileInputRef.current?.click()} className="bg-slate-700 hover:bg-slate-800 focus:ring-slate-500 text-sm whitespace-nowrap">
                        <i className="fa-solid fa-upload mr-2"></i> Upload Files
                    </Button>
                </div>
            </div>
            {inspirationFiles.length > 0 && (
            <div className="p-3">
                <ul className="text-xs text-slate-500 space-y-1">
                    {inspirationFiles.map(f => <li key={f.name} className="truncate">✓ {f.name}</li>)}
                </ul>
            </div>
            )}
        </div>
      </Card>
      
      <div className="mt-8 text-center">
        <Button onClick={handleStartQuiz} disabled={startButtonDisabled} className="text-xl px-12 py-4 w-full md:w-auto">
          {isLoading && !error ? (
             <div className="w-full" style={{ minWidth: '220px' }}>
                <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    <span>
                    {isAssessmentMode ? 'Building Assessment...' : 'Generating Quiz...'}
                    {generationProgress !== null && ` (${generationProgress}%)`}
                    </span>
                </div>
                {generationProgress !== null && (
                    <div className="w-full bg-white/30 rounded-full h-1.5 mt-2">
                    <div className="bg-white h-1.5 rounded-full transition-all duration-300" style={{ width: `${generationProgress}%` }}></div>
                    </div>
                )}
            </div>
          ) : (
            <>
              <i className="fa-solid fa-play mr-2"></i> Start AI Quiz
            </>
          )}
        </Button>
         <p className="text-xs text-slate-400 mt-4">
            {isGeneratorMode && `Topics selected: ${leafTopicCount}`}
            {isAssessmentMode && `Files uploaded: ${inspirationFiles.length}`}
         </p>
      </div>

      <div className="my-8 flex items-center justify-center text-slate-500">
          <hr className="w-full border-t border-slate-300" />
          <span className="px-4 font-semibold whitespace-nowrap">OR</span>
          <hr className="w-full border-t border-slate-300" />
      </div>

      <Card className="mb-8">
        <div className="text-center">
          <i className="fa-solid fa-file-import text-3xl mb-3 text-slate-500"></i>
          <h2 className="text-2xl font-bold text-gray-700 mb-2">Load Assessment from File</h2>
          <p className="text-slate-600 mb-6">Run a full assessment using pre-made JSON question banks.</p>
          <Button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="bg-slate-700 hover:bg-slate-800 focus:ring-slate-500">
             {isLoading && error ? (
                <>Loading...</>
            ) : (
                <><i className="fa-solid fa-upload mr-2"></i> Select JSON File(s)</>
            )}
          </Button>
        </div>
      </Card>
      
    </div>
  );
};

export default SetupPage;