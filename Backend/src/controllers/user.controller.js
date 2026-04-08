import httpStatus from "http-status";
import { User } from "../models/user.model.js";
import { Meeting } from "../models/meeting.model.js";
import bcrypt, { hash } from "bcrypt";
import crypto from "crypto";


const login = async (req, res) => {

    const { username, password } = req.body;

    if (!username || !password)
        return res.status(400).json({ message: "Please Provide" });

    try {

        const user = await User.findOne({ username });

        if (!user) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
        }

        let isPasswordCorrect = await bcrypt.compare(password, user.password);

        if (isPasswordCorrect) {
            let token = crypto.randomBytes(20).toString("hex");

            user.token = token;
            await user.save();
            return res.status(httpStatus.OK).json({ token, username: user.username, name: user.name });
        }
        else{
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid credentials" });
        }

    } catch (e) {
        return res.status(500).json({ message: `Something went wrong ${e}` });
    }
}


const register = async (req, res) => {
    const { name, username, password } = req.body;

    try {
        const existingUser = await User.findOne({ username });

        if (existingUser) {
            return res.status(httpStatus.FOUND).json({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name: name,
            username: username,
            password: hashedPassword
        });

        await newUser.save();
        res.status(httpStatus.CREATED).json({ message: " User registered " });
    }
    catch (e) {
        res.json({ message: `Something went wrong ${e}` });
    }
}

const addToActivity = async (req, res) => {
    const { meeting_code } = req.body;

    if (!meeting_code) {
        return res.status(400).json({ message: "Meeting code is required" });
    }

    try {
        const newMeeting = new Meeting({
            user_id: req.user._id.toString(),
            meetingCode: meeting_code
        });
        await newMeeting.save();
        return res.status(httpStatus.CREATED).json({ message: "Meeting added to activity" });
    } catch (e) {
        return res.status(500).json({ message: `Something went wrong: ${e}` });
    }
};

const getAllActivity = async (req, res) => {
    try {
        const meetings = await Meeting.find({ user_id: req.user._id.toString() }).sort({ date: -1 });
        return res.status(httpStatus.OK).json({ meetings });
    } catch (e) {
        return res.status(500).json({ message: `Something went wrong: ${e}` });
    }
};

export { login, register, addToActivity, getAllActivity };