import React, { useCallback, useRef, useState, useEffect } from "react";
import {
  allCandidateDetails,
  allocateSeat,
  filterCandidateDetailsCount,
  getCentreInfo,
  labDetailsCandidateSeatingDetailsCount,
  submitFaceCapture,
  submitThumbCapture,
  resetSystem,
} from "../helpers/api";
import { toast } from "sonner";
import * as faceapi from "face-api.js";
import type Webcam from "react-webcam";
import Swal from "sweetalert2";
import { CaptureFinger } from "../helpers/secugen";
import { HeaderSection } from "./components/biometric-system/HeaderSection";
import { UploadCandidateData } from "./UploadCandidateData";
import { ExaminationDetailsSection } from "./components/biometric-system/ExaminationDetailsSection";
import { BiometricDetailsSection } from "./components/biometric-system/BiometricDetailsSection";
import { SessionDetailsSection } from "./components/biometric-system/SessionDetailsSection";
import { CandidateDetailsSection } from "./components/biometric-system/CandidateDetailsSection";
import { ApplicationLogsSection } from "./components/biometric-system/ApplicationLogsSection";
import type {
  CenterValues,
  CandidateDetails,
} from "./components/biometric-system/types";


interface FingerprintResponse {
  ErrorCode?: number;
  ImageQuality?: string;
  NFIQ?: number;
  BMPBase64?: string;
}

interface ApiResponse {
  successful: boolean;
  message?: string;
  error?: string;
  data?: {
    centreInfo?: {
      code: string;
      name: string;
      examSlot: string;
    };
    successfulCount?: number;
    examId?: string;
    examDate?: string[];
    sessions?: string[];
    centreName?: string;
    hasCandidates?: boolean;
    centreCode?: string;
    date?: string;
    session?: string;
    hallTicket?: string;
    userExamApplicationId?: string;
    candidateName?: string;
    emailId?: string;
    gender?: string;
    image?: string;
    signature?: string;
    liveImage?: string;
    [key: string]: unknown;
  };
  candidateCounts?: number;
  allocatedCount?: number;
}

interface CountResponse {
  candidateCounts?: number;
  allocatedCount?: number;
}

interface CentreInfoResponse {
  successful: boolean;
  data: {
    hasCandidates: boolean;
    centreCode: string;
    centreName: string;
    date: string;
    examDate: string[];
    sessions: string[];
    session: string;
  };
}

interface ResetSystemResponse {
  successful: boolean;
  message?: string;
  data: {
    candidatesCleared: number;
    deletedFiles: number;
    deletedFolders: number;
  };
}

