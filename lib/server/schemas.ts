import { z } from "zod";

export const createSessionBodySchema = z.object({
  prompt: z.string().min(1, "Prompt is required.").trim(),
});

export const expandNodeBodySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("submit"),
    nodeId: z.string().min(1, "Node ID is required."),
    prompt: z.string().min(1, "Prompt is required.").trim(),
  }),
  z.object({
    mode: z.literal("specify"),
    parentNodeId: z.string().min(1, "Parent node ID is required."),
    prompt: z.string().min(1, "Prompt is required.").trim(),
  }),
]);

export type CreateSessionBody = z.infer<typeof createSessionBodySchema>;
export type ExpandNodeBody = z.infer<typeof expandNodeBodySchema>;
