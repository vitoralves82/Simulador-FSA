
import React from 'react';
import { NavLink } from 'react-router-dom';
import { curriculumTopics as sessions } from '../data/courseData';

const Sidebar: React.FC = () => {
  const baseLinkClasses = "flex items-center px-4 py-3 text-gray-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors duration-200";
  const activeLinkClasses = "bg-slate-700/80 text-white font-semibold";

  return (
    <div className="flex flex-col w-72 bg-slate-800 text-white shadow-xl">
      <div className="flex items-center justify-center h-16 bg-slate-900 shadow-lg">
        <span className="text-white font-bold text-xl tracking-wide">Menu do Curso</span>
      </div>
      <div className="flex flex-col flex-1 overflow-y-auto">
        <nav className="flex-1 px-4 py-4 space-y-2">
          <NavLink to="/" className={({ isActive }) => `${baseLinkClasses} ${isActive ? activeLinkClasses : ''}`}>
            <i className="fa-solid fa-house w-6 text-center text-lg"></i>
            <span className="mx-4">Início</span>
          </NavLink>
          <p className="px-4 pt-4 pb-2 text-xs uppercase text-slate-400 font-bold tracking-wider">Sessões</p>
          {sessions.map((session) => (
            <NavLink
              key={session.id}
              to={`/session/${session.id}`}
              className={({ isActive }) => `${baseLinkClasses} ${isActive ? activeLinkClasses : ''}`}
            >
              <i className="fa-solid fa-book-open w-6 text-center text-lg"></i>
              <span className="mx-4">{session.title}</span>
            </NavLink>
          ))}
          
          <div className="pt-4">
             <hr className="border-slate-700" />
          </div>

          <p className="px-4 pt-4 pb-2 text-xs uppercase text-slate-400 font-bold tracking-wider">Ferramentas</p>
           <NavLink to="/question-generator" className={({ isActive }) => `${baseLinkClasses} ${isActive ? activeLinkClasses : ''}`}>
            <i className="fa-solid fa-lightbulb w-6 text-center text-lg text-yellow-300"></i>
            <span className="mx-4">Gerador de Questões (IA)</span>
          </NavLink>
          <NavLink to="/exam" className={({ isActive }) => `${baseLinkClasses} ${isActive ? activeLinkClasses : ''}`}>
            <i className="fa-solid fa-flag-checkered w-6 text-center text-lg"></i>
            <span className="mx-4">Exame Final Simulado</span>
          </NavLink>
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;