import React, { useState } from 'react';
import { Menu, X, Upload, User, LogOut, ChevronLeft } from 'lucide-react';
import Button from '../components/ui/Button';
import UploadCandidateDataModal from '../components/UploadCandidateDataModal';
import UploadModeModal from '../components/UploadModeModal';
import { useNavigate, useLocation } from "react-router-dom";
import { authService, candidateService, uploadService } from "../services/api";
import ToastContainer from '../components/Toast/ToastContainer';
import { useToast } from '../hooks/useToast';

interface MainLayoutProps {
  children: React.ReactNode;
  onLogout?: () => void;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  mobile: string;
  countryCode: string;
  role: string;
  centreCode?: string;
  centreName?: string;
}

export default function MainLayout({ children, onLogout }: MainLayoutProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploadModeModalOpen, setIsUploadModeModalOpen] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [pendingPassword, setPendingPassword] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);
  const { toasts, success, error, removeToast } = useToast();
  const [loading, setLoading] = useState(false);
  const userButtonRef = React.useRef<HTMLButtonElement>(null);
  const userMenuRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Load user data from localStorage on component mount
  React.useEffect(() => {
    const userData = authService.getUser();
    if (userData) {
      setUser(userData);
    }
  }, []);

  // Close user menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node) &&
        userButtonRef.current &&
        !userButtonRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    setLoading(true);
    
    try {
      // Clear all authentication data
      authService.logout();
      
      // Clear user state
      setUser(null);
      
      // Close user menu
      setIsUserMenuOpen(false);
      
      // Call onLogout prop if provided
      if (onLogout) {
        onLogout();
      }
      
      // Redirect to login page
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect to login even if there's an error
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadCandidateData = () => {
    // Open the upload modal instead of navigating
    setIsUploadModalOpen(true);
  };

  const doUpload = async (file: File, mode: 'replace' | 'merge', password: string = '') => {
    setIsUploading(true);

    try {
      const response = await uploadService.uploadCandidateData(file, mode, password);

      if (response.successful) {
        success('Upload Complete', response.message || 'Candidates uploaded successfully.');
        window.dispatchEvent(new Event('candidateDataUpdated'));
        setTimeout(() => {
          setIsUploadModalOpen(false);
        }, 250);
      } else {
        error('Upload Failed', response.message || 'Candidate upload response was not successful.');
      }
    } catch (uploadError: unknown) {
      const errorMessage = uploadError instanceof Error ? uploadError.message : 'An error occurred during file upload.';
      error('Upload Error', errorMessage);
    } finally {
      setIsUploading(false);
      setPendingUploadFile(null);
      setIsUploadModeModalOpen(false);
    }
  };

  const handleFileUpload = async (file: File, password: string = '') => {
    console.log('[MainLayout] Candidate ZIP upload triggered', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      hasPassword: !!password
    });
    setPendingUploadFile(file);
    setPendingPassword(password);

    try {
      const result = await candidateService.getCandidateCounts('');
      const candidateTotal = result.candidateCounts?.total || 0;

      if (candidateTotal > 0) {
        setIsUploadModeModalOpen(true);
        return;
      }

      await doUpload(file, 'replace', password);
    } catch (err) {
      console.error('Candidate count check failed', err);
      // fallback to direct upload
      await doUpload(file, 'replace', password);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="relative z-50 h-14 flex-shrink-0 bg-white/95 backdrop-blur-sm border-b border-gray-200/50 px-3 sm:px-4 flex items-center justify-between shadow-sm shadow-gray-200/30">
        {/* Left Side - Header Actions */}
        <div className="flex items-center gap-2">
          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {location.pathname === '/biometric-candidates' ? (
            <Button
              onClick={() => navigate('/biometric-software')}
              variant="secondary"
              size="md"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Biometric Software
            </Button>
          ) : (
            <Button
              onClick={handleUploadCandidateData}
              variant="upload"
              size="md"
            >
              <Upload className="h-4 w-4" />
              Upload Candidates Data
            </Button>
          )}
        </div>

        {/* Center - Title */}
        <div className="absolute left-1/2 transform -translate-x-1/2 hidden sm:block">
          <p className="text-lg uppercase font-semibold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent text-center whitespace-nowrap">
            Digi Parikshak Biometric Software
          </p>
        </div>

        {/* Mobile Title */}
        <div className="sm:hidden absolute left-1/2 transform -translate-x-1/2">
          <h1 className="text-xs font-semibold text-gray-900 text-center">
            Digi Parikshak
          </h1>
        </div>

        {/* Right Side - User Info */}
        <div className="flex items-center gap-2">
          {/* Welcome Message */}
          <div className="flex flex-col">
            <span className="text-xs text-gray-500">Welcome,</span>
            <span className="text-sm font-medium text-gray-700">
              {user?.name}
            </span>
          </div>

          {/* User Menu Button */}
          <button
            ref={userButtonRef}
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="p-1 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <User className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        {/* User Menu Dropdown */}
        {isUserMenuOpen && (
          <div 
            ref={userMenuRef} 
            className="absolute right-3 top-12 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden"
          >
            {/* User Profile Section */}
            <div className="p-3 border-b border-gray-200">
              <div className="flex items-center gap-1">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{user?.name}</h3>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              <button 
                onClick={handleLogout}
                disabled={loading}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut className="h-3.5 w-3.5 text-red-500" />
                <span>{loading ? 'Logging out...' : 'Logout'}</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="bg-white w-80 h-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Menu</h2>
            </div>
            <div className="p-4">
              <button
                onClick={() => {
                  setIsUploadModalOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Upload className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Upload Candidates Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-auto p-2 sm:p-2">
        {children}
      </main>

      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Upload Candidate Data Modal */}
      <UploadCandidateDataModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleFileUpload}
        isUploading={isUploading}
      />

      <UploadModeModal
        isOpen={isUploadModeModalOpen}
        onClose={() => setIsUploadModeModalOpen(false)}
        onReplace={() => {
          if (pendingUploadFile) {
            doUpload(pendingUploadFile, 'replace', pendingPassword);
          }
        }}
        onMerge={() => {
          if (pendingUploadFile) {
            doUpload(pendingUploadFile, 'merge', pendingPassword);
          }
        }}
      />
    </div>
  );
}
