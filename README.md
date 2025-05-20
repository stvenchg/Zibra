# Zibra

![Zibra Logo](/public/zibra.svg)

Zibra is a modern, web-based file transfer application that leverages WebRTC for direct peer-to-peer file sharing within your local network. No cloud storage, no file size limitations imposed by servers - just fast, secure, and direct file transfers between devices.

## Features

- **Peer-to-Peer File Transfer**: Transfer files directly between devices without going through a server
- **Zero Configuration**: Just open the app on both devices and start sharing
- **Multi-file Support**: Select and send multiple files at once
- **Real-time Progress Tracking**: View transfer progress with speed and time remaining
- **Drag & Drop**: Easy file selection with drag and drop interface
- **Device Identification**: Customizable device names with persistent settings
- **Dark Mode Support**: Comfortable viewing in any environment
- **No Installation Required**: Works in any modern browser

## Tech Stack

- React with TypeScript
- WebRTC for peer-to-peer communication
- Socket.io for signaling
- TailwindCSS for styling
- Vite for build tooling

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone https://github.com/stvenchg/zibra.git
cd zibra
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Start both the client and signaling server:
```bash
npm start
# or
yarn start
```

This will launch both the development server for the client and the signaling server simultaneously.

### Development Mode

If you prefer to run the client and server separately during development:

```bash
# Run the client development server
npm run dev
# or
yarn dev

# Run the signaling server
npm run server
# or
yarn server
```

### Build for Production

```bash
npm run build
# or
yarn build
```

## Usage

1. Open the application on two different devices on the same network
2. Select files to transfer on the source device
3. Click on the target device in the available devices list
4. Watch the transfer progress in real-time
5. Access transferred files on the destination device

## Deploying the Signaling Server

The signaling server is required for devices to discover each other before establishing direct WebRTC connections. You can deploy it on various platforms:

### Deploying on Railway

1. Create an account on [Railway](https://railway.app/)
2. Install the Railway CLI
   ```bash
   npm i -g @railway/cli
   ```
3. Login to Railway
   ```bash
   railway login
   ```
4. Initialize a new project in the server directory
   ```bash
   cd server
   railway init
   ```
5. Configure your deployment with the following settings:
   - Build Command: `npm install`
   - Start Command: `node server/index.js`
6. Deploy the server
   ```bash
   railway up
   ```
7. Set your service to public and note the domain provided by Railway
8. Update the `.env` file to point to your deployed server:
   ```
   VITE_SERVER_URL=https://your-railway-domain.up.railway.app
   ```

### Deploying on Render

1. Create an account on [Render](https://render.com/)
2. Create a new Web Service
3. Connect your GitHub repository or upload the server code directly
4. Configure the service:
   - Build Command: `npm install`
   - Start Command: `node server/index.js`
   - Environment Variables: No special variables required
5. Click "Create Web Service"
6. Once deployed, note the URL provided by Render
7. Update the `.env` file to point to your deployed server:
   ```
   VITE_SERVER_URL=https://zibra-server.onrender.com
   ```

### Deploying on Heroku

1. Create an account on [Heroku](https://heroku.com/)
2. Install the Heroku CLI
   ```bash
   npm install -g heroku
   ```
3. Login to Heroku
   ```bash
   heroku login
   ```
4. Create a new Heroku app
   ```bash
   cd server
   heroku create zibra-signaling-server
   ```
5. Configure your Procfile to use the correct start command:
   ```
   web: node server/index.js
   ```
6. Deploy to Heroku
   ```bash
   git subtree push --prefix server heroku main
   # or if you're deploying from a subdirectory
   git push heroku `git subtree split --prefix server main`:main --force
   ```
7. Note the URL provided by Heroku
8. Update the `.env` file to point to your deployed server:
   ```
   VITE_SERVER_URL=https://zibra-signaling-server.herokuapp.com
   ```

## Environment Variables

Create a `.env` file in the root directory with these variables:

```
VITE_SERVER_URL=http://your-signaling-server:3001
```

## Browser Support

Zibra works on all modern browsers that support WebRTC:

- Chrome (desktop and mobile)
- Firefox (desktop and mobile)
- Safari (desktop and mobile)
- Edge (Chromium-based)

## Future Roadmap

Zibra is continuously evolving. Here are some features we're planning to add:

### Short-term goals

- **Temporary File Hosting**: Allow files to be temporarily stored on the server for users who are not online simultaneously
- **Shareable Links**: Generate unique links to share files with users outside your network
- **File Encryption**: End-to-end encryption for all file transfers
- **Transfer Resumption**: Resume interrupted transfers where they left off

### Long-term vision

- **Multi-platform clients**: Native desktop and mobile applications
- **File Transfer History**: Keep track of previously sent and received files
- **Offline Mode**: Queue transfers for when devices reconnect
- **Custom Sharing Rooms**: Create rooms where multiple users can share files simultaneously
- **File Preview**: Preview files before downloading them
- **Self-hosted Server Option**: Documentation for setting up your own signaling server with extended functionality

We welcome contributions and feature requests! Feel free to open an issue on GitHub to suggest new features or improvements.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Author

Steven Ching - [Website](https://stevenching.fr)

---

Made with ❤️ using React, WebRTC and TailwindCSS
