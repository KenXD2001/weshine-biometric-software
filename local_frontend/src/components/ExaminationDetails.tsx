import React from 'react';
import { AlertCircle, Check } from 'lucide-react';

interface ExaminationDetailsProps {
  centreCode: string;
  setCentreCode: (value: string) => void;
  centreName: string;
  setCentreName: (value: string) => void;
}

const ExaminationDetails: React.FC<ExaminationDetailsProps> = ({
  centreCode,
  setCentreCode,
  centreName,
  setCentreName
}) => {
  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200/50 shadow-lg shadow-gray-200/25 hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-center gap-3 mb-3 bg-blue-950 rounded-t-xl">
        <div className="p-2">
          <AlertCircle className="h-5 w-5 text-white" />
        </div>
        <h2 className="text-lg font-bold">
          Examination Details
        </h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 pt-0 rounded-b-xl">
        <div className="group">
          <label className="block text-xs font-semibold text-gray-700 mb-1 group-focus-within:text-blue-600 transition-colors">
            Centre Code <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={centreCode}
              onChange={(e) => setCentreCode(e.target.value)}
              placeholder="BLR001"
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '6px 8px',
                width: '100%',
                fontSize: '14px',
                color: centreCode ? '#000' : '#999'
              }}
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-focus-within:opacity-100 transition-opacity">
              <Check className="h-3 w-3 text-green-500" />
            </div>
          </div>
        </div>
        <div className="group">
          <label className="block text-xs font-semibold text-gray-700 mb-1 group-focus-within:text-blue-600 transition-colors">
            Centre Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={centreName}
              onChange={(e) => setCentreName(e.target.value)}
              placeholder="Bangalore"
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '6px 8px',
                width: '100%',
                fontSize: '14px',
                color: centreName ? '#000' : '#999'
              }}
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-focus-within:opacity-100 transition-opacity">
              <Check className="h-3 w-3 text-green-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExaminationDetails;
