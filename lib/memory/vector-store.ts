/**
 * Vector Store using HNSW (Hierarchical Navigable Small World)
 * Fast approximate nearest neighbor search for semantic similarity
 *
 * IMPORTANT: Uses dynamic import for hnswlib-node to avoid bundling
 * native binaries in webpack. Only works server-side.
 */

import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { getEmbeddingDimensions } from "./embeddings";

// Type for HierarchicalNSW (imported dynamically)
type HierarchicalNSW = any;

export interface VectorMetadata {
  id: string;
  agentId?: string;
  userId?: string;
  content: string;
  role: "user" | "assistant" | "system";
  timestamp: number;
  messageId?: string;
  emotions?: string[];
  relationLevel?: string;
  [key: string]: any;
}

export interface SearchResult {
  id: string;
  similarity: number;
  metadata: VectorMetadata;
}

const VECTOR_STORE_DIR = "./.vector-store";
const EMBEDDING_DIMENSIONS = getEmbeddingDimensions();

/**
 * Dynamic import of hnswlib-node to avoid webpack bundling issues
 */
let HierarchicalNSWClass: any = null;
async function getHierarchicalNSW() {
  if (typeof window !== "undefined") {
    throw new Error("Vector store can only be used on the server side");
  }

  if (!HierarchicalNSWClass) {
    const hnswModule = await import("hnswlib-node");
    HierarchicalNSWClass = hnswModule.HierarchicalNSW;
  }

  return HierarchicalNSWClass;
}

/**
 * Vector Store class for managing embeddings and similarity search
 */
export class VectorStore {
  private index: HierarchicalNSW | null = null;
  private metadata: Map<string, VectorMetadata> = new Map();
  private idToLabel: Map<string, number> = new Map();
  private labelToId: Map<number, string> = new Map();
  private nextLabel: number = 0;
  private storeId: string;
  private indexPath: string;
  private metadataPath: string;
  private initialized: boolean = false;

  constructor(storeId: string) {
    this.storeId = storeId;
    this.indexPath = path.join(VECTOR_STORE_DIR, `${storeId}.index`);
    this.metadataPath = path.join(VECTOR_STORE_DIR, `${storeId}.metadata.json`);
  }

  /**
   * Initialize the vector store
   */
  async initialize(maxElements: number = 10000): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure directory exists
      await fs.mkdir(VECTOR_STORE_DIR, { recursive: true });

      // Try to load existing index
      const indexExists = await this.fileExists(this.indexPath);
      const metadataExists = await this.fileExists(this.metadataPath);

      if (indexExists && metadataExists) {
        await this.load();
      } else {
        // Create new index with dynamic import
        const HNSWClass = await getHierarchicalNSW();
        this.index = new HNSWClass("cosine", EMBEDDING_DIMENSIONS);
        this.index.initIndex(maxElements);
        console.log(
          `[VectorStore] Created new index for ${this.storeId} with ${maxElements} max elements`
        );
      }

