import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { curriculumTopics } from '../data/courseData';
import { useQuiz } from '../context/CourseContext';
import { generateQuestions } from '../services/geminiService';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import { QuizMode, QuizSettings, CourseTopic, Difficulty } from '../types';


interface TopicItemProps {
    topic: CourseTopic;
    selectedTopics: Set<string>;
    onTopicChange: (topic: CourseTopic, checked: boolean) => void;
    disabled: boolean;
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

  const [settings, setSettings] = useState<Pick<QuizSettings, 'topics' | 'difficulty' | 'numberOfQuestions'>>({
    topics: [curriculumTopics[0].subTopics![0].title],
    difficulty: ['Médio'],
    numberOfQuestions: 10,
  });
  const [mode, setMode] = useState<QuizMode>('practice');
  const [lightningBaseTime, setLightningBaseTime] = useState(60);
  const [lightningBonusTime, setLightningBonusTime] = useState(4);
  const [notification, setNotification] = useState<string | null>(null);
  
  const [activeTopicId, setActiveTopicId] = useState<string>(curriculumTopics[0].id);

  const isSimuladoMode = mode === 'timed' || mode === 'timed_half';
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
    return settings;
  }, [settings, isSimuladoMode, mode, allTopicTitles]);


  const activeTopic = useMemo(() => 
    curriculumTopics.find(t => t.id === activeTopicId) || curriculumTopics[0],
    [activeTopicId]
  );
  
  const [parentMap, childrenMap] = useMemo(() => {
        const pMap = new Map<string, string | null>();
        const cMap = new Map<string, string[]>();
        
        const traverse = (topic: CourseTopic, parent: CourseTopic | null) => {
            pMap.set(topic.title, parent ? parent.title : null);
            const childTitles = topic.subTopics ? topic.subTopics.map(t => t.title) : [];
            cMap.set(topic.title, childTitles);
            if (topic.subTopics) {
                topic.subTopics.forEach(sub => traverse(sub, topic));
            }
        };
        curriculumTopics.forEach(t => traverse(t, null));
        return [pMap, cMap];
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
        if (isSimuladoMode) return; // Safeguard
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
    }, [parentMap, childrenMap, isSimuladoMode]);
    
  const handleDifficultyChange = (d: Difficulty, checked: boolean) => {
    if (isSimuladoMode) return;
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

  const handleStartQuiz = async () => {
    setLoading(true);
    setError(null);
    setNotification(null);
    try {
      // Use effectiveSettings for quiz generation, but filter to only send leaf topics to the AI
      const finalTopics = effectiveSettings.topics.filter(t => (childrenMap.get(t) || []).length === 0);
      
       if (finalTopics.length === 0) {
            setError("Please select at least one specific sub-topic to generate questions.");
            setLoading(false);
            return;
        }
      
      const fullSettings: QuizSettings = { 
        ...effectiveSettings, 
        mode,
        topics: finalTopics,
      };
      
      if (mode === 'lightning') {
        fullSettings.lightningBaseTime = lightningBaseTime;
        fullSettings.lightningBonusTime = lightningBonusTime;
      }

      const questions = await generateQuestions(fullSettings);
      startQuiz(fullSettings, questions);
      navigate('/quiz');
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred while generating questions.');
    } finally {
      setLoading(false);
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

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
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

      <Card className={`mb-8 ${isSimuladoMode ? 'bg-slate-50' : ''}`}>
        <h2 className="text-2xl font-bold text-gray-700 mb-4 border-b pb-3">1. Choose Topics</h2>
        {isSimuladoMode && <div className="text-sm text-red-700 bg-red-50 p-3 rounded-md mb-4"><i className="fa-solid fa-info-circle mr-2"></i>Simulator mode automatically selects all topics.</div>}
        
        {/* Mobile Dropdown */}
        <div className="md:hidden">
          <label htmlFor="topic-select-mobile" className="block text-sm font-medium text-gray-700">Curriculum Part</label>
          <select
            id="topic-select-mobile"
            value={activeTopicId}
            onChange={(e) => setActiveTopicId(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-md"
            disabled={isSimuladoMode}
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
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm ${activeTopicId === topic.id ? 'bg-red-100 text-red-700 font-semibold' : 'text-slate-700 hover:bg-slate-100'} ${isSimuladoMode ? 'opacity-60 cursor-not-allowed' : ''}`}
                  aria-current={activeTopicId === topic.id}
                  disabled={isSimuladoMode}
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
                <label className={`flex items-center p-2 rounded-md transition-all ${isSimuladoMode ? 'cursor-not-allowed bg-slate-200' : 'hover:bg-slate-100 cursor-pointer'} bg-slate-50 font-semibold text-slate-800`}>
                  <input
                    type="checkbox"
                    checked={selectedTopics.has(activeTopic.title)}
                    onChange={e => handleTopicChange(activeTopic, e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    disabled={isSimuladoMode}
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
                        disabled={isSimuladoMode}
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
        <Card className={`${isSimuladoMode ? 'bg-slate-50' : ''}`}>
          <h2 className="text-2xl font-bold text-gray-700 mb-4 border-b pb-3">2. Set Difficulty</h2>
          {isSimuladoMode && <div className="text-sm text-red-700 bg-red-50 p-3 rounded-md mb-4"><i className="fa-solid fa-info-circle mr-2"></i>Simulator mode uses a mix of difficulties to simulate the real exam.</div>}
          <div className="flex flex-col space-y-3">
            {(['Fácil', 'Médio', 'Difícil'] as Difficulty[]).map(d => (
              <label key={d} className={`flex items-center p-3 rounded-lg border ${isSimuladoMode ? 'cursor-not-allowed bg-slate-200' : 'cursor-pointer'} ${effectiveSettings.difficulty.includes(d) ? 'bg-red-50 border-red-400' : 'bg-white'}`}>
                <input
                  type="checkbox"
                  name="difficulty"
                  value={d}
                  checked={effectiveSettings.difficulty.includes(d)}
                  onChange={(e) => handleDifficultyChange(d, e.target.checked)}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                  disabled={isSimuladoMode}
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
          <ModeCard icon="fa-bolt-lightning" title="Lightning Quiz" description="Total time with a bonus per answer. Agility is key!" value="lightning">
            {mode === 'lightning' && (
              <div className="mt-4 border-t pt-4 space-y-3 animate-fade-in text-left">
                <div>
                  <label htmlFor="baseTime" className="block text-sm font-medium text-gray-700">Base Time (seconds)</label>
                  <input 
                    type="number"
                    id="baseTime"
                    value={lightningBaseTime}
                    onChange={(e) => setLightningBaseTime(Math.max(10, parseInt(e.target.value, 10) || 10))}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                <div>
                  <label htmlFor="bonusTime" className="block text-sm font-medium text-gray-700">Bonus per Answer (seconds)</label>
                  <input 
                    type="number"
                    id="bonusTime"
                    value={lightningBonusTime}
                    onChange={(e) => setLightningBonusTime(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              </div>
            )}
          </ModeCard>
          <ModeCard icon="fa-file-alt" title="Full Simulator" description="A 20-question version for a quick test of the exam format." value="timed" />
          <ModeCard icon="fa-book-open" title="1/2 Simulator" description="Extended simulation with 50 questions for in-depth practice." value="timed_half" />
        </div>
      </Card>

      <div className="mt-8 text-center">
        <Button onClick={handleStartQuiz} disabled={isLoading || leafTopicCount === 0} className="text-xl px-12 py-4 w-full md:w-auto">
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
              Generating Quiz...
            </div>
          ) : (
            <>
              <i className="fa-solid fa-play mr-2"></i> Start Quiz
            </>
          )}
        </Button>
         <p className="text-xs text-slate-400 mt-4">Topics selected: {leafTopicCount}</p>
      </div>
    </div>
  );
};

export default SetupPage;