import React from "react";
import Webcam from "react-webcam";
import type { CandidateDetails } from "./types";
import { API_URL } from "../../../helpers/constants";

interface BiometricDetailsSectionProps {
  candidateDetails: CandidateDetails;
  startWebcam: boolean;
  capturedImage: string | null;
  bitmapImage: string;
  disabledAll: boolean;
  deviceConnected: boolean;
  webcamRef: React.RefObject<Webcam | null>;
  idCardRef: React.RefObject<HTMLImageElement | null>;
  selfieRef: React.RefObject<HTMLImageElement | null>;
  onStartWebcam: () => void;
  onCaptureImage: () => void;
  onCaptureFingerprint: () => void;
  onTestDeviceConnection: () => void;
}

const BiometricDetailsSection: React.FC<BiometricDetailsSectionProps> = ({
  candidateDetails,
  startWebcam,
  capturedImage,
  bitmapImage,
  disabledAll,
  deviceConnected,
  webcamRef,
  idCardRef,
  selfieRef,
  onStartWebcam,
  onCaptureImage,
  onCaptureFingerprint,
  onTestDeviceConnection,
}) => {
  return (
    <>
      <div className="cus-card">
        <div className="card-title card-title-color p-2 m-0">
          <h3 className="fw-bolder m-0 text-white text-center">Biometric Details</h3>
        </div>
        <div className="row">
          <div className="col-lg-12">
            <div className="row cus-card-inner">
              <div className="col-lg-2 mt-1 text-center col-lg-2-cus">
                <label className="fw-bold bg-live-image w-100">Signature</label>
                <div className="custom-biometric-input-field">
                  {candidateDetails.liveImagePath ? (
                    <img
                      className="camera-img-cont"
                      src={`${API_URL}${candidateDetails.liveImagePath}`}
                      alt="Signature"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <i className="fa-solid fa-signature biometric-icons" />
                  )}
                </div>
              </div>
              <div className="col-lg-2 mt-1 text-center col-lg-2-cus">
                <label className="fw-bold bg-warning w-100">Uploaded Image</label>
                <div className="custom-biometric-input-field">
                  {candidateDetails.uploadedImagePath ? (
                    <img
                      ref={idCardRef}
                      className="camera-img-cont"
                      src={`${API_URL}${candidateDetails.uploadedImagePath}`}
                      alt="Candidate Image"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <i className="fa-solid fa-image-portrait biometric-icons" />
                  )}
                </div>
              </div>
              <div className="col-lg-2 mt-1 text-center col-lg-2-cus">
                <label className="fw-bold bg-camera-view w-100">Camera View</label>
                <div className="custom-biometric-input-field">
                  {startWebcam ? (
                    <Webcam width="100%" height="100%" ref={webcamRef} screenshotFormat="image/png" />
                  ) : (
                    <i className="fa-solid fa-video biometric-icons" />
                  )}
                </div>

                <button className="btn btn-primary cus-biometric-btn mt-2" onClick={onStartWebcam} disabled={!candidateDetails.candidateName}>
                  Start WebCam
                </button>
              </div>
              <div className="col-lg-2 mt-1 text-center col-lg-2-cus">
                <label className="fw-bold bg-capture-image w-100">Live Image</label>
                <div className="custom-biometric-input-field">
                  {capturedImage ? (
                    <img width="100%" height="100%" ref={selfieRef} src={capturedImage} alt="Live Image" />
                  ) : (
                    <i className="fa-solid fa-image-portrait biometric-icons" />
                  )}
                </div>
                <button className="btn btn-primary cus-biometric-btn mt-2" onClick={onCaptureImage} disabled={!candidateDetails.candidateName}>
                  Capture Image
                </button>
              </div>
              <div className="col-lg-2 mt-1 text-center col-lg-2-cus">
                <label className="fw-bold bg-thumb w-100">Captured Thumb</label>
                <div className="custom-biometric-input-field">
                  {bitmapImage ? (
                    <img
                      width="100%"
                      height="100%"
                      style={{ objectFit: "contain" }}
                      src={bitmapImage}
                      alt="Fingerprint Image"
                    />
                  ) : (
                    <i className="fa-solid fa-fingerprint biometric-icons" />
                  )}
                </div>
                <button className="btn btn-primary cus-biometric-btn mt-2" onClick={onCaptureFingerprint} disabled={!candidateDetails.candidateName}>
                  Capture Thumb
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="cus-card">
        <div className="row">
          <div className="col-lg-12">
            <div className="row cus-card-inner">
              <div className="col-lg-4 text-center cus-flex">
                <div className="camera-btn-main">
                  <i
                    className="fa-solid fa-fingerprint camera-icon"
                    style={{
                      color: `${deviceConnected ? "green" : "gray"}`,
                    }}
                  ></i>
                  <button className="btn btn-primary device-camera-btn" onClick={onTestDeviceConnection} title="Test device connection">
                    Test Device
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export { BiometricDetailsSection };
