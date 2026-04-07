import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Badge from "@mui/material/Badge";
import styles from "../styles/videoComponent.module.css";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";

const server_url = "http://localhost:8000";

var connections = {};

const peerConfigConnections = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302" }
    ]
}

export default function VideoMeetComponent() {

    const navigate = useNavigate();

    var socketRef = useRef();
    let socketIdRef = useRef();

    let localVideoRef = useRef();

    let [videoAvailable, setVideoAvailable] = useState(true);
    let [audioAvailable, setAudioAvailable] = useState(true);
    let [video, setVideo] = useState(false);
    let [audio, setAudio] = useState(false);
    let [screen, setScreen] = useState(false);
    let [showModal, setShowModal] = useState(false);
    let [screenAvailable, setScreenAvailable] = useState(false);
    let [messages, setMessages] = useState([]);
    let [message, setMessage] = useState("");
    let [newMessages, setNewMessages] = useState(0);
    let [askForUsername, setAskForUsername] = useState(true);
    let [username, setUsername] = useState("");


    const videoRef = useRef([]);

    let [videos, setVideos] = useState([]);

    /** Toolbar UI — toggles track.enabled only (don’t flip `video`/`audio` state or useEffect will re-call getUserMedia). */
    let [micUiOn, setMicUiOn] = useState(true);
    let [camUiOn, setCamUiOn] = useState(true);

    const toolbarIconSx = {
        color: "#1a1a1a",
        bgcolor: "#ffffff",
        border: "2px solid rgba(255,255,255,0.9)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
        width: 56,
        height: 56,
        "&:hover": { bgcolor: "#f0f0f0" },
    };

    const toggleMic = () => {
        const stream = window.localStream;
        if (!stream?.getAudioTracks().length) return;
        stream.getAudioTracks().forEach((t) => {
            t.enabled = !t.enabled;
        });
        setMicUiOn(stream.getAudioTracks()[0]?.enabled ?? false);
    };

    const toggleCamera = () => {
        const stream = window.localStream;
        if (!stream?.getVideoTracks().length) return;
        stream.getVideoTracks().forEach((t) => {
            t.enabled = !t.enabled;
        });
        setCamUiOn(stream.getVideoTracks()[0]?.enabled ?? false);
    };

    const handleLeaveCall = () => {
        try {
            socketRef.current?.disconnect();
        } catch (e) {
            console.log(e);
        }
        window.localStream?.getTracks().forEach((t) => t.stop());
        window.localStream = null;
        navigate("/");
    };

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

            if (audioPermission) {
                setAudioAvailable(true);
            } else {
                setAudioAvailable(false);
            }


            if (navigator.mediaDevices.getDisplayMedia) {
                setScreenAvailable(true);
            } else {
                setScreenAvailable(false);
            }

            if (videoPermission || audioPermission) {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

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

    const addLocalTracks = (pc) => {
        if (!window.localStream) return;
        window.localStream.getTracks().forEach(track => {
            pc.addTrack(track, window.localStream);
        });
    };

    const upsertRemoteStream = (socketListId, remoteStream) => {
        if (socketListId === socketIdRef.current) return;
        if (!remoteStream) return;
        setVideos((videos) => {
            const exists = videos.find(video => video.socketId === socketListId);
            if (exists) {
                const updatedVideos = videos.map(video =>
                    video.socketId === socketListId ? { ...video, stream: remoteStream } : video
                );
                videoRef.current = updatedVideos;
                return updatedVideos;
            }
            const updatedVideos = [
                ...videos,
                { socketId: socketListId, stream: remoteStream, autoPlay: true, playsinline: true },
            ];
            videoRef.current = updatedVideos;
            return updatedVideos;
        });
    };

    let getUserMediaSuccess = (stream) => {
        try {
            if (window.localStream && window.localStream !== stream) {
                window.localStream.getTracks().forEach(track => track.stop());
            }
        }
        catch (e) { console.log(e); }

        window.localStream = stream;
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play?.().catch(() => {});
        }

        for (let id in connections) {
            if (id === socketIdRef.current)
                continue;

            addLocalTracks(connections[id]);

            connections[id].createOffer().then((description) => {
                connections[id].setLocalDescription(description).then(() => {
                    if (socketRef.current?.emit) {
                        socketRef.current.emit("signal", id, JSON.stringify({ "sdp": connections[id].localDescription }))
                    }
                }).catch(e => console.log(e));
            })
        }
        stream.getTracks().forEach(track => track.onended = () => {
            setVideo(false);
            setAudio(false);

            try {
                let tracks = localVideoRef.current?.srcObject.getTracks()
                tracks.forEach(track => track.stop());
            } catch (e) { console.log(e); }

            //TODO: BLACKSILENCE

            let blackSilence = (...args) => new MediaStream([black(...args), silence(...args)]);
            window.localStream = blackSilence();
            localVideoRef.current.srcObject = window.localStream;



            for (let id in connections) {
                addLocalTracks(connections[id]);
                connections[id].createOffer().then((description) => {
                        connections[id].setLocalDescription(description)
                        .then(() => {
                            if (socketRef.current?.emit) {
                                socketRef.current.emit("signal", id, JSON.stringify({ "sdp": connections[id].localDescription }))
                            }
                        }).catch(e => console.log(e));
                });
            }
        });
    }

    let silence = () => {
        let ctx = new AudioContext();
        let oscillator = ctx.createOscillator();

        let dst = oscillator.connect(ctx.createMediaStreamDestination());

        oscillator.start();
        ctx.resume();
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false })
    }

    let black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height });

        canvas.getContext("2d").fillRect(0, 0, width, height);
        let stream = canvas.captureStream();
        return Object.assign(stream.getVideoTracks()[0], { enabled: false })
    }

    let getUserMedia = async () => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            try {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({ video: video, audio: audio });
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = userMediaStream;
                }
                window.localStream = userMediaStream;
                getUserMediaSuccess(userMediaStream);
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

    useEffect(() => {
        if (!askForUsername && localVideoRef.current && window.localStream) {
            localVideoRef.current.srcObject = window.localStream;
            localVideoRef.current.play?.().catch(() => {});
        }
    }, [askForUsername]);

    //TODO: 
    let gotMessageFromServer = (FromId, message) => {
        var signal = JSON.parse(message);

        if (FromId != socketIdRef.current) {
            if (!connections[FromId]) {
                connections[FromId] = new RTCPeerConnection(peerConfigConnections);
                connections[FromId].onicecandidate = (event) => {
                    if (event.candidate != null && socketRef.current?.emit) {
                        socketRef.current.emit('signal', FromId, JSON.stringify({ ice: event.candidate }))
                    }
                };
                connections[FromId].ontrack = (event) => {
                    const remoteStream = event.streams?.[0];
                    upsertRemoteStream(FromId, remoteStream);
                };
            }
            if (signal.sdp) {
                connections[FromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                    if (signal.sdp.type == "offer") {
                        connections[FromId].createAnswer().then((description) => {
                            connections[FromId].setLocalDescription(description).then(() => {
                                if (socketRef.current?.emit) {
                                    socketRef.current.emit("signal", FromId, JSON.stringify({ "sdp": connections[FromId].localDescription }))
                                }

                            }).catch(e => console.log(e));
                        }).catch(e => console.log(e));
                    }
                }).catch(e => console.log(e));
            }

            if (signal.ice) {
                connections[FromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e));
            }
        }

    }

    //TODO: add message
    let addMessage = () => {

    }


    let connectToSocketServer = () => {
        socketRef.current = io.connect(server_url, { secure: false });

        socketRef.current.on('signal', gotMessageFromServer);
        socketRef.current.on("connect", () => {
            socketRef.current.emit("join-call", window.location.href);
            socketIdRef.current = socketRef.current.id;
            socketRef.current.on("chat-message", addMessage);
            socketRef.current.on("user-left", (id) => {
                setVideos((videos) => videos.filter((video) => video.socketId != id))
            })

            socketRef.current.on("user-joined", (id, clients) => {
                clients.forEach((socketListId) => {
                    if (socketListId === socketIdRef.current) return;
                    if (connections[socketListId]) return;
                    connections[socketListId] = new RTCPeerConnection(peerConfigConnections);

                    connections[socketListId].onicecandidate = (event) => {
                        if (event.candidate != null) {
                            socketRef.current.emit('signal', socketListId, JSON.stringify({ ice: event.candidate }))
                        }
                    }

                    connections[socketListId].ontrack = (event) => {
                        const remoteStream = event.streams?.[0];
                        upsertRemoteStream(socketListId, remoteStream);
                    };

                    if (window.localStream != undefined && window.localStream != null) {
                        addLocalTracks(connections[socketListId]);
                    }
                    else {
                        //TODO: Black Silence 
                        let blackSilence = (...args) => new MediaStream([black(...args), silence(...args)]);
                        window.localStream = blackSilence();
                        addLocalTracks(connections[socketListId]);

                    }
                })

                if (id === socketIdRef.current) {
                    for (let id2 in connections) {
                        if (id2 === socketIdRef.current)
                            continue;

                        try {
                            addLocalTracks(connections[id2]);
                        }
                        catch (err) {

                        }

                        connections[id2].createOffer().then((description) => {
                        connections[id2].setLocalDescription(description)
                                .then(() => {
                                    if (socketRef.current?.emit) {
                                        socketRef.current.emit("signal", id2, JSON.stringify({ "sdp": connections[id2].localDescription }))
                                    }
                                })
                                .catch(e => console.log(e));
                        })
                    }
                }
            })
        })
    };


    let getMedia = async () => {
        setVideo(true);
        setAudio(true);
        getAudio();
        try {
            const userMediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            getUserMediaSuccess(userMediaStream);
        } catch (err) {
            console.log(err);
        }
        connectToSocketServer();
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
                    <video ref={localVideoRef} autoPlay muted playsInline> </video>
                </div>

            </div> :
                <div className={styles.meetVideoContainer}>
                    

                    <div className={styles.buttonContainers}>
                        <IconButton
                            size="large"
                            aria-label={micUiOn ? "Mute microphone" : "Unmute microphone"}
                            onClick={toggleMic}
                            sx={toolbarIconSx}
                        >
                            {micUiOn ? (
                                <MicIcon sx={{ fontSize: 28, color: "#1a1a1a" }} />
                            ) : (
                                <MicOffIcon sx={{ fontSize: 28, color: "#1a1a1a" }} />
                            )}
                        </IconButton>
                        <IconButton
                            size="large"
                            aria-label={camUiOn ? "Turn camera off" : "Turn camera on"}
                            onClick={toggleCamera}
                            sx={toolbarIconSx}
                        >
                            {camUiOn ? (
                                <VideocamIcon sx={{ fontSize: 28, color: "#1a1a1a" }} />
                            ) : (
                                <VideocamOffIcon sx={{ fontSize: 28, color: "#1a1a1a" }} />
                            )}
                        </IconButton>
                        <IconButton
                            size="large"
                            aria-label="Leave call"
                            onClick={handleLeaveCall}
                            sx={{
                                ...toolbarIconSx,
                                bgcolor: "#c62828",
                                color: "#fff",
                                border: "2px solid #e57373",
                                "&:hover": { bgcolor: "#b71c1c" },
                            }}
                        >
                            <CallEndIcon sx={{ fontSize: 28, color: "#fff" }} />
                        </IconButton>


                        {screenAvailable ? (
                            <>
                                <IconButton
                                    size="large"
                                    aria-label={screen ? "Stop sharing" : "Share screen"}
                                    sx={{
                                        width: 56,
                                        height: 56,
                                        color: "#fff",
                                        bgcolor: "#37474f",
                                        border: "2px solid rgba(255,255,255,0.35)",
                                        boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
                                        "&:hover": { bgcolor: "#455a64" },
                                    }}
                                >
                                    {screen ? (
                                        <StopScreenShareIcon sx={{ fontSize: 28, color: "#fff" }} />
                                    ) : (
                                        <ScreenShareIcon sx={{ fontSize: 28, color: "#fff" }} />
                                    )}
                                </IconButton>
                                <Badge badgeContent={newMessages} color="primary">
                                    <IconButton size="large" aria-label="Chat" sx={{ color: "#fff" }}>
                                        <ChatIcon />
                                    </IconButton>
                                </Badge>
                            </>
                        ) : null}
                    </div>


                    <video className = {styles.meetUserVideo} ref={localVideoRef} autoPlay muted playsInline> </video>

                    {videos.map((remote) => (
                        <div className={styles.conferenceView} key={remote.socketId}>
                            <h2> {remote.socketId}</h2>

                            <video
                                data-socket={remote.socketId}
                                ref={(ref) => {
                                    if (ref && remote.stream) {
                                        ref.srcObject = remote.stream;
                                        ref.play?.().catch(() => {});
                                    }
                                }}
                                autoPlay
                                playsInline
                            />
                        </div>
                    ))}

                </div>
            }
        </div>
    )
}
