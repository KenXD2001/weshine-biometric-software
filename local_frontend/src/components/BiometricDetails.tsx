import React, { useState, useCallback, useRef } from 'react';
import { Check, Play, Square, RefreshCw, AlertCircle, ImageUp, ImageDown, Signature, Fingerprint, Webcam } from 'lucide-react';
import Button from './ui/Button';
import WebcamComponent from './Webcam';
import { biometricService } from "../services/api";
import { useToast } from '../hooks/useToast';

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
    camera: boolean;
    live: boolean;
    thumb: boolean;
  };
  isWebcamActive: boolean;
  isCandidateLoaded: boolean;
  uploadedImagePath: string; // This is the signature image (signature.jpg)
  liveImagePath: string; // This is the candidate photo (photo.jpg)
  biometricImagePath: string;
  capturedImage: string; // For captured webcam images
  galleryTemplateBase64?: string;
  onMatchStatusChange?: (status: 'success' | 'failed' | 'pending' | 'not-applicable' | 'unknown') => void;
  handleCapture: (
    type: "signature" | "uploaded" | "camera" | "live" | "thumb",
    imageData?: string,
    templateData?: { isoTemplateBase64?: string; templateBase64?: string },
    captureTimestamp?: string,
    deviceApiResponse?: BiometricDeviceApiResponse
  ) => void;
  handleWebcamToggle: () => void;
}