const BiometricSystem: React.FC = () => {
  const [showUploadCandidateDataModal, setShowUploadCandidateDataModal] = useState<boolean>(false);
  const [isMatchBiometricEnabled, setIsMatchBiometricEnabled] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [applicationLog, setApplicationLog] = useState("");
  const [disabledAll, setDisabledAll] = useState<boolean>(true); // ADDED: missing state

  const handleUploadSuccess = async (result: ApiResponse) => {
    if (result.successful && result.data?.centreInfo) {
      const centreInfo = result.data.centreInfo;
      let extractedSlot = "";
      if (centreInfo.examSlot) {
        const parts = centreInfo.examSlot.split(' ');
        extractedSlot = parts.length > 1 ? parts[1] : parts[0];
        localStorage.setItem("examSlot", extractedSlot);
      }
      setCenterValues({
        centreCode: centreInfo.code || "",
        centreName: centreInfo.name || "",
        date: "",
        examDate: [],
        sessions: [],
        session: extractedSlot,
      });
      setDisabledAll(false);
      setApplicationLog("Candidate data loaded! Enter Application Number to start biometric verification");
      toast.success(
        `Loaded ${result.data.successfulCount} candidates from ${centreInfo.name} (${centreInfo.code})`
      );
      getCount();
    }
  };

  const initialCenterValues: CenterValues = {
    centreCode: "",
    centreName: "",
    date: "",
    examDate: [],
    sessions: [],
    session: "",
  };

  useEffect(() => {
    // Try to get centreCode and centreName from localStorage (set at login)
    const centreCode = localStorage.getItem("centreCode") || "";
    const centreName = localStorage.getItem("centreName") || "";
    if (centreCode && centreName) {
      setCenterValues((prev) => ({
        ...prev,
        centreCode,
        centreName
      }));
      setDisabledAll(false);
      setApplicationLog("Start entering Application Number to start registration");
    } else {
      setDisabledAll(true);
      setApplicationLog("Upload candidate data to begin");
    }
  }, []);

  const [centerValues, setCenterValues] = useState<CenterValues>(initialCenterValues);

  const initialValues: CandidateDetails = {
    hallTicket: "",
    userExamApplicationId: "",
    candidateName: "",
    emailId: "",
    gender: "",
    signature: "",
  };

  const [candidateDetails, setCandidateDetails] = useState<CandidateDetails>(initialValues);

  // ADDED: handleInputChange function
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCandidateDetails((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (candidateDetails.hallTicket && e.key === "Enter") {
      const details = await allCandidateDetails(candidateDetails.hallTicket) as ApiResponse;

      setCapturedImage(null);
      if (details.successful) {
        if (details.data) {
          setApplicationLog("");
          setCandidateDetails((prev) => ({
            ...prev,
            hallTicket: details.data?.hallTicket || prev.hallTicket,
            userExamApplicationId: details.data?.userExamApplicationId || "",
            candidateName: details.data?.candidateName || "",
            emailId: details.data?.emailId || "",
            gender: details.data?.gender || "",
            signature: details.data?.signature || "",
            uploadedImagePath: (details.data?.uploadedImagePath as string) || "",
            liveImagePath: (details.data?.liveImagePath as string) || "",
            capturedImagePath: (details.data?.capturedImagePath as string) || "",
            biometricImagePath: (details.data?.biometricImagePath as string) || "",
          }));
        } else {
          setCandidateDetails(initialValues);
          toast.error("Invalid Application Number. Candidate not found.");
        }
      } else {
        setCandidateDetails(initialValues);
        toast.error(details.message);
      }
    }
  };

  const [startWebcam, setStartWebcam] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [matchColor, setMatchColor] = useState("orange");
  const idCardRef = useRef<HTMLImageElement>(null);
  const selfieRef = useRef<HTMLImageElement>(null);
  const webcamRef = useRef<Webcam>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  const capture = () => {
    const imageSrc = webcamRef?.current?.getScreenshot();
    if (imageSrc) {
      console.log('Captured Face Image');
      setCapturedImage(imageSrc);
      setFaceCaptureTimestamp(new Date().toISOString());
      setApplicationLog('Face image captured successfully. Now capture the thumb.');
      toast.success('Face image captured');
    } else {
      console.log('Image Not Captured');
      toast.error('Failed to capture image');
    }
  };

  const matchBiometric = useCallback(() => {
    (async () => {
      if (!modelsLoaded) {
        toast.error('Face recognition models are still loading. Please wait...');
        return;
      }

      if (!candidateDetails.image || !capturedImage) {
        toast.error('Missing reference or captured image');
        return;
      }

      if (!idCardRef.current || !selfieRef.current) {
        toast.error('Image references not available');
        return;
      }

      try {
        setIsMatching(true);
        const startTime = performance.now();
        console.log('🔍 Starting optimized face matching...');

        const detectionOptions = new faceapi.TinyFaceDetectorOptions({
          inputSize: 224,
          scoreThreshold: 0.5
        });

        console.log('  → Analyzing reference image...');
        const referenceDetection = await faceapi
          .detectSingleFace(idCardRef.current, detectionOptions)
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!referenceDetection) {
          setIsMatching(false);
          toast.error('No face detected in reference image');
          setMatchColor("red");
          setApplicationLog("Error: No face in reference image");
          return;
        }

        console.log('  → Analyzing captured image...');
        const capturedDetection = await faceapi
          .detectSingleFace(selfieRef.current, detectionOptions)
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!capturedDetection) {
          setIsMatching(false);
          toast.error('No face detected in captured image');
          setMatchColor("red");
          setApplicationLog("Error: No face in captured image");
          return;
        }

        console.log('  → Calculating similarity...');
        const distance = faceapi.euclideanDistance(
          referenceDetection.descriptor,
          capturedDetection.descriptor
        );

        const matchPercentage = ((1 - distance) * 100).toFixed(2);
        
        let matchQuality = '';
        if (distance < 0.25) {
          setMatchColor("green");
          matchQuality = '✅ Excellent Match';
        } else if (distance < 0.38) {
          setMatchColor("orange");
          matchQuality = '⚠️ Acceptable Match';
        } else {
          setMatchColor("red");
          matchQuality = '❌ Poor Match';
        }

        const endTime = performance.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        console.log(`✅ Match completed in ${duration}s: ${matchPercentage}% (${matchQuality})`);
        setApplicationLog(`${matchQuality} - ${matchPercentage}% | Time: ${duration}s`);

        const faceResult = await submitFaceCapture({
          faceData: capturedImage,
          hallTicket: candidateDetails.hallTicket,
          matchPercentage: parseFloat(matchPercentage)
        }) as ApiResponse;

        if (faceResult.successful) {
          toast.success(`Face captured: ${matchPercentage}% match`);
          console.log('✅ Face capture submitted and marked as Completed');
        } else {
          toast.error(faceResult.message || 'Face capture failed');
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ Face matching error:', error);
        toast.error('Face matching failed: ' + errorMessage);
        setMatchColor("red");
        setApplicationLog(`Error: ${errorMessage}`);
      } finally {
        setIsMatching(false);
      }
    })();
  }, [candidateDetails.image, capturedImage, modelsLoaded, candidateDetails.hallTicket]);

  const [bitmapImage, setBitmapImage] = useState("");
  // Store complete Secugen API response
  const [secugenApiResponse, setSecugenApiResponse] = useState<any>(null);
  // Store capture timestamps
  const [faceCaptureTimestamp, setFaceCaptureTimestamp] = useState<string | null>(null);
  const [thumbCaptureTimestamp, setThumbCaptureTimestamp] = useState<string | null>(null);

  const captureFingerprint = async () => {
    const res: FingerprintResponse = await CaptureFinger();
    console.log('Fingerprint capture response:', res);
    
    // Store the complete Secugen API response
    setSecugenApiResponse(res);
    
    if (res.ErrorCode === 0) {
      setDeviceConnected(true);
      const thumbData = "data:image/png;base64," + res.BMPBase64;
      setBitmapImage(thumbData);
      setThumbCaptureTimestamp(new Date().toISOString());
      setApplicationLog(`Thumb captured successfully - Quality: ${res.ImageQuality}, NFIQ: ${res.NFIQ}. Click Submit to send both images.`);
      toast.success('Thumb captured successfully');
      console.log('✅ Thumb image captured');
    } else {
      setDeviceConnected(false);
      if (res.ErrorCode === 55) {
        setApplicationLog(`Error ${res.ErrorCode}: Device Not Connected or SSL Certificate not accepted`);
      } else {
        setApplicationLog(`Error ${res.ErrorCode}: Failed to capture thumb`);
      }
      toast.error('Failed to capture thumb');
    }
  };

  const [deviceConnected, setDeviceConnected] = useState(false);

  const testDeviceConnection = async () => {
    setApplicationLog("Testing device connection...");
    try {
      const response = await fetch('https://localhost:8443/SGIFPCapture', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8'
        },
        body: JSON.stringify({ Quality: 90, Timeout: 5000 })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.ErrorCode === 0) {
          setDeviceConnected(true);
          setApplicationLog("✅ Device connected successfully!");
          toast.success("Device connected!");
        } else if (data.ErrorCode === 51) {
          setDeviceConnected(true);
          setApplicationLog("✅ Device API accessible (place finger and try capture)");
          toast.success("Device API is working! Ready to capture.");
        } else {
          setApplicationLog(`⚠️ Device responded with ErrorCode: ${data.ErrorCode}`);
          toast.warning(`Device error: ${data.ErrorCode}`);
        }
      }
    } catch (error) {
      setDeviceConnected(false);
      setApplicationLog("❌ Cannot connect to device. Please accept SSL certificate.");
      toast.error("Click here to open certificate page", {
        duration: 10000,
        action: {
          label: 'Open',
          onClick: () => window.open('https://localhost:8443/SGIFPCapture', '_blank')
        }
      });
    }
  };

  const resetDetails = () => {
    setCandidateDetails(initialValues);
    setCapturedImage(null);
    setStartWebcam(false);
    setMatchColor("orange");
    setApplicationLog("Ready for next candidate");
    setBitmapImage("");
    console.log('🔄 All fields reset - ready for new candidate');
  };

  const handleSystemReset = async () => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      html: `
        <div style="text-align: left; margin: 20px 0;">
          <p style="margin-bottom: 15px; font-weight: 600; color: #d33;">This action will permanently delete:</p>
          <ul style="list-style-position: inside; color: #333;">
            <li>All uploaded candidate data (JSON files)</li>
            <li>All candidate images (photos, live images, captured images, fingerprints)</li>
            <li>All biometric data and records</li>
          </ul>
          <p style="margin-top: 15px; font-weight: 600; color: #2c5282;">Note: Centre information will be preserved. System logs will NOT be deleted.</p>
          <p style="margin-top: 15px; font-weight: 600; color: #d33;">You will need to upload the candidate data again to continue.</p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, reset system',
      cancelButtonText: 'Cancel',
      width: '600px',
      customClass: {
        htmlContainer: 'text-start'
      }
    });

    if (result.isConfirmed) {
      try {
        Swal.fire({
          title: 'Resetting System...',
          html: 'Please wait while we delete all data.',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        const response = await resetSystem() as ResetSystemResponse;

        if (response.successful) {
          resetDetails();
          setCenterValues(initialCenterValues);
          setDisabledAll(true);
          setApplicationLog("System reset completed. Please upload candidate data to continue.");
          
          localStorage.removeItem('examId');
          localStorage.removeItem('examSlot');
          localStorage.removeItem('examDate');
          // Preserve stored centre values (centreCode/centreName) across reset

          Swal.fire({
            title: 'Success!',
            html: `
              <p>System has been reset successfully.</p>
              <p style="margin-top: 10px; color: #2c5282;">
                <strong>Deleted:</strong><br/>
                • ${response.data.candidatesCleared} candidate(s)<br/>
                • ${response.data.deletedFiles} file(s)<br/>
                • ${response.data.deletedFolders} folder(s)
              </p>
            `,
            icon: 'success'
          });

          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          throw new Error(response.message || 'Failed to reset system');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to reset system';
        console.error('System reset error:', error);
        Swal.fire({
          title: 'Error!',
          text: errorMessage || 'Failed to reset system. Please try again.',
          icon: 'error'
        });
      }
    }
  };

  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log('Loading face recognition models...');
        const startTime = performance.now();
        
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        ]);
        
        const endTime = performance.now();
        console.log(`✅ Models loaded in ${((endTime - startTime) / 1000).toFixed(2)}s`);
        setModelsLoaded(true);
      } catch (error) {
        console.error('❌ Failed to load face-api models:', error);
        toast.error('Failed to load face recognition models');
      }
    };
    
    loadModels();
  }, []);

  useEffect(() => {
    const { image } = candidateDetails;
    setIsMatchBiometricEnabled(
      !!(image && capturedImage && modelsLoaded)
    );
  }, [candidateDetails, capturedImage, modelsLoaded]);

  const [isLoading, setIsLoading] = useState(false);

  const allocate = async () => {

    if (!capturedImage || !bitmapImage) {
      toast.error("Please capture both face and thumb before submitting");
      return;
    }

    try {
      setIsLoading(true);
      
      // First, submit face capture
      const faceResult = await submitFaceCapture({
        faceData: capturedImage,
        hallTicket: candidateDetails.hallTicket,
        captureTimestamp: faceCaptureTimestamp || new Date().toISOString()
      }) as ApiResponse;

      if (!faceResult.successful) {
        toast.error(faceResult.message || 'Face capture submission failed');
        setIsLoading(false);
        return;
      }

      // Then, submit thumb capture
      const thumbResult = await submitThumbCapture({
        thumbData: bitmapImage,
        hallTicket: candidateDetails.hallTicket,
        captureTimestamp: thumbCaptureTimestamp || new Date().toISOString(),
        secugenApiResponse: secugenApiResponse
      }) as ApiResponse;

      if (!thumbResult.successful) {
        toast.error(thumbResult.message || 'Thumb capture submission failed');
        setIsLoading(false);
        return;
      }

      // Finally, allocate seat
      const response = await allocateSeat(candidateDetails.hallTicket) as ApiResponse;

      if (response.successful) {
        toast.success("Biometric verification completed successfully!");
        console.log('✅ Biometric data submitted and seat allocated');
        
        resetDetails();
        
        getCount();
      } else {
        toast.error(response.message || "Seat allocation failed");
      }
    } catch (error) {
      toast.error("An error occurred during submission.");
    } finally {
      setIsLoading(false);
    }
  };

  const [totalCandidates, setTotalCandidates] = useState(0);
  const getTotalCandidatesCount = async () => {
    const examId = parseInt(localStorage.getItem("examId") || "0", 10);
    const examSlot = localStorage.getItem("examSlot") || "";
    const result = await filterCandidateDetailsCount(examId, examSlot) as CountResponse;
    setTotalCandidates(result.candidateCounts || 0);
  };


  const [totalAllotedCandidates, setTotalAllotedCandidates] = useState(0);
  const getTotalAllotedCandidatesCount = async () => {
    const exam = parseInt(localStorage.getItem("examId") || "0", 10);
    const examId = exam.toString();
    const examSlot = localStorage.getItem("examSlot") || "";
    const result = await labDetailsCandidateSeatingDetailsCount(examId, examSlot) as CountResponse;
    setTotalAllotedCandidates(result.allocatedCount || 0);
  };

  useEffect(() => {
    const loadInitialData = async () => {
      getTotalCandidatesCount();
      getTotalAllotedCandidatesCount();
      
      try {
        const centreInfoResponse = await getCentreInfo() as CentreInfoResponse;
        if (centreInfoResponse.successful && centreInfoResponse.data.hasCandidates) {
          const info = centreInfoResponse.data;
          setCenterValues({
            centreCode: info.centreCode || '',
            centreName: info.centreName || '',
            date: info.date || '',
            examDate: info.examDate || [],
            sessions: info.sessions || [],
            session: info.session || '',
          });
          
          if (info.session) {
            localStorage.setItem("examSlot", info.session);
          }
          
          console.log('✅ Centre info restored from backend:', info);
        }
      } catch (error) {
        console.error('Failed to load centre info:', error);
      }
    };
    
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getCount = () => {
    getTotalCandidatesCount();
    getTotalAllotedCandidatesCount();
  };

  return (
    <div>
      <HeaderSection onUploadCandidateData={() => setShowUploadCandidateDataModal(true)} />
      <div className="container cus-container">
        <div className="body">
          <div className="row">
            <div className="col-lg-12">
              <div className="row">
                <div className="col-lg-7 cs-card-pd">
                  <ExaminationDetailsSection
                    centerValues={centerValues}
                  />
                  <BiometricDetailsSection
                    candidateDetails={candidateDetails}
                    startWebcam={startWebcam}
                    capturedImage={capturedImage}
                    bitmapImage={bitmapImage}
                    disabledAll={disabledAll}
                    deviceConnected={deviceConnected}
                    webcamRef={webcamRef}
                    idCardRef={idCardRef}
                    selfieRef={selfieRef}
                    onStartWebcam={() => setStartWebcam(true)}
                    onCaptureImage={capture}
                    onCaptureFingerprint={captureFingerprint}
                    onTestDeviceConnection={testDeviceConnection}
                  />
                </div>
                <div className="col-lg-5 cs-card-pd">
                  <SessionDetailsSection
                    totalCandidates={totalCandidates}
                    totalAllotedCandidates={totalAllotedCandidates}
                  />
                  <CandidateDetailsSection
                    disabledAll={disabledAll}
                    candidateDetails={candidateDetails}
                    isLoading={isLoading}
                    onInputChange={handleInputChange}
                    onHallTicketKeyDown={handleKeyDown}
                    onResetDetails={resetDetails}
                    onSubmit={allocate}
                    onSystemReset={handleSystemReset}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <UploadCandidateData
        show={showUploadCandidateDataModal}
        onClose={() => setShowUploadCandidateDataModal(false)}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
};

export { BiometricSystem };