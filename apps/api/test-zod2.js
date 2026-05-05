const { z } = require('zod');

const createTaskSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().optional(),
  dueDate: z.coerce.date().refine(date => date > new Date(), { message: "Due date must be in the future" }).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  assigneeId: z.string().cuid().optional().nullable(),
});

const payload1 = {
  title: "To learn AI",
  description: "",
  dueDate: "2026-05-05T00:00:00.000Z",
  priority: "High",
  assigneeId: "cmostje8r0000lyjdmj0h8fm2"
};

const payload2 = {
  title: "To learn AI",
  description: "",
  dueDate: "2026-05-05", // What if the frontend sends this? wait, toISOString() is used.
  priority: "HIGH",
  assigneeId: "cmostje8r0000lyjdmj0h8fm2"
};

try {
  createTaskSchema.parse(payload2);
  console.log("Success 2");
} catch (e) {
  console.log("Error 2", JSON.stringify(e.errors, null, 2));
}
