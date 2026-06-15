import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Check, RefreshCw, AlertCircle, Signature, Fingerprint, Image, Camera, Video, VideoOff } from 'lucide-react';
import Button from './ui/Button';
import { biometricService } from "../services/api";

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

interface BiometricDetailsProps {
  capturedImages: {
    signature: boolean;
    uploaded: boolean;
    thumb: boolean;
    webcam: boolean;
  };
  isCandidateLoaded: boolean;
  uploadedImagePath: string;
  signatureImagePath: string;
  biometricImagePath: string;
  webcamImagePath: string;
  handleCapture: (
    type: "signature" | "uploaded" | "thumb" | "webcam",
    imageData?: string,
    templateData?: { isoTemplateBase64?: string; templateBase64?: string },
    captureTimestamp?: string,
    deviceApiResponse?: BiometricDeviceApiResponse
  ) => void;
}

const BiometricDetails: React.FC<BiometricDetailsProps> = ({
  capturedImages,
  uploadedImagePath,
  signatureImagePath,
  biometricImagePath,
  webcamImagePath,
  isCandidateLoaded,
  handleCapture: handleCaptureProp,
}) => {
  const [isTestingDevice, setIsTestingDevice] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<{
    connected: boolean;
    message: string;
  } | null>(null);
  const [isWebcamOn, setIsWebcamOn] = useState(false);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const resolveApiAsset = (path: string) => {
    if (!path) return '';

    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    const baseUrl = import.meta.env.VITE_API_URL.replace(/\/$/, '');
    const dataBaseUrl = baseUrl.replace(/\/api$/, '');

    let normalizedPath = path;
    if (!normalizedPath.startsWith('/')) normalizedPath = `/${normalizedPath}`;

    if (normalizedPath.startsWith('/data')) {
      return `${dataBaseUrl}${normalizedPath}`;
    }

    if (normalizedPath.startsWith('/api') || normalizedPath.startsWith('/uploads')) {
      return `${baseUrl}${normalizedPath}`;
    }

    return `${baseUrl}/api/upload/images${normalizedPath}`;
  };

  const uploadedPhotoUrl = resolveApiAsset(uploadedImagePath);
  const signatureImageUrl = resolveApiAsset(signatureImagePath);
  const biometricImageUrl = biometricImagePath.startsWith('data:') ? biometricImagePath : resolveApiAsset(biometricImagePath);
  const capturedWebcamUrl = webcamImagePath.startsWith('data:') ? webcamImagePath : resolveApiAsset(webcamImagePath);

  const handleCaptureDebug = useCallback(
    (
      type: "signature" | "uploaded" | "thumb" | "webcam",
      imageData?: string,
      templateData?: { isoTemplateBase64?: string; templateBase64?: string },
      captureTimestamp?: string,
      deviceApiResponse?: BiometricDeviceApiResponse
    ) => {
      handleCaptureProp(type, imageData, templateData, captureTimestamp, deviceApiResponse);
    },
    [handleCaptureProp]
  );

  const handleThumbCapture = useCallback(async () => {
    try {
      const result = await biometricService.captureThumb();
      if (!result.success) {
        console.warn('[BiometricDetails] Thumb capture failed', result.message);
        return;
      }

      const imageData = result.imageData;
      if (!imageData) {
        console.warn('[BiometricDetails] Thumb capture returned no image data');
        return;
      }

      handleCaptureDebug(
        'thumb',
        imageData,
        {
          isoTemplateBase64: result.deviceInfo?.IsoTemplate as string,
          templateBase64: result.deviceInfo?.AnsiTemplate as string
        },
        new Date().toISOString(),
        result.deviceInfo as BiometricDeviceApiResponse
      );
    } catch (error) {
      console.error('Thumb capture error:', error);
    }
  }, [handleCaptureDebug]);

  // Attach stream to video element whenever it becomes available (runs after every render)
  useEffect(() => {
    const stream = webcamStreamRef.current;
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  });

  const handleTurnOnWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      });
      webcamStreamRef.current = stream;
      setIsWebcamOn(true);
    } catch (error) {
      console.error('Webcam access error:', error);
    }
  }, []);

  const handleTurnOffWebcam = useCallback(() => {
    const stream = webcamStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      webcamStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsWebcamOn(false);
  }, []);

  // Cleanup webcam on unmount
  useEffect(() => {
    return () => {
      const stream = webcamStreamRef.current;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCaptureWebcam = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/jpeg');
    handleCaptureDebug('webcam', imageData, undefined, new Date().toISOString());
  }, [handleCaptureDebug]);

  const handleTestDevice = async () => {
    setIsTestingDevice(true);
    setDeviceStatus(null);
    
    try {
      const result = await biometricService.testBiometricDevice();
      setDeviceStatus(result);
    } catch {
      setDeviceStatus({
        connected: false,
        message: 'Device test failed. Please try again.'
      });
    } finally {
      setIsTestingDevice(false);
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200/50 shadow-lg shadow-gray-200/25 hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-center gap-3 bg-blue-950 rounded-t-xl mb-3">
        <div className="p-2">
          <Fingerprint className="h-5 w-5 text-white" />
        </div>
        <h2 className="text-lg font-bold text-white">
          Biometric Details
        </h2>
      </div>

      <div className="grid grid-cols-5 gap-2 p-3 pt-0 rounded-b-xl">
        {/* Uploaded Photo */}
        <div className="flex flex-col items-center">
          <div className="w-full bg-slate-100 rounded-xl px-2 py-3 transition-all duration-300">
            <span className="text-xs text-gray-800 text-center font-bold uppercase mb-2 block">
              Uploaded Photo
            </span>
            <div
              className={`aspect-square w-full rounded-lg flex items-center justify-center transition-all duration-300 ${
                uploadedPhotoUrl
                  ? "bg-white border-2 border-slate-300 shadow-lg"
                  : "bg-white border-2 border-dashed border-gray-300 hover:border-gray-400"
              }`}
            >
              {uploadedPhotoUrl ? (
                <img src={uploadedPhotoUrl} alt="Uploaded Photo" className="h-full w-full object-contain rounded-lg" />
              ) : capturedImages.uploaded ? (
                <Check className="h-20 w-20 text-white" />
              ) : (
                <Image className="h-20 w-20 text-gray-400" />
              )}
            </div>
          </div>
        </div>

        {/* Signature */}
        <div className="flex flex-col items-center">
          <div className="w-full bg-blue-100 rounded-xl px-2 py-3 transition-all duration-300">
            <span className="text-xs text-gray-800 text-center font-bold uppercase mb-2 block">
              Signature
            </span>
            <div
              className={`aspect-square w-full rounded-lg flex items-center justify-center transition-all duration-300 ${
                signatureImageUrl
                  ? "bg-white border-2 border-blue-300 shadow-lg"
                  : "bg-white border-2 border-dashed border-gray-300 hover:border-gray-400"
              }`}
            >
              {signatureImageUrl ? (
                <img src={signatureImageUrl} alt="Signature" className="h-full w-full object-contain rounded-lg" />
              ) : capturedImages.signature ? (
                <Check className="h-20 w-20 text-white" />
              ) : (
                <Signature className="h-20 w-20 text-gray-400" />
              )}
            </div>
          </div>
          <Button
            onClick={handleTestDevice}
            variant={deviceStatus?.connected ? "success" : (deviceStatus?.connected === false ? "danger" : "gray")}
            size="sm"
            fullWidth
            disabled={isTestingDevice}
            className="mt-3"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isTestingDevice ? 'animate-spin' : ''}`} />
            {isTestingDevice ? 'Testing...' : 
             deviceStatus?.connected ? 'Device Connected' : 
             deviceStatus?.connected === false ? 'Device Not Connected' : 
             'Test Device'}
          </Button>
          
          {deviceStatus && !deviceStatus.connected && (
            <div className="mt-2 p-2 rounded-lg text-xs text-center bg-red-100 text-red-700 border border-red-200">
              <div className="flex items-center justify-center gap-1 mb-1">
                <AlertCircle className="h-3 w-3" />
                <span className="font-semibold">Device Not Connected</span>
              </div>
              <p className="text-xs">{deviceStatus.message}</p>
            </div>
          )}
        </div>

        {/* Webcam View */}
        <div className="flex flex-col items-center">
          <div className="w-full bg-amber-100 rounded-xl px-2 py-3 transition-all duration-300">
            <span className="text-xs text-gray-800 text-center font-bold uppercase mb-2 block">
              Webcam View
            </span>
            <div
              className={`aspect-square w-full rounded-lg flex items-center justify-center transition-all duration-300 ${
                isWebcamOn
                  ? "bg-black border-2 border-amber-500"
                  : capturedWebcamUrl
                    ? "bg-white border-2 border-amber-300 shadow-lg"
                    : "bg-white border-2 border-dashed border-gray-300 hover:border-gray-400"
              }`}
            >
              {isWebcamOn ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="h-full w-full object-contain rounded-lg"
                />
              ) : capturedWebcamUrl ? (
                <img src={capturedWebcamUrl} alt="Captured Webcam" className="h-full w-full object-contain rounded-lg" />
              ) : (
                <Camera className="h-20 w-20 text-gray-400" />
              )}
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
          {!isWebcamOn && (
            <Button
              onClick={handleTurnOnWebcam}
              variant="success"
              size="sm"
              fullWidth
              className="mt-3"
            >
              <Video className="h-3.5 w-3.5" />
              Turn On Webcam
            </Button>
          )}
          {isWebcamOn && (
            <Button
              onClick={handleTurnOffWebcam}
              variant="danger"
              size="sm"
              fullWidth
              className="mt-3"
            >
              <VideoOff className="h-3.5 w-3.5" />
              Turn Off Webcam
            </Button>
          )}
        </div>

        {/* Captured Webcam */}
        <div className="flex flex-col items-center">
          <div className="w-full bg-green-100 rounded-xl px-2 py-3 transition-all duration-300">
            <span className="text-xs text-gray-800 text-center font-bold uppercase mb-2 block">
              Captured Webcam
            </span>
            <div
              className={`aspect-square w-full rounded-lg flex items-center justify-center transition-all duration-300 ${
                capturedWebcamUrl
                  ? "bg-white border-2 border-green-300 shadow-lg"
                  : "bg-white border-2 border-dashed border-gray-300 hover:border-gray-400"
              }`}
            >
              {capturedWebcamUrl ? (
                <img src={capturedWebcamUrl} alt="Captured Webcam" className="h-full w-full object-contain rounded-lg" />
              ) : (
                <Camera className="h-20 w-20 text-gray-400" />
              )}
            </div>
          </div>
          {isWebcamOn && !capturedWebcamUrl && (
            <Button
              onClick={handleCaptureWebcam}
              variant="primary"
              size="sm"
              fullWidth
              className="mt-3"
            >
              <Camera className="h-3.5 w-3.5" />
              Capture Webcam
            </Button>
          )}
          {isWebcamOn && capturedWebcamUrl && (
            <Button
              onClick={handleCaptureWebcam}
              variant="primary"
              size="sm"
              fullWidth
              className="mt-3"
            >
              <Camera className="h-3.5 w-3.5" />
              Recapture
            </Button>
          )}
          {!isWebcamOn && capturedWebcamUrl && (
            <Button
              onClick={handleTurnOnWebcam}
              variant="success"
              size="sm"
              fullWidth
              className="mt-3"
            >
              <Video className="h-3.5 w-3.5" />
              Retake Webcam
            </Button>
          )}
        </div>

        {/* Captured Thumb */}
        <div className="flex flex-col items-center">
          <div className="w-full bg-purple-100 rounded-xl px-2 py-3 transition-all duration-300">
            <span className="text-xs text-gray-800 text-center font-bold uppercase mb-2 block">
              Captured Thumb
            </span>
            <div
              className={`aspect-square w-full rounded-lg flex items-center justify-center transition-all duration-300 ${
                biometricImageUrl
                  ? "bg-white border-2 border-purple-300 shadow-lg"
                  : "bg-white border-2 border-dashed border-gray-300 hover:border-gray-400"
              }`}
            >
              {biometricImageUrl ? (
                <img src={biometricImageUrl} alt="Biometric" className="h-full w-full object-contain rounded-lg" />
              ) : (
                <Fingerprint className="h-20 w-20 text-gray-400" />
              )}
            </div>
          </div>
          <Button
            onClick={() => {
              handleThumbCapture();
            }}
            variant="primary"
            size="sm"
            fullWidth
            className="mt-3"
            disabled={!(deviceStatus?.connected && isCandidateLoaded)}
          >
            <Fingerprint className="h-3.5 w-3.5" />
            Capture Thumb
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BiometricDetails;