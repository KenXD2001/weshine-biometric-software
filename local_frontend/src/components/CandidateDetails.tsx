import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, RotateCcw, ChevronDown, Loader2, X } from 'lucide-react';
import Button from './ui/Button';

interface CandidateDetailsProps {
  applicationNumber: string;
  setApplicationNumber: (value: string) => void;
  candidateName: string;
  setCandidateName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  gender: string;
  setGender: (value: string) => void;
  thumb: string;
  setThumb: (value: string) => void;
  setImagePaths: (paths: { uploadedImagePath: string; signatureImagePath: string; biometricImagePath: string }) => void;
  setCapturedImages: (images: { signature: boolean; uploaded: boolean; thumb: boolean }) => void;
  onCandidateLoaded: (loaded: boolean) => void;
  onSubmit: (applicationNumber: string) => void;
  isSubmitting: boolean;
  capturedImages: { signature: boolean; uploaded: boolean; thumb: boolean };
  onNewCandidate: () => void;
  onResetSystem: () => void;
  onCandidateMetadataLoaded: (metadata: { slot: string; userExamApplicationId: string }) => void;
}

const CandidateDetails: React.FC<CandidateDetailsProps> = ({
  applicationNumber,
  setApplicationNumber,
  candidateName,
  setCandidateName,
  email,
  setEmail,
  gender,
  setGender,
  thumb,
  setThumb,
  onSubmit,
  onNewCandidate,
  onResetSystem,
  onCandidateMetadataLoaded,
  onCandidateLoaded,
  setImagePaths,
  setCapturedImages,
  capturedImages,
  isSubmitting,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedApplicationNumber, setSelectedApplicationNumber] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<number | null>(null);

  const canNewCandidate = Boolean(applicationNumber.trim() || candidateName.trim() || email.trim());
  const canSubmitBiometrics = capturedImages.thumb;
  const isNewCandidateEnabled = canNewCandidate; // explicit alias for clarity
  // Search application numbers from API with debouncing
  const searchApplicationNumbers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for 1 second delay
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/candidate-details/search?query=${encodeURIComponent(query.trim())}`);
        const data = await response.json();
        
        if (data.successful && data.data) {
          setSearchResults(data.data.slice(0, 10)); // Limit to 10 results for UX
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error('Error searching application numbers:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 1000); // 1 second delay
  };

  // Fetch candidate data when application number is entered
  const fetchCandidateData = async () => {
    if (!applicationNumber.trim()) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/candidate-details/all?applicationNumber=${encodeURIComponent(applicationNumber.trim())}`);
      const data = await response.json();

      console.log('[CandidateDetails] candidate fetch result:', data);
      
        if (data.successful && data.data) {
        const candidate = data.data;
        setCandidateName(candidate.candidateName || '');
        setEmail(candidate.emailId || '');
        setGender(candidate.gender || '');
        setThumb(candidate.thumb || 'right-thumb');

        setImagePaths({
          uploadedImagePath: candidate.uploadedImagePath || '',
          signatureImagePath: candidate.liveImagePath || '',
          biometricImagePath: candidate.biometricImagePath || ''
        });

        setCapturedImages({
          signature: !!candidate.liveImagePath,
          uploaded: !!candidate.uploadedImagePath,
          thumb: !!candidate.biometricImagePath
        });

        onCandidateLoaded(true);
        onCandidateMetadataLoaded({
          slot: String(candidate.examSlot || candidate.slot || ''),
          userExamApplicationId: String(candidate.userExamApplicationId || candidate.applicationNumber || '')
        });
      } else {
        onCandidateLoaded(false);
        onCandidateMetadataLoaded({ slot: '', userExamApplicationId: '' });
        console.log('[CandidateDetails] Candidate not found or no data', { applicationNumber });
      }
    } catch (error) {
      console.error('Error fetching candidate data:', error);
      onCandidateLoaded(false);
      onCandidateMetadataLoaded({ slot: '', userExamApplicationId: '' });
    }
  };

  // Handle Enter key press on application number input
  const handleInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setIsDropdownOpen(false);
      fetchCandidateData();
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setApplicationNumber(value);
    onCandidateLoaded(false);
    
    // Only search if value is different from current selection
    if (value.trim() && value !== selectedApplicationNumber) {
      searchApplicationNumbers(value);
      setIsDropdownOpen(true);
    } else {
      setSearchResults([]);
      setIsDropdownOpen(false);
    }
  };

  // Handle application number selection from dropdown
  const handleApplicationNumberSelect = (selectedNumber: string) => {
    setApplicationNumber(selectedNumber);
    setSelectedApplicationNumber(selectedNumber);
    setIsDropdownOpen(false);
    setSearchResults([]);
    onCandidateLoaded(false);
    
    // Refocus the input after selection
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const clearApplicationNumber = () => {
    setApplicationNumber('');
    setSelectedApplicationNumber('');
    setSearchResults([]);
    setIsDropdownOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200/50 shadow-lg shadow-gray-200/25 hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-center gap-3 bg-blue-950 rounded-t-xl mb-3">
        <div className="p-2">
          <UserPlus className="h-5 w-5 text-white" />
        </div>
        <h2 className="text-lg font-bold text-white">
          Candidate Details
        </h2>
      </div>
      
      <div className="flex gap-3 p-3 pt-0 rounded-b-xl">
        {/* Left Section - Form */}
        <div className="flex-1 space-y-2">
          <div className="relative" ref={dropdownRef}>
            <input
              type="text"
              ref={inputRef}
              value={applicationNumber}
              onChange={handleInputChange}
              onKeyPress={handleInputKeyPress}
              placeholder="Enter Application Number"
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white placeholder-gray-400 text-sm text-black pr-14"
            />
            {applicationNumber && (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={clearApplicationNumber}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition-all duration-200 hover:cursor-pointer hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Clear application number"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {/* Dropdown */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                {isSearching ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    <span className="ml-2 text-sm text-gray-600">Searching...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((ticket) => (
                    <div
                      key={ticket}
                      className={`px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors text-sm ${
                        selectedApplicationNumber === ticket ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
                      }`}
                      onClick={() => handleApplicationNumberSelect(ticket)}
                    >
                      {ticket}
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    No application numbers found
                  </div>
                )}
              </div>
            )}
            {/* Dropdown arrow */}
            {isDropdownOpen && (
              <div className={`absolute top-2 ${applicationNumber ? 'right-10' : 'right-3'} pointer-events-none`}>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>
            )}
          </div>
          <div className="group">
            <input
              type="text"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="Candidate's Name"
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white placeholder-gray-400 text-sm text-black"
            />
          </div>
          <div className="group">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Id"
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white placeholder-gray-400 text-sm text-black"
            />
          </div>
          <div className="group">
            <select
              value={gender || ''}
              onChange={(e) => setGender(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white text-sm text-black"
              aria-label="Select Gender"
            >
              <option value="">
                -- Select Gender --
              </option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="group">
            <select
              value={thumb || 'right-thumb'}
              onChange={(e) => setThumb(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white text-sm text-black"
              aria-label="Select Thumb Option"
            >
              <option value="">
                -- Select Finger --
              </option>
              <option value="right-thumb">Right Thumb</option>
              <option value="left-thumb">Left Thumb</option>
              <option value="right-index">Right Index</option>
              <option value="left-index">Left Index</option>
              <option value="right-middle">Right Middle</option>
              <option value="left-middle">Left Middle</option>
              <option value="right-ring">Right Ring</option>
              <option value="left-ring">Left Ring</option>
              <option value="right-little">Right Little</option>
              <option value="left-little">Left Little</option>
            </select>
          </div>
          
          <Button 
            onClick={() => onSubmit(applicationNumber)}
            variant="primary"
            size="sm"
            fullWidth
            disabled={!canSubmitBiometrics || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Candidate Biometrics'}
          </Button>
        </div>

        {/* Right Section - Action Buttons */}
        <div className="flex flex-col gap-2">
          <Button 
            onClick={onNewCandidate}
            variant="secondary"
            size="sm"
            disabled={!isNewCandidateEnabled}
          >
            <UserPlus className="h-3 w-3" />
            New Candidate
          </Button>
          <Button 
            onClick={onResetSystem}
            variant="danger"
            size="sm"
          >
            <RotateCcw className="h-3 w-3" />
            Reset System
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CandidateDetails;