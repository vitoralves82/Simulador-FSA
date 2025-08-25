
import React from 'react';

const Spinner: React.FC = () => {
  return (
    <div className="flex justify-center items-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-red-600"></div>
    </div>
  );
};

export default Spinner;
