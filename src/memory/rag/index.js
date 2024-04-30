import { OllamaEmbeddings } from "@langchain/community";

export const ollamaEmbeddings = new OllamaEmbeddings({
  baseUrl: "http://127.0.0.1:11434",
  model: "tinydolphin",
});
