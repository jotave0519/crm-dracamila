import { Request, Response } from "express";
import multer from "multer";
import * as patientAttachmentRepository from "../../repositories/patientAttachmentRepository";
import * as userRepository from "../../repositories/userRepository";
import * as storage from "../../integrations/supabaseStorageClient";
import { logger } from "../../utils/logger";

const SCOPE = "api.patientAttachment";

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

export const uploadMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE_BYTES } }).single("file");

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_");
}

const CATEGORIES = ["foto", "exame", "documento"];

export async function listAttachments(req: Request, res: Response): Promise<void> {
  try {
    const evolutionId = typeof req.query.evolutionId === "string" ? req.query.evolutionId : undefined;
    const items = await patientAttachmentRepository.listByPatient(req.params.id, evolutionId);
    const withUrls = await Promise.all(
      items.map(async (item) => ({ ...item, url: await storage.getSignedUrl(item.storage_path) }))
    );
    res.json({ items: withUrls });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar anexos", err);
    res.status(500).json({ error: "Erro ao listar anexos." });
  }
}

export async function uploadAttachment(req: Request, res: Response): Promise<void> {
  try {
    const patient = await userRepository.findById(req.params.id);
    if (!patient) {
      res.status(404).json({ error: "Paciente nao encontrado." });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Arquivo obrigatorio." });
      return;
    }

    const category = String(req.body.category || "");
    if (!CATEGORIES.includes(category)) {
      res.status(400).json({ error: "category deve ser 'foto', 'exame' ou 'documento'." });
      return;
    }

    const fileName = sanitizeFileName(file.originalname);
    const path = await storage.uploadPatientFile(patient.id, fileName, file.mimetype, file.buffer);
    const attachment = await patientAttachmentRepository.create({
      userId: patient.id,
      category: category as "foto" | "exame" | "documento",
      fileName,
      storagePath: path,
      mimeType: file.mimetype || null,
      sizeBytes: file.size || null,
      evolutionId: req.body.evolution_id || null,
    });

    res.status(201).json({ ...attachment, url: await storage.getSignedUrl(attachment.storage_path) });
  } catch (err) {
    logger.error(SCOPE, "Erro ao enviar anexo", err);
    res.status(500).json({ error: "Erro ao enviar anexo." });
  }
}

export async function deleteAttachment(req: Request, res: Response): Promise<void> {
  try {
    const attachment = await patientAttachmentRepository.findById(req.params.attachmentId);
    if (!attachment || attachment.user_id !== req.params.id) {
      res.status(404).json({ error: "Anexo nao encontrado." });
      return;
    }

    await patientAttachmentRepository.remove(attachment.id);
    try {
      await storage.deletePatientFile(attachment.storage_path);
    } catch (err) {
      logger.warn(SCOPE, "Falha ao remover arquivo do storage (seguindo com a exclusao do registro)", { error: (err as Error).message });
    }

    res.json({ status: "deleted" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao excluir anexo", err);
    res.status(500).json({ error: "Erro ao excluir anexo." });
  }
}
