import { clone } from '../../../../../src/main/tasks/tasks_clone';
import { isActiveSchedule } from '../../../../../src/main/tasks/tasks_is_active_schedule';
import { buildTask } from '../../../../../src/main/tasks/tasks_build_task';
import type { TaskSchedule } from '../../../../../src/main/tasks/tasks_types';
import {
	createTaskRequestSchema,
	updateTaskRequestSchema,
} from '../../../../../src/main/agent/tools/tasks/schema';

function schedule(overrides: Partial<TaskSchedule> = {}): TaskSchedule {
	return {
		id: 's1',
		name: 'Nightly',
		description: 'runs nightly',
		cronExpression: '0 0 * * *',
		enabled: true,
		prompt: 'do it',
		effort: 'low',
		createdAt: 'now',
		updatedAt: 'now',
		...overrides,
	} as TaskSchedule;
}

describe('clone', () => {
	it('deep-copies a value', () => {
		const original = { a: { b: 1 }, list: [1, 2] };
		const copy = clone(original);
		expect(copy).toEqual(original);
		expect(copy).not.toBe(original);
		expect(copy.a).not.toBe(original.a);
	});
});

describe('isActiveSchedule', () => {
	it('reflects the enabled flag', () => {
		expect(isActiveSchedule(schedule({ enabled: true }))).toBe(true);
		expect(isActiveSchedule(schedule({ enabled: false }))).toBe(false);
	});
});

describe('buildTask', () => {
	it('derives a task from the schedule', () => {
		const task = buildTask(schedule({ name: 'Nightly', description: 'runs nightly' }));
		expect(task.title).toBe('Nightly');
		expect(task.description).toBe('runs nightly');
		expect(task.id).toMatch(/[0-9a-f-]{36}/);
		expect(task.createdAt).toBe(task.updatedAt);
	});
});

describe('task request schemas', () => {
	it('accepts direct agent fields and strips model-supplied permission overrides', () => {
		expect(
			createTaskRequestSchema.parse({
				name: 'Nightly',
				prompt: 'do it',
				effort: 'low',
				permissionMode: 'bypass',
				toolsAllow: ['exec'],
			})
		).toEqual({ name: 'Nightly', prompt: 'do it', effort: 'low' });
		expect(
			updateTaskRequestSchema.parse({
				prompt: 'do it',
				effort: 'low',
				permissionMode: 'bypass',
				toolsAllow: ['exec'],
			})
		).toEqual({ prompt: 'do it', effort: 'low' });
	});

	it('requires a prompt and effort for new tasks', () => {
		expect(() => createTaskRequestSchema.parse({ name: 'Nightly', action: { type: 'agent' } })).toThrow();
	});
});
