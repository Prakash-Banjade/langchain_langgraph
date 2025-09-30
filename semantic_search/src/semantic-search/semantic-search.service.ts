import { Injectable } from '@nestjs/common';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ConfigService } from '@nestjs/config';
import { QdrantVectorStore } from "@langchain/qdrant";


@Injectable()
export class SemanticSearchService {
    private readonly COLLECTION = "documents";
    private embeddings: OpenAIEmbeddings<number[]>;
    private vectorStore: QdrantVectorStore;

    constructor(
        private readonly configService: ConfigService
    ) {
        this.embeddings = new OpenAIEmbeddings({
            model: "text-embedding-3-large"
        });
    }

    async load({ filePath }: { filePath: string }) {
        /**
         * Loading document | PDFLoader loads one Document object per PDF page
         */
        const loader = new PDFLoader(filePath);
        const docs = await loader.load();


        // split documents into chunks of 1000 characters with 200 characters of overlap between chunks
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });

        const allSplits = await textSplitter.splitDocuments(docs);

        const vectorStore = await QdrantVectorStore.fromExistingCollection(this.embeddings, {
            url: this.configService.getOrThrow("QDRANT_URL"),
            collectionName: this.COLLECTION,
        });

        await vectorStore.addDocuments(allSplits);

        this.vectorStore = vectorStore;
    }

    async search({
        query,
    }: {
        query: string,
    }) {
        const results = await this.vectorStore.similaritySearch(query, 1);

        return results;
    }
}
