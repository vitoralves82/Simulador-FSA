
import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { curriculumTopics as sessions } from '../data/courseData';
import Card from '../components/common/Card';
import Button from '../components/common/Button';

const SessionPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();

  const currentSessionId = parseInt(sessionId || '1', 10);
  const session = sessions.find(s => parseInt(s.id, 10) === currentSessionId);

  if (!session) {
    return <Navigate to="/" />;
  }

  const prevSessionId = currentSessionId - 1;
  const nextSessionId = currentSessionId + 1;
  const hasPrevSession = sessions.some(s => parseInt(s.id, 10) === prevSessionId);
  const hasNextSession = sessions.some(s => parseInt(s.id, 10) === nextSessionId);

  return (
    <div className="animate-fade-in">
      <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">{session.title}</h1>
      {session.longTitle && <h2 className="text-xl text-gray-500 mb-8">{session.longTitle}</h2>}
      
      <Card className="prose prose-lg max-w-none prose-h2:text-3xl prose-h2:font-bold prose-h2:text-slate-800 prose-h2:border-b-2 prose-h2:border-red-500 prose-h2:pb-3 prose-h2:mb-6 prose-h3:text-2xl prose-h3:font-semibold prose-h3:text-slate-700 prose-p:leading-relaxed prose-p:text-slate-700 prose-li:text-slate-700 prose-li:my-2 prose-li:marker:text-red-600 prose-strong:text-slate-800 prose-a:text-red-600 prose-a:font-semibold hover:prose-a:text-red-800 prose-blockquote:border-l-4 prose-blockquote:border-red-500 prose-blockquote:bg-red-50/80 prose-blockquote:p-4 prose-blockquote:rounded-r-lg prose-blockquote:text-slate-700 prose-blockquote:not-italic prose-blockquote:font-medium">
        {session.content || <p>Detailed content for this session is not yet available. Please check back later.</p>}
      </Card>

      <div className="mt-8 flex justify-between items-center">
        <div>
          {hasPrevSession ? (
             <Link to={`/session/${prevSessionId}`}>
              <Button>
                <i className="fa-solid fa-arrow-left mr-2"></i> Sessão Anterior
              </Button>
            </Link>
          ) : (
            <div /> // Placeholder for alignment
          )}
        </div>
        <div className="flex items-center space-x-4">
          <Link to={`/session/${session.id}/quiz`}>
            <Button className="bg-blue-600 hover:bg-blue-700 focus:ring-blue-500">
              <i className="fa-solid fa-file-signature mr-2"></i> Fazer o Quiz
            </Button>
          </Link>
          {hasNextSession ? (
            <Link to={`/session/${nextSessionId}`}>
              <Button>
                Próxima Sessão <i className="fa-solid fa-arrow-right ml-2"></i>
              </Button>
            </Link>
          ) : (
             <Link to="/exam">
              <Button className="bg-green-600 hover:bg-green-700 focus:ring-green-500">
                Ir para o Exame Final <i className="fa-solid fa-flag-checkered ml-2"></i>
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionPage;