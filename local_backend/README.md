# Digi Biometric Backend API

A Node.js Express backend application for the Digi Biometric Software system.

## Features

- **Authentication**: JWT-based user authentication
- **Biometric Management**: Handle biometric data submission and retrieval
- **Candidate Management**: Manage candidate registration and verification
- **Lab Management**: Seat allocation and lab management
- **File Upload**: Support for candidate data and biometric image uploads
- **Professional Logging**: Comprehensive logging with timestamps
- **Security**: Rate limiting, CORS, helmet security headers

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp env.example .env
```

4. Update `.env` file with your configuration:
```env
PORT=8080
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h
```

### Running the Application

#### Development Mode (with nodemon)
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

The server will start on port 8080 by default.

## API Endpoints

### Authentication
- `POST /api/user/login` - User login
- `POST /api/user/logout` - User logout
- `GET /api/user/me` - Get current user info

### Candidates
- `GET /api/candidate-details/all` - Get candidate by hall ticket
- `GET /api/candidate-details/all/filters` - Get filtered candidates
- `GET /api/candidate-details/counts` - Get candidate counts
- `GET /api/candidate-details/match` - Match candidate with exam slot

### Biometric
- `POST /api/biometric-details/submit-biometric-string` - Submit biometric data
- `GET /api/biometric-details/:hallTicket` - Get biometric details
- `POST /api/biometric-details/delete/:hallTicket` - Delete biometric data

### Labs
- `GET /api/lab-seating/client-registration-lab` - Get lab details
- `POST /api/lab-seating/v2/allocate/seat/:hallTicket` - Allocate seat
- `POST /api/lab-seating/deallocate/seat/:hallTicket` - Deallocate seat
- `GET /api/lab-seating/view-generated-hall-ticket-list` - Get seating details

### File Upload
- `POST /api/upload/file` - Upload candidate data or biometric images

### Exam Centers
- `GET /api/exam-centre/:centreCode` - Get exam center details
- `GET /api/exam-centre` - Get all exam centers

## Logging

The application includes comprehensive logging with:
- **Console Output**: Colored console logs with timestamps
- **File Logging**: Logs saved to `logs/` directory
- **Log Levels**: info, warn, error, debug, success
- **HTTP Request Logging**: Automatic request/response logging

Log files:
- `logs/app.log` - General application logs
- `logs/error.log` - Error logs only
- `logs/debug.log` - Debug logs (development only)

## Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS**: Configured for frontend communication
- **Helmet**: Security headers
- **JWT Authentication**: Secure token-based authentication
- **Input Validation**: Request validation and sanitization

## Development

### File Structure
```
backend/
├── src/
│   ├── config/
│   │   └── logger.js          # Logging configuration
│   ├── routes/
│   │   ├── api.js             # Main API router
│   │   ├── auth.js            # Authentication routes
│   │   ├── candidates.js      # Candidate management
│   │   ├── biometric.js       # Biometric data
│   │   ├── labs.js            # Lab and seating management
│   │   ├── upload.js          # File upload handling
│   │   ├── examCentre.js      # Exam center management
│   └── server.js              # Main server file
├── logs/                      # Log files (auto-created)
├── uploads/                   # Upload directory (auto-created)
├── package.json
├── nodemon.json              # Nodemon configuration
└── README.md
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 8080 |
| `NODE_ENV` | Environment | development |
| `JWT_SECRET` | JWT secret key | fallback-secret-key |
| `JWT_EXPIRES_IN` | Token expiration | 24h |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | 900000 |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 |
| `MAX_FILE_SIZE` | Max upload file size | 5242880 |

## Health Check

The application provides a health check endpoint:
```
GET /health
```

Returns server status, uptime, and environment information.

## Mock Data

The application currently uses mock data for demonstration. In production, replace the mock data with actual database connections.

### Login Credentials
- Username: `info@digiparikshak.com`
- Password: `password`
- Role: `invigilator`

> **Note**: Simple authentication (no JWT, no password hashing) for development ease.

### Sample Exam Centers
- Centre Code: `CENTRE001` - Delhi Examination Centre
- Centre Code: `CENTRE002` - Mumbai Examination Centre
- Centre Code: `CENTRE003` - Bangalore Examination Centre

## Integration with Frontend

The backend is configured to work with the frontend running on port 3030. CORS is set up to allow requests from:
- `http://localhost:3030`
- `http://127.0.0.1:3030`

## Production Deployment

For production deployment:

1. Set `NODE_ENV=production`
2. Use a strong JWT secret
3. Configure proper CORS origins
4. Set up a reverse proxy (nginx)
5. Use a process manager (PM2)
6. Set up proper database connections
7. Configure SSL/TLS certificates

## License

ISC
