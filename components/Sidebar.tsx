import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { curriculumTopics as sessions } from '../data/courseData';
import { useQuiz } from '../context/CourseContext';

interface SidebarProps {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
}

// FIX: Destructure isOpen from props to make it available in the component's scope.
const LastQuizStats: React.FC<{ isOpen: boolean }> = ({ isOpen }) => {
  const { results, settings } = useQuiz();

  if (results.length === 0 || !settings) {
    return null;
  }

  const correctCount = results.filter(r => r.isCorrect).length;
  const totalCount = results.length;
  const percentage = Math.round((correctCount / totalCount) * 100);

  let modeTitle = 'Practice';
  if (settings.mode === 'timed') modeTitle = 'Full Simulator';
  if (settings.mode === 'timed_half') modeTitle = '1/2 Simulator';
  if (settings.mode === 'lightning') modeTitle = 'Lightning';

  return (
    <div className={`px-4 pt-4 pb-2 text-slate-300 ${!isOpen ? 'hidden' : ''}`}>
        <h3 className="px-2 text-xs uppercase text-slate-400 font-bold tracking-wider mb-3">Último Simulado</h3>
        <div className="text-center bg-slate-700/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-white">{percentage}<span className="text-lg opacity-70">%</span></div>
            <div className="text-sm text-slate-400 font-medium">{correctCount} de {totalCount} Corretas</div>
            <div className="mt-2 text-xs bg-slate-600/70 text-slate-300 rounded-full px-3 py-1 inline-block">{modeTitle}</div>
        </div>
    </div>
  );
}


const Sidebar: React.FC<SidebarProps> = ({ isOpen, setOpen }) => {
  const location = useLocation();
  const { results } = useQuiz();

  const baseLinkClasses = "flex items-center px-4 py-3 text-gray-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors duration-200";
  const activeLinkClasses = "bg-slate-700/80 text-white font-semibold";
  
  const isSetupPage = location.pathname === '/' || location.pathname === '/question-generator' || location.pathname === '/exam';

  return (
    <div className={`flex flex-col bg-slate-800 text-white shadow-xl transition-all duration-300 ease-in-out ${isOpen ? 'w-72' : 'w-20'}`}>
      <div className="flex items-center justify-center h-16 bg-slate-900 shadow-lg flex-shrink-0">
        {isOpen && <span className="text-white font-bold text-xl tracking-wide">AI Study Hub</span>}
        {!isOpen && <i className="fa-solid fa-brain text-red-500 text-2xl"></i>}
      </div>
      <div className="flex flex-col flex-1 overflow-y-auto">
        <nav className="flex-1 px-4 py-4 space-y-2">
           <NavLink to="/" className={`${baseLinkClasses} ${isSetupPage ? activeLinkClasses : ''} ${!isOpen ? 'justify-center' : ''} bg-red-600/20 text-red-100 hover:bg-red-700/50`} title={!isOpen ? 'Criar Simulado' : undefined}>
            <i className="fa-solid fa-wand-magic-sparkles w-6 text-center text-lg"></i>
            {isOpen && <span className="mx-4 font-bold">Criar Simulado</span>}
          </NavLink>

          {results.length > 0 && <LastQuizStats isOpen={isOpen} />}
          
          <div className="pt-2">
             <hr className="border-slate-700" />
          </div>

          {isOpen && <p className="px-4 pt-4 pb-2 text-xs uppercase text-slate-400 font-bold tracking-wider">Conteúdo do Curso</p>}
          {sessions.map((session) => (
            <NavLink
              key={session.id}
              to={`/session/${session.id}`}
              className={({ isActive }) => `${baseLinkClasses} ${isActive ? activeLinkClasses : ''} ${!isOpen ? 'justify-center' : ''}`}
              title={!isOpen ? session.title : undefined}
            >
              <i className="fa-solid fa-book-open w-6 text-center text-lg"></i>
              {isOpen && <span className="mx-4">{session.title}</span>}
            </NavLink>
          ))}
          
          <div className="pt-2">
             <hr className="border-slate-700" />
          </div>

          {isOpen && <p className="px-4 pt-4 pb-2 text-xs uppercase text-slate-400 font-bold tracking-wider">Ferramentas</p>}
           <NavLink to="/knowledge-base" className={({ isActive }) => `${baseLinkClasses} ${isActive ? activeLinkClasses : ''} ${!isOpen ? 'justify-center' : ''}`} title={!isOpen ? 'Base de Conhecimento' : undefined}>
            <i className="fa-solid fa-database w-6 text-center text-lg text-cyan-300"></i>
            {isOpen && <span className="mx-4">Base de Conhecimento</span>}
          </NavLink>
          <NavLink to="/gerador-rapido" className={({ isActive }) => `${baseLinkClasses} ${isActive ? activeLinkClasses : ''} ${!isOpen ? 'justify-center' : ''}`} title={!isOpen ? 'Gerador Rápido' : undefined}>
            <i className="fa-solid fa-vial w-6 text-center text-lg text-lime-300"></i>
            {isOpen && <span className="mx-4">Gerador Rápido</span>}
          </NavLink>
        </nav>
      </div>
       <div className="p-2 border-t border-slate-700">
        <button 
          onClick={() => setOpen(!isOpen)} 
          className="w-full flex items-center justify-center p-3 text-gray-400 hover:bg-slate-700 hover:text-white rounded-lg transition-colors"
          aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <i className={`fa-solid ${isOpen ? 'fa-angles-left' : 'fa-angles-right'} text-lg`}></i>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;