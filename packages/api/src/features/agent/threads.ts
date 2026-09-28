import z from "zod";
import { protectedProcedure } from "../../context";
import { mapAgentEnvironmentError } from "./routing";
import { agentService } from "./service";

export const threadsRouter = {
	list: protectedProcedure
		.route({
			method: "GET",
			path: "/agent/threads",
			tags: ["Agent"],
			operationId: "listAgentThreads",
			summary: "List agent threads",
		})
		.use(mapAgentEnvironmentError)
		.handler(({ context }) => agentService.threads.list({ userId: context.user.id })),

	start: protectedProcedure
		.route({
			method: "POST",
			path: "/agent/threads",
			tags: ["Agent"],
			operationId: "startAgentThread",
			summary: "Start a conversation about a document",
			description:
				"Starts an assistant conversation about one resume or cover letter, using the given tested provider or the default one. The assistant reads the document and proposes edits; it never changes the document itself.",
		})
		.input(
			z
				.object({
					resumeId: z.string().min(1).optional(),
					coverLetterId: z.string().min(1).optional(),
					aiProviderId: z.string().optional(),
				})
				.refine((input) => Boolean(input.resumeId) !== Boolean(input.coverLetterId), {
					message: "Give a resume or a cover letter.",
				}),
		)
		.use(mapAgentEnvironmentError)
		.handler(({ context, input }) => agentService.threads.start({ userId: context.user.id, ...input })),

	get: protectedProcedure
		.route({
			method: "GET",
			path: "/agent/threads/{id}",
			tags: ["Agent"],
			operationId: "getAgentThread",
			summary: "Get agent thread",
		})
		.input(z.object({ id: z.string() }))
		.use(mapAgentEnvironmentError)
		.handler(({ context, input }) => agentService.threads.get({ id: input.id, userId: context.user.id })),

	update: protectedProcedure
		.route({
			method: "PATCH",
			path: "/agent/threads/{id}",
			tags: ["Agent"],
			operationId: "updateAgentThread",
			summary: "Switch a conversation's model",
		})
		.input(z.object({ id: z.string(), aiProviderId: z.string().min(1) }))
		.use(mapAgentEnvironmentError)
		.handler(({ context, input }) =>
			agentService.threads.update({ id: input.id, userId: context.user.id, aiProviderId: input.aiProviderId }),
		),

	delete: protectedProcedure
		.route({
			method: "DELETE",
			path: "/agent/threads/{id}",
			tags: ["Agent"],
			operationId: "deleteAgentThread",
			summary: "Delete agent thread",
		})
		.input(z.object({ id: z.string() }))
		.output(z.void())
		.use(mapAgentEnvironmentError)
		.handler(({ context, input }) => agentService.threads.delete({ id: input.id, userId: context.user.id })),
};
