import { type IRouter, Router } from "express";
import authRouter from "./auth";
import healthRouter from "./health";

const router: IRouter = Router();

router.use("/auth", authRouter);
router.use(healthRouter);

export default router;
