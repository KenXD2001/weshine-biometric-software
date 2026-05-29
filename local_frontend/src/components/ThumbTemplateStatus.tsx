import React from 'react';
import { CheckCircle, XCircle, Gauge } from 'lucide-react';

interface ThumbTemplateStatusProps {
  isCandidateLoaded: boolean;
  templateAvailable: boolean;
  matchRatio?: number | null;
}

const ThumbTemplateStatus: React.FC<ThumbTemplateStatusProps> = ({
  isCandidateLoaded,
  templateAvailable,
  matchRatio,
}) => {
  if (!isCandidateLoaded) {
    return null;
  }

  const ratioLabel = matchRatio !== undefined && matchRatio !== null
    ? `${matchRatio}%`
    : 'Not available';

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200/50 shadow-lg shadow-gray-200/25 hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-center gap-3 bg-slate-900 rounded-t-xl mb-3 p-3">
        <div className="p-2 bg-slate-800 rounded-full">
          {templateAvailable ? (
            <CheckCircle className="h-5 w-5 text-emerald-400" />
          ) : (
            <XCircle className="h-5 w-5 text-rose-400" />
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Thumb Template Status</h3>
          <p className="text-xs text-slate-300">
            {templateAvailable ? 'Template found in candidate data' : 'No template found for this candidate'}
          </p>
        </div>
      </div>

      <div className="p-3 text-sm text-slate-700">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50 p-3">
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wide text-slate-500">Template availability</div>
              <div className={`mt-1 font-semibold ${templateAvailable ? 'text-emerald-700' : 'text-rose-700'}`}>
                {templateAvailable ? 'Available' : 'Not available'}
              </div>
            </div>
            {templateAvailable ? (
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            ) : (
              <XCircle className="h-5 w-5 text-rose-500" />
            )}
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50 p-3">
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wide text-slate-500">Match ratio</div>
              <div className="mt-1 font-semibold text-slate-900">
                {ratioLabel}
              </div>
            </div>
            <Gauge className="h-5 w-5 text-slate-500" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThumbTemplateStatus;
