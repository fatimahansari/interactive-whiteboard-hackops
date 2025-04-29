import React, { Fragment, useEffect, useRef, useState } from "react";
import "./Login.css";
import { Button, TextField, ToggleButton, ToggleButtonGroup } from "@mui/material";
import App from "./App.jsx";

const Login = () => {
  
  //field states
  const [Email, setEmail] = useState("");
  const [Pass, setPass] = useState("");
  const [FirstName, setFirstName] = useState("");
  const [LastName, setLastName] = useState("");

  //login states
  const [LoginSignup, setLoginSignup] = useState("login");
  const [islogin, setislogin] = useState(false);

  //error states
  const [EmailError, setEmailError] = useState(false);
  const [PassError, setPassError] = useState(false);
  const [FirstNameError, setFirstNameError] = useState(false);
  const [LastNameError, setLastNameError] = useState(false);

  //sessionID state
  const [roomId, setroomId] = useState('');
  
  //state to check if initial login is stored in sessionstorage or not.
  const [Initialcheck, setInitialcheck] = useState(false); 

  //ref to track form submit button.
  const submit_btn = useRef();

  //useEffect to check if anything in session storage
  useEffect(() => {
    const email = sessionStorage.getItem("email");
    const key = sessionStorage.getItem("key");

    if(email && key) {
      setInitialcheck(true);
    }
  }, []);

  //useEffect to switch to App component
  useEffect(() => {
    if(Initialcheck) {
      setEmail(sessionStorage.getItem("email"));
      setroomId(sessionStorage.getItem("key"));
      setislogin(true);
    }
  }, [Initialcheck]);

  //useEffect to handle form changes
  useEffect(() => {
    setEmail("");
    setPass("");
    setFirstName("");
    setLastName("");
    setroomId("");
    setEmailError(false);
    setPassError(false);
    setFirstNameError(false);
    setLastNameError(false);
  }, [LoginSignup]);

  //useeffect to control enter pressed event
  useEffect(() => {
    const enter_pressed_event = (e) => {
      if(e.key === "Enter") {
        console.log("enter pressed");
        submit_btn.current.click();
      }
    };
  
    if (!islogin) {
      document.addEventListener("keydown", enter_pressed_event);
    }
  
    return () => {
      document.removeEventListener("keydown", enter_pressed_event);
    };
  }, [islogin]);

  const handle_login = async () => {
    console.log("login function");

    let emailError = false;
    let passError = false;

    if(!Email) {
      emailError = true;
    }

    if(!Pass) {
      passError = true;
    }

    setEmailError(emailError);
    setPassError(passError);

    if(emailError || passError) {
      return;
    }

    const resposne = await fetch(`http://192.168.0.102:3000/checkpass/${Email}/${Pass}`, {method: "GET"});
    const response_msg = await resposne.json();
    if(response_msg.message === "no password found") {
      setEmailError(true);
    }else if(response_msg.message === "password matched") {
      sessionStorage.setItem("email", Email);
      sessionStorage.setItem("key", response_msg.key);

      setroomId(response_msg.key);
      setislogin(true);
    }else {
      setPassError(true);
    }
  };

  const handle_signup = async () => {
    console.log("signup function");

    let emailError = false;
    let passError = false;
    let firstNameError = false;
    let lastNameError = false;

    if(!FirstName) {
      firstNameError = true;
    }

    if(!LastName) {
      lastNameError = true;
    }

    if(!Email) {
      emailError = true;
    }

    if(!Pass || Pass.length < 8) {
      passError = true;
    }

    setEmailError(emailError);
    setPassError(passError);
    setFirstNameError(firstNameError);
    setLastNameError(lastNameError);

    if(emailError || passError || firstNameError || lastNameError) {
      return;
    }

    const response = await fetch("http://192.168.0.102:3000/create", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({FirstName, LastName, Email, Pass})
    });
    const response_msg = await response.json();
    if(response_msg.message === "account created successfully") {
      sessionStorage.setItem("email", Email);
      sessionStorage.setItem("key", response_msg.key);

      setroomId(response_msg.key);
      setislogin(true);
    }else {
      setEmailError(true);
    }
  };

  const handle_update = async () => {
    console.log("update function");

    let emailError = false;
    let passError = false;

    if(!Email) {
      emailError = true;
    }

    if(!Pass || Pass.length < 8) {
      passError = true;
    }

    setEmailError(emailError);
    setPassError(passError);

    if(emailError || passError) {
      return;
    }

    const response = await fetch(`http://192.168.0.102:3000/updatepass/${Email}/${Pass}`, {method: "PUT"});
    const response_msg = await response.json();
    console.log(response_msg.message);
    if(response_msg.message === "update successful") {
      setLoginSignup("login");
    }else {
      setEmailError(true);
    }
  };

  return islogin ? 
  (<App email={Email} mykey={roomId} />)
  :
  (
    <Fragment>
      <div className={`login-container ${(LoginSignup === "login") ? "login" : (LoginSignup === "signup") ? "signup" : "forget"}`}>
        <ToggleButtonGroup value={LoginSignup} onChange={(e) => setLoginSignup(e.target.value)} sx={{marginTop: "20px", border: "1px solid white", width: "300px"}}>
          <ToggleButton value="login" sx={{width: "160px", color: "white", border: "1px solid white", "&.Mui-selected": {backgroundColor: "white", color: "black"}, "&:hover": {backgroundColor: "rgba(255,255,255,0.3)"}}}>LOGIN</ToggleButton>
          <ToggleButton value="forgot" sx={{width: "450px", color: "white", border: "1px solid white", "&.Mui-selected": {backgroundColor: "white", color: "black"}, "&:hover": {backgroundColor: "rgba(255,255,255,0.3)"}}}>FORGET PASSWORD</ToggleButton>
          <ToggleButton value="signup" sx={{width: "160px", color: "white", border: "1px solid white", "&.Mui-selected": {backgroundColor: "white", color: "black"}, "&:hover": {backgroundColor: "rgba(255,255,255,0.3)"}}}>SIGNUP</ToggleButton>
        </ToggleButtonGroup>
        <div>______________________________________</div>
        <form className="login-form">
          { (LoginSignup === "login") &&
            <Fragment>
              <TextField required label="Email" value={Email} error={EmailError} helperText={EmailError && "Email is required or incorrect"} onChange={(e) => setEmail(e.target.value)} sx={{width: "300px", "& label": { color: EmailError ? "red" : "white" }, "& label.Mui-focused": { color: EmailError ? "red" : "white" }, "& .MuiInputBase-input": { color: "white" }, "& .MuiOutlinedInput-notchedOutline": {  borderColor: EmailError ? "red !important" : "white !important" }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: EmailError ? "red !important" : "white !important" }, "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {borderColor: EmailError ? "red !important" : "white !important"}}}></TextField>
              <TextField required type="password" label="Password" value={Pass} error={PassError} helperText={PassError && "Password is required or incorrect"} onChange={(e) => setPass(e.target.value)} sx={{width: "300px", "& label": { color: PassError ? "red" : "white" }, "& label.Mui-focused": { color: PassError ? "red" : "white" }, "& .MuiInputBase-input": { color: "white" }, "& .MuiOutlinedInput-notchedOutline": { borderColor: PassError ? "red !important" : "white !important" }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: PassError ? "red !important" : "white !important" }, "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {borderColor: PassError ? "red !important" : "white !important"}}}></TextField>
            </Fragment>
          }
          { (LoginSignup === "forgot") &&
            <Fragment>
              <TextField required label="Email" value={Email} error={EmailError} helperText={EmailError && "Email is required or incorrect"} onChange={(e) => setEmail(e.target.value)} sx={{width: "300px", "& label": { color: EmailError ? "red" : "white" }, "& label.Mui-focused": { color: EmailError ? "red" : "white" }, "& .MuiInputBase-input": { color: "white" }, "& .MuiOutlinedInput-notchedOutline": {  borderColor: EmailError ? "red !important" : "white !important" }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: EmailError ? "red !important" : "white !important" }, "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {borderColor: EmailError ? "red !important" : "white !important"}}}></TextField>
              <TextField required type="password" label="New Password" value={Pass} error={PassError} helperText={PassError && "Password of 8 or more charecters is required"} onChange={(e) => setPass(e.target.value)} sx={{width: "300px", "& label": { color: PassError ? "red" : "white" }, "& label.Mui-focused": { color: PassError ? "red" : "white" }, "& .MuiInputBase-input": { color: "white" }, "& .MuiOutlinedInput-notchedOutline": { borderColor: PassError ? "red !important" : "white !important" }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: PassError ? "red !important" : "white !important" }, "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {borderColor: PassError ? "red !important" : "white !important"}}}></TextField>
            </Fragment>
          }
          { (LoginSignup === "signup") &&
            <Fragment>
              <TextField required label="First Name" value={FirstName} error={FirstNameError} helperText={FirstNameError && "First name is required"} onChange={(e) => setFirstName(e.target.value)} sx={{width: "300px", "& label": { color: FirstNameError ? "red" : "white" }, "& label.Mui-focused": { color: FirstNameError ? "red" : "white" }, "& .MuiInputBase-input": { color: "white" }, "& .MuiOutlinedInput-notchedOutline": { borderColor: FirstNameError ? "red !important" : "white !important" }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: FirstNameError ? "red !important" : "white !important" }, "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: FirstNameError ? "red !important" : "white !important" }}}></TextField>
              <TextField required label="Last Name" value={LastName} error={LastNameError} helperText={LastNameError && "Last name is required"} onChange={(e) => setLastName(e.target.value)} sx={{width: "300px", "& label": { color: LastNameError ? "red" : "white" }, "& label.Mui-focused": { color: LastNameError ? "red" : "white" }, "& .MuiInputBase-input": { color: "white" }, "& .MuiOutlinedInput-notchedOutline": { borderColor: LastNameError ? "red !important" : "white !important" }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: LastNameError ? "red !important" : "white !important" }, "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {borderColor: LastNameError ? "red !important" : "white !important"}}}></TextField>
              <TextField required label="Email" value={Email} error={EmailError} helperText={EmailError && "Email is required or already in use"} onChange={(e) => setEmail(e.target.value)} sx={{width: "300px", "& label": { color: EmailError ? "red" : "white" }, "& label.Mui-focused": { color: EmailError ? "red" : "white" }, "& .MuiInputBase-input": { color: "white" }, "& .MuiOutlinedInput-notchedOutline": {  borderColor: EmailError ? "red !important" : "white !important" }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: EmailError ? "red !important" : "white !important" }, "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {borderColor: EmailError ? "red !important" : "white !important"}}}></TextField>
              <TextField required type="password" label="Password" value={Pass} error={PassError} helperText={PassError && "Password of 8 or more charecters is required"} onChange={(e) => setPass(e.target.value)} sx={{width: "300px", "& label": { color: PassError ? "red" : "white" }, "& label.Mui-focused": { color: PassError ? "red" : "white" }, "& .MuiInputBase-input": { color: "white" }, "& .MuiOutlinedInput-notchedOutline": { borderColor: PassError ? "red !important" : "white !important" }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: PassError ? "red !important" : "white !important" }, "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {borderColor: PassError ? "red !important" : "white !important"}}}></TextField>
            </Fragment>
          }
        </form>
        <div style={{marginTop:"2px"}}>______________________________________</div>
        <Button ref={submit_btn} variant="contained" color="success" size="large" sx={{width: "300px", marginTop: "15px"}} onClick={(LoginSignup === "login") ? handle_login : (LoginSignup === "signup") ? handle_signup : handle_update}>{LoginSignup === "login" ? "Login" : LoginSignup === "signup" ? "Signup" : "Update"}</Button>
      </div>
    </Fragment>
  );
};

export default Login;