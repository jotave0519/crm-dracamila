import { Request, Response } from "express";
import * as timelineNoteRepository from "../../repositories/timelineNoteRepository";
import * as timelineService from "../../services/timelineService";
import { logger } from "../../utils/logger";

const SCOPE = "api.timeline";

export async function getTimeline(req: Request, res: Response): Promise<void> {
  try {
    const items = await timelineService.buildPatientTimeline(req.params.id);
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao montar linha do tempo", err);
    res.status(500).json({ error: "Erro ao montar linha do tempo." });
  }
}

export async function createTimelineNote(req: Request, res: Response): Promise<void> {
  try {
    const { note, event_date } = req.body;
    if (!note) {
      res.status(400).json({ error: "note e obrigatorio." });
      return;
    }
    const created = await timelineNoteRepository.create({ userId: req.params.id, staffId: req.staff!.id, eventDate: event_date || undefined, note });
    res.status(201).json(created);
  } catch (err) {
    logger.error(SCOPE, "Erro ao criar evento manual na linha do tempo", err);
    res.status(500).json({ error: "Erro ao criar evento manual na linha do tempo." });
  }
}

export async function deleteTimelineNote(req: Request, res: Response): Promise<void> {
  try {
    await timelineNoteRepository.remove(req.params.id);
    res.json({ status: "deleted" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao excluir evento manual da linha do tempo", err);
    res.status(500).json({ error: "Erro ao excluir evento manual da linha do tempo." });
  }
}
