import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import styles from "./HomePage.module.css";

const API = "http://localhost:8000/api/v1/users";

const generateCode = () => Math.random().toString(36).substring(2, 10).toUpperCase();

const HomePage = () => {
    const [joinCode, setJoinCode] = useState("");
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const { token, logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await axios.get(`${API}/get_all_activity`, {
                    headers: { authorization: token }
                });
                setHistory(res.data.meetings || []);
            } catch {
                setHistory([]);
            } finally {
                setHistoryLoading(false);
            }
        };
        fetchHistory();
    }, [token]);

    const startMeeting = () => {
        const code = generateCode();
        navigate(`/meet/${code}`);
    };

    const joinMeeting = () => {
        if (!joinCode.trim()) return;
        navigate(`/meet/${joinCode.trim().toUpperCase()}`);
    };

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
    };

    return (
        <div className={styles.page}>
            <nav className={styles.nav}>
                <span className={styles.logo}>HuddlePoint</span>
                <button className={styles.logoutBtn} onClick={handleLogout}>Sign Out</button>
            </nav>

            <main className={styles.main}>
                <div className={styles.actions}>
                    <div className={styles.actionCard}>
                        <h2>New Meeting</h2>
                        <p>Start an instant meeting with a unique room code.</p>
                        <button className={styles.btnPrimary} onClick={startMeeting}>
                            + New Meeting
                        </button>
                    </div>

                    <div className={styles.actionCard}>
                        <h2>Join a Meeting</h2>
                        <p>Enter a meeting code to join an existing room.</p>
                        <div className={styles.joinRow}>
                            <input
                                className={styles.input}
                                type="text"
                                placeholder="Enter code (e.g. A1B2C3D4)"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && joinMeeting()}
                            />
                            <button className={styles.btnPrimary} onClick={joinMeeting}>
                                Join
                            </button>
                        </div>
                    </div>
                </div>

                <section className={styles.history}>
                    <h2 className={styles.historyTitle}>Meeting History</h2>
                    {historyLoading ? (
                        <p className={styles.muted}>Loading history...</p>
                    ) : history.length === 0 ? (
                        <div className={styles.emptyState}>
                            <span>📋</span>
                            <p>No meetings yet. Start or join one above!</p>
                        </div>
                    ) : (
                        <div className={styles.historyList}>
                            {history.map((m) => (
                                <div key={m._id} className={styles.historyItem}>
                                    <div className={styles.historyCode}>{m.meetingCode}</div>
                                    <div className={styles.historyDate}>{formatDate(m.date)}</div>
                                    <button
                                        className={styles.rejoinBtn}
                                        onClick={() => navigate(`/meet/${m.meetingCode}`)}
                                    >
                                        Rejoin
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

export default HomePage;
