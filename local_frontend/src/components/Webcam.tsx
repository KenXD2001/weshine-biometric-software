import React, { useRef, useEffect, useState, useCallback } from 'react';

interface WebcamProps {
  onCapture: (imageDataUrl: string) => void;
  isActive: boolean;
  captureRef?: React.MutableRefObject<(() => void) | null>;
}

const Webcam: React.FC<WebcamProps> = ({ onCapture, isActive, captureRef }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string>('');
  const [isHttpMode, setIsHttpMode] = useState(false);

  const checkEnvironment = useCallback(() => {
    const isHttps = window.location.protocol === 'https:';
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (!isHttps && !isLocalhost) {
      setIsHttpMode(true);
      return false;
    }
    return true;
  }, []);

  const startWebcam = useCallback(async () => {
    console.log('🎥 [Webcam] Starting webcam...');
    console.log('🎥 [Webcam] Environment check:', {
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      isHttps: window.location.protocol === 'https:',
      isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    });
    
    try {
      setError('');
      
      // OVERRIDE: Skip environment check for HTTP testing
      
      // Check if mediaDevices is available
      console.log('🎥 [Webcam] Checking mediaDevices availability...');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('🎥 [Webcam] mediaDevices not available:', {
          mediaDevices: !!navigator.mediaDevices,
          getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
          navigator: !!navigator,
          userAgent: navigator.userAgent
        });
        
        // Provide more specific error based on what's missing
        if (!navigator.mediaDevices) {
          throw new Error('Camera access not available. This usually happens on HTTP connections. Please use HTTPS or Chrome with --unsafely-treat-insecure-origin-as-secure flag.');
        } else {
          throw new Error('Camera API not supported in this browser. Please use a modern browser like Chrome, Firefox, Safari, or Edge.');
        }
      }

      console.log('🎥 [Webcam] Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920, max: 3840 },
          height: { ideal: 1080, max: 2160 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: 'user'
        },
        audio: false
      });

      console.log('🎥 [Webcam] Camera access granted, stream obtained:', stream);
      console.log('🎥 [Webcam] Stream tracks:', stream.getTracks());

      if (videoRef.current) {
        console.log('🎥 [Webcam] Setting stream to video element...');
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);
        console.log('🎥 [Webcam] Webcam started successfully!');
      } else {
        console.error('🎥 [Webcam] Video ref is null');
      }
    } catch (err) {
      console.error('🎥 [Webcam] Error accessing webcam:', err);
      console.log('🎥 [Webcam] Error details:', {
        name: err instanceof Error ? err.name : 'Unknown',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : 'No stack trace'
      });
      
      let errorMessage = 'Unable to access webcam.';
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          errorMessage = 'Camera access denied. Please allow camera permissions and try again.';
          console.log('🎥 [Webcam] Permission denied by user');
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'No camera found. Please connect a camera and try again.';
          console.log('🎥 [Webcam] No camera device found');
        } else if (err.name === 'NotReadableError') {
          errorMessage = 'Camera is already in use by another application.';
          console.log('🎥 [Webcam] Camera already in use');
        } else {
          errorMessage = err.message || 'Unknown error occurred while accessing webcam.';
          console.log('🎥 [Webcam] Other error:', err.message);
        }
      }
      
      setError(errorMessage);
      setIsStreaming(false);
      console.log('🎥 [Webcam] Webcam start failed');
    }
  }, []);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  const capture = useCallback(() => {
    console.log('📸 [Webcam] Capture button clicked');
    console.log('📸 [Webcam] Capture state check:', {
      videoRef: !!videoRef.current,
      canvasRef: !!canvasRef.current,
      isStreaming,
      videoReady: videoRef.current ? videoRef.current.readyState : 'no video'
    });

    if (videoRef.current && canvasRef.current && isStreaming) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      console.log('📸 [Webcam] Video dimensions:', {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        clientWidth: video.clientWidth,
        clientHeight: video.clientHeight
      });

      if (context) {
        console.log('📸 [Webcam] Drawing video frame to canvas...');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        console.log('📸 [Webcam] Converting canvas to high-quality data URL...');
        // Use lossless format for highest quality capture from webcam.
        const imageDataUrl = canvas.toDataURL('image/png');
        console.log('📸 [Webcam] Image captured, data URL length:', imageDataUrl.length);
        console.log('📸 [Webcam] Data URL preview:', imageDataUrl.substring(0, 100) + '...');
        
        onCapture(imageDataUrl);
        console.log('📸 [Webcam] Capture completed, callback called');
      } else {
        console.error('📸 [Webcam] Could not get canvas context');
      }
    } else {
      console.warn('📸 [Webcam] Cannot capture - prerequisites not met:', {
        hasVideo: !!videoRef.current,
        hasCanvas: !!canvasRef.current,
        isStreaming
      });
    }
  }, [onCapture, isStreaming]);

  // Expose capture function through ref
  useEffect(() => {
    if (captureRef) {
      captureRef.current = isStreaming ? capture : null;
    }
  }, [captureRef, capture, isStreaming]);

  useEffect(() => {
    console.log('🎥 [Webcam] useEffect triggered:', {
      isActive,
      isHttpMode,
      isHttpEnvironment: !checkEnvironment()
    });
    
    // Check environment on mount
    const isHttpEnvironment = !checkEnvironment();
    
    // Only auto-start if not in HTTP mode AND isActive is true
    // OVERRIDE: Allow webcam on HTTP for testing
    if (isActive) {
      console.log('🎥 [Webcam] OVERRIDE: Allowing webcam on HTTP for testing...');
      startWebcam();
    } else if (!isActive) {
      console.log('🎥 [Webcam] isActive is false, stopping webcam...');
      stopWebcam();
    } else {
      console.log('🎥 [Webcam] Webcam not starting - conditions not met:', {
        isActive,
        isHttpEnvironment,
        isHttpMode,
        shouldStart: isActive && !isHttpEnvironment && !isHttpMode
      });
    }

    return () => {
      console.log('🎥 [Webcam] Cleanup - stopping webcam...');
      stopWebcam();
    };
  }, [isActive, isHttpMode, startWebcam, stopWebcam, checkEnvironment]);

  if (!isActive) {
    return null;
  }

  return (
    <div className="relative w-full h-full">
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 rounded-lg">
          <div className="text-center p-4">
            <div className="mb-3">
              <svg className="w-12 h-12 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-red-600 text-sm font-medium mb-2">Camera Error</p>
            <p className="text-red-500 text-xs mb-3 max-w-xs">{error}</p>
            {isHttpMode && (
              <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-3">
                <p className="text-blue-700 text-xs font-medium mb-1">HTTP Limitations:</p>
                <ul className="text-blue-600 text-xs text-left space-y-1">
                  <li>• Camera access may be blocked</li>
                  <li>• Use Chrome with --unsafely-treat-insecure-origin-as-secure flag</li>
                  <li>• Or run on localhost/HTTPS</li>
                </ul>
              </div>
            )}
            <div className="space-y-2">
              <button
                onClick={startWebcam}
                className="px-3 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors w-full"
              >
                Retry
              </button>
              <button
                onClick={() => setError('')}
                className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300 transition-colors w-full"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
      
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-contain rounded-lg ${!isStreaming ? 'hidden' : ''}`}
      />
      
      {!isStreaming && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600 text-sm">Starting webcam...</p>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="hidden"
      />
    </div>
  );
};

export default Webcam;
