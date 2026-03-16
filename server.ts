import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = path.join(__dirname, "db.json");

async function initDB() {
  try {
    await fs.access(DB_FILE);
  } catch {
    const initialData = {
      users: [
        { id: "1", name: "Admin User", email: "admin@foodwaste.com", role: "admin", location: { lat: 40.7128, lng: -74.0060 } },
        { id: "2", name: "Green Bistro", email: "restaurant@foodwaste.com", role: "restaurant", location: { lat: 40.7306, lng: -73.9352 } },
        { id: "3", name: "City Shelter", email: "ngo@foodwaste.com", role: "ngo", location: { lat: 40.7580, lng: -73.9855 } },
        { id: "4", name: "John Volunteer", email: "volunteer@foodwaste.com", role: "volunteer", location: { lat: 40.7128, lng: -74.0060 } }
      ],
      foodListings: [],
      pickupRequests: []
    };
    await fs.writeFile(DB_FILE, JSON.stringify(initialData, null, 2));
  }
}

async function getDB() {
  const data = await fs.readFile(DB_FILE, "utf-8");
  return JSON.parse(data);
}

async function saveDB(data: any) {
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

async function startServer() {
  await initDB();
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/users", async (req, res) => {
    const db = await getDB();
    res.json(db.users);
  });

  app.get("/api/food", async (req, res) => {
    const db = await getDB();
    res.json(db.foodListings);
  });

  app.post("/api/food", async (req, res) => {
    const db = await getDB();
    const newListing = { ...req.body, id: Date.now().toString(), status: "AVAILABLE" };
    db.foodListings.push(newListing);
    await saveDB(db);
    res.json(newListing);
  });

  app.post("/api/request", async (req, res) => {
    const db = await getDB();
    const { food_id, ngo_id } = req.body;
    
    const food = db.foodListings.find((f: any) => f.id === food_id);
    if (food) {
      food.status = "REQUESTED";
      const newRequest = {
        id: Date.now().toString(),
        food_id,
        ngo_id,
        status: "REQUESTED",
        pickup_time: null,
        delivery_time: null
      };
      db.pickupRequests.push(newRequest);
      await saveDB(db);
      res.json(newRequest);
    } else {
      res.status(404).json({ error: "Food not found" });
    }
  });

  app.post("/api/assign-volunteer", async (req, res) => {
    const db = await getDB();
    const { request_id, volunteer_id } = req.body;
    const request = db.pickupRequests.find((r: any) => r.id === request_id);
    if (request) {
      request.volunteer_id = volunteer_id;
      request.status = "VOLUNTEER_ASSIGNED";
      const food = db.foodListings.find((f: any) => f.id === request.food_id);
      if (food) food.status = "VOLUNTEER_ASSIGNED";
      await saveDB(db);
      res.json(request);
    } else {
      res.status(404).json({ error: "Request not found" });
    }
  });

  app.post("/api/update-status", async (req, res) => {
    const db = await getDB();
    const { request_id, status } = req.body;
    const request = db.pickupRequests.find((r: any) => r.id === request_id);
    if (request) {
      request.status = status;
      const food = db.foodListings.find((f: any) => f.id === request.food_id);
      if (food) food.status = status;
      
      if (status === "PICKED_UP") request.pickup_time = new Date().toISOString();
      if (status === "DELIVERED") request.delivery_time = new Date().toISOString();
      
      await saveDB(db);
      res.json(request);
    } else {
      res.status(404).json({ error: "Request not found" });
    }
  });

  app.get("/api/requests", async (req, res) => {
    const db = await getDB();
    res.json(db.pickupRequests);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
