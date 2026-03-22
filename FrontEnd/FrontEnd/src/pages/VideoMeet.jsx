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
    let [video, setVideo] = useState([]);
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
            const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true });

            if (videoPermission) {
                setVideoAvailable(true);
            }
            else {
                setVideoAvailable(false);
            }

            const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true });

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
                const userMediaStream = await navigator.mediaDevices.getUserMedia({ video: videoAvailable, audio: audioAvailable });

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

    let getUserMedia = async () => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            try {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({ video: video, audio: audio });
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = userMediaStream;
                }
            } catch (err) {
                console.log(err);
            }
        } else {
            try {
                let tracks = localVideoRef.current?.srcObject?.getTracks() || [];
                tracks.forEach(track => track.stop());
            } catch (err) {
                console.log(err);
            }
        }
    }


    useEffect(() => {
        if (video != undefined && audio != undefined) {
            getUserMedia();
        }
    }, [video, audio]);

    //TODO: 
    let gotMessageFromServer = (FromId, message) => {

    }

    //TODO: add message
    let addMessage = () => {

    }


    let connectToSocketServer = () => {
        socketRef.current = io.connect(server_url, { secure: false });

        socketRef.current.on('signal', gotMessageFromServer);
        socketRef.current.on("connect", ()=>{
            socketRef.current.emit("join-call", window.location.href);
            socketIdRef.curret = socketRef.current.id;
            socketRef.current.on("chat-message", addMessage);
            socketRef.current.on("user-left", (id)=>{
                setVideo((videos)=>videos.filter((video)=>video.socketId != id))
            })

            socketRef.current.on("user-joined", (id, clients) => {
                clients.forEach((socketListId) =>{
                    connections[socketListId] = new RTCPeerConnection(peerConfigConnections);

                    connections[socketListId].onicecandidate = (event) => {
                        if(event.candidate != null){
                            socketRef.current.emit('signal', socketListId, JSON.stringify({ ice: event.candidate }))
                        }
                    }

                    connections[socketListId].onaddstream = (event) => {

                        let videoExists = videoRef.current.find(video => video.socketId == socketListId);

                        if(videoExists){
                            setVideo(videos => {
                                const updatedVideos = videos.map(video => 
                                    video.socketId == socketListId ? {...video, stream: event.stream} : video
                                );
                                videoRef.current = updatedVideos;
                                return updatedVideos;
                            })
                        }
                        else{
                             let newVideo = {
                                socketId : socketListId,
                                stream : event.stream, 
                                autoPlay:true,
                                playsinline:true,
                             }

                             setVideos(videos => {
                                const updatedVideos = [...videos, newVideo];
                                videoRef.current = updatedVideos;
                                return updatedVideos;
                             });
                        }
                    };

                    if(window.localStream != undefined && window.localStream != null){
                        connections[socketListId].addStream(window.localStream);
                    }
                    else{
                        //TODO: Black Silence 

                    }
                })

                if(id === socketIdRef.current)
                {
                    for(let id2 in connections)
                    {
                        if(id2 === socketIdRef.current)
                            continue;

                        try{
                            connections[id2].addStream(window.localStream);
                        }
                        catch(err){

                        }

                        connections[id2].createOffer().then((description) =>{
                            connections[id2].setLocalDescription(description)
                            .then(() => {
                                socketRef.current.emit("signal", id2, JSON.stringify({"sdp": connections[id2].localDescription}))
                            })
                            .catch(e => console.log(e));
                        })
                    }
                }
            })
        })
    };


    let getMedia = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable);
        getAudio()
        //  connectToSocketServer();
    }

    const getAudio = () => {
        // Placeholder to avoid ReferenceError; audio availability is handled in getPermissions.
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
