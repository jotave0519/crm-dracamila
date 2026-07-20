import { Router } from "express";
import { createException, deleteException, listExceptions } from "../controllers/api/businessHourExceptionController";
import { createSlot, deleteSlot } from "../controllers/api/businessHourSlotController";
import { getConversation, listConversations, sendMessage, updateStatus } from "../controllers/api/conversationController";
import { getDashboard } from "../controllers/api/dashboardController";
import { getMe } from "../controllers/api/meController";
import { deleteAttachment, listAttachments, uploadAttachment, uploadMiddleware } from "../controllers/api/patientAttachmentController";
import { createPatient, deletePatient, getPatient, getPatientHistory, listPatients, updatePatient } from "../controllers/api/patientController";
import { createPayment, deletePayment, listByPatient as listPaymentsByPatient } from "../controllers/api/paymentController";
import { cancelSchedule, confirmSchedule, createSchedule, listSchedules, updateEvolutionNote, updateOutcome, updateScheduleTreatmentPlan } from "../controllers/api/scheduleController";
import { getSettings, updateSettings } from "../controllers/api/settingsController";
import { createTreatmentPlan, deleteTreatmentPlan, listByPatient as listTreatmentPlansByPatient, updateTreatmentPlan } from "../controllers/api/treatmentPlanController";
import { createTreatmentType, deleteTreatmentType, listTreatmentTypes, updateTreatmentType } from "../controllers/api/treatmentTypeController";
import { disconnect, getQrCode, getStatus } from "../controllers/api/whatsappController";
import { requireAuth } from "../middleware/requireAuth";

export const apiRouter = Router();

apiRouter.use(requireAuth);

apiRouter.get("/me", getMe);

apiRouter.get("/dashboard", getDashboard);

apiRouter.get("/patients", listPatients);
apiRouter.get("/patients/:id", getPatient);
apiRouter.get("/patients/:id/history", getPatientHistory);
apiRouter.post("/patients", createPatient);
apiRouter.patch("/patients/:id", updatePatient);
apiRouter.delete("/patients/:id", deletePatient);

apiRouter.get("/patients/:id/attachments", listAttachments);
apiRouter.post("/patients/:id/attachments", uploadMiddleware, uploadAttachment);
apiRouter.delete("/patients/:id/attachments/:attachmentId", deleteAttachment);

apiRouter.get("/patients/:id/treatment-plans", listTreatmentPlansByPatient);
apiRouter.post("/patients/:id/treatment-plans", createTreatmentPlan);
apiRouter.patch("/treatment-plans/:id", updateTreatmentPlan);
apiRouter.delete("/treatment-plans/:id", deleteTreatmentPlan);

apiRouter.get("/patients/:id/payments", listPaymentsByPatient);
apiRouter.post("/patients/:id/payments", createPayment);
apiRouter.delete("/payments/:paymentId", deletePayment);

apiRouter.get("/schedules", listSchedules);
apiRouter.post("/schedules", createSchedule);
apiRouter.delete("/schedules/:id", cancelSchedule);
apiRouter.patch("/schedules/:id/outcome", updateOutcome);
apiRouter.patch("/schedules/:id/confirm", confirmSchedule);
apiRouter.patch("/schedules/:id/treatment-plan", updateScheduleTreatmentPlan);
apiRouter.patch("/schedules/:id/evolution-note", updateEvolutionNote);

apiRouter.get("/conversations", listConversations);
apiRouter.get("/conversations/:id", getConversation);
apiRouter.post("/conversations/:id/messages", sendMessage);
apiRouter.patch("/conversations/:id/status", updateStatus);

apiRouter.get("/treatment-types", listTreatmentTypes);
apiRouter.post("/treatment-types", createTreatmentType);
apiRouter.patch("/treatment-types/:id", updateTreatmentType);
apiRouter.delete("/treatment-types/:id", deleteTreatmentType);

apiRouter.get("/settings", getSettings);
apiRouter.patch("/settings", updateSettings);

apiRouter.get("/business-hours/exceptions", listExceptions);
apiRouter.post("/business-hours/exceptions", createException);
apiRouter.delete("/business-hours/exceptions/:id", deleteException);
apiRouter.post("/business-hours/slots", createSlot);
apiRouter.delete("/business-hours/slots/:id", deleteSlot);

apiRouter.get("/whatsapp/status", getStatus);
apiRouter.get("/whatsapp/qrcode", getQrCode);
apiRouter.post("/whatsapp/disconnect", disconnect);
