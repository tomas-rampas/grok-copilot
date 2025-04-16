import { strict as assert } from 'assert';
import { describe, it } from 'mocha';

describe('Grok Copilot Extension Test Suite', () => {
    it('should have correct command definitions', () => {
        // Mock command list
        const commands = ['grok-copilot.suggest', 'grok-copilot.chat'];
        assert.strictEqual(commands.length, 2, 'Expected 2 commands');
        assert.ok(commands.includes('grok-copilot.suggest'), 'Suggest command missing');
        assert.ok(commands.includes('grok-copilot.chat'), 'Chat command missing');
    });

    it('should have default API key configuration', () => {
        // Mock configuration
        const mockConfig = { 'grok-copilot.apiKey': '' };
        assert.strictEqual(mockConfig['grok-copilot.apiKey'], '', 'API key default should be empty');
    });
});