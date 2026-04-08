import { User } from "../models/user.model.js";

const authMiddleware = async (req, res, next) => {
    const token = req.headers["authorization"];

    if (!token) {
        return res.status(401).json({ message: "No token provided" });
    }

    try {
        const user = await User.findOne({ token });
        if (!user) {
            return res.status(401).json({ message: "Invalid token" });
        }
        req.user = user;
        next();
    } catch (e) {
        return res.status(500).json({ message: "Auth error" });
    }
};

export default authMiddleware;
