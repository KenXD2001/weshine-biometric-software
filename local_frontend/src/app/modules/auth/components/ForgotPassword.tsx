import { useState } from 'react';
import { Link } from "react-router-dom";

export function ForgotPassword() {
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showOTPField, setShowOTPField] = useState(false);
  const [showChangePasswordFields, setShowChangePasswordFields] = useState(false);

  const handleSubmit = (event: { preventDefault: () => void; }) => {
    event.preventDefault();
    if (!showOTPField) {
      setShowOTPField(true);
    } else if (!showChangePasswordFields) {
      setShowChangePasswordFields(true);
    } else {
      alert('Password changed successfully!');
    }
  };

  return (
    <form
      className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework"
      noValidate
      id="kt_login_password_reset_form"
      onSubmit={handleSubmit}
    >
      <div className="text-center mb-10">
        <h1 className="text-gray-900 fw-bolder mb-3">Forgot Password ?</h1>
        {showChangePasswordFields ? (
          <div className="text-gray-500 fw-semibold fs-6">
            Enter your email and new password.
          </div>
        ) : (
          <div className="text-gray-500 fw-semibold fs-6">
            Enter your Mobile Number to reset your password.
          </div>
        )}
      </div>
      {!showChangePasswordFields && (
        <><div className="fv-row mb-1">
          <label className="form-label fw-bolder text-gray-900 fs-6">Mobile Number</label>
          <input
            type="tel"
            placeholder="Mobile Number"
            autoComplete="off"
            className="form-control bg-transparent"
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value)}
            required />
        </div>
        <div className='d-flex flex-stack flex-wrap gap-3 fs-base fw-semibold'>
            <div />
            <Link to='/auth/forgot-password' className='link-primary'>
              Resend Otp
            </Link>
          </div></>
      )}
      {showOTPField && !showChangePasswordFields && (
        <div className=" mb-8">
          <label className="form-label fw-bolder text-gray-900 fs-6">OTP</label>
          <input
            type="text"
            placeholder="Enter OTP"
            autoComplete="off"
            className="form-control bg-transparent"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
          />
        </div>
      )}
      {showChangePasswordFields && (
        <>
          <div className="fv-row mb-8">
            <label className="form-label fw-bolder text-gray-900 fs-6">New Password</label>
            <input
              type="password"
              placeholder="New Password"
              autoComplete="off"
              className="form-control bg-transparent"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="fv-row mb-8">
            <label className="form-label fw-bolder text-gray-900 fs-6">Confirm Password</label>
            <input
              type="password"
              placeholder="Confirm Password"
              autoComplete="off"
              className="form-control bg-transparent"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
        </>
      )}
      <div className="d-flex flex-wrap justify-content-center pb-lg-0">
        <button
          type="submit"
          id="kt_password_reset_submit"
          className="btn btn-primary me-4"
        >
          <span className="indicator-label">
            {showChangePasswordFields ? 'Change Password' : 'Submit'}
          </span>
        </button>
        <Link to="/auth/login">
          <button
            type="button"
            id="kt_login_password_reset_form_cancel_button"
            className="btn btn-light"
          >
            Cancel
          </button>
        </Link>{" "}
      </div>
    </form>
  );
}
