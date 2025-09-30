// ref: https://js.langchain.com/docs/tutorials/rag

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from "@langchain/qdrant";
import { ConfigService } from '@nestjs/config';
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { pull } from "langchain/hub";
import { Annotation, StateGraph } from "@langchain/langgraph";
import { Document } from '@langchain/core/documents';


@Injectable()
export class ChatGoogleService implements OnModuleInit {
    private readonly model: ChatGoogleGenerativeAI;
    private readonly embeddings: OpenAIEmbeddings;
    private readonly COLLECTION_NAME = "rag-langchain";
    private vectorStore: QdrantVectorStore;

    constructor(
        private readonly configService: ConfigService
    ) {
        this.model = new ChatGoogleGenerativeAI({
            model: "gemini-2.0-flash",
            temperature: 0
        });
        this.embeddings = new OpenAIEmbeddings({
            model: "text-embedding-3-large"
        });
    }

    async onModuleInit() {
        this.vectorStore = await QdrantVectorStore.fromExistingCollection(this.embeddings, {
            url: this.configService.getOrThrow("QDRANT_URL"),
            collectionName: this.COLLECTION_NAME,
        });

        const cheerioLoader = new CheerioWebBaseLoader(
            "https://www.prakashbanjade.com/",
            {
                selector: "p",
            }
        );

        const docs = await cheerioLoader.load();

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000, chunkOverlap: 200
        });
        const allSplits = await splitter.splitDocuments(docs);

        // Index chunks
        await this.vectorStore.addDocuments(allSplits)
    }

    async query(query: string) {
        // Define prompt for question-answering
        const promptTemplate = await pull<ChatPromptTemplate>("rlm/rag-prompt");

        // Define state for application
        const InputStateAnnotation = Annotation.Root({
            question: Annotation<string>,
        });

        const StateAnnotation = Annotation.Root({
            question: Annotation<string>,
            context: Annotation<Document[]>,
            answer: Annotation<string>,
            needsRetrieval: Annotation<boolean>,
        });

        // Define application steps
        const retrieve = async (state: typeof InputStateAnnotation.State) => {
            console.log("Retrieving...")
            const retrievedDocs = await this.vectorStore.similaritySearch(state.question)
            console.log("Retrieved")
            return { context: retrievedDocs };
        };
        
        // Add a routing node that classifies the question
        const route = async (state: typeof InputStateAnnotation.State) => {
            const systemTemplate = "Given the user question below, determine if it requires looking up information from our document database about Prakash Banjade - a fullstack developer from Nepal, or if it can be answered directly with general knowledge.";
            
            const promptTemplate = ChatPromptTemplate.fromMessages([
                ["system", systemTemplate],
                ["system", `Respond with ONLY one word: "retrieve" or "direct"`],
                ["user", "Question: {question}"],
            ]);
            
            const promptValue = await promptTemplate.format({
                question: state.question,
            });
            
            const response = await this.model.invoke(promptValue);
            const decision = response.content.toString().toLowerCase().trim();
            
            return { needsRetrieval: decision === "retrieve" };
        };

        // Modify generate to handle cases without context
        const generate = async (state: typeof StateAnnotation.State) => {
            if (state.context && state.context.length > 0) {
                // Use retrieved context
                const docsContent = state.context.map(doc => doc.pageContent).join("\n");
                const messages = await promptTemplate.invoke({
                    question: state.question,
                    context: docsContent
                });
                const response = await this.model.invoke(messages);
                return { answer: response.content };
            } else {
                // Answer directly without context
                const response = await this.model.invoke(state.question);
                return { answer: response.content };
            }
        };

        // Compile application and test
        const graph = new StateGraph(StateAnnotation)
            .addNode("route", route)
            .addNode("retrieve", retrieve)
            .addNode("generate", generate)
            .addEdge("__start__", "route")
            .addConditionalEdges(
                "route",
                (state) => state.needsRetrieval ? "retrieve" : "generate"
            )
            .addEdge("retrieve", "generate")
            .addEdge("generate", "__end__")
            .compile();

        const result = await graph.invoke({ question: query });

        return result;
    }



}
