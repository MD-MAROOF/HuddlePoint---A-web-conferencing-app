import React, { useEffect, useRef, useState } from 'react'
import { io } from "socket.io-client";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import styles from "../styles/videoComponent.module.css";

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
                    <video className={styles.meetUserVideo} ref={localVideoRef} autoPlay muted playsInline> </video>

                    {videos.map((video) => (
                        <div key={video.socketId}>
                            <h2> {video.socketId}</h2>

                            <video
                                data-socket={video.socketId}
                                ref={ref => {
                                    if (ref && video.stream) {
                                        ref.srcObject = video.stream;
                                        ref.play?.().catch(() => { });
                                    }
                                }}
                                autoPlay
                                playsInline
                            ></video>
                        </div>
                    ))}

                </div>
            }
        </div>
    )
}
