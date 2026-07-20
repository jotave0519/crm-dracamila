import { Router } from "express";
import { createException, deleteException, listExceptions } from "../controllers/api/businessHourExceptionController";
import { createSlot, deleteSlot } from "../controllers/api/businessHourSlotController";
import { getConversation, listConversations, sendMessage, updateStatus } from "../controllers/api/conversationController";
import { getDashboard } from "../controllers/api/dashboardController";
import { createTransaction, deleteTransaction, getMonthlyChart, getSummary, listTransactions, updateTransaction } from "../controllers/api/financialTransactionController";
import { createInventoryItem, deleteInventoryItem, listInventory, updateInventoryItem } from "../controllers/api/inventoryController";
import { getMe } from "../controllers/api/meController";
import { deleteAttachment, listAttachments, uploadAttachment, uploadMiddleware } from "../controllers/api/patientAttachmentController";
import { createPatient, deletePatient, getPatient, getPatientHistory, listPatients, updatePatient } from "../controllers/api/patientController";
import { getReminders } from "../controllers/api/reminderController";
import { getReport } from "../controllers/api/reportController";
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

apiRouter.get("/inventory", listInventory);
apiRouter.post("/inventory", createInventoryItem);
apiRouter.patch("/inventory/:id", updateInventoryItem);
apiRouter.delete("/inventory/:id", deleteInventoryItem);

apiRouter.get("/reminders", getReminders);
apiRouter.get("/reports", getReport);

apiRouter.get("/financial-transactions", listTransactions);
apiRouter.post("/financial-transactions", createTransaction);
apiRouter.patch("/financial-transactions/:id", updateTransaction);
apiRouter.delete("/financial-transactions/:id", deleteTransaction);
apiRouter.get("/financial-summary", getSummary);
apiRouter.get("/financial-chart", getMonthlyChart);
