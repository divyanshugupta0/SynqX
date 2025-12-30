# FireChat - Node.js Quick Start Guide

## 📦 Installation

### 1. Install Dependencies
First, install Node.js dependencies:
```bash
npm install
```

### 2. Environment Configuration
Copy the example environment file and configure it:
```bash
copy .env.example .env
```

Edit `.env` file to set your desired port and other configurations.

## 🚀 Running the Application

### Development Mode (with auto-restart)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

## 📁 Project Structure

```
firechat/
├── server.js              # Node.js Express server
├── package.json           # Project dependencies
├── .env.example          # Environment variables template
├── firechat/             # Frontend files
│   ├── index.html        # Landing/verification page
│   ├── chat.html         # Main chat interface
│   ├── noxlogin.html     # Login page
│   ├── *.js              # Client-side JavaScript
│   ├── *.css             # Stylesheets
│   └── *.jpg/png/avif    # Images and assets
└── START.md              # This file
```

## 🔗 Available Routes

- `/` - Landing page (index.html)
- `/chat` - Main chat interface
- `/login` - Login page
- `/api/health` - Server health check endpoint

## 🛠️ Development Tips

1. **Hot Reloading**: Use `npm run dev` for automatic server restart on file changes
2. **Environment Variables**: Configure PORT and other settings in `.env`
3. **Static Files**: All files in `firechat/` directory are served as static assets
4. **API Integration**: Add new API routes in `server.js` as needed

## 🔒 Security Features

- X-Content-Type-Options header
- X-Frame-Options header
- X-XSS-Protection header
- Request logging
- Error handling

## 📝 Next Steps

1. Configure Firebase credentials in your client-side files
2. Add any required API endpoints to `server.js`
3. Customize the port in `.env` file
4. Deploy to your preferred hosting platform

## 🐛 Troubleshooting

**Port already in use?**
- Change the PORT in `.env` file
- Or stop the process using the port

**Dependencies not installing?**
- Make sure Node.js is installed (v14 or higher)
- Try deleting `node_modules/` and `package-lock.json`, then run `npm install` again

**Firebase not connecting?**
- Check your `firebase-config.js` file
- Verify your Firebase project settings

## 📞 Support

For issues or questions, please refer to the main README.md file.
