import React, { useState, useEffect } from 'react';
import { AlertCircle, List } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from './ui/Button';
import { authService, candidateService } from '../services/api';

interface SessionDetailsProps {
  totalCandidates?: number;
  totalBiometricDone?: number;
}

const SessionDetails: React.FC<SessionDetailsProps> = () => {
  const navigate = useNavigate();
  const [totalCandidates, setTotalCandidates] = useState<number>(0);
  const [totalBiometricDone, setTotalBiometricDone] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  // Fetch real data from backend
  useEffect(() => {
    let mounted = true;

    const fetchSessionData = async () => {
      try {
        setLoading(true);
        const userData = authService.getUser();

        // Prefer latest uploaded centre info over login-time centre code.
        let centreCode = userData?.centreCode || '';
        try {
          const centreInfoResult = await candidateService.getCentreInfo();
          if (centreInfoResult.successful && centreInfoResult.data?.centreCode) {
            centreCode = String(centreInfoResult.data.centreCode);
          }
        } catch (centreInfoError) {
          console.warn('Failed to load centre info for counts; using login centre code fallback.', centreInfoError);
        }

        const data = await candidateService.getCandidateCounts(centreCode);

        if (mounted && data.successful) {
          setTotalCandidates(data.candidateCounts?.total || 0);
          setTotalBiometricDone(data.candidateCounts?.completed || 0);
        } else if (mounted && !data.successful) {
          console.error('Failed to fetch session data:', data.message);
        }
      } catch (error) {
        console.error('Error fetching session data:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchSessionData();

    const handleDataUpdated = () => {
      fetchSessionData();
    };

    window.addEventListener('candidateDataUpdated', handleDataUpdated);

    return () => {
      mounted = false;
      window.removeEventListener('candidateDataUpdated', handleDataUpdated);
    };
  }, []);

  const onViewList = () => {
    navigate('/biometric-candidates');
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200/50 shadow-lg shadow-gray-200/25 hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-center justify-between bg-blue-950 rounded-t-xl mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2">
            <AlertCircle className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-lg font-bold text-white">
            Session Details At Centre
          </h2>
        </div>
        <div className="px-1">
          <Button variant="primary" size="sm" onClick={onViewList}>
            <List className="h-3 w-3" />
            View List
          </Button>
        </div>
      </div>
      
      {/* Enhanced KPIs with Dark Theme */}
      <div className="grid grid-cols-2 gap-3 p-3 pt-0 rounded-b-xl">
        <div className="group relative overflow-hidden bg-gradient-to-br from-blue-800 to-blue-900 border-2 border-blue-700/50 rounded-2xl p-4 text-center transition-all duration-300 hover:shadow-xl hover:from-blue-700 hover:to-blue-800">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-600/20 rounded-full -translate-y-8 translate-x-8"></div>
          <div className="relative">
            <div className="text-2xl font-bold text-blue-200 mb-1">
              {loading ? 'Loading...' : totalCandidates}
            </div>
            <div className="text-xs font-semibold text-blue-300">Total Candidates</div>
          </div>
        </div>
        <div className="group relative overflow-hidden bg-gradient-to-br from-green-800 to-green-900 border-2 border-green-700/50 rounded-2xl p-4 text-center transition-all duration-300 hover:shadow-xl hover:from-green-700 hover:to-green-800">
          <div className="absolute top-0 right-0 w-16 h-16 bg-green-600/20 rounded-full -translate-y-8 translate-x-8"></div>
          <div className="relative">
            <div className="text-2xl font-bold text-green-200 mb-1">
              {loading ? 'Loading...' : totalBiometricDone}
            </div>
            <div className="text-xs font-semibold text-green-300">Total Biometric Done</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionDetails;