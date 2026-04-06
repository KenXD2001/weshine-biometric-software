export interface LoginResponse {
  successful: boolean;
  message: string;
  data: {
    api_token: string;
    user: UserData;
    centreCode?: string;
    centreName?: string;
  };
}

export interface UserData {
  id: string;
  name: string;
  email: string;
  mobile: string;
  countryCode: string;
  role: string;
  centreCode?: string;
  centreName?: string;
}
