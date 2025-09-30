import { Injectable } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";

@Injectable()
export class ChatGoogleService {
    private readonly model: ChatGoogleGenerativeAI;

    constructor() {
        this.model = new ChatGoogleGenerativeAI({
            model: "gemini-2.0-flash",
            temperature: 0
        });
    }

    async chatWithoutPromptTemplate(userMessage: string) {
        const systemTemplate = "Translate the following from English into {language}";

        const promptTemplate = ChatPromptTemplate.fromMessages([
            ["system", systemTemplate],
            ["user", "{text}"],
        ]);

        const promptValue = await promptTemplate.invoke({
            language: "italian",
            text: "hi!",
        });

        const result = await this.model.invoke(promptValue);

        /*
        // streaming
        const stream = await this.model.stream(messages);

        const chunks: AIMessageChunk[] = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
            console.log(`${chunk.content}|`);
        }
        */

        return result.content;
    }

    async chatWithPromptTemplate(userMessage: string) {
        const systemTemplate = "Translate the following from English into {language}";

        const promptTemplate = ChatPromptTemplate.fromMessages([
            ["system", systemTemplate],
            ["user", "{text}"],
        ]);

        const promptValue = await promptTemplate.invoke({
            language: "Nepali",
            text: userMessage,
        });

        const result = await this.model.invoke(promptValue);

        return result.content;
    }
}
