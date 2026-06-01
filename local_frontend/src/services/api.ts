import type { LoginResponse } from '../types/auth';

type BiometricDeviceApiResponse = {
  ISOTemplateBase64?: string;
  TemplateBase64?: string;
  CaptureTime?: string;
  ErrorCode?: number;
  BMPBase64?: string;
  fingerprintData?: string;
  imageData?: string;
  faceCaptureData?: string;
  [key: string]: unknown;
};

type SyncStatusData = {
  isRunning: boolean;
  lastSync?: string;
  totalCandidates: number;
  syncedCandidates: number;
  pendingCandidates: number;
  failedCandidates: number;
  [key: string]: unknown;
};

type SyncResultData = {
  totalLocalCandidates: number;
  totalCloudCandidates: number;
  totalSynced: number;
  totalUpdated: number;
  totalAlreadyLocal: number;
  totalMissingInCloud: number;
  totalFailed: number;
  totalDownloadedImages: number;
  totalDownloadSizeKB: string;
  processingTime: string;
  cloudProcessingTime: string;
  details: Array<{
    hallTicket: string;
    hasBiometricInCloud: boolean;
    synced: boolean;
    updated: boolean;
    alreadyLocal: boolean;
    failed: boolean;
    notes: string[];
  }>;
  [key: string]: unknown;
};

type CentreInfoData = {
  centreCode: string;
  centreName: string;
  examDate: string;
  cityName?: string;
  examSlot: string;
  [key: string]: unknown;
};

const API_BASE_URL = import.meta.env.VITE_API_URL;

if (!API_BASE_URL) {
  throw new Error('VITE_API_URL environment variable is not set. Please check your .env file.');
}

export const API_ENDPOINTS = {
  LOGIN: '/auth/login',
  UPLOAD: '/upload/file',
  CANDIDATE_COUNTS: '/candidate-details/counts',
  SYNC_STATUS: '/sync/status',
  SYNC_TRIGGER: '/sync/trigger-immediate',
  // Add other endpoints as needed
} as const;

export const createApiUrl = (endpoint: string) => {
  return `${API_BASE_URL}${endpoint}`;
};

const BIOMETRIC_DEVICE_CAPTURE_URL = import.meta.env.VITE_BIOMETRIC_DEVICE_CAPTURE_URL || 'http://localhost:8004/mfs100/capture';
const BIOMETRIC_DEVICE_TEST_URL = import.meta.env.VITE_BIOMETRIC_DEVICE_TEST_URL || 'http://localhost:8004/mfs100/info';

const normalizeBase64Image = (rawData?: string | null) => {
  if (!rawData) return null;
  if (rawData.startsWith('data:')) return rawData;

  return `data:image/png;base64,${rawData}`;
};

const parseBiometricDeviceResponse = (result: Record<string, unknown>) => {
  // Parse MFS100 API response format
  const imageFields = [
    'BitmapData',
    'IsoImage',
    'WsqImage',
    'RawData',
    'BMPBase64',
    'bmpBase64',
    'ImageData',
    'imageData'
  ];

  const rawImage = imageFields
    .map(key => result[key] as string | undefined)
    .find(Boolean) || null;

  const templateFields = {
    isoTemplateBase64: (result.IsoTemplate as string | undefined)
      || (result.ISOTemplateBase64 as string | undefined)
      || undefined,
    templateBase64: (result.AnsiTemplate as string | undefined)
      || (result.TemplateBase64 as string | undefined)
      || undefined
  };

  return {
    imageData: normalizeBase64Image(rawImage),
    templateData: templateFields,
    deviceInfo: result
  };
};

// API service functions
export const authService = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await fetch(createApiUrl(API_ENDPOINTS.LOGIN), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    return response.json();
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('isAuthenticated');
  },
  
  getToken: () => localStorage.getItem('token'),
  
  getUser: () => {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  },
  
  isAuthenticated: () => !!localStorage.getItem('token'),
};

// Upload service functions
export const uploadService = {
  uploadCandidateData: async (file: File, uploadMode: 'replace' | 'merge' = 'replace'): Promise<{ successful: boolean; message: string; data?: unknown }> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const token = authService.getToken();
    const response = await fetch(createApiUrl(`${API_ENDPOINTS.UPLOAD}?fileType=ZIP&uploadMode=${uploadMode}`), {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Upload failed');
    }
    
    return response.json();
  },

  resetSystem: async (): Promise<{ successful: boolean; message: string; data?: unknown }> => {
    const response = await fetch(createApiUrl('/upload/reset-system'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Reset system failed');
    }

    return response.json();
  },
};

// Candidate service functions
export const candidateService = {
  getCandidateCounts: async (centreCode: string): Promise<{ successful: boolean; candidateCounts?: { total: number; completed: number; pending: number; failed: number }; message?: string }> => {
    const response = await fetch(createApiUrl(`${API_ENDPOINTS.CANDIDATE_COUNTS}?centreCode=${centreCode}`));
    
    if (!response.ok) {
      throw new Error('Failed to fetch candidate counts');
    }
    
    return response.json();
  },

  getCentreInfo: async (): Promise<{ successful: boolean; data?: CentreInfoData; message?: string }> => {
    const response = await fetch(createApiUrl('/candidate-details/centre-info'));

    if (!response.ok) {
      throw new Error('Failed to fetch centre info');
    }

    return response.json();
  },
};

export const syncService = {
  getSyncStatus: async (): Promise<{ successful: boolean; data: SyncStatusData; message?: string }> => {
    const response = await fetch(createApiUrl(API_ENDPOINTS.SYNC_STATUS));
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to fetch sync status');
    }
    return response.json();
  },

  triggerImmediateSync: async (): Promise<{ successful: boolean; data: SyncResultData; message?: string }> => {
    const response = await fetch(createApiUrl(API_ENDPOINTS.SYNC_TRIGGER), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to trigger sync');
    }
    return response.json();
  }
};

