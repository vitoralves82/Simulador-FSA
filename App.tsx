import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { QuizProvider } from './context/CourseContext';
import Layout from './components/Layout';
import SetupPage from './pages/HomePage'; // Renamed component, file name is the same
import QuizEnginePage from './pages/QuizPage'; // Renamed component
import ResultsPage from './pages/FinalExamPage'; // Renamed component
import SessionPage from './pages/SessionPage';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import QuestionGeneratorPage from './pages/QuestionGeneratorPage';

const App: React.FC = () => {
  return (
    <QuizProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<SetupPage />} />
          <Route path="/session/:sessionId" element={<SessionPage />} />
          <Route path="/question-generator" element={<SetupPage />} />
          <Route path="/exam" element={<SetupPage />} />
          <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
          <Route path="/gerador-rapido" element={<QuestionGeneratorPage />} />
          <Route path="/quiz" element={<QuizEnginePage />} />
          <Route path="/results" element={<ResultsPage />} />
        </Routes>
      </Layout>
    </QuizProvider>
  );
};

export default App;