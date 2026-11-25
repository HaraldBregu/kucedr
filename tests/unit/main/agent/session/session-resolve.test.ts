import { existsSync, lstatSync, readdirSync, readlinkSync, realpathSync, statSync } from 'node:fs';

jest.mock('node:fs', () => ({
	existsSync: jest.fn(),
	lstatSync: jest.fn(() => ({ isSymbolicLink: () => false })),
	readdirSync: jest.fn(),
	readlinkSync: jest.fn(),
	realpathSync: Object.assign(jest.fn((value: string) => value), { native: (value: string) => value }),
	statSync: jest.fn(),
}));

jest.mock('node:crypto', () => ({
	randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
}));

import { latestUuidSessionId } from '../../../../../src/main/agent/session/session_latest_uuid_session_id';
import { resolveSessionId } from '../../../../../src/main/agent/session/session_resolve_session_id';
import { resolveStoredSessionId } from '../../../../../src/main/agent/session/session_resolve_stored_session_id';

const existsMock = existsSync as jest.Mock;
const lstatMock = lstatSync as jest.Mock;
const readdirMock = readdirSync as jest.Mock;
const readlinkMock = readlinkSync as jest.Mock;
const realpathMock = realpathSync as jest.Mock;
const statMock = statSync as jest.Mock;

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

function dirEntry(name: string): { name: string; isDirectory: () => boolean } {
	return { name, isDirectory: () => true };
}

beforeEach(() => {
	existsMock.mockReset();
	lstatMock.mockReset().mockReturnValue({ isSymbolicLink: () => false });
	readdirMock.mockReset();
	readlinkMock.mockReset();
	realpathMock.mockReset().mockImplementation((value: string) => value);
	statMock.mockReset();
});

describe('latestUuidSessionId', () => {
	it('returns undefined when the directory is missing', () => {
		existsMock.mockReturnValue(false);
		expect(latestUuidSessionId('/root', 'main')).toBeUndefined();
	});

	it('returns the newest uuid directory, ignoring non-uuid entries', () => {
		existsMock.mockReturnValue(true);
		readdirMock.mockReturnValue([dirEntry(UUID_A), dirEntry(UUID_B), dirEntry('legacy')]);
		statMock.mockImplementation((p: string) => ({
			birthtimeMs: p.includes(UUID_B) ? 200 : 100,
			ctimeMs: 0,
			mtimeMs: 0,
		}));
		expect(latestUuidSessionId('/root', 'main')).toBe(UUID_B);
	});

	it('swallows errors and returns undefined', () => {
		existsMock.mockReturnValue(true);
		readdirMock.mockImplementation(() => {
			throw new Error('boom');
		});
		expect(latestUuidSessionId('/root', 'main')).toBeUndefined();
	});
});

describe('resolveSessionId', () => {
	it('generates a uuid when none provided', () => {
		expect(resolveSessionId(undefined)).toBe('00000000-0000-4000-8000-000000000000');
	});
	it('returns the id unchanged when it is already a uuid', () => {
		expect(resolveSessionId(UUID_A, '/loc', 'main')).toBe(UUID_A);
	});
	it('returns the id unchanged when no location is given', () => {
		expect(resolveSessionId('home')).toBe('home');
	});
	it('resolves a legacy id to the latest stored uuid', () => {
		existsMock.mockReturnValue(true);
		readdirMock.mockReturnValue([dirEntry(UUID_A)]);
		statMock.mockReturnValue({ birthtimeMs: 1, ctimeMs: 0, mtimeMs: 0 });
		expect(resolveSessionId('home', '/loc', 'main')).toBe(UUID_A);
	});
	it('falls back to a generated uuid when nothing stored', () => {
		existsMock.mockReturnValue(false);
		expect(resolveSessionId('home', '/loc', 'main')).toBe('00000000-0000-4000-8000-000000000000');
	});
});

describe('resolveStoredSessionId', () => {
	it('returns the id when it is a uuid or no location', () => {
		expect(resolveStoredSessionId(UUID_A, '/loc', 'main')).toBe(UUID_A);
		expect(resolveStoredSessionId('home')).toBe('home');
	});
	it('falls back to the original id when nothing stored', () => {
		existsMock.mockReturnValue(false);
		expect(resolveStoredSessionId('home', '/loc', 'main')).toBe('home');
	});
});