const BiometricDetails: React.FC<BiometricDetailsProps> = ({
  capturedImages,
  isWebcamActive,
  uploadedImagePath,
  liveImagePath,
  biometricImagePath,
  capturedImage,
  isCandidateLoaded,
  galleryTemplateBase64,
  onMatchStatusChange,
  handleCapture: handleCaptureProp,
  handleWebcamToggle: handleWebcamToggleProp,
}) => {
  const [isTestingDevice, setIsTestingDevice] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<{
    connected: boolean;
    message: string;
  } | null>(null);
  const webcamCaptureRef = useRef<(() => void) | null>(null);
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  const resolveApiAsset = (path: string) => {
    if (!path) return '';

    console.log('[BiometricDetails] resolveApiAsset input path:', path);

    if (path.startsWith('http://') || path.startsWith('https://')) {
      console.log('[BiometricDetails] resolveApiAsset direct URL returned:', path);
      return path;
    }

    const baseUrl = import.meta.env.VITE_API_URL.replace(/\/$/, '');
    const dataBaseUrl = baseUrl.replace(/\/api$/, '');

    let normalizedPath = path;
    if (!normalizedPath.startsWith('/')) normalizedPath = `/${normalizedPath}`;

    // If resource is /data path, serve from backend data static route (without extra /api prefix)
    if (normalizedPath.startsWith('/data')) {
      const resolved = `${dataBaseUrl}${normalizedPath}`;
      console.log('[BiometricDetails] resolveApiAsset /data resolved:', resolved);
      return resolved;
    }

    // If resource already has /api or /uploads prefix, use directly.
    if (normalizedPath.startsWith('/api') || normalizedPath.startsWith('/uploads')) {
      return `${baseUrl}${normalizedPath}`;
    }

    // For bare candidate asset paths (e.g., candidates-data/...), route via upload/static endpoint.
    return `${baseUrl}/api/upload/images${normalizedPath}`;
  };

  const uploadedImageUrl = resolveApiAsset(uploadedImagePath); // This is the signature image (signature.jpg)
  const liveImageUrl = resolveApiAsset(liveImagePath); // This is the candidate photo (photo.jpg)
  // Check if biometricImagePath contains base64 data (for thumb captures)
  const biometricImageUrl = biometricImagePath.startsWith('data:') ? biometricImagePath : resolveApiAsset(biometricImagePath);
  const capturedImageUrl = capturedImage.startsWith('data:') ? capturedImage : resolveApiAsset(capturedImage);

  const handleCaptureDebug = useCallback(
    (
      type: "signature" | "uploaded" | "camera" | "live" | "thumb",
      imageData?: string,
      templateData?: { isoTemplateBase64?: string; templateBase64?: string },
      captureTimestamp?: string,
      deviceApiResponse?: BiometricDeviceApiResponse
    ) => {
      handleCaptureProp(type, imageData, templateData, captureTimestamp, deviceApiResponse);
    },
    [handleCaptureProp]
  );

  const handleWebcamToggleDebug = useCallback(() => {
    handleWebcamToggleProp();
  }, [handleWebcamToggleProp]);

  const handleWebcamCapture = useCallback(() => {
    if (webcamCaptureRef.current) {
      webcamCaptureRef.current();
    }
  }, []);

  const handleThumbCapture = useCallback(async () => {
    try {
      const captureResult = await biometricService.captureThumb();
      if (!captureResult.success) {
        toastError('Thumb Capture Failed', captureResult.message);
        console.warn('[BiometricDetails] Thumb capture failed', captureResult.message);
        return;
      }

      const imageData = captureResult.imageData;
      if (!imageData) {
        toastError('Thumb Capture Failed', 'Thumb capture returned no image data. Please try again.');
        console.warn('[BiometricDetails] Thumb capture returned no image data');
        return;
      }

      handleCaptureDebug(
        'thumb',
        imageData,
        {
          isoTemplateBase64: captureResult.deviceInfo?.IsoTemplate as string,
          templateBase64: captureResult.deviceInfo?.AnsiTemplate as string
        },
        new Date().toISOString(),
        captureResult.deviceInfo as BiometricDeviceApiResponse
      );

      if (galleryTemplateBase64) {
        onMatchStatusChange?.('pending');
        const matchResult = await biometricService.matchThumb(galleryTemplateBase64);
        if (!matchResult.success) {
          toastError('Thumb Match Failed', matchResult.message);
          console.warn('[BiometricDetails] Thumb match failed', matchResult.message);
          onMatchStatusChange?.('failed');
        } else if (matchResult.matched) {
          toastSuccess('Thumb Matched', 'Old thumb template matched successfully.');
          onMatchStatusChange?.('success');
        } else {
          toastInfo('Thumb Not Matched', 'The scanned thumb did not match the previous template, but candidate submission can still proceed.');
          onMatchStatusChange?.('failed');
        }
      } else {
        toastSuccess('Thumb Captured', 'Thumb template captured successfully.');
        onMatchStatusChange?.('not-applicable');
      }
    } catch (error) {
      console.error('Thumb capture error:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toastError('Thumb Error', msg);
    }
  }, [handleCaptureDebug, galleryTemplateBase64, toastError, toastInfo, toastSuccess, onMatchStatusChange]);

  const handleTestDevice = async () => {
    setIsTestingDevice(true);
    setDeviceStatus(null);
    
    try {
      const result = await biometricService.testBiometricDevice();
      setDeviceStatus(result);

      if (result.connected) {
        toastSuccess('Device Connected', result.message);
      } else {
        toastError('Device Not Connected', result.message);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Device test failed. Please try again.';
      toastError('Device Test Error', msg);
      setDeviceStatus({
        connected: false,
        message: msg
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

      {/* 5 Grid Column */}
      <div className="grid grid-cols-5 gap-2 p-3 pt-0 rounded-b-xl">
        {/* Signature */}
        <div className="flex flex-col items-center">
          <div className="w-full bg-blue-100 rounded-xl px-2 py-3 transition-all duration-300">
            <span className="text-xs text-gray-800 text-center font-bold uppercase mb-2 block">
              Signature
            </span>
            <div
              className={`aspect-square w-full rounded-lg flex items-center justify-center transition-all duration-300 ${
                uploadedImageUrl
                  ? "bg-white border-2 border-blue-300 shadow-lg"
                  : "bg-white border-2 border-dashed border-gray-300 hover:border-gray-400"
              }`}
            >
              {uploadedImageUrl ? (
                <img src={uploadedImageUrl} alt="Signature" className="h-full w-full object-contain rounded-lg" />
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
          
          {/* Device Status Display */}
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

        {/* Uploaded Image */}
        <div className="flex flex-col items-center">
          <div className="w-full bg-yellow-100 rounded-xl px-2 py-3 transition-all duration-300">
            <span className="text-xs text-gray-800 text-center font-bold uppercase mb-2 block">
              Uploaded Image
            </span>
            <div
              className={`aspect-square w-full rounded-lg flex items-center justify-center transition-all duration-300 ${
                liveImageUrl
                  ? "bg-white border-2 border-yellow-300 shadow-lg"
                  : "bg-white border-2 border-dashed border-gray-300 hover:border-gray-400"
              }`}
            >
              {liveImageUrl ? (
                <img src={liveImageUrl} alt="Candidate Photo" className="h-full w-full object-contain rounded-lg" />
              ) : capturedImages.uploaded ? (
                <Check className="h-20 w-20 text-white" />
              ) : (
                <ImageUp className="h-20 w-20 text-gray-400" />
              )}
            </div>
          </div>
        </div>

        {/* Camera View */}
        <div className="flex flex-col items-center">
          <div className="w-full bg-pink-100 rounded-xl px-2 py-3 transition-all duration-300">
            <span className="text-xs text-gray-800 text-center font-bold uppercase mb-2 block">
              Camera View
            </span>
            <div
              className={`aspect-square w-full rounded-lg overflow-hidden transition-all duration-300 ${
                isWebcamActive
                  ? "bg-gray-900 border-2 border-pink-300 shadow-lg"
                  : "bg-white border-2 border-dashed border-gray-300 hover:border-gray-400"
              }`}
            >
              {isWebcamActive ? (
                <WebcamComponent
                  isActive={isWebcamActive}
                  onCapture={(imageDataUrl) => {
                    // Handle webcam capture for live image
                    handleCaptureDebug('live', imageDataUrl);
                  }}
                  captureRef={webcamCaptureRef}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <Webcam className="h-20 w-20 text-gray-400 mb-2" />
                  <span className="text-gray-400 text-xs">Camera Off</span>
                </div>
              )}
            </div>
          </div>
          <Button
            onClick={handleWebcamToggleDebug}
            variant={isWebcamActive ? "danger" : "primary"}
            size="sm"
            fullWidth
            className="mt-3"
          >
            {isWebcamActive ? (
              <>
                <Square className="h-3.5 w-3.5" />
                Stop Webcam
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Start Webcam
              </>
            )}
          </Button>
        </div>

        {/* Captured Image */}
        <div className="flex flex-col items-center">
          <div className="w-full bg-green-100 rounded-xl px-2 py-3 transition-all duration-300">
            <span className="text-xs text-gray-800 text-center font-bold uppercase mb-2 block">
              Captured Image
            </span>
            <div
              className={`aspect-square w-full rounded-lg flex items-center justify-center transition-all duration-300 ${
                capturedImages.live && capturedImage
                  ? "bg-white border-2 border-green-300 shadow-lg"
                  : "bg-white border-2 border-dashed border-gray-300 hover:border-gray-400"
              }`}
            >
              {capturedImages.live && capturedImage ? (
                <img src={capturedImageUrl} alt="Captured" className="h-full w-full object-contain rounded-lg" />
              ) : capturedImages.live ? (
                <Check className="h-20 w-20 text-white" />
              ) : (
                <ImageDown className="h-20 w-20 text-gray-400" />
              )}
            </div>
          </div>
          <Button
            onClick={() => {
              console.log('[BiometricDetails] Capture Image click', {
                isCandidateLoaded,
                isWebcamActive,
                capturedImages,
                deviceStatus,
              });
              handleWebcamCapture();
            }}
            variant="primary"
            size="sm"
            fullWidth
            className="mt-3"
            disabled={!isCandidateLoaded || !isWebcamActive}
          >
            <ImageDown className="h-3.5 w-3.5" />
            Capture Image
          </Button>
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
              console.log('[BiometricDetails] Capture/Match Thumb click', {
                isCandidateLoaded,
                isWebcamActive,
                deviceStatus,
                capturedImages,
                biometricImagePath,
                hasOldTemplate: Boolean(galleryTemplateBase64)
              });
              handleThumbCapture();
            }}
            variant="primary"
            size="sm"
            fullWidth
            className="mt-3"
            disabled={!(deviceStatus?.connected && capturedImages.live && isCandidateLoaded)}
          >
            <Fingerprint className="h-3.5 w-3.5" />
            {galleryTemplateBase64 ? 'Capture & Match Thumb' : 'Capture Thumb'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BiometricDetails;