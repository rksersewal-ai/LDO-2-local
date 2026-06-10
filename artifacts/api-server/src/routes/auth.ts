import { type IRouter, type Request, type Response, Router } from "express";

const router: IRouter = Router();

interface MockUser {
  id: string;
  username: string;
  name: string;
  designation: string;
  role: string;
  department: string;
  email: string;
}

// Mock users for demo (matches frontend credentials)
const MOCK_USERS: Record<string, { password: string; user: MockUser }> = {
  admin: {
    password: "admin123",
    user: {
      id: "user-admin-001",
      username: "admin",
      name: "System Administrator",
      designation: "Administrator",
      role: "admin",
      department: "IT",
      email: "admin@ldo2.local",
    },
  },
  "a.kowalski": {
    password: "ldo2pass",
    user: {
      id: "user-ak-001",
      username: "a.kowalski",
      name: "Adam Kowalski",
      designation: "Senior Engineer",
      role: "engineer",
      department: "Engineering",
      email: "a.kowalski@ldo2.local",
    },
  },
  "m.chen": {
    password: "ldo2pass",
    user: {
      id: "user-mc-001",
      username: "m.chen",
      name: "Ming Chen",
      designation: "Supervisor",
      role: "supervisor",
      department: "Operations",
      email: "m.chen@ldo2.local",
    },
  },
  "s.patel": {
    password: "ldo2pass",
    user: {
      id: "user-sp-001",
      username: "s.patel",
      name: "Sandeep Patel",
      designation: "Reviewer",
      role: "reviewer",
      department: "Quality",
      email: "s.patel@ldo2.local",
    },
  },
};

router.post("/login/", (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      detail: "Username and password are required",
    });
  }

  const credentials = MOCK_USERS[username];
  if (!credentials || credentials.password !== password) {
    return res.status(401).json({
      detail: "Invalid credentials. Please verify your username and password.",
    });
  }

  // Mock JWT token (not validated, just for demo)
  const token = `mock_jwt_${username}_${Date.now()}`;

  return res.json({
    token,
    user: credentials.user,
  });
});

router.post("/logout/", (_req: Request, res: Response) => {
  // Mock logout - just return success
  return res.json({ message: "Logged out successfully" });
});

export default router;
