import { Request, Response } from "express";
import * as googleCalendar from "../../integrations/googleCalendarClient";
import * as scheduleRepository from "../../repositories/scheduleRepository";
import * as userRepository from "../../repositories/userRepository";
import { logger } from "../../utils/logger";

const SCOPE = "api.patient";

export async function listPatients(req: Request, res: Response): Promise<void> {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;
    const result = await userRepository.listAll({ search, limit, offset });
    res.json(result);
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar pacientes", err);
    res.status(500).json({ error: "Erro ao listar pacientes." });
  }
}

export async function getPatient(req: Request, res: Response): Promise<void> {
  try {
    const patient = await userRepository.findById(req.params.id);
    if (!patient) {
      res.status(404).json({ error: "Paciente nao encontrado." });
      return;
    }
    res.json(patient);
  } catch (err) {
    logger.error(SCOPE, "Erro ao buscar paciente", err);
    res.status(500).json({ error: "Erro ao buscar paciente." });
  }
}

/** Histórico de sessões do paciente, incluindo as notas de evolução de cada uma. */
export async function getPatientHistory(req: Request, res: Response): Promise<void> {
  try {
    const patient = await userRepository.findById(req.params.id);
    if (!patient) {
      res.status(404).json({ error: "Paciente nao encontrado." });
      return;
    }
    const schedules = await scheduleRepository.findAllByUserId(patient.id);
    res.json({ patient, schedules });
  } catch (err) {
    logger.error(SCOPE, "Erro ao carregar historico do paciente", err);
    res.status(500).json({ error: "Erro ao carregar historico do paciente." });
  }
}

export async function createPatient(req: Request, res: Response): Promise<void> {
  try {
    const { name, phone, email, birth_date } = req.body;
    if (!name || !phone) {
      res.status(400).json({ error: "name e phone sao obrigatorios." });
      return;
    }
    const patient = await userRepository.createPatient({ name, phone, email, birth_date });
    res.status(201).json(patient);
  } catch (err) {
    logger.error(SCOPE, "Erro ao criar paciente", err);
    res.status(500).json({ error: "Erro ao criar paciente." });
  }
}

const UPDATABLE_FIELDS = [
  "name",
  "phone",
  "email",
  "birth_date",
  "active",
  "do_not_contact",
  "profession",
  "health_insurance",
  "emergency_contact_name",
  "emergency_contact_phone",
  "main_complaint",
  "medical_conditions",
  "surgeries",
  "medications",
  "allergies",
  "pain_scale",
  "muscle_strength",
  "mobility",
  "treatment_goals",
  "notes",
] as const;

export async function updatePatient(req: Request, res: Response): Promise<void> {
  try {
    const params: Record<string, unknown> = {};
    for (const field of UPDATABLE_FIELDS) {
      if (field in req.body) params[field] = req.body[field];
    }
    const patient = await userRepository.updatePatient(req.params.id, params);
    res.json(patient);
  } catch (err) {
    logger.error(SCOPE, "Erro ao atualizar paciente", err);
    res.status(500).json({ error: "Erro ao atualizar paciente." });
  }
}

export async function deletePatient(req: Request, res: Response): Promise<void> {
  try {
    const patient = await userRepository.findById(req.params.id);
    if (!patient) {
      res.status(404).json({ error: "Paciente nao encontrado." });
      return;
    }

    const activeSchedules = await scheduleRepository.findActiveSchedulesByUser(patient.id);
    for (const schedule of activeSchedules) {
      if (!schedule.google_event_id) continue;
      try {
        await googleCalendar.cancelEvent(schedule.google_event_id);
      } catch (err) {
        logger.warn(SCOPE, "Falha ao cancelar evento no Google Calendar (seguindo com a exclusao)", { scheduleId: schedule.id, error: (err as Error).message });
      }
    }

    await userRepository.deleteUser(patient.id);
    res.json({ status: "deleted" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao excluir paciente", err);
    res.status(500).json({ error: "Erro ao excluir paciente." });
  }
}
