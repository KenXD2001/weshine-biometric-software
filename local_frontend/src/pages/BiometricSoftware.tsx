import React, { useState } from 'react';

type SecuGenApiResponse = {
  ISOTemplateBase64?: string;
  TemplateBase64?: string;
  CaptureTime?: string;
  ErrorCode?: number;
  BMPBase64?: string;
  [key: string]: unknown;
};
import ExaminationDetails from '../components/ExaminationDetails';
import BiometricDetails from '../components/BiometricDetails';
import SessionDetails from '../components/SessionDetails';
import CandidateDetails from '../components/CandidateDetails';
import ConfirmDialog from '../components/ConfirmDialog';
import ToastContainer from '../components/Toast/ToastContainer';
import { useToast } from '../hooks/useToast';
import { authService, biometricService, uploadService } from '../services/api';

const BiometricSoftware: React.FC = () => {
  // Get user data for initial state
  const userData = authService.getUser();
  
  const [centreCode, setCentreCode] = useState(userData?.centreCode || '');
  const [centreName, setCentreName] = useState(userData?.centreName || '');
  const [hallTicket, setHallTicket] = useState('');
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
  const [thumbTemplate, setThumbTemplate] = useState({ isoTemplateBase64: '', templateBase64: '' });
  const [thumbCaptureTimestamp, setThumbCaptureTimestamp] = useState('');
  const [secugenApiResponse, setSecugenApiResponse] = useState<SecuGenApiResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toasts, success: toastSuccess, error: toastError, warning: toastWarning, info: toastInfo, removeToast } = useToast();

  const handleCapture = (
    type: 'signature' | 'uploaded' | 'camera' | 'live' | 'thumb',
    imageData?: string,
    templateData?: { isoTemplateBase64?: string; templateBase64?: string },
    captureTimestamp?: string,
    secugenApiResponse?: SecuGenApiResponse
  ) => {
    setCapturedImages(prev => ({ ...prev, [type]: true }));

    if (type === 'thumb' && secugenApiResponse) {
      setSecugenApiResponse(secugenApiResponse);
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

  const handleSubmit = async (submitHallTicket: string) => {
    if (!submitHallTicket.trim()) {
      toastWarning('Missing Hall Ticket', 'Please enter a Hall Ticket and load candidate details before submitting.');
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
        faceResult = await biometricService.submitFaceCapture(submitHallTicket, capturedImage);
      } else {
        toastInfo('No Webcam Capture', 'No captured webcam image available yet.');
      }

      // Submit captured thumb data (from biometricImagePath)
      if (imagePaths.biometricImagePath && imagePaths.biometricImagePath.startsWith('data:')) {
        thumbResult = await biometricService.submitThumbCapture(
          submitHallTicket,
          imagePaths.biometricImagePath,
          thumbTemplate.isoTemplateBase64,
          thumbTemplate.templateBase64,
          thumbCaptureTimestamp,
          secugenApiResponse || undefined
        );
      } else {
        toastInfo('No Thumb Capture', 'No captured thumb data available yet.');
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
    setHallTicket('');
    setCandidateName('');
    setEmail('');
    setGender('');
    setThumb('');
    setCapturedImages({ signature: false, uploaded: false, camera: false, live: false, thumb: false });
    setImagePaths({ uploadedImagePath: '', liveImagePath: '', biometricImagePath: '' });
    setCapturedImage('');
    setThumbTemplate({ isoTemplateBase64: '', templateBase64: '' });
    setThumbCaptureTimestamp('');
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
        setHallTicket('');
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
          setCentreCode={setCentreCode}
          centreName={centreName}
          setCentreName={setCentreName}
        />

        <BiometricDetails
          capturedImages={capturedImages}
          isWebcamActive={isWebcamActive}
          isCandidateLoaded={isCandidateLoaded}
          uploadedImagePath={imagePaths.uploadedImagePath}
          liveImagePath={imagePaths.liveImagePath}
          biometricImagePath={imagePaths.biometricImagePath}
          capturedImage={capturedImage}
          handleCapture={handleCapture}
          handleWebcamToggle={handleWebcamToggle}
        />
      </div>

      {/* Right Section - 40% width */}
      <div className="w-[40%] space-y-2">
        <SessionDetails />

        <CandidateDetails
          hallTicket={hallTicket}
          setHallTicket={setHallTicket}
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
          capturedImages={capturedImages}
          onCandidateLoaded={setIsCandidateLoaded}
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
