export interface CenterValues {
  centreCode: string;
  centreName: string;
  date: string;
  examDate: string[];
  sessions: string[];
  session: string;
}

export interface CandidateDetails {
  hallTicket: string;
  userExamApplicationId: string;
  candidateName: string;
  emailId: string;
  gender: string;
  signature: string;
  uploadedImagePath?: string;
  liveImagePath?: string;
  capturedImagePath?: string;
  biometricImagePath?: string;
}
