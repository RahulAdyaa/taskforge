const { z } = require('zod');

const createTaskSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().optional(),
  dueDate: z.coerce.date().refine(date => date > new Date(), { message: "Due date must be in the future" }).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  assigneeId: z.string().cuid().optional().nullable(),
});

const payload = {
  title: "To learn AI",
  description: "",
  dueDate: "2026-05-05T00:00:00.000Z",
  priority: "HIGH",
  assigneeId: null
};

try {
  createTaskSchema.parse(payload);
  console.log("Success");
} catch (e) {
  console.log(JSON.stringify(e.errors, null, 2));
}
