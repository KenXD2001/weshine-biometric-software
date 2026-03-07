const BASE_URL = 'https://localhost:8443'
const CAPTURE_URI = `${BASE_URL}/SGIFPCapture`
const INFO_URI = `${BASE_URL}/SGIFPGetData`

/**
 * Get SecuGen device information
 */
export const GetDeviceInfo = async () => {
    try {
        const response = await fetch(INFO_URI, { 
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=UTF-8'
            },
            body: JSON.stringify({ Timeout: 5000 })
        })
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        return result
    } catch (error) {
        console.error('SecuGen device info error:', error)
        return {
            ErrorCode: 55,
            error: error.message
        }
    }
}

/**
 * Capture fingerprint from SecuGen device
 */
export const CaptureFinger = async () => {
    const params = {
        Quality: 90,
        Timeout: 10000
    }

    try {
        const response = await fetch(CAPTURE_URI, { 
            method: 'POST', 
            headers: {
                'Content-Type': 'text/plain;charset=UTF-8'
            },
            body: JSON.stringify(params) 
        })
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        return result
    } catch (error) {
        console.error('SecuGen capture error:', error)
        // Return error in expected format
        return {
            ErrorCode: 55, // Device not connected error code
            error: error.message
        }
    }
}

/**
 * Match two fingerprint templates (if needed in future)
 */
export const MatchFingerprints = async (template1: string, template2: string) => {
    try {
        const response = await fetch(`${BASE_URL}/SGIMatchScore`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=UTF-8'
            },
            body: JSON.stringify({
                Template1: template1,
                Template2: template2
            })
        })
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        return result
    } catch (error) {
        console.error('SecuGen match error:', error)
        return {
            ErrorCode: 55,
            error: error.message
        }
    }
}