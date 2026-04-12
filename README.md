# Digi Biometric System - Desktop Application

Professional biometric verification system for examinations built with Electron.

## Features

- **Face Recognition** - Real-time face matching with AI
- **Fingerprint Capture** - Mantra MFS100 device integration
- **Candidate Management** - Upload, verify, and track candidates
- **Offline Operation** - No internet required
- **Secure Storage** - All data stored locally
- **Auto-refresh** - Real-time candidate list updates
- **Export Reports** - JSON data export

## Technical Specifications

### Frontend
- **Framework**: React 18.2
- **UI Library**: Bootstrap 5.3
- **Build Tool**: Vite 4.4
- **Language**: TypeScript
- **Face Recognition**: face-api.js (TensorFlow.js)
- **Webcam**: react-webcam
- **State Management**: React Hooks
- **HTTP Client**: Axios
- **Notifications**: Sonner (toast), SweetAlert2 (modals)
- **Icons**: FontAwesome, Bootstrap Icons

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js 4.18
- **Language**: JavaScript
- **File Upload**: Multer
- **Security**: Helmet, CORS, express-rate-limit
- **Logging**: Custom Winston-based logger
- **Compression**: gzip compression
- **Data Storage**: JSON files (persistent)

### Desktop Application
- **Framework**: Electron 28.x
- **Packaging**: electron-builder
- **Installer**: NSIS (Windows)
- **Security**: Context isolation, IPC bridge
- **Logging**: electron-log
- **Settings**: electron-store

### Biometric Devices
- **Fingerprint**: Mantra MFS100
- **API**: Mantra MFS100 RD Service local HTTP endpoint
- **Face Detection**: TinyFaceDetector (face-api.js)
- **Face Recognition**: FaceRecognitionNet (128-dimensional descriptors)
- **Matching Algorithm**: Euclidean distance comparison

### AI/ML Models
- **TinyFaceDetector** - Fast face detection
- **FaceLandmark68Net** - 68-point facial landmark detection
- **FaceRecognitionNet** - Face descriptor extraction
- **Model Source**: face-api.js pre-trained models

## Mantra MFS100 Configuration

The frontend uses the Mantra MFS100 RD Service local HTTP endpoint.

Use a `.env` file in `local_frontend/` with the following values:

```env
VITE_BIOMETRIC_DEVICE_CAPTURE_URL=http://localhost:11100/RDServiceMFS100
VITE_BIOMETRIC_DEVICE_TEST_URL=http://localhost:11100/RDServiceMFS100
```

If your installation exposes a different RD Service URL, update `VITE_BIOMETRIC_DEVICE_CAPTURE_URL` and `VITE_BIOMETRIC_DEVICE_TEST_URL` accordingly.

## System Requirements

### Minimum
- **OS**: Windows 10 (64-bit) or later
- **RAM**: 4 GB
- **Storage**: 500 MB free space
- **Processor**: Intel Core i3 or equivalent

### Hardware
- **Webcam**: Built-in or USB (720p minimum)
- **Fingerprint Device**: Mantra MFS100
- **USB Ports**: USB 2.0/3.0

## Development Setup

### Installation

```bash
# Clone repository
git clone <repository-url>
cd digi-biometric-software

# Install all dependencies
npm run install-all
```

### Development Mode

```bash
npm run electron:dev
```

This starts backend (port 8080), frontend (port 3030), and Electron window.

## Building the Application

### Quick Build

```bash
npm run build:complete
```

Output: `dist-electron/Digi Biometric System-Setup-1.0.0.exe` (~150 MB)

### Alternative Build Commands

```bash
npm run dist:win        # Windows installer
npm run dist:portable   # Portable version (no install)
npm run pack            # Unpacked for testing
```

## Project Structure

```
digi-biometric-software/
├── electron/                    # Electron application
│   ├── main.js                 # Main process (auto-starts backend/frontend)
│   ├── preload.js              # Security bridge
│   ├── loading.html            # Loading screen
│   └── resources/
│       └── icon.ico            # Application icon
│
├── backend/                     # Node.js backend API
│   ├── src/
│   │   ├── routes/             # API endpoints
│   │   ├── config/             # Configuration
│   │   └── utils/              # Utilities
│   ├── data/                   # JSON data storage
│   │   ├── candidates.json     # Candidate data (with images)
│   │   ├── candidates_biometric.json  # Biometric metadata
│   │   └── centreInfo.json     # Centre info + counts
│   └── uploads/                # Organized image storage
│       └── candidates/{hallTicket}/
│           ├── uploaded.png    # From JSON
│           ├── live.png        # From JSON
│           ├── captured.png    # Webcam capture
│           └── biometric.bmp   # Fingerprint
│
├── frontend/                    # React frontend
│   ├── src/
│   │   ├── app/                # Application code
│   │   │   ├── pages/          # Main pages
│   │   │   ├── helpers/        # API & device helpers
│   │   │   └── modules/        # Auth, accounts, etc.
│   │   └── _metronic/          # UI theme
│   └── public/
│       ├── models/             # Face-api.js models
│       └── media/              # Images, logos
│
└── scripts/                     # Build automation
    ├── install-all.js          # Dependency installer
    └── build.js                # Complete build script
```

