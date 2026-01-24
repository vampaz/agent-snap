import { describe, expect, it } from 'vitest';

import * as agentSnap from '@/index';

describe('index exports', function () {
  it('exposes public api', function () {
    expect(typeof agentSnap.createAgentSnap).toBe('function');
    expect(typeof agentSnap.registerAgentSnapElement).toBe('function');
  });
});
