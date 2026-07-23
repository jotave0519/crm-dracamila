import { Router } from "express";
import { getAiSettings, getStatus as getAiStatus, previewReactivationCampaign, sendReactivationCampaign, updateAiSettings } from "../controllers/api/aiSettingsController";
import { createException, deleteException, listExceptions, updateException } from "../controllers/api/businessHourExceptionController";
import { createSlot, deleteSlot } from "../controllers/api/businessHourSlotController";
import { ensureConversation, getConversation, listConversations, sendMessage, updateStatus } from "../controllers/api/conversationController";
import { createEvolution, deleteEvolution, listEvolutions, updateEvolution } from "../controllers/api/clinicalEvolutionController";
import { getDashboard } from "../controllers/api/dashboardController";
import { createCategory, deleteCategory, listCategories, updateCategory } from "../controllers/api/financialCategoryController";
import { createTransaction, deleteTransaction, getMonthlyChart, getSummary, listTransactions, updateTransaction } from "../controllers/api/financialTransactionController";
import { createInventoryItem, deleteInventoryItem, getSummary as getInventorySummary, listInventory, updateInventoryItem } from "../controllers/api/inventoryController";
import { createMovement, listMovements } from "../controllers/api/inventoryMovementController";
import { getMe } from "../controllers/api/meController";
import { deleteAttachment, listAttachments, uploadAttachment, uploadMiddleware } from "../controllers/api/patientAttachmentController";
import { createPatient, deletePatient, getPatient, getPatientConversations, getPatientHistory, listPatients, updatePatient } from "../controllers/api/patientController";
import { getReminders } from "../controllers/api/reminderController";
import { getReport } from "../controllers/api/reportController";
import { cancelSchedule, confirmSchedule, createSchedule, listSchedules, rescheduleSchedule, updateOutcome, updateScheduleTreatmentPlan } from "../controllers/api/scheduleController";
import { getSettings, updateSettings } from "../controllers/api/settingsController";
import { createTreatmentPlan, deleteTreatmentPlan, getCurrentPlan, listByPatient as listTreatmentPlansByPatient, updateTreatmentPlan } from "../controllers/api/treatmentPlanController";
import { createTreatmentType, deleteTreatmentType, listTreatmentTypes, updateTreatmentType } from "../controllers/api/treatmentTypeController";
import { createTimelineNote, deleteTimelineNote, getTimeline } from "../controllers/api/timelineController";
import { disconnect, getQrCode, getStatus, reconnect } from "../controllers/api/whatsappController";
import { requireAuth } from "../middleware/requireAuth";

export const apiRouter = Router();

apiRouter.use(requireAuth);

apiRouter.get("/me", getMe);

apiRouter.get("/dashboard", getDashboard);

apiRouter.get("/patients", listPatients);
apiRouter.get("/patients/:id", getPatient);
apiRouter.get("/patients/:id/history", getPatientHistory);
apiRouter.get("/patients/:id/conversations", getPatientConversations);
apiRouter.post("/patients", createPatient);
apiRouter.patch("/patients/:id", updatePatient);
apiRouter.delete("/patients/:id", deletePatient);

apiRouter.get("/patients/:id/attachments", listAttachments);
apiRouter.post("/patients/:id/attachments", uploadMiddleware, uploadAttachment);
apiRouter.delete("/patients/:id/attachments/:attachmentId", deleteAttachment);

apiRouter.get("/patients/:id/treatment-plans", listTreatmentPlansByPatient);
apiRouter.get("/patients/:id/treatment-plans/current", getCurrentPlan);
apiRouter.post("/patients/:id/treatment-plans", createTreatmentPlan);
apiRouter.patch("/treatment-plans/:id", updateTreatmentPlan);
apiRouter.delete("/treatment-plans/:id", deleteTreatmentPlan);

apiRouter.get("/patients/:id/timeline", getTimeline);
apiRouter.post("/patients/:id/timeline-notes", createTimelineNote);
apiRouter.delete("/timeline-notes/:id", deleteTimelineNote);

apiRouter.get("/schedules", listSchedules);
apiRouter.post("/schedules", createSchedule);
apiRouter.delete("/schedules/:id", cancelSchedule);
apiRouter.patch("/schedules/:id/outcome", updateOutcome);
apiRouter.patch("/schedules/:id/confirm", confirmSchedule);
apiRouter.patch("/schedules/:id/reschedule", rescheduleSchedule);
apiRouter.patch("/schedules/:id/treatment-plan", updateScheduleTreatmentPlan);

apiRouter.get("/patients/:id/evolutions", listEvolutions);
apiRouter.post("/patients/:id/evolutions", createEvolution);
apiRouter.patch("/evolutions/:id", updateEvolution);
apiRouter.delete("/evolutions/:id", deleteEvolution);

apiRouter.get("/conversations", listConversations);
apiRouter.get("/conversations/:id", getConversation);
apiRouter.post("/conversations/:id/messages", sendMessage);
apiRouter.patch("/conversations/:id/status", updateStatus);
apiRouter.post("/patients/:id/conversations/ensure", ensureConversation);

apiRouter.get("/treatment-types", listTreatmentTypes);
apiRouter.post("/treatment-types", createTreatmentType);
apiRouter.patch("/treatment-types/:id", updateTreatmentType);
apiRouter.delete("/treatment-types/:id", deleteTreatmentType);

apiRouter.get("/settings", getSettings);
apiRouter.patch("/settings", updateSettings);

apiRouter.get("/business-hours/exceptions", listExceptions);
apiRouter.post("/business-hours/exceptions", createException);
apiRouter.patch("/business-hours/exceptions/:id", updateException);
apiRouter.delete("/business-hours/exceptions/:id", deleteException);
apiRouter.post("/business-hours/slots", createSlot);
apiRouter.delete("/business-hours/slots/:id", deleteSlot);

apiRouter.get("/ai-settings", getAiSettings);
apiRouter.patch("/ai-settings", updateAiSettings);
apiRouter.get("/ai-settings/status", getAiStatus);
apiRouter.get("/ai-settings/reactivation-campaign/preview", previewReactivationCampaign);
apiRouter.post("/ai-settings/reactivation-campaign/send", sendReactivationCampaign);

apiRouter.get("/whatsapp/status", getStatus);
apiRouter.get("/whatsapp/qrcode", getQrCode);
apiRouter.post("/whatsapp/disconnect", disconnect);
apiRouter.post("/whatsapp/reconnect", reconnect);

apiRouter.get("/inventory/summary", getInventorySummary);
apiRouter.get("/inventory", listInventory);
apiRouter.post("/inventory", createInventoryItem);
apiRouter.patch("/inventory/:id", updateInventoryItem);
apiRouter.delete("/inventory/:id", deleteInventoryItem);
apiRouter.get("/inventory/:id/movements", listMovements);
apiRouter.post("/inventory/:id/movements", createMovement);

apiRouter.get("/reminders", getReminders);
apiRouter.get("/reports", getReport);

apiRouter.get("/financial-transactions", listTransactions);
apiRouter.post("/financial-transactions", createTransaction);
apiRouter.patch("/financial-transactions/:id", updateTransaction);
apiRouter.delete("/financial-transactions/:id", deleteTransaction);
apiRouter.get("/financial-summary", getSummary);
apiRouter.get("/financial-chart", getMonthlyChart);

apiRouter.get("/financial-categories", listCategories);
apiRouter.post("/financial-categories", createCategory);
apiRouter.patch("/financial-categories/:id", updateCategory);
apiRouter.delete("/financial-categories/:id", deleteCategory);
