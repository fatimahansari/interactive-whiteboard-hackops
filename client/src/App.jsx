import React, { useState, Fragment, useRef, useEffect } from 'react';
import './App.css';
import Slider from '@mui/material/Slider';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import * as fabric from "fabric";
import { io } from "socket.io-client";

//socket settings to connect to server.
const socket = io("http://192.168.111.236:3000", {
  transports: ["websocket", "polling"],
  withCredentials: true,
});

const App = ({email, mykey}) => {

  const [isExpanded, setIsExpanded] = useState(true); //state to keep track of sidebar expansion.

  //tool related states
  const [ToolSelection, setToolSelection] = useState('Pencil'); //state to keep track of tool selection
  const [LineWidth, setLineWidth] = useState(11); //state to keep track of line-width
  const [Color, setColor] = useState("white") //state to keep track of color
  const marks = [{value: 1, label: '1'}, {value: 11, label: '10'}, {value: 21, label: '20'}, {value: 31, label: '30'}, {value: 41, label: '40'}]; //line width markings
  
  //canvas related states
  const canvasRef = useRef(null); //reference to canvas
  const [Canvas, setCanvas] = useState(null); //state to keep track of changes in the canvas.

  //state to keep track of current room
  const [roomId, setroomId] = useState(mykey);

  //share box state
  const [Sharekey, setSharekey] = useState(false);

  //joining states
  const [Joined, setJoined] = useState(false);
  const [Joinbox, setJoinbox] = useState(false);
  const [Joiningkey, setJoiningkey] = useState("");
  const [KeyError, setKeyError] = useState(false);

  const remoteCursorsRef = useRef({}); //store group for other user cursors against their socketids.

  //undo redo stacks.
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);

  //load canvas and default brush, colors and widths upon initial screen render
  useEffect(() => {
    console.log("canvas loaded for", email,);
    console.log("roomID: ", roomId);

    if(canvasRef.current) {
      const can = new fabric.Canvas(canvasRef.current, {
        width: 2000,
        height: 1000,
        defaultCursor: "crosshair",
        isDrawingMode: true
      });

      can.backgroundColor = "rgb(59, 59, 59)";

      can.freeDrawingBrush = new fabric.PencilBrush(can);
      can.freeDrawingBrush.strokeLineCap = "round";
      can.freeDrawingBrush.strokeDashArray = [2, 2];

      can.freeDrawingBrush.color = Color;
      can.freeDrawingBrush.width = LineWidth;

      can.renderAll();
      setCanvas(can);

      socket.emit("join-room", roomId); //sending request to server to join room.

      //handle Path Creation and emit them to other users.
      can.on("path:created", (event) => {
        const path = event.path;
        path.set({ selectable: true, evented: true, isUserDrawing: true });
        const pathData = path.toObject();

        undoStackRef.current.push({
          type: "draw",
          object: pathData,
        });
        redoStackRef.current = [];

        socket.emit("drawing", { roomId, object: pathData }); //emit the path data to the server
      });

      //emit my mouse movements to other users.
      can.on("mouse:move", (event) => {
        const pointer = can.getPointer(event.e);
        socket.emit("cursor-move", {
          roomId,
          userId: socket.id,
          name: email,
          cursor: { x: pointer.x, y: pointer.y }
        });
      });

      return () => {
        can.dispose() //clean-up canvas and all its objects
      }
    }
  }, [roomId]);

  //useEffect for handling canvas changes and real-time events.
  useEffect(() => {
    if(!Canvas) return;

    //handle receiving drawings from other users
    const handleDrawing = (data) => {
      if(data.roomId !== roomId) return; //ignore if not in the correct room
      console.log("in adding section");
      fabric.Path.fromObject(data.object).then((obj) => {
        obj.set({ isUserDrawing: true });
        Canvas.add(obj);
      });
    };
    socket.on("drawing", handleDrawing); //binding handleDrawing to drawing event.

    //listen for erase events
    const handleErase = (data) => {
      if(data.roomId !== roomId) return; //ignore if not in the correct room
      console.log("Erasing path:"); //debugging log  

      fabric.Path.fromObject(data.object).then((fabricPath) => {
        //find the matching path on the canvas
        const pathToRemove = Canvas.getObjects("path").find((path) => 
          JSON.stringify(path.toObject()) === JSON.stringify(fabricPath.toObject())
        );

        if (pathToRemove) {
          console.log("Removing path from canvas:", pathToRemove);
          Canvas.remove(pathToRemove);
          Canvas.renderAll();
        } else {
          console.warn("Path not found on canvas:", data.object);
        }
      });
    };
    socket.on("erase", handleErase); //binding handleErase to erase event

    //listen for clear events
    const handleClear = (data) => {
      if(data.roomId != roomId) return;
      Canvas.getObjects().forEach((obj) => {
        if (obj.isUserDrawing) {
            Canvas.remove(obj);
        }
      });
    }
    socket.on("clear", handleClear);

    //handle user cursor move event
    const handleCursorMove = ({ userId, name, cursor }) => {
      if (userId === socket.id) return; // skip self
    
      const existingCursor = remoteCursorsRef.current[userId];
      if (!existingCursor) {
        // Create new cursor user
        const circle = new fabric.Circle({
          left: cursor.x,
          top: cursor.y,
          radius: 5,
          fill: 'red',
          selectable: false,
          evented: false,
          isUserDrawing: false
        });
        //create text label for other person
        const label = new fabric.FabricText(name || 'User', {
          left: cursor.x + 10,
          top: cursor.y - 10,
          fontSize: 14,
          fill: 'white',
          selectable: false,
          evented: false,
          isUserDrawing: false
        });
        //create group for other person cursor and text label
        const group = new fabric.Group([circle, label], {
          left: cursor.x,
          top: cursor.y,
          selectable: false,
          evented: false,
          isUserDrawing: false
        });
        //adding group to canvas
        Canvas.add(group);
        remoteCursorsRef.current[userId] = group;
      } else {
        // Update position
        existingCursor.set({ left: cursor.x, top: cursor.y });
      }
    
      Canvas.requestRenderAll(); //rerendering everything to perfectly show cursor movement
    };
    socket.on("cursor-move", handleCursorMove);

    //handle user disconnection event to remove cursor.
    const handleUserDisconnected = ({ userId }) => {
      const group = remoteCursorsRef.current[userId];
      if (group) {
        Canvas.remove(group);
        delete remoteCursorsRef.current[userId];
        Canvas.requestRenderAll();
      }
    };
    socket.on("user-disconnected", handleUserDisconnected);

    //handle other users undo events
    const handleRemoteUndo = ({ object, type, userId }) => {
      if (userId === socket.id) return;
    
      if (type === "draw") {
        const target = Canvas.getObjects().find(
          (obj) => JSON.stringify(obj.toObject()) === JSON.stringify(object)
        );
        if (target) {
          Canvas.remove(target);
        }
      } else if (type === "erase") {
        fabric.Path.fromObject(object).then((path) => {
          path.set({ isUserDrawing: true });
          Canvas.add(path);
        });
      }
    
      Canvas.requestRenderAll();
    };
    socket.on("undo", handleRemoteUndo);
    
    //handle other users redo events
    const handleRemoteRedo = ({ object, userId, type }) => {
      if (userId === socket.id) return;
    
      if (type === "draw") {
        fabric.Path.fromObject(object).then((path) => {
          path.set({ isUserDrawing: true });
          Canvas.add(path);
        });
      } else if (type === "erase") {
        const target = Canvas.getObjects().find(
          (obj) => JSON.stringify(obj.toObject()) === JSON.stringify(object)
        );
        if (target) {
          Canvas.remove(target);
        }
      }
    
      Canvas.requestRenderAll();
    };
    socket.on("redo", handleRemoteRedo);
  
    return () => {
      socket.off("drawing", handleDrawing); //clean up drawing event listener
      socket.off("erase", handleErase); //clean up erase event listener
      socket.off("clear", handleClear); //clean up clear event listener
      socket.off("cursor-move", handleCursorMove); //clean up curser-move event listener
      socket.off("user-disconnected", handleUserDisconnected); //clean up user-disconnect event listener
      socket.off("undo", handleRemoteUndo); //clean up undo event listener
      socket.off("redo", handleRemoteRedo); //clean up redo event listener
    };
  }, [Canvas]);

  //load appripriate erase or drawing tools settings everytime tool is changed.
  useEffect(() => {
    if(!Canvas) return

    if(ToolSelection === "Eraser") {
      Canvas.isDrawingMode = false; //disable drawing
      Canvas.selection = false; //prevent selecting multiple paths

      //attach click event to ALL existing paths
      Canvas.getObjects("path").forEach((path) => {
        path.on("mousedown", () => {
          const objectData = path.toObject();
          undoStackRef.current.push({
            type: "erase",
            object: objectData,
          });
          redoStackRef.current = [];

          socket.emit("erase", { roomId, object: path.toObject() }); // Emit erase event
          console.log("deleting");
          Canvas.remove(path);
          Canvas.renderAll();
        });
      });
    }else {
      Canvas.isDrawingMode = true; //enable drawing
      //remove click events to prevent unwanted deletions
      Canvas.getObjects("path").forEach((path) => {
          path.off("mousedown"); //remove eraser click event
      });
    }
    Canvas.renderAll();

  }, [ToolSelection]);
  
  //change tool and all its settings
  const change_tool = (newtool) => {
    Canvas.freeDrawingBrush = null;
    if(newtool === "Pencil") {
      Canvas.freeDrawingBrush = new fabric.PencilBrush(Canvas);
      Canvas.freeDrawingBrush.strokeLineCap = "round";
      Canvas.freeDrawingBrush.strokeDashArray = [2, 2];
      Canvas.freeDrawingBrush.shadow = null;
      Canvas.freeDrawingBrush.color = Color;
      Canvas.freeDrawingBrush.width = LineWidth;
    }else if(newtool === "Ballpoint") {
      Canvas.freeDrawingBrush = new fabric.PencilBrush(Canvas);
      Canvas.freeDrawingBrush.decimate = 0.05;
      Canvas.freeDrawingBrush.strokeLineCap = "round";
      Canvas.freeDrawingBrush.strokeDashArray = null;
      Canvas.freeDrawingBrush.color = Color;
      Canvas.freeDrawingBrush.width = LineWidth;
    } else if(newtool === "InkPen") {
      Canvas.freeDrawingBrush = new fabric.PencilBrush(Canvas);
      Canvas.freeDrawingBrush.shadow = new fabric.Shadow({color: 'rgba(0,0,0,0.5)', blur: 10, offsetX: 0, offsetY: 0});
      Canvas.freeDrawingBrush.strokeLineCap = "round";
      Canvas.freeDrawingBrush.strokeDashArray = null;
      Canvas.freeDrawingBrush.color = Color;
      Canvas.freeDrawingBrush.width = LineWidth;
    }else if(newtool === "Marker") {
      Canvas.freeDrawingBrush = new fabric.PencilBrush(Canvas);
      Canvas.freeDrawingBrush.shadow = null;
      Canvas.freeDrawingBrush.strokeLineCap = "round";
      Canvas.freeDrawingBrush.strokeDashArray = [10, 5];
      Canvas.freeDrawingBrush.color = Color;
      Canvas.freeDrawingBrush.width = LineWidth;
    }
    setToolSelection(newtool);
    console.log("the current tool is: ", newtool);
  };

  //change tool width
  const change_width = (newwidth) => {
    setLineWidth(newwidth);
    Canvas.freeDrawingBrush.width = newwidth;
    console.log("the new line width is: ", newwidth);
  };

  //change tool color
  const change_color = (newcolor) => {
    setColor(newcolor);
    Canvas.freeDrawingBrush.color = newcolor;
    console.log("the new color is: ", newcolor);
  };

  //clear all objects on canvas except the background
  const clear_canvas = () => {
    if(confirm("This will remove everything on the board. Are you Sure?")) {
      Canvas.getObjects().forEach((obj) => {
        if (obj.isUserDrawing) {
            Canvas.remove(obj);
        }
      });
      socket.emit("clear", { roomId });
    }
  };

  //function to change sidebar expansion state
  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  //export cavaas to png.
  const export_canvas = () => {
    const img = Canvas.toDataURL("image/png"); //converts img to blob
    const link = document.createElement("a");
    link.href = img; //assigns blob to link element
    link.download = "canvas.png" //create download link for blob
    link.click() //download blob as png
  };

  //handle share state
  const update_share_state = () => {
    setSharekey(!Sharekey);
    console.log("share updated: ", !Sharekey);
  }

  //handle joinbox
  const update_joinbox = () => {
    setJoinbox(!Joinbox);
    setJoiningkey("");
    setKeyError(false);
    console.log("joinbox updated: ", !Joinbox);
  }

  //handle connect to another room
  const connect = async () => {
    let keyerrer = false;

    if(!Joiningkey) {
      keyerrer = true;
    }

    setKeyError(keyerrer);

    if(keyerrer) {
      return;
    }

    const response = await fetch(`http://192.168.111.236:3000/checkroom/${Joiningkey}`);
    const response_msg = await response.json();
    if(response_msg.message === "session found") {
      socket.emit("user-disconnected", { roomId, userId: socket.id });
      undoStackRef.current = {};
      redoStackRef.current = {};
      setJoined(true);
      setJoinbox(false);
      setroomId(Joiningkey);
    }else {
      setKeyError(true);
    }
  };

  //handle leave connected room.
  const leave = () => {
    if(confirm("you leave this session and return to your own session")) {
      socket.emit("user-disconnected", { roomId, userId: socket.id });
      remoteCursorsRef.current = {};
      undoStackRef.current = {};
      redoStackRef.current = {};
      setJoined(false);
      setroomId(mykey);
    }
  }

  //function to handle undo client-side and send event to server
  const handleUndo = () => {
    if (undoStackRef.current.length === 0) return;
  
    const lastAction = undoStackRef.current.pop();
    redoStackRef.current.push(lastAction);
  
    const { object, type } = lastAction;
  
    if (type === "draw") {
      const pathToRemove = Canvas.getObjects().find(
        (obj) => JSON.stringify(obj.toObject()) === JSON.stringify(object)
      );
      if (pathToRemove) {
        Canvas.remove(pathToRemove);
      }
    } else if (type === "erase") {
      fabric.Path.fromObject(object).then((path) => {
        path.set({ isUserDrawing: true });
        Canvas.add(path);
      });
    }
  
    socket.emit("undo", { roomId, object, type, userId: socket.id});
  };    

  //function to handle redo client-side and send event to server
  const handleRedo = () => {
    if (redoStackRef.current.length === 0) return;
  
    const redoAction = redoStackRef.current.pop();
    undoStackRef.current.push(redoAction);
  
    const { object, type } = redoAction;
  
    if (type === "draw") {
      fabric.Path.fromObject(object).then((path) => {
        path.set({ isUserDrawing: true });
        Canvas.add(path);
      });
    } else if (type === "erase") {
      const pathToRemove = Canvas.getObjects().find(
        (obj) => JSON.stringify(obj.toObject()) === JSON.stringify(object)
      );
      if (pathToRemove) {
        Canvas.remove(pathToRemove);
      }
    }
  
    socket.emit("redo", { roomId, object, type, userId: socket.id });
  };    

  return (
    <Fragment>
      <div>
        <div className='sidebar-components'>
          {/* sidebar div */}
          <div className={`sidebar ${isExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
            {/* selection menu for the pen */}
            <FormControl sx={{marginTop: "20px"}}>
              <InputLabel id="tool-selector-label" sx={{color: "white", "&.Mui-focused": {color: "white"}, "&.MuiInputLabel-root": {borderColor: "white"}}}>Tool</InputLabel>
              <Select labelId="tool-selector-label" id="tool-selector" label="tool" value={ToolSelection} onChange={(e) => {change_tool(e.target.value)}} sx={{width: "200px", backgroundColor: "rgb(59, 59, 59)", color: "white", borderColor: "white", "&.MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline": {borderColor: "white"}, "& .MuiSvgIcon-root": {color: "white"}}} MenuProps={{PaperProps: {sx: {backgroundColor: "rgb(59, 59, 59)", color: "white"}}}}>
                <MenuItem value="Pencil">✏️ Pencil</MenuItem>
                <MenuItem value="Ballpoint">🖊️ Ballpoint</MenuItem>
                <MenuItem value="InkPen">🖋️ Ink Pen</MenuItem>
                <MenuItem value="Marker">🖍️ Marker</MenuItem>
                <MenuItem value="Eraser">🧽 Eraser</MenuItem>
              </Select>
            </FormControl>
            {/* slider for the line-width on the canvas */}
            <div className='linewidth-selector-container'>
              <label htmlFor="linewidthselector" style={{color: "white", fontSize: "16px", fontFamily: "roboto"}}>Line Width</label>
              <Slider value={LineWidth} defaultValue={LineWidth} id='linewidthselector' valueLabelDisplay='off' step={10} marks={marks} min={1} max={41} onChange={(e) => change_width(e.target.value)} sx={{ color: "white", "& .MuiSlider-thumb": { backgroundColor: "White", border: "2px solid #cccccc", width: 18, height: 18, "&:hover": { backgroundColor: "#f0f0f0" } }, "& .MuiSlider-rail": { backgroundColor: "#e0e0e0" }, "& .MuiSlider-track": { backgroundColor: "White" }, "& .MuiSlider-mark": { backgroundColor: "#d9d9d9", width: 6, height: 6, borderRadius: "50%" }, "& .MuiSlider-markActive": { backgroundColor: "#bfbfbf" }, "& .MuiSlider-markLabel": { color: "white" }}}></Slider>
            </div>
            {/* color container */}
            <div className='color-container'> 
              <p style={{fontFamily: "roboto"}}>Colors</p>
              <div className='color-row'>
                <div className='color-option' style={{backgroundColor: "white", cursor: "pointer", border: Color === "white" ? "3px solid black" : "3px solid transparent"}} title='White' onClick={(e) => {change_color("white")}}></div>
                <div className='color-option' style={{backgroundColor: "red", cursor: "pointer", border: Color === "red" ? "3px solid black" : "3px solid transparent"}} title='Red' onClick={(e) => {change_color("red")}}></div>
                <div className='color-option' style={{backgroundColor: "darkred", cursor: "pointer", border: Color === "darkred" ? "3px solid black" : "3px solid transparent"}} title='Dark red' onClick={(e) => {change_color("darkred")}}></div>
                <div className='color-option' style={{backgroundColor: "orange", cursor: "pointer", border: Color === "orange" ? "3px solid black" : "3px solid transparent"}} title='Orange' onClick={(e) => {change_color("orange")}}></div>
              </div>
              <div className='color-row'>
                <div className='color-option' style={{backgroundColor: "yellow", cursor: "pointer", border: Color === "yellow" ? "3px solid black" : "3px solid transparent"}} title='Yellow' onClick={(e) => {change_color('yellow')}}></div>
                <div className='color-option' style={{backgroundColor: "green", cursor: "pointer", border: Color === "green" ? "3px solid black" : "3px solid transparent"}} title="Green" onClick={(e) => {change_color("green")}}></div>
                <div className='color-option' style={{backgroundColor: "turquoise", cursor: "pointer", border: Color === "turquoise" ? "3px solid black" : "3px solid transparent"}} title="Turquoise" onClick={(e) => {change_color("turquoise")}}></div>
                <div className='color-option' style={{backgroundColor: "indigo", cursor: "pointer", border: Color === "indigo" ? "3px solid black" : "3px solid transparent"}} title="Indigo" onClick={(e) => {change_color("indigo")}}></div>
              </div>
              <div className='color-row'>
                <div className='color-option' style={{backgroundColor: "pink", cursor: "pointer", border: Color === "pink" ? "3px solid black" : "3px solid transparent"}} title="Pink" onClick={(e) => {change_color("pink")}}></div>
                <div className='color-option' style={{backgroundColor: "lime", cursor: "pointer", border: Color === "lime" ? "3px solid black" : "3px solid transparent"}} title="Lime" onClick={(e) => {change_color("lime")}}></div>
                <div className='color-option' style={{backgroundColor: "lavender", cursor: "pointer", border: Color === "lavender" ? "3px solid black" : "3px solid transparent"}} title="Lavender" onClick={(e) => {change_color("lavender")}}></div>
                <div className='color-option' style={{backgroundColor: "gold", cursor: "pointer", border: Color === "gold" ? "3px solid black" : "3px solid transparent"}} title="Gold" onClick={(e) => {change_color("gold")}}></div>
              </div>
              <div className='color-row'>
                <div className='color-option' style={{backgroundColor: "purple", cursor: "pointer", border: Color === "purple" ? "3px solid black" : "3px solid transparent"}} title="Purple" onClick={(e) => {change_color("purple")}}></div>
                <div className='color-option' style={{backgroundColor: "black", cursor: "pointer", border: Color === "black" ? "3px solid black" : "3px solid transparent"}} title="Black" onClick={(e) => {change_color("black")}}></div>
                <div className='color-option' style={{backgroundColor: "gray", cursor: "pointer", border: Color === "grey" ? "3px solid black" : "3px solid transparent"}} title="Gray" onClick={(e) => {change_color("grey")}}></div>
                <div className='color-option' style={{backgroundColor: "brown", cursor: "pointer", border: Color === "brown" ? "3px solid black" : "3px solid transparent"}} title="Brown" onClick={(e) => {change_color("brown")}}></div>
              </div>  
            </div>
            {/* clear, export, share and join buttons */}
            <div className='buttons-container'>
              <div className='button-row'>
                <Button variant='contained' size='small' color="error" sx={{width: "90px"}} onClick={clear_canvas}>clear</Button>
                <Button variant='contained' size='small' color="primary" sx={{width: "90px"}} onClick={update_share_state}>share</Button>
              </div>
              <div className='button-row'>
                <Button variant='contained' size='small' color="secondary" sx={{width: "90px"}} onClick={export_canvas}>export</Button>
                <Button variant='contained' size='small' color="success" sx={{width: "90px"}} onClick={Joined ? leave : update_joinbox}>{Joined ? "leave" : "join"}</Button>
              </div>
            </div>
          </div>
          {/* pulltable div */}
          <div className={`pull-tab`} onClick={toggleSidebar}>
            {isExpanded ? '❮' : '❯'}
          </div>
        </div>

        { Sharekey && 
          <div className='sharekey-box-container'>
            <div className='sharekey-box'>
              <h1 style={{Color: "white", fontSize: "25px", fontFamily: "roboto", textAlign: "center"}}>SHARE THE KEY WITH YOUR FRIENDS</h1>
              <div className='key-box'>
                <h1 style={{Color: "white", fontSize: "25px", fontFamily: "roboto", textAlign: "center"}}>{roomId}</h1>
              </div>
              <Button variant='contained' color='error' onClick={update_share_state}>close</Button>
            </div>
          </div>
        }

        { Joinbox &&
          <div className='join-box-container'>
            <div className='join-box'>
              <h1 style={{Color: "white", fontSize: "25px", fontFamily: "roboto", textAlign: "center"}}>ENTER KEY TO JOIN</h1>
              <div className='key-box'>
                <TextField error={KeyError} helperText={KeyError && "key required or invalid"} sx={{width: "320px", '& input': {color: 'white', fontFamily: "roboto", fontSize: "25px"}, '& .MuiFormHelperText-root': {position: "fixed", marginTop: '72px'}}} onChange={(e) => setJoiningkey(e.target.value)}></TextField>
              </div>
              <div className='button-row'>
                <Button variant='contained' color='error' sx={{width: "100px"}} onClick={update_joinbox}>close</Button>
                <Button variant='contained' color='success' sx={{width: "100px"}} onClick={connect}>connect</Button>
              </div>
            </div>
          </div>
        }
      </div>
      
      {/* undo redo buttons */}
      <div className='undo-redo-box'>
        <div className='undo-redo-button-row' style={{marginTop: "7px"}}>
          <Button title='undo' variant='contained' color='error' sx={{width: "24px"}} onClick={handleUndo}>
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAACXBIWXMAAAsTAAALEwEAmpwYAAAA70lEQVR4nMXUsS5EQRSH8ZuIKIhWoSHEO1Dt3UTnFTyGaL2BEk9BdLJEqVKyj6DYVchq+ckUK5vJvZtdeya+ds78v5k5k1NV/wWWSoZv4K5U+CHeIDp4GWf4SuGhAuzh2fx8oo8rdNvCjzESwwN2SgoSQxzkki08ieMdu7lkBef4HlfN0LtVdHDdILlv23SEwSyCSXDSIKnbijfx2Lg4BdxkgsvQUYE6E/TnzZgK1jLBqIoE65ngI1pQZ4LXaMFtJriIDD9t+KadiKZ2G06e6I2LSjD8HXoFwgfYn7xmJD1s5++4CGnMv6SRsHBD/8oP+Pm7PZBoNJoAAAAASUVORK5CYII=" alt="undo" />
          </Button>
          <Button title='redo' variant='contained' color='error' sx={{width: "24px"}} onClick={handleRedo}>
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAACXBIWXMAAAsTAAALEwEAmpwYAAAA5klEQVR4nNXUQS5EQRRG4UoMDNiBCR0sgkEH0+4lWIVYh5jRexAWQNhAT+k1aCOMffIQqa6UlqfvGzjTSt1T9d+qm9J/AEtdC+6w1qWgYYphl4KGN5xi+bcNBxjhAa/aM8Z2rfAmbsXwgsO8+C6egorPCrCBR3GMsZWfvhbLBfpYadnkk5kmfzW05OiPz3RQWxyVJ29TPEug/tEwKQT9FDkqfHY7Z7WtYC547lowWTSiueC8EFymSLBfeabH0ZKbiuQKeyE9wXrwqPgml+wED7sPypv0cC2Q9ENkTfZnuK98xMUFkbwDxTG7bx5CnOIAAAAASUVORK5CYII=" alt="redo" />
          </Button>
        </div>
      </div>
      
      {/* canvas div */}
      <canvas id='c' ref={canvasRef}></canvas>
    </Fragment>
  )
};

export default App;