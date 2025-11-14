// src/routes/combosRoutes.js
import { Router } from "express";
import multer from "multer";
import { authTenant } from "../middlewares/authTenant.js";
import {
  getCombos,
  createCombo,
  updateCombo,
  deleteCombo,
  updateComboCover,
  createComboV2,
  updateComboV2,
} from "../controllers/combosController.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authTenant);

// v1 (compat)
router.get("/", getCombos);
router.post("/", createCombo);
router.put("/:id", updateCombo);
router.delete("/:id", deleteCombo);
router.put("/:id/cover", upload.single("image"), updateComboCover);

// v2 (N grupos)
router.post("/v2", createComboV2);
router.put("/v2/:id", updateComboV2);

export default router;
