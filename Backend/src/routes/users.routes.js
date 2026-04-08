import { Router } from "express";
import { login, register, addToActivity, getAllActivity } from "../controllers/user.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = Router();

router.route("/login").post(login);
router.route("/register").post(register);
router.route("/add_to_activity").post(authMiddleware, addToActivity);
router.route("/get_all_activity").get(authMiddleware, getAllActivity);

export default router;
