import React from "react";

interface HeaderSectionProps {
  onUploadCandidateData: () => void;
}

const HeaderSection: React.FC<HeaderSectionProps> = ({ onUploadCandidateData }) => {
  return (
    <div className="upload-btn-div">
      <button className="btn btn-primary candi-upload-btn" onClick={onUploadCandidateData}>
        Upload Candidate Data
      </button>
    </div>
  );
};

export { HeaderSection };
