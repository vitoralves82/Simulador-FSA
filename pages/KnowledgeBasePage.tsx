import React, { useState, useCallback, useRef } from 'react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';

const KnowledgeBasePage: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const handleFileChange = (selectedFiles: FileList | null) => {
    if (selectedFiles) {
      const newFiles = Array.from(selectedFiles);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const onDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);
  
  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileChange(e.dataTransfer.files);
  }, []);

  const onFileSelect = () => {
      fileInputRef.current?.click();
  };
  
  const removeFile = (fileName: string) => {
      setFiles(prev => prev.filter(f => f.name !== fileName));
  };
  
  const handleProcessDocuments = () => {
    alert("Funcionalidade em desenvolvimento. O próximo passo seria enviar esses arquivos para um serviço de backend para processamento e armazenamento em um banco de dados vetorial.");
  };

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <h1 className="text-3xl md:text-5xl font-bold text-gray-800 mb-2 text-center">Base de Conhecimento</h1>
      <p className="text-xl text-gray-500 mb-8 text-center">Envie seus materiais de estudo para criar um gerador de questões personalizado.</p>

      <Card>
        <h2 className="text-2xl font-bold text-gray-700 mb-4 border-b pb-3">Carregar Documentos</h2>
        <p className="text-slate-600 mb-6">Carregue seus materiais de estudo (PDF, TXT) para criar uma base de conhecimento privada. A IA usará esses documentos para gerar questões altamente relevantes e precisas para seus testes.</p>
        
        <input 
            type="file"
            ref={fileInputRef}
            multiple
            onChange={e => handleFileChange(e.target.files)}
            className="hidden"
            accept=".pdf,.txt,.md"
        />

        <div 
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onClick={onFileSelect}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all duration-300
            ${isDragging ? 'border-red-500 bg-red-50' : 'border-slate-300 hover:border-red-400 hover:bg-slate-50'}
          `}
        >
            <i className="fa-solid fa-cloud-arrow-up text-5xl text-slate-400 mb-4"></i>
            <p className="text-slate-600 font-semibold">Arraste e solte os arquivos aqui</p>
            <p className="text-sm text-slate-500 mt-1">ou clique para selecionar os arquivos</p>
            <p className="text-xs text-slate-400 mt-4">Tipos de arquivo suportados: PDF, TXT, MD</p>
        </div>

        {files.length > 0 && (
          <div className="mt-8">
            <h3 className="font-semibold text-lg text-slate-800 mb-4">Arquivos Carregados</h3>
            <ul className="space-y-3">
              {files.map((file, index) => (
                <li key={index} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="flex items-center min-w-0">
                    <i className="fa-solid fa-file-lines text-slate-500 text-xl mr-4"></i>
                    <div className="truncate">
                        <p className="font-semibold text-slate-700 truncate">{file.name}</p>
                        <p className="text-sm text-slate-500">{formatBytes(file.size)}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeFile(file.name)}
                    className="ml-4 flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 text-slate-600 hover:bg-red-100 hover:text-red-600 transition-colors"
                    aria-label={`Remove ${file.name}`}
                  >
                    <i className="fa-solid fa-times"></i>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

       <div className="mt-8 text-center">
        <Button onClick={handleProcessDocuments} disabled={files.length === 0} className="text-lg px-10 py-3 w-full md:w-auto">
            <i className="fa-solid fa-cogs mr-2"></i> Processar Documentos
        </Button>
         <p className="text-xs text-slate-400 mt-4">
            Esta ação iniciará o processo de indexação para a IA.
         </p>
      </div>

    </div>
  );
};

export default KnowledgeBasePage;