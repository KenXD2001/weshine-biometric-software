import React, { useState, useEffect, useCallback } from 'react';
import ExaminationDetails from '../components/ExaminationDetails';
import BiometricDetails from '../components/BiometricDetails';
import SessionDetails from '../components/SessionDetails';
import CandidateDetails from '../components/CandidateDetails';
import ConfirmDialog from '../components/ConfirmDialog';
import ToastContainer from '../components/Toast/ToastContainer';
import { useToast } from '../hooks/useToast';
import { biometricService, candidateService, uploadService } from '../services/api';

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
  const [centreCode, setCentreCode] = useState('');
  const [centreName, setCentreName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [examSlot, setExamSlot] = useState('');
  const [applicationNumber, setApplicationNumber] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [thumb, setThumb] = useState('');
  const [isCandidateLoaded, setIsCandidateLoaded] = useState(false);
  const [capturedImages, setCapturedImages] = useState({
    signature: false,
    uploaded: false,
    thumb: false,
    webcam: false
  });
  const [imagePaths, setImagePaths] = useState({
    uploadedImagePath: '',
    signatureImagePath: '',
    biometricImagePath: '',
    webcamImagePath: ''
  });
  const [candidateSlot, setCandidateSlot] = useState('');
  const [candidateApplicationId, setCandidateApplicationId] = useState('');
  const [thumbTemplate, setThumbTemplate] = useState({ isoTemplateBase64: '', templateBase64: '' });
  const [thumbCaptureTimestamp, setThumbCaptureTimestamp] = useState('');
  const [webcamCaptureTimestamp, setWebcamCaptureTimestamp] = useState('');
  const [deviceApiResponse, setDeviceApiResponse] = useState<BiometricDeviceApiResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCentreInfo = useCallback(async () => {
    try {
      const result = await candidateService.getCentreInfo();
      if (result.successful && result.data) {
        setCentreCode(result.data.centreCode || '');
        setCentreName(result.data.centreName || '');
        setExamDate(result.data.examDate || '');
        setExamSlot(result.data.examSlot || '');
      }
    } catch (error) {
      console.warn('Failed to load centre info', error);
    }
  }, []);

  useEffect(() => {
    loadCentreInfo();

    const handleCandidateDataUpdated = () => {
      loadCentreInfo();
    };

    window.addEventListener('candidateDataUpdated', handleCandidateDataUpdated);
    return () => window.removeEventListener('candidateDataUpdated', handleCandidateDataUpdated);
  }, [loadCentreInfo]);

  const { toasts, success: toastSuccess, error: toastError, warning: toastWarning, info: toastInfo, removeToast } = useToast();

  const handleCapture = (
    type: 'signature' | 'uploaded' | 'thumb' | 'webcam',
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
      } else if (type === 'webcam') {
        setImagePaths(prev => ({
          ...prev,
          webcamImagePath: imageData
        }));

        if (captureTimestamp) {
          setWebcamCaptureTimestamp(captureTimestamp);
        } else {
          setWebcamCaptureTimestamp(new Date().toISOString());
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
      let webcamResult;
      let thumbResult;

      // Submit webcam capture first if available
      if (imagePaths.webcamImagePath && imagePaths.webcamImagePath.startsWith('data:')) {
        webcamResult = await biometricService.submitWebcamCapture(
          submitApplicationNumber,
          imagePaths.webcamImagePath,
          webcamCaptureTimestamp || undefined,
          candidateSlot || examSlot || undefined,
          candidateApplicationId || undefined
        );
      }

      // Then submit thumb capture if available
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
      }

      const webcamSubmitted = webcamResult?.successful;
      const thumbSubmitted = thumbResult?.successful;

      if (webcamSubmitted || thumbSubmitted) {
        const parts = [];
        if (webcamSubmitted) parts.push('webcam');
        if (thumbSubmitted) parts.push('thumb');
        toastSuccess('Biometric Submission', `${parts.join(' & ')} data submitted successfully.`);
        window.dispatchEvent(new Event('candidateDataUpdated'));
        handleNewCandidate();
      } else {
        toastError('Submission Failed', 'No biometric data was submitted. Ensure webcam and/or thumb capture is complete.');
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
    setIsCandidateLoaded(false);
    setApplicationNumber('');
    setCandidateName('');
    setEmail('');
    setGender('');
    setThumb('');
    setCapturedImages({ signature: false, uploaded: false, thumb: false, webcam: false });
    setImagePaths({ uploadedImagePath: '', signatureImagePath: '', biometricImagePath: '', webcamImagePath: '' });
    setCandidateSlot('');
    setCandidateApplicationId('');
    setThumbTemplate({ isoTemplateBase64: '', templateBase64: '' });
    setThumbCaptureTimestamp('');
    setWebcamCaptureTimestamp('');
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
        setCapturedImages({ signature: false, uploaded: false, thumb: false, webcam: false });
        setImagePaths({ uploadedImagePath: '', signatureImagePath: '', biometricImagePath: '', webcamImagePath: '' });
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
          webcamImagePath={imagePaths.webcamImagePath}
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