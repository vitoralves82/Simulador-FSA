import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="flex items-center justify-between px-6 h-16 bg-white border-b border-slate-200/90 shadow-sm sticky top-0 z-50">
      <div className="flex items-center">
         <div className="text-xl font-bold text-gray-800">
            <i className="fa-solid fa-brain text-red-600 mr-3"></i>
            FSA Level 1 - AI Study Hub
         </div>
      </div>
    </header>
  );
};

export default Header;