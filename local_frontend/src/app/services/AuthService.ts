import axios from "axios";
import { AuthModel } from "../modules/auth";
import { API_URL } from "../helpers/constants";




export const LOGIN_URL = `${API_URL}/api/user/login`;


export function loginUser(username: string, password: string) {
    return axios.post<AuthModel>(LOGIN_URL, {
        username,
        password,
    },
        {
            headers: {
                // "x-api-key": "7ea26935-e635-45fb-b4e8-f25314a027db",
            },

        });
}


