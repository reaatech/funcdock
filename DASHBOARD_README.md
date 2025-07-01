# FuncDock Web Dashboard

A modern, responsive web interface for managing your FuncDock serverless platform.

## Features

### 🔐 Authentication
- JWT-based authentication
- Default admin credentials: `admin` / `admin`
- Configurable via environment variables
- Secure token management

### 📊 Dashboard Overview
- Real-time function status monitoring
- System metrics and uptime
- Recent activity feed
- Quick function management actions

### 🚀 Function Management
- **Deploy Functions**: Upload files or deploy from Git repositories
- **View Functions**: See all deployed functions with status
- **Delete Functions**: Remove functions with confirmation
- **Real-time Updates**: Live status updates via WebSocket

### 🎨 Modern UI
- **Dark/Light Mode**: Toggle between themes
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Tailwind CSS**: Modern styling with custom components
- **Real-time Updates**: WebSocket integration for live data

### 🔧 Technical Stack
- **Frontend**: React 18 with Vite
- **Styling**: Tailwind CSS with custom design system
- **State Management**: React Context API
- **Real-time**: Socket.IO client
- **HTTP Client**: Axios with interceptors
- **Icons**: Lucide React
- **Notifications**: React Hot Toast

## Getting Started

### Prerequisites
- Node.js 18+ 
- FuncDock server running

### Installation

1. **Install Dashboard Dependencies**
   ```bash
   cd dashboard
   npm install
   ```

2. **Build Dashboard**
   ```bash
   npm run build
   ```

3. **Configure Environment**
   Create a `.env` file in the root directory:
   ```env
   # JWT Secret for authentication
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   
   # Admin credentials
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=admin
   
   # Server configuration
   PORT=3001
   LOG_LEVEL=info
   ```

4. **Start FuncDock Server**
   ```bash
   npm run dev
   ```

5. **Access Dashboard**
   Open your browser and navigate to:
   ```
   http://localhost:3001
   ```

### Development

To run the dashboard in development mode:

```bash
cd dashboard
npm run dev
```

This will start the Vite dev server with hot reloading and proxy configuration.

## Dashboard Pages

### 🏠 Dashboard
- System overview and metrics
- Function status cards
- Recent activity timeline
- Quick action buttons

### 📁 Functions
- Grid view of all functions
- Status indicators (running, error, stopped)
- Function metadata (routes, cron jobs, last deployed)
- Quick actions (view, delete)

### 🚀 Deploy
- **File Upload**: Drag & drop or select files
- **Git Deployment**: Deploy from repository
- Support for multiple file types
- Real-time deployment status

### 📋 Function Detail (Coming Soon)
- Detailed function information
- Route management
- Log viewing
- Testing interface

### 📊 Logs (Coming Soon)
- System logs
- Function logs
- Real-time log streaming
- Log filtering and search

### ⚙️ Settings (Coming Soon)
- System configuration
- User preferences
- Theme settings
- Security settings

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with credentials
- `GET /api/auth/verify` - Verify JWT token
- `POST /api/auth/logout` - Logout

### Functions
- `GET /api/functions` - List all functions
- `GET /api/functions/:name` - Get function details
- `POST /api/functions/deploy/local` - Deploy from files
- `POST /api/functions/deploy/git` - Deploy from Git
- `DELETE /api/functions/:name` - Delete function

### System
- `GET /api/status` - System status and metrics
- `GET /api/metrics` - System metrics
- `GET /api/logs` - System logs

## WebSocket Events

### Client → Server
- Authentication via token
- Real-time connection status

### Server → Client
- `function:loaded` - Function loaded
- `function:unloaded` - Function unloaded
- `function:updated` - Function updated
- `function:deployed` - Function deployed
- `function:deleted` - Function deleted
- `log:new` - New log entry

## Security Features

### Authentication
- JWT tokens with configurable expiration
- Secure token storage in localStorage
- Automatic token refresh
- Protected API routes

### Security Headers
- Helmet.js for security headers
- CORS configuration
- Rate limiting on API endpoints
- Content Security Policy

### File Upload Security
- File size limits (10MB per file)
- File count limits (20 files max)
- File type validation
- Secure file handling

## Customization

### Themes
The dashboard supports dark and light themes with:
- Automatic theme detection
- Manual theme toggle
- Persistent theme preference
- Custom color schemes

### Styling
- Tailwind CSS with custom design system
- Responsive breakpoints
- Custom component classes
- Dark mode support

### Configuration
- Environment-based configuration
- JWT secret management
- Admin credentials
- Server port and settings

## Development

### Project Structure
```
dashboard/
├── src/
│   ├── components/     # Reusable UI components
│   ├── contexts/       # React context providers
│   ├── pages/          # Page components
│   ├── utils/          # Utility functions
│   ├── App.jsx         # Main app component
│   ├── main.jsx        # App entry point
│   └── index.css       # Global styles
├── public/             # Static assets
├── package.json        # Dependencies
├── vite.config.js      # Vite configuration
└── tailwind.config.js  # Tailwind configuration
```

### Adding New Pages
1. Create page component in `src/pages/`
2. Add route in `src/App.jsx`
3. Add navigation link in `src/components/Layout.jsx`

### Adding New API Endpoints
1. Add endpoint in `server.js`
2. Add API function in `src/utils/api.js`
3. Use in components with proper error handling

## Troubleshooting

### Common Issues

**Dashboard not loading**
- Check if server is running on port 3001
- Verify dashboard is built (`npm run build`)
- Check browser console for errors

**Authentication issues**
- Verify JWT_SECRET in .env file
- Check admin credentials
- Clear browser localStorage

**WebSocket connection failed**
- Check server is running
- Verify Socket.IO is properly configured
- Check browser console for connection errors

**File upload fails**
- Check file size limits
- Verify file types are allowed
- Check server logs for errors

### Debug Mode
Enable debug logging by setting:
```env
LOG_LEVEL=debug
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Check the troubleshooting section
- Review server logs
- Open an issue on GitHub
- Check the main FuncDock documentation 