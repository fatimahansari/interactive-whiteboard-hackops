const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { Server } = require("socket.io");
const http = require("http");

const app = express();

const rooms = {}

//middle ware
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    transports: ["websocket", "polling"],
    credentials: true
  }
});

app.put("/updatepass/:email/:password", async (req, res) => {
  try {
    const { email, password } = req.params;
    const response = await pool.query("UPDATE person_info SET password = $2 WHERE email = $1;", [email, password]);
    if(response.rowCount <= 0) {
      res.status(200).json({ "message": "update failed" });
    }else {
      res.status(200).json({ "message": "update successful" });
    }
  }catch(error) {
    res.json(error);
  }
});

//path to check room id
app.get("/checkroom/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const response = await pool.query("SELECT sessionid FROM sessions WHERE sessionid = $1", [id]);
    if(response.rows.length <= 0) {
      res.status(200).json({ "message": "no session found"});
    }else {
      res.status(200).json({ "message": "session found"});
    }
  }catch(error) {
    res.json(error);
  }
});

//path to check login credentials
app.get("/checkpass/:email/:password", async (req, res) => {
  try {
    const { email, password } = req.params;
    const pass = await pool.query("SELECT p.password, s.sessionid FROM person_info p INNER JOIN sessions s ON p.email = s.email WHERE p.email = $1;", [email]);
    if(pass.rows.length <= 0) {
      res.status(200).json({"message": "no password found"});
    }else if(password === pass.rows[0].password) {
      res.status(200).json({"message": "password matched", key: pass.rows[0].sessionid});
    }else {
      res.status(200).json({"message": "password not matched"});
    }
  } catch (error) {
    res.json(error);
  }
});

//route to insert room key into database.
app.post("/insertkey", async (req, res) => {
  try {
    const { Email, key } = req.body;
    const response = await pool.query("INSERT INTO sessions VALUES($1, $2)", [key, Email]);
    if(response.rowCount > 0) { 
      res.status(201).json({ "message": "key created" });
    }
  }catch(error) {
    res.status(400).json({ "message": "key repeated" });
  }
});

//path to create new user and then take him to drawing application.
app.post("/create", async (req, res) => {

  //function to create random room key;
  const generate_key = () => {
    let key = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = 16;
    for (let i = 0; i < length; i++) {
      key += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return key;
  };

  try {
    const { FirstName, LastName, Email, Pass } = req.body;
    const response = await pool.query("INSERT INTO person_info VALUES ($1, $2, $3, $4);", [FirstName, LastName, Email, Pass]);
    if(response.rowCount > 0) {

      let responsei = "key repeated";
      let key = "";
      while(responsei === "key repeated") {
        key = generate_key();
        responsei = await fetch("http://192.168.0.102:3000/insertkey", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ Email, key })
        });
        const response_msg = await responsei.json();
        responsei = response_msg.message;
      }

      res.status(201).json({ "message": "account created successfully", key });
    }
  }catch (error) {
    console.log(error);
    res.status(400).json({ "message": "account creation failed" });
  }
});


io.on("connection", (socket) => {
  console.log("A user connected");

  //join room logic.
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }
    console.log(`User joined room: ${roomId}`);
    //send existing drawing history to the new user
    rooms[roomId].forEach((drawing) => {
      socket.emit("drawing", { roomId, object: drawing });
    });
    console.log(`Current users in room ${roomId}:`, io.sockets.adapter.rooms.get(roomId));
  });

  //send drawing logic
  socket.on("drawing", (data) => {
    const { roomId, object } = data;
    if (!rooms[roomId]) rooms[roomId] = []; //ensure room exists
    rooms[roomId].push(object); //store drawn objects
    socket.broadcast.to(roomId).emit("drawing", { roomId, object });
  });

  //handle erase a particular object.
  socket.on("erase", (data) => {
    const { roomId, object } = data;
    if (!rooms[roomId]) return;

    //remove erased object from history
    rooms[roomId] = rooms[roomId].filter((path) => 
      JSON.stringify(path) !== JSON.stringify(object)
    );

    socket.to(roomId).emit("erase", { roomId, object });
  });

  //clear functionality.
  socket.on("clear", (data) => {
    const { roomId } = data;
    rooms[roomId] = [];
    socket.broadcast.to(roomId).emit("clear", { roomId });
  });

  //receive cursor position from a user and broadcast to others in the room
  socket.on("cursor-move", (data) => {
    const { roomId, userId, name, cursor } = data;
    // console.log("room: ", roomId, " userId: ", userId);
    socket.to(roomId).emit("cursor-move", { userId, name, cursor });
  });

  //handle user leaving a room logic.
  socket.on("user-disconnected", (data) => {
    const { roomId, userId } = data;
    socket.to(roomId).emit("user-disconnected", { userId });
    socket.leave(roomId);
  });

  // undo
  socket.on("undo", (data) => {
    const { roomId, object, type, userId } = data;
    if (type === "draw") {
      //undo drawing: remove from server state
      rooms[roomId] = rooms[roomId].filter(
        (obj) => JSON.stringify(obj) !== JSON.stringify(object)
      );
    } else if (type === "erase") {
      //undo erase: re-add to server state
      rooms[roomId].push(object);
    }
    socket.to(roomId).emit("undo", { object, type, userId });
  });

  // redo
  socket.on("redo", (data) => {
    const { roomId, object, type, userId } = data;
    if (!rooms[roomId]) rooms[roomId] = [];

    if (type === "draw") {
      //redo drawing: re-add to server state
      rooms[roomId].push(object);
    } else if (type === "erase") {
      //redo erase: remove from server state
      rooms[roomId] = rooms[roomId].filter(
        (obj) => JSON.stringify(obj) !== JSON.stringify(object)
      );
    }

    socket.to(roomId).emit("redo", { object, type, userId });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// server.listen(3000, "192.168.0.102", () => {
//   console.log("express server is working at 192.168.0.102:3000");
// });

app.listen(5000, '0.0.0.0', () => {
  console.log("Server running on port 5000");
});
