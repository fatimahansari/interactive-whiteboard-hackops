# Interactive Whiteboard

A real-time collaborative whiteboard web application. Users can draw, write, and interact together on a shared digital canvas.

---

## Features

- Real-time drawing and updates.
- Multi-user collaboration with Socket.IO.
- Client-server architecture.
- Built with React (Vite), Node.js, and Express.

---

## Project Structure

```
interactive-whiteboard-hackops/
│
├── client/                     #Frontend(React+ Vite)
├── server/                     #Backend(Express + Socket.IO)
├── .github/
│   └── workflows/
│       └── ci-cd.yml
├── .gitignore
├── README.md
└── LICENSE

```

---

## Tech Stack

- **Frontend:** React, Vite
- **Backend:** Node.js, Express
- **Real-time Communication:** Socket.IO
- **CI/CD:** GitHub Actions
- **Version Control:** Git
- **Deployment:** (You can add if deployed)
- **Optional:** Docker, Monitoring (Planned)

---

## Local Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm (or yarn)
- A code editor like VS Code

### Running the App Locally

1. **Clone the repository**:

```bash
git clone https://github.com/fatimahansari/interactive-whiteboard-hackops.git
cd interactive-whiteboard-hackops
```

2. **Update IP Address (IMPORTANT)**:

Before running the project, replace the default IP addresses with **your own machine’s IPv4 address** in these four files:

- `client/src/index.js`
- `client/src/Login.jsx`
- `client/src/App.jsx`
- `client/vite.config.js`

To find your IPv4 address:

```bash
#On Windows
ipconfig
```

Use **Find and Replace (Ctrl+F)** in VS Code to replace all instances of the old IP (e.g., `192.168.x.x`) with your current one.

3. **Install and run client**:

```bash
cd client
npm install
npm run dev
```

4. **Install and run server**:

```bash
cd ../server
npm install
node index.js
```

---

## Scripts

```bash
#Client
npm run dev

#Server
node index.js 
```

---

## Future Enhancements

- Dockerized containerization
- CI/CD pipeline improvements
- Secrets management
- Integrated testing
- Prometheus + Grafana monitoring

---

## Author

- [Fatimah Ansari](https://github.com/fatimahansari)

---

## License

This project is licensed under the [MIT License](./LICENSE).