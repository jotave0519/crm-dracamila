import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 5000),

  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",

  evolutionApiUrl: process.env.EVOLUTION_API_URL || "",
  evolutionApiKey: process.env.EVOLUTION_API_KEY || "",
  evolutionInstanceName: process.env.EVOLUTION_INSTANCE_NAME || "",
  webhookSecret: process.env.WEBHOOK_SECRET || "",

  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || "",

  googleCalendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
  googleCredentialsPath: process.env.GOOGLE_CREDENTIALS_PATH || "credentials.json",
  googleTokenPath: process.env.GOOGLE_TOKEN_PATH || "token.json",
  googleCredentialsJson: process.env.GOOGLE_CREDENTIALS_JSON || "",
  googleTokenJson: process.env.GOOGLE_TOKEN_JSON || "",
};