// Biometric device service functions
export const biometricService = {
  testBiometricDevice: async (): Promise<{ connected: boolean; message: string; deviceInfo?: Record<string, unknown> }> => {
    try {
      // MFS100 API uses GET request to info endpoint for device status
      const response = await fetch(BIOMETRIC_DEVICE_TEST_URL, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const deviceInfo = await response.json();
        const errorCode = String(deviceInfo?.ErrorCode || deviceInfo?.errorCode || '').trim();
        const errorDescription = String(deviceInfo?.ErrorDescription || deviceInfo?.errorDescription || '').trim();

        if (errorCode === '0') {
          return {
            connected: true,
            message: 'Mantra MFS100 device is connected and working properly',
            deviceInfo
          };
        }

        return {
          connected: false,
          message: errorDescription || 'Device is not responding correctly',
          deviceInfo
        };
      }

      if (response.status === 404) {
        return {
          connected: false,
          message: 'MFS100 service not found. Please ensure the service is running on port 8004.'
        };
      }

      return {
        connected: false,
        message: 'Device is not responding correctly'
      };
    } catch (error: unknown) {
      console.error('Biometric device test error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connection refused')) {
        return {
          connected: false,
          message: 'Cannot connect to MFS100 service. Please ensure: 1) Device is connected, 2) Service is running on localhost:8004, 3) Drivers are installed.'
        };
      }

      if (errorMessage.includes('SSL') || errorMessage.includes('certificate')) {
        return {
          connected: false,
          message: 'SSL certificate error. Please check device configuration.'
        };
      }

      return {
        connected: false,
        message: `Device test failed: ${errorMessage}`
      };
    }
  },

  captureThumb: async (): Promise<{ success: boolean; message: string; imageData?: string; deviceInfo?: Record<string, unknown> }> => {
    try {
      // MFS100 API requires POST request with specific payload
      const capturePayload = {
        Quality: 60,
        TimeOut: 10
      };

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(BIOMETRIC_DEVICE_CAPTURE_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(capturePayload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Device capture failed with status:', response.status, errorText);
        
        if (response.status === 400) {
          return {
            success: false,
            message: 'Invalid capture request. Please check device configuration.'
          };
        }
        
        if (response.status === 404) {
          return {
            success: false,
            message: 'Device service not found. Please ensure Mantra MFS100 service is running on port 8004.'
          };
        }
        
        return {
          success: false,
          message: `Device returned error: ${response.status} ${errorText}`
        };
      }

      const result = await response.json();
      console.log('???? [API] Thumb capture response:', result);
      const parsed = parseBiometricDeviceResponse(result as Record<string, unknown>);

      if (!parsed.imageData) {
        console.warn('Device response missing image data:', result);
        return {
          success: false,
          message: 'Device responded without usable fingerprint data. Please ensure finger is properly placed on scanner.',
          deviceInfo: result as Record<string, unknown>
        };
      }

      return {
        success: true,
        message: 'Fingerprint captured successfully',
        imageData: parsed.imageData,
        deviceInfo: parsed.deviceInfo
      };
    } catch (error: unknown) {
      console.error('Fingerprint capture error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connection refused')) {
        return {
          success: false,
          message: 'Cannot connect to Mantra MFS100 service. Please ensure: 1) Mantra device is connected, 2) MFS100 service is running on localhost:8004, 3) Device drivers are installed.'
        };
      }
      
      if (errorMessage.includes('timeout')) {
        return {
          success: false,
          message: 'Capture timeout. Please try again and ensure finger remains on scanner during capture.'
        };
      }

      return {
        success: false,
        message: `Fingerprint capture failed: ${errorMessage}`
      };
    }
  },

  submitThumbCapture: async (applicationNumber: string, thumbData: string, isoTemplateBase64?: string, templateBase64?: string, captureTimestamp?: string, deviceApiResponse?: BiometricDeviceApiResponse, slot?: string, userExamApplicationId?: string): Promise<{ successful: boolean; message: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/biometric-details/submit-thumb-capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          applicationNumber,
          thumbData,
          slot: slot || null,
          userExamApplicationId: userExamApplicationId || null,
          capturedThumbIsoTemplate: isoTemplateBase64 || null,
          capturedThumbAnsiTemplate: templateBase64 || null,
          deviceApiResponse: deviceApiResponse || null,
          captureTimestamp: captureTimestamp || new Date().toISOString()
        })
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to submit thumb capture');
      }

      return await response.json();
    } catch (error: unknown) {
      console.error('Thumb submit error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { successful: false, message: `Thumb submit failed: ${errorMessage}` };
    }
  },

};

// Re-export types for convenience
export type { LoginResponse };
