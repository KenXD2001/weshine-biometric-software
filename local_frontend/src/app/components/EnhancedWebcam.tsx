// Enhanced Webcam Configuration
const WEBCAM_CONFIG = {
  width: 1280,        // HD width
  height: 720,         // HD height  
  screenshotFormat: "image/jpeg", // JPEG for better compression
  screenshotQuality: 0.9,     // 90% quality
  facingMode: "user",          // Front-facing camera
  frameRate: 30,               // Smooth video
  minScreenshotHeight: 720,    // Minimum quality threshold
};

// Enhanced Capture Function with Quality Checks
const captureWithQualityCheck = async () => {
  try {
    const imageSrc = webcamRef?.current?.getScreenshot();
    
    if (!imageSrc) {
      toast.error('Failed to capture image');
      return null;
    }

    // Validate image dimensions
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      
      if (width < WEBCAM_CONFIG.minScreenshotHeight || height < WEBCAM_CONFIG.minScreenshotHeight) {
        toast.error(`Image resolution too low: ${width}x${height}. Minimum: ${WEBCAM_CONFIG.minScreenshotHeight}p`);
        return null;
      }
      
      // Check image file size (rough estimate)
      const base64Size = Math.round((imageSrc.length * 3) / 4);
      if (base64Size < 50000) { // Less than ~50KB suggests poor quality
        toast.error('Image quality appears too low. Please ensure good lighting and focus.');
        return null;
      }
      
      console.log(`✅ Image captured: ${width}x${height}, ~${Math.round(base64Size/1024)}KB`);
      setCapturedImage(imageSrc);
      setFaceCaptureTimestamp(new Date().toISOString());
      toast.success('High-quality image captured');
    };
    
    img.onerror = () => {
      toast.error('Failed to process captured image');
    };
    
    img.src = imageSrc;
    
  } catch (error) {
    console.error('Capture error:', error);
    toast.error('Camera capture failed');
    return null;
  }
};

// Enhanced Webcam Component
<Webcam 
  {...WEBCAM_CONFIG}
  ref={webcamRef}
  audio={false}
  mirrored={true}
  screenshotQuality={WEBCAM_CONFIG.screenshotQuality}
/>
