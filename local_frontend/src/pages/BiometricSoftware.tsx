import React, { useState, useEffect, useCallback } from 'react';
import ExaminationDetails from '../components/ExaminationDetails';
import BiometricDetails from '../components/BiometricDetails';
import SessionDetails from '../components/SessionDetails';
import CandidateDetails from '../components/CandidateDetails';
import ThumbTemplateStatus from '../components/ThumbTemplateStatus';
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
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isCandidateLoaded, setIsCandidateLoaded] = useState(false);
  const [capturedImages, setCapturedImages] = useState({
    signature: false,
    uploaded: false,
    camera: false,
    live: false,
    thumb: false
  });
  const [imagePaths, setImagePaths] = useState({
    uploadedImagePath: '',
    liveImagePath: '',
    biometricImagePath: ''
  });
  const [capturedImage, setCapturedImage] = useState(''); // For webcam captures
  const [candidateSlot, setCandidateSlot] = useState('');
  const [candidateApplicationId, setCandidateApplicationId] = useState('');
  const [thumbTemplate, setThumbTemplate] = useState({ isoTemplateBase64: '', templateBase64: '' });
  const [oldThumbTemplateBase64, setOldThumbTemplateBase64] = useState('');
  const [matchStatus, setMatchStatus] = useState<'success' | 'failed' | 'pending' | 'not-applicable' | 'unknown'>('unknown');
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
    type: 'signature' | 'uploaded' | 'camera' | 'live' | 'thumb',
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
      if (type === 'live') {
        setCapturedImage(imageData);
      } else if (type === 'thumb') {
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
      }
    }
  };

  const handleWebcamToggle = () => {
    const newState = !isWebcamActive;
    setIsWebcamActive(newState);
  };

  const templateAvailable = Boolean(oldThumbTemplateBase64);

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
      let faceResult;
      let thumbResult;

      // Submit captured webcam face image (live capture)
      if (capturedImage) {
        faceResult = await biometricService.submitFaceCapture(
          submitApplicationNumber,
          capturedImage,
          undefined,
          candidateSlot || examSlot || undefined,
          candidateApplicationId || undefined
        );
      } else {
        toastInfo('No Webcam Capture', 'No captured webcam image available yet.');
      }

      // Submit thumb data or existing template when old template was present and match was attempted
      const shouldSubmitThumb = (imagePaths.biometricImagePath && imagePaths.biometricImagePath.startsWith('data:'))
        || (templateAvailable && capturedImages.thumb);

      if (shouldSubmitThumb) {
        thumbResult = await biometricService.submitThumbCapture(
          submitApplicationNumber,
          imagePaths.biometricImagePath && imagePaths.biometricImagePath.startsWith('data:') ? imagePaths.biometricImagePath : undefined,
          thumbTemplate.isoTemplateBase64,
          thumbTemplate.templateBase64,
          thumbCaptureTimestamp,
          deviceApiResponse || undefined,
          candidateSlot || examSlot || undefined,
          candidateApplicationId || undefined
        );
      } else {
        toastInfo('No Thumb Capture', 'No captured or matched thumb data is available yet.');
      }

      if ((faceResult && faceResult.successful) || (thumbResult && thumbResult.successful)) {
        const messages = [];
        if (faceResult?.successful) messages.push('Face');
        if (thumbResult?.successful) messages.push('Thumb');

        toastSuccess('Biometric Submission', `${messages.join(' and ')} data submitted successfully.`);
        window.dispatchEvent(new Event('candidateDataUpdated'));

        // Reset candidate and biometric UI after successful submit
        handleNewCandidate();
      } else {
        toastError('Submission Failed', 'No biometric image was submitted. Ensure webcam and/or thumb capture are complete.');
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
    setCapturedImages({ signature: false, uploaded: false, camera: false, live: false, thumb: false });
    setImagePaths({ uploadedImagePath: '', liveImagePath: '', biometricImagePath: '' });
    setCapturedImage('');
    setCandidateSlot('');
    setCandidateApplicationId('');
    setThumbTemplate({ isoTemplateBase64: '', templateBase64: '' });
    setOldThumbTemplateBase64('');
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
        setCapturedImages({ signature: false, uploaded: false, camera: false, live: false, thumb: false });
        setImagePaths({ uploadedImagePath: '', liveImagePath: '', biometricImagePath: '' });
        setCapturedImage('');
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
          isWebcamActive={isWebcamActive}
          isCandidateLoaded={isCandidateLoaded}
          uploadedImagePath={imagePaths.uploadedImagePath}
          liveImagePath={imagePaths.liveImagePath}
          biometricImagePath={imagePaths.biometricImagePath}
          capturedImage={capturedImage}
          galleryTemplateBase64={oldThumbTemplateBase64}
          onMatchStatusChange={setMatchStatus}
          handleCapture={handleCapture}
          handleWebcamToggle={handleWebcamToggle}
        />

        <ThumbTemplateStatus
          isCandidateLoaded={isCandidateLoaded}
          templateAvailable={templateAvailable}
          matchStatus={matchStatus}
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
          setCapturedImage={setCapturedImage}
          setThumbTemplate={setThumbTemplate}
          setOldThumbTemplateBase64={setOldThumbTemplateBase64}
          setMatchStatus={setMatchStatus}
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
