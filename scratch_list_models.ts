import { GoogleGenAI } from "@google/genai";
import { getAiEnv } from "./lib/env";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const env = getAiEnv();
  const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const response = await client.models.list();
  const fs = require("fs");
  fs.writeFileSync("models.json", JSON.stringify(response, null, 2));
}

main().catch(console.error);
