import React, { useState, useEffect, useCallback } from 'react';
import ExaminationDetails from '../components/ExaminationDetails';
import BiometricDetails from '../components/BiometricDetails';
import SessionDetails from '../components/SessionDetails';
import CandidateDetails from '../components/CandidateDetails';
import ConfirmDialog from '../components/ConfirmDialog';
import ToastContainer from '../components/Toast/ToastContainer';
import { useToast } from '../hooks/useToast';
import { authService, biometricService, candidateService, uploadService } from '../services/api';

type BiometricDeviceApiResponse = {
  ISOTemplateBase64?: string;
  TemplateBase64?: string;
  CaptureTime?: string;
  ErrorCode?: number;
  BMPBase64?: string;
  fingerprintData?: string;
  imageData?: string;
  [key: string]: unknown;
};

const BiometricSoftware: React.FC = () => {
  // Get user data for initial state
  const userData = authService.getUser();
  
  const [centreCode, setCentreCode] = useState(userData?.centreCode || '');
  const [centreName, setCentreName] = useState(userData?.centreName || '');
  const [examDate, setExamDate] = useState(userData?.examDate || '');
  const [examSlot, setExamSlot] = useState(userData?.examSlot || '');
  const [applicationNumber, setApplicationNumber] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [thumb, setThumb] = useState('');
  const [isCandidateLoaded, setIsCandidateLoaded] = useState(false);
  const [capturedImages, setCapturedImages] = useState({
    signature: false,
    uploaded: false,
    thumb: false
  });
  const [imagePaths, setImagePaths] = useState({
    uploadedImagePath: '',
    signatureImagePath: '',
    biometricImagePath: ''
  });
  const [candidateSlot, setCandidateSlot] = useState('');
  const [candidateApplicationId, setCandidateApplicationId] = useState('');
  const [thumbTemplate, setThumbTemplate] = useState({ isoTemplateBase64: '', templateBase64: '' });
  const [thumbCaptureTimestamp, setThumbCaptureTimestamp] = useState('');
  const [deviceApiResponse, setDeviceApiResponse] = useState<BiometricDeviceApiResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCentreInfo = useCallback(async () => {
    try {
      const result = await candidateService.getCentreInfo();
      if (result.successful && result.data) {
        setCentreCode(result.data.centreCode || userData?.centreCode || '');
        setCentreName(result.data.centreName || userData?.centreName || '');
        setExamDate(result.data.examDate || userData?.examDate || '');
        setExamSlot(result.data.examSlot || userData?.examSlot || '');
      }
    } catch (error) {
      console.warn('Failed to load centre info, using login user data fallback', error);
    }
  }, [userData]);

  useEffect(() => {
    loadCentreInfo();
  }, [loadCentreInfo]);

  useEffect(() => {
    const handleCandidateDataUpdated = () => {
      loadCentreInfo();
    };

    window.addEventListener('candidateDataUpdated', handleCandidateDataUpdated);
    return () => window.removeEventListener('candidateDataUpdated', handleCandidateDataUpdated);
  }, [loadCentreInfo]);

  const { toasts, success: toastSuccess, error: toastError, warning: toastWarning, info: toastInfo, removeToast } = useToast();

  const handleCapture = (
    type: 'signature' | 'uploaded' | 'thumb',
    imageData?: string,
    templateData?: { isoTemplateBase64?: string; templateBase64?: string },
    captureTimestamp?: string,
    deviceApiResponse?: BiometricDeviceApiResponse
  ) => {
    setCapturedImages(prev => ({ ...prev, [type]: true }));

    if (type === 'thumb' && deviceApiResponse) {
      setDeviceApiResponse(deviceApiResponse);
    }

    if (imageData) {
      if (type === 'thumb') {
        setImagePaths(prev => ({
          ...prev,
          biometricImagePath: imageData
        }));

        if (templateData?.isoTemplateBase64) {
          setThumbTemplate(prev => ({ ...prev, isoTemplateBase64: templateData.isoTemplateBase64! }));
        }
        if (templateData?.templateBase64) {
          setThumbTemplate(prev => ({ ...prev, templateBase64: templateData.templateBase64! }));
        }

        if (captureTimestamp) {
          setThumbCaptureTimestamp(captureTimestamp);
        } else {
          setThumbCaptureTimestamp(new Date().toISOString());
        }
      } else if (type === 'uploaded') {
        setImagePaths(prev => ({
          ...prev,
          uploadedImagePath: imageData
        }));
      } else if (type === 'signature') {
        setImagePaths(prev => ({
          ...prev,
          signatureImagePath: imageData
        }));
      }
    }
  };

  const handleSubmit = async (submitApplicationNumber: string) => {
    if (!submitApplicationNumber.trim()) {
      toastWarning('Missing Application Number', 'Please enter an Application Number and load candidate details before submitting.');
      return;
    }

    if (isSubmitting) {
      toastInfo('Submission in Progress', 'Please wait until the current submission finishes.');
      return;
    }

    setIsSubmitting(true);

    try {
      let thumbResult;

      if (imagePaths.biometricImagePath && imagePaths.biometricImagePath.startsWith('data:')) {
        thumbResult = await biometricService.submitThumbCapture(
          submitApplicationNumber,
          imagePaths.biometricImagePath,
          thumbTemplate.isoTemplateBase64,
          thumbTemplate.templateBase64,
          thumbCaptureTimestamp,
          deviceApiResponse || undefined,
          candidateSlot || examSlot || undefined,
          candidateApplicationId || undefined
        );
      } else {
        toastInfo('No Thumb Capture', 'No captured thumb data available yet.');
      }

      if (thumbResult?.successful) {
        toastSuccess('Biometric Submission', 'Thumb data submitted successfully.');
        window.dispatchEvent(new Event('candidateDataUpdated'));
        handleNewCandidate();
      } else {
        toastError('Submission Failed', 'No biometric thumb data was submitted. Ensure thumb capture is complete.');
      }

    } catch (error: unknown) {
      console.error('Error submitting biometric data', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toastError('Error Submitting Biometric Data', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewCandidate = () => {
    // Reset everything to allow fresh candidate input / fetch
    console.log('New candidate');
    setIsCandidateLoaded(false);
    setApplicationNumber('');
    setCandidateName('');
    setEmail('');
    setGender('');
    setThumb('');
    setCapturedImages({ signature: false, uploaded: false, thumb: false });
    setImagePaths({ uploadedImagePath: '', signatureImagePath: '', biometricImagePath: '' });
    setCandidateSlot('');
    setCandidateApplicationId('');
    setThumbTemplate({ isoTemplateBase64: '', templateBase64: '' });
    setThumbCaptureTimestamp('');
    setDeviceApiResponse(null);
  };

  const handleResetSystemButtonClick = () => {
    setIsResetDialogOpen(true);
  };

  const [isResetDialogOpen, setIsResetDialogOpen] = React.useState(false);

  const handleResetSystem = async () => {
    try {
      const result = await uploadService.resetSystem();
      if (result?.successful) {
        window.dispatchEvent(new Event('candidateDataUpdated'));
        setCentreCode('');
        setCentreName('');
        setExamDate('');
        setExamSlot('');
        setApplicationNumber('');
        setCandidateName('');
        setEmail('');
        setGender('');
        setThumb('');
        setIsCandidateLoaded(false);
        setCapturedImages({ signature: false, uploaded: false, thumb: false });
        setImagePaths({ uploadedImagePath: '', signatureImagePath: '', biometricImagePath: '' });
        toastSuccess('Reset successful', 'System reset completed. Please upload candidate data again.');
      } else {
        toastError('Reset failed', result?.message || 'Could not reset system.');
      }
    } catch (error: unknown) {
      console.error('Reset system error', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toastError('Reset failed', msg);
    }
  };

  return (
    <div className="flex gap-2 h-full">
      {/* Left Section - 60% width */}
      <div className="w-[60%] space-y-2">
        <ExaminationDetails
          centreCode={centreCode}
          centreName={centreName}
          examDate={examDate}
          examSlot={examSlot}
        />

        <BiometricDetails
          capturedImages={capturedImages}
          isCandidateLoaded={isCandidateLoaded}
          uploadedImagePath={imagePaths.uploadedImagePath}
          signatureImagePath={imagePaths.signatureImagePath}
          biometricImagePath={imagePaths.biometricImagePath}
          handleCapture={handleCapture}
        />
      </div>

      {/* Right Section - 40% width */}
      <div className="w-[40%] space-y-2">
        <SessionDetails />

        <CandidateDetails
          applicationNumber={applicationNumber}
          setApplicationNumber={setApplicationNumber}
          candidateName={candidateName}
          setCandidateName={setCandidateName}
          email={email}
          setEmail={setEmail}
          gender={gender}
          setGender={setGender}
          thumb={thumb}
          setThumb={setThumb}
          setImagePaths={setImagePaths}
          setCapturedImages={setCapturedImages}
          capturedImages={capturedImages}
          onCandidateLoaded={setIsCandidateLoaded}
          onCandidateMetadataLoaded={({ slot, userExamApplicationId }) => {
            setCandidateSlot(slot || '');
            setCandidateApplicationId(userExamApplicationId || '');
          }}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          onNewCandidate={handleNewCandidate}
          onResetSystem={handleResetSystemButtonClick}
        />
      </div>

      <ConfirmDialog
        isOpen={isResetDialogOpen}
        title="Confirm system reset"
        message="This action will delete all uploaded candidate data and biometric progress. Do you want to continue?"
        confirmText="Reset"
        cancelText="Cancel"
        onConfirm={() => {
          setIsResetDialogOpen(false);
          handleResetSystem();
        }}
        onCancel={() => setIsResetDialogOpen(false)}
      />

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
};

export default BiometricSoftware;