## Architecture

### Application Flow
```
User Launches App
    ↓
Electron Main Process
    ↓
├── Start Backend (Express Server - Port 8080)
│   └── API Routes, Data Storage, Image Processing
│
└── Start Frontend (React App - Port 3030)
    └── UI, Face Recognition, Device Integration
```

### Data Storage
- **candidates.json**: Candidate data with uploaded/live images (base64)
- **candidates_biometric.json**: Biometric metadata, timestamps, image paths
- **centreInfo.json**: Centre details with real-time candidate counts
- **uploads/candidates/{hallTicket}/**: Physical image files organized by candidate

### Device Integration
```
Frontend (React)
    ↓
Mantra MFS100 RD Service (local HTTP endpoint)
    ↓
Mantra MFS100 device driver
    ↓
Physical Fingerprint Device
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run install-all` | Install all dependencies |
| `npm run electron:dev` | Run in development mode |
| `npm run build:complete` | Build installer (automated) |
| `npm run dist:win` | Create Windows installer |
| `npm run dist:portable` | Create portable version |

## For End Users

Distribute: `Digi Biometric System-Setup-1.0.0.exe`

**User Requirements:**
- Windows 10+ (64-bit)
- SecuGen device driver installed
- Webcam connected

**Installation:**
1. Run installer as Administrator
2. Follow wizard
3. Launch from desktop icon

## Technology Stack

### Frontend Technologies
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2 | UI framework |
| TypeScript | 5.3 | Type safety |
| Vite | 4.4 | Build tool & dev server |
| Bootstrap | 5.3 | UI components |
| face-api.js | 0.22 | Face recognition (TensorFlow.js) |
| react-webcam | 7.2 | Webcam access |
| Axios | 1.6 | HTTP client |
| Sonner | 1.4 | Toast notifications |
| SweetAlert2 | 11.11 | Modal dialogs |
| Moment.js | - | Date formatting |

### Backend Technologies
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | - | Runtime environment |
| Express.js | 4.18 | Web framework |
| Multer | 1.4 | File upload handling |
| Helmet | 7.1 | Security headers |
| CORS | 2.8 | Cross-origin resource sharing |
| express-rate-limit | 7.1 | Rate limiting |
| compression | 1.7 | Response compression |
| dotenv | 16.3 | Environment configuration |

### Desktop Application
| Technology | Version | Purpose |
|------------|---------|---------|
| Electron | 28.x | Desktop framework |
| electron-builder | 24.9 | Build & packaging |
| electron-log | 5.0 | Logging system |
| electron-store | 8.1 | Settings storage |
| concurrently | 8.2 | Multi-process runner |
| wait-on | 7.2 | Startup synchronization |

### Biometric Integration
| Component | Technology | Details |
|-----------|------------|---------|
| Face Recognition | face-api.js | TensorFlow.js-based, runs in browser |
| Face Detection | TinyFaceDetector | Lightweight, fast detection |
| Face Landmarks | FaceLandmark68Net | 68-point facial feature detection |
| Face Descriptors | FaceRecognitionNet | 128-dimensional face embeddings |
| Matching | Euclidean Distance | Distance threshold: 0.25 (excellent), 0.38 (acceptable) |
| Fingerprint Capture | Mantra MFS100 RD Service | HTTP REST API (localhost:11100) |
| Device Support | Mantra MFS100 | MFS100 optical scanner |

### Data Storage
| Storage Type | Format | Purpose |
|--------------|--------|---------|
| Candidate Data | JSON | candidates.json (with base64 images) |
| Biometric Data | JSON | candidates_biometric.json (metadata + timestamps) |
| Centre Info | JSON | centreInfo.json (stats + counts) |
| Images | PNG/BMP | uploads/candidates/{hallTicket}/ |

### Image Processing
- **Uploaded Images**: Base64 → PNG conversion
- **Live Images**: Base64 → PNG conversion
- **Webcam Capture**: PNG format via canvas API
- **Fingerprint**: BMP format from SecuGen device
- **Organization**: One folder per candidate by hall ticket

### Security Features
- Context isolation in Electron
- No node integration in renderer
- Secure IPC communication
- HTTPS for biometric device API
- Rate limiting on backend
- Helmet security headers
- CORS policy enforcement
- Local-only data storage

## License

MIT License - see LICENSE.txt

