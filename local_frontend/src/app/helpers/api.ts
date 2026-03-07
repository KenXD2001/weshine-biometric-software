import { Logout, useAuth } from '../modules/auth'
import { API_URL } from './constants'
import { logger } from './logger'
import Swal from "sweetalert2";

type OptionsType = {
  headers: {
    'Content-Type'?: string
    'x-api-token'?: string
  }
  method?: string
  body?: string | FormData | undefined
}

// const API_KEY = "7ea26935-e635-45fb-b4e8-f25314a027db";

export const fetchRequest = async (
  url: string,
  method?: string,
  body?: string | FormData | undefined,
  multipart?: string
) => {
  logger.info(`API Request: ${method || 'GET'} ${url}`, {
    hasBody: !!body,
    isMultipart: !!multipart,
    url: `${API_URL}${url}`
  });

  const token = localStorage.getItem("authToken");
  const options: OptionsType = {
    headers: {}
  }

  if (!multipart) {
    options['headers']['Content-Type'] = 'application/json; charset=utf-8'
  }

  if (method) {
    options['method'] = method
  }

  if (body) {
    options['body'] = body
  }

  // options.headers['x-api-token'] = '50a813d0-ebff-4c46-abd1-cd71396c6b9a'
  // options.headers['x-api-key'] = API_KEY;

   if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_URL}${url}`, options)
    
    logger.info(`API Response: ${res.status} ${res.statusText}`, {
      url: `${API_URL}${url}`,
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries())
    });

 if (!res.ok) {
    logger.error(`API Error: ${res.status} ${res.statusText}`, {
      url: `${API_URL}${url}`,
      status: res.status,
      statusText: res.statusText
    });

    if (res.status === 401 || res.status === 403) {
      logger.warn('Authentication error - redirecting to login');
      Swal.fire({
        icon: 'error',
        title: 'Session Expired',
        text: 'Your session has expired or you are not authorized. Please log in again.',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'OK'
      }).then(() => {
        handleUnauthorized(); 
      });
      return;
    }
  }

  const data = await res.json();
  logger.debug('API Response data received', { 
    url: `${API_URL}${url}`,
    dataKeys: Object.keys(data),
    dataSize: JSON.stringify(data).length
  });
  
  return data;
  } catch (error) {
    logger.error(`API Request failed: ${error.message}`, {
      url: `${API_URL}${url}`,
      method: method || 'GET',
      error: error.message
    });
    throw error;
  }
}

export const uploadCandidateZIP = async (file: File | string) => {
  logger.info('Starting candidate ZIP upload', {
    fileName: typeof file === 'string' ? file : file.name,
    fileSize: typeof file === 'string' ? 'string' : file.size,
    fileType: typeof file === 'string' ? 'string' : file.type
  });

  const formData = new FormData()
  formData.append('file', file)
  formData.append('fileType', 'ZIP')

  try {
    const result = await fetchRequest(
      '/api/upload/file?fileType=ZIP',
      'POST',
      formData,
      'multi'
    );
    
    logger.success('Candidate ZIP upload completed', {
      success: result?.successful,
      message: result?.message
    });
    
    return result;
  } catch (error) {
    logger.error('Candidate CSV upload failed', {
      error: error.message,
      fileName: typeof file === 'string' ? file : file.name
    });
    throw error;
  }
}

export const uploadCapturedImage = async (file: File | string, hallTicket: string, matchPercentage: number) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('fileType', 'IMAGE')

  return await fetchRequest(
    `/api/upload/file?fileType=IMAGE&hallTicket=${hallTicket}&matchPercentage=${matchPercentage}`,
    'POST',
    formData,
    'multi'
  )
}

export const deallocateSeat = async (hallTicket: string) => {
  return await fetchRequest(
    `/api/lab-seating/deallocate/seat/${hallTicket}`,
    'POST'
  )
}

export const allocateSeat = async (hallTicket: string) => {
  return await fetchRequest(`/api/lab-seating/v2/allocate/seat/${hallTicket}`, 'POST');
};

export const getLabDetails = async () => {
  return await fetchRequest(`/api/lab-seating/client-registration-lab`)
}

export const submitBiometricString = async (body: {
  biometricData: string
  hallTicket: string
}) => {
  return await fetchRequest(
    `/api/biometric-details/submit-biometric-string`,
    'POST',
    JSON.stringify(body)
  )
}

export const submitFaceCapture = async (body: {
  faceData: string
  hallTicket: string
  matchPercentage?: number
  captureTimestamp?: string
}) => {
  return await fetchRequest(
    `/api/biometric-details/submit-face-capture`,
    'POST',
    JSON.stringify(body)
  )
}

export const submitThumbCapture = async (body: {
  thumbData: string
  hallTicket: string
  captureTimestamp?: string
  secugenApiResponse?: any
}) => {
  return await fetchRequest(
    `/api/biometric-details/submit-thumb-capture`,
    'POST',
    JSON.stringify(body)
  )
}

export const biometricDetailsDelete = async (hallTicket: string) => {
  return await fetchRequest(`/api/biometric-details/delete/${hallTicket}`, 'POST')
}

export const biometricDetails = async (hallTicket: string) => {
  return await fetchRequest(`/api/biometric-details/${hallTicket}`)
}

export const labDetails = async () => {
  return await fetchRequest('/api/lab-details')
}

export const labDetailsByHallTicket = async (hallTicket: string) => {
  return await fetchRequest(`/api/lab-details/${hallTicket}`)
}

export const labDetailsCandidateSeatingDetails = async (examId: number, examSlot: string) => {
  const response =  await fetchRequest(`/api/lab-seating/view-generated-hall-ticket-list?examId=${examId}&examSlot=${examSlot}`)
  console.log(response);
  
  return response
}

export const labDetailsCandidateSeatingDetailsCount = async (examId: string, examSlot: string) => {
  const response = await fetchRequest(`/api/lab-details/candidate-seating-details?examId=${examId}&examSlot=${examSlot}`)
  return response
}


export const allCandidateDetails = async (hallTicket: string) => {
  return await fetchRequest(
    `/api/candidate-details/all?hallTicket=${hallTicket}`
  )
}

export const filterCandidateDetails = async (filters?: object) => {
  if (filters) {
    const queryParams = new URLSearchParams(Object.entries(filters)).toString()
    return await fetchRequest(`/api/candidate-details/all/filters?${queryParams}`)
  } else {
    return await fetchRequest(`/api/candidate-details/all/filters`)
  }
}

export const filterCandidateDetailsCount = async (examId: number, examSlot: string) => {
  const candidates = await fetchRequest(`/api/candidate-details/counts?examId=${examId}&examSlot=${examSlot}`)
  return candidates
}

export const getCentreInfo = async () => {
  return await fetchRequest(`/api/candidate-details/centre-info`)
}

export const examCenterByCode = async (examCode: string) => {
  return await fetchRequest(`/api/exam-centre/${examCode}`)
}

export const downloadJson = async (examId: number, examSlot: string) => {
  const token = localStorage.getItem("authToken");

  return await fetch(
    `${API_URL}/api/lab-seating/export-json?examId=${examId}&examSlot=${encodeURIComponent(examSlot)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/octet-stream",
        Authorization: `Bearer ${token}`,
      },
    }
  );
};

export const matchCandidateSlotWise = async (examSlot: string, hallTicket: string) => {
  return await fetchRequest(`/api/candidate-details/match?examSlot=${examSlot}&hallTicket=${hallTicket}`)
}

export const userLogout= async (url: string) => {
  return await fetchRequest(`${url}`)
}

export const handleUnauthorized = () => {
  localStorage.clear();
  window.location.href = '/auth/login'; 
};

export const resetSystem = async () => {
  return await fetchRequest('/api/upload/reset-system', 'POST')
};

