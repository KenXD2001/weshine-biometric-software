# Digi Biometric Software - Frontend

A React-based biometric examination software frontend built with TypeScript and Vite.

## Features

- **Biometric System**: Face recognition and fingerprint capture
- **Candidate Management**: Registration and verification system
- **Real-time Processing**: Live biometric matching
- **Modern UI**: Built with Metronic framework and Bootstrap 5
- **TypeScript**: Full type safety and modern development experience

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Backend server running on port 8080

### Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env
```

4. Update `.env` file if needed:
```env
VITE_API_URL=http://localhost:8080
```

### Running the Application

#### Development Mode
```bash
npm run dev
```

The application will start on `http://localhost:3030`

#### Production Build
```bash
npm run build
npm run preview
```

## Environment Configuration

The frontend uses environment variables for configuration. Create a `.env` file in the frontend directory:

```env
# API Configuration
VITE_API_URL=http://localhost:8080

# App Information
VITE_APP_NAME=Digi Biometric Software
VITE_APP_VERSION=1.0.0
VITE_APP_ENVIRONMENT=development

# Port Configuration
VITE_BACKEND_PORT=8080
VITE_FRONTEND_PORT=3030
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:8080` |
| `VITE_APP_NAME` | Application name | `Digi Biometric Software` |
| `VITE_APP_VERSION` | Application version | `1.0.0` |
| `VITE_APP_ENVIRONMENT` | Environment | `development` |

## API Integration

The frontend communicates with the backend API running on port 8080. Make sure the backend server is running before starting the frontend.

### Login Credentials

- **Email**: `info@digiparikshak.com`
- **Password**: `password`
- **Role**: `invigilator`

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
   parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
   },
```

- Replace `plugin:@typescript-eslint/recommended` to `plugin:@typescript-eslint/recommended-type-checked` or `plugin:@typescript-eslint/strict-type-checked`
- Optionally add `plugin:@typescript-eslint/stylistic-type-checked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and add `plugin:react/recommended` & `plugin:react/jsx-runtime` to the `extends` list
