import React from 'react';
import { Link } from 'react-router-dom';

const Header: React.FC = () => {
  return (
    <header className="flex items-center justify-between px-6 h-16 bg-white border-b border-slate-200/90 shadow-sm sticky top-0 z-50">
      <div className="flex items-center">
         <Link to="/" className="text-xl font-bold text-gray-800 hover:text-red-700 transition-colors">
            <i className="fa-solid fa-brain text-red-600 mr-3"></i>
            FSA Level 1 - Question Generator
         </Link>
      </div>
    </header>
  );
};

export default Header;