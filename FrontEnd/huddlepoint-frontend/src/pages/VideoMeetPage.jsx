import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import styles from "./VideoMeetPage.module.css";

const SERVER = "http://localhost:8000";
const API = "http://localhost:8000/api/v1/users";

const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
    ]
};

const VideoMeetPage = () => {
    const { meetingCode } = useParams();
    const navigate = useNavigate();
    const { token } = useAuth();

    const socketRef = useRef(null);
    const localVideoRef = useRef(null);
    const localStreamRef = useRef(null);
    const screenStreamRef = useRef(null);
    const peerConnectionsRef = useRef({});

    const [remoteStreams, setRemoteStreams] = useState({});
    const [remoteUsernames, setRemoteUsernames] = useState({});
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [username] = useState(() => localStorage.getItem("username") || "You");
    const chatEndRef = useRef(null);

    const createPeerConnection = useCallback((remoteSocketId) => {
        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socketRef.current?.emit("signal", remoteSocketId, {
                    type: "candidate",
                    candidate: event.candidate
                });
            }
        };

        pc.ontrack = (event) => {
            setRemoteStreams((prev) => ({
                ...prev,
                [remoteSocketId]: event.streams[0]
            }));
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === "failed" || pc.connectionState === "closed") {
                setRemoteStreams((prev) => {
                    const updated = { ...prev };
                    delete updated[remoteSocketId];
                    return updated;
                });
            }
        };

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current);
            });
        }

        peerConnectionsRef.current[remoteSocketId] = pc;
        return pc;
    }, []);

    useEffect(() => {
        let cancelled = false;

        const init = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
                localStreamRef.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            } catch {
                console.warn("Camera/mic not available, proceeding without.");
            }

            const socket = io(SERVER, { transports: ["websocket"] });
            socketRef.current = socket;

            socket.on("user-joined", async (newSocketId, roomConnections, userInfoMap) => {
                // Skip self — we don't create a peer connection to ourselves
                if (newSocketId === socket.id) return;

                // Track the remote user's display name
                if (userInfoMap?.[newSocketId]?.username) {
                    setRemoteUsernames((prev) => ({
                        ...prev,
                        [newSocketId]: userInfoMap[newSocketId].username
                    }));
                }

                // Existing users send an offer to the new participant
                const pc = createPeerConnection(newSocketId);
                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    socket.emit("signal", newSocketId, { type: "offer", sdp: pc.localDescription });
                } catch (e) {
                    console.error("Offer error:", e);
                }
            });

            socket.on("signal", async (fromId, message) => {
                let pc = peerConnectionsRef.current[fromId];

                if (message.type === "offer") {
                    if (!pc) pc = createPeerConnection(fromId);
                    try {
                        await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        socket.emit("signal", fromId, { type: "answer", sdp: pc.localDescription });
                    } catch (e) {
                        console.error("Answer error:", e);
                    }
                } else if (message.type === "answer") {
                    if (pc) {
                        try {
                            await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
                        } catch (e) {
                            console.error("Set remote answer error:", e);
                        }
                    }
                } else if (message.type === "candidate") {
                    if (pc) {
                        try {
                            await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
                        } catch {}
                    }
                }
            });

            socket.on("user-left", (socketId) => {
                if (peerConnectionsRef.current[socketId]) {
                    peerConnectionsRef.current[socketId].close();
                    delete peerConnectionsRef.current[socketId];
                }
                setRemoteStreams((prev) => {
                    const updated = { ...prev };
                    delete updated[socketId];
                    return updated;
                });
                setRemoteUsernames((prev) => {
                    const updated = { ...prev };
                    delete updated[socketId];
                    return updated;
                });
            });

            socket.on("chat-message", (data, sender, fromSocketId) => {
                // Don't add duplicates for our own messages (we add them optimistically)
                if (fromSocketId === socket.id) return;
                setMessages((prev) => [...prev, { sender, data, self: false }]);
            });

            socket.emit("join-call", meetingCode, username);

            try {
                await axios.post(
                    `${API}/add_to_activity`,
                    { meeting_code: meetingCode },
                    { headers: { authorization: token } }
                );
            } catch {}
        };

        init();

        return () => {
            cancelled = true;
            socketRef.current?.disconnect();
            localStreamRef.current?.getTracks().forEach((t) => t.stop());
            screenStreamRef.current?.getTracks().forEach((t) => t.stop());
            Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
        };
    }, [meetingCode, token, createPeerConnection, username]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendMessage = () => {
        if (!chatInput.trim()) return;
        socketRef.current?.emit("chat-message", chatInput.trim(), username);
        setMessages((prev) => [...prev, { sender: "You", data: chatInput.trim(), self: true }]);
        setChatInput("");
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach((t) => {
                t.enabled = !t.enabled;
            });
            setIsMuted((m) => !m);
        }
    };

    const toggleVideo = () => {
        if (isScreenSharing) return; // Don't toggle video while screen sharing
        if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach((t) => {
                t.enabled = !t.enabled;
            });
            setIsVideoOff((v) => !v);
        }
    };

    const stopScreenShare = useCallback(() => {
        screenStreamRef.current?.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;

        // Restore camera track in all peer connections
        const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
        Object.values(peerConnectionsRef.current).forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === "video");
            if (sender && cameraTrack) sender.replaceTrack(cameraTrack);
        });

        // Restore local preview to camera
        if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
        }

        setIsScreenSharing(false);
    }, []);

    const toggleScreenShare = async () => {
        if (isScreenSharing) {
            stopScreenShare();
            return;
        }

        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always" },
                audio: false
            });

            screenStreamRef.current = screenStream;
            const screenTrack = screenStream.getVideoTracks()[0];

            // Replace video track in all active peer connections
            Object.values(peerConnectionsRef.current).forEach((pc) => {
                const sender = pc.getSenders().find((s) => s.track?.kind === "video");
                if (sender) sender.replaceTrack(screenTrack);
            });

            // Show screen in local preview
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = screenStream;
            }

            // Handle user stopping via browser's built-in "Stop sharing" button
            screenTrack.addEventListener("ended", () => {
                stopScreenShare();
            });

            setIsScreenSharing(true);
        } catch (err) {
            if (err.name !== "NotAllowedError") {
                console.error("Screen share error:", err);
            }
        }
    };

    const copyCode = () => {
        navigator.clipboard.writeText(meetingCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const leaveMeeting = () => {
        navigate("/home");
    };

    const remoteEntries = Object.entries(remoteStreams);

    return (
        <div className={styles.page}>
            {/* Header */}
            <header className={styles.header}>
                <span className={styles.logo}>HuddlePoint</span>
                <button className={styles.codeBtn} onClick={copyCode} title="Copy meeting code">
                    {meetingCode} {copied ? "✓ Copied" : "📋"}
                </button>
                <div className={styles.headerRight}>
                    <span className={styles.participantCount}>
                        {1 + remoteEntries.length} participant{1 + remoteEntries.length !== 1 ? "s" : ""}
                    </span>
                </div>
            </header>

            <div className={styles.body}>
                {/* Video Grid */}
                <div className={`${styles.videoGrid} ${chatOpen ? styles.videoGridWithChat : ""}`}>
                    {/* Local video */}
                    <div className={`${styles.videoTile} ${isScreenSharing ? styles.screenShareTile : ""}`}>
                        <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className={`${styles.video} ${isVideoOff && !isScreenSharing ? styles.videoHidden : ""}`}
                        />
                        {isVideoOff && !isScreenSharing && <div className={styles.videoOff}>📷</div>}
                        <div className={styles.videoLabel}>
                            {username} {isMuted ? "🔇" : ""}
                            {isScreenSharing && <span className={styles.screenBadge}>Sharing screen</span>}
                        </div>
                    </div>

                    {/* Remote videos */}
                    {remoteEntries.map(([socketId, stream]) => (
                        <RemoteVideo
                            key={socketId}
                            stream={stream}
                            label={remoteUsernames[socketId] || "Participant"}
                        />
                    ))}

                    {remoteEntries.length === 0 && (
                        <div className={styles.waitingBanner}>
                            Waiting for others to join...
                        </div>
                    )}
                </div>

                {/* Chat panel */}
                {chatOpen && (
                    <div className={styles.chatPanel}>
                        <div className={styles.chatHeader}>
                            <span>Meeting Chat</span>
                            <button className={styles.closeChat} onClick={() => setChatOpen(false)}>✕</button>
                        </div>
                        <div className={styles.chatMessages}>
                            {messages.length === 0 && (
                                <p className={styles.noMessages}>No messages yet.</p>
                            )}
                            {messages.map((msg, i) => (
                                <div key={i} className={`${styles.message} ${msg.self ? styles.messageSelf : ""}`}>
                                    <span className={styles.msgSender}>{msg.sender}</span>
                                    <span className={styles.msgText}>{msg.data}</span>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div className={styles.chatInputRow}>
                            <input
                                className={styles.chatInput}
                                placeholder="Send a message..."
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                            />
                            <button className={styles.sendBtn} onClick={sendMessage}>Send</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Toolbar */}
            <div className={styles.toolbar}>
                <button
                    className={`${styles.toolBtn} ${isMuted ? styles.toolBtnOff : ""}`}
                    onClick={toggleMute}
                    title={isMuted ? "Unmute" : "Mute"}
                >
                    {isMuted ? "🔇" : "🎙️"}
                    <span>{isMuted ? "Unmute" : "Mute"}</span>
                </button>
                <button
                    className={`${styles.toolBtn} ${isVideoOff ? styles.toolBtnOff : ""}`}
                    onClick={toggleVideo}
                    title={isVideoOff ? "Start Video" : "Stop Video"}
                    disabled={isScreenSharing}
                >
                    {isVideoOff ? "📷" : "🎥"}
                    <span>{isVideoOff ? "Start Video" : "Stop Video"}</span>
                </button>
                <button
                    className={`${styles.toolBtn} ${isScreenSharing ? styles.toolBtnScreenShare : ""}`}
                    onClick={toggleScreenShare}
                    title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
                >
                    🖥️
                    <span>{isScreenSharing ? "Stop Share" : "Share Screen"}</span>
                </button>
                <button
                    className={`${styles.toolBtn} ${chatOpen ? styles.toolBtnActive : ""}`}
                    onClick={() => setChatOpen((o) => !o)}
                    title="Chat"
                >
                    💬
                    <span>Chat</span>
                </button>
                <button className={`${styles.toolBtn} ${styles.toolBtnLeave}`} onClick={leaveMeeting}>
                    📵
                    <span>Leave</span>
                </button>
            </div>
        </div>
    );
};

const RemoteVideo = ({ stream, label }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className={styles.videoTile}>
            <video ref={videoRef} autoPlay playsInline className={styles.video} />
            <div className={styles.videoLabel}>{label}</div>
        </div>
    );
};

export default VideoMeetPage;
