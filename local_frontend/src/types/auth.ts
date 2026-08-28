export interface LoginResponse {
  successful: boolean;
  message: string;
  data: {
    api_token: string;
    user: UserData;
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
