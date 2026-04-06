import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen bg-white">
      {/* Left section with blue gradient background */}
      <div className="w-1/2 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 relative overflow-hidden">
        {/* Decorative blurred circles with lighter opacity for light theme */}
        <div className="absolute top-20 -right-20 w-96 h-96 bg-white/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl"></div>

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col justify-between p-8">
          {/* Top logo */}
          <div>
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30">
              {/* <span className="text-2xl font-bold text-white">✦</span> */}
              <img src="/digi-loader-white.png" alt="Logo" className="w-6 h-6" />
            </div>
          </div>

          {/* Center content - Updated for Biometric Exam Software */}
          <div className="text-white">
            <p className="text-4xl font-light mb-2 opacity-90">Secure exams</p>
            <h2 className="text-6xl font-bold mb-2 leading-tight">Biometric</h2>
            <h3 className="text-6xl font-bold mb-2 leading-tight">verification</h3>
            <p className="text-4xl font-light opacity-90 leading-tight">for centres</p>
          </div>

          {/* Bottom text with decorative line */}
          <div className="space-y-3">
            <div className="w-12 h-0.5 bg-white/40"></div>
            <p className="text-white/70 text-xs">
              Comprehensive biometric system for exam centres and invigilators
            </p>
          </div>
        </div>
      </div>

      {/* Right section for auth forms - Light theme */}
      <div className="w-1/2 flex items-center justify-center bg-white">
        <div className="w-full max-w-md px-6">
          {/* Logo with light theme styling - Left aligned */}
          <div className="mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
              {/* <span className="text-xl font-bold text-white">✦</span> */}
              <img src="/digi-loader-white.png" alt="Logo" className="w-6 h-6" />
            </div>
          </div>

          {/* Form content - with light theme typography */}
          <div className="text-gray-900">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
