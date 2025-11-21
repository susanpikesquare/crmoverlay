# Revenue Intelligence CRM Overlay

A modern full-stack web application that connects to Salesforce via APIs to provide AE/AM/CSM cockpits with AI-powered recommendations. It displays account intelligence from Clay and 6sense, competitive tracking, and priority scoring.

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast builds and HMR
- **Tailwind CSS** for modern styling
- **React Router** for navigation
- **React Query** for data fetching and caching
- **Axios** for API calls

### Backend
- **Node.js** with **Express**
- **TypeScript** for type safety
- **jsforce** for Salesforce API integration
- **express-session** for session management
- **CORS** enabled for cross-origin requests

## Project Structure

```
revenue-intelligence-app/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # Reusable React components
│   │   ├── pages/          # Page components
│   │   ├── contexts/       # React contexts
│   │   ├── services/       # API service layer
│   │   ├── types/          # TypeScript type definitions
│   │   ├── App.tsx         # Main app component
│   │   ├── main.tsx        # Entry point
│   │   └── index.css       # Global styles
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── backend/                  # Express backend API
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── controllers/    # Request handlers
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Custom middleware
│   │   ├── types/          # TypeScript type definitions
│   │   └── server.ts       # Server entry point
│   ├── package.json
│   └── tsconfig.json
├── .gitignore
├── README.md
└── .env.example
```

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Salesforce developer account (for API access)
- Clay API key (optional)
- 6sense API key (optional)

### Installation

1. **Clone the repository** (or navigate to the project directory)

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your actual credentials:
   - Salesforce credentials
   - API keys for Clay and 6sense
   - Session secret (generate a random string)

3. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

4. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

### Running the Application

#### Development Mode

1. **Start the backend server** (from the `backend` directory):
   ```bash
   npm run dev
   ```
   The backend will run on `http://localhost:3001`

2. **Start the frontend development server** (from the `frontend` directory):
   ```bash
   npm run dev
   ```
   The frontend will run on `http://localhost:3000`

3. **Open your browser** and navigate to:
   ```
   http://localhost:3000
   ```

#### Production Build

1. **Build the backend**:
   ```bash
   cd backend
   npm run build
   npm start
   ```

2. **Build the frontend**:
   ```bash
   cd frontend
   npm run build
   npm run preview
   ```

## API Endpoints

### Health & Testing
- `GET /health` - Health check endpoint
- `GET /api/test` - Test endpoint
- `POST /api/test` - Test endpoint with body

### Coming Soon
- Salesforce account endpoints
- Clay intelligence endpoints
- 6sense tracking endpoints
- AI recommendation endpoints

## Features

- ✅ Modern React 18 with TypeScript
- ✅ Tailwind CSS for beautiful UI
- ✅ Express backend with TypeScript
- ✅ Salesforce API integration setup (jsforce)
- ✅ Session management
- ✅ CORS configuration
- ✅ Error handling middleware
- ✅ React Query for data caching
- ✅ Responsive design

### Coming Soon
- 🔄 Salesforce data fetching
- 🔄 Clay integration
- 🔄 6sense integration
- 🔄 AI-powered recommendations
- 🔄 Account intelligence dashboard
- 🔄 Competitive tracking
- 🔄 Priority scoring

## Development

### Type Checking
```bash
# Frontend
cd frontend
npm run type-check

# Backend
cd backend
npm run type-check
```

### Building
```bash
# Frontend
cd frontend
npm run build

# Backend
cd backend
npm run build
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

MIT
