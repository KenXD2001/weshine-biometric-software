import axios from "axios";
import { AuthModel } from "../modules/auth";

const API_URL = import.meta.env.VITE_APP_API_CENTRAL_URL;

const API_KEY = "7ea26935-e635-45fb-b4e8-f25314a027db";

function getAuthHeaders() {
  const token = localStorage.getItem("authToken");
  if (token) {
    return {
      "Authorization": `Bearer ${token}`,
      "x-api-key": API_KEY,
    };
  } else {
    throw new Error('No token found in localStorage');
  }
}

export function userLogout(url: string) {
  return axios.get(`${API_URL}${url}`, {
    headers: getAuthHeaders(), 
  });
  
}




