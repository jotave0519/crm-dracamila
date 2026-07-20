import { Request, Response } from "express";

export function getMe(req: Request, res: Response): void {
  res.json(req.staff);
}
