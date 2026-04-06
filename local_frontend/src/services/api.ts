import type { LoginResponse } from '../types/auth';

type SecuGenApiResponse = {
  ISOTemplateBase64?: string;
  TemplateBase64?: string;
  CaptureTime?: string;
  ErrorCode?: number;
  BMPBase64?: string;
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
  testSecugenDevice: async (): Promise<{ connected: boolean; message: string; deviceInfo?: Record<string, unknown> }> => {
    try {
      // SecuGen WebAPI runs on HTTPS localhost:8443
      // The correct endpoint is /SGIFPCapture based on testing
      // SSL certificate will be invalid for localhost
      const response = await fetch('https://localhost:8443/SGIFPCapture', {
        method: 'GET',
        // Ignore SSL certificate for localhost
        mode: 'cors'
      });

      if (response.ok) {
        const deviceInfo = await response.json();
        return {
          connected: true,
          message: 'SecuGen device is connected and working properly',
          deviceInfo
        };
      } else {
        return {
          connected: false,
          message: 'SecuGen device is not responding correctly'
        };
      }
    } catch (error: unknown) {
      console.error('SecuGen device test error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check for common error types
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connection refused')) {
        return {
          connected: false,
          message: 'SecuGen device service is not running. Please start the device service.'
        };
      } else if (errorMessage.includes('SSL') || errorMessage.includes('certificate')) {
        return {
          connected: false,
          message: 'SSL certificate error. Please check device configuration.'
        };
      } else {
        return {
          connected: false,
          message: `Device test failed: ${errorMessage}`
        };
      }
    }
  },

  captureThumb: async (): Promise<{ success: boolean; message: string; imageData?: string; deviceInfo?: Record<string, unknown> }> => {
    try {
      // SecuGen WebAPI runs on HTTPS localhost:8443
      // Use the correct SGIFPCapture endpoint for fingerprint capture
      const response = await fetch('https://localhost:8443/SGIFPCapture', {
        method: 'GET',
        // Ignore SSL certificate for localhost
        mode: 'cors'
      });

      if (response.ok) {
        const result = await response.json();
        console.log('🖐️ [API] Thumb capture response:', result);
        
        // Check if response contains actual fingerprint data
        // The API might return different field names
        const imageData = result.fingerprintData || result.imageData || result.BMPBase64 || result.TemplateBase64;
        
        return {
          success: true,
          message: 'Fingerprint captured successfully',
          imageData: imageData,
          deviceInfo: result
        };
      } else {
        return {
          success: false,
          message: 'Failed to capture fingerprint'
        };
      }
    } catch (error: unknown) {
      console.error('Fingerprint capture error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false,
        message: `Fingerprint capture failed: ${errorMessage}`
      };
    }
  },

  submitFaceCapture: async (hallTicket: string, faceData: string, captureTimestamp?: string): Promise<{ successful: boolean; message: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/biometric-details/submit-face-capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hallTicket,
          faceData,
          captureTimestamp: captureTimestamp || new Date().toISOString()
        })
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to submit face capture');
      }

      return await response.json();
    } catch (error: unknown) {
      console.error('Face submit error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { successful: false, message: `Face submit failed: ${errorMessage}` };
    }
  },

  submitThumbCapture: async (hallTicket: string, thumbData: string, isoTemplateBase64?: string, templateBase64?: string, captureTimestamp?: string, secugenApiResponse?: SecuGenApiResponse): Promise<{ successful: boolean; message: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/biometric-details/submit-thumb-capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hallTicket,
          thumbData,
          ISOTemplateBase64: isoTemplateBase64 || null,
          TemplateBase64: templateBase64 || null,
          secugenApiResponse: secugenApiResponse || null,
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

  captureFace: async (): Promise<{ success: boolean; message: string; imageData?: string; deviceInfo?: Record<string, unknown> }> => {
    try {
      // Use the correct backend endpoint for face capture
      const response = await fetch('http://10.5.48.253:5000/api/submit-face-capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('👤 [API] Face capture response:', result);
        
        // Check if the response contains actual face data
        const imageData = result.faceCaptureData || result.imageData || result.BMPBase64 || result.TemplateBase64;
        
        return {
          success: true,
          message: 'Face captured successfully',
          imageData: imageData,
          deviceInfo: result
        };
      } else {
        return {
          success: false,
          message: 'Failed to capture face'
        };
      }
    } catch (error: unknown) {
      console.error('Face capture error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false,
        message: `Face capture failed: ${errorMessage}`
      };
    }
  }
};

// Re-export types for convenience
export type { LoginResponse };
