import React, { useState, useCallback } from 'react';
import { Check, RefreshCw, AlertCircle, Signature, Fingerprint, Image } from 'lucide-react';
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
  };
  isCandidateLoaded: boolean;
  uploadedImagePath: string; // Candidate uploaded photo path
  signatureImagePath: string; // Candidate signature image path
  biometricImagePath: string;
  handleCapture: (
    type: "signature" | "uploaded" | "thumb",
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
  isCandidateLoaded,
  handleCapture: handleCaptureProp,
}) => {
  const [isTestingDevice, setIsTestingDevice] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<{
    connected: boolean;
    message: string;
  } | null>(null);

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

  const uploadedPhotoUrl = resolveApiAsset(uploadedImagePath);
  const signatureImageUrl = resolveApiAsset(signatureImagePath);
  // Check if biometricImagePath contains base64 data (for thumb captures)
  const biometricImageUrl = biometricImagePath.startsWith('data:') ? biometricImagePath : resolveApiAsset(biometricImagePath);

  const handleCaptureDebug = useCallback(
    (
      type: "signature" | "uploaded" | "thumb",
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

      {/* 3 Grid Column */}
      <div className="grid grid-cols-3 gap-2 p-3 pt-0 rounded-b-xl">
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
              console.log('[BiometricDetails] Capture Thumb click', {
                isCandidateLoaded,
                deviceStatus,
                biometricImagePath,
              });
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