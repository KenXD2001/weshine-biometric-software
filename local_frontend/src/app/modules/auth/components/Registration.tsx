import React, { useState } from "react";
import { Link } from "react-router-dom";
import ReCAPTCHA from "react-google-recaptcha";


export function Registration() {
  const [candidateFullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneOtpError, setPhoneOtpError] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showEmailOTPInput, setShowEmailOTPInput] = useState(false);
  const [showPhoneOTPInput, setShowPhoneOTPInput] = useState(false);

  const [recaptchaValue, setRecaptchaValue] = useState("");

  const handleRecaptchaChange = (value: string | null) => {
    if (value) {
      setRecaptchaValue(value);
    }
  };


  const handleEmailChange = (e: {
    target: { value: React.SetStateAction<string> };
  }) => {
    setEmail(e.target.value);
    setEmailError("");
  };

  const openEmailOTP = () => {
    if (!validateEmail(email)) {
      setEmailError("Invalid email address");
    } else {
      setShowEmailOTPInput(true);
    }
  };

  const openPhoneOTP = () => {
    if (!validatePhoneNumber(phoneNumber)) {
      setPhoneOtpError("Invalid phone number");
    } else {
      setShowPhoneOTPInput(true);
    }
  };

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validatePhoneNumber = (number: string) => {
    const re = /^\d{10}$/; // 10-digit validation
    return re.test(number);
  };

  const isButtonDisabled = () => {
    return (
      !candidateFullName ||
      !email ||
      !phoneNumber ||
      !termsAccepted ||
      (showPhoneOTPInput && !phoneOtp) ||
      (showEmailOTPInput && !validateEmail(email))
    );
  };

  const isSendOTPButtonEnabled = (inputValue: string) => {
    return inputValue.trim().length === 10; // Enable if the phone number has 10 digits
  };

  const isValidateButtonEnabled = (inputValue: string) => {
    return inputValue.trim() !== ""; // Check if the input value is not empty
  };

  return (
    <form
      className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework"
      noValidate
      id="kt_login_signup_form"
    >
      <div className="text-center mb-11">
        <h1 className="text-gray-900 fw-bolder mb-3">Create Account</h1>
      </div>

      <div className="fv-row mb-4">
        <label className="form-label fw-bolder text-gray-900 fs-6">
          Candidate's Full Name
        </label>
        <input
          placeholder="Candidate's Name"
          type="text"
          autoComplete="off"
          className="form-control bg-transparent"
          value={candidateFullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>

      <div className="fv-row mb-4">
        <label className="form-label fw-bolder text-gray-900 fs-6">Email</label>
        <div className="otpInput">
          <input
            type="email"
            autoComplete="off"
            placeholder="Enter your email..."
            className="form-control bg-transparent"
            value={email}
            onChange={handleEmailChange}
          />
          <button type="button" onClick={openEmailOTP}>
            Send OTP
          </button>
          <div className='d-flex flex-stack flex-wrap gap-3 fs-base fw-semibold'>
            <div />
            <Link to='/auth/forgot-password' className='link-primary'>
              Resend Otp
            </Link>
          </div>
        </div>

        {emailError && <div className="text-danger">{emailError}</div>}
      </div>

      {showEmailOTPInput && (
        <div className="fv-row mb-4 mt-4">
          <label className="form-label fw-bolder text-gray-900 fs-6">
            Email OTP
          </label>
          <div className="otpInput">
            <input
              type="number"
              placeholder="Enter Email OTP"
              autoComplete="off"
              className="form-control bg-transparent"
              value={phoneOtp}
              onChange={(e) => setPhoneOtp(e.target.value)}
            />
            <button type="button" onClick={openPhoneOTP}>
              Validate
            </button>
          </div>
        </div>
      )}

      <div className="fv-row mb-4 mt-4" data-kt-password-meter="true">
        <div className="mb-1">
          <label className="form-label fw-bolder text-gray-900 fs-6">
            Phone Number
          </label>
          <div className="otpInput">
            <input
              type="number"
              placeholder="Phone Number"
              autoComplete="off"
              className="form-control bg-transparent"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <button
              type="button"
              onClick={openPhoneOTP}
              disabled={!isSendOTPButtonEnabled(phoneNumber)}
            >
              Send OTP
            </button>
          </div>
          <div className='d-flex flex-stack flex-wrap gap-3 fs-base fw-semibold'>
            <div />
            <Link to='' className='link-primary'>
              Resend Otp
            </Link>
          </div>
          {phoneOtpError && <div className="text-danger">{phoneOtpError}</div>}
        </div>
      </div>

      {showPhoneOTPInput && (
        <div className="fv-row mb-4 mt-4">
          <label className="form-label fw-bolder text-gray-900 fs-6">
            Phone OTP
          </label>
          <div className="otpInput">
            <input
              type="text"
              placeholder="Enter Phone OTP"
              autoComplete="off"
              className="form-control bg-transparent"
              value={phoneOtp}
              onChange={(e) => setPhoneOtp(e.target.value)}
            />
            <button
              type="button"
              onClick={openPhoneOTP}
              disabled={!isValidateButtonEnabled(phoneOtp)}
            >
              Validate
            </button>
          </div>
          {phoneOtpError && <div className="text-danger">{phoneOtpError}</div>}
        </div>
      )}

      <div className="fv-row mb-4">
        <label
          className="form-check form-check-inline"
          htmlFor="kt_login_toc_agree"
        >
          <input
            className="form-check-input"
            type="checkbox"
            id="kt_login_toc_agree"
            onChange={(e) => setTermsAccepted(e.target.checked)}
          />
          <span>
            I Accept the{" "}
            <a href="#" className="ms-1 link-primary">
              Terms
            </a>
            .
          </span>
        </label>
      </div>
      {!termsAccepted && (
        <div className="text-danger">Please accept the terms</div>
      )}
      <div className="text-center">
      <ReCAPTCHA
          sitekey="6LcUTKcpAAAAACpHaNwRs9Ki9ddGKru7tajgjjeV"
          onChange={handleRecaptchaChange}
        />
        <button
          type="submit"
          id="kt_sign_up_submit"
          className="btn btn-lg btn-primary w-100 mb-4"
          disabled={isButtonDisabled()}
        >
          Create Account
        </button>
        <Link to="/auth/login">
          <button
            type="button"
            id="kt_login_signup_form_cancel_button"
            className="btn btn-lg btn-light-primary w-100 mb-4"
          >
            Cancel
          </button>
        </Link>
      </div>
    </form>
  );
}
