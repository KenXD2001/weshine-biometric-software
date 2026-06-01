import React, { useState, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, Download, ChevronDown, X, User, Fingerprint, Camera, Send, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { syncService } from '../services/api';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/Toast/ToastContainer';

interface Candidate {
  id: string;
  applicationNumber?: string;
  userExamApplicationId?: string;
  hallTicket?: string;
  candidateName: string;
  emailId: string;
  gender: string;
  faceStatus: string;
  thumbStatus: string;
  biometricStatus: string;
  uploadedImagePath?: string;
  liveImagePath?: string;
  biometricImagePath?: string;
  city?: string;
  examSlot?: string;
  slot?: string;
  centreCode: string;
  centreName: string;
  thumbCaptureTimestamp?: string;
  submitTimestamp?: string;
  imageCapturedAt?: string;
  thumbCapturedAt?: string;
  submittedAt?: string;
}

interface CentreInfo {
  code?: string;
  name?: string;
  city?: string;
  examSlot?: string;
}

const BiometricCandidateList: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'failed'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0); // in ms
  const [lastRefreshAt, setLastRefreshAt] = useState<string>(new Date().toLocaleTimeString());
  const [refreshDropdownOpen, setRefreshDropdownOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [centreInfo, setCentreInfo] = useState<CentreInfo>({});
  const { toasts, removeToast, success: toastSuccess, error: toastError } = useToast();
  const exportButtonRef = React.useRef<HTMLDivElement>(null);
  const refreshButtonRef = React.useRef<HTMLDivElement>(null);

  // Fetch candidates from backend
  const fetchCandidates = useCallback(async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/candidate-details/all/filters`);
      const data = await response.json();
      
      if (data.successful) {
        // Transform backend data to match our interface
        const transformedCandidates = data.data.map((candidate: Candidate) => ({
          id: candidate.id,
          applicationNumber: candidate.applicationNumber || candidate.userExamApplicationId || '',
          hallTicket: candidate.hallTicket,
          candidateName: candidate.candidateName,
          emailId: candidate.emailId,
          gender: candidate.gender,
          faceStatus: candidate.faceStatus,
          thumbStatus: candidate.thumbStatus,
          biometricStatus: candidate.biometricStatus,
          uploadedImagePath: candidate.uploadedImagePath,
          liveImagePath: candidate.liveImagePath,
          biometricImagePath: candidate.biometricImagePath,
          city: candidate.city,
          examSlot: candidate.examSlot || candidate.slot || '',
          slot: candidate.slot || candidate.examSlot || '',
          centreCode: candidate.centreCode,
          centreName: candidate.centreName,
          thumbCaptureTimestamp: candidate.thumbCaptureTimestamp,
          submitTimestamp: candidate.submitTimestamp
        }));
        
        setCandidates(transformedCandidates);
        setLastRefreshAt(new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error('Error fetching candidates:', error);
    }
  }, []);

  const fetchCentreInfo = useCallback(async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/candidate-details/centre-info`);
      const data = await response.json();
      if (data.successful) {
        setCentreInfo(data.data || {});
      }
    } catch (error) {
      console.error('Error fetching centre info:', error);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchCandidates();
    fetchCentreInfo();
  }, [fetchCandidates, fetchCentreInfo]);

  // Refresh candidate list when biometric data is updated elsewhere
  useEffect(() => {
    const handleCandidateDataUpdated = () => {
      fetchCandidates();
    };

    window.addEventListener('candidateDataUpdated', handleCandidateDataUpdated);
    return () => window.removeEventListener('candidateDataUpdated', handleCandidateDataUpdated);
  }, [fetchCandidates]);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    const timer = window.setInterval(() => {
      fetchCandidates();
    }, autoRefreshInterval);

    return () => window.clearInterval(timer);
  }, [autoRefreshInterval, fetchCandidates]);

  const handleManualRefresh = useCallback(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const updateAutoRefresh = (interval: number) => {
    setAutoRefreshInterval(interval);
    setRefreshDropdownOpen(false);
  };

  const handleSyncUp = useCallback(async () => {
    if (syncInProgress) return;
    setSyncInProgress(true);
    setSyncStatusText('Syncing with cloud...');

    try {
      const response = await syncService.triggerImmediateSync();
      const syncMessage = response.message || 'Sync completed';
      setSyncStatusText(syncMessage);

      if (response.successful) {
        const syncData = response.data || {};
        const differenceMessage = buildSyncDifferenceMessage(syncData);
        toastSuccess('Sync differences', differenceMessage, 8000);
        toastSuccess('Sync completed', syncMessage, 5000);
        setTimeout(() => setSyncStatusText(''), 5000);
        fetchCandidates();
      } else {
        toastError('Sync failed', response.message || 'Unable to sync pending items');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setSyncStatusText('Sync failed');
      toastError('Sync failed', message);
    } finally {
      setSyncInProgress(false);
    }
  }, [fetchCandidates, syncInProgress, toastError, toastSuccess]);

  const getAutoRefreshLabel = (interval: number) => {
    if (interval <= 0) return 'OFF';
    if (interval === 5000) return '5 sec';
    if (interval === 10000) return '10 sec';
    if (interval === 30000) return '30 sec';
    return `${interval / 1000} sec`;
  };

  const filteredCandidates = candidates.filter(candidate => {
    const candidateName = candidate.candidateName || '';
    const candidateEmail = candidate.emailId || '';
    const candidateStatus = (candidate.biometricStatus || '').toLowerCase();
    const term = searchTerm.trim().toLowerCase();

    const applicationNumber = (candidate.applicationNumber || '').toLowerCase();
    const matchesSearch =
      candidateName.toLowerCase().includes(term) ||
      candidateEmail.toLowerCase().includes(term) ||
      applicationNumber.includes(term);

    const matchesStatus =
      statusFilter === 'all' || candidateStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Pagination
  const total = filteredCandidates.length;
  const totalPages = Math.ceil(total / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedCandidates = filteredCandidates.slice(startIndex, startIndex + rowsPerPage);

  const resolveApiAsset = (path?: string) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    const dataBaseUrl = apiUrl.replace(/\/api$/, '');
    let normalizedPath = path;
    if (!normalizedPath.startsWith('/')) normalizedPath = `/${normalizedPath}`;

    if (normalizedPath.startsWith('/data')) {
      return `${dataBaseUrl}${normalizedPath}`;
    }

    if (normalizedPath.startsWith('/api') || normalizedPath.startsWith('/uploads')) {
      return `${apiUrl}${normalizedPath}`;
    }

    return `${apiUrl}/api/upload/images${normalizedPath}`;
  };

  const formatTimestamp = (timestamp?: string | null) => {
    if (!timestamp) return '- Pending';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp;
    return date.toLocaleString();
  };

  const buildSyncDifferenceMessage = (data: { totalLocalCandidates?: number; totalCloudCandidates?: number; totalMissingInCloud?: number; totalSynced?: number; totalUpdated?: number; totalAlreadyLocal?: number; totalFailed?: number; }) => {
    const localCount = data.totalLocalCandidates ?? 0;
    const cloudCount = data.totalCloudCandidates ?? 0;
    const diff = Math.abs(localCount - cloudCount);
    if (localCount === cloudCount) {
      return `Local and cloud counts are equal (${localCount}). Difference is 0. Bi-directional sync completed.`;
    }

    const direction = localCount > cloudCount ? 'Local → Cloud' : 'Cloud → Local';
    const countLabel = localCount > cloudCount
      ? `Local has ${localCount}, Cloud has ${cloudCount}`
      : `Cloud has ${cloudCount}, Local has ${localCount}`;

    return `${countLabel}. Difference: ${diff}. Sync direction: ${direction}.`;
  };

  const getStatusBadge = (status: Candidate['biometricStatus']) => {
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const mappedStatus = normalizedStatus === 'success' ? 'completed' : normalizedStatus;

    const config: Record<string, { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; color: string; bg: string; text: string; border: string }> = {
      completed: { icon: CheckCircle, color: 'green', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
      pending: { icon: Clock, color: 'yellow', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
      failed: { icon: AlertCircle, color: 'red', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
    };
    
    const { icon: Icon, bg, text, border } = config[mappedStatus] || config.pending;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text} border ${border}`}>
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const downloadBlob = async (data: BlobPart, filename: string, mime: string) => {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getPdfExportFileName = () => {
    const city = filteredCandidates[0]?.city || centreInfo.city || filteredCandidates[0]?.centreName || 'Unknown_City';
    const slotLabel = filteredCandidates[0]?.examSlot || filteredCandidates[0]?.slot || centreInfo.examSlot || 'Unknown_Slot';
    const clean = (value: string) =>
      value
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '');

    const cityPart = clean(city || 'Unknown_City');
    const slotPart = clean(slotLabel || 'Unknown_Slot');
    return `${cityPart}_${slotPart}_PDF_Export.pdf`;
  };

  const handleExportCSV = async (format: 'csv' | 'pdf' | 'json') => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      setExportDropdownOpen(false);

      if (format === 'csv') {
        const headers = ['Application Number', 'Candidate Name', 'Email', 'Uploaded Signature', 'Uploaded Photo', 'Captured Thumb', 'Status', 'Thumb Capture Timestamp', 'Submit Timestamp'];
        const lines = [headers.join(',')];
        filteredCandidates.forEach(c => {
          const row = [
            c.applicationNumber || '',
            c.candidateName || '',
            c.emailId || '',
            c.liveImagePath || '',
            c.uploadedImagePath || '',
            c.biometricImagePath || '',
            c.biometricStatus || '',
            c.thumbCaptureTimestamp || '',
            c.submitTimestamp || ''
          ].map(value => `"${String(value).replace(/"/g, '""')}"`);
          lines.push(row.join(','));
        });
        await downloadBlob(lines.join('\n'), 'biometric-candidate-list.csv', 'text/csv;charset=utf-8;');
        return;
      }

      if (format === 'json') {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/candidate-details/export/json`);
        if (!response.ok) {
          throw new Error('Failed to export biometric JSON file');
        }

        const blob = await response.blob();
        await downloadBlob(blob, 'candidate_biometric_details.json', 'application/json;charset=utf-8;');
        return;
      }

      // PDF export
      const params = new URLSearchParams();
      if (searchTerm.trim()) {
        params.append('applicationNumber', searchTerm);
        params.append('candidateName', searchTerm);
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/candidate-details/export/pdf?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to export PDF');
      }

      const blob = await response.blob();
      const filename = getPdfExportFileName();
      await downloadBlob(blob, filename, 'application/pdf;charset=utf-8;');
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. See console for details.');
    } finally {
      setIsExporting(false);
    }
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownOpen && exportButtonRef.current && !exportButtonRef.current.contains(event.target as Node)) {
        setExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportDropdownOpen]);

  // Close preview on ESC
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewOpen(false);
    };
    if (previewOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [previewOpen]);

  return (
    <div className="space-y-3">        <style>{`
          .biometric-candidate-table {
            border-collapse: collapse;
          }
          .biometric-candidate-table th,
          .biometric-candidate-table td {
            border: 1px solid #e2e8f0;
          }
        `}</style>      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-slate-900">Biometric Candidate List</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" ref={refreshButtonRef}>
            <button
              type="button"
              onClick={() => setRefreshDropdownOpen(!refreshDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              Auto refresh: {getAutoRefreshLabel(autoRefreshInterval)}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${refreshDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {refreshDropdownOpen && (
              <div className="absolute right-0 mt-1 w-44 bg-white rounded-lg border border-slate-200 shadow-lg z-10">
                <button
                  className="flex items-center justify-between w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => updateAutoRefresh(0)}
                >
                  OFF
                  {autoRefreshInterval === 0 ? <CheckCircle className="w-4 h-4 text-green-600" /> : null}
                </button>
                <button
                  className="flex items-center justify-between w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => updateAutoRefresh(5000)}
                >
                  5 sec
                  {autoRefreshInterval === 5000 ? <CheckCircle className="w-4 h-4 text-green-600" /> : null}
                </button>
                <button
                  className="flex items-center justify-between w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => updateAutoRefresh(10000)}
                >
                  10 sec
                  {autoRefreshInterval === 10000 ? <CheckCircle className="w-4 h-4 text-green-600" /> : null}
                </button>
                <button
                  className="flex items-center justify-between w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => updateAutoRefresh(30000)}
                >
                  30 sec
                  {autoRefreshInterval === 30000 ? <CheckCircle className="w-4 h-4 text-green-600" /> : null}
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleSyncUp}
            disabled={syncInProgress}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="w-3.5 h-3.5" />
            {syncInProgress ? 'Syncing...' : 'Sync Up'}
          </button>
          <button
            type="button"
            onClick={handleManualRefresh}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Refresh
          </button>
          <span className="text-xs text-slate-500">Last: {lastRefreshAt}</span>
          {syncStatusText ? (
            <span className="text-xs text-blue-600">{syncStatusText}</span>
          ) : null}
        </div>

        <div className="relative" ref={exportButtonRef}>
          <button
            type="button"
            onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium transition-colors ${isExporting ? 'cursor-wait opacity-80' : 'hover:bg-slate-50'}`}
            disabled={isExporting}
          >
            {isExporting ? (
              <div className="flex items-center gap-1.5">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                <span>Exporting...</span>
              </div>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                Export
              </>
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${exportDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {exportDropdownOpen && (
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg border border-slate-200 shadow-lg z-10">
              <button
                type="button"
                onClick={() => handleExportCSV('pdf')}
                disabled={isExporting}
                className={`flex items-center gap-2 w-full px-3 py-2 text-sm ${isExporting ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-50'} transition-colors text-left`}
              >
                <Camera className="w-3.5 h-3.5" />
                {isExporting ? 'Exporting PDF...' : 'Export as PDF'}
              </button>
              <button
                type="button"
                onClick={() => handleExportCSV('json')}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
              >
                <X className="w-3.5 h-3.5" />
                Export as JSON
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Compact Stats Cards */}
      {(() => {
        const total = candidates.length;
        const completed = candidates.filter(c => (c.biometricStatus || '').toLowerCase() === 'completed').length;
        const pending = candidates.filter(c => (c.biometricStatus || '').toLowerCase() === 'pending').length;
        const failed = candidates.filter(c => (c.biometricStatus || '').toLowerCase() === 'failed').length;
        
        return (
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Total</p>
                  <p className="text-xl font-bold text-slate-900">{total}</p>
                </div>
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Completed</p>
                  <p className="text-xl font-bold text-green-600">{completed}</p>
                </div>
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Pending</p>
                  <p className="text-xl font-bold text-yellow-600">{pending}</p>
                </div>
                <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-yellow-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Failed</p>
                  <p className="text-xl font-bold text-red-600">{failed}</p>
                </div>
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Table with integrated search and filters */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {/* Table Header with Search and Filters */}
        <div className="p-3 border-b border-slate-200 bg-slate-50/50">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, or ID..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-1.5">
              {['all', 'completed', 'pending', 'failed'].map((status) => {
                const statusValue = status as Candidate['biometricStatus'] | 'all';
                return (
                  <button
                    key={status}
                    onClick={() => {
                      setStatusFilter(statusValue as 'all' | 'completed' | 'pending' | 'failed');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      statusFilter === status
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="biometric-candidate-table w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Application Number
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Candidate Name / Email
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Uploaded Signature
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Uploaded Photo
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Captured Thumb
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Thumb & Submit Timing
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedCandidates.map((candidate) => {
                return (
                  <tr key={candidate.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-2 text-xs font-medium text-slate-800 align-top">{candidate.applicationNumber}</td>
                    <td className="px-3 py-2 text-sm text-slate-900 align-top">
                      <div className="font-medium text-slate-900">{candidate.candidateName}</div>
                      <div className="text-xs text-slate-500">{candidate.emailId}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 align-top">
                      {candidate.liveImagePath ? (
                        <img
                          src={resolveApiAsset(candidate.liveImagePath)}
                          alt="Signature"
                          className="h-18 w-18 object-contain rounded"
                        />
                      ) : 'Not Available'}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 align-top">
                      {candidate.uploadedImagePath ? (
                        <img
                          src={resolveApiAsset(candidate.uploadedImagePath)}
                          alt="Uploaded Photo"
                          className="h-18 w-18 object-contain rounded"
                        />
                      ) : 'Not Available'}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 align-top">
                      {candidate.biometricImagePath ? (
                        <img
                          src={resolveApiAsset(candidate.biometricImagePath)}
                          alt="Captured Thumb"
                          className="h-18 w-18 object-contain rounded"
                        />
                      ) : 'Not Captured'}
                    </td>
                    <td className="px-3 py-2">{getStatusBadge(candidate.biometricStatus)}</td>
                    <td className="px-3 py-2 text-xs space-y-1">
                      <div className="flex items-center gap-1 text-slate-600">
                        <Fingerprint className="w-3 h-3" />
                        {formatTimestamp(candidate.thumbCaptureTimestamp)}
                      </div>
                      <div className="flex items-center gap-1 text-slate-600">
                        <Send className="w-3 h-3" />
                        {formatTimestamp(candidate.submitTimestamp)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Compact Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 bg-slate-50/50 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <span>
                {startIndex + 1}-{Math.min(startIndex + rowsPerPage, total)} of {total}
              </span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded border-slate-200 text-slate-700 text-xs py-0.5 px-1.5 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = totalPages <= 5 ? i + 1 : Math.min(currentPage - 2, totalPages - 4) + i + 1;
                if (page < 1) return null;
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-[1.75rem] h-7 px-1.5 rounded text-xs font-medium transition-colors ${
                      currentPage === page
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              {totalPages > 5 && (
                <>
                  <span className="px-1 text-slate-400">...</span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    className={`min-w-[1.75rem] h-7 px-1.5 rounded text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 ${
                      currentPage === totalPages ? "bg-slate-900 text-white" : ""
                    }`}
                  >
                    {totalPages}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
};

export default BiometricCandidateList;