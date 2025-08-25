import React from 'react';
import Header from './Header';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 sm:px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;