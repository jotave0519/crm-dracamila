import * as userRepository from "../repositories/userRepository";
import { User } from "../types";

/** fallbackName so deve vir de um cadastro manual real (CRM) - nunca do pushName do WhatsApp. */
export async function getOrCreateUserByPhone(phone: string, fallbackName?: string): Promise<User> {
  return userRepository.findOrCreateUser(phone, fallbackName || "");
}
