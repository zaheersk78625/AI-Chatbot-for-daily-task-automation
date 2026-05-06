/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { taskService } from "./taskService";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const addTaskDeclaration: FunctionDeclaration = {
  name: "addTask",
  description: "Add a new task or reminder for the user.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "The title of the task" },
      description: { type: Type.STRING, description: "Detailed description or notes" },
      type: { type: Type.STRING, enum: ["task", "reminder"], description: "Whether it is a task or a timed reminder" },
      dueDate: { type: Type.STRING, description: "Optional due date or reminder time in ISO format" }
    },
    required: ["title", "type"]
  }
};

const openWebsiteDeclaration: FunctionDeclaration = {
  name: "openWebsite",
  description: "Open a specific website or app for the user.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: { type: Type.STRING, description: "The URL of the website to open" },
      name: { type: Type.STRING, description: "Human friendly name of the site" }
    },
    required: ["url"]
  }
};

const sendEmailDeclaration: FunctionDeclaration = {
  name: "sendEmail",
  description: "Draft or send an email.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      to: { type: Type.STRING, description: "Recipient email address" },
      subject: { type: Type.STRING, description: "Subject line" },
      body: { type: Type.STRING, description: "Email body content" }
    },
    required: ["to", "subject", "body"]
  }
};

export const geminiService = {
  async processMessage(message: string, history: any[] = []) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...history,
          { role: "user", parts: [{ text: message }] }
        ],
        config: {
          systemInstruction: `You are Aura, an elite AI task automation assistant. 
          Your goal is to help users manage their daily lives efficiently. 
          You can add tasks, set reminders, open websites, and draft emails.
          You also have access to real-time information via search. 
          Be concise, professional, and proactive.
          Current time is: ${new Date().toLocaleString()}`,
          tools: [
            { 
              functionDeclarations: [
                addTaskDeclaration, 
                openWebsiteDeclaration, 
                sendEmailDeclaration
              ] 
            },
            {
              googleSearch: {}
            }
          ]
        }
      });

      return response;
    } catch (error) {
      console.error("Gemini processing error:", error);
      throw error;
    }
  }
};