      this.initialized = true;
    } catch (error) {
      console.error(`[VectorStore] Error initializing ${this.storeId}:`, error);
      throw error;
    }
  }

  /**
   * Add a vector to the store
   */
  async add(
    embedding: number[],
    metadata: Omit<VectorMetadata, "id">
  ): Promise<string> {
    if (!this.initialized || !this.index) {
      await this.initialize();
    }

    const id = uuidv4();
    const label = this.nextLabel++;

    try {
      // Add to HNSW index
      this.index!.addPoint(embedding, label);

      // Store metadata
      const fullMetadata = { id, ...metadata } as VectorMetadata;
      this.metadata.set(id, fullMetadata);
      this.idToLabel.set(id, label);
      this.labelToId.set(label, id);

      console.log(`[VectorStore] Added vector ${id} (label: ${label})`);

      return id;
    } catch (error) {
      console.error(`[VectorStore] Error adding vector:`, error);
      throw error;
    }
  }

  /**
   * Add multiple vectors in batch
   */
  async addBatch(
    items: Array<{ embedding: number[]; metadata: Omit<VectorMetadata, "id"> }>
  ): Promise<string[]> {
    const ids: string[] = [];

    for (const item of items) {
      const id = await this.add(item.embedding, item.metadata);
      ids.push(id);
    }

    return ids;
  }

  /**
   * Search for similar vectors
   */
  async search(
    queryEmbedding: number[],
    k: number = 5,
    filter?: (metadata: VectorMetadata) => boolean
  ): Promise<SearchResult[]> {
    if (!this.initialized || !this.index) {
      await this.initialize();
    }

    if (this.metadata.size === 0) {
      return [];
    }

    try {
      // Search in HNSW index
      const searchK = Math.min(k * 3, this.metadata.size); // Fetch more to allow filtering
      const result = this.index!.searchKnn(queryEmbedding, searchK);

      // Map results to metadata
      const results: SearchResult[] = [];

      for (let i = 0; i < result.neighbors.length; i++) {
        const label = result.neighbors[i];
        const distance = result.distances[i];
        const id = this.labelToId.get(label);

        if (!id) continue;

        const metadata = this.metadata.get(id);
        if (!metadata) continue;

        // Apply filter if provided
        if (filter && !filter(metadata)) {
          continue;
        }

        // Convert distance to similarity (cosine distance -> cosine similarity)
        const similarity = 1 - distance;

        results.push({
          id,
          similarity,
          metadata,
        });

        if (results.length >= k) break;
      }

      return results;
    } catch (error) {
      console.error(`[VectorStore] Error searching:`, error);
      return [];
    }
  }

  /**
   * Get vector by ID
   */
  getById(id: string): VectorMetadata | null {
    return this.metadata.get(id) || null;
  }

  /**
   * Delete vector by ID
   */
  async delete(id: string): Promise<boolean> {
    const label = this.idToLabel.get(id);
    if (label === undefined) {
      return false;
    }

    // Note: hnswlib-node doesn't support deletion, so we just remove metadata
    // The vector remains in the index but won't be returned in searches
    this.metadata.delete(id);
    this.idToLabel.delete(id);
    this.labelToId.delete(label);

    return true;
  }

  /**
   * Get total number of vectors
   */
  size(): number {
    return this.metadata.size;
  }

  /**
   * Clear all vectors
   */
  async clear(): Promise<void> {
    this.metadata.clear();
    this.idToLabel.clear();
    this.labelToId.clear();
    this.nextLabel = 0;

    if (this.index) {
      const HNSWClass = await getHierarchicalNSW();
      this.index = new HNSWClass("cosine", EMBEDDING_DIMENSIONS);
      this.index.initIndex(10000);
    }
  }

  /**
   * Save index and metadata to disk
   */
  async save(): Promise<void> {
    if (!this.initialized || !this.index) {
      return;
    }

    try {
      await fs.mkdir(VECTOR_STORE_DIR, { recursive: true });

      // Save HNSW index
      this.index.writeIndexSync(this.indexPath);

      // Save metadata
      const metadataObj = {
        metadata: Array.from(this.metadata.entries()),
        idToLabel: Array.from(this.idToLabel.entries()),
        labelToId: Array.from(this.labelToId.entries()),
        nextLabel: this.nextLabel,
      };

      await fs.writeFile(
        this.metadataPath,
        JSON.stringify(metadataObj, null, 2),
        "utf-8"
      );

      console.log(`[VectorStore] Saved ${this.storeId} to disk`);
    } catch (error) {
      console.error(`[VectorStore] Error saving ${this.storeId}:`, error);
      throw error;
    }
  }

  /**
   * Load index and metadata from disk
   */
  async load(): Promise<void> {
    try {
      // Load HNSW index with dynamic import
      const HNSWClass = await getHierarchicalNSW();
      this.index = new HNSWClass("cosine", EMBEDDING_DIMENSIONS);
      this.index.readIndexSync(this.indexPath);

      // Load metadata
      const metadataJson = await fs.readFile(this.metadataPath, "utf-8");
      const metadataObj = JSON.parse(metadataJson);

      this.metadata = new Map(metadataObj.metadata);
      this.idToLabel = new Map(metadataObj.idToLabel);
      this.labelToId = new Map(
        metadataObj.labelToId.map(([k, v]: [string, string]) => [
          Number(k),
          v,
        ])
      );
      this.nextLabel = metadataObj.nextLabel;

      console.log(
        `[VectorStore] Loaded ${this.storeId} with ${this.metadata.size} vectors`
      );
    } catch (error) {
      console.error(`[VectorStore] Error loading ${this.storeId}:`, error);
      throw error;
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// Global store instances (one per agent)
const stores = new Map<string, VectorStore>();

/**
 * Get or create a vector store for an agent
 */
export async function getVectorStore(agentId: string): Promise<VectorStore> {
  let store = stores.get(agentId);

  if (!store) {
    store = new VectorStore(agentId);
    await store.initialize();
    stores.set(agentId, store);
  }

  return store;
}

/**
 * Save all vector stores
 */
export async function saveAllStores(): Promise<void> {
  const promises = Array.from(stores.values()).map((store) => store.save());
  await Promise.all(promises);
}

// Auto-save every 5 minutes
setInterval(
  () => {
    saveAllStores().catch((error) =>
      console.error("[VectorStore] Auto-save error:", error)
    );
  },
  5 * 60 * 1000
);

// Save on process exit
process.on("beforeExit", () => {
  saveAllStores().catch((error) =>
    console.error("[VectorStore] Exit save error:", error)
  );
});
