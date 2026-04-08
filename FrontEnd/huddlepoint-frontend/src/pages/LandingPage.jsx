import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./LandingPage.module.css";

const LandingPage = () => {
    const navigate = useNavigate();
    const { token } = useAuth();

    return (
        <div className={styles.container}>
            <nav className={styles.nav}>
                <span className={styles.logo}>HuddlePoint</span>
                <div className={styles.navLinks}>
                    {token ? (
                        <button className={styles.btnPrimary} onClick={() => navigate("/home")}>
                            Dashboard
                        </button>
                    ) : (
                        <>
                            <button className={styles.btnGhost} onClick={() => navigate("/login")}>
                                Sign In
                            </button>
                            <button className={styles.btnPrimary} onClick={() => navigate("/register")}>
                                Get Started
                            </button>
                        </>
                    )}
                </div>
            </nav>

            <main className={styles.hero}>
                <div className={styles.badge}>Video Conferencing, Reimagined</div>
                <h1 className={styles.headline}>
                    Meet, Collaborate &<br />Connect — Instantly
                </h1>
                <p className={styles.subtext}>
                    HuddlePoint brings crystal-clear video calls, real-time chat, and<br />
                    seamless screen sharing to your browser. No downloads needed.
                </p>
                <div className={styles.cta}>
                    <button className={styles.btnPrimary} onClick={() => navigate(token ? "/home" : "/register")}>
                        Start a Meeting
                    </button>
                    <button className={styles.btnGhost} onClick={() => navigate("/login")}>
                        Join with a Code
                    </button>
                </div>
            </main>

            <section className={styles.features}>
                <div className={styles.feature}>
                    <span className={styles.featureIcon}>🎥</span>
                    <h3>HD Video</h3>
                    <p>Crystal-clear video with adaptive quality based on your connection.</p>
                </div>
                <div className={styles.feature}>
                    <span className={styles.featureIcon}>💬</span>
                    <h3>Live Chat</h3>
                    <p>Send messages during meetings. Chat history persists for the session.</p>
                </div>
                <div className={styles.feature}>
                    <span className={styles.featureIcon}>🔒</span>
                    <h3>Secure Rooms</h3>
                    <p>Every meeting gets a unique code. Only invited people can join.</p>
                </div>
                <div className={styles.feature}>
                    <span className={styles.featureIcon}>📋</span>
                    <h3>Meeting History</h3>
                    <p>Track all your past meetings with timestamps in your dashboard.</p>
                </div>
            </section>

            <footer className={styles.footer}>
                <p>© 2025 HuddlePoint. Built with MERN + WebRTC.</p>
            </footer>
        </div>
    );
};

export default LandingPage;
