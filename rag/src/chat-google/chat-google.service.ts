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
import { Annotation, StateGraph, CompiledStateGraph } from "@langchain/langgraph";
import { Document } from '@langchain/core/documents';
import { MemorySaver } from "@langchain/langgraph";


@Injectable()
export class ChatGoogleService implements OnModuleInit {
    private readonly model: ChatGoogleGenerativeAI;
    private readonly embeddings: OpenAIEmbeddings;
    private readonly COLLECTION_NAME = "rag-langchain";
    private vectorStore: QdrantVectorStore;
    private checkpointer: MemorySaver = new MemorySaver();
    private compiledGraph: CompiledStateGraph<any, any, any>;
    private promptTemplate: ChatPromptTemplate;

    // Define state annotations as class properties
    private readonly InputStateAnnotation = Annotation.Root({
        question: Annotation<string>,
    });

    private readonly StateAnnotation = Annotation.Root({
        question: Annotation<string>,
        context: Annotation<Document[]>,
        answer: Annotation<string>,
        needsRetrieval: Annotation<boolean>,
    });

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
        // Initialize vector store
        await this.initializeVectorStore();

        // Load and index documents
        await this.loadAndIndexDocuments();

        // Load prompt template
        this.promptTemplate = await pull<ChatPromptTemplate>("rlm/rag-prompt");

        // Compile the graph once
        await this.compileGraph();
    }

    private async initializeVectorStore() {
        this.vectorStore = await QdrantVectorStore.fromExistingCollection(this.embeddings, {
            url: this.configService.getOrThrow("QDRANT_URL"),
            collectionName: this.COLLECTION_NAME,
        });
    }

    private async loadAndIndexDocuments() {
        const cheerioLoader = new CheerioWebBaseLoader(
            "https://www.prakashbanjade.com/",
            {
                selector: "p",
            }
        );

        const docs = await cheerioLoader.load();

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200
        });
        const allSplits = await splitter.splitDocuments(docs);

        // Index chunks
        await this.vectorStore.addDocuments(allSplits);
    }

    private async compileGraph() {
        const graph = new StateGraph(this.StateAnnotation)
            .addNode("route", this.routeNode.bind(this))
            .addNode("retrieve", this.retrieveNode.bind(this))
            .addNode("generate", this.generateNode.bind(this))
            .addEdge("__start__", "route")
            .addConditionalEdges(
                "route",
                (state) => state.needsRetrieval ? "retrieve" : "generate"
            )
            .addEdge("retrieve", "generate")
            .addEdge("generate", "__end__");

        this.compiledGraph = graph.compile({
            checkpointer: this.checkpointer
        });
    }

    // Node: Route decision
    private async routeNode(state: typeof this.InputStateAnnotation.State) {
        const systemTemplate = "Given the user question below, determine if it requires looking up information from our document database about Prakash Banjade - a fullstack developer from Nepal, or if it can be answered directly with general knowledge.";

        const routePromptTemplate = ChatPromptTemplate.fromMessages([
            ["system", systemTemplate],
            ["system", `Respond with ONLY one word: "retrieve" or "direct"`],
            ["user", "Question: {question}"],
        ]);

        const promptValue = await routePromptTemplate.format({
            question: state.question,
        });

        const response = await this.model.invoke(promptValue);
        const decision = response.content.toString().toLowerCase().trim();

        console.log(`Routing decision: ${decision}`);
        return { needsRetrieval: decision === "retrieve" };
    }

    // Node: Retrieve documents
    private async retrieveNode(state: typeof this.InputStateAnnotation.State) {
        console.log("Retrieving documents...");
        const retrievedDocs = await this.vectorStore.similaritySearch(state.question);
        console.log(`Retrieved ${retrievedDocs.length} documents`);
        return { context: retrievedDocs };
    }

    // Node: Generate answer
    private async generateNode(state: typeof this.StateAnnotation.State) {
        if (state.context && state.context.length > 0) {
            console.log("Generating answer with context...");
            // Use retrieved context
            const docsContent = state.context.map(doc => doc.pageContent).join("\n");
            const messages = await this.promptTemplate.invoke({
                question: state.question,
                context: docsContent
            });
            const response = await this.model.invoke(messages);
            return { answer: response.content };
        } else {
            console.log("Generating answer without context...");
            // Answer directly without context
            const response = await this.model.invoke(state.question);
            return { answer: response.content };
        }
    }

    async query(query: string) {
        const threadConfig = {
            configurable: { thread_id: "conversation_1" },
        };

        const result = await this.compiledGraph.invoke(
            { question: query },
            threadConfig
        );

        return result;
    }
}