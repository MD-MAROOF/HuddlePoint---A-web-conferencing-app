import React, { useEffect, useRef, useState } from 'react'
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import "../styles/videoComponent.css";

const server_url = "http://localhost:8000";

var connections = {};

const peerConfigConnections = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302" }
    ]
}

export default function VideoMeetComponent() {

    var socketRef = useRef();
    let socketIdRef = useRef();

    let localVideoRef = useRef();

    let [videoAvailable, setVideoAvailable] = useState(true);
    let [audioAvailable, setAudioAvailable] = useState(true);
    let [video, setVideo] = useState();
    let [audio, setAudio] = useState();
    let [screen, setScreen] = useState();
    let [showModal, setShowModal] = useState();
    let [screenAvailable, setScreenAvailable] = useState();
    let [messages, setMessages] = useState([]);
    let [message, setMessage] = useState("");
    let [newMessages, setNewMessages] = useState(0);
    let [askForUsername, setAskForUsername] = useState(true);
    let [username, setUsername] = useState("");


    const videoRef = useRef([]);

    let [videos, setVideos] = useState([]);

    // if(isChrome() === false){

    // }


    const getPermissions = async () => {
        try {
            const videoPermission = await navigator.mediaDevices.getUserMedia({video: true});

            if(videoPermission){
                setVideoAvailable(true);
            }
            else{
                setVideoAvailable(false);
            }

            const audioPermission = await navigator.mediaDevices.getUserMedia({audio: true});

            if (videoPermission) {
                setAudioAvailable(true);
            } else {
                setAudioAvailable(false);
            }


            if (navigator.mediaDevices.getDisplayMedia) {
                setScreenAvailable(true);
            } else {
                setScreenAvailable(false);
            }
            
            if (videoAvailable || audioAvailable) {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({video: videoAvailable, audio: audioAvailable});

                if (userMediaStream) {
                    window.localStream = userMediaStream;

                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = userMediaStream;
                    }
                }
            }
        } catch (err) {
            console.log(err);
        }
    }


    useEffect(() => {
        getPermissions();
    }, [])

    let getUserMediaSuccess = (stream) => {

    }

    let getUserMedia = () => {
        if((video && videoAvailable) || (audio && audioAvailable)){
            navigator.mediaDevices.getUserMedia({video: video, audio: audio})
            .then(() =>{ }) // This is todo for getUserMediaSuccess
            .then((stream) => { })
            .catch((err) => console.log(err));
        }
        else{
            try{
               
                    let tracks = localVideoRef.current.srcObject.getTracks();
                    tracks.forEach(track => track.stop());
            }
            catch(err){

            }
        }
    }


    useEffect(() => {
        if(video != undefined && audio != undefined){
            getUserMedia(); 
        }
    }, [video, audio]);

    let getUserMedia = () => {
        try{
            const userMediaStream = await navigator.mediaDevices.getUserMedia({video: video, audio: audio});
        }
    }

    let getMedia = () =>{
        setVideo(videoAvailable);
        setAudio(audioAvailable);
        getAudio()
      //  connectToSocketServer();
    }

    let connect = () => {
        setAskForUsername(false);
        getMedia();
    }

    return (
        <div>
            {askForUsername === true ? <div>
                <h2> Enter into Lobby</h2>

                <TextField id="outlined-basic" label="Username" value={username} onChange={e => setUsername(e.target.value)} variant="outlined" />
                <Button variant="contained" onClick={connect}>Connect</Button>


                <div>
                    <video ref={localVideoRef} autoPlay muted> </video>
                </div>

            </div> : <></>}
        </div>
    )
}
